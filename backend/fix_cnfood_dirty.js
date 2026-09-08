/**
 * 清洗导入的脏数据 + 修正归类 + 补别名
 * 用法: NODE_ENV=production node fix_cnfood_dirty.js [--dry]
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');
const DRY = process.argv.includes('--dry');

/* 1. 找出名称带异常字符的 cnfood6 条目（引号/问号/中文顿号混杂编码特征） */
const dirty = db.prepare(`
  SELECT id, food_name, calories_per_100g, fat_per_100g FROM food_db
  WHERE source = 'cnfood6'
    AND (food_name LIKE '%"%'
      OR food_name LIKE '%?%'
      OR food_name LIKE '%、%(%'
      OR food_name LIKE '%A%' AND food_name GLOB '*[0-9]*' AND food_name NOT LIKE '%(%)%')
`).all();
console.log('=== 名称异常条目 ===');
dirty.forEach(r => console.log(`id=${r.id} "${r.food_name}" cal=${r.calories_per_100g} fat=${r.fat_per_100g}`));

/* 2. 营养明显异常的条目（脂肪>40 但非油脂类名称 / 热量<15 但脂肪>5） */
const weird = db.prepare(`
  SELECT id, food_name, calories_per_100g, protein_per_100g, carb_per_100g, fat_per_100g
  FROM food_db WHERE source='cnfood6' AND (fat_per_100g > 40 AND food_name NOT LIKE '%油%' AND food_name NOT LIKE '%肥肉%' AND food_name NOT LIKE '%核桃%' AND food_name NOT LIKE '%松子%' AND food_name NOT LIKE '%芝麻%')
     OR (calories_per_100g < 15 AND fat_per_100g > 5)
`).all();
console.log('\n=== 营养异常条目 ===');
weird.forEach(r => console.log(`id=${r.id} "${r.food_name}" cal=${r.calories_per_100g} P=${r.protein_per_100g} C=${r.carb_per_100g} F=${r.fat_per_100g}`));

if (DRY) { console.log('\n(DRY RUN，未修改)'); process.exit(0); }

/* 3. 删除脏条目 */
const del = db.prepare("DELETE FROM food_db WHERE id = ?");
let delCount = 0;
const seen = new Set();
for (const r of [...dirty, ...weird]) {
  if (seen.has(r.id)) continue;
  seen.add(r.id);
  // 白名单：正常食物误伤保护（名称含正常括号蔬菜名等跳过删除）
  if (/^[\u4e00-\u9fa5A-Za-z0-9（）()\-,、]+$/.test(r.food_name) && !r.food_name.includes('?') && !r.food_name.includes('"')) continue;
  del.run(r.id);
  delCount++;
}
console.log(`\n删除脏条目: ${delCount} 条`);

/* 4. 给高频条目补别名（米饭 → 米饭(蒸,粳米) 等） */
const addAlias = db.prepare("UPDATE food_db SET aliases = ? WHERE id = ?");
const aliasPatch = [
  ['米饭(蒸,粳米)', ['米饭', '白米饭', '粳米饭']],
  ['米饭(蒸,籼米)', ['籼米饭']],
  ['糯米', ['江米']],
  ['粳米(标一)', ['大米', '稻米']],
];
for (const [name, aliases] of aliasPatch) {
  const row = db.prepare("SELECT id, aliases FROM food_db WHERE food_name = ?").get(name);
  if (!row) continue;
  const merged = [...new Set([...(row.aliases ? JSON.parse(row.aliases) : []), ...aliases])];
  addAlias.run(JSON.stringify(merged), row.id);
  console.log(`✅ "${name}" 别名补全: ${merged.join(',')}`);
}

/* 5. 归类修正：西兰花等蔬菜误归菜肴类 */
const reclassify = db.prepare("UPDATE food_db SET category = ?, sub_category = ? WHERE id = ?");
const fixes = [
  ['西兰花', '蔬菜水果类', '蔬菜菌藻'],
  ['绿菜花', '蔬菜水果类', '蔬菜菌藻'],
];
for (const [name, cat, sub] of fixes) {
  const row = db.prepare("SELECT id FROM food_db WHERE food_name = ? AND source = 'cnfood6'").get(name);
  if (row) { reclassify.run(cat, sub, row.id); console.log(`✅ "${name}" → ${cat}`); }
}

/* 6. legacy"西红柿"与公开库"番茄"合并：legacy 条目挂别名并采用公开库营养值 */
const tomato = db.prepare("SELECT * FROM food_db WHERE food_name = '番茄' AND source = 'cnfood6'").get();
const oldTomato = db.prepare("SELECT * FROM food_db WHERE food_name = '西红柿' AND source = 'legacy'").get();
if (tomato && oldTomato) {
  db.prepare("UPDATE food_db SET calories_per_100g=?, protein_per_100g=?, carb_per_100g=?, fat_per_100g=?, source='cnfood6', aliases=? WHERE id=?")
    .run(tomato.calories_per_100g, tomato.protein_per_100g, tomato.carb_per_100g, tomato.fat_per_100g,
      JSON.stringify(['番茄', '西红柿']), oldTomato.id);
  // 删除重复的 cnfood6 番茄条目
  db.prepare("DELETE FROM food_db WHERE id = ?").run(tomato.id);
  console.log(`✅ legacy"西红柿"已采用公开库番茄营养值并合并`);
}

console.log('\n=== 最终统计 ===');
db.prepare("SELECT source, COUNT(*) as c FROM food_db GROUP BY source").all().forEach(r => console.log(`${r.source}: ${r.c}条`));
