/**
 * 方法库控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

/**
 * 获取方法列表
 */
function getMethods(req, res) {
  const userId = req.userId;
  const effectiveness = req.query.effectiveness !== undefined ? parseInt(req.query.effectiveness) : null;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  let sql = 'SELECT * FROM user_methods WHERE user_id = ? AND status = 1';
  const params = [userId];

  if (effectiveness !== null) {
    sql += ' AND effectiveness = ?';
    params.push(effectiveness);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM (${sql})`).get(...params).count;

  sql += ' ORDER BY effectiveness DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params).map(item => ({
    ...item,
    tags: item.tags ? JSON.parse(item.tags) : null
  }));

  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

/**
 * 添加方法
 */
function addMethod(req, res) {
  const userId = req.userId;
  const { title, content, category, effectiveness, tags } = req.body;

  if (!title) {
    return res.status(400).json(error('标题不能为空', 400));
  }

  const insertId = db.prepare(`
    INSERT INTO user_methods (user_id, title, content, category, effectiveness, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, title, content || null, category || null, effectiveness || 1, tags ? JSON.stringify(tags) : null).lastInsertRowid;

  return res.json(success({ id: insertId }, '添加成功'));
}

/**
 * 更新方法
 */
function updateMethod(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const { title, content, category, effectiveness, is_favorite, tags } = req.body;

  db.prepare(`
    UPDATE user_methods
    SET title = COALESCE(?, title),
        content = COALESCE(?, content),
        category = COALESCE(?, category),
        effectiveness = COALESCE(?, effectiveness),
        is_favorite = COALESCE(?, is_favorite),
        tags = COALESCE(?, tags),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(title, content, category, effectiveness, is_favorite, tags ? JSON.stringify(tags) : null, id, userId);

  return res.json(success(null, '更新成功'));
}

/**
 * 删除方法
 */
function deleteMethod(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM user_methods WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

module.exports = {
  getMethods,
  addMethod,
  updateMethod,
  deleteMethod
};
