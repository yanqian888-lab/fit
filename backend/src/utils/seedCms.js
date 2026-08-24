/**
 * CMS 初始化：超级管理员、内置角色
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db');

function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  return Array.from(crypto.randomFillSync(new Uint8Array(length)))
    .map(b => chars[b % chars.length])
    .join('');
}

// 优先读取环境变量中的初始密码，否则随机生成
const DEFAULT_PASSWORD = process.env.CMS_ADMIN_INITIAL_PASSWORD || generateRandomPassword();

const SYSTEM_ROLES = [
  {
    name: 'superadmin',
    description: '超级管理员，拥有所有权限',
    permissions: JSON.stringify([
      'dashboard',
      'app_config:read', 'app_config:write',
      'template_config:read', 'template_config:write',
      'food_lib:read', 'food_lib:write',
      'exercise_lib:read', 'exercise_lib:write',
      'app_user:read', 'app_user:write',
      'feedback:read', 'feedback:write',
      'cms_user:read', 'cms_user:write',
      'prompt:read', 'prompt:write',
      'ai_config:read', 'ai_config:write',
      'milestone:read', 'milestone:write',
      'museum_config:read', 'museum_config:write',
      'museum_config:read', 'museum_config:write',
      'trial_config:read', 'trial_config:write',
      'trial_whitelist:read', 'trial_whitelist:write',
      'trial_log:read',
      'log:read',
      'popup_config:read', 'popup_config:write',
      'popup_whitelist:read', 'popup_whitelist:write',
      'popup_route:read', 'popup_route:write',
      'popup_global:read', 'popup_global:write',
      'popup_stats:read',
      'announcement:read', 'announcement:write',
      'notification_channel:read', 'notification_channel:write',
      'operation_stats:read',
      'pet_config:read', 'pet_config:write',
      'currency_config:read', 'currency_config:write',
      'shop_config:read', 'shop_config:write',
      'event_config:read', 'event_config:write',
      'task_config:read', 'task_config:write',
      'achievement_config:read', 'achievement_config:write',
      'dialogue_config:read', 'dialogue_config:write',
      'workout_config:read', 'workout_config:write'
    ]),
    is_system: 1
  },
  {
    name: 'admin',
    description: '管理员，可管理内容与用户，不可管理 CMS 账号',
    permissions: JSON.stringify([
      'dashboard',
      'app_config:read', 'app_config:write',
      'template_config:read', 'template_config:write',
      'food_lib:read', 'food_lib:write',
      'exercise_lib:read', 'exercise_lib:write',
      'app_user:read', 'app_user:write',
      'feedback:read', 'feedback:write',
      'prompt:read', 'prompt:write',
      'ai_config:read', 'ai_config:write',
      'milestone:read', 'milestone:write',
      'trial_config:read', 'trial_config:write',
      'trial_whitelist:read', 'trial_whitelist:write',
      'trial_log:read',
      'popup_config:read', 'popup_config:write',
      'popup_whitelist:read', 'popup_whitelist:write',
      'popup_route:read', 'popup_route:write',
      'popup_global:read', 'popup_global:write',
      'popup_stats:read',
      'announcement:read', 'announcement:write',
      'notification_channel:read', 'notification_channel:write',
      'operation_stats:read',
      'pet_config:read', 'pet_config:write',
      'currency_config:read', 'currency_config:write',
      'shop_config:read', 'shop_config:write',
      'event_config:read', 'event_config:write',
      'task_config:read', 'task_config:write',
      'achievement_config:read', 'achievement_config:write',
      'dialogue_config:read', 'dialogue_config:write',
      'workout_config:read', 'workout_config:write'
    ]),
    is_system: 1
  },
  {
    name: 'editor',
    description: '内容编辑，仅可编辑配置与反馈',
    permissions: JSON.stringify([
      'dashboard',
      'app_config:read', 'app_config:write',
      'template_config:read', 'template_config:write',
      'feedback:read', 'feedback:write',
      'app_user:read',
      'prompt:read', 'prompt:write',
      'popup_config:read',
      'popup_whitelist:read',
      'popup_route:read',
      'popup_global:read',
      'popup_stats:read',
      'announcement:read',
      'notification_channel:read',
      'operation_stats:read'
    ]),
    is_system: 1
  }
];

function seedCms() {
  try {
    // 初始化系统角色
    const insertRole = db.prepare(`
      INSERT INTO cms_roles (name, description, permissions, is_system)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        permissions = excluded.permissions,
        is_system = excluded.is_system
    `);
    for (const role of SYSTEM_ROLES) {
      insertRole.run(role.name, role.description, role.permissions, role.is_system);
    }

    // 初始化超级管理员
    const adminExists = db.prepare('SELECT id FROM cms_users WHERE username = ?').get('admin888');
    if (!adminExists) {
      const superRole = db.prepare('SELECT id FROM cms_roles WHERE name = ?').get('superadmin');
      if (superRole) {
        const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
        db.prepare(`
          INSERT INTO cms_users (username, password_hash, nickname, role_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run('admin888', passwordHash, '超级管理员', superRole.id);
        console.log('[CMS] 超级管理员 admin888 已初始化');
        console.log('[CMS] 初始密码:', DEFAULT_PASSWORD);
        console.log('[CMS] 请登录后尽快修改密码');

        // 将初始密码写入服务器本地文件，方便首次部署后查看
        try {
          const dataDir = path.join(__dirname, '../../data');
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
          const pwFile = path.join(dataDir, '.cms-admin-password');
          fs.writeFileSync(pwFile, `username: admin888\npassword: ${DEFAULT_PASSWORD}\n`, { mode: 0o600 });
        } catch (e) {
          console.error('[CMS] 写入初始密码文件失败:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[CMS] 初始化失败:', err.message);
  }
}

module.exports = { seedCms };
