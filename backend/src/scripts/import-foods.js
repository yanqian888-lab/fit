/**
 * 食品库数据导入脚本
 * 运行：npm run import-foods
 * 功能：以 word/食品库02.txt（含三大营养素）为主源，完全替换 food_db 表
 *
 * 02 文件表头：food_id,category,sub_category,food_name,calories_per_100g,
 *              protein_per_100g,fat_per_100g,carbs_per_100g,common_unit,edible_rate,remark
 * 已知数据问题：
 *   - 中间混有一行重复表头，按首列非数字跳过
 *   - 代餐特殊食品类（462-467）缺 sub_category 列，按 10 列对齐
 *   - id=479（卤鸭锁骨）行尾被截断（仅 9 列），跳过该行
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const db = new Database(config.db.path);

const FOOD_FILE_V2 = path.join(__dirname, '../../../word/食品库02.txt');

// 解析CSV行（处理引号内的逗号）
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// 02 文件按表头名映射列，兼容列序变化（carbs_per_100g -> carb_per_100g）
function parseV2Line(cols, headerMap) {
  const get = (name) => {
    const idx = headerMap[name];
    return idx === undefined ? '' : (cols[idx] || '');
  };
  return {
    food_id: parseInt(get('food_id')),
    category: get('category'),
    sub_category: get('sub_category'),
    food_name: get('food_name'),
    calories_per_100g: parseFloat(get('calories_per_100g')),
    protein_per_100g: parseFloat(get('protein_per_100g')) || 0,
    carb_per_100g: parseFloat(get('carbs_per_100g')) || 0,
    fat_per_100g: parseFloat(get('fat_per_100g')) || 0,
    common_unit: get('common_unit'),
    edible_rate: parseFloat(get('edible_rate')),
    remark: get('remark')
  };
}

function getColumns(table) {
  return db.pragma(`table_info(${table})`).map(col => col.name);
}

function importFoods() {
  if (!fs.existsSync(FOOD_FILE_V2)) {
    console.error('食品库文件不存在:', FOOD_FILE_V2);
    process.exit(1);
  }

  const lines = fs.readFileSync(FOOD_FILE_V2, 'utf-8').split('\n').filter(l => l.trim());

  // 表头映射
  const headerMap = {};
  parseCSVLine(lines[0]).forEach((name, idx) => { headerMap[name] = idx; });

  const rows = [];
  let skipCount = 0;
  let fixedCount = 0;

  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);

    // 跳过重复表头/非数据行
    if (isNaN(parseInt(cols[0]))) {
      skipCount++;
      continue;
    }

    // 代餐特殊食品类缺 sub_category 列（10 列），补空串对齐到 11 列
    if (cols.length === 10) {
      cols.splice(2, 0, '');
      fixedCount++;
    }

    // id=479 行尾被截断（仅 9 列），跳过该行
    if (cols.length === 9) {
      console.warn('跳过截断行（字段不足）:', line.substring(0, 50));
      skipCount++;
      continue;
    }

    if (cols.length < 11) {
      console.warn('跳过格式错误的行:', line.substring(0, 50));
      skipCount++;
      continue;
    }

    const row = parseV2Line(cols, headerMap);
    if (isNaN(row.food_id) || isNaN(row.calories_per_100g)) {
      console.warn('跳过数值格式错误的行:', line.substring(0, 50));
      skipCount++;
      continue;
    }
    if (isNaN(row.edible_rate)) row.edible_rate = 1.0;
    if (!row.food_name) row.food_name = row.sub_category;
    rows.push(row);
  }

  console.log(`解析完成：共 ${rows.length} 条（容错修正 ${fixedCount} 条，跳过 ${skipCount} 条）`);

  db.exec('BEGIN TRANSACTION');

  try {
    db.exec('DELETE FROM food_db');
    db.exec("DELETE FROM sqlite_sequence WHERE name='food_db'");
    console.log('已清空旧食品数据');

    const existingColumns = getColumns('food_db');
    const baseColumns = [
      'food_id', 'category', 'sub_category', 'food_name',
      'calories_per_100g', 'common_unit', 'edible_rate', 'remark',
      'protein_per_100g', 'carb_per_100g', 'fat_per_100g'
    ];
    const extraColumns = [];
    if (existingColumns.includes('name')) extraColumns.push('name');
    if (existingColumns.includes('calorie_per_100g')) extraColumns.push('calorie_per_100g');

    const columns = [...baseColumns, ...extraColumns];
    const placeholders = columns.map(() => '?').join(', ');
    const insert = db.prepare(`INSERT INTO food_db (${columns.join(', ')}) VALUES (${placeholders})`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const full = { ...row };
      if (extraColumns.includes('name')) full.name = row.food_name;
      if (extraColumns.includes('calorie_per_100g')) full.calorie_per_100g = row.calories_per_100g;

      try {
        insert.run(...columns.map(c => full[c]));
        successCount++;
      } catch (err) {
        console.error(`插入失败 [${row.food_name}]:`, err.message);
        errorCount++;
      }
    }

    db.exec('COMMIT');
    console.log(`\n导入完成：成功 ${successCount} 条，失败 ${errorCount} 条`);
    console.log('食品库已完全替换！');

  } catch (err) {
    db.exec('ROLLBACK');
    console.error('导入失败，已回滚:', err.message);
    process.exit(1);
  }
}

importFoods();
db.close();
