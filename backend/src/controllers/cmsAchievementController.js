/**
 * CMS 成就配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

// 成就分类定义（有序、分组），随 list 接口下发给管理端做下拉选项
const CATEGORIES = [
  { key: 'weight_loss', label: '减重', group: '体重管理' },
  { key: 'weight_goal', label: '达成目标体重', group: '体重管理' },
  { key: 'body', label: '身体指标变化', group: '体重管理' },
  { key: 'measure', label: '围度变化', group: '体重管理' },
  { key: 'exercise_count', label: '累计运动次数', group: '运动' },
  { key: 'exercise_duration', label: '累计运动时长', group: '运动' },
  { key: 'exercise_calorie', label: '累计运动消耗', group: '运动' },
  { key: 'diet_days', label: '饮食记录天数', group: '饮食习惯' },
  { key: 'habit', label: '习惯打卡', group: '饮食习惯' },
  { key: 'streak', label: '连续签到', group: '饮食习惯' },
  { key: 'chat', label: '对话轮数', group: '陪伴收集' },
  { key: 'duration', label: '坚持使用天数', group: '陪伴收集' },
  { key: 'event_collection', label: '事件收集', group: '陪伴收集' },
  { key: 'recipe_collection', label: '食谱收集', group: '陪伴收集' },
  { key: 'special', label: '特殊成就', group: '特殊' }
];

const CATEGORY_KEYS = CATEGORIES.map(c => c.key);

// 单阈值类分类：condition_json 为 { <key>: 正数 }
const THRESHOLD_CONDITION_KEYS = {
  weight_loss: 'weight_loss',
  streak: 'checkin_streak',
  duration: 'used_days',
  chat: 'chat_count',
  exercise_count: 'exercise_count',
  exercise_duration: 'exercise_duration',
  exercise_calorie: 'exercise_calorie',
  diet_days: 'diet_days',
  event_collection: 'event_count',
  recipe_collection: 'recipe_count'
};

const HABIT_TYPES = ['water', 'sleep', 'defecation', 'mood'];
const BODY_METRICS = ['weight', 'body_fat'];
const MEASURE_METRICS = ['waist', 'hip', 'chest', 'thigh', 'arm', 'calf'];
const SPECIAL_KEYS = ['first_fasting', 'fasting_streak_7', 'fasting_5_2_week'];

function isPositiveNumber(v) {
  return typeof v === 'number' && isFinite(v) && v > 0;
}

/**
 * 校验解锁条件与分类是否匹配，返回错误信息或 null。
 * condition 为 undefined 时不校验（部分更新场景）。
 */
function validateCondition(category, condition) {
  if (condition === undefined) return null;
  if (condition === null || typeof condition !== 'object' || Array.isArray(condition)) {
    return '解锁条件格式错误';
  }

  const thresholdKey = THRESHOLD_CONDITION_KEYS[category];
  if (thresholdKey) {
    if (!isPositiveNumber(condition[thresholdKey])) return '解锁条件的阈值必须是正数';
    return null;
  }
  if (category === 'weight_goal') return null; // 达成目标体重无需配置条件
  if (category === 'habit') {
    if (!HABIT_TYPES.includes(condition.habit_type)) return '习惯类型不合法';
    if (!isPositiveNumber(condition.streak_days)) return '习惯连续天数必须是正数';
    if (condition.goal !== undefined && !isPositiveNumber(condition.goal)) return '习惯目标必须是正数';
    return null;
  }
  if (category === 'body') {
    if (!BODY_METRICS.includes(condition.metric)) return '身体指标不合法';
    if (!isPositiveNumber(condition.decrease_pct) && !isPositiveNumber(condition.increase_pct)) {
      return '需配置降幅或增幅（%）';
    }
    return null;
  }
  if (category === 'measure') {
    if (!MEASURE_METRICS.includes(condition.metric)) return '围度指标不合法';
    if (!isPositiveNumber(condition.decrease_cm) && !isPositiveNumber(condition.increase_cm)) {
      return '需配置减少或增加（cm）';
    }
    return null;
  }
  if (category === 'special') {
    if (!SPECIAL_KEYS.includes(condition.key)) return '特殊标识不合法';
    return null;
  }
  return null;
}

