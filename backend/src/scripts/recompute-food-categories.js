/**
 * 重新校准所有饮食记录中食物的 category/sub_category。
 * 仅修改标签字段，不改动热量/营养素，避免历史数据被再次变更。
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { getFoodNutrition } = require('../services/nutritionService');
const { db } = require('../db');

function recomputeCategories() {
  const rows = db.prepare('SELECT id, foods FROM diet_records WHERE status = 1').all();
  let updated = 0;

  const updateStmt = db.prepare('UPDATE diet_records SET foods = ? WHERE id = ?');

  for (const row of rows) {
    let foods;
    try {
      foods = JSON.parse(row.foods || '[]');
    } catch (e) {
      console.warn(`[recompute] 跳过记录 ${row.id}，foods 解析失败`);
      continue;
    }

    if (!Array.isArray(foods) || foods.length === 0) continue;

    let changed = false;
    const newFoods = foods.map((food) => {
      const name = food.name || food.food_name;
      if (!name) return food;

      const dbFood = getFoodNutrition(name);
      if (dbFood && dbFood.category) {
        if (food.category !== dbFood.category || food.sub_category !== dbFood.sub_category) {
          changed = true;
          return {
            ...food,
            category: dbFood.category,
            sub_category: dbFood.sub_category || food.sub_category || null,
          };
        }
      }
      return food;
    });

    if (changed) {
      updateStmt.run(JSON.stringify(newFoods), row.id);
      updated += 1;
    }
  }

  console.log(`[recompute] 共处理 ${rows.length} 条记录，更新 ${updated} 条`);
}

recomputeCategories();
