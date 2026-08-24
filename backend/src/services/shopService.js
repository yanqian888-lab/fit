/**
 * 商城服务
 */
const { db } = require('../db');
const currencyService = require('./currencyService');
const taskService = require('./taskService');
const fs = require('fs');
const path = require('path');

// 列表缩略图：/static/uploads/xxx/yyy.jpg → /static/uploads/xxx/thumb/yyy.jpg（存在才返回）
// 小程序列表页直接加载原图（~480KB/张）会非常卡，缩略图约 10KB
const thumbCache = new Map();
function toThumbUrl(iconUrl) {
  if (!iconUrl || !iconUrl.startsWith('/static/uploads/')) return null;
  if (thumbCache.has(iconUrl)) return thumbCache.get(iconUrl);
  const dir = path.dirname(iconUrl);
  const base = path.basename(iconUrl);
  const thumbUrl = `${dir}/thumb/${base}`;
  const fsPath = path.join(__dirname, '../../public', dir.replace('/static/', ''), 'thumb', base);
  const result = fs.existsSync(fsPath) ? thumbUrl : null;
  thumbCache.set(iconUrl, result);
  return result;
}

function getItems(userId, category = null, { page = 0, size = 0 } = {}) {
  let sql = 'SELECT * FROM shop_items WHERE status = 1';
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  // 默认按后台上架时间正序（created_at，其次 id 兜底）
  sql += ' ORDER BY datetime(created_at) ASC, id ASC';

  const items = db.prepare(sql).all(...params);

  // 持有判定：背包中存在该商品（任意分类）即视为已购买持有
  const ownedRows = db.prepare('SELECT DISTINCT shop_item_id FROM user_inventory WHERE user_id = ? AND shop_item_id IS NOT NULL').all(userId);
  const ownedSet = new Set(ownedRows.map(r => r.shop_item_id));

  const mapped = items.map(item => ({
    ...item,
    unlocked: true,
    owned: ownedSet.has(item.id)
  }));

  // 食物：已购买的排到最后（各自仍按上架时间正序）
  // 非食物（器材/道具/皮肤等）：购买后从商店消失
  const result = [];
  const ownedFoods = [];
  for (const item of mapped) {
    if (!item.owned) {
      result.push(item);
    } else if (item.category === 'food') {
      ownedFoods.push(item);
    }
    // 非食物且已持有：不展示
  }
  const all = result.concat(ownedFoods);
  // 附带列表缩略图（不存在则为 null，前端回退原图）
  for (const item of all) {
    item.icon_thumb_url = toThumbUrl(item.icon_url);
  }
  // 分页：size>0 时返回分页结构，否则保持原行为返回全量数组
  if (size > 0) {
    const p = Math.max(1, page || 1);
    const total = all.length;
    const list = all.slice((p - 1) * size, p * size);
    return { list, pagination: { page: p, size, total, has_more: p * size < total } };
  }
  return all;
}

function hasEquipment(userId, shopItemId) {
  const row = db.prepare('SELECT id FROM user_inventory WHERE user_id = ? AND shop_item_id = ? AND category = ?').get(userId, shopItemId, 'equipment');
  return !!row;
}

function buyItem(userId, itemId) {
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND status = 1').get(itemId);
  if (!item) return { error: '商品不存在或已下架' };

  // 开始事务：库存、余额、去重均在事务内原子检查，避免并发超卖/重复购买
  const tx = db.transaction(() => {
    // 重新读取商品库存（事务内），防止事务外脏读
    const currentItem = db.prepare('SELECT * FROM shop_items WHERE id = ? AND status = 1').get(itemId);
    if (!currentItem) throw new Error('商品不存在或已下架');
    if (currentItem.stock === 0) throw new Error('商品已售罄');

    // 永久器材去重
    if (currentItem.category === 'equipment' && hasEquipment(userId, currentItem.id)) {
      throw new Error('已拥有该器材');
    }

    if (currentItem.price_berries > 0) {
      const berryResult = currencyService.deductCurrency(userId, 'berries', currentItem.price_berries, 'shop_buy', currentItem.name, currentItem.id);
      if (berryResult.error) throw new Error(berryResult.error);
    }
    if (currentItem.price_flowers > 0) {
      const flowerResult = currencyService.deductCurrency(userId, 'flowers', currentItem.price_flowers, 'shop_buy', currentItem.name, currentItem.id);
      if (flowerResult.error) throw new Error(flowerResult.error);
    }

    // 库存扣减：stock < 0 表示无限库存；stock >= 0 时才扣减
    if (currentItem.stock > 0) {
      const stockUpdate = db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0').run(currentItem.id);
      if (stockUpdate.changes !== 1) throw new Error('库存不足');
      currentItem.stock -= 1;
    }

    // 永久器材数量记为 1，方便 workoutService 等通过 quantity > 0 判断；可堆叠物品合并数量
    const quantity = 1;
    const existingInventory = db.prepare('SELECT id, quantity FROM user_inventory WHERE user_id = ? AND shop_item_id = ?').get(userId, currentItem.id);
    if (existingInventory) {
      db.prepare(`
        UPDATE user_inventory
        SET quantity = quantity + ?,
            name = ?,
            icon_url = ?,
            effect_json = ?
        WHERE id = ?
      `).run(quantity, currentItem.name, currentItem.icon_url, currentItem.effect_json, existingInventory.id);
    } else {
      db.prepare(`
        INSERT INTO user_inventory (user_id, shop_item_id, category, name, icon_url, quantity, effect_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, currentItem.id, currentItem.category, currentItem.name, currentItem.icon_url, quantity, currentItem.effect_json);
    }

    return { item: currentItem, quantity };
  });

  let result;
  try {
    result = tx();
  } catch (err) {
    return { error: err.message };
  }
  if (!result.error) {
    taskService.updateTaskProgress(userId, 'shop_buy', 1);
  }
  return result;
}

module.exports = {
  getItems,
  buyItem
};
