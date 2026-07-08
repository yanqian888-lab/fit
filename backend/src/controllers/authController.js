/**
 * 认证控制器
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { db } = require('../db');
const { success, error } = require('../utils/response');
const trialService = require('../services/trialService');

// 用户账号：6位字母+数字组合
const USERNAME_REGEX = /^[a-zA-Z0-9]{6}$/;

function validateUsername(username) {
  return USERNAME_REGEX.test(username);
}

function validateUsernameCombo(username) {
  return validateUsername(username) && /[a-zA-Z]/.test(username) && /[0-9]/.test(username);
}

function generateUserId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  while (true) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!/[a-zA-Z]/.test(code) || !/[0-9]/.test(code)) continue;
    const exists = db.prepare('SELECT 1 FROM users WHERE user_id = ?').get(code);
    if (!exists) return code;
  }
}

/**
 * 创建用户并初始化相关数据
 */
function createUserWithInit(username, passwordHash, phone, nickname, source = 'app', plainPassword = '') {
  const userIdCode = generateUserId();
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, plain_password, phone, nickname, source, user_id, created_at, updated_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  const userId = insertUser.run(username, passwordHash, plainPassword || '', phone, nickname, source, userIdCode).lastInsertRowid;

  // 初始化用户资料
  db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);

  // 初始化搭子
  db.prepare(`
    INSERT INTO partners (user_id, name, mode, status, status_text)
    VALUES (?, '你的搭子', 'gentle', 'awake', '刚刚起床')
  `).run(userId);

  // 初始化设置
  db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

/**
 * 生成 JWT Token
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role || 'user' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * 账号密码登录
 */
function login(req, res) {
  const { username, password, device_id } = req.body;

  if (!validateUsername(username)) {
    return res.status(400).json(error('请输入6位字母+数字账号', 400));
  }
  if (!password || password.length !== 6) {
    return res.status(400).json(error('请输入6位密码', 400));
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json(error('账号或密码错误', 401));
  }

  // 验证密码
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json(error('账号或密码错误', 401));
  }

  // 更新登录时间
  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = generateToken(user);

  // 合并游客设备试用次数
  if (device_id) {
    trialService.mergeDeviceCountToUser(user.id, device_id);
  }

  return res.json(success({
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      phone: user.phone,
      role: user.role || 'user'
    }
  }));
}

/**
 * 账号注册
 */
function register(req, res) {
  const { username, password, phone, device_id } = req.body;

  if (!validateUsername(username)) {
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

  // 检查账号是否已存在
  const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(409).json(error('该账号已被注册', 409));
  }

  // 检查手机号是否已存在
  const existingPhone = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (existingPhone) {
    return res.status(409).json(error('该手机号已被绑定', 409));
  }

  // 密码加密
  const passwordHash = bcrypt.hashSync(password, 10);

  // 创建用户
  const user = createUserWithInit(username, passwordHash, phone, '减肥搭子用户', 'app', password);
  const token = generateToken(user);

  // 合并游客设备试用次数
  if (device_id) {
    trialService.mergeDeviceCountToUser(user.id, device_id);
  }

  return res.json(success({
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      phone: user.phone,
      role: user.role || 'user'
    }
  }));
}

/**
 * 微信小程序登录
 */
function wechatLogin(req, res) {
  const { code, device_id } = req.body;
  if (!code) {
    return res.status(400).json(error('缺少微信登录 code', 400));
  }

  // 模拟根据 code 生成 openid
  const openid = `mock_openid_${code}`;

  let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
  let isNewUser = false;

  if (!user) {
    // 创建新用户（未绑定手机号）
    const userIdCode = generateUserId();
    const insertUser = db.prepare(`
      INSERT INTO users (openid, nickname, user_id, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const userId = insertUser.run(openid, '减肥搭子用户', userIdCode).lastInsertRowid;

    // 初始化用户资料
    db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);

    // 初始化搭子
    db.prepare(`
      INSERT INTO partners (user_id, name, mode, status, status_text)
      VALUES (?, '你的搭子', 'gentle', 'awake', '刚刚起床')
    `).run(userId);

    // 初始化设置
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    isNewUser = true;
  } else {
    // 更新登录时间
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  }

  // 检查是否需要绑定手机号
  const needBindPhone = !user.phone;

  const token = generateToken(user);

  // 合并游客设备试用次数
  if (device_id) {
    trialService.mergeDeviceCountToUser(user.id, device_id);
  }

  return res.json(success({
    token,
    need_bind_phone: needBindPhone,
    is_new_user: isNewUser,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      phone: user.phone,
      role: user.role || 'user'
    }
  }));
}

/**
 * 微信登录后绑定手机号
 */
function wechatBindPhone(req, res) {
  const { code, phone, device_id } = req.body;

  if (!code) {
    return res.status(400).json(error('缺少微信登录 code', 400));
  }
  if (!phone || phone.length !== 11) {
    return res.status(400).json(error('请输入11位手机号', 400));
  }

  const openid = `mock_openid_${code}`;
  const user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);

  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  // 检查手机号是否已被其他用户绑定
  const existingPhone = db.prepare('SELECT * FROM users WHERE phone = ? AND id != ?').get(phone, user.id);
  if (existingPhone) {
    return res.status(409).json(error('该手机号已被绑定', 409));
  }

  // 更新手机号
  db.prepare('UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(phone, user.id);

  const token = generateToken(user);

  // 合并游客设备试用次数
  if (device_id) {
    trialService.mergeDeviceCountToUser(user.id, device_id);
  }

  return res.json(success({
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      phone
    }
  }));
}

module.exports = {
  login,
  register,
  wechatLogin,
  wechatBindPhone,
  createUserWithInit
};
