/** 最终验证: 品牌库别名命中 + 全库统计 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db', { readonly: true });

const cases = [
  ['霸王茶姬伯牙绝弦（正常糖）', '全名精确'],
  ['生椰拿铁', '口语别名→瑞幸'],
  ['多肉葡萄', '口语别名→喜茶'],
  ['伯牙绝弦', '产品名模糊命中'],
];
for (const [q, desc] of cases) {
  const r = db.prepare(
    "SELECT food_name, calories_per_100g cal, protein_per_100g p, carb_per_100g c, fat_per_100g f, source FROM food_db WHERE food_name = ? OR (aliases IS NOT NULL AND aliases LIKE ?) ORDER BY CASE WHEN food_name = ? THEN 0 ELSE 1 END, LENGTH(food_name) LIMIT 1"
  ).get(q, `%"${q}"%`, q);
  console.log(`${r ? '✅' : '❌'} "${q}"(${desc}) →`, r ? `${r.food_name} ${r.cal}kcal P${r.p}/C${r.c}/F${r.f} [${r.source}]` : '未命中');
}

console.log('\n=== 全库统计 ===');
db.prepare("SELECT source, COUNT(*) c FROM food_db GROUP BY source ORDER BY c DESC").all().forEach(r => console.log(`${r.source}: ${r.c}条`));
console.log('总数:', db.prepare('SELECT COUNT(*) c FROM food_db').get().c);
console.log('GI挂载:', db.prepare('SELECT COUNT(*) c FROM food_db WHERE gi IS NOT NULL').get().c, '条');
console.log('AI回填:', db.prepare("SELECT COUNT(*) c FROM food_db WHERE remark LIKE '%AI估算回填%'").get().c, '条');
