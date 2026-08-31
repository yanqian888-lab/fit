/**
 * 博物馆控制器
 */
const { db, withTransaction } = require('../db');
const { success, error } = require('../utils/response');
const { getChinaDateStr } = require('../utils/chinaTime');

const MUSEUM_TITLE_MAP = {
  quote: '金句',
  insight: '感悟',
  recipe: '食谱',
  method: '方法',
  pitfall: '踩坑',
  product: '好物'
};
const { getUsedDays } = require('../utils/date');
const { getModulesConfig } = require('./cmsMuseumConfigController');
const museumService = require('../services/museumService');
const { computeRecipeTotals } = require('../services/nutritionService');
const currencyService = require('../services/currencyService');
const taskService = require('../services/taskService');
const achievementService = require('../services/achievementService');
const newbieTaskService = require('../services/newbieTaskService');
const rewardService = require('../services/rewardService');

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
  const usedDays = getUsedDays(user ? user.created_at : null);

  // 目标完成率
  let completionRate = 0;
  let remainingDays = null;
  if (profile && profile.initial_weight && profile.target_weight && profile.current_weight) {
    const total = profile.initial_weight - profile.target_weight;
    const done = profile.initial_weight - profile.current_weight;
    completionRate = total > 0 ? Math.max(0, Math.min(100, parseFloat(((done / total) * 100).toFixed(2)))) : 0;

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

  // 运动天数
  const exerciseDays = db.prepare(`
    SELECT COUNT(DISTINCT record_date) as count
    FROM exercise_records
    WHERE user_id = ? AND status = 1
  `).get(userId).count;

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

  // 博物馆访问推进新手任务
  newbieTaskService.checkAction(userId, 'view_museum');

  return res.json(success({
    lost_weight: lostWeight,
    used_days: usedDays,
    initial_weight: profile ? profile.initial_weight : null,
    current_weight: profile ? profile.current_weight : null,
    target_weight: profile ? profile.target_weight : null,
    completion_rate: completionRate,
    remaining_days: remainingDays,
    total_checkin_days: checkinDays,
    total_exercise_days: exerciseDays,
    total_exercise_minutes: exerciseStats.duration || 0,
    total_burned_calorie: exerciseStats.calorie || 0,
    next_milestone: nextMilestone,
    modules: getModulesConfig()
  }));
}

/**
 * 获取时间轴
 */
