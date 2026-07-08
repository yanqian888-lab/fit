/**
 * 用户控制器
 */
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { db } = require('../db');
const { success, error } = require('../utils/response');
const { staticUrl } = require('../utils/staticUrl');
const { safeDeleteLocalFile, deleteUserLocalFiles } = require('../utils/deleteUserFiles');

// 确保头像目录存在
const avatarDir = path.join(__dirname, '../../public/avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

// 头像上传配置：限制 5MB、仅图片
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar_${req.userId}_${Date.now()}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

/**
 * 上传用户头像
 */
function uploadAvatar(req, res) {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? '头像文件不能超过 5MB' : err.message)
        : err.message;
      return res.status(400).json(error(message, 400));
    }
    if (!req.file) {
      return res.status(400).json(error('请选择头像文件', 400));
    }

    const userId = req.userId;

    // 删除旧头像文件
    const oldUser = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);
    if (oldUser?.avatar_url) {
      safeDeleteLocalFile(oldUser.avatar_url);
    }

    const avatarUrl = staticUrl(req, `/static/avatars/${req.file.filename}`);

    db.prepare('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(avatarUrl, userId);

    return res.json(success({ avatar_url: avatarUrl }, '头像上传成功'));
  });
}

/**
 * 获取当前用户信息
 */
function calcAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getMe(req, res) {
  const userId = req.userId;

  const user = db.prepare(`
    SELECT u.*, p.* FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    WHERE u.id = ?
  `).get(userId);

  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);

  return res.json(success({
    id: user.id,
    username: user.username,
    phone: user.phone,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    gender: user.gender,
    age: user.age,
    birth_date: user.birth_date,
    height: user.height,
    role: user.role || 'user',
    profile: {
      initial_weight: user.initial_weight,
      current_weight: user.current_weight,
      target_weight: user.target_weight,
      target_date: user.target_date,
      bmr: user.bmr,
      tdee: user.tdee,
      daily_calorie_target: user.daily_calorie_target,
      calorie_deficit: user.calorie_deficit,
      dietary_taboos: user.dietary_taboos,
      preferences: user.preferences
    },
    partner: partner ? {
      name: partner.name,
      mode: partner.mode,
      status: partner.status,
      status_text: partner.status_text
    } : null
  }));
}

/**
 * 更新用户资料
 */
