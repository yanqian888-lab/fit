/**
 * CMS 认证与权限中间件
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');
const { error } = require('../utils/response');

function cmsAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(error('请先登录 CMS', 401));
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'cms') {
      return res.status(403).json(error('无权访问 CMS', 403));
    }

    const user = db.prepare('SELECT id, username, nickname, role_id, status FROM cms_users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json(error('CMS 用户不存在', 401));
    }
    if (user.status !== 1) {
      return res.status(403).json(error('账号已被禁用', 403));
    }

    // 每次从数据库读取角色最新权限，避免 token 里存的是旧权限
    const role = db.prepare('SELECT permissions FROM cms_roles WHERE id = ?').get(user.role_id);
    let rolePermissions = [];
    if (role && role.permissions) {
      try {
        rolePermissions = JSON.parse(role.permissions);
      } catch (e) {
        rolePermissions = [];
      }
    }

    req.cmsUserId = user.id;
    req.cmsUsername = user.username;
    req.cmsRoleId = user.role_id;
    req.cmsPermissions = Array.isArray(rolePermissions) ? rolePermissions : (decoded.permissions || []);
    next();
  } catch (err) {
    return res.status(401).json(error('登录已过期，请重新登录', 401));
  }
}

function cmsPermissionMiddleware(...permissions) {
  return (req, res, next) => {
    const userPermissions = req.cmsPermissions || [];
    const hasPermission = permissions.some(p => userPermissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json(error('无权执行此操作', 403));
    }
    next();
  };
}

module.exports = { cmsAuthMiddleware, cmsPermissionMiddleware };