function getTimeline(req, res) {
  const userId = req.userId;
  const filter = req.query.filter || 'all';
  const date = req.query.date || null;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;

  let countSql = `
    SELECT COUNT(*) as count
    FROM timelines
    WHERE user_id = ?
  `;
  let sql = `
    SELECT id, event_type, title, content, related_id, related_type, event_date, is_important, created_at
    FROM timelines
    WHERE user_id = ?
  `;
  const params = [userId];
  const countParams = [userId];

  if (filter !== 'all') {
    sql += ' AND event_type = ?';
    countSql += ' AND event_type = ?';
    params.push(filter);
    countParams.push(filter);
  }

  if (date) {
    sql += ' AND event_date LIKE ?';
    countSql += ' AND event_date LIKE ?';
    params.push(`${date}%`);
    countParams.push(`${date}%`);
  }

  const total = db.prepare(countSql).get(...countParams).count;
  sql += ' ORDER BY is_important DESC, event_date DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params);
  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function safeParseJson(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

/**
 * 获取博物馆内容列表
 */
function getItems(req, res) {
  const userId = req.userId;
  const type = req.query.type || 'quote';
  const subType = req.query.sub_type || null;
  const month = req.query.month || null;
  const keyword = (req.query.keyword || '').trim();
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;

  let sql = `
    SELECT id, type, sub_type, title, content, extracted_data, author, emotion, scene, effectiveness, is_favorite, tags, created_at
    FROM museum_items
    WHERE user_id = ? AND type = ? AND status = 1
  `;
  const params = [userId, type];

  if (subType) {
    sql += ' AND sub_type = ?';
    params.push(subType);
  }

  if (month) {
    sql += " AND tags LIKE ?";
    params.push(`%${month}%`);
  }

  if (keyword) {
    sql += " AND (content LIKE ? OR sub_type LIKE ? OR title LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params);

  let countSql = 'SELECT COUNT(*) as count FROM museum_items WHERE user_id = ? AND type = ? AND status = 1';
  const countParams = [userId, type];
  if (subType) {
    countSql += ' AND sub_type = ?';
    countParams.push(subType);
  }
  if (month) {
    countSql += " AND tags LIKE ?";
    countParams.push(`%${month}%`);
  }
  if (keyword) {
    countSql += " AND (content LIKE ? OR sub_type LIKE ? OR title LIKE ?)";
    countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const total = db.prepare(countSql).get(...countParams).count;

  return res.json(success({
    list: list.map(item => {
      // 兼容历史沉淀食谱：title 为空时用 sub_type 兜底
      if ((!item.title || item.title === '') && item.sub_type) {
        item.title = item.sub_type;
      }
      return {
        ...item,
        extracted_data: safeParseJson(item.extracted_data),
        tags: safeParseJson(item.tags)
      };
    }),
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
const VALID_MUSEUM_TYPES = ['quote', 'insight', 'recipe', 'method', 'pitfall', 'product'];

function addItem(req, res) {
  const userId = req.userId;
  const { type, content, sub_type, author, emotion, tags, extracted_data } = req.body;

  if (!type || !VALID_MUSEUM_TYPES.includes(type)) {
    return res.status(400).json(error('博物馆类型不合法', 400));
  }
  if (!content || content.length > 2000) {
    return res.status(400).json(error('内容不能为空且不能超过 2000 字', 400));
  }

  const insertId = withTransaction(() => {
    const id = db.prepare(`
      INSERT INTO museum_items (user_id, type, sub_type, content, extracted_data, author, emotion, tags, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      userId,
      type,
      sub_type || null,
      content,
      extracted_data ? JSON.stringify(extracted_data) : null,
      author || 'user',
      emotion || null,
      tags ? JSON.stringify(tags) : null
    ).lastInsertRowid;

    // 写入时间轴
    const today = getChinaDateStr();
    db.prepare(`
      INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, type, MUSEUM_TITLE_MAP[type] || type, content, id, 'museum_items', today);

    return id;
  });

  return res.json(success({ id: insertId }, '添加成功'));
}

/**
 * 更新博物馆内容
 */
function updateItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const { content, sub_type, emotion, effectiveness, is_favorite, tags, extracted_data } = req.body;

  const item = db.prepare('SELECT id, type, content FROM museum_items WHERE id = ? AND user_id = ?').get(id, userId);
  if (!item) {
    return res.status(404).json(error('内容不存在', 404));
  }

  // 食谱编辑保存时重算总克数/总热量
  if (item.type === 'recipe' && extracted_data && Array.isArray(extracted_data.ingredients)) {
    const totals = computeRecipeTotals(extracted_data.ingredients);
    extracted_data.total_weight = totals.totalWeight;
    extracted_data.total_calorie = totals.totalCalorie;
  }

  db.prepare(`
    UPDATE museum_items
    SET content = COALESCE(?, content),
        sub_type = COALESCE(?, sub_type),
        extracted_data = COALESCE(?, extracted_data),
        emotion = COALESCE(?, emotion),
        effectiveness = COALESCE(?, effectiveness),
        is_favorite = COALESCE(?, is_favorite),
        tags = COALESCE(?, tags),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    content,
    sub_type,
    extracted_data ? JSON.stringify(extracted_data) : null,
    emotion,
    effectiveness,
    is_favorite,
    tags ? JSON.stringify(tags) : null,
    id,
    userId
  );

  // 同步更新关联时间轴内容
  const newContent = content !== undefined ? content : item.content;
  db.prepare(`
    UPDATE timelines
    SET content = ?, title = ?
    WHERE related_id = ? AND related_type = 'museum_items'
  `).run(newContent, MUSEUM_TITLE_MAP[item.type] || item.type, id);

  return res.json(success(null, '更新成功'));
}

/**
 * 删除博物馆内容
 */
function deleteItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  const item = db.prepare('SELECT id FROM museum_items WHERE id = ? AND user_id = ?').get(id, userId);
  if (!item) {
    return res.status(404).json(error('内容不存在', 404));
  }

  db.prepare('DELETE FROM museum_items WHERE id = ? AND user_id = ?').run(id, userId);
  // 级联删除关联时间轴，避免产生孤儿记录
  db.prepare(`DELETE FROM timelines WHERE related_id = ? AND related_type = 'museum_items'`).run(id);
  return res.json(success(null, '删除成功'));
}

/**
 * 确认保存待确认的沉淀资产
 */
function confirmItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const { modified_data } = req.body;

  if (modified_data !== undefined && modified_data !== null && typeof modified_data !== 'object') {
    return res.status(400).json(error('modified_data 格式不正确', 400));
  }

  const item = db.prepare('SELECT * FROM museum_items WHERE id = ? AND user_id = ? AND status = 0').get(id, userId);
  if (!item) {
    return res.status(404).json(error('待确认资产不存在或已处理', 404));
  }

  let extractedData = item.extracted_data;
  let content = item.content;
  let subType = item.sub_type;

  if (modified_data) {
    content = modified_data.content !== undefined ? modified_data.content : content;
    subType = modified_data.sub_type !== undefined ? modified_data.sub_type : subType;
    if (content && content.length > 2000) {
      return res.status(400).json(error('内容不能超过 2000 字', 400));
    }
    const parsed = safeParseJson(item.extracted_data) || {};
    const updatedData = { ...parsed, ...modified_data };
    extractedData = JSON.stringify(updatedData);
  }

  withTransaction(() => {
    db.prepare(`
      UPDATE museum_items
      SET content = ?, sub_type = ?, extracted_data = ?, status = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(content, subType, extractedData, id, userId);

    // 写入时间轴
    const today = getChinaDateStr();
    db.prepare(`
      INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, item.type, MUSEUM_TITLE_MAP[item.type] || item.type, content, id, 'museum_items', today);

    // 同步回写聊天消息与沉淀记录状态，避免重复确认与 UI 不一致
    if (item.chat_message_id) {
      db.prepare('UPDATE chat_messages SET precipitation_status = 1, precipitation_type = ? WHERE id = ?')
        .run(item.type, item.chat_message_id);
    }

    const precipitation = db.prepare('SELECT id FROM precipitation_records WHERE chat_message_id = ? AND user_id = ? AND status = 0')
      .get(item.chat_message_id, userId);
    if (precipitation) {
      db.prepare('UPDATE precipitation_records SET status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(precipitation.id);
      // 触发奖励与新手任务（与聊天确认沉淀保持一致）
      rewardService.rewardForPrecipitationRecord(userId, item.type, item.sub_type, safeParseJson(extractedData), precipitation.id);
    }
  });

  return res.json(success(null, '已保存'));
}

/**
 * 舍弃待确认的沉淀资产
 */
function discardItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const result = db.prepare('DELETE FROM museum_items WHERE id = ? AND user_id = ? AND status = 0').run(id, userId);
  if (result.changes === 0) {
    return res.status(404).json(error('待确认资产不存在或已处理', 404));
  }
  return res.json(success(null, '已舍弃'));
}

/**
 * 切换收藏状态
 */
function toggleFavorite(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  const item = db.prepare('SELECT is_favorite FROM museum_items WHERE id = ? AND user_id = ?').get(id, userId);
  if (!item) {
    return res.status(404).json(error('内容不存在', 404));
  }

  const newValue = item.is_favorite ? 0 : 1;
  db.prepare('UPDATE museum_items SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .run(newValue, id, userId);

  if (!item.is_favorite && newValue === 1) {
    // 首次收藏触发新手任务；日常任务不再由切换收藏直接推进，避免反复刷取
    newbieTaskService.checkAction(userId, 'favorite');
  }

  return res.json(success({ is_favorite: newValue }, '操作成功'));
}

/**
 * 获取单条博物馆内容
 */
function getItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;

  const item = db.prepare(`
    SELECT id, type, sub_type, title, content, extracted_data, author, emotion, scene, effectiveness, is_favorite, tags, created_at
    FROM museum_items
    WHERE id = ? AND user_id = ? AND status = 1
  `).get(id, userId);

  if (!item) {
    return res.status(404).json(error('内容不存在', 404));
  }

  // 兼容历史沉淀食谱：title 为空时用 sub_type 兜底
  if (!item.title && item.sub_type) {
    item.title = item.sub_type;
  }
  // 历史脏数据：extracted_data.title 被写成了类型字符串（如 precipitation_recipe），用真实标题覆盖
  const parsedData = safeParseJson(item.extracted_data);
  if (parsedData && ['precipitation_recipe', 'dada_recipe', 'custom_recipe', 'recipe'].includes(parsedData.title)) {
    parsedData.title = item.title;
  }

  return res.json(success({
    ...item,
    extracted_data: parsedData,
    tags: safeParseJson(item.tags)
  }));
}

/**
 * 保存心情日记
 */
const VALID_EMOTIONS = ['great', 'good', 'normal', 'bad', 'terrible'];

function saveMood(req, res) {
  const userId = req.userId;
  const { record_date, emotion, content, tags } = req.body;

  if (!emotion || !VALID_EMOTIONS.includes(emotion)) {
    return res.status(400).json(error('请选择有效的心情', 400));
  }
  if (content !== undefined && (typeof content !== 'string' || content.length > 200)) {
    return res.status(400).json(error('心情内容需为字符串且不超过 200 字', 400));
  }
  if (record_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(record_date)) {
    return res.status(400).json(error('日期格式不正确', 400));
  }
  if (tags !== undefined && !Array.isArray(tags)) {
    return res.status(400).json(error('标签格式不正确', 400));
  }

  const result = withTransaction(() => {
    const saved = museumService.saveMood(userId, { record_date, emotion, content, tags });

    // 浆果奖励已收口到任务系统：这里只推进任务进度，由任务配置决定是否发奖
    const taskResults = taskService.updateTaskProgress(userId, 'record_mood', 1);
    const rewardMessages = taskResults.filter(t => t.reward_message).map(t => ({ name: t.name, message: t.reward_message }));
    achievementService.checkAll(userId);

    return { ...saved, reward_messages: rewardMessages };
  });

  return res.json(success(result, '保存成功'));
}

/**
 * 获取心情日记列表
 */
function getMoods(req, res) {
  const userId = req.userId;
  const month = req.query.month;
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const result = museumService.getMoods(userId, month, page, size);
  return res.json(success(result));
}

/**
 * 获取心情统计
 */
function getMoodStats(req, res) {
  const userId = req.userId;
  const month = req.query.month;
  const result = museumService.getMoodStats(userId, month);
  return res.json(success(result));
}

/**
 * 分享博物馆内容（前端调用后触发分享任务）
 */
function shareItem(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM museum_items WHERE id = ? AND user_id = ?').get(id, userId);
  if (!item) return res.status(404).json(error('内容不存在', 404));

  taskService.updateTaskProgress(userId, 'share', 1);
  return res.json(success(null, '分享成功'));
}

module.exports = {
  getOverview,
  getTimeline,
  getItems,
  getItem,
  addItem,
  updateItem,
  deleteItem,
  confirmItem,
  discardItem,
  toggleFavorite,
  shareItem,
  saveMood,
  getMoods,
  getMoodStats
};
