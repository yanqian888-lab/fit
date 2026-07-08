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
  
  // 兼容处理：如果只有7列，说明food_name为空（如代餐类只有id,category,sub_category,calories,common_unit,edible_rate,remark）
  // 此时需要在第3位（index 3）插入空字符串作为food_name
  if (result.length === 7) {
    // 原始格式: id, category, sub_category, calories, common_unit, edible_rate, remark
    // 目标格式: id, category, sub_category, food_name, calories, common_unit, edible_rate, remark
    // 在index 3处插入空food_name
    result.splice(3, 0, '');
  }
  
  return result;
}

function importFoods() {
  const filePath = path.join(__dirname, '../../../word/食品库.txt');
  
  if (!fs.existsSync(filePath)) {
    console.error('食品库文件不存在:', filePath);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // 跳过表头
  const dataLines = lines.slice(1);
  
  console.log(`读取到 ${dataLines.length} 条食品数据`);

  // 开启事务
  db.exec('BEGIN TRANSACTION');
  
  try {
    // 清空现有数据
    db.exec('DELETE FROM food_db');
    db.exec("DELETE FROM sqlite_sequence WHERE name='food_db'");
    console.log('已清空旧食品数据');

    const insert = db.prepare(`
      INSERT INTO food_db (
        food_id, category, sub_category, food_name,
        calories_per_100g, common_unit, edible_rate, remark,
        protein_per_100g, carb_per_100g, fat_per_100g
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

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

      // 部分代餐/特殊食品 food_name 为空，使用 sub_category 作为名称兜底
      if (!foodName && subCategory) foodName = subCategory;

      if (isNaN(foodId) || isNaN(calories) || isNaN(edibleRate)) {
        console.warn('跳过数值格式错误的行:', line.substring(0, 50));
        errorCount++;
        continue;
      }

      try {
        insert.run(foodId, category, subCategory, foodName, calories, commonUnit, edibleRate, remark, protein, carb, fat);
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
