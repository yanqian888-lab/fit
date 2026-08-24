/**
 * 运动记录合并写入：同一天同名运动合并到已有记录（时长/消耗累加），而不是新增多行
 */
const { db } = require('../db');
const { safeJsonParse } = require('../utils/safeJson');

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const round1 = (n) => Math.round(n * 10) / 10;

function totalsOf(list) {
  return {
    totalDuration: round1(list.reduce((s, e) => s + num(e.duration), 0)),
    totalCalorie: round1(list.reduce((s, e) => s + num(e.calorie), 0))
  };
}

/**
 * 合并或插入运动记录
 * @returns {{ recordId: number, merged: boolean }}
 */
function mergeOrInsertExercise(userId, recordDate, exerciseType, exercises) {
  const rows = db.prepare(`
    SELECT id, exercises FROM exercise_records
    WHERE user_id = ? AND record_date = ? AND status = 1
    ORDER BY id ASC
  `).all(userId, recordDate);

  // 找到第一个包含同名运动的记录行：同名合并（时长/消耗累加），其余项追加到该行
  for (const row of rows) {
    const list = safeJsonParse(row.exercises, []);
    const hasMatch = exercises.some(ex =>
      ex && ex.name && list.some(e => e && e.name && String(e.name).trim() === String(ex.name).trim())
    );
    if (!hasMatch) continue;

    for (const ex of exercises) {
      const hit = ex && ex.name
        ? list.find(e => e && e.name && String(e.name).trim() === String(ex.name).trim())
        : null;
      if (hit) {
        hit.duration = round1(num(hit.duration) + num(ex.duration));
        hit.calorie = round1(num(hit.calorie) + num(ex.calorie));
      } else {
        list.push(ex);
      }
    }
    const { totalDuration, totalCalorie } = totalsOf(list);
    db.prepare(`
      UPDATE exercise_records
      SET exercises = ?, total_duration = ?, total_calorie = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(list), totalDuration, totalCalorie, row.id);
    return { recordId: row.id, merged: true };
  }

  // 无同名：新增一行
  const { totalDuration, totalCalorie } = totalsOf(exercises);
  const id = db.prepare(`
    INSERT INTO exercise_records (user_id, record_date, exercise_type, exercises, total_duration, total_calorie, remark, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(userId, recordDate, exerciseType, JSON.stringify(exercises), totalDuration, totalCalorie, null).lastInsertRowid;
  return { recordId: id, merged: false };
}

/**
 * 存量数据合并：同一用户同一天、跨行出现的同名运动合并到首次出现的行，
 * 被腾空的行删除。返回合并掉的重复运动项数。
 */
function mergeExistingDuplicates() {
  const groups = db.prepare(`
    SELECT user_id, record_date, COUNT(*) AS c FROM exercise_records
    WHERE status = 1
    GROUP BY user_id, record_date
    HAVING c > 1
  `).all();

  let mergedItems = 0;
  const update = db.prepare(`
    UPDATE exercise_records
    SET exercises = ?, total_duration = ?, total_calorie = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const del = db.prepare('DELETE FROM exercise_records WHERE id = ?');

  for (const g of groups) {
    const rows = db.prepare(`
      SELECT id, exercises FROM exercise_records
      WHERE user_id = ? AND record_date = ? AND status = 1
      ORDER BY id ASC
    `).all(g.user_id, g.record_date);

    const seen = {}; // 规范化名称 -> 首次出现的行 id
    let dirty = false;
    const rowState = rows.map(r => ({ id: r.id, list: safeJsonParse(r.exercises, []) }));

    for (const state of rowState) {
      for (const ex of [...state.list]) {
        const key = ex && ex.name ? String(ex.name).trim() : '';
        if (!key) continue;
        if (seen[key] === undefined) {
          seen[key] = state.id;
          continue;
        }
        // 同名：合并进首次出现的行
        const target = rowState.find(s => s.id === seen[key]);
        const hit = target.list.find(e => e && e.name && String(e.name).trim() === key);
        hit.duration = round1(num(hit.duration) + num(ex.duration));
        hit.calorie = round1(num(hit.calorie) + num(ex.calorie));
        state.list.splice(state.list.indexOf(ex), 1);
        dirty = true;
        mergedItems++;
      }
    }
    if (!dirty) continue;

    for (const state of rowState) {
      if (state.list.length === 0) {
        del.run(state.id);
      } else {
        const { totalDuration, totalCalorie } = totalsOf(state.list);
        update.run(JSON.stringify(state.list), totalDuration, totalCalorie, state.id);
      }
    }
  }
  return mergedItems;
}

module.exports = { mergeOrInsertExercise, mergeExistingDuplicates };
