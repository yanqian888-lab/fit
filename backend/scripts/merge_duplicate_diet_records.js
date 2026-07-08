/**
 * 一次性维护脚本：合并同一餐别内的重复食物记录
 * 场景：用户分多次发送了相同午餐内容，导致同一餐别出现多条相同食物记录。
 * 处理规则：
 *   - 按 user_id + record_date + meal_time 分组
 *   - 同名食物合并数量/重量/营养素，保留一条记录
 *   - 合并后空记录删除
 */

const { db } = require('../src/db');

function round1(v) {
  return Math.round((parseFloat(v) || 0) * 10) / 10;
}

function foodNamesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 1 && b.includes(a)) return true;
  if (b.length > 1 && a.includes(b)) return true;
  return false;
}

function mergeFoodInto(existing, incoming) {
  existing.quantity = round1((parseFloat(existing.quantity) || 1) + (parseFloat(incoming.quantity) || 1));
  existing.weight = round1((parseFloat(existing.weight) || 0) + (parseFloat(incoming.weight) || 0));
  existing.calorie = round1((parseFloat(existing.calorie) || 0) + (parseFloat(incoming.calorie) || 0));
  existing.protein = round1((parseFloat(existing.protein) || 0) + (parseFloat(incoming.protein) || 0));
  existing.carb = round1((parseFloat(existing.carb) || 0) + (parseFloat(incoming.carb) || 0));
  existing.fat = round1((parseFloat(existing.fat) || 0) + (parseFloat(incoming.fat) || 0));
}

function normalizeFood(f) {
  if (!f) return f;
  f.quantity = round1(f.quantity);
  f.weight = round1(f.weight);
  f.calorie = round1(f.calorie);
  f.protein = round1(f.protein);
  f.carb = round1(f.carb);
  f.fat = round1(f.fat);
  return f;
}

function mergeDuplicateFoodsInRow(foods) {
  const map = new Map();
  for (const f of foods) {
    if (!f || !f.name) continue;
    normalizeFood(f);
    const existing = map.get(f.name);
    if (existing) {
      mergeFoodInto(existing, f);
    } else {
      map.set(f.name, { ...f });
    }
  }
  return Array.from(map.values());
}

function calculateTotals(foods) {
  return {
    calorie: foods.reduce((s, f) => s + (parseFloat(f.calorie) || 0), 0),
    protein: foods.reduce((s, f) => s + (parseFloat(f.protein) || 0), 0),
    carb: foods.reduce((s, f) => s + (parseFloat(f.carb) || 0), 0),
    fat: foods.reduce((s, f) => s + (parseFloat(f.fat) || 0), 0)
  };
}

function mergeGroup(rows) {
  if (!rows || rows.length <= 1) return { changed: false };

  // 先合并每一行内部的重复食物
  for (const row of rows) {
    const foods = JSON.parse(row.foods || '[]');
    const merged = mergeDuplicateFoodsInRow(foods);
    if (merged.length !== foods.length) {
      const totals = calculateTotals(merged);
      db.prepare(`
        UPDATE diet_records
        SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(merged), totals.calorie, totals.protein, totals.carb, totals.fat, row.id);
      row.foods = JSON.stringify(merged);
    }
  }

  // 按 id 排序，把后面的同名食物合并到第一条记录
  rows.sort((a, b) => a.id - b.id);
  const keepRow = rows[0];
  const keepFoods = JSON.parse(keepRow.foods || '[]').map(normalizeFood);
  const deleteIds = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const foods = JSON.parse(row.foods || '[]').map(normalizeFood);
    for (const f of foods) {
      if (!f || !f.name) continue;
      const match = keepFoods.find(kf => foodNamesMatch(kf.name, f.name));
      if (match) {
        mergeFoodInto(match, f);
      } else {
        keepFoods.push({ ...f });
      }
    }
    deleteIds.push(row.id);
  }

  if (deleteIds.length === 0 && keepFoods.length === JSON.parse(keepRow.foods || '[]').length) {
    return { changed: false };
  }

  const totals = calculateTotals(keepFoods);
  db.prepare(`
    UPDATE diet_records
    SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(keepFoods), totals.calorie, totals.protein, totals.carb, totals.fat, keepRow.id);

  if (deleteIds.length > 0) {
    const inClause = deleteIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM diet_records WHERE id IN (${inClause})`).run(...deleteIds);
  }

  return { changed: true, deleted: deleteIds.length };
}

function run() {
  const groups = db.prepare(`
    SELECT user_id, record_date, meal_time
    FROM diet_records
    GROUP BY user_id, record_date, meal_time
    HAVING COUNT(*) > 1
  `).all();

  let processedGroups = 0;
  let mergedRows = 0;

  for (const g of groups) {
    const rows = db.prepare(`
      SELECT id, foods FROM diet_records
      WHERE user_id = ? AND record_date = ? AND meal_time = ?
      ORDER BY id ASC
    `).all(g.user_id, g.record_date, g.meal_time);

    const result = mergeGroup(rows);
    if (result.changed) {
      processedGroups++;
      mergedRows += result.deleted || 0;
      console.log(`[合并] user=${g.user_id} date=${g.record_date} meal=${g.meal_time} 删除 ${result.deleted} 条重复记录`);
    }
  }

  console.log(`\n完成：处理了 ${processedGroups} 个餐别，删除/合并 ${mergedRows} 条重复记录。`);
}

run();
