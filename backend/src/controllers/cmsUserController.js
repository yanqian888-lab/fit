/**
 * CMS 账号与角色管理
 */
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { success, error } = require('../utils/response');
const { safeJsonParse } = require('../utils/safeJson');

function parsePermissions(permissions) {
  if (Array.isArray(permissions)) return JSON.stringify(permissions);
  if (typeof permissions === 'string') {
    try {
      const parsed = JSON.parse(permissions);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch (e) {}
  }
  return JSON.stringify([]);
}

// ========== 角色 ==========
function getRoles(req, res) {
  const list = db.prepare('SELECT * FROM cms_roles ORDER BY created_at ASC').all();
  return res.json(success(list.map(item => ({
    ...item,
    permissions: safeJsonParse(item.permissions, [])
  }))));
}

function createRole(req, res) {
  const { name, description, permissions } = req.body;
  if (!name) return res.status(400).json(error('角色名称不能为空', 400));

  try {
    const id = db.prepare(`
      INSERT INTO cms_roles (name, description, permissions, is_system)
      VALUES (?, ?, ?, 0)
    `).run(name, description || '', parsePermissions(permissions)).lastInsertRowid;
    return res.json(success({ id }, '创建成功'));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json(error('角色标识已存在', 409));
    }
    throw err;
  }
}

function updateRole(req, res) {
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  const role = db.prepare('SELECT * FROM cms_roles WHERE id = ?').get(id);
  if (!role) return res.status(404).json(error('角色不存在', 404));
  if (role.is_system === 1 && name && name !== role.name) {
    return res.status(400).json(error('系统内置角色不能修改标识', 400));
  }

  db.prepare(`
    UPDATE cms_roles
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        permissions = COALESCE(?, permissions)
    WHERE id = ?
  `).run(name, description, permissions !== undefined ? parsePermissions(permissions) : null, id);

  return res.json(success(null, '更新成功'));
}

function deleteRole(req, res) {
  const { id } = req.params;
  const role = db.prepare('SELECT * FROM cms_roles WHERE id = ?').get(id);
  if (!role) return res.status(404).json(error('角色不存在', 404));
  if (role.is_system === 1) return res.status(400).json(error('系统内置角色不能删除', 400));

  const inUse = db.prepare('SELECT COUNT(*) as count FROM cms_users WHERE role_id = ?').get(id).count;
  if (inUse > 0) return res.status(400).json(error('该角色下还有管理员，无法删除', 400));

  db.prepare('DELETE FROM cms_roles WHERE id = ?').run(id);
  return res.json(success(null, '删除成功'));
}

// ========== 管理员账号 ==========
function getUsers(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;

  const total = db.prepare('SELECT COUNT(*) as count FROM cms_users').get().count;
  const list = db.prepare(`
    SELECT u.id, u.username, u.nickname, u.role_id, u.status, u.last_login_at, u.created_at, r.name as role_name
    FROM cms_users u
    LEFT JOIN cms_roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(size, offset);

  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

function createUser(req, res) {
  const { username, password, nickname, role_id } = req.body;
  if (!username || !password) return res.status(400).json(error('账号和密码不能为空', 400));
  if (String(password).length < 6) return res.status(400).json(error('密码长度不能少于6位', 400));

  const role = db.prepare('SELECT id FROM cms_roles WHERE id = ?').get(role_id);
  if (!role) return res.status(400).json(error('角色不存在', 400));

  const passwordHash = bcrypt.hashSync(password, 10);
  try {
    const id = db.prepare(`
      INSERT INTO cms_users (username, password_hash, nickname, role_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(username, passwordHash, nickname || '', role_id).lastInsertRowid;
    return res.json(success({ id }, '创建成功'));
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json(error('账号已存在', 409));
    }
    throw err;
  }
}

function updateUser(req, res) {
  const { id } = req.params;
  const { nickname, role_id, status } = req.body;

  const user = db.prepare('SELECT * FROM cms_users WHERE id = ?').get(id);
  if (!user) return res.status(404).json(error('用户不存在', 404));

  if (role_id) {
    const role = db.prepare('SELECT id FROM cms_roles WHERE id = ?').get(role_id);
    if (!role) return res.status(400).json(error('角色不存在', 400));
  }

  // 禁止禁用最后一个 superadmin
  if (status !== undefined && status !== 1) {
    const superRole = db.prepare("SELECT id FROM cms_roles WHERE name = 'superadmin'").get();
    if (superRole && user.role_id === superRole.id) {
      const activeSupers = db.prepare(`
        SELECT COUNT(*) as count FROM cms_users
        WHERE role_id = ? AND status = 1 AND id != ?
      `).get(superRole.id, id).count;
      if (activeSupers === 0) {
        return res.status(400).json(error('不能禁用最后一个超级管理员', 400));
      }
    }
  }

  db.prepare(`
    UPDATE cms_users
    SET nickname = COALESCE(?, nickname),
        role_id = COALESCE(?, role_id),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nickname, role_id, status, id);

  return res.json(success(null, '更新成功'));
}

function resetUserPassword(req, res) {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || String(password).length < 6) {
    return res.status(400).json(error('密码长度不能少于6位', 400));
  }

  const user = db.prepare('SELECT id FROM cms_users WHERE id = ?').get(id);
  if (!user) return res.status(404).json(error('用户不存在', 404));

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE cms_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, id);
  return res.json(success(null, '密码重置成功'));
}

function deleteUser(req, res) {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM cms_users WHERE id = ?').get(id);
  if (!user) return res.status(404).json(error('用户不存在', 404));

  const superRole = db.prepare("SELECT id FROM cms_roles WHERE name = 'superadmin'").get();
  if (superRole && user.role_id === superRole.id) {
    const activeSuperCount = db.prepare('SELECT COUNT(*) as count FROM cms_users WHERE role_id = ? AND status = 1').get(superRole.id).count;
    if (activeSuperCount <= 1) {
      return res.status(400).json(error('不能删除最后一个启用的超级管理员', 400));
    }
  }

  db.prepare('DELETE FROM cms_users WHERE id = ?').run(id);
  return res.json(success(null, '删除成功'));
}

module.exports = {
  getRoles, createRole, updateRole, deleteRole,
  getUsers, createUser, updateUser, resetUserPassword, deleteUser
};