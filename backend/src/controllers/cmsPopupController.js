/**
 * CMS 弹窗广告配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const VALID_STYLES = ['center', 'top'];
const VALID_TYPES = ['system', 'operational', 'version', 'activity'];
const VALID_STATUSES = ['draft', 'enabled', 'disabled'];
const VALID_JUMPS = ['none', 'internal', 'h5'];
const VALID_SCOPES = ['global', 'specific'];
const VALID_TRIGGERS = ['immediate', 'duration', 'back', 'cold_start', 'operation'];
const VALID_PERIODS = ['day', 'week', 'forever'];

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str || JSON.stringify(fallback));
  } catch (e) {
    return fallback;
  }
}

function toJson(value) {
  if (value === undefined || value === null) return JSON.stringify([]);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function getNow() {
  return new Date().toISOString();
}

function isSuperadmin(req) {
  const role = db.prepare('SELECT name FROM cms_roles WHERE id = ?').get(req.cmsRoleId);
  return role && role.name === 'superadmin';
}

function requireSuperadmin(req, res) {
  if (!isSuperadmin(req)) {
    return res.status(403).json(error('仅超级管理员可操作', 403));
  }
  return null;
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function parseTargetUsers(value) {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean);
  if (typeof value === 'string') {
    const lines = value.split(/[,，\n]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    // 也兼容 JSON 字符串
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
    } catch (e) {}
    return lines;
  }
  return [];
}

function isExpired(popup) {
  const now = new Date();
  return new Date(popup.end_time) < now;
}

function isNotStarted(popup) {
  const now = new Date();
  return new Date(popup.start_time) > now;
}

function effectiveStatus(popup) {
  if (popup.status === 'disabled') return 'disabled';
  if (popup.status === 'draft') return 'draft';
  if (isExpired(popup)) return 'expired';
  if (isNotStarted(popup)) return 'pending';
  return 'enabled';
}

function validatePopup(body, isUpdate = false) {
  const {
    name, style, type, status, start_time, end_time, priority,
    image_url, jump_type, jump_route_id, jump_url,
    scope_type, trigger_type, frequency_period, frequency_max,
    target_users
  } = body;

  if (target_users !== undefined) {
    const users = parseTargetUsers(target_users);
    const invalid = users.find(u => !/^[a-zA-Z0-9]{6}$/.test(u));
    if (invalid) return `定向用户ID格式无效：${invalid}（应为6位字母+数字）`;
  }

  if (!isUpdate && !name) return '弹窗名称不能为空';
  if (name !== undefined && !String(name).trim()) return '弹窗名称不能为空';
  if (name !== undefined && String(name).length > 64) return '弹窗名称最多 64 字符';

  if (style !== undefined && !VALID_STYLES.includes(style)) return '弹窗样式无效';
  if (type !== undefined && !VALID_TYPES.includes(type)) return '广告类型无效';
  if (status !== undefined && !VALID_STATUSES.includes(status)) return '状态无效';

  if (!isUpdate && !start_time) return '生效开始时间不能为空';
  if (!isUpdate && !end_time) return '生效结束时间不能为空';
  if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
    return '结束时间必须晚于开始时间';
  }

  if (priority !== undefined) {
    const n = Number(priority);
    if (!Number.isInteger(n) || n < 1 || n > 10) return '优先级必须为 1-10 的整数';
  }

  if (!isUpdate && !image_url) return '弹窗主图不能为空';

  if (jump_type !== undefined && !VALID_JUMPS.includes(jump_type)) return '跳转类型无效';
  if (jump_type === 'internal') {
    if (!jump_route_id) return '站内跳转必须选择路由';
    const route = db.prepare('SELECT id FROM app_routes WHERE id = ? AND status = ?').get(jump_route_id, 'enabled');
    if (!route) return '所选站内路由不存在或已停用';
  }
  if (jump_type === 'h5') {
    if (!jump_url) return '外部 H5 链接不能为空';
    const url = String(jump_url).trim();
    if (!url.startsWith('https://')) return '外部 H5 必须使用 HTTPS 协议';
    const domain = extractDomain(url);
    const hit = db.prepare(`SELECT id FROM h5_whitelist WHERE domain = ? AND status = 'enabled'`).get(domain);
    if (!hit) {
      return '域名未录入白名单，无法配置外部广告';
    }
  }

  if (scope_type !== undefined && !VALID_SCOPES.includes(scope_type)) return '弹出范围无效';
  if (scope_type === 'specific') {
    const pages = parseArray(body.scope_pages);
    if (pages.length === 0) return '指定页面模式必须至少选择一个页面';
  }

  if (trigger_type !== undefined && !VALID_TRIGGERS.includes(trigger_type)) return '触发时机无效';

  if (frequency_period !== undefined && !VALID_PERIODS.includes(frequency_period)) return '频次周期无效';
  if (frequency_max !== undefined) {
    const m = Number(frequency_max);
    if (!Number.isInteger(m) || m < 1) return '周期最大曝光次数至少为 1';
  }

  return null;
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch (e) {
    return '';
  }
}

function normalizeWhitelistDomain(value) {
  const v = String(value).trim().toLowerCase();
  if (v.startsWith('https://')) return v.slice(8);
  if (v.startsWith('http://')) return '';
  return v;
}

function domainMatch(domain, pattern) {
  if (!domain || !pattern) return false;
  const d = domain.toLowerCase();
  const p = pattern.toLowerCase();
  if (p === d) return true;
  if (p.startsWith('*.')) {
    const suffix = p.slice(2);
    if (d === suffix) return true;
    if (d.endsWith('.' + suffix)) return true;
  }
  return false;
}

function enrichPopup(row) {
  if (!row) return null;
  const route = row.jump_route_id
    ? db.prepare('SELECT route_key, route_name, path FROM app_routes WHERE id = ?').get(row.jump_route_id)
    : null;
  const targetUsers = safeJsonParse(row.target_users, []);
  return {
    ...row,
    scope_pages: safeJsonParse(row.scope_pages, []),
    excluded_pages: safeJsonParse(row.excluded_pages, []),
    jump_params: safeJsonParse(row.jump_params, {}),
    os_type: safeJsonParse(row.os_type, ['ios', 'android', 'h5', 'mp-weixin']),
    target_users: targetUsers,
    target_user_count: targetUsers.length,
    effective_status: effectiveStatus(row),
    jump_route: route || null
  };
}

// ==================== 弹窗管理 ====================

function listPopups(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 20));
  const offset = (page - 1) * size;
  const status = req.query.status || '';
  const type = req.query.type || '';
  const keyword = req.query.keyword || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (status && VALID_STATUSES.includes(status)) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (type && VALID_TYPES.includes(type)) {
    where += ' AND type = ?';
    params.push(type);
  }
  if (keyword) {
    where += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM popups ${where}`).get(...params).count;

  const rows = db.prepare(`
    SELECT id, name, style, type, status, start_time, end_time, priority, target_users, created_by, created_at
    FROM popups ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  const list = rows.map(row => {
    const targetUsers = safeJsonParse(row.target_users, []);
    return {
      ...row,
      target_users: targetUsers,
      target_user_count: targetUsers.length,
      effective_status: effectiveStatus(row)
    };
  });

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size },
    enums: {
      styles: VALID_STYLES,
      types: VALID_TYPES,
      statuses: VALID_STATUSES,
      jumps: VALID_JUMPS,
      scopes: VALID_SCOPES,
      triggers: VALID_TRIGGERS,
      periods: VALID_PERIODS
    }
  }));
}

function getPopupById(req, res) {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM popups WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('弹窗不存在', 404));
  return res.json(success(enrichPopup(row)));
}

function createPopup(req, res) {
  const err = validatePopup(req.body);
  if (err) return res.status(400).json(error(err, 400));

  const body = req.body;
  const now = getNow();

  const result = db.prepare(`
    INSERT INTO popups (
      name, style, type, status, start_time, end_time, priority, image_url, title, content,
      show_close_button, mask_closeable, jump_type, jump_route_id, jump_url, jump_params,
      scope_type, scope_pages, excluded_pages, trigger_type, trigger_delay_seconds,
      frequency_period, frequency_max, one_time, wifi_only, version_min, version_max, os_type, target_users,
      sort_order, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(body.name).trim(),
    body.style,
    body.type,
    body.status || 'draft',
    body.start_time,
    body.end_time,
    Number(body.priority) || 5,
    body.image_url || '',
    body.title || '',
    body.content || '',
    body.show_close_button === false ? 0 : 1,
    body.mask_closeable === false ? 0 : 1,
    body.jump_type || 'none',
    body.jump_type === 'internal' ? body.jump_route_id : null,
    body.jump_type === 'h5' ? (body.jump_url || '') : '',
    toJson(body.jump_params),
    body.scope_type || 'global',
    toJson(body.scope_pages),
    toJson(body.excluded_pages),
    body.trigger_type || 'immediate',
    Number(body.trigger_delay_seconds) || 0,
    body.frequency_period || 'day',
    Number(body.frequency_max) || 1,
    body.one_time ? 1 : 0,
    body.wifi_only ? 1 : 0,
    body.version_min || '',
    body.version_max || '',
    toJson(body.os_type || ['ios', 'android', 'h5', 'mp-weixin']),
    toJson(parseTargetUsers(body.target_users)),
    Number(body.sort_order) || 0,
    req.cmsUsername || '',
    now,
    now
  );

  const id = result.lastInsertRowid;
  cmsLogService.log(req, 'popup_config:create', 'popup', String(id), { name: body.name });
  return res.json(success({ id }, '创建成功'));
}

function updatePopup(req, res) {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM popups WHERE id = ?').get(id);
  if (!existing) return res.status(404).json(error('弹窗不存在', 404));

  if (effectiveStatus(existing) === 'expired') {
    return res.status(400).json(error('已过期弹窗禁止编辑，请复制新建', 400));
  }

  const err = validatePopup(req.body, true);
  if (err) return res.status(400).json(error(err, 400));

  const body = req.body;
  const now = getNow();

  db.prepare(`
    UPDATE popups SET
      name = COALESCE(?, name),
      style = COALESCE(?, style),
      type = COALESCE(?, type),
      status = COALESCE(?, status),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      priority = COALESCE(?, priority),
      image_url = COALESCE(?, image_url),
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      show_close_button = COALESCE(?, show_close_button),
      mask_closeable = COALESCE(?, mask_closeable),
      jump_type = COALESCE(?, jump_type),
      jump_route_id = ?,
      jump_url = COALESCE(?, jump_url),
      jump_params = COALESCE(?, jump_params),
      scope_type = COALESCE(?, scope_type),
      scope_pages = COALESCE(?, scope_pages),
      excluded_pages = COALESCE(?, excluded_pages),
      trigger_type = COALESCE(?, trigger_type),
      trigger_delay_seconds = COALESCE(?, trigger_delay_seconds),
      frequency_period = COALESCE(?, frequency_period),
      frequency_max = COALESCE(?, frequency_max),
      one_time = COALESCE(?, one_time),
      wifi_only = COALESCE(?, wifi_only),
      version_min = COALESCE(?, version_min),
      version_max = COALESCE(?, version_max),
      os_type = COALESCE(?, os_type),
      target_users = COALESCE(?, target_users),
      sort_order = COALESCE(?, sort_order),
      updated_at = ?
    WHERE id = ?
  `).run(
    body.name !== undefined ? String(body.name).trim() : null,
    body.style,
    body.type,
    body.status,
    body.start_time,
    body.end_time,
    body.priority !== undefined ? Number(body.priority) : null,
    body.image_url,
    body.title,
    body.content,
    body.show_close_button !== undefined ? (body.show_close_button ? 1 : 0) : null,
    body.mask_closeable !== undefined ? (body.mask_closeable ? 1 : 0) : null,
    body.jump_type,
    body.jump_type === 'internal' ? (body.jump_route_id || existing.jump_route_id) : null,
    body.jump_url,
    body.jump_params !== undefined ? toJson(body.jump_params) : null,
    body.scope_type,
    body.scope_pages !== undefined ? toJson(body.scope_pages) : null,
    body.excluded_pages !== undefined ? toJson(body.excluded_pages) : null,
    body.trigger_type,
    body.trigger_delay_seconds !== undefined ? Number(body.trigger_delay_seconds) : null,
    body.frequency_period,
    body.frequency_max !== undefined ? Number(body.frequency_max) : null,
    body.one_time !== undefined ? (body.one_time ? 1 : 0) : null,
    body.wifi_only !== undefined ? (body.wifi_only ? 1 : 0) : null,
    body.version_min,
    body.version_max,
    body.os_type !== undefined ? toJson(body.os_type) : null,
    body.target_users !== undefined ? toJson(parseTargetUsers(body.target_users)) : null,
    body.sort_order !== undefined ? Number(body.sort_order) : null,
    now,
    id
  );

  cmsLogService.log(req, 'popup_config:update', 'popup', String(id), { name: body.name });
  return res.json(success(null, '更新成功'));
}

function removePopup(req, res) {
  const { id } = req.params;
  const row = db.prepare('SELECT name FROM popups WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('弹窗不存在', 404));

  db.prepare('DELETE FROM popups WHERE id = ?').run(id);
  cmsLogService.log(req, 'popup_config:delete', 'popup', String(id), { name: row.name });
  return res.json(success(null, '删除成功'));
}

function copyPopup(req, res) {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM popups WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('弹窗不存在', 404));

  const now = getNow();
  const result = db.prepare(`
    INSERT INTO popups (
      name, style, type, status, start_time, end_time, priority, image_url, title, content,
      show_close_button, mask_closeable, jump_type, jump_route_id, jump_url, jump_params,
      scope_type, scope_pages, excluded_pages, trigger_type, trigger_delay_seconds,
      frequency_period, frequency_max, one_time, wifi_only, version_min, version_max, os_type, target_users,
      sort_order, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `${row.name} 复制`,
    row.style,
    row.type,
    now,
    getDateDaysLater(7),
    row.priority,
    row.image_url,
    row.title,
    row.content,
    row.show_close_button,
    row.mask_closeable,
    row.jump_type,
    row.jump_route_id,
    row.jump_url,
    row.jump_params,
    row.scope_type,
    row.scope_pages,
    row.excluded_pages,
    row.trigger_type,
    row.trigger_delay_seconds,
    row.frequency_period,
    row.frequency_max,
    row.one_time,
    row.wifi_only,
    row.version_min,
    row.version_max,
    row.os_type,
    row.target_users,
    row.sort_order,
    req.cmsUsername || '',
    now,
    now
  );

  cmsLogService.log(req, 'popup_config:copy', 'popup', String(result.lastInsertRowid), { source_id: id });
  return res.json(success({ id: result.lastInsertRowid }, '复制成功'));
}

function getDateDaysLater(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function batchStatus(req, res) {
  const { ids, status } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json(error('请选择弹窗', 400));
  if (!VALID_STATUSES.includes(status)) return res.status(400).json(error('状态无效', 400));

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE popups SET status = ?, updated_at = ? WHERE id IN (${placeholders})`)
    .run(status, getNow(), ...ids);

  cmsLogService.log(req, 'popup_config:batch_status', 'popup', '', { ids, status });
  return res.json(success(null, '批量更新成功'));
}

function batchDelete(req, res) {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json(error('请选择弹窗', 400));

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM popups WHERE id IN (${placeholders})`).run(...ids);

  cmsLogService.log(req, 'popup_config:batch_delete', 'popup', '', { ids });
  return res.json(success(null, '批量删除成功'));
}

// ==================== H5 白名单 ====================

function listWhitelist(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 20));
  const offset = (page - 1) * size;
  const status = req.query.status || '';

  let where = 'WHERE 1=1';
  const params = [];
  if (status && ['enabled', 'disabled'].includes(status)) {
    where += ' AND status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM h5_whitelist ${where}`).get(...params).count;
  const list = db.prepare(`SELECT * FROM h5_whitelist ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, size, offset);

  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

function createWhitelist(req, res) {
  const forbid = requireSuperadmin(req, res);
  if (forbid) return forbid;

  const { domain, status = 'enabled' } = req.body || {};
  const normalized = normalizeWhitelistDomain(domain);
  if (!normalized) return res.status(400).json(error('域名格式无效，仅支持 HTTPS 域名', 400));
  if (!['enabled', 'disabled'].includes(status)) return res.status(400).json(error('状态无效', 400));

  const existing = db.prepare('SELECT id FROM h5_whitelist WHERE domain = ?').get(normalized);
  if (existing) return res.status(409).json(error('该域名已存在', 409));

  const now = getNow();
  const result = db.prepare(`
    INSERT INTO h5_whitelist (domain, status, created_at, updated_at) VALUES (?, ?, ?, ?)
  `).run(normalized, status, now, now);

  cmsLogService.log(req, 'popup_whitelist:create', 'h5_whitelist', String(result.lastInsertRowid), { domain: normalized });
  return res.json(success({ id: result.lastInsertRowid }, '添加成功'));
}

function updateWhitelist(req, res) {
  const forbid = requireSuperadmin(req, res);
  if (forbid) return forbid;

  const { id } = req.params;
  const { status } = req.body || {};
  const row = db.prepare('SELECT domain FROM h5_whitelist WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('白名单不存在', 404));
  if (!['enabled', 'disabled'].includes(status)) return res.status(400).json(error('状态无效', 400));

  db.prepare('UPDATE h5_whitelist SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, getNow(), id);

  cmsLogService.log(req, 'popup_whitelist:update', 'h5_whitelist', String(id), { domain: row.domain, status });
  return res.json(success(null, '更新成功'));
}

function removeWhitelist(req, res) {
  const forbid = requireSuperadmin(req, res);
  if (forbid) return forbid;

  const { id } = req.params;
  const row = db.prepare('SELECT domain FROM h5_whitelist WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('白名单不存在', 404));

  db.prepare('DELETE FROM h5_whitelist WHERE id = ?').run(id);
  cmsLogService.log(req, 'popup_whitelist:delete', 'h5_whitelist', String(id), { domain: row.domain });
  return res.json(success(null, '删除成功'));
}

// ==================== 站内路由 ====================

function listRoutes(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 20));
  const offset = (page - 1) * size;
  const status = req.query.status || '';

  let where = 'WHERE 1=1';
  const params = [];
  if (status && ['enabled', 'disabled'].includes(status)) {
    where += ' AND status = ?';
    params.push(status);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM app_routes ${where}`).get(...params).count;
  const list = db.prepare(`SELECT * FROM app_routes ${where} ORDER BY route_key ASC LIMIT ? OFFSET ?`)
    .all(...params, size, offset);

  return res.json(success({ list: list.map(r => ({ ...r, params_schema: safeJsonParse(r.params_schema, {}) })), pagination: { page, size, total, has_more: total > page * size } }));
}

function createRoute(req, res) {
  const forbid = requireSuperadmin(req, res);
  if (forbid) return forbid;

  const { route_key, route_name, path, params_schema, status = 'enabled' } = req.body || {};
  if (!route_key || !route_name) return res.status(400).json(error('路由标识和名称不能为空', 400));
  if (!['enabled', 'disabled'].includes(status)) return res.status(400).json(error('状态无效', 400));

  const now = getNow();
  try {
    const result = db.prepare(`
      INSERT INTO app_routes (route_key, route_name, path, params_schema, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(route_key, route_name, path || '', toJson(params_schema), status, now, now);
    cmsLogService.log(req, 'popup_route:create', 'app_route', String(result.lastInsertRowid), { route_key });
    return res.json(success({ id: result.lastInsertRowid }, '创建成功'));
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint')) {
      return res.status(409).json(error('路由标识已存在', 409));
    }
    throw e;
  }
}

function updateRoute(req, res) {
  const forbid = requireSuperadmin(req, res);
  if (forbid) return forbid;

  const { id } = req.params;
  const { route_key, route_name, path, params_schema, status } = req.body || {};
  const row = db.prepare('SELECT route_key FROM app_routes WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('路由不存在', 404));

  db.prepare(`
    UPDATE app_routes SET
      route_key = COALESCE(?, route_key),
      route_name = COALESCE(?, route_name),
      path = COALESCE(?, path),
      params_schema = COALESCE(?, params_schema),
      status = COALESCE(?, status),
      updated_at = ?
    WHERE id = ?
  `).run(route_key, route_name, path, params_schema !== undefined ? toJson(params_schema) : null, status, getNow(), id);

  cmsLogService.log(req, 'popup_route:update', 'app_route', String(id), { route_key: route_key || row.route_key });
  return res.json(success(null, '更新成功'));
}

function removeRoute(req, res) {
  const forbid = requireSuperadmin(req, res);
  if (forbid) return forbid;

  const { id } = req.params;
  const row = db.prepare('SELECT route_key FROM app_routes WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('路由不存在', 404));

  const inUse = db.prepare('SELECT COUNT(*) as count FROM popups WHERE jump_route_id = ?').get(id).count;
  if (inUse > 0) return res.status(400).json(error('该路由已被弹窗引用，无法删除', 400));

  db.prepare('DELETE FROM app_routes WHERE id = ?').run(id);
  cmsLogService.log(req, 'popup_route:delete', 'app_route', String(id), { route_key: row.route_key });
  return res.json(success(null, '删除成功'));
}

// ==================== 统计 ====================

function getStatsDashboard(req, res) {
  const startDate = req.query.start_date || '';
  const endDate = req.query.end_date || '';

  let where = 'WHERE 1=1';
  const params = [];
  if (startDate) {
    where += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    where += ' AND date <= ?';
    params.push(endDate);
  }

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(shows), 0) as total_show,
      COALESCE(SUM(clicks), 0) as total_click,
      COALESCE(SUM(closes), 0) as total_close
    FROM popup_daily_stats ${where}
  `).get(...params);

  const ctr = row.total_show > 0 ? (row.total_click / row.total_show * 100).toFixed(2) : '0.00';

  return res.json(success({
    total_show: row.total_show,
    total_click: row.total_click,
    total_close: row.total_close,
    ctr: parseFloat(ctr)
  }));
}

function getStatsDetail(req, res) {
  const popupId = req.query.popup_id;
  const startDate = req.query.start_date || '';
  const endDate = req.query.end_date || '';
  const page = parseInt(req.query.page, 10) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 30));
  const offset = (page - 1) * size;

  let where = 'WHERE 1=1';
  const params = [];
  if (popupId) {
    where += ' AND popup_id = ?';
    params.push(popupId);
  }
  if (startDate) {
    where += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    where += ' AND date <= ?';
    params.push(endDate);
  }

  const list = db.prepare(`
    SELECT s.*, p.name as popup_name
    FROM popup_daily_stats s
    LEFT JOIN popups p ON p.id = s.popup_id
    ${where}
    ORDER BY s.date DESC, p.priority DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  const total = db.prepare(`SELECT COUNT(*) as count FROM popup_daily_stats ${where}`).get(...params).count;

  // 关闭渠道汇总
  const closeChannels = db.prepare(`
    SELECT
      SUM(close_btn) as close_btn,
      SUM(mask) as mask,
      SUM(back) as back,
      SUM(swipe) as swipe
    FROM popup_daily_stats ${where}
  `).get(...params);

  return res.json(success({
    list,
    close_channels: closeChannels,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function exportEvents(req, res) {
  const startDate = req.query.start_date || '';
  const endDate = req.query.end_date || '';
  const popupId = req.query.popup_id || '';

  let where = 'WHERE 1=1';
  const params = [];
  if (startDate) {
    where += ' AND date(e.event_time) >= ?';
    params.push(startDate);
  }
  if (endDate) {
    where += ' AND date(e.event_time) <= ?';
    params.push(endDate);
  }
  if (popupId) {
    where += ' AND e.popup_id = ?';
    params.push(popupId);
  }

  const rows = db.prepare(`
    SELECT e.*, p.name as popup_name
    FROM popup_events e
    LEFT JOIN popups p ON p.id = e.popup_id
    ${where}
    ORDER BY e.id DESC
    LIMIT 50000
  `).all(...params);

  const headers = ['event_id', 'popup_id', 'popup_name', 'user_id', 'device_id', 'page', 'event_type', 'trigger', 'close_way', 'app_version', 'os_type', 'event_time'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.id, r.popup_id, r.popup_name || '', r.user_id || '', r.device_id || '', r.page || '',
      r.event_type, r.trigger || '', r.close_way || '', r.app_version || '', r.os_type || '', r.event_time
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }

  const filename = `popup-events-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send('\uFEFF' + lines.join('\n'));
}

// ==================== 全局设置 ====================

function getGlobalConfig(req, res) {
  const rows = db.prepare(`
    SELECT config_key, config_value FROM app_configs
    WHERE config_key IN ('popup_global_enabled', 'popup_daily_limit')
  `).all();
  const config = {};
  for (const row of rows) config[row.config_key] = row.config_value;
  return res.json(success({
    popup_global_enabled: config.popup_global_enabled !== '0',
    popup_daily_limit: Math.max(1, parseInt(config.popup_daily_limit || '3', 10) || 3)
  }));
}

function updateGlobalConfig(req, res) {
  const { popup_global_enabled, popup_daily_limit } = req.body || {};
  const stmt = db.prepare(`
    INSERT INTO app_configs (config_key, config_value)
    VALUES (?, ?)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_at = CURRENT_TIMESTAMP
  `);

  if (popup_global_enabled !== undefined) {
    stmt.run('popup_global_enabled', popup_global_enabled ? '1' : '0');
  }
  if (popup_daily_limit !== undefined) {
    const limit = Math.max(1, parseInt(popup_daily_limit, 10) || 3);
    stmt.run('popup_daily_limit', String(limit));
  }

  cmsLogService.log(req, 'popup_global:update', 'app_config', '', req.body);
  return res.json(success(null, '保存成功'));
}

module.exports = {
  listPopups,
  getPopupById,
  createPopup,
  updatePopup,
  removePopup,
  copyPopup,
  batchStatus,
  batchDelete,
  listWhitelist,
  createWhitelist,
  updateWhitelist,
  removeWhitelist,
  listRoutes,
  createRoute,
  updateRoute,
  removeRoute,
  getStatsDashboard,
  getStatsDetail,
  exportEvents,
  getGlobalConfig,
  updateGlobalConfig
};
