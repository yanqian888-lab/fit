/**
 * CMS 陪你动课程库配置管理（workout_lib）
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const CATEGORIES = ['aerobic', 'stretch', 'strength'];

function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { category, keyword, status } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }

  if (status !== undefined && status !== '') {
    where += ' AND status = ?';
    params.push(status);
  }

  if (keyword) {
    where += ' AND (workout_key LIKE ? OR name LIKE ? OR description LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM workout_lib ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT * FROM workout_lib
    ${where}
    ORDER BY sort_order ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    categories: CATEGORIES,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM workout_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('课程不存在', 404));
  }
  return res.json(success(item));
}

function create(req, res) {
  const {
    workout_key, name, category = 'aerobic', video_url, cover_url,
    duration_seconds = 0, calorie_per_session = 0,
    duration_mode = 'sets', set_minutes = 0, sets_count = 1, rest_seconds = 0, calorie_per_hour = 0,
    required_item_id, exercise_id, description, sort_order = 0, status = 1
  } = req.body || {};

  if (!workout_key || !String(workout_key).trim()) {
    return res.status(400).json(error('课程 key 不能为空', 400));
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json(error('课程名称不能为空', 400));
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json(error('课程分类错误', 400));
  }
  if (!['unlimited', 'sets'].includes(duration_mode)) {
    return res.status(400).json(error('时长模式错误', 400));
  }
  if (duration_mode === 'sets' && (!set_minutes || set_minutes <= 0 || !sets_count || sets_count <= 0)) {
    return res.status(400).json(error('定时课程必须配置每组时长和组数', 400));
  }
  if (required_item_id) {
    const equip = db.prepare("SELECT id FROM shop_items WHERE id = ? AND category = 'equipment'").get(required_item_id);
    if (!equip) return res.status(400).json(error('所需器材必须是商店里的运动器材商品', 400));
  }
  if (exercise_id) {
    const ex = db.prepare('SELECT id FROM exercise_db WHERE id = ?').get(exercise_id);
    if (!ex) return res.status(400).json(error('关联运动必须是运动库里的运动', 400));
  }

  const existing = db.prepare('SELECT id FROM workout_lib WHERE workout_key = ?').get(workout_key);
  if (existing) {
    return res.status(400).json(error('课程 key 已存在', 400));
  }

  const id = db.prepare(`
    INSERT INTO workout_lib (workout_key, name, category, video_url, cover_url, duration_seconds, calorie_per_session, duration_mode, set_minutes, sets_count, rest_seconds, calorie_per_hour, required_item_id, exercise_id, description, sort_order, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(workout_key).trim(),
    String(name).trim(),
    category,
    video_url || null,
    cover_url || null,
    duration_seconds,
    calorie_per_session,
    duration_mode,
    duration_mode === 'sets' ? set_minutes : 0,
    duration_mode === 'sets' ? sets_count : 1,
    duration_mode === 'sets' ? rest_seconds : 0,
    calorie_per_hour,
    required_item_id || null,
    exercise_id || null,
    description || null,
    sort_order,
    status ? 1 : 0
  ).lastInsertRowid;

  cmsLogService.log(req, 'workout_config:create', 'workout', String(id), { workout_key, name, category });
  return res.json(success({ id }, '创建成功'));
}

function update(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const item = db.prepare('SELECT id FROM workout_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('课程不存在', 404));
  }

  const {
    workout_key, name, category, video_url, cover_url,
    duration_seconds, calorie_per_session,
    duration_mode, set_minutes, sets_count, rest_seconds, calorie_per_hour,
    required_item_id, exercise_id, description, sort_order, status
  } = body;

  if (category !== undefined && !CATEGORIES.includes(category)) {
    return res.status(400).json(error('课程分类错误', 400));
  }
  if (duration_mode !== undefined && !['unlimited', 'sets'].includes(duration_mode)) {
    return res.status(400).json(error('时长模式错误', 400));
  }
  // 定时模式校验（以前端提交后的有效值为准）
  const effectiveMode = duration_mode !== undefined ? duration_mode : item.duration_mode;
  if (effectiveMode === 'sets') {
    const sm = set_minutes !== undefined ? set_minutes : item.set_minutes;
    const sc = sets_count !== undefined ? sets_count : item.sets_count;
    if (!sm || sm <= 0 || !sc || sc <= 0) {
      return res.status(400).json(error('定时课程必须配置每组时长和组数', 400));
    }
  }
  // 不限时长模式不支持多组配置，强制归位
  const normalizeSets = effectiveMode === 'unlimited';
  if (required_item_id !== undefined && required_item_id !== null) {
    const equip = db.prepare("SELECT id FROM shop_items WHERE id = ? AND category = 'equipment'").get(required_item_id);
    if (!equip) return res.status(400).json(error('所需器材必须是商店里的运动器材商品', 400));
  }
  if (exercise_id !== undefined && exercise_id !== null) {
    const ex = db.prepare('SELECT id FROM exercise_db WHERE id = ?').get(exercise_id);
    if (!ex) return res.status(400).json(error('关联运动必须是运动库里的运动', 400));
  }
  if (workout_key !== undefined) {
    if (!String(workout_key).trim()) {
      return res.status(400).json(error('课程 key 不能为空', 400));
    }
    const existing = db.prepare('SELECT id FROM workout_lib WHERE workout_key = ? AND id != ?').get(workout_key, id);
    if (existing) {
      return res.status(400).json(error('课程 key 已存在', 400));
    }
  }

  db.prepare(`
    UPDATE workout_lib
    SET workout_key = COALESCE(?, workout_key),
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        video_url = COALESCE(?, video_url),
        cover_url = COALESCE(?, cover_url),
        duration_seconds = COALESCE(?, duration_seconds),
        calorie_per_session = COALESCE(?, calorie_per_session),
        duration_mode = COALESCE(?, duration_mode),
        set_minutes = COALESCE(?, set_minutes),
        sets_count = COALESCE(?, sets_count),
        rest_seconds = COALESCE(?, rest_seconds),
        calorie_per_hour = COALESCE(?, calorie_per_hour),
        required_item_id = CASE WHEN ? = 1 THEN ? ELSE required_item_id END,
        exercise_id = CASE WHEN ? = 1 THEN ? ELSE exercise_id END,
        description = COALESCE(?, description),
        sort_order = COALESCE(?, sort_order),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    workout_key !== undefined ? String(workout_key).trim() : null,
    name !== undefined ? String(name).trim() : null,
    category !== undefined ? category : null,
    video_url !== undefined ? video_url : null,
    cover_url !== undefined ? cover_url : null,
    duration_seconds !== undefined ? duration_seconds : null,
    calorie_per_session !== undefined ? calorie_per_session : null,
    duration_mode !== undefined ? duration_mode : null,
    normalizeSets ? 0 : (set_minutes !== undefined ? set_minutes : null),
    normalizeSets ? 1 : (sets_count !== undefined ? sets_count : null),
    normalizeSets ? 0 : (rest_seconds !== undefined ? rest_seconds : null),
    calorie_per_hour !== undefined ? calorie_per_hour : null,
    required_item_id !== undefined ? 1 : 0,
    required_item_id !== undefined ? required_item_id : null,
    exercise_id !== undefined ? 1 : 0,
    exercise_id !== undefined ? exercise_id : null,
    description !== undefined ? description : null,
    sort_order !== undefined ? sort_order : null,
    status !== undefined ? (status ? 1 : 0) : null,
    id
  );

  cmsLogService.log(req, 'workout_config:update', 'workout', String(id), { workout_key, name, category });
  return res.json(success(null, '更新成功'));
}

// 上下架
function toggleStatus(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id, status FROM workout_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('课程不存在', 404));
  }

  const next = item.status ? 0 : 1;
  db.prepare('UPDATE workout_lib SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, id);

  cmsLogService.log(req, 'workout_config:toggle', 'workout', String(id), { status: next });
  return res.json(success({ status: next }, next ? '已上架' : '已下架'));
}

function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id, workout_key FROM workout_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('课程不存在', 404));
  }

  db.prepare('DELETE FROM workout_lib WHERE id = ?').run(id);
  cmsLogService.log(req, 'workout_config:delete', 'workout', String(id), { workout_key: item.workout_key });
  return res.json(success(null, '删除成功'));
}

module.exports = {
  list,
  getById,
  create,
  update,
  toggleStatus,
  remove
};
