/**
 * 一次性修正 diet_records 中 total_* 字段
 * 原因：food.calorie/protein/carb/fat 已是对应当前重量的总量，
 * 但旧代码按每100g计算，导致总数被重复缩放。
 */
const { db } = require('../db');

const rows = db.prepare('SELECT id, foods FROM diet_records').all();
let updated = 0;

const update = db.prepare(`
  UPDATE diet_records
  SET total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

for (const row of rows) {
  try {
    const foods = JSON.parse(row.foods || '[]');
    if (!Array.isArray(foods) || foods.length === 0) continue;

    const totalCalorie = foods.reduce((sum, f) => sum + (parseFloat(f.calorie) || 0), 0);
    const totalProtein = foods.reduce((sum, f) => sum + (parseFloat(f.protein) || 0), 0);
    const totalCarb = foods.reduce((sum, f) => sum + (parseFloat(f.carb) || 0), 0);
    const totalFat = foods.reduce((sum, f) => sum + (parseFloat(f.fat) || 0), 0);

    update.run(totalCalorie, totalProtein, totalCarb, totalFat, row.id);
    updated++;
  } catch (e) {
    console.error(`[跳过] id=${row.id}: ${e.message}`);
  }
}

console.log(`[完成] 共修正 ${updated} 条饮食记录的总热量/营养素`);
process.exit(0);
