/**
 * 一次性脚本：为历史搭搭食谱补全商店商品配图
 * 按食谱标题匹配商店食物商品（category='food'、status=1），将对应 icon_url 写入 extracted_data.image
 * 运行：cd backend && node src/scripts/backfill-dada-recipe-images.js
 */
const { db } = require('../db');
const { safeJsonParse } = require('../utils/safeJson');

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return null;
  }
}

function backfill() {
  const items = db.prepare(`
    SELECT id, title, extracted_data
    FROM museum_items
    WHERE type = 'recipe' AND sub_type = 'dada_recipe' AND status = 1
  `).all();

  console.log(`发现 ${items.length} 条搭搭食谱，开始补全配图...`);

  const findShop = db.prepare(`
    SELECT icon_url FROM shop_items
    WHERE category = 'food' AND name = ? AND status = 1
    LIMIT 1
  `);
  const update = db.prepare(`
    UPDATE museum_items
    SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let filled = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const data = safeJsonParse(item.extracted_data) || {};
      // 已有有效配图则跳过
      if (data.image && typeof data.image === 'string' && data.image.trim()) {
        skipped++;
        continue;
      }

      const matchTitle = item.title || data.title;
      if (!matchTitle) {
        skipped++;
        continue;
      }

      const shopItem = findShop.get(matchTitle);
      if (!shopItem || !shopItem.icon_url) {
        skipped++;
        continue;
      }

      const newData = { ...data, image: shopItem.icon_url };
      const newJson = safeJsonStringify(newData);
      if (!newJson) {
        failed++;
        continue;
      }
      update.run(newJson, item.id);
      filled++;
      console.log(`[补全] id=${item.id} title="${matchTitle}" image="${shopItem.icon_url}"`);
    } catch (err) {
      failed++;
      console.error(`[错误] id=${item.id}:`, err.message);
    }
  }

  console.log(`搭搭食谱配图补全完成：已补全 ${filled} 条，跳过 ${skipped} 条，失败 ${failed} 条`);
  db.close();
}

backfill();
