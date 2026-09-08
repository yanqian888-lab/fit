/**
 * 端到端验证：别名命中 + 营养素补全（模拟真实沉淀链路调用 getFoodNutrition）
 * 用法: NODE_ENV=production node verify_e2e_cnfood.js
 */
const nutritionService = require('./src/services/nutritionService');

const cases = [
  '鸡胸肉',      // 口语别名 → 公开库鸡胸脯肉
  '西红柿',      // → 番茄
  '牛奶',        // → 全脂牛奶（GENERIC_FOOD_FALLBACKS 有"牛奶"先命中，验证顺序正确性）
  '米饭',        // 前缀匹配 → 米饭(蒸,粳米)
  '西兰花',      // → 绿菜花(公开库)
  '低脂牛奶',    // GENERIC_FOOD_FALLBACKS 兜底
  '宫保鸡丁'     // legacy 菜品
];

for (const name of cases) {
  const r = nutritionService.getFoodNutrition(name);
  if (r) {
    console.log(`✅ "${name}" → ${r.food_name || name} | ${r.calorie_per_100g}kcal/100g | 蛋白${r.protein_per_100g}g 碳水${r.carb_per_100g}g 脂肪${r.fat_per_100g}g | ${r.category || ''}`);
  } else {
    console.log(`❌ "${name}" → 查不到`);
  }
}
process.exit(0);
