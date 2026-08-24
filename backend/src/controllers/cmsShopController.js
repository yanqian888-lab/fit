/**
 * CMS 商城商品配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

// 内置分类与数据库已有分类取并集，确保新分类（如道具 prop）在无任何商品时也可选
const DEFAULT_CATEGORIES = ['food', 'equipment', 'prop', 'skin'];

function getCategories() {
  const rows = db.prepare('SELECT DISTINCT category FROM shop_items WHERE category IS NOT NULL AND category != \'\' ORDER BY category ASC').all();
  return [...new Set([...DEFAULT_CATEGORIES, ...rows.map(r => r.category)])];
}

function normalizeStatus(status) {
  if (status === 'enabled' || status === true || status === 1 || status === '1') return 1;
  if (status === 'disabled' || status === false || status === 0 || status === '0') return 0;
  return status ? 1 : 0;
}

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
    where += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM shop_items ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT * FROM shop_items
    ${where}
    ORDER BY sort_order ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    categories: getCategories(),
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('商品不存在', 404));
  }
  return res.json(success(item));
}

function create(req, res) {
  const {
    category, name, description, icon_url,
    price_berries = 0, price_flowers = 0, stock = -1,
    item_type, effect_json, unlock_condition, duration_seconds,
    sort_order = 0, status = 1
  } = req.body;

  if (!category || !String(category).trim()) {
    return res.status(400).json(error('商品分类不能为空', 400));
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json(error('商品名称不能为空', 400));
  }

  const id = db.prepare(`
    INSERT INTO shop_items (category, name, description, icon_url, price_berries, price_flowers, stock, item_type, effect_json, unlock_condition, duration_seconds, sort_order, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category,
    String(name).trim(),
    description || null,
    icon_url || null,
    price_berries,
    price_flowers,
    stock,
    item_type || null,
    effect_json ? JSON.stringify(effect_json) : '{}',
    unlock_condition || null,
    duration_seconds || null,
    sort_order,
    normalizeStatus(status)
  ).lastInsertRowid;

  cmsLogService.log(req, 'shop_config:create', 'shop_item', String(id), { category, name });
  return res.json(success({ id }, '创建成功'));
}

function update(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const item = db.prepare('SELECT id FROM shop_items WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('商品不存在', 404));
  }

  const {
    category, name, description, icon_url,
    price_berries, price_flowers, stock,
    item_type, effect_json, unlock_condition, duration_seconds,
    sort_order, status
  } = body;

  if (category !== undefined && !String(category).trim()) {
    return res.status(400).json(error('商品分类不能为空', 400));
  }

  db.prepare(`
    UPDATE shop_items
    SET category = COALESCE(?, category),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon_url = COALESCE(?, icon_url),
        price_berries = COALESCE(?, price_berries),
        price_flowers = COALESCE(?, price_flowers),
        stock = COALESCE(?, stock),
        item_type = COALESCE(?, item_type),
        effect_json = COALESCE(?, effect_json),
        unlock_condition = COALESCE(?, unlock_condition),
        duration_seconds = COALESCE(?, duration_seconds),
        sort_order = COALESCE(?, sort_order),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    category !== undefined ? category : null,
    name !== undefined ? String(name).trim() : null,
    description !== undefined ? description : null,
    icon_url !== undefined ? icon_url : null,
    price_berries !== undefined ? price_berries : null,
    price_flowers !== undefined ? price_flowers : null,
    stock !== undefined ? stock : null,
    item_type !== undefined ? item_type : null,
    effect_json !== undefined ? JSON.stringify(effect_json) : null,
    unlock_condition !== undefined ? unlock_condition : null,
    duration_seconds !== undefined ? duration_seconds : null,
    sort_order !== undefined ? sort_order : null,
    status !== undefined ? normalizeStatus(status) : null,
    id
  );

  cmsLogService.log(req, 'shop_config:update', 'shop_item', String(id), { category, name });
  return res.json(success(null, '更新成功'));
}

function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM shop_items WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('商品不存在', 404));
  }

  db.prepare('DELETE FROM shop_items WHERE id = ?').run(id);
  cmsLogService.log(req, 'shop_config:delete', 'shop_item', String(id), {});
  return res.json(success(null, '删除成功'));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
