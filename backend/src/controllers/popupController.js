/**
 * C 端弹窗广告接口
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str || '{}');
  } catch (e) {
    return fallback;
  }
}

function getNow() {
  return new Date().toISOString();
}

// 将 CMS 录入的北京时间字符串解析为时间戳（兼容 '2026-07-07 00:00:00' 和 ISO 格式）
function parseChinaTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes('T')) {
    return new Date(s).getTime();
  }
  return new Date(s.replace(' ', 'T') + '+08:00').getTime();
}

function getIdentifier(userId, deviceId) {
  if (userId) {
    return { identifier: `u${userId}`, identifier_type: 'user' };
  }
  if (deviceId) {
    return { identifier: deviceId, identifier_type: 'device' };
  }
  return null;
}

function getStat(popupId, identifier, identifierType) {
  return db.prepare(`
    SELECT * FROM popup_user_stats
    WHERE popup_id = ? AND identifier = ? AND identifier_type = ?
  `).get(popupId, identifier, identifierType);
}

function getPeriodShowCount(popupId, identifier, identifierType, period) {
  if (period === 'forever') {
    const stat = getStat(popupId, identifier, identifierType);
    return stat ? stat.show_count : 0;
  }

  let timeFilter;
  if (period === 'day') {
    timeFilter = `date(event_time, '+8 hours') = date('now', '+8 hours')`;
  } else if (period === 'week') {
    timeFilter = `datetime(event_time, '+8 hours') >= datetime('now', '+8 hours', '-7 days')`;
  } else {
    return 0;
  }

  // popup_events 表没有 identifier 列，按 identifier_type 分别查询 user_id 或 device_id
  let sql;
  let param;
  if (identifierType === 'user') {
    const userId = String(identifier).replace(/^u/, '');
    sql = `
      SELECT COUNT(*) as count FROM popup_events
      WHERE popup_id = ? AND user_id = ? AND event_type = 'show' AND ${timeFilter}
    `;
    param = userId;
  } else {
    sql = `
      SELECT COUNT(*) as count FROM popup_events
      WHERE popup_id = ? AND device_id = ? AND event_type = 'show' AND ${timeFilter}
    `;
    param = identifier;
  }
  const row = db.prepare(sql).get(popupId, param);
  return row ? row.count : 0;
}

function filterByFrequency(popups, identifier, identifierType) {
  if (!identifier) return popups;
  return popups.filter(p => {
    if (p.one_time) {
      const stat = getStat(p.id, identifier, identifierType);
      if (stat && stat.show_count > 0) return false;
    }
    if (p.frequency_max > 0) {
      const count = getPeriodShowCount(p.id, identifier, identifierType, p.frequency_period || 'day');
      if (count >= p.frequency_max) return false;
    }
    return true;
  });
}

function upsertStat(popupId, identifier, identifierType, eventType) {
  if (!identifier || !identifierType) return;
  const now = getNow();
  const stat = getStat(popupId, identifier, identifierType);
  if (stat) {
    const updates = [];
    const params = [];
    if (eventType === 'show') {
      updates.push('show_count = show_count + 1');
      updates.push('last_show_at = ?');
      params.push(now);
      if (!stat.first_show_at) {
        updates.push('first_show_at = ?');
        params.push(now);
      }
    } else if (eventType === 'click') {
      updates.push('click_count = click_count + 1');
      updates.push('last_click_at = ?');
      params.push(now);
    } else if (eventType === 'close') {
      updates.push('close_count = close_count + 1');
      updates.push('last_close_at = ?');
      params.push(now);
    }
    if (updates.length === 0) return;
    params.push(now, stat.id);
    db.prepare(`UPDATE popup_user_stats SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...params);
  } else {
    const insert = db.prepare(`
      INSERT INTO popup_user_stats (popup_id, identifier, identifier_type, show_count, click_count, close_count,
        first_show_at, last_show_at, last_click_at, last_close_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const showCount = eventType === 'show' ? 1 : 0;
    const clickCount = eventType === 'click' ? 1 : 0;
    const closeCount = eventType === 'close' ? 1 : 0;
    insert.run(
      popupId,
      identifier,
      identifierType,
      showCount,
      clickCount,
      closeCount,
      eventType === 'show' ? now : null,
      eventType === 'show' ? now : null,
      eventType === 'click' ? now : null,
      eventType === 'close' ? now : null,
      now,
      now
    );
  }
}

// 语义化版本号比较
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

/**
 * 获取当前弹窗全局配置与可用弹窗列表
 * GET /api/app/popup/config/list
 */
