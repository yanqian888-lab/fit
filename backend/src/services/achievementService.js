/**
 * 成就与里程碑服务
 */
const { db, withTransaction } = require('../db');
const currencyService = require('./currencyService');
const { getUsedDays } = require('../utils/date');
const rewardReceiptService = require('./rewardReceiptService');
const { safeJsonParse } = require('../utils/safeJson');

function getAchievements(userId) {
  const achievements = db.prepare('SELECT * FROM achievements WHERE is_enabled = 1 ORDER BY sort_order ASC').all();
  const userAchievements = db.prepare('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?').all(userId);
  const unlockedMap = new Map(userAchievements.map(a => [a.achievement_id, a.unlocked_at]));

  return achievements.map(a => ({
    ...a,
    condition: safeJsonParse(a.condition_json, {}),
    unlocked: unlockedMap.has(a.id),
    unlocked_at: unlockedMap.get(a.id) || null
  }));
}

function unlockAchievement(userId, achievement) {
  return withTransaction(() => {
    const existing = db.prepare('SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?').get(userId, achievement.id);
    if (existing) return null;

    db.prepare('INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, achievement.id);

    const berryResult = achievement.reward_berries > 0
      ? currencyService.addCurrency(userId, 'berries', achievement.reward_berries, 'reward', 'achievement', achievement.id)
      : { added: 0 };
    const flowerResult = achievement.reward_flowers > 0
      ? currencyService.addCurrency(userId, 'flowers', achievement.reward_flowers, 'reward', 'achievement', achievement.id)
      : { added: 0 };

    const actualBerries = berryResult.error ? 0 : (berryResult.added || 0);
    const actualFlowers = flowerResult.error ? 0 : (flowerResult.added || 0);
    const hasReward = !berryResult.error || !flowerResult.error;

    // 写入时间轴
    db.prepare(`
      INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
      VALUES (?, 'milestone', ?, ?, ?, 'achievements', ?, 1)
    `).run(userId, achievement.name, achievement.description || '', achievement.id, new Date().toISOString().split('T')[0]);

    // 发送管家回执（只有实际发放奖励时才发送）
    if (hasReward) {
      rewardReceiptService.send({
        userId,
        source: 'achievement_reward',
        payload: {
          name: achievement.name,
          description: achievement.description || '',
          berries: actualBerries,
          flowers: actualFlowers
        }
      });
    }

    return achievement;
  });
}

function checkMilestones(userId, category, value) {
  const achievements = db.prepare('SELECT * FROM achievements WHERE category = ? AND is_enabled = 1').all(category);
  const unlocked = [];

  for (const ach of achievements) {
    const condition = safeJsonParse(ach.condition_json, {});
    let matched = false;

    if (category === 'weight_loss' && condition.weight_loss && value >= condition.weight_loss) matched = true;
    if (category === 'streak' && condition.checkin_streak && value >= condition.checkin_streak) matched = true;
    if (category === 'duration' && condition.used_days && value >= condition.used_days) matched = true;
    if (category === 'chat' && condition.chat_count && value >= condition.chat_count) matched = true;
    if (category === 'exercise_count' && condition.exercise_count && value >= condition.exercise_count) matched = true;
    if (category === 'exercise_duration' && condition.exercise_duration && value >= condition.exercise_duration) matched = true;
    if (category === 'exercise_calorie' && condition.exercise_calorie && value >= condition.exercise_calorie) matched = true;
    if (category === 'diet_days' && condition.diet_days && value >= condition.diet_days) matched = true;
    if (category === 'event_collection' && condition.event_count && value >= condition.event_count) matched = true;
    if (category === 'recipe_collection' && condition.recipe_count && value >= condition.recipe_count) matched = true;
    if (category === 'weight_goal' && condition.weight_goal && value >= 1) matched = true;

    if (matched) {
      const result = unlockAchievement(userId, ach);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

function checkWeightLossMilestone(userId) {
  const profile = db.prepare('SELECT initial_weight, current_weight FROM user_profiles WHERE user_id = ?').get(userId);
  if (!profile || !profile.initial_weight || !profile.current_weight) return [];
  const loss = profile.initial_weight - profile.current_weight;
  if (loss <= 0) return [];

  return checkMilestones(userId, 'weight_loss', loss);
}

function checkCheckinStreak(userId) {
  const latest = db.prepare('SELECT continuous_days FROM checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1').get(userId);
  if (!latest) return [];
  return checkMilestones(userId, 'streak', latest.continuous_days || 0);
}

function checkEventCollection(userId) {
  const count = db.prepare('SELECT COUNT(*) as count FROM user_events WHERE user_id = ?').get(userId).count;
  return checkMilestones(userId, 'event_collection', count);
}

function getActiveDays(userId) {
  return db.prepare(`
    SELECT COUNT(DISTINCT record_date) as count FROM (
      SELECT record_date FROM diet_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM exercise_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM body_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM habit_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM fasting_records WHERE user_id = ? AND status = 'completed'
    )
  `).get(userId, userId, userId, userId, userId).count;
}

function checkDurationMilestone(userId) {
  const days = getActiveDays(userId);
  return checkMilestones(userId, 'duration', days);
}

function checkChatCount(userId) {
  const count = db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ?').get(userId).count;
  return checkMilestones(userId, 'chat', count);
}

function checkExerciseCount(userId) {
  const count = db.prepare('SELECT COUNT(*) as count FROM exercise_records WHERE user_id = ? AND status = 1').get(userId).count;
  return checkMilestones(userId, 'exercise_count', count);
}

function checkExerciseDuration(userId) {
  const result = db.prepare('SELECT SUM(total_duration) as duration FROM exercise_records WHERE user_id = ? AND status = 1').get(userId);
  return checkMilestones(userId, 'exercise_duration', result.duration || 0);
}

function checkExerciseCalorie(userId) {
  const result = db.prepare('SELECT SUM(total_calorie) as calorie FROM exercise_records WHERE user_id = ? AND status = 1').get(userId);
  return checkMilestones(userId, 'exercise_calorie', result.calorie || 0);
}

function checkDietDays(userId) {
  const result = db.prepare(`
    SELECT COUNT(DISTINCT record_date) as count FROM diet_records WHERE user_id = ? AND status = 1
  `).get(userId);
  return checkMilestones(userId, 'diet_days', result.count || 0);
}

function checkWeightGoal(userId) {
  const profile = db.prepare('SELECT current_weight, target_weight FROM user_profiles WHERE user_id = ?').get(userId);
  if (!profile || !profile.target_weight || !profile.current_weight) return [];
  // 达到或接近目标体重（允许正负 0.5kg 容差）
  if (profile.current_weight <= profile.target_weight + 0.5) {
    return checkMilestones(userId, 'weight_goal', 1);
  }
  return [];
}

function checkRecipeCollection(userId) {
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM museum_items WHERE user_id = ? AND type = 'recipe' AND status = 1
  `).get(userId).count;
  return checkMilestones(userId, 'recipe_collection', count);
}

function maxConsecutiveDates(dates) {
  if (!dates || dates.length === 0) return 0;
  let max = 1, current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (curr - prev) / 86400000;
    if (diff === 1) {
      current++;
      max = Math.max(max, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return max;
}

function getHabitStreak(userId, habitType, goal = null) {
  if (habitType === 'water') {
    const rows = db.prepare(`
      SELECT record_date, SUM(water_ml) as total
      FROM habit_records
      WHERE user_id = ? AND type = 'water' AND status = 1
      GROUP BY record_date
      HAVING total >= ?
      ORDER BY record_date ASC
    `).all(userId, goal || 2000);
    return maxConsecutiveDates(rows.map(r => r.record_date));
  }

  // 睡眠/排便/心情等：只要有记录即算打卡
  const rows = db.prepare(`
    SELECT DISTINCT record_date FROM habit_records
    WHERE user_id = ? AND type = ? AND status = 1
    ORDER BY record_date ASC
  `).all(userId, habitType);
  return maxConsecutiveDates(rows.map(r => r.record_date));
}

function checkHabitStreak(userId, habitType) {
  const achievements = db.prepare("SELECT * FROM achievements WHERE category = 'habit' AND is_enabled = 1").all();
  const unlocked = [];

  for (const ach of achievements) {
    const condition = safeJsonParse(ach.condition_json, {});
    if (condition.habit_type !== habitType) continue;

    const streak = getHabitStreak(userId, habitType, condition.goal);
    if (condition.streak_days && streak >= condition.streak_days) {
      const result = unlockAchievement(userId, ach);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

function getMetricChange(userId, metric) {
  const rows = db.prepare(`
    SELECT value, record_date FROM body_records
    WHERE user_id = ? AND type = ? AND status = 1 AND value IS NOT NULL
    ORDER BY record_date ASC, created_at ASC
  `).all(userId, metric);
  if (rows.length < 2) return null;
  const initial = parseFloat(rows[0].value);
  const latest = parseFloat(rows[rows.length - 1].value);
  if (!initial || !latest || initial <= 0) return null;
  const change = latest - initial;
  return { initial, latest, change, changePct: (change / initial) * 100 };
}

function checkBodyMetric(userId) {
  const achievements = db.prepare("SELECT * FROM achievements WHERE category = 'body' AND is_enabled = 1").all();
  const unlocked = [];

  for (const ach of achievements) {
    const condition = safeJsonParse(ach.condition_json, {});
    const metric = condition.metric;
    const change = getMetricChange(userId, metric);
    if (!change) continue;

    let matched = false;
    if (condition.decrease_pct && -change.changePct >= condition.decrease_pct) matched = true;
    if (condition.increase_pct && change.changePct >= condition.increase_pct) matched = true;

    if (matched) {
      const result = unlockAchievement(userId, ach);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

function checkMeasure(userId) {
  const achievements = db.prepare("SELECT * FROM achievements WHERE category = 'measure' AND is_enabled = 1").all();
  const unlocked = [];

  for (const ach of achievements) {
    const condition = safeJsonParse(ach.condition_json, {});
    const metric = condition.metric;
    const change = getMetricChange(userId, metric);
    if (!change) continue;

    let matched = false;
    if (condition.decrease_cm && -change.change >= condition.decrease_cm) matched = true;
    if (condition.increase_cm && change.change >= condition.increase_cm) matched = true;

    if (matched) {
      const result = unlockAchievement(userId, ach);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

function checkSpecial(userId) {
  const achievements = db.prepare("SELECT * FROM achievements WHERE category = 'special' AND is_enabled = 1").all();
  const unlocked = [];

  for (const ach of achievements) {
    const condition = safeJsonParse(ach.condition_json, {});
    let matched = false;

    if (condition.key === 'first_fasting') {
      const exists = db.prepare("SELECT id FROM fasting_records WHERE user_id = ? AND status = 'completed'").get(userId);
      if (exists) matched = true;
    }

    if (condition.key === 'fasting_streak_7') {
      const rows = db.prepare("SELECT record_date FROM fasting_records WHERE user_id = ? AND status = 'completed' ORDER BY record_date ASC").all(userId);
      let maxStreak = 0, current = 0, prev = null;
      for (const row of rows) {
        const d = new Date(row.record_date);
        if (prev) {
          const diff = (d - prev) / 86400000;
          if (diff === 1) current++; else if (diff > 1) current = 1;
        } else {
          current = 1;
        }
        if (current > maxStreak) maxStreak = current;
        prev = d;
      }
      if (maxStreak >= 7) matched = true;
    }

    if (condition.key === 'fasting_5_2_week') {
      const count = db.prepare(`
        SELECT COUNT(*) as count FROM fasting_records
        WHERE user_id = ? AND status = 'completed' AND mode = '5:2'
        AND strftime('%Y-%W', record_date) = strftime('%Y-%W', 'now')
      `).get(userId).count;
      if (count >= 2) matched = true;
    }

    if (matched) {
      const result = unlockAchievement(userId, ach);
      if (result) unlocked.push(result);
    }
  }

  return unlocked;
}

function checkAll(userId) {
  const results = [];
  results.push(...checkWeightLossMilestone(userId));
  results.push(...checkCheckinStreak(userId));
  results.push(...checkEventCollection(userId));
  results.push(...checkDurationMilestone(userId));
  results.push(...checkHabitStreak(userId, 'water'));
  results.push(...checkHabitStreak(userId, 'sleep'));
  results.push(...checkBodyMetric(userId));
  results.push(...checkMeasure(userId));
  results.push(...checkSpecial(userId));
  results.push(...checkChatCount(userId));
  results.push(...checkExerciseCount(userId));
  results.push(...checkExerciseDuration(userId));
  results.push(...checkExerciseCalorie(userId));
  results.push(...checkDietDays(userId));
  results.push(...checkWeightGoal(userId));
  results.push(...checkRecipeCollection(userId));
  return results;
}

module.exports = {
  getAchievements,
  checkWeightLossMilestone,
  checkCheckinStreak,
  checkEventCollection,
  checkDurationMilestone,
  checkHabitStreak,
  checkBodyMetric,
  checkMeasure,
  checkSpecial,
  checkMilestones,
  checkAll,
  checkChatCount,
  checkExerciseCount,
  checkExerciseDuration,
  checkExerciseCalorie,
  checkDietDays,
  checkWeightGoal,
  checkRecipeCollection
};
