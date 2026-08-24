/**
 * 任务与签到服务
 */
const { db, withTransaction } = require('../db');
const currencyService = require('./currencyService');
const achievementService = require('./achievementService');
const newbieTaskService = require('./newbieTaskService');
const rewardReceiptService = require('./rewardReceiptService');
const { safeJsonParse } = require('../utils/safeJson');
const { getChinaDateStr } = require('../utils/chinaTime');

function getCycleKey(type) {
  if (type === 'daily') return getChinaDateStr();
  if (type === 'weekly') {
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // 周一为周首日
    return d.toISOString().split('T')[0];
  }
  return 'once';
}

function getTasks(userId) {
  const tasks = db.prepare('SELECT * FROM tasks WHERE status = 1 ORDER BY sort_order ASC').all();
  const today = getChinaDateStr();

  return tasks.map(task => {
    const cycleKey = getCycleKey(task.type);
    const progress = db.prepare('SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ? AND cycle_key = ?').get(userId, task.id, cycleKey);
    const condition = safeJsonParse(task.condition_json, {});
    return {
      ...task,
      condition,
      progress: progress ? safeJsonParse(progress.progress_json, {}) : {},
      status: progress ? progress.status : 0,
      completed_at: progress ? progress.completed_at : null,
      claimed_at: progress ? progress.claimed_at : null,
      cycle_key: cycleKey
    };
  });
}

function updateTaskProgress(userId, action, count = 1) {
  return withTransaction(() => {
    const tasks = db.prepare('SELECT * FROM tasks WHERE status = 1').all();
    const results = [];

    for (const task of tasks) {
      const condition = safeJsonParse(task.condition_json, {});
      if (condition.action !== action) continue;

      const cycleKey = getCycleKey(task.type);
      let progress = db.prepare('SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ? AND cycle_key = ?').get(userId, task.id, cycleKey);

      if (!progress) {
        const insert = db.prepare('INSERT INTO user_tasks (user_id, task_id, progress_json, status, cycle_key) VALUES (?, ?, ?, ?, ?)');
        const pid = insert.run(userId, task.id, '{}', 0, cycleKey).lastInsertRowid;
        progress = db.prepare('SELECT * FROM user_tasks WHERE id = ?').get(pid);
      }

      if (progress.status >= 2) continue;

      const progressData = safeJsonParse(progress.progress_json, {});
      progressData.count = (progressData.count || 0) + count;

      const target = condition.count || 1;
      const completed = progressData.count >= target;

      if (!completed) {
        db.prepare('UPDATE user_tasks SET progress_json = ?, status = 0 WHERE id = ?')
          .run(JSON.stringify(progressData), progress.id);
        continue;
      }

      // 任务完成，自动发放奖励
      const now = new Date().toISOString();
      const berryResult = task.reward_berries > 0
        ? currencyService.addCurrency(userId, 'berries', task.reward_berries, 'reward', 'task', task.id)
        : { added: 0 };
      const flowerResult = task.reward_flowers > 0
        ? currencyService.addCurrency(userId, 'flowers', task.reward_flowers, 'reward', 'task', task.id)
        : { added: 0 };

      const actualBerries = berryResult.error ? 0 : (berryResult.added || 0);
      const actualFlowers = flowerResult.error ? 0 : (flowerResult.added || 0);
      const hasAnyReward = (task.reward_berries > 0 && !berryResult.error) || (task.reward_flowers > 0 && !flowerResult.error);
      const rewardFullySuccess = (task.reward_berries <= 0 || !berryResult.error) && (task.reward_flowers <= 0 || !flowerResult.error);

      db.prepare('UPDATE user_tasks SET progress_json = ?, status = ?, completed_at = ?, claimed_at = ? WHERE id = ?')
        .run(JSON.stringify(progressData), hasAnyReward ? 2 : 1, now, hasAnyReward ? now : null, progress.id);

      if (hasAnyReward) {
        const receipt = rewardReceiptService.send({
          userId,
          source: 'task_reward',
          payload: {
            name: task.name,
            berries: actualBerries,
            flowers: actualFlowers
          }
        });
        task.reward_message = receipt.content;
      }

      results.push({ ...task, actual_berries: actualBerries, actual_flowers: actualFlowers, reward_success: rewardFullySuccess, reward_message: task.reward_message || null });
    }

    return results;
  });
}