function updateMe(req, res) {
  const userId = req.userId;
  const { nickname, avatar_url, gender, birth_date, height } = req.body;

  if (!gender || !birth_date || !height) {
    return res.status(400).json(error('性别、出生日期、身高必填', 400));
  }

  const age = calcAge(birth_date);
  if (age === null || age < 0 || age > 150) {
    return res.status(400).json(error('出生日期不合法', 400));
  }

  db.prepare(`
    UPDATE users
    SET nickname = COALESCE(?, nickname),
        avatar_url = COALESCE(?, avatar_url),
        gender = ?,
        birth_date = ?,
        age = ?,
        height = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nickname, avatar_url, gender, birth_date, age, height, userId);

  return res.json(success({ age, birth_date }, '更新成功'));
}

/**
 * 计算 BMR（Mifflin-St Jeor 公式）
 */
function calcBMR(weight, height, age, gender) {
  if (!weight || !height || !age || !gender) return null;
  if (gender === 1) {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

function calcTDEE(bmr, activityFactor = 1.375) {
  if (!bmr) return null;
  return Math.round(bmr * activityFactor);
}

/**
 * 更新减肥目标，并自动计算 BMR 与每日热量目标
 */
function updateProfile(req, res) {
  const userId = req.userId;
  const {
    initial_weight,
    current_weight,
    target_weight,
    target_date,
    calorie_deficit,
    dietary_taboos,
    preferences
  } = req.body;

  db.prepare(`
    UPDATE user_profiles
    SET initial_weight = COALESCE(?, initial_weight),
        current_weight = COALESCE(?, current_weight),
        target_weight = COALESCE(?, target_weight),
        target_date = COALESCE(?, target_date),
        calorie_deficit = COALESCE(?, calorie_deficit),
        dietary_taboos = COALESCE(?, dietary_taboos),
        preferences = COALESCE(?, preferences),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(initial_weight, current_weight, target_weight, target_date, calorie_deficit, dietary_taboos, preferences, userId);

  // 如果更新了当前体重，同步把今天的体重记录也更新，避免“今日体重”和 profile 当前体重不一致
  if (current_weight !== undefined && current_weight !== null) {
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare(`
      SELECT id FROM body_records
      WHERE user_id = ? AND record_date = ? AND type = 'weight' AND status = 1
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, today);
    if (existing) {
      db.prepare(`
        UPDATE body_records SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(current_weight, existing.id);
    } else {
      db.prepare(`
        INSERT INTO body_records (user_id, record_date, type, value, unit, status)
        VALUES (?, ?, 'weight', ?, 'kg', 1)
      `).run(userId, today, current_weight);
    }
  }

  // 自动计算 BMR、TDEE 和每日热量目标（男女公式/安全下限不同）
  const user = db.prepare('SELECT age, gender, height FROM users WHERE id = ?').get(userId);
  const profile = db.prepare('SELECT current_weight, calorie_deficit FROM user_profiles WHERE user_id = ?').get(userId);
  if (user && profile) {
    const bmr = calcBMR(profile.current_weight, user.height, user.age, user.gender);
    if (bmr) {
      const tdee = calcTDEE(bmr);
      const deficit = profile.calorie_deficit || 500;
      const minCalorie = user.gender === 1 ? 1500 : 1200;
      const dailyTarget = Math.max(minCalorie, Math.round(tdee - deficit));
      db.prepare('UPDATE user_profiles SET bmr = ?, tdee = ?, daily_calorie_target = ? WHERE user_id = ?')
        .run(bmr, tdee, dailyTarget, userId);
    }
  }

  return res.json(success(null, '目标更新成功'));
}

/**
 * 导出用户所有数据
 */
function exportData(req, res) {
  const userId = req.userId;

  const tables = ['users', 'user_profiles', 'partners', 'chat_messages', 'precipitation_records', 'diet_records', 'exercise_records', 'body_records', 'habit_records', 'museum_items', 'timelines', 'milestones', 'settings'];
  const data = {};

  tables.forEach(table => {
    data[table] = db.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).all(userId);
  });

  return res.json(success({ exported_at: new Date().toISOString(), data }));
}

/**
 * 清空用户所有数据（保留账号）
 */
function clearData(req, res) {
  const userId = req.userId;

  ['chat_messages', 'precipitation_records', 'diet_records', 'exercise_records', 'body_records', 'habit_records', 'museum_items', 'timelines', 'milestones']
    .forEach(table => {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    });

  db.prepare('UPDATE user_profiles SET initial_weight = NULL, current_weight = NULL, target_weight = NULL, target_date = NULL, bmr = NULL, daily_calorie_target = NULL, calorie_deficit = 500, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(userId);
  db.prepare('UPDATE partners SET mode = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run('gentle', userId);
  db.prepare('UPDATE settings SET guide_completed = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(userId);

  return res.json(success(null, '数据已清空'));
}

/**
 * 注销账号
 * 物理删除用户记录，利用外键级联删除所有业务数据
 * 删除前记录审计日志，释放手机号/账号供重新注册
 */
function deleteAccount(req, res) {
  const userId = req.userId;

  const user = db.prepare('SELECT id, username, phone, openid FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  try {
    // 删除用户上传的本地文件（头像、反馈配图等）
    deleteUserLocalFiles(userId);

    // 记录注销审计日志
    db.prepare(`
      INSERT INTO deleted_users (original_user_id, username, phone, openid, reason, deleted_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(user.id, user.username || null, user.phone || null, user.openid || null, '用户主动注销');

    // 物理删除用户，外键级联删除所有业务数据
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return res.json(success(null, '账号已注销'));
  } catch (err) {
    console.error('注销账号失败:', err.message);
    return res.status(500).json(error('注销失败，请稍后重试', 500));
  }
}

module.exports = {
  getMe,
  updateMe,
  updateProfile,
  uploadAvatar,
  exportData,
  clearData,
  deleteAccount
};
