/**
 * 一次性脚本：为搭搭食谱（dada_recipe）补全总重量/总热量/配图
 * 按食谱标题匹配商店食物商品（category='food'、status=1），把 effect_json.nutrition 中的
 * 总重量、总热量写入 museum_items.extracted_data，同时补全缺失的配图。
 *
 * 运行：cd backend && node src/scripts/backfill-dada-recipe-nutrition.js
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

function extractNumber(raw) {
  if (raw == null) return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function backfill() {
  const items = db.prepare(`
    SELECT id, title, extracted_data
    FROM museum_items
    WHERE type = 'recipe' AND sub_type = 'dada_recipe' AND status = 1
  `).all();

  console.log(`发现 ${items.length} 条搭搭食谱，开始补全总重量/总热量/配图...`);

  const findShop = db.prepare(`
    SELECT icon_url, effect_json FROM shop_items
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
      const hasWeight = Number(data.total_weight) > 0;
      const hasCalorie = Number(data.total_calorie) > 0;
      const hasImage = data.image && typeof data.image === 'string' && data.image.trim();

      if (hasWeight && hasCalorie && hasImage) {
        skipped++;
        continue;
      }

      const matchTitle = item.title || data.title;
      if (!matchTitle) {
        skipped++;
        continue;
      }

      const shopItem = findShop.get(matchTitle);
      if (!shopItem) {
        skipped++;
        continue;
      }
      const shopEffect = safeJsonParse(shopItem.effect_json, {});
      const nutrition = shopEffect.nutrition || {};

      const newData = { ...data };
      let changed = false;

      if (!hasWeight && nutrition.weight) {
        const w = extractNumber(nutrition.weight);
        if (w > 0) {
          newData.total_weight = w;
          changed = true;
        }
      }
      if (!hasCalorie && nutrition.calories) {
        const c = extractNumber(nutrition.calories);
        if (c > 0) {
          newData.total_calorie = c;
          changed = true;
        }
      }
      if (!hasImage && shopItem.icon_url) {
        newData.image = shopItem.icon_url;
        changed = true;
      }

      if (!changed) {
        skipped++;
        continue;
      }

      const newJson = safeJsonStringify(newData);
      if (!newJson) {
        failed++;
        continue;
      }
      update.run(newJson, item.id);
      filled++;
      console.log(`[补全] id=${item.id} title="${matchTitle}" weight=${newData.total_weight || '-'} calorie=${newData.total_calorie || '-'} image=${newData.image ? '有' : '无'}`);
    } catch (err) {
      failed++;
      console.error(`[错误] id=${item.id}:`, err.message);
    }
  }

  console.log(`搭搭食谱补全完成：已补全 ${filled} 条，跳过 ${skipped} 条，失败 ${failed} 条`);
  db.close();
}

backfill();
