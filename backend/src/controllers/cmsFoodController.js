/**
 * CMS 食品库管理（公共库 food_db）
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const CATEGORIES = [
  '主食类', '蔬菜水果类', '肉蛋奶类', '豆类坚果类',
  '零食饮料类', '中西菜肴类', '调味油脂类', '代餐特殊食品'
];

function getNextFoodId() {
  const row = db.prepare('SELECT MAX(food_id) as max_id FROM food_db').get();
  return (row.max_id || 0) + 1;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 列表
 */
function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;
  const keyword = req.query.keyword || '';
  const category = req.query.category || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (keyword) {
    where += ' AND food_name LIKE ?';
    params.push(`%${keyword}%`);
  }

  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM food_db ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT id, food_id, category, sub_category, food_name, calories_per_100g,
           common_unit, edible_rate, remark,
           protein_per_100g, carb_per_100g, fat_per_100g, created_at
    FROM food_db
    ${where}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size },
    categories: CATEGORIES
  }));
}

/**
 * 详情
 */
function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM food_db WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('食物不存在', 404));
  }
  return res.json(success(item));
}

function validateFood(body, isUpdate = false) {
  const { food_name, category, calories_per_100g } = body;
  if (!isUpdate && !food_name) return '食物名称不能为空';
  if (food_name !== undefined && !String(food_name).trim()) return '食物名称不能为空';
  if (category !== undefined && !category) return '分类不能为空';
  if (calories_per_100g !== undefined && toNumber(calories_per_100g) < 0) return '热量不能为负数';
  return null;
}

/**
 * 创建
 */
function create(req, res) {
  const err = validateFood(req.body);
  if (err) return res.status(400).json(error(err, 400));

  const {
    food_name, category, sub_category = '', calories_per_100g = 0,
    common_unit = '', edible_rate = 1.0, remark = '',
    protein_per_100g = 0, carb_per_100g = 0, fat_per_100g = 0
  } = req.body;

  const foodId = getNextFoodId();
  const id = db.prepare(`
    INSERT INTO food_db (
      food_id, category, sub_category, food_name, calories_per_100g,
      common_unit, edible_rate, remark,
      protein_per_100g, carb_per_100g, fat_per_100g
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    foodId,
    category,
    sub_category,
    String(food_name).trim(),
    toNumber(calories_per_100g),
    common_unit,
    toNumber(edible_rate, 1.0),
    remark,
    toNumber(protein_per_100g),
    toNumber(carb_per_100g),
    toNumber(fat_per_100g)
  ).lastInsertRowid;

  cmsLogService.log(req, 'food_lib:create', 'food', String(id), { food_id: foodId, food_name });
  return res.json(success({ id, food_id: foodId }, '创建成功'));
}

/**
 * 更新
 */
function update(req, res) {
  const { id } = req.params;
  const err = validateFood(req.body, true);
  if (err) return res.status(400).json(error(err, 400));

  const item = db.prepare('SELECT id FROM food_db WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('食物不存在', 404));

  const {
    food_name, category, sub_category, calories_per_100g,
    common_unit, edible_rate, remark,
    protein_per_100g, carb_per_100g, fat_per_100g
  } = req.body;

  db.prepare(`
    UPDATE food_db
    SET food_name = COALESCE(?, food_name),
        category = COALESCE(?, category),
        sub_category = COALESCE(?, sub_category),
        calories_per_100g = COALESCE(?, calories_per_100g),
        common_unit = COALESCE(?, common_unit),
        edible_rate = COALESCE(?, edible_rate),
        remark = COALESCE(?, remark),
        protein_per_100g = COALESCE(?, protein_per_100g),
        carb_per_100g = COALESCE(?, carb_per_100g),
        fat_per_100g = COALESCE(?, fat_per_100g)
    WHERE id = ?
  `).run(
    food_name !== undefined ? String(food_name).trim() : null,
    category,
    sub_category,
    calories_per_100g !== undefined ? toNumber(calories_per_100g) : null,
    common_unit,
    edible_rate !== undefined ? toNumber(edible_rate, 1.0) : null,
    remark,
    protein_per_100g !== undefined ? toNumber(protein_per_100g) : null,
    carb_per_100g !== undefined ? toNumber(carb_per_100g) : null,
    fat_per_100g !== undefined ? toNumber(fat_per_100g) : null,
    id
  );

  cmsLogService.log(req, 'food_lib:update', 'food', String(id), { food_name, category });
  return res.json(success(null, '更新成功'));
}

/**
 * 删除
 */
function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT food_name FROM food_db WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('食物不存在', 404));

  db.prepare('DELETE FROM food_db WHERE id = ?').run(id);
  cmsLogService.log(req, 'food_lib:delete', 'food', String(id), { food_name: item.food_name });
  return res.json(success(null, '删除成功'));
}

/**
 * 批量导入
 */
function batchImport(req, res) {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json(error('导入数据不能为空', 400));
  }

  const insert = db.prepare(`
    INSERT INTO food_db (
      food_id, category, sub_category, food_name, calories_per_100g,
      common_unit, edible_rate, remark,
      protein_per_100g, carb_per_100g, fat_per_100g
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = db.transaction(() => {
    let foodId = getNextFoodId();
    const ids = [];
    for (const item of items) {
      const name = String(item.food_name || '').trim();
      if (!name || !item.category) continue;
      const id = insert.run(
        foodId++,
        item.category,
        item.sub_category || '',
        name,
        toNumber(item.calories_per_100g),
        item.common_unit || '',
        toNumber(item.edible_rate, 1.0),
        item.remark || '',
        toNumber(item.protein_per_100g),
        toNumber(item.carb_per_100g),
        toNumber(item.fat_per_100g)
      ).lastInsertRowid;
      ids.push(id);
    }
    return ids;
  })();

  cmsLogService.log(req, 'food_lib:import', 'food', '', { count: result.length });
  return res.json(success({ imported_count: result.length }, `成功导入 ${result.length} 条`));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  batchImport
};
