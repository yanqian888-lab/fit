/**
 * 系统数据控制器
 */
const { db } = require('../db');
const { success } = require('../utils/response');

/**
 * 获取食物数据库
 */
function getFoods(req, res) {
  const keyword = req.query.keyword || '';
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  let sql = 'SELECT * FROM food_db WHERE 1=1';
  const params = [];

  if (keyword) {
    sql += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }

  sql += ' ORDER BY is_common DESC, name ASC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params);
  return res.json(success({ list, pagination: { page, size, has_more: list.length === size } }));
}

/**
 * 获取运动数据库
 */
function getExercises(req, res) {
  const keyword = req.query.keyword || '';
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  let sql = 'SELECT * FROM exercise_db WHERE 1=1';
  const params = [];

  if (keyword) {
    sql += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }

  sql += ' ORDER BY is_common DESC, name ASC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params);
  return res.json(success({ list, pagination: { page, size, has_more: list.length === size } }));
}

/**
 * 获取用户设置
 */
function getSettings(req, res) {
  const userId = req.userId;
  let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);

  if (!settings) {
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
    settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  }

  return res.json(success(settings));
}

/**
 * 更新用户设置
 */
function updateSettings(req, res) {
  const userId = req.userId;
  const fields = [
    'notification_enabled', 'reminder_weight', 'reminder_water', 'reminder_exercise',
    'dnd_start', 'dnd_end', 'theme', 'font_size', 'data_storage', 'cloud_backup_enabled', 'guide_completed'
  ];

  const sets = [];
  const values = [];

  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  });

  if (sets.length === 0) {
    return res.json(success(null, '无更新'));
  }

  values.push(userId);
  db.prepare(`UPDATE settings SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(...values);
  return res.json(success(null, '设置更新成功'));
}

module.exports = {
  getFoods,
  getExercises,
  getSettings,
  updateSettings
};
