/**
 * 轻断食服务
 *
 * 计划模型：fasting_records 一行当日记录即当日计划。
 * 用户第一次设置后，每天打卡不再需要手动建计划——
 * start/end 时当日无记录会自动按「请求携带的设置 > 最近一次计划 > 16:8 默认」创建。
 */
const { db, withTransaction } = require('../db');
const currencyService = require('./currencyService');
const taskService = require('./taskService');
const achievementService = require('./achievementService');

const MODE_PRESETS = {
  '16:8': { target_hours: 16, eating_window_start: '10:00', eating_window_end: '18:00' },
  '18:6': { target_hours: 18, eating_window_start: '12:00', eating_window_end: '18:00' },
  '20:4': { target_hours: 20, eating_window_start: '12:00', eating_window_end: '16:00' },
  '14:10': { target_hours: 14, eating_window_start: '08:00', eating_window_end: '18:00' },
  '5:2': { target_hours: 24, eating_window_start: null, eating_window_end: null },
  'omad': { target_hours: 23, eating_window_start: '12:00', eating_window_end: '13:00' }
};

/**
 * 获取今日轻断食状态（若今日无记录则按最近一次计划自动创建，保持用户设置不丢失）
 */
function getTodayFasting(userId, date = null) {
  const recordDate = date || new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT * FROM fasting_records WHERE user_id = ? AND record_date = ?').get(userId, recordDate);
  if (existing) return existing;

  // 今日无记录：查找最近一次计划，若存在则自动创建今日计划
  const last = db.prepare(`
    SELECT * FROM fasting_records WHERE user_id = ? ORDER BY record_date DESC, id DESC LIMIT 1
  `).get(userId);

  if (!last) return null;

  // 按最近计划设置创建今日记录
  insertPlan(userId, recordDate, {
    mode: last.mode,
    target_hours: last.target_hours,
    eating_window_start: last.eating_window_start,
    eating_window_end: last.eating_window_end
  });
  return getTodayFasting(userId, recordDate);
}

function insertPlan(userId, today, { mode, target_hours, eating_window_start, eating_window_end, note = '' }) {
  const preset = MODE_PRESETS[mode] || MODE_PRESETS['16:8'];
  const id = db.prepare(`
    INSERT INTO fasting_records (user_id, record_date, mode, target_hours, eating_window_start, eating_window_end, status, note)
    VALUES (?, ?, ?, ?, ?, ?, 'planned', ?)
  `).run(
    userId, today, mode,
    target_hours || preset.target_hours,
    eating_window_start || preset.eating_window_start,
    eating_window_end || preset.eating_window_end,
    note
  ).lastInsertRowid;
  return id;
}

/**
 * 确保当日有计划行：没有则按「请求设置 > 最近一次计划 > 默认」自动创建
 */
function ensureTodayPlan(userId, payload = {}) {
  const today = new Date().toISOString().split('T')[0];
  const existing = getTodayFasting(userId, today);
  if (existing) return existing;

  const last = db.prepare(`
    SELECT * FROM fasting_records WHERE user_id = ? ORDER BY record_date DESC, id DESC LIMIT 1
  `).get(userId);

  insertPlan(userId, today, {
    mode: payload.mode || (last && last.mode) || '16:8',
    target_hours: payload.target_hours || (last && last.target_hours) || null,
    eating_window_start: payload.eating_window_start || (last && last.eating_window_start) || null,
    eating_window_end: payload.eating_window_end || (last && last.eating_window_end) || null
  });
  return getTodayFasting(userId, today);
}

/**
 * 保存/更新今日计划设置（编辑面板确定时调用）。
 * 已有当日记录则更新设置（不动打卡状态），没有则新建。
 */
