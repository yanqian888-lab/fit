/**
 * 照片/对比墙控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const taskService = require('../services/taskService');

/**
 * 上传照片
 */
const VALID_ANGLES = ['front', 'side', 'back'];
const URL_REGEX = /^https?:\/\/.+/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function uploadPhoto(req, res) {
  const userId = req.userId;
  const { url, angle, weight, description, record_date } = req.body;

  if (!url || !URL_REGEX.test(url)) {
    return res.status(400).json(error('照片地址必须是有效的 http(s) URL', 400));
  }
  if (angle && !VALID_ANGLES.includes(angle)) {
    return res.status(400).json(error('角度参数不合法', 400));
  }
  const photoDate = record_date || new Date().toISOString().split('T')[0];
  if (!DATE_REGEX.test(photoDate)) {
    return res.status(400).json(error('记录日期格式不正确', 400));
  }
  const weightValue = weight !== undefined && weight !== null ? parseFloat(weight) : null;
  if (weightValue !== null && (isNaN(weightValue) || weightValue <= 0)) {
    return res.status(400).json(error('体重必须是有效数值', 400));
  }
  if (description && description.length > 500) {
    return res.status(400).json(error('描述不能超过 500 字', 400));
  }

  const insertId = db.prepare(`
    INSERT INTO photos (user_id, url, angle, weight, description, record_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, url, angle || 'front', weightValue, description || null, photoDate).lastInsertRowid;

  taskService.updateTaskProgress(userId, 'upload_photo', 1);

  return res.json(success({ id: insertId }, '上传成功'));
}

/**
 * 获取照片列表
 */
function getPhotos(req, res) {
  const userId = req.userId;
  const angle = req.query.angle || null;
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
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
