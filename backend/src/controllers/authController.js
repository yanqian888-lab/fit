/**
 * 认证控制器
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');
const { success, error } = require('../utils/response');

/**
 * 微信小程序登录
 * MVP 阶段模拟微信登录，直接返回 openid
 * 生产环境应调用微信 auth.code2Session 接口
 */
function wechatLogin(req, res) {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json(error('缺少微信登录 code', 400));
  }

  // 模拟根据 code 生成 openid
  const openid = `mock_openid_${code}`;

  let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);
  let isNewUser = false;

  if (!user) {
    // 创建新用户
    const insertUser = db.prepare(`
      INSERT INTO users (openid, nickname, created_at, updated_at, last_login_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const userId = insertUser.run(openid, '减肥搭子用户').lastInsertRowid;

    // 初始化用户资料
    db.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').run(userId);

    // 初始化搭子
    db.prepare(`
      INSERT INTO partners (user_id, name, mode, status, status_text)
      VALUES (?, '瘦瘦', 'gentle', 'awake', '刚刚起床')
    `).run(userId);

    // 初始化设置
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    isNewUser = true;
  } else {
    // 更新登录时间
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  }

  const token = jwt.sign(
    { userId: user.id, openid: user.openid },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return res.json(success({
    token,
    expires_in: 604800,
    is_new_user: isNewUser,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url
    }
  }));
}

module.exports = {
  wechatLogin
};
