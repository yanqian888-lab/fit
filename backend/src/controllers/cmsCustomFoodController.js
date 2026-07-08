/**
 * CMS 自定义食物审核管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const CATEGORIES = [
  '主食类', '蔬菜水果类', '肉蛋奶类', '豆类坚果类',
  '零食饮料类', '中西菜肴类', '调味油脂类', '代餐特殊食品'
];

/**
 * 列表（按审核状态筛选）
 */
function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;
  const keyword = req.query.keyword || '';
  const status = req.query.status || '';
  const category = req.query.category || '';

  let where = 'WHERE cf.is_public = 1';
  const params = [];

  if (status) {
    where += ' AND cf.status = ?';
    params.push(status);
  }
  if (category) {
    where += ' AND cf.category = ?';
    params.push(category);
  }
  if (keyword) {
    where += ' AND cf.name LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM custom_foods cf ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT cf.*, u.nickname as creator_name, u.phone as creator_phone
    FROM custom_foods cf
    LEFT JOIN users u ON cf.user_id = u.id
    ${where}
    ORDER BY cf.created_at DESC
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
  const item = db.prepare(`
    SELECT cf.*, u.nickname as creator_name, u.phone as creator_phone
    FROM custom_foods cf
    LEFT JOIN users u ON cf.user_id = u.id
    WHERE cf.id = ?
  `).get(id);
  if (!item) {
    return res.status(404).json(error('食物不存在', 404));
  }
  return res.json(success(item));
}

/**
 * 审核通过
 */
function approve(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT name, status FROM custom_foods WHERE id = ? AND is_public = 1').get(id);
  if (!item) {
    return res.status(404).json(error('食物不存在或不是公开食物', 404));
  }

  db.prepare("UPDATE custom_foods SET status = 'approved' WHERE id = ?").run(id);
  cmsLogService.log(req, 'custom_food:approve', 'custom_food', id, { name: item.name });
  return res.json(success(null, '已通过'));
}

/**
 * 审核拒绝（仅拒绝公开，仍保留为创建者私有）
 */
function reject(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT name, status FROM custom_foods WHERE id = ? AND is_public = 1').get(id);
  if (!item) {
    return res.status(404).json(error('食物不存在或不是公开食物', 404));
  }

  db.prepare("UPDATE custom_foods SET status = 'rejected' WHERE id = ?").run(id);
  cmsLogService.log(req, 'custom_food:reject', 'custom_food', id, { name: item.name });
  return res.json(success(null, '已拒绝，仅创建者可见'));
}

module.exports = {
  list,
  getById,
  approve,
  reject
};
