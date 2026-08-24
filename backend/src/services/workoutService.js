/**
 * 陪你动跟练服务
 */
const { db, withTransaction } = require('../db');
const currencyService = require('./currencyService');
const taskService = require('./taskService');
const achievementService = require('./achievementService');

function safeParseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch (e) { return null; }
}

// 用户持有的运动器材商品 id 集合（购买即持有，永久物品）
function getOwnedEquipmentIds(userId) {
  const rows = db.prepare(`
    SELECT DISTINCT shop_item_id FROM user_inventory
    WHERE user_id = ? AND category = 'equipment' AND shop_item_id IS NOT NULL
  `).all(userId);
  return new Set(rows.map(r => r.shop_item_id));
}

function getWorkouts(userId) {
  const owned = getOwnedEquipmentIds(userId);
  const rows = db.prepare(`
    SELECT w.id, w.workout_key, w.name, w.category, w.video_url, w.cover_url, w.duration_seconds, w.calorie_per_session,
           w.duration_mode, w.set_minutes, w.sets_count, w.rest_seconds, w.calorie_per_hour,
           w.required_item_id, w.exercise_id, w.description, w.sort_order,
           ex.calorie_per_hour AS exercise_rate
    FROM workout_lib w
    LEFT JOIN exercise_db ex ON ex.id = w.exercise_id
    WHERE w.status = 1
    ORDER BY w.sort_order ASC, w.id ASC
  `).all();

  return rows.map(row => ({
    ...row,
    // 关联了运动库的课程，展示与记录消耗都按运动库的每小时消耗
    calorie_per_hour: row.exercise_rate > 0 ? row.exercise_rate : row.calorie_per_hour,
    is_unlocked: !row.required_item_id || owned.has(row.required_item_id)
  }));
}

function getWorkoutDetail(userId, workoutKey) {
  const row = db.prepare(`
    SELECT w.id, w.workout_key, w.name, w.category, w.video_url, w.cover_url, w.duration_seconds, w.calorie_per_session,
           w.duration_mode, w.set_minutes, w.sets_count, w.rest_seconds, w.calorie_per_hour,
           w.required_item_id, w.exercise_id, w.description, w.sort_order,
           ex.calorie_per_hour AS exercise_rate
    FROM workout_lib w
    LEFT JOIN exercise_db ex ON ex.id = w.exercise_id
    WHERE w.workout_key = ? AND w.status = 1
  `).get(workoutKey);
  if (!row) return null;

  const owned = getOwnedEquipmentIds(userId);
  return {
    ...row,
    calorie_per_hour: row.exercise_rate > 0 ? row.exercise_rate : row.calorie_per_hour,
    is_unlocked: !row.required_item_id || owned.has(row.required_item_id)
  };
}

function startWorkout(userId, workoutKey) {
  const workout = getWorkoutDetail(userId, workoutKey);
  if (!workout) return { error: '课程不存在' };
  if (!workout.is_unlocked) return { error: '需要先解锁对应器材' };
  return { workout };
}

function completeWorkout(userId, workoutKey, { duration_seconds = null } = {}) {
  return withTransaction(() => {
    const workout = getWorkoutDetail(userId, workoutKey);
    if (!workout) return { error: '课程不存在' };
    if (!workout.is_unlocked) return { error: '需要先解锁对应器材' };

    const today = new Date().toISOString().split('T')[0];

    // 每日同一课程去重，避免重复请求多次奖励
    const existing = db.prepare(`
      SELECT id, total_duration, total_calorie FROM exercise_records
      WHERE user_id = ? AND record_date = ? AND workout_key = ? AND is_workout = 1 AND status = 1
      ORDER BY id DESC LIMIT 1
    `).get(userId, today, workout.workout_key);
    if (existing) {
      return {
        id: existing.id,
        workout_key: workout.workout_key,
        duration_seconds: existing.total_duration * 60,
        calorie: existing.total_calorie,
        duplicate: true
      };
    }

    const actualDuration = duration_seconds || workout.duration_seconds || 0;
    // 时长按分钟记录，不足 1 分钟的跟练按 1 分钟计（只要产生记录）
    const durationMinutes = actualDuration > 0 ? Math.max(1, Math.round(actualDuration / 60)) : 0;
    // 消耗按每小时千卡 × 实际跟练时长折算（保留 1 位小数）
    // 兼容未迁移的旧数据：没有每小时消耗时回退到每次固定消耗
    const calorie = workout.calorie_per_hour > 0
      ? Math.round((workout.calorie_per_hour * actualDuration / 3600) * 10) / 10
      : (workout.calorie_per_session || 0);

    const exercises = [{
      name: workout.name,
      duration: durationMinutes,
      calorie
    }];

    const insert = db.prepare(`
      INSERT INTO exercise_records
        (user_id, record_date, exercise_type, exercises, total_duration, total_calorie, is_workout, source, workout_key, video_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'workout', ?, ?, 1)
    `);
    const id = insert.run(
      userId,
      today,
      workout.category || 'aerobic',
      JSON.stringify(exercises),
      durationMinutes,
      calorie,
      workout.workout_key,
      workout.video_url
    ).lastInsertRowid;

    // 浆果奖励已收口到任务系统：这里只推进任务进度，由任务配置决定是否发奖
    taskService.updateTaskProgress(userId, 'record_exercise', 1);
    achievementService.checkAll(userId);

    return { id, workout_key: workout.workout_key, duration_seconds: actualDuration, calorie };
  });
}

module.exports = {
  getWorkouts,
  getWorkoutDetail,
  startWorkout,
  completeWorkout,
  getOwnedEquipmentIds
};
