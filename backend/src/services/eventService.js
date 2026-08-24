/**
 * 事件服务（多巴胺 + 小确幸）
 */
const { db, withTransaction } = require('../db');
const currencyService = require('./currencyService');
const rewardReceiptService = require('./rewardReceiptService');
const { safeJsonParse } = require('../utils/safeJson');
const { getChinaDateStr } = require('../utils/chinaTime');

function getEventLibrary(type = null) {
  let sql = 'SELECT * FROM pet_events_lib WHERE is_enabled = 1';
  const params = [];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY sort_order ASC, id ASC';
  return db.prepare(sql).all(...params);
}

function triggerSmallJoy(userId, triggerKey) {
  return withTransaction(() => {
    // 根据触发 key 查找对应小确幸事件
    const events = db.prepare("SELECT * FROM pet_events_lib WHERE type = 'small_joy' AND is_enabled = 1").all();
    const event = events.find(e => e.event_key === triggerKey);
    if (!event) return null;

    const existing = db.prepare('SELECT id FROM user_events WHERE user_id = ? AND event_id = ?').get(userId, event.id);
    if (existing) return null; // 同类型小确幸不重复触发

    db.prepare('INSERT INTO user_events (user_id, event_id, is_new) VALUES (?, ?, 1)').run(userId, event.id);

    const reward = safeJsonParse(event.reward_json, {});
    const berryResult = reward.berries
      ? currencyService.addCurrency(userId, 'berries', reward.berries, 'reward', 'small_joy', event.id)
      : { added: 0 };
    const flowerResult = reward.flowers
      ? currencyService.addCurrency(userId, 'flowers', reward.flowers, 'reward', 'small_joy', event.id)
      : { added: 0 };

    const actualBerries = berryResult.error ? 0 : (berryResult.added || 0);
    const actualFlowers = flowerResult.error ? 0 : (flowerResult.added || 0);
    const hasReward = (reward.berries && !berryResult.error) || (reward.flowers && !flowerResult.error);

    if (hasReward) {
      rewardReceiptService.send({
        userId,
        source: 'joy_event',
        payload: {
          name: event.title,
          title: event.title,
          description: event.content || '',
          berries: actualBerries,
          flowers: actualFlowers
        }
      });
    }

    return { event, reward: { berries: actualBerries, flowers: actualFlowers } };
  });
}

function getLocalDateString() {
  return getChinaDateStr();
}

function triggerJoy001_AllMealsOnTime(userId) {
  const today = getLocalDateString();
  const meals = db.prepare(`
    SELECT DISTINCT meal_time FROM diet_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, today).map(r => r.meal_time);

  const required = ['breakfast', 'lunch', 'dinner'];
  const allDone = required.every(m => meals.includes(m));
  if (!allDone) return null;

  return triggerSmallJoy(userId, 'joy_001');
}

function triggerJoy002_ExerciseDone(userId) {
  const today = getLocalDateString();
  const total = db.prepare(`
    SELECT COALESCE(SUM(total_duration), 0) as duration
    FROM exercise_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).get(userId, today).duration || 0;

  if (total < 30) return null;

  return triggerSmallJoy(userId, 'joy_002');
}

function triggerJoy003_WeightDrop(userId) {
  const today = getLocalDateString();
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

  const todayWeight = db.prepare(`
    SELECT value FROM body_records
    WHERE user_id = ? AND record_date = ? AND type = 'weight' AND status = 1
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, today);

  const yesterdayWeight = db.prepare(`
    SELECT value FROM body_records
    WHERE user_id = ? AND record_date = ? AND type = 'weight' AND status = 1
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, yesterday);

  if (!todayWeight || !yesterdayWeight) return null;
  if (todayWeight.value >= yesterdayWeight.value) return null;

  return triggerSmallJoy(userId, 'joy_003');
}

function triggerJoy004_ThreeDayDiet(userId) {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    dates.push(getLocalDateString(d));
  }

  const placeholders = dates.map(() => '?').join(',');
  const count = db.prepare(`
    SELECT COUNT(DISTINCT record_date) as count
    FROM diet_records
    WHERE user_id = ? AND record_date IN (${placeholders}) AND status = 1
  `).get(userId, ...dates).count || 0;

  if (count < 3) return null;

  return triggerSmallJoy(userId, 'joy_004');
}

function triggerJoy005_WaterGoal(userId, waterMl = 0) {
  const today = getLocalDateString();
  // 当前记录已入库，直接汇总今日 DB 数据；waterMl 参数保留以兼容调用约定
  const recorded = db.prepare(`
    SELECT COALESCE(SUM(water_ml), 0) as total
    FROM habit_records
    WHERE user_id = ? AND record_date = ? AND type = 'water' AND status = 1
  `).get(userId, today).total || 0;

  const input = parseInt(waterMl) || 0;
  const total = Math.max(recorded, input);
  const profile = db.prepare('SELECT water_goal FROM user_profiles WHERE user_id = ?').get(userId);
  const waterGoal = profile?.water_goal || 2000;
  if (total < waterGoal) return null;

  return triggerSmallJoy(userId, 'joy_005');
}

module.exports = {
  getEventLibrary,
  triggerSmallJoy,
  triggerJoy001_AllMealsOnTime,
  triggerJoy002_ExerciseDone,
  triggerJoy003_WeightDrop,
  triggerJoy004_ThreeDayDiet,
  triggerJoy005_WaterGoal
};
