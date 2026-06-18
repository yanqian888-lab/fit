/**
 * 用户控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

/**
 * 获取当前用户信息
 */
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
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    gender: user.gender,
    age: user.age,
    height: user.height,
    profile: {
      initial_weight: user.initial_weight,
      current_weight: user.current_weight,
      target_weight: user.target_weight,
      target_date: user.target_date,
      bmr: user.bmr,
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
  const { nickname, avatar_url, gender, age, height } = req.body;

  db.prepare(`
    UPDATE users
    SET nickname = COALESCE(?, nickname),
        avatar_url = COALESCE(?, avatar_url),
        gender = COALESCE(?, gender),
        age = COALESCE(?, age),
        height = COALESCE(?, height),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nickname, avatar_url, gender, age, height, userId);

  return res.json(success(null, '更新成功'));
}

/**
 * 更新减肥目标
 */
function updateProfile(req, res) {
  const userId = req.userId;
  const {
    initial_weight,
    target_weight,
    target_date,
    calorie_deficit,
    dietary_taboos,
    preferences
  } = req.body;

  db.prepare(`
    UPDATE user_profiles
    SET initial_weight = COALESCE(?, initial_weight),
        target_weight = COALESCE(?, target_weight),
        target_date = COALESCE(?, target_date),
        calorie_deficit = COALESCE(?, calorie_deficit),
        dietary_taboos = COALESCE(?, dietary_taboos),
        preferences = COALESCE(?, preferences),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(initial_weight, target_weight, target_date, calorie_deficit, dietary_taboos, preferences, userId);

  return res.json(success(null, '目标更新成功'));
}

module.exports = {
  getMe,
  updateMe,
  updateProfile
};
