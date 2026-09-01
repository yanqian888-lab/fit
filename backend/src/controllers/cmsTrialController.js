/**
 * 试用权限 CMS 管理接口
 */
const { db } = require('../db');
const trialService = require('../services/trialService');
const cmsLogService = require('../services/cmsLogService');
const configMonitor = require('../services/configMonitorService');
const { success, error } = require('../utils/response');

const CONFIG_KEYS = [
  'global_enabled',
  'grayscale_percent',
  'ai_chat_enabled',
  'ai_chat_threshold',
  'diary_enabled',
  'diary_threshold',
  'popup_ai_title',
  'popup_ai_content',
  'popup_ai_primary_btn',
  'popup_ai_secondary_btn',
  'popup_ai_contact',
  'popup_diary_title',
  'popup_diary_content',
  'popup_diary_primary_btn',
  'popup_diary_secondary_btn',
  'popup_diary_contact'
];

/**
 * 获取配置
 */
function getConfig(req, res) {
  const config = trialService.getConfig();
  const result = {};
  CONFIG_KEYS.forEach(key => {
    result[key] = config[key] !== undefined ? config[key] : '';
  });
  return res.json(success(result));
}

/**
 * 更新配置
 */
function updateConfig(req, res) {
  const updates = req.body || {};
  const filtered = {};

  for (const key of CONFIG_KEYS) {
    if (updates[key] !== undefined) {
      filtered[key] = String(updates[key]);
    }
  }

  trialService.setConfigs(filtered);

  cmsLogService.log(req, 'update', 'trial_config', '', `更新试用权限配置：${JSON.stringify(filtered)}`);

  return res.json(success(null, '配置已更新'));
}

/**
 * 一键审核模式：关闭全局开关、灰度置0、当前版本加入白名单
 */
