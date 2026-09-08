/**
 * 修复 cn-brands 条目品牌名截断 bug（霸王茶姬→霸王 等）
 * 原理: 从 remark 提取原始品牌名，重新计算品牌简称，更新 food_name/aliases
 * 用法: NODE_ENV=production node fix_brand_names.js [--dry]
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');
const DRY = process.argv.includes('--dry');

/** 品牌简称：保留中文主体，仅剔除英文名/空格和明确的机构后缀词（不伤"茶"字） */
function brandShort(brand) {
  let name = String(brand).replace(/[A-Za-z0-9·&''""（）()\- ]+/g, '').trim();
  name = name.replace(/(咖啡|奶茶店|饮品|食品|旗舰店|中国|官方|连锁)$/, '');
  return name.trim() || String(brand).trim();
}

const rows = db.prepare("SELECT id, food_name, aliases, remark FROM food_db WHERE source = 'cn-brands'").all();
const upd = db.prepare('UPDATE food_db SET food_name=?, aliases=? WHERE id=?');

let fixed = 0;
for (const r of rows) {
  const m = (r.remark || '').match(/品牌:(.+)/);
  if (!m) continue;
  const short = brandShort(m[1]);
  const aliasArr = r.aliases ? JSON.parse(r.aliases) : [];
  const productName = aliasArr[0]; // 设计约定：aliases[0] = 纯产品名
  if (!productName) continue;
  const newFullName = `${short}${productName}`;
  const newAliases = [...new Set([productName, `${short} ${productName}`].filter(a => a !== newFullName))];
  if (newFullName !== r.food_name) {
    if (!DRY) upd.run(newFullName, JSON.stringify(newAliases), r.id);
    fixed++;
    if (fixed <= 10) console.log(`✅ "${r.food_name}" → "${newFullName}"`);
  }
}
console.log(`${DRY ? '[DRY] ' : ''}共修复 ${fixed} 条品牌名`);
