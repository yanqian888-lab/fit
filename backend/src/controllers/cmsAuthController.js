/**
 * CMS 认证控制器
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');
const { success, error } = require('../utils/response');
const { safeJsonParse } = require('../utils/safeJson');

function generateCmsToken(user, permissions) {
  return jwt.sign(
    { userId: user.id, type: 'cms', roleId: user.role_id, permissions },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function getRolePermissions(roleId) {
  const role = db.prepare('SELECT permissions FROM cms_roles WHERE id = ?').get(roleId);
  if (!role) return [];
  return safeJsonParse(role.permissions, [])
}

function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json(error('请输入账号和密码', 400));
  }

  const user = db.prepare('SELECT * FROM cms_users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json(error('账号或密码错误', 401));
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json(error('账号或密码错误', 401));
  }

  if (user.status !== 1) {
    return res.status(403).json(error('账号已被禁用', 403));
  }

  db.prepare('UPDATE cms_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const permissions = getRolePermissions(user.role_id);
  const token = generateCmsToken(user, permissions);

  return res.json(success({
    token,
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role_id: user.role_id,
      permissions
    }
  }, '登录成功'));
}

function getProfile(req, res) {
  const user = db.prepare('SELECT id, username, nickname, role_id, status, last_login_at, created_at FROM cms_users WHERE id = ?').get(req.cmsUserId);
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }
  const permissions = getRolePermissions(user.role_id);
  return res.json(success({ ...user, permissions }));
}

function changePassword(req, res) {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json(error('请输入原密码和新密码', 400));
  }
  if (String(new_password).length < 6) {
    return res.status(400).json(error('新密码长度不能少于6位', 400));
  }

  const user = db.prepare('SELECT * FROM cms_users WHERE id = ?').get(req.cmsUserId);
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }

  const valid = bcrypt.compareSync(old_password, user.password_hash);
  if (!valid) {
    return res.status(400).json(error('原密码错误', 400));
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE cms_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);
  return res.json(success(null, '密码修改成功'));
}

module.exports = { login, getProfile, changePassword };
