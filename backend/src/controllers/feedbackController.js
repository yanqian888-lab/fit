/**
 * 反馈控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

function parseImages(images) {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * 提交反馈
 */
function createFeedback(req, res) {
  const userId = req.userId;
  const { type, content, images, contact, score } = req.body;

  if (!content) {
    return res.status(400).json(error('反馈内容不能为空', 400));
  }

  const insertId = db.prepare(`
    INSERT INTO feedback (user_id, type, content, images, contact, score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, type || 'other', content, images ? JSON.stringify(images) : null, contact || null, score || null).lastInsertRowid;

  return res.json(success({ id: insertId }, '提交成功'));
}

/**
 * 获取反馈历史（用户端）
 */
function getFeedbacks(req, res) {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  const list = db.prepare(`
    SELECT id, type, content, images, status, score, reply, replied_at, created_at
    FROM feedback
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, size, offset).map(item => ({
    ...item,
    images: parseImages(item.images),
    status_text: item.status === 'resolved' ? '已处理' : item.status === 'processing' ? '处理中' : '待处理',
    has_reply: !!item.reply
  }));

  const total = db.prepare('SELECT COUNT(*) as count FROM feedback WHERE user_id = ?').get(userId).count;

  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

/**
 * 获取所有反馈（管理后台）
 */
function getAllFeedbacks(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;
  const status = req.query.status || '';

  let sql = `
    SELECT f.*, u.nickname, u.phone
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND f.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params);

  const countSql = `
    SELECT COUNT(*) as count FROM feedback f WHERE 1=1
    ${status ? ' AND f.status = ?' : ''}
  `;
  const total = db.prepare(countSql).get(...(status ? [status] : [])).count;

  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

/**
 * 回复反馈
 */
function replyFeedback(req, res) {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply || !reply.trim()) {
    return res.status(400).json(error('回复内容不能为空', 400));
  }

  const feedback = db.prepare('SELECT id FROM feedback WHERE id = ?').get(id);
  if (!feedback) {
    return res.status(404).json(error('反馈不存在', 404));
  }

  db.prepare(`
    UPDATE feedback 
    SET reply = ?, status = 'resolved', replied_at = datetime('now') 
    WHERE id = ?
  `).run(reply.trim(), id);

  return res.json(success({ id }, '回复成功'));
}

/**
 * 更新反馈状态
 */
function updateFeedbackStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'processing', 'resolved'].includes(status)) {
    return res.status(400).json(error('状态无效', 400));
  }

  const feedback = db.prepare('SELECT id FROM feedback WHERE id = ?').get(id);
  if (!feedback) {
    return res.status(404).json(error('反馈不存在', 404));
  }

  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, id);

  return res.json(success({ id }, '状态更新成功'));
}

module.exports = {
  createFeedback,
  getFeedbacks,
  getAllFeedbacks,
  replyFeedback,
  updateFeedbackStatus
};
