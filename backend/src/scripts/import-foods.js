/**
 * 食品库数据导入脚本
 * 运行：npm run import-foods
 * 功能：从 word/食品库.txt 导入数据，完全替换 food_db 表
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const db = new Database(config.db.path);

// 解析CSV行（处理引号内的逗号，兼容food_name为空的情况）
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

  // 兼容处理：如果只有7列，说明food_name为空
  if (result.length === 7) {
    result.splice(3, 0, '');
  }

  return result;
}

function getColumns(table) {
  return db.pragma(`table_info(${table})`).map(col => col.name);
}

function importFoods() {
  const filePath = path.join(__dirname, '../../../word/食品库.txt');

  if (!fs.existsSync(filePath)) {
    console.error('食品库文件不存在:', filePath);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const dataLines = lines.slice(1);

  console.log(`读取到 ${dataLines.length} 条食品数据`);

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

    for (const line of dataLines) {
      const cols = parseCSVLine(line);
      if (cols.length < 8) {
        console.warn('跳过格式错误的行:', line.substring(0, 50));
        errorCount++;
        continue;
      }

      const foodId = parseInt(cols[0]);
      const category = cols[1];
      const subCategory = cols[2];
      let foodName = cols[3];
      const calories = parseFloat(cols[4]);
      const commonUnit = cols[5];
      const edibleRate = parseFloat(cols[6]);
      const remark = cols[7];
      const protein = parseFloat(cols[8]) || 0;
      const carb = parseFloat(cols[9]) || 0;
      const fat = parseFloat(cols[10]) || 0;

      if (!foodName && subCategory) foodName = subCategory;

      if (isNaN(foodId) || isNaN(calories) || isNaN(edibleRate)) {
        console.warn('跳过数值格式错误的行:', line.substring(0, 50));
        errorCount++;
        continue;
      }

      const row = {
        food_id: foodId,
        category,
        sub_category: subCategory,
        food_name: foodName,
        calories_per_100g: calories,
        common_unit: commonUnit,
        edible_rate: edibleRate,
        remark,
        protein_per_100g: protein,
        carb_per_100g: carb,
        fat_per_100g: fat
      };
      if (extraColumns.includes('name')) row.name = foodName;
      if (extraColumns.includes('calorie_per_100g')) row.calorie_per_100g = calories;

      try {
        insert.run(...columns.map(c => row[c]));
        successCount++;
      } catch (err) {
        console.error(`插入失败 [${foodName}]:`, err.message);
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
