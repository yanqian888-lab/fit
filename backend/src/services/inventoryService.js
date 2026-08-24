/**
 * 背包服务
 */
const { db, withTransaction } = require('../db');
const { safeJsonParse } = require('../utils/safeJson');
const petService = require('./petService');
const taskService = require('./taskService');

/**
 * 获取用户背包列表
 */
function getInventory(userId, category = null) {
  let sql = 'SELECT * FROM user_inventory WHERE user_id = ?';
  const params = [userId];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY category ASC, acquired_at DESC';
  return db.prepare(sql).all(...params);
}

function getExerciseLimits() {
  const config = petService.getAppConfig('pet_exercise_limits');
  return { max_per_day: 2, ...config };
}

/**
 * 查询器材关联的跟练课程和运动选项
 * @param {number} userId - 用户ID
 * @param {number} inventoryId - 背包物品ID
 * @returns {Object} - 包含 workouts 和 exercise_options
 */
function getEquipmentWorkouts(userId, inventoryId) {
  const item = db.prepare('SELECT * FROM user_inventory WHERE id = ? AND user_id = ?').get(inventoryId, userId);
  if (!item) return { error: '物品不存在' };
  if (item.category !== 'equipment') return { error: '非运动器材' };

  const shopItemId = item.shop_item_id;
  const effect = safeJsonParse(item.effect_json, {});

  // 查询器材关联的跟练课程（通过 workout_lib.required_item_id）
  const workouts = shopItemId
    ? db.prepare(`
        SELECT id, workout_key, name, category, video_url, cover_url,
               duration_seconds, calorie_per_hour, required_item_id, description
        FROM workout_lib
        WHERE required_item_id = ? AND status = 1
        ORDER BY sort_order ASC
      `).all(shopItemId)
    : [];

  // 查询器材关联的运动选项（通过 pet_exercise_lib.equipment_item_id）
  const exerciseOptions = shopItemId
    ? db.prepare(`
        SELECT e.*, w.name AS workout_name
        FROM pet_exercise_lib e
        LEFT JOIN workout_lib w ON w.workout_key = e.workout_key
        WHERE e.equipment_item_id = ? AND e.is_enabled = 1
        ORDER BY e.sort_order ASC
      `).all(shopItemId)
    : [];

  return {
    item: {
      id: item.id,
      name: item.name,
      shop_item_id: shopItemId,
      effect: effect
    },
    workouts,
    exercise_options: exerciseOptions.map(opt => ({
      key: opt.exercise_key,
      name: opt.name,
      has_workout: !!opt.has_workout,
      workout_key: opt.workout_key,
      workout_name: opt.workout_name,
      anim_url: opt.anim_url,
      duration_seconds: opt.duration_seconds || 180,
      use_equipment: !!opt.use_equipment
    }))
  };
}

/**
 * 使用背包物品
 */
function useItem(userId, inventoryId) {
  return withTransaction(() => {
    const item = db.prepare('SELECT * FROM user_inventory WHERE id = ? AND user_id = ?').get(inventoryId, userId);
    if (!item) return { error: '物品不存在' };
    if (item.quantity <= 0) return { error: '物品已用完' };

    const effect = safeJsonParse(item.effect_json, {});
    const state = petService.ensurePetState(userId);

    let result = {};

    if (item.category === 'food') {
      // 食物统一走宠物喂食逻辑（每日上限/夜间休息/食谱掉落/任务进度），避免两套逻辑不一致
      const feedResult = petService.feed(userId, [inventoryId]);
      if (feedResult.error) return feedResult;
      return {
        success: true,
        effect: feedResult,
        message: feedResult.recipes_saved?.length ? `喂食成功，解锁食谱「${feedResult.recipes_saved[0]}」` : '喂食成功'
      };
    } else if (item.category === 'prop') {
      if (effect.mood) {
        const newMood = Math.min(100, Math.max(0, (state.mood || 80) + effect.mood));
        db.prepare('UPDATE pet_states SET mood = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(newMood, userId);
        result.mood = newMood;
      }
      if (effect.satiety) {
        const newSatiety = Math.min(100, Math.max(0, (state.satiety || 80) + effect.satiety));
        db.prepare('UPDATE pet_states SET satiety = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(newSatiety, userId);
        result.satiety = newSatiety;
      }
      if (effect.reduce_explore_seconds) {
        const explore = db.prepare("SELECT id, end_at FROM pet_explorations WHERE user_id = ? AND status = 'ongoing' ORDER BY id DESC LIMIT 1").get(userId);
        if (explore && explore.end_at) {
          const newEnd = new Date(new Date(explore.end_at).getTime() - effect.reduce_explore_seconds * 1000);
          db.prepare("UPDATE pet_explorations SET end_at = ?, duration_seconds = MAX(0, duration_seconds - ?) WHERE id = ?").run(newEnd.toISOString(), effect.reduce_explore_seconds, explore.id);
          result.exploreReduced = effect.reduce_explore_seconds;
        } else {
          result.exploreReduced = 0;
        }
      }
      if (effect.increase_rare_drop) {
        const buff = { increase_rare_drop: effect.increase_rare_drop, expires_at: Date.now() + 24 * 60 * 60 * 1000 };
        db.prepare('UPDATE pet_states SET buff_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(JSON.stringify(buff), userId);
        result.buff = buff;
      }
    } else if (item.category === 'equipment') {
      // 器材为永久物品：使用不消耗数量，但计入每日运动次数
      const exerciseLimits = getExerciseLimits();
      if ((state.daily_exercise_count || 0) >= exerciseLimits.max_per_day) {
        return { error: `今天已运动 ${exerciseLimits.max_per_day} 次，明天再练吧` };
      }
      db.prepare(`
        UPDATE pet_states SET daily_exercise_count = daily_exercise_count + 1, last_exercise_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(userId);
      result = { equipment: true, daily_exercise_count: (state.daily_exercise_count || 0) + 1 };
      taskService.updateTaskProgress(userId, 'use_item', 1);
      return { success: true, effect: result, message: '运动完成，已计入今日运动次数' };
    } else if (item.category === 'skin') {
      const skinId = effect.skin_id || String(item.shop_item_id);
      db.prepare('UPDATE pets SET skin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(skinId, userId);
      result.skinId = skinId;
    }

    // 原子消耗物品（仅食物消耗；器材/道具/皮肤为永久物品，使用后保留）
    if (item.category === 'food') {
      if (item.quantity > 1) {
        const updateResult = db.prepare('UPDATE user_inventory SET quantity = quantity - 1 WHERE id = ? AND quantity > 0').run(inventoryId);
        if (updateResult.changes !== 1) return { error: '物品数量已变化，请重试' };
      } else if (item.quantity === 1) {
        const deleteResult = db.prepare('DELETE FROM user_inventory WHERE id = ? AND quantity = 1').run(inventoryId);
        if (deleteResult.changes !== 1) return { error: '物品数量已变化，请重试' };
      }
    }

    taskService.updateTaskProgress(userId, 'use_item', 1);

    return { success: true, effect: result };
  });
}

module.exports = {
  getInventory,
  useItem,
  getEquipmentWorkouts
};
