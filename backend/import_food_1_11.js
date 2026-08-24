/**
 * 重新解析健康食谱表.xlsx中序号1-11的数据并灌入shop_items表
 * 逻辑：
 * - 序号1-5：更新DB中已存在的ID1-ID5旧食品数据
 * - 序号6-11：作为新记录插入（ID会自增，但sort_order与Excel序号一致）
 * - 所有新灌入的食品status=0（未启用）
 */
const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

const EXCEL_PATH = path.join(__dirname, '..', 'word', '健康食谱表.xlsx');
const DB_PATH = path.join(__dirname, 'data', 'app.db');

const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

console.log('Excel总行数:', rows.length);
console.log('表头:', Object.keys(rows[0] || {}));

const head = Object.keys(rows[0] || {});
console.log('第一行示例:', rows[0]);

// 先预览前11行
const top11 = rows.slice(0, 11).map((r, i) => ({
  idx: i + 1,
  name: r[head[0]] || r['餐名'] || r['名称'] || r['name'] || '',
  price: r[head[1]] || r['价格'] || r['金币'] || r['price'] || r['price_berries'] || 0,
  calories: r['热量(kcal)'] || r['热量'] || r['卡路里'] || r['calories'] || '',
  protein: r['蛋白质(g)'] || r['蛋白质'] || r['protein'] || '',
  carbs: r['碳水(g)'] || r['碳水化合物(g)'] || r['carbs'] || '',
  fat: r['脂肪(g)'] || r['脂肪'] || r['fat'] || '',
  desc: r[head[2]] || r['描述'] || r['desc'] || r['description'] || '',
  raw: JSON.stringify(r).substring(0, 300)
}));
console.log('\n前11条预览：');
top11.forEach(item => {
  console.log(`#${item.idx} 名称=${item.name} 价格=${item.price} 热量=${item.calories} 蛋白=${item.protein} 碳水=${item.carbs} 脂肪=${item.fat}`);
});

const db = new Database(DB_PATH);

let updateCount = 0;
let insertCount = 0;

// 归一化数值（支持"15 浆果"/"15 金币"/"15颗"等格式，取数字部分）
function normalizePrice(val) {
  if (typeof val === 'number') return Math.round(val);
  const s = String(val || '').trim();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

// 遍历序号1-11
for (let i = 0; i < 11; i++) {
  const row = rows[i];
  if (!row) continue;
  const excelSeq = i + 1; // Excel序号1-11

  // 获取字段（按表头顺序+兼容中英文列名）
  const columns = Object.keys(row);
  const name = (row[columns[0]] || row['餐名'] || row['名称'] || row['name'] || '').toString().trim();
  const priceVal = row[columns[1]] !== undefined ? row[columns[1]] : (row['价格'] || row['金币'] || row['price_berries'] || 0);
  const priceBerries = normalizePrice(priceVal);
  const description = (
    row['描述'] || row['desc'] || row['description'] ||
    (columns[2] ? row[columns[2]] : '') ||
    row['简介'] || ''
  ).toString().trim();

  // 营养信息
  const calories = row['热量(kcal)'] || row['热量'] || row['卡路里'] || row['calories'] || '';
  const protein = row['蛋白质(g)'] || row['蛋白质'] || row['protein'] || '';
  const carbs = row['碳水(g)'] || row['碳水化合物(g)'] || row['碳水'] || row['carbs'] || '';
  const fat = row['脂肪(g)'] || row['脂肪'] || row['fat'] || '';

  // 组装effect_json（标准化营养结构）
  const nutritionObj = {};
  if (calories !== '') nutritionObj.calories = String(calories).trim();
  if (protein !== '') nutritionObj.protein = String(protein).trim();
  if (carbs !== '') nutritionObj.carbs = String(carbs).trim();
  if (fat !== '') nutritionObj.fat = String(fat).trim();
  const effectJson = Object.keys(nutritionObj).length > 0
    ? JSON.stringify({ type: 'food', nutrition: nutritionObj })
    : JSON.stringify({ type: 'food' });

  // 组装描述（若有营养信息但描述为空，用营养信息填充）
  const finalDesc = description || (
    calories !== ''
      ? `热量${calories}kcal · 蛋白${protein}g · 碳水${carbs}g · 脂肪${fat}g`
      : ''
  );

  if (excelSeq <= 5) {
    // 序号1-5：更新已存在的ID1-ID5旧数据
    const dbId = excelSeq; // ID映射：Excel#1 -> ID#1
    const info = db.prepare(`SELECT id, name FROM shop_items WHERE id = ? AND category = 'food'`).get(dbId);
    if (info) {
      db.prepare(`
        UPDATE shop_items
        SET name = ?, description = ?, price_berries = ?, sort_order = ?,
            effect_json = ?, status = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND category = 'food'
      `).run(name, finalDesc, priceBerries, excelSeq, effectJson, dbId);
      console.log(`✓ 更新 ID${dbId} (Excel#${excelSeq}): ${name} | ${priceBerries}浆果 | sort=${excelSeq}`);
      updateCount++;
    } else {
      console.warn(`⚠ ID${dbId}不存在，改为插入`);
      db.prepare(`
        INSERT INTO shop_items (id, category, name, description, price_berries, sort_order, status, effect_json)
        VALUES (?, 'food', ?, ?, ?, ?, 0, ?)
      `).run(dbId, name, finalDesc, priceBerries, excelSeq, effectJson);
      insertCount++;
    }
  } else {
    // 序号6-11：插入新记录（允许DB自增ID，但sort_order = Excel序号）
    db.prepare(`
      INSERT INTO shop_items (category, name, description, price_berries, sort_order, status, effect_json)
      VALUES ('food', ?, ?, ?, ?, 0, ?)
    `).run(name, finalDesc, priceBerries, excelSeq, effectJson);
    const newId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    console.log(`+ 插入 ID${newId} (Excel#${excelSeq}): ${name} | ${priceBerries}浆果 | sort=${excelSeq}`);
    insertCount++;
  }
}

console.log(`\n完成：更新${updateCount}条，插入${insertCount}条，共${updateCount + insertCount}条`);
db.close();