function getConfigList(req, res) {
  const userId = req.userId || null;
  const { app_version, os_type, device_id } = req.query;

  if (!device_id) {
    return res.status(400).json(error('缺少设备标识 device_id', 400));
  }

  // 获取当前登录用户的对外 user_id（6 位字母+数字）
  const userRow = userId ? db.prepare('SELECT user_id FROM users WHERE id = ?').get(userId) : null;
  const userCode = userRow ? userRow.user_id : '';

  // 全局配置
  const globalRows = db.prepare(`
    SELECT config_key, config_value FROM app_configs
    WHERE config_key IN ('popup_global_enabled', 'popup_daily_limit')
  `).all();
  const globalConfig = {};
  for (const row of globalRows) {
    globalConfig[row.config_key] = row.config_value;
  }

  const globalEnabled = globalConfig.popup_global_enabled !== '0';
  const dailyLimit = Math.max(1, parseInt(globalConfig.popup_daily_limit || '3', 10) || 3);

  const nowMs = Date.now();

  // 取已启用弹窗，在 JS 层按北京时间统一比较，避免服务器时区/字符串比较歧义
  const rows = db.prepare(`
    SELECT * FROM popups
    WHERE status = 'enabled'
    ORDER BY priority DESC, sort_order ASC, id DESC
  `).all();

  const routeIds = new Set();
  rows.forEach(p => {
    if (p.jump_type === 'internal' && p.jump_route_id) {
      routeIds.add(p.jump_route_id);
    }
  });

  const routeMap = {};
  if (routeIds.size > 0) {
    const placeholders = Array.from(routeIds).map(() => '?').join(',');
    db.prepare(`SELECT id, route_key, path, params_schema FROM app_routes WHERE id IN (${placeholders})`)
      .all(...routeIds)
      .forEach(r => {
        routeMap[r.id] = r;
      });
  }

  const popups = [];
  for (const p of rows) {
    // 用户定向过滤
    const targetUsers = safeJsonParse(p.target_users, []);
    if (targetUsers.length > 0 && !targetUsers.includes(userCode)) {
      continue;
    }

    // 生效时间过滤（北京时间）
    const startMs = parseChinaTime(p.start_time);
    const endMs = parseChinaTime(p.end_time);
    if (startMs && nowMs < startMs) continue;
    if (endMs && nowMs > endMs) continue;

    // OS 过滤
    if (os_type) {
      const osList = safeJsonParse(p.os_type, ['ios', 'android', 'h5', 'mp-weixin']);
      if (Array.isArray(osList) && osList.length > 0 && !osList.includes(os_type)) {
        continue;
      }
    }

    // 版本号语义化比较
    if (app_version && p.version_min && compareVersion(app_version, p.version_min) < 0) continue;
    if (app_version && p.version_max && compareVersion(app_version, p.version_max) > 0) continue;

    const item = {
      id: p.id,
      name: p.name,
      style: p.style,
      type: p.type,
      priority: p.priority,
      image_url: p.image_url,
      title: p.title,
      content: p.content,
      show_close_button: p.show_close_button === 1,
      mask_closeable: p.mask_closeable === 1,
      jump_type: p.jump_type,
      jump_url: p.jump_url || '',
      jump_params: safeJsonParse(p.jump_params, {}),
      scope_type: p.scope_type,
      scope_pages: safeJsonParse(p.scope_pages, []),
      excluded_pages: safeJsonParse(p.excluded_pages, []),
      trigger_type: p.trigger_type,
      trigger_delay_seconds: p.trigger_delay_seconds || 0,
      frequency_period: p.frequency_period,
      frequency_max: p.frequency_max,
      one_time: p.one_time === 1,
      wifi_only: p.wifi_only === 1
    };

    if (p.jump_type === 'internal' && p.jump_route_id && routeMap[p.jump_route_id]) {
      const r = routeMap[p.jump_route_id];
      item.jump_route_key = r.route_key;
      item.jump_route_path = r.path || '';
      item.jump_route_params_schema = safeJsonParse(r.params_schema, {});
    }

    popups.push(item);
  }

  // 服务端频次过滤（按用户/设备）
  const { identifier, identifier_type } = getIdentifier(userId, device_id) || {};
  const filteredPopups = filterByFrequency(popups, identifier, identifier_type);

  // 下发启用状态的白名单域名，供客户端二次校验
  const whitelist = db.prepare(`SELECT domain FROM h5_whitelist WHERE status = 'enabled' ORDER BY id DESC`).all().map(r => r.domain);

  return res.json(success({
    global: {
      enabled: globalEnabled,
      daily_limit: dailyLimit,
      block_pages: ['pages/pay/index', 'pages/pay/checkout', 'pages/user/realname', 'pages/user/privacy']
    },
    popups: filteredPopups,
    whitelist
  }));
}

