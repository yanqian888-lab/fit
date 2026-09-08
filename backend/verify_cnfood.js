/**
 * 验证公开库导入 + 别名命中
 * 用法: NODE_ENV=production node verify_cnfood.js
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db', { readonly: true });

/** 模拟 nutritionService 的别名查询：名称精确 或 别名 JSON 精确元素命中 */
function lookup(name) {
  const rows = db.prepare(
    "SELECT food_name, calories_per_100g as cal, protein_per_100g as protein, carb_per_100g as carb, fat_per_100g as fat, source, aliases FROM food_db WHERE food_name = ? OR (aliases IS NOT NULL AND aliases LIKE ?) LIMIT 1"
  ).all(name, `%"${name}"%`);
  return rows[0] || null;
}

const cases = [
  '鸡胸肉',      // 口语别名 → 应命中公开库"鸡胸脯肉"
  '西红柿',      // → 番茄
  '土豆',        // → 马铃薯
  '牛奶',        // → 牛乳
  '低脂牛奶',    // → ❌ 成分表无（GENERIC_FOOD_FALLBACKS 兜底）
  '米饭',        // → 米饭(蒸,粳米)?
  '宫保鸡丁',    // → ❌ 菜品（LLM 兜底）
  '红薯',        // → 甘薯
  '西兰花',      // → 绿菜花
  '鸡蛋'         // 应命中鸡蛋(白皮)或直接条目
];

for (const c of cases) {
  const r = lookup(c);
  if (r) {
    console.log(`✅ "${c}" → ${r.food_name} | ${r.cal}kcal 蛋白${r.protein}g 碳水${r.carb}g 脂肪${r.fat}g | 来源:${r.source}${r.aliases ? ' | 别名:' + r.aliases : ''}`);
  } else {
    console.log(`❌ "${c}" → 库中无（走 LLM/兜底）`);
  }
}

console.log('\n=== 来源统计 ===');
db.prepare("SELECT source, COUNT(*) as c FROM food_db GROUP BY source").all().forEach(r => console.log(`${r.source}: ${r.c}条`));