function claimTaskReward(userId, taskId) {
  return withTransaction(() => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return { error: '任务不存在' };

    const cycleKey = getCycleKey(task.type);
    const progress = db.prepare('SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ? AND cycle_key = ?').get(userId, taskId, cycleKey);
    if (!progress || progress.status !== 1) return { error: '任务未完成' };
    if (progress.status === 2) return { error: '奖励已领取' };

    const berryResult = task.reward_berries > 0
      ? currencyService.addCurrency(userId, 'berries', task.reward_berries, 'reward', 'task', task.id)
      : { added: 0 };
    const flowerResult = task.reward_flowers > 0
      ? currencyService.addCurrency(userId, 'flowers', task.reward_flowers, 'reward', 'task', task.id)
      : { added: 0 };

    if (berryResult.error || flowerResult.error) {
      return { error: berryResult.error || flowerResult.error };
    }

    db.prepare('UPDATE user_tasks SET status = 2, claimed_at = CURRENT_TIMESTAMP WHERE id = ?').run(progress.id);

    const receipt = rewardReceiptService.send({
      userId,
      source: 'task_reward',
      payload: {
        name: task.name,
        berries: berryResult.added || 0,
        flowers: flowerResult.added || 0
      }
    });

    return {
      success: true,
      reward_berries: berryResult.added || 0,
      reward_flowers: flowerResult.added || 0,
      receipt_message: receipt.content ? { content: receipt.content, berries: berryResult.added || 0, flowers: flowerResult.added || 0 } : null
    };
  });
}

function getCheckinStatus(userId) {
  const today = getChinaDateStr();
  const todayCheckin = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, today);
  const yesterdayDate = new Date(Date.now() + 8 * 60 * 60 * 1000 - 86400000);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  const yesterdayCheckin = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, yesterday);
  const continuousDays = yesterdayCheckin ? (yesterdayCheckin.continuous_days || 0) : 0;

  return {
    today_checkin: !!todayCheckin,
    continuous_days: todayCheckin ? todayCheckin.continuous_days : continuousDays,
    today_reward: todayCheckin ? { berries: todayCheckin.reward_berries, flowers: todayCheckin.reward_flowers } : null
  };
}

function checkin(userId) {
  return withTransaction(() => {
    const today = getChinaDateStr();
    const existing = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, today);
    if (existing) return { error: '今日已签到' };

    const yesterdayDate = new Date(Date.now() + 8 * 60 * 60 * 1000 - 86400000);
    const yesterday = yesterdayDate.toISOString().split('T')[0];
    const yesterdayCheckin = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND checkin_date = ?').get(userId, yesterday);
    const continuousDays = yesterdayCheckin ? (yesterdayCheckin.continuous_days || 0) + 1 : 1;

    // 签到奖励统一由任务系统配置发放：每日签到任务给浆果，每周连续签到任务给鲜花。
    // 这里只把配置金额写入签到记录用于展示，实际发放由 updateTaskProgress 完成任务时进行。
    const dailyTask = db.prepare(`
      SELECT reward_berries FROM tasks
      WHERE type = 'daily' AND status = 1 AND json_extract(condition_json, '$.action') = 'checkin'
      ORDER BY sort_order ASC, id ASC LIMIT 1
    `).get();
    const weeklyTask = db.prepare(`
      SELECT reward_flowers FROM tasks
      WHERE type = 'weekly' AND status = 1 AND json_extract(condition_json, '$.action') = 'checkin'
      ORDER BY sort_order ASC, id ASC LIMIT 1
    `).get();
    const berries = dailyTask ? (dailyTask.reward_berries || 0) : 0;
    const flowers = (weeklyTask && continuousDays % 7 === 0) ? (weeklyTask.reward_flowers || 0) : 0;

    db.prepare('INSERT INTO checkins (user_id, checkin_date, continuous_days, reward_berries, reward_flowers) VALUES (?, ?, ?, ?, ?)')
      .run(userId, today, continuousDays, berries, flowers);

    // 推进签到任务进度（任务达成时由任务系统发放奖励并发送回执）
    const taskResults = updateTaskProgress(userId, 'checkin', 1);
    newbieTaskService.checkAction(userId, 'checkin');

    achievementService.checkCheckinStreak(userId);
    achievementService.checkAll(userId);

    const rewardedTask = (taskResults || []).find(t => t.reward_message);
    const receiptMessage = rewardedTask
      ? { content: rewardedTask.reward_message, berries: rewardedTask.actual_berries || 0, flowers: rewardedTask.actual_flowers || 0 }
      : null;

    return {
      continuous_days: continuousDays,
      berries,
      flowers,
      receipt_message: receiptMessage,
      currency_limited: false
    };
  });
}

module.exports = {
  getTasks,
  updateTaskProgress,
  claimTaskReward,
  getCheckinStatus,
  checkin
};
