/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
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
    next();
  } catch (err) {
    return res.status(401).json(error('登录已过期，请重新登录', 401));
  }
}

module.exports = {
  authMiddleware
};
