/**
 * CMS 反馈管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const STATUS_TEXT = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已处理'
};

/**
 * 列表
 */
function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const status = req.query.status || '';
  const type = req.query.type || '';
  const keyword = req.query.keyword || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (status) {
    where += ' AND f.status = ?';
    params.push(status);
  }

  if (type) {
    where += ' AND f.type = ?';
    params.push(type);
  }

  if (keyword) {
    where += ' AND (f.content LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)';
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    ${where}
  `).get(...params).count;

  const list = db.prepare(`
    SELECT
      f.*,
      u.nickname as user_nickname,
      u.phone as user_phone
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    ${where}
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset).map(item => ({
    ...item,
    images: item.images ? JSON.parse(item.images) : [],
    status_text: STATUS_TEXT[item.status] || item.status
  }));

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
  const item = db.prepare(`
    SELECT f.*, u.nickname as user_nickname, u.phone as user_phone
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE f.id = ?
  `).get(id);

  if (!item) {
    return res.status(404).json(error('反馈不存在', 404));
  }

  return res.json(success({
    ...item,
    images: item.images ? JSON.parse(item.images) : [],
    status_text: STATUS_TEXT[item.status] || item.status
  }));
}

/**
 * 回复
 */
function reply(req, res) {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply || !String(reply).trim()) {
    return res.status(400).json(error('回复内容不能为空', 400));
  }

  const feedback = db.prepare('SELECT id, status FROM feedback WHERE id = ?').get(id);
  if (!feedback) {
    return res.status(404).json(error('反馈不存在', 404));
  }

  db.prepare(`
    UPDATE feedback
    SET reply = ?, status = 'resolved', replied_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(String(reply).trim(), id);

  cmsLogService.log(req, 'feedback:reply', 'feedback', String(id), { old_status: feedback.status });
  return res.json(success(null, '回复成功'));
}

/**
 * 更新状态
 */
function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'processing', 'resolved'].includes(status)) {
    return res.status(400).json(error('状态无效', 400));
  }

  const feedback = db.prepare('SELECT id, status FROM feedback WHERE id = ?').get(id);
  if (!feedback) {
    return res.status(404).json(error('反馈不存在', 404));
  }

  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, id);

  cmsLogService.log(req, 'feedback:update_status', 'feedback', String(id), { old_status: feedback.status, new_status: status });
  return res.json(success(null, '状态更新成功'));
}

module.exports = {
  list,
  getById,
  reply,
  updateStatus
};
