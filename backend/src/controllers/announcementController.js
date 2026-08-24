/**
 * C 端公告/消息中心接口
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str || JSON.stringify(fallback));
  } catch (e) {
    return fallback;
  }
}

function getNow() {
  return new Date().toISOString();
}

function parseChinaTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes('T')) {
    return new Date(s).getTime();
  }
  return new Date(s.replace(' ', 'T') + '+08:00').getTime();
}

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = isNaN(pa[i]) ? 0 : pa[i];
    const nb = isNaN(pb[i]) ? 0 : pb[i];
    if (na !== nb) return na - nb;
  }
  return 0;
}

function getUserCode(userId) {
  const row = db.prepare('SELECT user_id FROM users WHERE id = ?').get(userId);
  return row ? row.user_id : '';
}

function enrichAnnouncement(row, userRecord = null, routeMap = {}) {
  if (!row) return null;
  const item = {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    position: row.position,
    image_url: row.image_url || '',
    background_color: row.background_color || '',
    text_color: row.text_color || '',
    jump_type: row.jump_type,
    jump_url: row.jump_url || '',
    jump_params: safeJsonParse(row.jump_params, {}),
    dismissible: row.dismissible === 1,
    priority: row.priority,
    sort_order: row.sort_order,
    start_time: row.start_time,
    end_time: row.end_time,
    user_status: userRecord ? userRecord.status : 'unread',
    show_count: userRecord ? userRecord.show_count : 0,
    created_at: row.created_at
  };

  if (row.jump_type === 'internal' && row.jump_route_id && routeMap[row.jump_route_id]) {
    const r = routeMap[row.jump_route_id];
    item.jump_route_key = r.route_key;
    item.jump_route_path = r.path || '';
    item.jump_url = r.path || '';
  }

  return item;
}

function ensureUserAnnouncement(userId, announcementId) {
  const now = getNow();
  db.prepare(`
    INSERT OR IGNORE INTO user_announcements (user_id, announcement_id, status, created_at, updated_at)
    VALUES (?, ?, 'unread', ?, ?)
  `).run(userId, announcementId, now, now);
  return db.prepare('SELECT * FROM user_announcements WHERE user_id = ? AND announcement_id = ?').get(userId, announcementId);
}

function filterActiveAnnouncements(rows, options = {}) {
  const { app_version, os_type, position, userCode } = options;
  const nowMs = Date.now();
  return rows.filter(row => {
    if (row.status !== 'enabled') return false;

    const startMs = parseChinaTime(row.start_time);
    const endMs = parseChinaTime(row.end_time);
    if (startMs && nowMs < startMs) return false;
    if (endMs && nowMs > endMs) return false;

    // 消息中心（站内信）是聚合视图：后台发送的所有生效公告都进入消息列表，不按 position 过滤
    if (position && position !== 'message_center' && row.position && row.position !== position) return false;

    if (os_type) {
      const osList = safeJsonParse(row.os_type, ['ios', 'android', 'h5', 'mp-weixin']);
      if (Array.isArray(osList) && osList.length > 0 && !osList.includes(os_type)) return false;
    }

    if (app_version && row.version_min && compareVersion(app_version, row.version_min) < 0) return false;
    if (app_version && row.version_max && compareVersion(app_version, row.version_max) > 0) return false;

    const targetUsers = safeJsonParse(row.target_users, []);
    if (Array.isArray(targetUsers) && targetUsers.length > 0) {
      if (!userCode || !targetUsers.includes(userCode)) return false;
    }

    return true;
  });
}

/**
 * 获取当前用户的公告列表
 * GET /api/app/announcements
 */
