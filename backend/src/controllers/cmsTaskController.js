/**
 * CMS 任务配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const TYPES = ['daily', 'weekly', 'once'];

function normalizeStatus(status) {
  if (status === 'enabled' || status === true || status === 1 || status === '1') return 1;
  if (status === 'disabled' || status === false || status === 0 || status === '0') return 0;
  return status ? 1 : 0;
}

function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { type, keyword, status } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (type) {
    where += ' AND type = ?';
    params.push(type);
  }

  if (status !== undefined && status !== '') {
    where += ' AND status = ?';
    params.push(status);
  }

  if (keyword) {
    where += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM tasks ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT * FROM tasks
    ${where}
    ORDER BY sort_order ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    types: TYPES,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('任务不存在', 404));
  }
  return res.json(success(item));
}

function create(req, res) {
  const {
    name, type = 'daily', description, condition_json,
    reward_berries = 0, reward_flowers = 0,
    jump_page, sort_order = 0, status = 1
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json(error('任务名称不能为空', 400));
  }
  if (!TYPES.includes(type)) {
    return res.status(400).json(error('任务类型错误', 400));
  }

  const id = db.prepare(`
    INSERT INTO tasks (name, type, description, condition_json, reward_berries, reward_flowers, jump_page, sort_order, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    type,
    description || null,
    condition_json ? JSON.stringify(condition_json) : '{}',
    reward_berries,
    reward_flowers,
    jump_page || null,
    sort_order,
    normalizeStatus(status)
  ).lastInsertRowid;

  cmsLogService.log(req, 'task_config:create', 'task', String(id), { name, type });
  return res.json(success({ id }, '创建成功'));
}

function update(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const item = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('任务不存在', 404));
  }

  const {
    name, type, description, condition_json,
    reward_berries, reward_flowers,
    jump_page, sort_order, status
  } = body;

  if (type !== undefined && !TYPES.includes(type)) {
    return res.status(400).json(error('任务类型错误', 400));
  }

  db.prepare(`
    UPDATE tasks
    SET name = COALESCE(?, name),
        type = COALESCE(?, type),
        description = COALESCE(?, description),
        condition_json = COALESCE(?, condition_json),
        reward_berries = COALESCE(?, reward_berries),
        reward_flowers = COALESCE(?, reward_flowers),
        jump_page = COALESCE(?, jump_page),
        sort_order = COALESCE(?, sort_order),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name !== undefined ? String(name).trim() : null,
    type !== undefined ? type : null,
    description !== undefined ? description : null,
    condition_json !== undefined ? JSON.stringify(condition_json) : null,
    reward_berries !== undefined ? reward_berries : null,
    reward_flowers !== undefined ? reward_flowers : null,
    jump_page !== undefined ? jump_page : null,
    sort_order !== undefined ? sort_order : null,
    status !== undefined ? normalizeStatus(status) : null,
    id
  );

  cmsLogService.log(req, 'task_config:update', 'task', String(id), { name, type });
  return res.json(success(null, '更新成功'));
}

function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('任务不存在', 404));
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  cmsLogService.log(req, 'task_config:delete', 'task', String(id), {});
  return res.json(success(null, '删除成功'));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