function auditMode(req, res) {
  const { app_version } = req.body || {};

  trialService.setConfigs({
    global_enabled: '0',
    grayscale_percent: '0'
  });

  if (app_version) {
    const existing = db.prepare('SELECT id FROM trial_whitelist WHERE type = ? AND value = ?').get('version', app_version);
    if (!existing) {
      db.prepare('INSERT INTO trial_whitelist (type, value, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('version', app_version, '审核模式自动添加', new Date().toISOString(), new Date().toISOString());
    }
  }

  cmsLogService.log(req, 'audit_mode', 'trial_config', '', `开启审核模式，版本白名单：${app_version || '无'}`);

  return res.json(success(null, '审核模式已开启'));
}

/**
 * 检查用户是否存在（支持 username、user_id、id、phone、openid）
 */
function checkUserExists(value) {
  if (!value) return false;
  const user = db.prepare(`
    SELECT id FROM users
    WHERE username = ? OR user_id = ? OR id = ? OR phone = ? OR openid = ?
    LIMIT 1
  `).get(value, value, value, value, value);
  return !!user;
}

/**
 * 检查白名单是否已存在
 */
function checkWhitelistExists(type, value) {
  return db.prepare('SELECT id FROM trial_whitelist WHERE type = ? AND value = ?').get(type, value);
}

/**
 * 白名单列表
 */
function listWhitelist(req, res) {
  const { type, page = 1, size = 20 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(size, 10);
  let where = 'WHERE 1=1';
  const params = [];
  if (type) {
    where += ' AND type = ?';
    params.push(type);
  }

  const list = db.prepare(`SELECT * FROM trial_whitelist ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, parseInt(size, 10), offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM trial_whitelist ${where}`).get(...params).count;

  return res.json(success({ list, pagination: { page: parseInt(page, 10), size: parseInt(size, 10), total } }));
}

/**
 * 新增白名单
 */
function createWhitelist(req, res) {
  const { type, value, expire_at, remark } = req.body;
  if (!type || !value || !['user', 'version', 'ip'].includes(type)) {
    return res.status(400).json(error('白名单类型或值无效', 400));
  }

  // 用户类型必须真实存在
  if (type === 'user' && !checkUserExists(value)) {
    return res.status(400).json(error('用户不存在，无法添加白名单', 400));
  }

  // 同一类型+值不可重复
  if (checkWhitelistExists(type, value)) {
    return res.status(409).json(error('该白名单已存在', 409));
  }

  const result = db.prepare('INSERT INTO trial_whitelist (type, value, expire_at, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(type, value, expire_at || null, remark || '', new Date().toISOString(), new Date().toISOString());

  cmsLogService.log(req, 'create', 'trial_whitelist', String(result.lastInsertRowid), `新增白名单：${type}=${value}`);

  return res.json(success({ id: result.lastInsertRowid }, '白名单已添加'));
}

/**
 * 批量新增白名单（换行分隔）
 */
function batchCreateWhitelist(req, res) {
  const { type, values, expire_at, remark } = req.body;
  if (!type || !values || !['user', 'version', 'ip'].includes(type)) {
    return res.status(400).json(error('参数无效', 400));
  }

  const lines = String(values).split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) {
    return res.status(400).json(error('未解析到有效值', 400));
  }

  const added = [];
  const skippedExists = [];
  const skippedNotFound = [];
  const insert = db.prepare('INSERT INTO trial_whitelist (type, value, expire_at, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');

  const transaction = db.transaction((items) => {
    const now = new Date().toISOString();
    for (const value of items) {
      if (checkWhitelistExists(type, value)) {
        skippedExists.push(value);
        continue;
      }
      if (type === 'user' && !checkUserExists(value)) {
        skippedNotFound.push(value);
        continue;
      }
      insert.run(type, value, expire_at || null, remark || '', now, now);
      added.push(value);
    }
  });
  transaction(lines);

  cmsLogService.log(req, 'batch_create', 'trial_whitelist', '', `批量新增白名单：${type}，成功${added.length}条`);

  const message = `成功添加 ${added.length} 条，跳过已存在 ${skippedExists.length} 条${type === 'user' ? `，用户不存在 ${skippedNotFound.length} 条` : ''}`;
  return res.json(success({
    count: added.length,
    added,
    skipped_exists: skippedExists,
    skipped_not_found: skippedNotFound
  }, message));
}

/**
 * 编辑白名单（仅支持修改过期时间和备注）
 */
function updateWhitelist(req, res) {
  const { id } = req.params;
  const { expire_at, remark } = req.body || {};

  const row = db.prepare('SELECT id, type, value FROM trial_whitelist WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('白名单不存在', 404));

  db.prepare('UPDATE trial_whitelist SET expire_at = ?, remark = ?, updated_at = ? WHERE id = ?')
    .run(expire_at || null, remark || '', new Date().toISOString(), id);

  cmsLogService.log(req, 'update', 'trial_whitelist', id, `编辑白名单：${row.type}=${row.value}`);

  return res.json(success(null, '白名单已更新'));
}

/**
 * 删除白名单
 */
function removeWhitelist(req, res) {
  const { id } = req.params;
  const row = db.prepare('SELECT type, value FROM trial_whitelist WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('白名单不存在', 404));

  db.prepare('DELETE FROM trial_whitelist WHERE id = ?').run(id);

  cmsLogService.log(req, 'delete', 'trial_whitelist', id, `删除白名单：${row.type}=${row.value}`);

  return res.json(success(null, '白名单已删除'));
}

/**
 * 权限拦截日志
 */
function listLogs(req, res) {
  const { feature_type, action, page = 1, size = 20 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(size, 10);
  const conditions = [];
  const params = [];
  if (feature_type) {
    conditions.push('feature_type = ?');
    params.push(feature_type);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const list = db.prepare(`SELECT * FROM trial_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, parseInt(size, 10), offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM trial_logs ${where}`).get(...params).count;

  return res.json(success({ list, pagination: { page: parseInt(page, 10), size: parseInt(size, 10), total } }));
}

/**
 * 看板统计
 */
function dashboard(req, res) {
  const stats = trialService.getDashboardStats();
  const config = trialService.getConfig();
  return res.json(success({
    ...stats,
    global_enabled: config.global_enabled === '1',
    grayscale_percent: parseInt(config.grayscale_percent || '0', 10),
    ai_chat_enabled: config.ai_chat_enabled === '1',
    diary_enabled: config.diary_enabled === '1'
  }));
}

module.exports = {
  getConfig,
  updateConfig,
  auditMode,
  listWhitelist,
  createWhitelist,
  batchCreateWhitelist,
  updateWhitelist,
  removeWhitelist,
  listLogs,
  dashboard
};