/**
 * 批量上报弹窗事件
 * POST /api/app/popup/report
 */
function reportEvents(req, res) {
  const userId = req.userId || null;
  const { device_id, app_version, os_type, events } = req.body || {};

  if (!device_id) {
    return res.status(400).json(error('缺少设备标识 device_id', 400));
  }

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json(error('上报事件不能为空', 400));
  }

  const validTypes = ['show', 'click', 'close'];
  const validCloseWays = ['close_btn', 'mask', 'back', 'swipe'];
  const now = getNow();
  const date = now.slice(0, 10);
  const { identifier, identifier_type } = getIdentifier(userId, device_id) || {};

  const insertEvent = db.prepare(`
    INSERT INTO popup_events
      (popup_id, user_id, device_id, page, event_type, trigger, close_way, app_version, os_type, event_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initDailyStatStmt = db.prepare(`
    INSERT INTO popup_daily_stats
      (date, popup_id, shows, clicks, closes, close_btn, mask, back, swipe, updated_at)
    VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, ?)
    ON CONFLICT(date, popup_id) DO UPDATE SET updated_at = excluded.updated_at
  `);

  const transaction = db.transaction((items) => {
    for (const ev of items) {
      const popupId = ev.popup_id;
      const type = ev.event_type;
      if (!popupId || !validTypes.includes(type)) continue;

      const closeWay = validCloseWays.includes(ev.close_way) ? ev.close_way : '';
      insertEvent.run(
        popupId,
        userId,
        device_id,
        ev.page || '',
        type,
        ev.trigger || '',
        closeWay,
        app_version || '',
        os_type || '',
        ev.event_time || now,
        now
      );

      initDailyStatStmt.run(date, popupId, now);

      const field = type === 'show' ? 'shows' : type === 'click' ? 'clicks' : 'closes';
      db.prepare(`UPDATE popup_daily_stats SET ${field} = ${field} + 1, updated_at = ? WHERE date = ? AND popup_id = ?`)
        .run(now, date, popupId);

      if (type === 'close' && closeWay) {
        const col = {
          close_btn: 'close_btn',
          mask: 'mask',
          back: 'back',
          swipe: 'swipe'
        }[closeWay];
        if (col) {
          db.prepare(`UPDATE popup_daily_stats SET ${col} = ${col} + 1, updated_at = ? WHERE date = ? AND popup_id = ?`)
            .run(now, date, popupId);
        }
      }

      upsertStat(popupId, identifier, identifier_type, type);
    }
  });

  transaction(events);

  return res.json(success(null, '上报成功'));
}

module.exports = {
  getConfigList,
  reportEvents
};
