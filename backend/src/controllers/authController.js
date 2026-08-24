/**
 * 认证控制器
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { db, initUserCompanionData } = require('../db');
const { success, error } = require('../utils/response');
const trialService = require('../services/trialService');
const wechatService = require('../services/wechatService');

// 用户账号：6-10位字母+数字组合
const USERNAME_REGEX = /^[a-zA-Z0-9]{6,10}$/;

function validateUsername(username) {
  return USERNAME_REGEX.test(username);
}

function validateUsernameCombo(username) {
  return validateUsername(username) && /[a-zA-Z]/.test(username) && /[0-9]/.test(username);
}

// 用户密码：6-12位字母+数字组合，且需同时包含字母和数字
function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (!/^[a-zA-Z0-9]{6,12}$/.test(password)) return false;
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
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
function createUserWithInit(username, passwordHash, phone, nickname, source = 'app') {
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, phone, nickname, source, user_id, created_at, updated_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const tx = db.transaction(() => {
    const userIdCode = generateUserId();
    const userId = insertUser.run(username, passwordHash, phone, nickname, source, userIdCode).lastInsertRowid;

    // 初始化用户资料
    db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);

    // 初始化搭子
    db.prepare(`
      INSERT INTO partners (user_id, name, mode, status, status_text)
      VALUES (?, '你的搭子', 'gentle', 'awake', '刚刚起床')
    `).run(userId);

    // 初始化设置
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);

    // 初始化陪伴系统数据（宠物、货币等）
    initUserCompanionData(userId);

    // 新用户首次欢迎语
    db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, content_type, mode)
      VALUES (?, 'partner', ?, 'text', 'gentle')
    `).run(userId, '你好呀，我是搭搭，你的专属减脂小熊猫～\n从今天开始，我会陪你一起记录饮食、运动、体重，一起瘦下来！有什么想聊的，随时告诉我吧～');

    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  });

  return tx();
}

/**
 * 生成 JWT Token
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, type: 'app', role: user.role || 'user' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * 组装完整用户信息（与 getMe 接口结构对齐）
 * 所有登录/注册接口统一使用，保证 handlePostAuthRedirect 跳转逻辑一致
 * @param {number} userId 用户 ID
 * @returns {object} 完整用户响应体
 */
function serializeUser(userId) {
  const u = db.prepare(`
    SELECT u.*, p.* FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    WHERE u.id = ?
  `).get(userId);

  if (!u) return null;

  const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);
  const settings = db.prepare('SELECT guide_completed, notification_enabled, reminder_weight, reminder_water, reminder_exercise, dnd_start, dnd_end, theme, font_size FROM settings WHERE user_id = ?').get(userId);

  return {
    id: u.id,
    user_id: u.user_id,
    username: u.username,
    phone: u.phone,
    nickname: u.nickname,
    avatar_url: u.avatar_url,
    openid: u.openid,
    unionid: u.unionid,
    gender: u.gender,
    age: u.age,
    birth_date: u.birth_date,
    height: u.height,
    role: u.role || 'user',
    source: u.source,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
    profile: {
      initial_weight: u.initial_weight,
      current_weight: u.current_weight,
      target_weight: u.target_weight,
      target_date: u.target_date,
      bmr: u.bmr,
      tdee: u.tdee,
      daily_calorie_target: u.daily_calorie_target,
      calorie_deficit: u.calorie_deficit,
      dietary_taboos: u.dietary_taboos,
      preferences: u.preferences
    },
    partner: partner ? {
      name: partner.name,
      mode: partner.mode,
      status: partner.status,
      status_text: partner.status_text
    } : null,
    settings: settings || {
      guide_completed: 0,
      notification_enabled: 1,
      reminder_weight: 1,
      reminder_water: 1,
      reminder_exercise: 1
    }
  };
}

/**
 * 账号密码登录
 */
function login(req, res) {
  const { username, password, device_id } = req.body;

  if (!validateUsernameCombo(username)) {
    return res.status(400).json(error('请输入6-10位字母+数字账号，且需同时包含字母和数字', 400));
  }
  if (!validatePassword(password)) {
    return res.status(400).json(error('请输入6-12位字母+数字密码，且需同时包含字母和数字', 400));
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json(error('账号或密码错误', 401));
  }
  if (user.status !== 1) {
    return res.status(403).json(error('账号已被禁用', 403));
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
    user: serializeUser(user.id)
  }));
}

/**
 * 账号注册
 */
