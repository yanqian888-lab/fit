/**
 * CMS C 端用户管理
 */
const { db } = require('../db');
const bcrypt = require('bcryptjs');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');
const { createUserWithInit } = require('./authController');
const { deleteUserLocalFiles } = require('../utils/deleteUserFiles');

const GENDER_MAP = { 0: '未知', 1: '男', 2: '女' };
const MODE_MAP = { gentle: '温柔', strict: '严格', tease: '毒舌' };
const SOURCE_MAP = { app: 'App注册', cms: '后台创建' };
const USERNAME_REGEX = /^[a-zA-Z0-9]{6}$/;
function validateUsernameCombo(username) {
  return USERNAME_REGEX.test(username) && /[a-zA-Z]/.test(username) && /[0-9]/.test(username);
}

/**
 * 列表
 */
function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;
  const keyword = req.query.keyword || '';
  const status = req.query.status;

  let where = 'WHERE 1=1';
  const params = [];

  if (keyword) {
    where += ' AND (u.nickname LIKE ? OR u.phone LIKE ? OR u.username LIKE ? OR u.user_id LIKE ?)';
    const like = `%${keyword}%`;
    params.push(like, like, like, like);
  }

  if (status !== undefined && status !== '') {
    where += ' AND u.status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM users u ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT
      u.id, u.user_id, u.openid, u.username, u.plain_password, u.nickname, u.avatar_url, u.phone,
      u.gender, u.age, u.birth_date, u.height, u.role, u.status, u.source,
      u.created_at, u.last_login_at,
      p.initial_weight, p.current_weight, p.target_weight,
      pt.name as partner_name, pt.mode as partner_mode
    FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    LEFT JOIN partners pt ON u.id = pt.user_id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset).map(item => {
    const bmi = item.height && item.current_weight
      ? (item.current_weight / Math.pow(item.height / 100, 2)).toFixed(1)
      : null;
    return {
      ...item,
      gender_text: GENDER_MAP[item.gender] || '未知',
      mode_text: MODE_MAP[item.partner_mode] || item.partner_mode || '-',
      source_text: SOURCE_MAP[item.source] || item.source || '-',
      bmi
    };
  });

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

/**
 * 后台创建 C 端用户（与 App 注册校验规则一致）
 */
function create(req, res) {
  const { username, password, phone, nickname } = req.body || {};

  if (!USERNAME_REGEX.test(username || '')) {
    return res.status(400).json(error('请输入6位字母+数字账号', 400));
  }
  if (!validateUsernameCombo(username)) {
    return res.status(400).json(error('账号需同时包含字母和数字', 400));
  }
  if (!password || password.length !== 6) {
    return res.status(400).json(error('请输入6位密码', 400));
  }
  if (!phone || phone.length !== 11) {
    return res.status(400).json(error('请输入11位手机号', 400));
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(409).json(error('该账号已被注册', 409));
  }
  const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existingPhone) {
    return res.status(409).json(error('该手机号已被绑定', 409));
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUserWithInit(username, passwordHash, phone, nickname || '减肥搭子用户', 'cms', password);


  cmsLogService.log(req, 'create', 'app_user', String(user.id), `后台创建C端用户：${username}`);

  return res.json(success({ id: user.id }, '用户创建成功'));
}

/**
 * 详情
 */
function getById(req, res) {
  const { id } = req.params;
  const user = db.prepare(`
    SELECT
      u.id, u.user_id, u.openid, u.username, u.nickname, u.avatar_url, u.phone,
      u.gender, u.age, u.birth_date, u.height, u.role, u.status,
      u.created_at, u.last_login_at,
      p.*,
      pt.name as partner_name, pt.mode as partner_mode, pt.gender as partner_gender,
      pt.voice_speed, pt.strictness, pt.humor
    FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    LEFT JOIN partners pt ON u.id = pt.user_id
    WHERE u.id = ?
  `).get(id);

  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  return res.json(success({
    ...user,
    gender_text: GENDER_MAP[user.gender] || '未知'
  }));
}

/**
 * 更新状态（启用/禁用）
 */
function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (![0, 1].includes(status)) {
    return res.status(400).json(error('状态无效', 400));
  }

  const user = db.prepare('SELECT id, status, role FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

  cmsLogService.log(req, 'app_user:update_status', 'app_user', String(id), { old_status: user.status, new_status: status });
  return res.json(success(null, status === 1 ? '已启用' : '已禁用'));
}

/**
 * 后台注销 C 端用户（物理删除，级联清理业务数据）
 */
function deleteUser(req, res) {
  const { id } = req.params;

  const user = db.prepare('SELECT id, username, phone, openid FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  try {
    db.prepare(`
      INSERT INTO deleted_users (original_user_id, username, phone, openid, reason, deleted_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(user.id, user.username || null, user.phone || null, user.openid || null, '后台管理员注销');

    // 删除用户上传的本地文件（头像、反馈配图等）
    deleteUserLocalFiles(id);

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    cmsLogService.log(req, 'delete', 'app_user', String(id), `后台注销C端用户：${user.username}`);
    return res.json(success(null, '账号已注销'));
  } catch (err) {
    console.error('后台注销用户失败:', err.message);
    return res.status(500).json(error('注销失败，请稍后重试', 500));
  }
}

/**
 * 最近记录概览（可选）
 */
function getRecordsOverview(req, res) {
  const { id } = req.params;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  const dietCount = db.prepare('SELECT COUNT(*) as count FROM diet_records WHERE user_id = ?').get(id).count;
  const exerciseCount = db.prepare('SELECT COUNT(*) as count FROM exercise_records WHERE user_id = ?').get(id).count;
  const bodyCount = db.prepare('SELECT COUNT(*) as count FROM body_records WHERE user_id = ?').get(id).count;
  const habitCount = db.prepare('SELECT COUNT(*) as count FROM habit_records WHERE user_id = ?').get(id).count;
  const chatCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ?').get(id).count;
  const feedbackCount = db.prepare('SELECT COUNT(*) as count FROM feedback WHERE user_id = ?').get(id).count;

  const latestRecordDate = db.prepare(`
    SELECT MAX(record_date) as date FROM (
      SELECT record_date FROM diet_records WHERE user_id = ?
      UNION ALL
      SELECT record_date FROM exercise_records WHERE user_id = ?
      UNION ALL
      SELECT record_date FROM body_records WHERE user_id = ?
      UNION ALL
      SELECT record_date FROM habit_records WHERE user_id = ?
    )
  `).get(id, id, id, id).date;

  return res.json(success({
    counts: {
      diet: dietCount,
      exercise: exerciseCount,
      body: bodyCount,
      habit: habitCount,
      chat: chatCount,
      feedback: feedbackCount
    },
    latest_record_date: latestRecordDate
  }));
}

module.exports = {
  list,
  create,
  getById,
  updateStatus,
  deleteUser,
  getRecordsOverview
};
