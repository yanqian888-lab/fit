/**
 * JWT 认证与管理员权限中间件
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');
const { error } = require('../utils/response');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(error('请先登录', 401));
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.userId = decoded.userId;
    // 优先使用 token 中携带的角色；老 token 未携带时从数据库读取
    req.userRole = decoded.role || null;
    next();
  } catch (err) {
    return res.status(401).json(error('登录已过期，请重新登录', 401));
  }
}

function adminMiddleware(req, res, next) {
  try {
    let role = req.userRole;
    if (!role && req.userId) {
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
      role = user ? user.role : null;
    }
    if (role !== 'admin') {
      return res.status(403).json(error('无权访问管理员接口', 403));
    }
    next();
  } catch (err) {
    console.error('管理员权限校验失败:', err.message);
    return res.status(500).json(error('权限校验失败', 500));
  }
}

module.exports = {
  authMiddleware,
  adminMiddleware
};