// condition_json 在库中是 JSON 字符串，返回给前端前解析成对象
function parseCondition(row) {
  if (row && typeof row.condition_json === 'string') {
    try {
      row.condition_json = JSON.parse(row.condition_json) || {};
    } catch (e) {
      row.condition_json = {};
    }
  }
  return row;
}

function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { category, keyword, is_enabled } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }

  if (is_enabled !== undefined && is_enabled !== '') {
    where += ' AND is_enabled = ?';
    params.push(is_enabled);
  }

  if (keyword) {
    where += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM achievements ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT * FROM achievements
    ${where}
    ORDER BY sort_order ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset).map(parseCondition);

  return res.json(success({
    list,
    categories: CATEGORIES,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM achievements WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('成就不存在', 404));
  }
  return res.json(success(parseCondition(item)));
}

function create(req, res) {
  const {
    name, category = 'weight_loss', description, condition_json,
    reward_berries = 0, reward_flowers = 0,
    badge_icon, sort_order = 0, is_enabled = 1
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json(error('成就名称不能为空', 400));
  }
  if (!CATEGORY_KEYS.includes(category)) {
    return res.status(400).json(error('成就分类错误', 400));
  }
  const conditionError = validateCondition(category, condition_json || {});
  if (conditionError) {
    return res.status(400).json(error(conditionError, 400));
  }

  const id = db.prepare(`
    INSERT INTO achievements (name, category, description, condition_json, reward_berries, reward_flowers, badge_icon, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    category,
    description || null,
    condition_json ? JSON.stringify(condition_json) : '{}',
    reward_berries,
    reward_flowers,
    badge_icon || null,
    sort_order,
    is_enabled ? 1 : 0
  ).lastInsertRowid;

  cmsLogService.log(req, 'achievement_config:create', 'achievement', String(id), { name, category });
  return res.json(success({ id }, '创建成功'));
}

function update(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const item = db.prepare('SELECT id FROM achievements WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('成就不存在', 404));
  }

  const {
    name, category, description, condition_json,
    reward_berries, reward_flowers,
    badge_icon, sort_order, is_enabled
  } = body;

  if (category !== undefined && !CATEGORY_KEYS.includes(category)) {
    return res.status(400).json(error('成就分类错误', 400));
  }
  if (condition_json !== undefined) {
    // 条件校验以提交中的分类为准；未提交分类时按库中现有分类校验
    const effectiveCategory = category !== undefined
      ? category
      : db.prepare('SELECT category FROM achievements WHERE id = ?').get(id).category;
    const conditionError = validateCondition(effectiveCategory, condition_json);
    if (conditionError) {
      return res.status(400).json(error(conditionError, 400));
    }
  }

  db.prepare(`
    UPDATE achievements
    SET name = COALESCE(?, name),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        condition_json = COALESCE(?, condition_json),
        reward_berries = COALESCE(?, reward_berries),
        reward_flowers = COALESCE(?, reward_flowers),
        badge_icon = COALESCE(?, badge_icon),
        sort_order = COALESCE(?, sort_order),
        is_enabled = COALESCE(?, is_enabled)
    WHERE id = ?
  `).run(
    name !== undefined ? String(name).trim() : null,
    category !== undefined ? category : null,
    description !== undefined ? description : null,
    condition_json !== undefined ? JSON.stringify(condition_json) : null,
    reward_berries !== undefined ? reward_berries : null,
    reward_flowers !== undefined ? reward_flowers : null,
    badge_icon !== undefined ? badge_icon : null,
    sort_order !== undefined ? sort_order : null,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    id
  );

  cmsLogService.log(req, 'achievement_config:update', 'achievement', String(id), { name, category });
  return res.json(success(null, '更新成功'));
}

function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM achievements WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('成就不存在', 404));
  }

  db.prepare('DELETE FROM achievements WHERE id = ?').run(id);
  cmsLogService.log(req, 'achievement_config:delete', 'achievement', String(id), {});
  return res.json(success(null, '删除成功'));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  CATEGORIES
};
