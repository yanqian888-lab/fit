/**
 * CMS 运动库管理（公共库 exercise_db）
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const CATEGORIES = ['有氧运动', '力量训练', '球类运动', '日常活动', '其他'];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 列表
 */
function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const keyword = req.query.keyword || '';
  const category = req.query.category || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (keyword) {
    where += ' AND exercise_name LIKE ?';
    params.push(`%${keyword}%`);
  }

  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM exercise_db ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT id, exercise_name, category, sub_category, intensity_desc,
           met_value, calorie_per_hour, remark, created_at
    FROM exercise_db
    ${where}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  // 分类与子分类映射从实际数据聚合（子分类下拉随分类联动）
  const catRows = db.prepare(`
    SELECT DISTINCT category, sub_category FROM exercise_db
    WHERE category IS NOT NULL AND category != ''
    ORDER BY category ASC, sub_category ASC
  `).all();
  const subCategoryMap = {};
  for (const r of catRows) {
    if (!subCategoryMap[r.category]) subCategoryMap[r.category] = [];
    if (r.sub_category) subCategoryMap[r.category].push(r.sub_category);
  }
  const categories = Object.keys(subCategoryMap);
  // 库里还没有任何运动时，回退到内置默认分类
  const finalCategories = categories.length > 0 ? categories : CATEGORIES;

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size },
    categories: finalCategories,
    subCategories: subCategoryMap
  }));
}

/**
 * 详情
 */
function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM exercise_db WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('运动不存在', 404));
  }
  return res.json(success(item));
}

function validateExercise(body, isUpdate = false) {
  const { exercise_name, category } = body;
  if (!isUpdate && !exercise_name) return '运动名称不能为空';
  if (exercise_name !== undefined && !String(exercise_name).trim()) return '运动名称不能为空';
  if (category !== undefined && !category) return '分类不能为空';
  return null;
}

/**
 * 创建
 */
function create(req, res) {
  const err = validateExercise(req.body);
  if (err) return res.status(400).json(error(err, 400));

  const {
    exercise_name, category, sub_category = '', intensity_desc = '',
    met_value = 0, calorie_per_hour = 0, remark = ''
  } = req.body;

  const id = db.prepare(`
    INSERT INTO exercise_db (exercise_name, category, sub_category, intensity_desc, met_value, calorie_per_hour, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(exercise_name).trim(),
    category,
    sub_category,
    intensity_desc,
    toNumber(met_value),
    toNumber(calorie_per_hour),
    remark
  ).lastInsertRowid;

  cmsLogService.log(req, 'exercise_lib:create', 'exercise', String(id), { exercise_name, category });
  return res.json(success({ id }, '创建成功'));
}

/**
 * 更新
 */
function update(req, res) {
  const { id } = req.params;
  const err = validateExercise(req.body, true);
  if (err) return res.status(400).json(error(err, 400));

  const item = db.prepare('SELECT id FROM exercise_db WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('运动不存在', 404));

  const {
    exercise_name, category, sub_category, intensity_desc,
    met_value, calorie_per_hour, remark
  } = req.body;

  db.prepare(`
    UPDATE exercise_db
    SET exercise_name = COALESCE(?, exercise_name),
        category = COALESCE(?, category),
        sub_category = COALESCE(?, sub_category),
        intensity_desc = COALESCE(?, intensity_desc),
        met_value = COALESCE(?, met_value),
        calorie_per_hour = COALESCE(?, calorie_per_hour),
        remark = COALESCE(?, remark)
    WHERE id = ?
  `).run(
    exercise_name !== undefined ? String(exercise_name).trim() : null,
    category,
    sub_category,
    intensity_desc,
    met_value !== undefined ? toNumber(met_value) : null,
    calorie_per_hour !== undefined ? toNumber(calorie_per_hour) : null,
    remark,
    id
  );

  cmsLogService.log(req, 'exercise_lib:update', 'exercise', String(id), { exercise_name, category });
  return res.json(success(null, '更新成功'));
}

/**
 * 删除
 */
function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT exercise_name FROM exercise_db WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('运动不存在', 404));

  db.prepare('DELETE FROM exercise_db WHERE id = ?').run(id);
  cmsLogService.log(req, 'exercise_lib:delete', 'exercise', String(id), { exercise_name: item.exercise_name });
  return res.json(success(null, '删除成功'));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