function listAnnouncements(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json(error('请先登录', 401));
  }

  const { position = 'home', app_version, os_type, page = 1, size = 20 } = req.query;
  const limit = Math.min(parseInt(size, 10) || 20, 100);
  const offset = Math.max((parseInt(page, 10) || 1) - 1, 0) * limit;
  const userCode = getUserCode(userId);

  // 消息中心（站内信）按发送时间倒序；其他位置按优先级/排序
  const orderSql = position === 'message_center'
    ? 'ORDER BY datetime(start_time) DESC, id DESC'
    : 'ORDER BY priority DESC, sort_order ASC, id DESC';
  const rows = db.prepare(`
    SELECT * FROM announcements
    ${orderSql}
  `).all();

  const filtered = filterActiveAnnouncements(rows, { app_version, os_type, position, userCode });

  const routeIds = new Set();
  filtered.forEach(p => {
    if (p.jump_type === 'internal' && p.jump_route_id) {
      routeIds.add(p.jump_route_id);
    }
  });
  const routeMap = {};
  if (routeIds.size > 0) {
    const placeholders = Array.from(routeIds).map(() => '?').join(',');
    db.prepare(`SELECT id, route_key, path FROM app_routes WHERE id IN (${placeholders})`)
      .all(...routeIds)
      .forEach(r => { routeMap[r.id] = r; });
  }

  const total = filtered.length;
  const pageRows = filtered.slice(offset, offset + limit);

  const list = pageRows.map(row => {
    const userRecord = ensureUserAnnouncement(userId, row.id);
    return enrichAnnouncement(row, userRecord, routeMap);
  });

  return res.json(success({
    list,
    pagination: { page: parseInt(page, 10) || 1, size: limit, total, has_more: total > offset + pageRows.length }
  }));
}

/**
 * 公告详情
 * GET /api/app/announcements/:id
 */
function getAnnouncement(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json(error('请先登录', 401));
  }

  const { id } = req.params;
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  if (!row) return res.status(404).json(error('公告不存在', 404));

  const userRecord = ensureUserAnnouncement(userId, row.id);
  return res.json(success(enrichAnnouncement(row, userRecord)));
}

/**
 * 标记公告已读
 * POST /api/app/announcements/:id/read
 */
function markRead(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json(error('请先登录', 401));
  }

  const { id } = req.params;
  const announcement = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
  if (!announcement) return res.status(404).json(error('公告不存在', 404));

  const now = getNow();
  db.prepare(`
    INSERT INTO user_announcements (user_id, announcement_id, status, created_at, updated_at)
    VALUES (?, ?, 'read', ?, ?)
    ON CONFLICT(user_id, announcement_id) DO UPDATE SET
      status = 'read',
      updated_at = excluded.updated_at
  `).run(userId, id, now, now);

  return res.json(success(null, '已标记为已读'));
}

/**
 * 上报一次曝光（banner/notice 展示时调用）
 * POST /api/app/announcements/:id/show
 */
function recordShow(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json(error('请先登录', 401));
  }

  const { id } = req.params;
  const announcement = db.prepare('SELECT id, max_show_count FROM announcements WHERE id = ?').get(id);
  if (!announcement) return res.status(404).json(error('公告不存在', 404));

  const now = getNow();
  const max = announcement.max_show_count || 0;
  db.prepare(`
    INSERT INTO user_announcements (user_id, announcement_id, status, show_count, first_show_at, last_show_at, created_at, updated_at)
    VALUES (?, ?, 'unread', 1, ?, ?, ?, ?)
    ON CONFLICT(user_id, announcement_id) DO UPDATE SET
      show_count = show_count + 1,
      first_show_at = COALESCE(first_show_at, excluded.first_show_at),
      last_show_at = excluded.last_show_at,
      status = CASE
        WHEN ? > 0 AND show_count + 1 >= ? AND status = 'unread' THEN 'read'
        ELSE status
      END,
      updated_at = excluded.updated_at
  `).run(userId, id, now, now, now, now, max, max);

  return res.json(success(null, '曝光已记录'));
}

/**
 * 全局未读数
 * GET /api/app/notifications/unread-count
 */
function getUnreadCount(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json(error('请先登录', 401));
  }

  const { app_version, os_type } = req.query || {};
  const userCode = getUserCode(userId);

  const rows = db.prepare(`
    SELECT a.*, ua.status as user_status
    FROM user_announcements ua
    JOIN announcements a ON a.id = ua.announcement_id
    WHERE ua.user_id = ? AND ua.status = 'unread' AND a.status = 'enabled'
  `).all(userId);

  const active = filterActiveAnnouncements(rows, { app_version, os_type, userCode });
  return res.json(success({ unread_count: active.length }));
}

/**
 * 通知渠道列表
 * GET /api/app/notifications/channels
 */
function listChannels(req, res) {
  const rows = db.prepare(`
    SELECT id, channel_key, channel_name, is_enabled, description, sort_order
    FROM notification_channels
    WHERE is_enabled = 1
    ORDER BY sort_order ASC, id ASC
  `).all();
  return res.json(success({ list: rows }));
}

module.exports = {
  listAnnouncements,
  getAnnouncement,
  markRead,
  recordShow,
  getUnreadCount,
  listChannels
};
