/**
 * CMS 操作日志查询
 */
const { db } = require('../db');
const { success } = require('../utils/response');

/**
 * 列表
 */
function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;
  const action = req.query.action || '';
  const targetType = req.query.target_type || '';
  const cmsUserId = req.query.cms_user_id || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (action) {
    where += ' AND l.action LIKE ?';
    params.push(`%${action}%`);
  }

  if (targetType) {
    where += ' AND l.target_type = ?';
    params.push(targetType);
  }

  if (cmsUserId) {
    where += ' AND l.cms_user_id = ?';
    params.push(cmsUserId);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM cms_logs l
    ${where}
  `).get(...params).count;

  const list = db.prepare(`
    SELECT
      l.*,
      u.username as cms_username,
      u.nickname as cms_nickname
    FROM cms_logs l
    LEFT JOIN cms_users u ON l.cms_user_id = u.id
    ${where}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset).map(item => ({
    ...item,
    detail: item.detail ? JSON.parse(item.detail) : null
  }));

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

module.exports = {
  list
};
