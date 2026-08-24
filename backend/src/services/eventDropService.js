/**
 * 事件掉落服务（新版事件系统）
 * 规则：
 * - 掉落池：启用事件 ∩ 地点一致（home/explore）∩ 必要条件为空或用户背包持有
 * - 概率：按 weight（0-10）加权随机，跨事件集混合，不区分集合
 * - 上限：每天最多掉落 daily_event_max 个（默认 2，home+explore 合计）
 * - 照片：命中事件后从其照片库随机一张；新（事件,照片）组合计入收集
 * - 奖励：reward_json 中的 berries/flowers 直接发放到货币账户
 */
const { db } = require('../db');
const { safeJsonParse } = require('../utils/safeJson');
const { getAppConfig } = require('../utils/configCache');
const currencyService = require('./currencyService');
const achievementService = require('./achievementService');

/**
 * 今日已掉落次数（pet_states.daily_event_count，跨天自动重置）
 * 注意：不能用 user_events 行数计数——重复（事件,照片）组合不会新增行，会漏记掉落次数
 */
function getTodayDropCount(userId) {
  const state = db.prepare('SELECT daily_event_count, last_event_at FROM pet_states WHERE user_id = ?').get(userId);
  if (!state) return 0;
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  const lastDate = state.last_event_at
    ? new Date(new Date(String(state.last_event_at).replace(' ', 'T') + 'Z').getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null;
  if (lastDate !== today) return 0;
  return state.daily_event_count || 0;
}

function incrDropCount(userId) {
  const todayCount = getTodayDropCount(userId);
  db.prepare(`
    UPDATE pet_states SET daily_event_count = ?, last_event_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
  `).run(todayCount + 1, userId);
}

function getDailyEventMax() {
  const cfg = getAppConfig('pet_explore_times');
  return cfg.daily_event_max || 2;
}

// 东八区当天日期（与 getTodayDropCount 同一算法）
function chinaToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * 当天已优先掉落的事件 id 列表（pet_states.priority_drops_json，跨天自动失效）
 */
function getTodayPriorityDropIds(userId) {
  const state = db.prepare('SELECT priority_drops_json FROM pet_states WHERE user_id = ?').get(userId);
  if (!state || !state.priority_drops_json) return [];
  try {
    const data = JSON.parse(state.priority_drops_json);
    if (data.date !== chinaToday()) return [];
    return Array.isArray(data.event_ids) ? data.event_ids : [];
  } catch (e) {
    return [];
  }
}

function markPriorityDropped(userId, eventId) {
  const ids = getTodayPriorityDropIds(userId);
  if (!ids.includes(eventId)) ids.push(eventId);
  db.prepare('UPDATE pet_states SET priority_drops_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
    .run(JSON.stringify({ date: chinaToday(), event_ids: ids }), userId);
}

/**
 * 挑选一个优先掉落事件：启用 ∩ 今天在优先有效期内 ∩ 必要条件满足 ∩ 今天未优先掉过
 * 无视发生地点（进搭搭tab即掉）；多个同日优先事件按权重降序、id 升序取第一个
 */
function pickPriorityEvent(userId) {
  const today = chinaToday();
  const rows = db.prepare(`
    SELECT * FROM pet_events_lib
    WHERE is_enabled = 1
      AND priority_start_date IS NOT NULL AND priority_start_date != ''
      AND date(?) BETWEEN date(priority_start_date) AND date(IFNULL(NULLIF(priority_end_date, ''), priority_start_date))
      AND (required_item_id IS NULL OR required_item_id IN (
        SELECT DISTINCT shop_item_id FROM user_inventory WHERE user_id = ? AND shop_item_id IS NOT NULL
      ))
    ORDER BY MAX(0, IFNULL(weight, 0)) DESC, id ASC
  `).all(today, userId);
  if (rows.length === 0) return null;
  const droppedIds = getTodayPriorityDropIds(userId);
  return rows.find(e => !droppedIds.includes(e.id)) || null;
}

/**
 * 从掉落池按 weight 加权随机选一个事件
 */
function pickWeighted(pool) {
  const totalWeight = pool.reduce((sum, e) => sum + Math.max(0, e.weight || 0), 0);
  if (totalWeight <= 0) return pool[Math.floor(Math.random() * pool.length)] || null;
  let rand = Math.random() * totalWeight;
  for (const e of pool) {
    rand -= Math.max(0, e.weight || 0);
    if (rand <= 0) return e;
  }
  return pool[pool.length - 1];
}

/**
 * 构建掉落池：启用事件 ∩ 地点一致 ∩ 必要条件为空或用户背包持有
 */
function getDropPool(userId, location) {
  return db.prepare(`
    SELECT * FROM pet_events_lib
    WHERE is_enabled = 1 AND location = ?
      AND (required_item_id IS NULL OR required_item_id IN (
        SELECT DISTINCT shop_item_id FROM user_inventory WHERE user_id = ? AND shop_item_id IS NOT NULL
      ))
  `).all(location, userId);
}

/**
 * 预选一个事件（无副作用，用于外出开始时按权重预选，归来后掉落该事件）
 */
function pickEvent(userId, location) {
  const pool = getDropPool(userId, location);
  if (pool.length === 0) return null;
  return pickWeighted(pool);
}

/**
 * 尝试为用户掉落一个事件
 * @param {number} userId
 * @param {'home'|'explore'} location
 * @param {object|null} preselectedEvent 预选事件（外出开始时按权重预选的，归来时传入）
 * @returns {object|null} { event, photo, reward, is_new }，未掉落返回 null
 */
function dropEvent(userId, location, preselectedEvent = null) {
  if (getTodayDropCount(userId) >= getDailyEventMax()) return null;

  const event = preselectedEvent || pickEvent(userId, location);
  if (!event) return null;

  // 事件所属事件集名称（前端事件卡片胶囊展示）
  const coll = db.prepare('SELECT name FROM event_collections WHERE coll_key = ?').get(event.type);
  event.collection_name = coll ? coll.name : '';

  // 计数一次掉落（无论是否新收集项）
  incrDropCount(userId);

  // 随机一张照片（无照片时 photo_id=0，用事件主图）
  const photos = db.prepare('SELECT * FROM pet_event_photos WHERE event_id = ? AND is_enabled = 1 ORDER BY sort_order ASC, id ASC').all(event.id);
  const photo = photos.length > 0 ? photos[Math.floor(Math.random() * photos.length)] : null;
  const photoId = photo ? photo.id : 0;

  // 新（事件,照片）组合才计入收集
  const existing = db.prepare('SELECT id FROM user_events WHERE user_id = ? AND event_id = ? AND photo_id = ?').get(userId, event.id, photoId);
  let isNew = false;
  if (!existing) {
    db.prepare('INSERT INTO user_events (user_id, event_id, photo_id, is_new) VALUES (?, ?, ?, 1)').run(userId, event.id, photoId);
    isNew = true;
    achievementService.checkEventCollection(userId);
  }

  // 发放事件奖励
  const reward = safeJsonParse(event.reward_json, {});
  const source = location === 'home' ? 'pet_home_event' : 'pet_explore';
  const granted = {};
  for (const currency of ['berries', 'flowers']) {
    const num = parseInt(reward[currency], 10);
    if (num > 0) {
      const result = currencyService.addCurrency(userId, currency, num, 'reward', source, event.id);
      granted[currency] = result.error ? 0 : (result.added || 0);
    }
  }

  return {
    event,
    photo,
    reward: { ...reward, granted },
    is_new: isNew,
    title: event.title,
    content: event.content,
    collection_name: event.collection_name || '',
    image_url: (photo && photo.photo_url) || event.image_url
  };
}

module.exports = {
  dropEvent,
  pickEvent,
  pickPriorityEvent,
  markPriorityDropped,
  getTodayDropCount,
  getDailyEventMax
};
