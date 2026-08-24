/**
 * 新手任务服务
 */
const { db, withTransaction } = require('../db');
const currencyService = require('./currencyService');
const rewardReceiptService = require('./rewardReceiptService');

const DEFAULT_TASKS = [
  { key: 'first_chat', title: '和搭子打声招呼', desc: '发送第一条消息，让搭子认识你', sort: 1 },
  { key: 'first_diet', title: '记录今日饮食', desc: '记录早餐或午餐，体验聊天即记录', sort: 2 },
  { key: 'first_exercise', title: '记录一次运动', desc: '跑步、散步、瑜伽都可以', sort: 3 },
  { key: 'first_weight', title: '称一次体重', desc: '记录当前体重，开启追踪', sort: 4 },
  { key: 'first_favorite', title: '收藏一条金句', desc: '把搭子的话收藏进博物馆', sort: 5 },
  { key: 'first_museum', title: '查看博物馆', desc: '浏览时间轴，回顾进步', sort: 6 },
  { key: 'three_day_checkin', title: '完成 3 天打卡', desc: '连续记录，养成习惯', sort: 7 }
];

const ACTION_TASK_MAP = {
  chat: ['first_chat'],
  record_diet: ['first_diet'],
  record_exercise: ['first_exercise'],
  record_body: ['first_weight'],
  favorite: ['first_favorite'],
  view_museum: ['first_museum'],
  checkin: ['three_day_checkin']
};

function ensureTasks(userId) {
  // 使用 INSERT OR IGNORE + 唯一约束，避免并发时重复初始化
  const insert = db.prepare(`
    INSERT OR IGNORE INTO user_newbie_tasks (user_id, task_key, title, description, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const t of DEFAULT_TASKS) {
    insert.run(userId, t.key, t.title, t.desc, t.sort);
  }
}

function list(userId) {
  ensureTasks(userId);
  return db.prepare(`
    SELECT id, task_key, title, description, sort_order, status, reward_berries, completed_at, claimed_at
    FROM user_newbie_tasks
    WHERE user_id = ?
    ORDER BY sort_order ASC
  `).all(userId);
}

function completeTask(userId, taskKey) {
  ensureTasks(userId);
  const task = db.prepare('SELECT * FROM user_newbie_tasks WHERE user_id = ? AND task_key = ?').get(userId, taskKey);
  if (!task || task.status !== 'pending') return false;

  db.prepare(`
    UPDATE user_newbie_tasks
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(task.id);
  return true;
}

function checkAction(userId, action, payload = {}) {
  return withTransaction(() => {
    ensureTasks(userId);
    const keys = ACTION_TASK_MAP[action] || [];
    let completed = [];
    for (const key of keys) {
      if (key === 'three_day_checkin') {
        // 累计任意打卡 3 天（饮食/运动/体重/习惯签到）
        const count = db.prepare(`
          SELECT COUNT(DISTINCT record_date) as cnt FROM (
            SELECT record_date FROM diet_records WHERE user_id = ? AND status = 1
            UNION
            SELECT record_date FROM exercise_records WHERE user_id = ? AND status = 1
            UNION
            SELECT record_date FROM body_records WHERE user_id = ? AND status = 1
            UNION
            SELECT record_date FROM habit_records WHERE user_id = ? AND status = 1
          )
        `).get(userId, userId, userId, userId).cnt || 0;
        const task = db.prepare('SELECT * FROM user_newbie_tasks WHERE user_id = ? AND task_key = ?').get(userId, key);
        if (task && task.status === 'pending' && count >= 3) {
          if (completeTask(userId, key)) completed.push(key);
        }
        continue;
      }
      if (completeTask(userId, key)) completed.push(key);
    }
    return completed;
  });
}

function claim(userId, taskKey) {
  return withTransaction(() => {
    ensureTasks(userId);
    const task = db.prepare('SELECT * FROM user_newbie_tasks WHERE user_id = ? AND task_key = ?').get(userId, taskKey);
    if (!task) return { error: '任务不存在' };
    if (task.status !== 'completed') return { error: '任务未完成' };

    const rewardResult = task.reward_berries > 0
      ? currencyService.addCurrency(userId, 'berries', task.reward_berries, 'reward', 'newbie_task', task.id)
      : { added: 0 };

    if (rewardResult.error) {
      return { error: rewardResult.error };
    }

    db.prepare(`
      UPDATE user_newbie_tasks
      SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task.id);

    const receipt = rewardReceiptService.send({
      userId,
      source: 'newbie_task_reward',
      payload: {
        name: task.title,
        berries: rewardResult.added || 0
      }
    });

    return {
      success: true,
      reward_berries: rewardResult.added || 0,
      receipt_message: receipt.content ? { content: receipt.content, berries: rewardResult.added || 0 } : null
    };
  });
}

module.exports = {
  list,
  checkAction,
  claim
};
