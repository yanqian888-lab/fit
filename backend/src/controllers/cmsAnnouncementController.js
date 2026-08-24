/**
 * CMS 公告/消息中心管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const VALID_TYPES = ['banner', 'notice', 'fullscreen', 'message'];
const VALID_STATUSES = ['draft', 'enabled', 'disabled'];
const VALID_TARGET_TYPES = ['all', 'specified_users', 'segments'];
const VALID_JUMPS = ['none', 'internal', 'h5'];
const VALID_POSITIONS = ['home', 'notice', 'message_center', 'splash', 'global'];

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

function isExpired(row) {
  if (!row || !row.end_time) return false;
  return new Date(row.end_time).getTime() < Date.now();
}

function isNotStarted(row) {
  if (!row || !row.start_time) return false;
  return new Date(row.start_time).getTime() > Date.now();
}

function effectiveStatus(row) {
  if (row.status === 'disabled') return 'disabled';
  if (row.status === 'draft') return 'draft';
  if (isExpired(row)) return 'expired';
  if (isNotStarted(row)) return 'pending';
  return 'enabled';
}

function parseTargetUsers(value) {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean);
  if (typeof value === 'string') {
    const lines = value.split(/[,，\n]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
    } catch (e) {}
    return lines;
  }
  return [];
}

function validateAnnouncement(body, isUpdate = false) {
  const {
    title, type, status, position, target_type, start_time, end_time,
    jump_type, jump_route_id, jump_url, priority, max_show_count
  } = body;

  if (!isUpdate && !title) return '公告标题不能为空';
  if (title !== undefined && !String(title).trim()) return '公告标题不能为空';
  if (title !== undefined && String(title).length > 255) return '公告标题最多 255 字符';

  if (type !== undefined && !VALID_TYPES.includes(type)) return '公告类型无效';
  if (status !== undefined && !VALID_STATUSES.includes(status)) return '状态无效';
  if (position !== undefined && !VALID_POSITIONS.includes(position)) return '展示位置无效';
  if (target_type !== undefined && !VALID_TARGET_TYPES.includes(target_type)) return '定向类型无效';

  if (target_type === 'specified_users' || (body.target_users !== undefined && body.target_users)) {
    const users = parseTargetUsers(body.target_users);
    const invalid = users.find(u => !/^[a-zA-Z0-9]{6}$/.test(u));
    if (invalid) return `定向用户ID格式无效：${invalid}（应为6位字母+数字）`;
  }

  if (!isUpdate && !start_time) return '生效开始时间不能为空';
  if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
    return '结束时间必须晚于开始时间';
  }

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
  }

  if (priority !== undefined) {
    const n = Number(priority);
    if (!Number.isInteger(n) || n < 1 || n > 10) return '优先级必须为 1-10 的整数';
  }

  if (max_show_count !== undefined) {
    const m = Number(max_show_count);
    if (!Number.isInteger(m) || m < 0) return '最大曝光次数不能为负数';
  }

  return null;
}

function enrichRow(row) {
  if (!row) return null;
  const targetUsers = safeJsonParse(row.target_users, []);
  const segments = safeJsonParse(row.segments, []);
  const route = row.jump_route_id
    ? db.prepare('SELECT route_key, route_name, path FROM app_routes WHERE id = ?').get(row.jump_route_id)
    : null;
  return {
    ...row,
    target_users: targetUsers,
    target_user_count: targetUsers.length,
    segments,
    jump_params: safeJsonParse(row.jump_params, {}),
    os_type: safeJsonParse(row.os_type, ['ios', 'android', 'h5', 'mp-weixin']),
    effective_status: effectiveStatus(row),
    jump_route: route || null
  };
}

function list(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 20));
  const offset = (page - 1) * size;
  const status = req.query.status || '';
  const type = req.query.type || '';
  const position = req.query.position || '';
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
  if (position && VALID_POSITIONS.includes(position)) {
    where += ' AND position = ?';
    params.push(position);
  }
  if (keyword) {
    where += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM announcements ${where}`).get(...params).count;

  const rows = db.prepare(`
    SELECT id, title, type, position, status, target_type, target_users, priority,
           start_time, end_time, jump_type, jump_route_id, jump_url, created_by, created_at
    FROM announcements ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  const list = rows.map(enrichRow);

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size },
    enums: {
      types: VALID_TYPES,
      statuses: VALID_STATUSES,
      positions: VALID_POSITIONS,
      target_types: VALID_TARGET_TYPES,
      jumps: VALID_JUMPS
    }
  }));
}

function getById(req, res) {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('公告不存在', 404));
  return res.json(success(enrichRow(row)));
}

function create(req, res) {
  const err = validateAnnouncement(req.body);
  if (err) return res.status(400).json(error(err, 400));

  const body = req.body;
  const now = getNow();
  // 站内信无结束时间概念：缺省给一个远期结束时间（end_time 列 NOT NULL）
  if (!body.end_time) body.end_time = '2099-12-31 23:59:59';

  const result = db.prepare(`
    INSERT INTO announcements (
      title, content, type, position, target_type, target_users, segments, status,
      priority, image_url, background_color, text_color, jump_type, jump_route_id, jump_url, jump_params,
      start_time, end_time, version_min, version_max, os_type, max_show_count, dismissible,
      sort_order, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(body.title).trim(),
    body.content || '',
    body.type || 'notice',
    body.position || 'home',
    body.target_type || 'all',
    toJson(parseTargetUsers(body.target_users)),
    toJson(body.segments || []),
    body.status || 'draft',
    Number(body.priority) || 5,
    body.image_url || '',
    body.background_color || '',
    body.text_color || '',
    body.jump_type || 'none',
    body.jump_type === 'internal' ? body.jump_route_id : null,
    body.jump_type === 'h5' ? (body.jump_url || '') : '',
    toJson(body.jump_params),
    body.start_time,
    body.end_time,
    body.version_min || '',
    body.version_max || '',
    toJson(body.os_type || ['ios', 'android', 'h5', 'mp-weixin']),
    Number(body.max_show_count) || 0,
    body.dismissible === false ? 0 : 1,
    Number(body.sort_order) || 0,
    req.cmsUsername || '',
    now,
    now
  );

  const id = result.lastInsertRowid;
  cmsLogService.log(req, 'announcement:create', 'announcement', String(id), { title: body.title });
  return res.json(success({ id }, '创建成功'));
}

function update(req, res) {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  if (!existing) return res.status(404).json(error('公告不存在', 404));

  if (effectiveStatus(existing) === 'expired') {
    return res.status(400).json(error('已过期公告禁止编辑，请复制新建', 400));
  }

  const err = validateAnnouncement(req.body, true);
  if (err) return res.status(400).json(error(err, 400));

  const body = req.body;
  const now = getNow();

  db.prepare(`
    UPDATE announcements SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      type = COALESCE(?, type),
      position = COALESCE(?, position),
      target_type = COALESCE(?, target_type),
      target_users = COALESCE(?, target_users),
      segments = COALESCE(?, segments),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      image_url = COALESCE(?, image_url),
      background_color = COALESCE(?, background_color),
      text_color = COALESCE(?, text_color),
      jump_type = COALESCE(?, jump_type),
      jump_route_id = ?,
      jump_url = COALESCE(?, jump_url),
      jump_params = COALESCE(?, jump_params),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      version_min = COALESCE(?, version_min),
      version_max = COALESCE(?, version_max),
      os_type = COALESCE(?, os_type),
      max_show_count = COALESCE(?, max_show_count),
      dismissible = COALESCE(?, dismissible),
      sort_order = COALESCE(?, sort_order),
      updated_at = ?
    WHERE id = ?
  `).run(
    body.title !== undefined ? String(body.title).trim() : null,
    body.content,
    body.type,
    body.position,
    body.target_type,
    body.target_users !== undefined ? toJson(parseTargetUsers(body.target_users)) : null,
    body.segments !== undefined ? toJson(body.segments) : null,
    body.status,
    body.priority !== undefined ? Number(body.priority) : null,
    body.image_url,
    body.background_color,
    body.text_color,
    body.jump_type,
    body.jump_type === 'internal' ? (body.jump_route_id || existing.jump_route_id) : (body.jump_type !== undefined ? null : existing.jump_route_id),
    body.jump_type === 'h5' ? (body.jump_url || '') : (body.jump_type !== undefined ? '' : existing.jump_url),
    body.jump_params !== undefined ? toJson(body.jump_params) : null,
    body.start_time,
    body.end_time,
    body.version_min,
    body.version_max,
    body.os_type !== undefined ? toJson(body.os_type) : null,
    body.max_show_count !== undefined ? Number(body.max_show_count) : null,
    body.dismissible !== undefined ? (body.dismissible ? 1 : 0) : null,
    body.sort_order !== undefined ? Number(body.sort_order) : null,
    now,
    id
  );

  cmsLogService.log(req, 'announcement:update', 'announcement', String(id), { title: body.title });
  return res.json(success(null, '更新成功'));
}

function remove(req, res) {
  const { id } = req.params;
  const row = db.prepare('SELECT title FROM announcements WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('公告不存在', 404));

  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  cmsLogService.log(req, 'announcement:delete', 'announcement', String(id), { title: row.title });
  return res.json(success(null, '删除成功'));
}

function batchStatus(req, res) {
  const { ids, status } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json(error('请选择公告', 400));
  if (!VALID_STATUSES.includes(status)) return res.status(400).json(error('状态无效', 400));

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE announcements SET status = ?, updated_at = ? WHERE id IN (${placeholders})`)
    .run(status, getNow(), ...ids);

  cmsLogService.log(req, 'announcement:batch_status', 'announcement', '', { ids, status });
  return res.json(success(null, '批量更新成功'));
}

function batchDelete(req, res) {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json(error('请选择公告', 400));

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM announcements WHERE id IN (${placeholders})`).run(...ids);

  cmsLogService.log(req, 'announcement:batch_delete', 'announcement', '', { ids });
  return res.json(success(null, '批量删除成功'));
}

// 通知渠道管理
function listChannels(req, res) {
  const rows = db.prepare(`
    SELECT id, channel_key, channel_name, is_enabled, config, description, sort_order, updated_at
    FROM notification_channels
    ORDER BY sort_order ASC, id ASC
  `).all();
  return res.json(success({
    list: rows.map(r => ({ ...r, config: safeJsonParse(r.config, {}) }))
  }));
}

function updateChannel(req, res) {
  const { id } = req.params;
  const { is_enabled, config, description, sort_order } = req.body || {};

  const existing = db.prepare('SELECT id FROM notification_channels WHERE id = ?').get(id);
  if (!existing) return res.status(404).json(error('渠道不存在', 404));

  const now = getNow();
  db.prepare(`
    UPDATE notification_channels SET
      is_enabled = COALESCE(?, is_enabled),
      config = COALESCE(?, config),
      description = COALESCE(?, description),
      sort_order = COALESCE(?, sort_order),
      updated_at = ?
    WHERE id = ?
  `).run(
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    config !== undefined ? toJson(config) : null,
    description,
    sort_order !== undefined ? Number(sort_order) : null,
    now,
    id
  );

  cmsLogService.log(req, 'notification_channel:update', 'notification_channel', String(id), { is_enabled });
  return res.json(success(null, '更新成功'));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  batchStatus,
  batchDelete,
  listChannels,
  updateChannel
};