function planFasting(userId, { mode = '16:8', target_hours = 16, eating_window_start, eating_window_end, note = '' }) {
  return withTransaction(() => {
    const today = new Date().toISOString().split('T')[0];
    const existing = getTodayFasting(userId, today);
    if (existing) {
      db.prepare(`
        UPDATE fasting_records
        SET mode = ?, target_hours = ?, eating_window_start = ?, eating_window_end = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        mode,
        target_hours || existing.target_hours || (MODE_PRESETS[mode] || MODE_PRESETS['16:8']).target_hours,
        eating_window_start !== undefined ? eating_window_start : existing.eating_window_start,
        eating_window_end !== undefined ? eating_window_end : existing.eating_window_end,
        existing.id
      );
      return { id: existing.id, status: existing.status, updated: true };
    }

    const id = insertPlan(userId, today, { mode, target_hours, eating_window_start, eating_window_end, note });
    return { id, status: 'planned' };
  });
}

function startFasting(userId, payload = {}) {
  return withTransaction(() => {
    // 无当日计划时自动按设置创建，保证设置一次后每天都能打卡
    const fasting = ensureTodayPlan(userId, payload);
    if (fasting.status !== 'planned') return { error: '当前状态不能开始禁食' };

    db.prepare(`
      UPDATE fasting_records SET status = 'fasting', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fasting.id);

    return { id: fasting.id, status: 'fasting' };
  });
}

function endFasting(userId, payload = {}) {
  return withTransaction(() => {
    const today = new Date().toISOString().split('T')[0];
    const fasting = ensureTodayPlan(userId, payload);
    if (fasting.status !== 'fasting' && fasting.status !== 'planned') return { error: '当前状态不能结束禁食' };

    const now = new Date();
    let startAt;
    if (fasting.started_at) {
      startAt = new Date(fasting.started_at);
    } else {
      // 未点击开始，按进食窗口结束时间作为禁食起点
      const endTime = fasting.eating_window_end || '18:00';
      startAt = new Date(`${today}T${endTime}:00`);
      if (startAt > now) startAt = new Date(`${today}T00:00:00`);
    }

    const actualHours = Math.max(0, Math.floor((now - startAt) / 3600000));
    const completed = actualHours >= (fasting.target_hours || 16);
    const status = completed ? 'completed' : 'failed';

    db.prepare(`
      UPDATE fasting_records
      SET status = ?, actual_hours = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, actualHours, fasting.id);

    if (completed) {
      // 浆果奖励已收口到任务系统：这里只推进任务进度，由任务配置决定是否发奖
      taskService.updateTaskProgress(userId, 'record_fasting_complete', 1);
      achievementService.checkSpecial(userId);
    }

    return { id: fasting.id, status, actual_hours: actualHours };
  });
}

function cancelFasting(userId) {
  const today = new Date().toISOString().split('T')[0];
  const fasting = getTodayFasting(userId, today);
  if (!fasting) return { error: '今日没有轻断食计划' };
  if (fasting.status === 'completed' || fasting.status === 'failed') return { error: '当前状态不能取消' };

  db.prepare(`DELETE FROM fasting_records WHERE id = ?`).run(fasting.id);
  return { success: true };
}

function getFastingStats(userId) {
  const totalCompleted = db.prepare(`
    SELECT COUNT(*) as count FROM fasting_records
    WHERE user_id = ? AND status = 'completed'
  `).get(userId).count;

  const thisWeekCompleted = db.prepare(`
    SELECT COUNT(*) as count FROM fasting_records
    WHERE user_id = ? AND status = 'completed'
    AND strftime('%Y-%W', record_date) = strftime('%Y-%W', 'now')
  `).get(userId).count;

  const thisWeek52 = db.prepare(`
    SELECT COUNT(*) as count FROM fasting_records
    WHERE user_id = ? AND status = 'completed' AND mode = '5:2'
    AND strftime('%Y-%W', record_date) = strftime('%Y-%W', 'now')
  `).get(userId).count;

  const rows = db.prepare(`
    SELECT record_date FROM fasting_records
    WHERE user_id = ? AND status = 'completed'
    ORDER BY record_date ASC
  `).all(userId);

  let maxStreak = 0;
  let current = 0;
  let prev = null;
  for (const row of rows) {
    const d = new Date(row.record_date);
    if (prev) {
      const diff = (d - prev) / 86400000;
      if (diff === 1) {
        current++;
      } else if (diff > 1) {
        current = 1;
      }
    } else {
      current = 1;
    }
    if (current > maxStreak) maxStreak = current;
    prev = d;
  }

  return {
    total_completed: totalCompleted,
    this_week_completed: thisWeekCompleted,
    this_week_5_2_days: thisWeek52,
    longest_streak: maxStreak
  };
}

module.exports = {
  getTodayFasting,
  planFasting,
  startFasting,
  endFasting,
  cancelFasting,
  getFastingStats
};
