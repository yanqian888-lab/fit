/**
 * 运动库数据导入脚本
 * 运行：npm run import-exercises
 * 功能：从 word/运动库.txt 导入数据，完全替换 exercise_db 表
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const db = new Database(config.db.path);

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

// 强度映射：intensity_desc -> intensity
function mapIntensity(intensityDesc) {
  const desc = (intensityDesc || '').toLowerCase();
  if (desc.includes('极高') || desc.includes('killer') || desc.includes('地狱')) return 'very_high';
  if (desc.includes('高') || desc.includes('vigorous') || desc.includes('HIIT') || desc.includes('高强度')) return 'high';
  if (desc.includes('中') || desc.includes('moderate') || desc.includes('中等')) return 'moderate';
  if (desc.includes('低') || desc.includes('low') || desc.includes('light') || desc.includes('新手') || desc.includes('入门')) return 'low';
  return 'moderate';
}

// 兼容旧库 type 字段的简单映射
function mapType(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('有氧') || c.includes('跑步') || c.includes('步行') || c.includes('骑行') || c.includes('游泳') || c.includes('舞蹈') || c.includes('操') || c.includes('球类')) return 'aerobic';
  if (c.includes('力量') || c.includes('哑铃') || c.includes('杠铃') || c.includes('器械') || c.includes('自重') || c.includes('核心')) return 'strength';
  if (c.includes('拉伸') || c.includes('瑜伽') || c.includes('普拉提') || c.includes('冥想')) return 'flexibility';
  return 'aerobic';
}

function getColumns(table) {
  return db.pragma(`table_info(${table})`).map(col => col.name);
}

function importExercises() {
  const filePath = path.join(__dirname, '../../../word/运动库.txt');

  if (!fs.existsSync(filePath)) {
    console.error('运动库文件不存在:', filePath);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const dataLines = lines.slice(1);

  console.log(`读取到 ${dataLines.length} 条运动数据`);

  db.exec('BEGIN TRANSACTION');

  try {
    db.exec('DELETE FROM exercise_db');
    db.exec("DELETE FROM sqlite_sequence WHERE name='exercise_db'");
    console.log('已清空旧运动数据');

    const existingColumns = getColumns('exercise_db');
    const baseColumns = [
      'id', 'exercise_name', 'category', 'sub_category',
      'intensity_desc', 'met_value', 'calorie_per_hour', 'remark'
    ];
    const extraColumns = [];
    if (existingColumns.includes('name')) extraColumns.push('name');
    if (existingColumns.includes('type')) extraColumns.push('type');
    if (existingColumns.includes('intensity')) extraColumns.push('intensity');

    const columns = [...baseColumns, ...extraColumns];
    const placeholders = columns.map(() => '?').join(', ');
    const insert = db.prepare(`INSERT INTO exercise_db (${columns.join(', ')}) VALUES (${placeholders})`);

    let successCount = 0;
    let errorCount = 0;

    for (const line of dataLines) {
      const cols = parseCSVLine(line);
      if (cols.length < 8) {
        console.warn('跳过格式错误的行:', line.substring(0, 50));
        errorCount++;
        continue;
      }

      const exerciseId = parseInt(cols[0]);
      const category = cols[1];
      const subCategory = cols[2];
      const exerciseName = cols[3];
      const intensityDesc = cols[4];
      const metValue = parseFloat(cols[5]);
      const kcalPerHour = parseFloat(cols[6]);
      const remark = cols[7];

      if (isNaN(exerciseId) || isNaN(metValue) || isNaN(kcalPerHour)) {
        console.warn('跳过数值格式错误的行:', line.substring(0, 50));
        errorCount++;
        continue;
      }

      const row = {
        id: exerciseId,
        exercise_name: exerciseName,
        category,
        sub_category: subCategory,
        intensity_desc: intensityDesc,
        met_value: metValue,
        calorie_per_hour: kcalPerHour,
        remark
      };
      if (extraColumns.includes('name')) row.name = exerciseName;
      if (extraColumns.includes('type')) row.type = mapType(category);
      if (extraColumns.includes('intensity')) row.intensity = mapIntensity(intensityDesc);

      try {
        insert.run(...columns.map(c => row[c]));
        successCount++;
      } catch (err) {
        console.error(`插入失败 [${exerciseName}]:`, err.message);
        errorCount++;
      }
    }

    db.exec('COMMIT');
    console.log(`\n导入完成：成功 ${successCount} 条，失败 ${errorCount} 条`);
    console.log('运动库已完全替换！');

  } catch (err) {
    db.exec('ROLLBACK');
    console.error('导入失败，已回滚:', err.message);
    process.exit(1);
  }
}

importExercises();
db.close();