function register(req, res) {
  const { username, password, phone, device_id } = req.body;

  if (!validateUsernameCombo(username)) {
    return res.status(400).json(error('请输入6-10位字母+数字账号，且需同时包含字母和数字', 400));
  }
  if (!validatePassword(password)) {
    return res.status(400).json(error('请输入6-12位字母+数字密码，且需同时包含字母和数字', 400));
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
  const user = createUserWithInit(username, passwordHash, phone, '掉秤搭搭用户', 'app');
  const token = generateToken(user);

  // 合并游客设备试用次数
  if (device_id) {
    trialService.mergeDeviceCountToUser(user.id, device_id);
  }

  return res.json(success({
    token,
    user: serializeUser(user.id)
  }));
}

/**
 * 微信小程序登录
 * 前端调用 wx.login() 拿到 code，传到这里换 openid。
 * 已存在 openid 的用户直接登录，否则自动注册（未绑定手机号）。
 */
async function wechatLogin(req, res) {
  const { code, device_id } = req.body;
  if (!code) {
    return res.status(400).json(error('缺少微信登录 code', 400));
  }
  if (typeof code !== 'string' || code.length < 10 || code.length > 100) {
    return res.status(400).json(error('微信登录 code 格式不正确', 400));
  }

  let openid;
  let unionid = null;
  try {
    const session = await wechatService.code2session(code);
    openid = session.openid;
    unionid = session.unionid || null;
  } catch (err) {
    console.error('[auth] 微信 code2session 失败:', err);
    return res.status(400).json(error(err.message || '微信登录失败', 400));
  }

  let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
  let isNewUser = false;

  if (user && user.status !== 1) {
    return res.status(403).json(error('账号已被禁用', 403));
  }

  if (!user) {
    // 创建新用户（未绑定手机号），整体包事务避免半成品账号
    const createTx = db.transaction(() => {
      const userIdCode = generateUserId();
      const insertUser = db.prepare(`
        INSERT INTO users (openid, unionid, nickname, user_id, source, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, 'wechat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      const userId = insertUser.run(openid, unionid, '掉秤搭搭用户', userIdCode).lastInsertRowid;

      // 初始化用户资料
      db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);

      // 初始化搭子
      db.prepare(`
        INSERT INTO partners (user_id, name, mode, status, status_text)
        VALUES (?, '你的搭子', 'gentle', 'awake', '刚刚起床')
      `).run(userId);

      // 初始化设置
      db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);

      // 初始化陪伴系统数据（宠物、货币等）
      initUserCompanionData(userId);

      // 新用户首次欢迎语
      db.prepare(`
        INSERT INTO chat_messages (user_id, role, content, content_type, mode)
        VALUES (?, 'partner', ?, 'text', 'gentle')
      `).run(userId, '你好呀，我是搭搭，你的专属减脂小熊猫～\n从今天开始，我会陪你一起记录饮食、运动、体重，一起瘦下来！有什么想聊的，随时告诉我吧～');

      return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    });

    user = createTx();
    isNewUser = true;
  } else {
    // 已有 unionid 但本次拿到新的 unionid 时补写一次
    if (unionid && !user.unionid) {
      db.prepare('UPDATE users SET unionid = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(unionid, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    } else {
      // 更新登录时间
      db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    }
  }

  // 根据需求：微信登录后直接允许使用，暂不强制绑定手机号
  // 后续如需绑定，可在设置页引导用户绑定
  const needBindPhone = false;

  const token = generateToken(user);

  // 合并游客设备试用次数
  if (device_id) {
    trialService.mergeDeviceCountToUser(user.id, device_id);
  }

  return res.json(success({
    token,
    need_bind_phone: needBindPhone,
    is_new_user: isNewUser,
    user: serializeUser(user.id)
  }));
}

/**
 * 微信登录后绑定手机号
 * 前端用 button open-type="getPhoneNumber" 获取 phoneCode，
 * 传到这里由后端调用微信 API 换出真实手机号并写入用户记录。
 * 必须登录态下调用（authMiddleware），通过 req.userId 定位当前用户。
 */
async function wechatBindPhone(req, res) {
  const { phone_code, device_id } = req.body;

  if (!phone_code) {
    return res.status(400).json(error('缺少微信手机号 code', 400));
  }
  if (!req.userId) {
    return res.status(401).json(error('请先登录', 401));
  }

  let phone;
  try {
    const phoneInfo = await wechatService.getPhoneNumber(phone_code);
    phone = phoneInfo.purePhoneNumber || phoneInfo.phoneNumber;
  } catch (err) {
    console.error('[auth] 微信 getPhoneNumber 失败:', err);
    return res.status(400).json(error(err.message || '获取手机号失败', 400));
  }
  if (!phone) {
    return res.status(400).json(error('未拿到微信手机号', 400));
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
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

  // 合并游客设备试用次数
  if (device_id) {
    trialService.mergeDeviceCountToUser(user.id, device_id);
  }

  return res.json(success({
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