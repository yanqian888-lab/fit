/**
 * 导入 cn-brands 品牌食品库 + GI 升糖指数挂载
 * 1. food_db 加 gi 列
 * 2. 解析 cn_brands.md（443行表格）→ food_db（source='cn-brands'）
 * 3. gi_data.json 匹配现有条目挂 GI 值
 * 用法: NODE_ENV=production node import_brands_gi.js [--dry]
 */
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');
const DRY = process.argv.includes('--dry');

/* ---------- 1. 加 gi 列 ---------- */
const cols = db.prepare('PRAGMA table_info(food_db)').all().map(c => c.name);
if (!cols.includes('gi')) {
  if (!DRY) db.prepare('ALTER TABLE food_db ADD COLUMN gi INTEGER').run();
  console.log('✅ gi 列已添加');
}

/* ---------- 2. 解析并导入 cn_brands.md（表头驱动：每张表按自己的表头映射列） ---------- */
function parseBrands() {
  const lines = fs.readFileSync('cn_brands.md', 'utf-8').split(/\r?\n/);
  const items = [];
  let group = '', brand = '', colMap = null;

  const parseHeader = (line) => {
    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    if (!cells.length) return null;
    const map = { name: -1, spec: -1, cal: -1, protein: -1, fat: -1, carb: -1, alcohol: -1 };
    cells.forEach((c, i) => {
      if (/产品|菜品|名称|食物/.test(c)) map.name = i;
      else if (/规格/.test(c)) map.spec = i;
      else if (/热量/.test(c)) map.cal = i;
      else if (/蛋白/.test(c)) map.protein = i;
      else if (/脂肪/.test(c)) map.fat = i;
      else if (/碳水|糖/.test(c)) map.carb = i;
      else if (/酒精度/.test(c)) map.alcohol = i;
    });
    return map.name >= 0 && map.cal >= 0 ? map : null; // 必须有名称+热量列才算有效表头
  };

  const num = (s) => { const m = String(s || '').match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };

  for (const line of lines) {
    const g = line.match(/^##\s+.+?\s+(.+)$/);
    const b = line.match(/^###\s+(.+)$/);
    if (b && !/^-+$/.test(b[1].trim())) { brand = b[1].trim(); colMap = null; continue; }
    if (g) { group = g[1].trim(); continue; }
    if (!line.startsWith('|')) continue;
    if (/^\|[\s\-|]+\|?$/.test(line)) continue; // 分隔行

    if (!colMap) {
      colMap = parseHeader(line); // 尝试当表头解析
      continue;
    }
    const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
    const name = cells[colMap.name];
    const calRaw = cells[colMap.cal];
    if (!name || !calRaw || !/[\d]/.test(calRaw)) { colMap = parseHeader(line) || colMap; continue; }
    items.push({
      group, brand, name: name.replace(/"/g, '').trim(),
      spec: colMap.spec >= 0 ? (cells[colMap.spec] || '') : '',
      cal: num(calRaw),
      protein: colMap.protein >= 0 ? num(cells[colMap.protein]) : 0,
      fat: colMap.fat >= 0 ? num(cells[colMap.fat]) : 0,
      carb: colMap.carb >= 0 ? num(cells[colMap.carb]) : 0,
      alcohol: colMap.alcohol >= 0 ? (cells[colMap.alcohol] || '') : ''
    });
  }
  return items;
}

const brands = parseBrands();
console.log(`品牌库解析: ${brands.length} 条，涉及品牌: ${[...new Set(brands.map(b => b.brand))].length} 个`);

// 品牌中文名提取（"瑞幸咖啡 Luckin" → "瑞幸"）
function brandShort(brand) {
  const stop = ['咖啡', '茶', 'LELECHA', 'HEYTEA', 'CHAGEE', 'Luckin', 'Starbucks', 'Manner', 'CoCo', 'Nayuki', '茶百道', 'Good', 'Me', 'KFC', 'Mcdonald', 'McDonald', 'Burger', 'King', 'Dicos'];
  let name = brand;
  for (const s of stop) name = name.replace(new RegExp(s, 'gi'), '');
  return name.trim() || brand;
}

const insBrand = db.prepare(`INSERT INTO food_db (food_id, category, sub_category, food_name, calories_per_100g, common_unit, edible_rate, remark,
  protein_per_100g, carb_per_100g, fat_per_100g, source, aliases, created_at)
  VALUES ((SELECT COALESCE(MAX(food_id),0)+1 FROM food_db), ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'cn-brands', ?, datetime('now'))`);

let brandIns = 0, brandSkip = 0;
if (!DRY) {
  const exists = (name) => db.prepare('SELECT 1 FROM food_db WHERE food_name = ?').get(name);
  for (const it of brands) {
    const short = brandShort(it.brand);
    const fullName = `${short}${it.name}`;          // food_name: 瑞幸生椰拿铁
    const aliases = [...new Set([it.name, `${short} ${it.name}`].filter(a => a !== fullName))]; // 别名: 生椰拿铁
    if (exists(fullName)) { brandSkip++; continue; }
    insBrand.run(
      it.group.includes('奶茶') || it.group.includes('咖啡') || it.group.includes('饮料') || it.group.includes('酒') ? '零食饮料类' : '中西菜肴类',
      short,
      fullName,
      it.cal,
      `${it.spec || ''}${it.alcohol ? '(' + it.alcohol + ')' : ''}`.trim() || '1份',
      `品牌:${it.brand}`,
      it.protein, it.carb, it.fat,
      JSON.stringify(aliases)
    );
    brandIns++;
  }
}
console.log(`品牌库导入${DRY ? '(预演)' : ''}: 新增 ${brandIns}, 跳过重复 ${brandSkip}`);

/* ---------- 3. GI 数据挂载 ---------- */
const giRaw = JSON.parse(fs.readFileSync('gi_data.json', 'utf-8'));
const giItems = [];
for (const g of giRaw) for (const it of (g.list || [])) giItems.push({ name: it.foodName, gi: it.GI });
console.log(`GI 数据: ${giItems.length} 条`);

function normalize(s) { return (s || '').replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '').trim(); }

const setGi = db.prepare('UPDATE food_db SET gi = ? WHERE id = ?');
const allFoods = db.prepare("SELECT id, food_name, gi FROM food_db").all();
let giHit = 0;
if (!DRY) {
  const normMap = new Map(allFoods.map(f => [normalize(f.food_name), f]));
  for (const { name, gi } of giItems) {
    // 精确规范化匹配 → 前缀匹配（"米饭" → "米饭(蒸,粳米)"）
    let target = normMap.get(normalize(name));
    if (!target) {
      for (const f of allFoods) {
        const fn = normalize(f.food_name);
        if (fn.startsWith(normalize(name)) || normalize(name).startsWith(fn)) {
          if (!f.gi) { target = f; break; }
        }
      }
    }
    if (target && !target.gi) { setGi.run(gi, target.id); giHit++; }
  }
}
console.log(`GI 挂载${DRY ? '(预演)' : ''}: 命中 ${giHit} 条`);
