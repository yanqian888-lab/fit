/**
 * CMS 模板消息 / 搭子话术配置
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');
const { TEMPLATE_LIBRARY } = require('../services/templateMessageService');

const TEMPLATE_TYPES = ['breakfast', 'lunch', 'dinner', 'exercise', 'wakeup'];
const MODES = ['gentle', 'strict', 'tease'];

/**
 * 如果模板库为空，则从默认库初始化
 */
function ensureSeeded() {
  const count = db.prepare('SELECT COUNT(*) as count FROM template_configs').get().count;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO template_configs (template_type, mode, content, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, 1)
  `);

  let order = 0;
  for (const type of TEMPLATE_TYPES) {
    const modes = TEMPLATE_LIBRARY[type];
    if (!modes) continue;

    for (const mode of MODES) {
      const contents = modes[mode] || [];
      for (const content of contents) {
        insert.run(type, mode, content, order++);
      }
    }
  }
}

/**
 * 列表
 */
function list(req, res) {
  ensureSeeded();

  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { type, mode, keyword } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (type && TEMPLATE_TYPES.includes(type)) {
    where += ' AND template_type = ?';
    params.push(type);
  }

  if (mode && MODES.includes(mode)) {
    where += ' AND mode = ?';
    params.push(mode);
  }

  if (keyword) {
    where += ' AND content LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM template_configs ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT * FROM template_configs
    ${where}
    ORDER BY sort_order ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

/**
 * 详情
 */
function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM template_configs WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('模板不存在', 404));
  }
  return res.json(success(item));
}

/**
 * 创建
 */
function create(req, res) {
  const { template_type, mode, content, sort_order = 0, is_enabled = 1 } = req.body;

  if (!TEMPLATE_TYPES.includes(template_type)) {
    return res.status(400).json(error('无效的模板类型', 400));
  }
  if (!MODES.includes(mode)) {
    return res.status(400).json(error('无效的模式', 400));
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json(error('话术内容不能为空', 400));
  }

  const id = db.prepare(`
    INSERT INTO template_configs (template_type, mode, content, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?)
  `).run(template_type, mode, String(content).trim(), sort_order, is_enabled ? 1 : 0).lastInsertRowid;

  cmsLogService.log(req, 'template_config:create', 'template_config', String(id), { template_type, mode });
  return res.json(success({ id }, '创建成功'));
}

/**
 * 更新
 */
function update(req, res) {
  const { id } = req.params;
  const { template_type, mode, content, sort_order, is_enabled } = req.body;

  const item = db.prepare('SELECT id FROM template_configs WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('模板不存在', 404));
  }

  if (template_type !== undefined && !TEMPLATE_TYPES.includes(template_type)) {
    return res.status(400).json(error('无效的模板类型', 400));
  }
  if (mode !== undefined && !MODES.includes(mode)) {
    return res.status(400).json(error('无效的模式', 400));
  }
  if (content !== undefined && !String(content).trim()) {
    return res.status(400).json(error('话术内容不能为空', 400));
  }

  db.prepare(`
    UPDATE template_configs
    SET template_type = COALESCE(?, template_type),
        mode = COALESCE(?, mode),
        content = COALESCE(?, content),
        sort_order = COALESCE(?, sort_order),
        is_enabled = COALESCE(?, is_enabled),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    template_type,
    mode,
    content !== undefined ? String(content).trim() : null,
    sort_order !== undefined ? sort_order : null,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    id
  );

  cmsLogService.log(req, 'template_config:update', 'template_config', String(id), { template_type, mode });
  return res.json(success(null, '更新成功'));
}

/**
 * 删除
 */
function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM template_configs WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('模板不存在', 404));
  }

  db.prepare('DELETE FROM template_configs WHERE id = ?').run(id);
  cmsLogService.log(req, 'template_config:delete', 'template_config', String(id), {});
  return res.json(success(null, '删除成功'));
}

/**
 * 重置为默认库
 */
function seed(req, res) {
  db.prepare('DELETE FROM template_configs').run();
  ensureSeeded();
  cmsLogService.log(req, 'template_config:seed', 'template_config', '', {});
  return res.json(success(null, '已重置为默认模板'));
}

/**
 * 类型与模式枚举
 */
function getTypes(req, res) {
  return res.json(success({
    types: TEMPLATE_TYPES,
    modes: MODES
  }));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  seed,
  getTypes
};
