/**
 * 数据补丁：删除与成分表主值冲突的重复西红柿条目（13kcal），保留19kcal
 * 用法: NODE_ENV=production node fix_tomato.js
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');

// 删除 13kcal 的异常西红柿条目（与成分表番茄主值19kcal冲突）
const del = db.prepare("DELETE FROM food_db WHERE id = ? AND food_name = '西红柿' AND calories_per_100g = 13").run(1897);
console.log('删除异常西红柿:', del.changes, '条');

// 确认番茄条目挂了"西红柿"别名
const tomato = db.prepare("SELECT id, aliases FROM food_db WHERE food_name = '番茄' AND source = 'cnfood6'").get();
if (tomato) {
  const aliases = tomato.aliases ? JSON.parse(tomato.aliases) : [];
  if (!aliases.includes('西红柿')) {
    aliases.push('西红柿');
    db.prepare("UPDATE food_db SET aliases = ? WHERE id = ?").run(JSON.stringify(aliases), tomato.id);
    console.log('番茄别名补全:', aliases.join(','));
  } else {
    console.log('番茄别名已含西红柿:', aliases.join(','));
  }
}
console.log('\n最终验证:');
db.prepare("SELECT id, food_name, calories_per_100g, source, aliases FROM food_db WHERE food_name IN ('番茄','西红柿')").all().forEach(r => console.log(JSON.stringify(r)));
