/**
 * 一次性脚本：按当前食物库/别名映射重新计算所有饮食记录
 * 用于修复历史记录中因别名映射不完善导致的热量错误
 */
require('dotenv').config();
const { db } = require('../db');
const { computeFoodNutrition } = require('../services/nutritionService');

function recalc() {
  const rows = db.prepare(`
    SELECT id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat
    FROM diet_records
    WHERE status = 1
  `).all();

  let updatedCount = 0;
  const update = db.prepare(`
    UPDATE diet_records
    SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  for (const row of rows) {
    try {
      const foods = JSON.parse(row.foods || '[]');
      if (!Array.isArray(foods) || foods.length === 0) continue;

      // 重新计算时先清空分类，让 computeFoodNutrition 按名称重新判定正确的 category
      // 避免历史错误数据（如"蔬菜"被标成"零食饮料类"）继续保留错误分类
      const recomputed = foods.map(f => computeFoodNutrition({ ...f, category: '', sub_category: '' }));
      const totalCalorie = recomputed.reduce((sum, f) => sum + (parseFloat(f.calorie) || 0), 0);
      const totalProtein = recomputed.reduce((sum, f) => sum + (parseFloat(f.protein) || 0), 0);
      const totalCarb = recomputed.reduce((sum, f) => sum + (parseFloat(f.carb) || 0), 0);
      const totalFat = recomputed.reduce((sum, f) => sum + (parseFloat(f.fat) || 0), 0);

      const changed =
        Math.abs(totalCalorie - (row.total_calorie || 0)) > 0.1 ||
        JSON.stringify(foods) !== JSON.stringify(recomputed);

      if (changed) {
        update.run(
          JSON.stringify(recomputed),
          totalCalorie,
          totalProtein,
          totalCarb,
          totalFat,
          row.id
        );
        updatedCount++;
        console.log(`[recalc] 记录 #${row.id} 已更新: ${row.total_calorie} kcal -> ${totalCalorie} kcal`);
      }
    } catch (e) {
      console.error(`[recalc] 记录 #${row.id} 处理失败:`, e.message);
    }
  }

  console.log(`\n[recalc] 共处理 ${rows.length} 条记录，更新 ${updatedCount} 条`);
}

recalc();
