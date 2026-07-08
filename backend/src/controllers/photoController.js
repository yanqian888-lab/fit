/**
 * 照片/对比墙控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

/**
 * 上传照片
 */
function uploadPhoto(req, res) {
  const userId = req.userId;
  const { url, angle, weight, description, record_date } = req.body;

  if (!url) {
    return res.status(400).json(error('照片地址不能为空', 400));
  }

  const insertId = db.prepare(`
    INSERT INTO photos (user_id, url, angle, weight, description, record_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, url, angle || 'front', weight || null, description || null, record_date || new Date().toISOString().split('T')[0]).lastInsertRowid;

  return res.json(success({ id: insertId }, '上传成功'));
}

/**
 * 获取照片列表
 */
function getPhotos(req, res) {
  const userId = req.userId;
  const angle = req.query.angle || null;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  let sql = 'SELECT * FROM photos WHERE user_id = ?';
  const params = [userId];

  if (angle) {
    sql += ' AND angle = ?';
    params.push(angle);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM (${sql})`).get(...params).count;

  sql += ' ORDER BY record_date DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params);
  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

/**
 * 删除照片
 */
function deletePhoto(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM photos WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

module.exports = {
  uploadPhoto,
  getPhotos,
  deletePhoto
};
