/**
 * 博物馆控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

/**
 * 获取博物馆总览
 */
function getOverview(req, res) {
  const userId = req.userId;

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);

  // 已减重量
  let lostWeight = 0;
  if (profile && profile.initial_weight && profile.current_weight) {
    lostWeight = parseFloat((profile.initial_weight - profile.current_weight).toFixed(2));
  }

  // 已用天数
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
  const usedDays = user ? Math.max(1, Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)) : 1;

  // 目标完成率
  let completionRate = 0;
  let remainingDays = null;
  if (profile && profile.initial_weight && profile.target_weight && profile.current_weight) {
    const total = profile.initial_weight - profile.target_weight;
    const done = profile.initial_weight - profile.current_weight;
    completionRate = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    if (profile.target_date) {
      remainingDays = Math.max(0, Math.ceil((new Date(profile.target_date).getTime() - Date.now()) / 86400000));
    }
  }

  // 总打卡天数（有任意记录的天数）
  const checkinDays = db.prepare(`
    SELECT COUNT(DISTINCT record_date) as count FROM (
      SELECT record_date FROM diet_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM exercise_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM body_records WHERE user_id = ? AND status = 1
    )
  `).get(userId, userId, userId).count;

  // 总运动时长和消耗
  const exerciseStats = db.prepare(`
    SELECT SUM(total_duration) as duration, SUM(total_calorie) as calorie
    FROM exercise_records
    WHERE user_id = ? AND status = 1
  `).get(userId);

  // 下一个里程碑
  let nextMilestone = null;
  if (profile && profile.current_weight && profile.target_weight) {
    const milestones = [2.5, 5, 10, 15, 20];
    for (const m of milestones) {
      if (lostWeight < m) {
        nextMilestone = { title: `减重 ${m}kg`, remaining: parseFloat((m - lostWeight).toFixed(2)) };
        break;
      }
    }
  }

  return res.json(success({
    lost_weight: lostWeight,
    used_days: usedDays,
    target_weight: profile ? profile.target_weight : null,
    completion_rate: completionRate,
    remaining_days: remainingDays,
    total_checkin_days: checkinDays,
    total_exercise_minutes: exerciseStats.duration || 0,
    total_burned_calorie: exerciseStats.calorie || 0,
    next_milestone: nextMilestone
  }));
}

/**
 * 获取时间轴
 */
function getTimeline(req, res) {
  const userId = req.userId;
  const filter = req.query.filter || 'all';
  const date = req.query.date || null;

  let sql = `
    SELECT id, event_type, title, content, related_id, related_type, event_date, is_important, created_at
    FROM timelines
    WHERE user_id = ?
  `;
  const params = [userId];

  if (filter !== 'all') {
    sql += ' AND event_type = ?';
    params.push(filter);
  }

  if (date) {
    sql += ' AND event_date LIKE ?';
    params.push(`${date}%`);
  }

  sql += ' ORDER BY is_important DESC, event_date DESC, created_at DESC LIMIT 100';

  const list = db.prepare(sql).all(...params);
  return res.json(success({ list }));
}

/**
 * 获取博物馆内容列表
 */
function getItems(req, res) {
  const userId = req.userId;
  const type = req.query.type || 'quote';
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  const list = db.prepare(`
    SELECT id, type, sub_type, content, extracted_data, author, emotion, scene, effectiveness, is_favorite, tags, created_at
    FROM museum_items
    WHERE user_id = ? AND type = ? AND status = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, type, size, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM museum_items WHERE user_id = ? AND type = ? AND status = 1')
    .get(userId, type).count;

  return res.json(success({
    list: list.map(item => ({
      ...item,
      extracted_data: item.extracted_data ? JSON.parse(item.extracted_data) : null,
      tags: item.tags ? JSON.parse(item.tags) : null
    })),
    pagination: {
      page,
      size,
      total,
      has_more: total > page * size
    }
  }));
}

/**
 * 添加博物馆内容
 */
function addItem(req, res) {
  const userId = req.userId;
  const { type, content, sub_type, author, emotion, tags } = req.body;

  if (!type || !content) {
    return res.status(400).json(error('类型和内容不能为空', 400));
  }

  const insertId = db.prepare(`
    INSERT INTO museum_items (user_id, type, sub_type, content, author, emotion, tags, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(userId, type, sub_type || null, content, author || 'user', emotion || null, tags ? JSON.stringify(tags) : null).lastInsertRowid;

  // 写入时间轴
  const titleMap = {
    quote: '金句',
    insight: '感悟',
    recipe: '食谱',
    method: '方法',
    pitfall: '踩坑',
    product: '好物'
  };
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, type, titleMap[type] || type, content, insertId, 'museum_items', today);

  return res.json(success({ id: insertId }, '添加成功'));
}

/**
 * 更新博物馆内容
 */
function updateItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const { content, sub_type, emotion, effectiveness, is_favorite, tags } = req.body;

  db.prepare(`
    UPDATE museum_items
    SET content = COALESCE(?, content),
        sub_type = COALESCE(?, sub_type),
        emotion = COALESCE(?, emotion),
        effectiveness = COALESCE(?, effectiveness),
        is_favorite = COALESCE(?, is_favorite),
        tags = COALESCE(?, tags),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(content, sub_type, emotion, effectiveness, is_favorite, tags ? JSON.stringify(tags) : null, id, userId);

  return res.json(success(null, '更新成功'));
}

/**
 * 删除博物馆内容
 */
function deleteItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM museum_items WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

module.exports = {
  getOverview,
  getTimeline,
  getItems,
  addItem,
  updateItem,
  deleteItem
};
