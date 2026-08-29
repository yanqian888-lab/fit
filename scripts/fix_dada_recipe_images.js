/**
 * 生产数据修复脚本：补全已有搭搭食谱的 extracted_data.image 字段
 * 根据 museum_items.title 匹配 shop_items.name，把 shop_items.icon_url 写入 extracted_data.image
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.argv[2] || path.join(__dirname, '../backend/data/app_production.db');
const db = new Database(dbPath);

// 1. 先查看待修复记录
const pending = db.prepare(`
  SELECT mi.id, mi.title, mi.extracted_data, si.icon_url
  FROM museum_items mi
  LEFT JOIN shop_items si ON si.name = mi.title
  WHERE mi.type = 'recipe' AND mi.sub_type = 'dada_recipe'
    AND (
      mi.extracted_data IS NULL
      OR json_extract(mi.extracted_data, '$.image') IS NULL
      OR json_extract(mi.extracted_data, '$.image') = ''
    )
    AND si.icon_url IS NOT NULL AND si.icon_url != ''
`).all();

console.log(`待修复搭搭食谱数量: ${pending.length}`);
pending.slice(0, 10).forEach(r => {
  console.log(`  id=${r.id} title=${r.title} icon_url=${r.icon_url}`);
});

if (pending.length === 0) {
  console.log('无需修复');
  process.exit(0);
}

// 2. 执行修复（可重入：只更新 image 为空的记录）
const update = db.prepare(`
  UPDATE museum_items
  SET extracted_data = json_set(
    COALESCE(extracted_data, '{}'),
    '$.image',
    (SELECT si.icon_url FROM shop_items si WHERE si.name = museum_items.title LIMIT 1)
  )
  WHERE type = 'recipe' AND sub_type = 'dada_recipe'
    AND (
      extracted_data IS NULL
      OR json_extract(extracted_data, '$.image') IS NULL
      OR json_extract(extracted_data, '$.image') = ''
    )
    AND EXISTS (
      SELECT 1 FROM shop_items si
      WHERE si.name = museum_items.title AND si.icon_url IS NOT NULL AND si.icon_url != ''
    )
`);

const result = update.run();
console.log(`实际更新行数: ${result.changes}`);

// 3. 修复后抽查
const sample = db.prepare(`
  SELECT id, title, json_extract(extracted_data, '$.image') AS image
  FROM museum_items
  WHERE type = 'recipe' AND sub_type = 'dada_recipe'
  LIMIT 3
`).all();
console.log('修复后抽查:', JSON.stringify(sample, null, 2));

db.close();
