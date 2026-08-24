/**
 * CMS 运营数据看板
 *
 * 设计原则：就算数据库缺表/缺字段导致单条 SQL 报错，
 * 整个接口也必须降级返回 success() + 默认零值，
 * 避免前端页面崩溃（"Cannot read property 'xxx' of undefined"类报错）。
 * 真实错误会打印到服务端日志便于排查。
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

/**
 * 默认空值（与前端 DEFAULT_DASHBOARD 保持一致），出错时兜底使用
 */
const EMPTY_DASHBOARD = {
  range: { is_range: false, start: null, end: null, prev_start: null, prev_end: null },
  overview: {
    total_users: 0, today_new_users: 0, today_active_users: 0,
    yesterday_active_users: 0, dau_change_rate: 0,
    today_checkin_users: 0, checkin_rate: 0,
    today_record_users: 0, record_rate: 0,
    today_pet_interact_users: 0, pet_interact_rate: 0
  },
  announcement: { total_show: 0, total_click: 0, total_read: 0, ctr: 0, read_rate: 0 },
  popup: { total_show: 0, total_click: 0, total_close: 0, ctr: 0 },
  template: { total_sent: 0, total_read: 0, read_rate: 0 }
};

function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str || JSON.stringify(fallback));
  } catch (e) {
    return fallback;
  }
}

function buildDateWhere(alias, startDate, endDate, params) {
  let where = '';
  if (startDate) {
    where += ` AND ${alias} >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    where += ` AND ${alias} <= ?`;
    params.push(endDate);
  }
  return where;
}

/**
 * 运营数据总览
 * GET /cms/operation-stats/dashboard
 */
function dashboard(req, res) {
  try {
    const { start_date, end_date } = req.query;

    // 东八区今日/昨日日期
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() + 8 * 3600 * 1000 - 86400000).toISOString().split('T')[0];

    // 统计区间：默认今天；选择日期范围后按范围统计，对比区间为前一个等长区间
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const hasRange = DATE_RE.test(start_date || '') && DATE_RE.test(end_date || '') && start_date <= end_date;
    const s = hasRange ? start_date : today;
    const e = hasRange ? end_date : today;
    let ps = yesterday, pe = yesterday;
    if (hasRange) {
      const days = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
      pe = new Date(new Date(s + 'T00:00:00Z').getTime() - 86400000).toISOString().split('T')[0];
      ps = new Date(new Date(s + 'T00:00:00Z').getTime() - days * 86400000).toISOString().split('T')[0];
    }

    // 活跃用户并集（登录/聊天/记录/签到/宠物互动）
    const ACTIVE_UNION = `
      SELECT id as user_id FROM users WHERE date(last_login_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM chat_messages WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM diet_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM exercise_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM body_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM habit_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM checkins WHERE checkin_date BETWEEN ? AND ?
      UNION SELECT user_id FROM pet_states WHERE date(updated_at) BETWEEN ? AND ? AND (daily_interact_count > 0 OR daily_feed_count > 0 OR daily_exercise_count > 0)
    `;
    /**
     * 安全的单值计数查询，失败返回 0（避免某张表缺失导致整条UNION报错）
     */
    function safeCount(sql, params = []) {
      try {
        const row = db.prepare(sql).get(...params);
        return row ? (row.count ?? 0) : 0;
      } catch (err) {
        console.error('[operation-stats] safeCount 失败:', err.message, 'SQL片段:', sql.slice(0, 120).replace(/\s+/g, ' '));
        return 0;
      }
    }
    const countActive = (a, b) => safeCount(
      `SELECT COUNT(DISTINCT user_id) as count FROM (${ACTIVE_UNION})`,
      [a, b, a, b, a, b, a, b, a, b, a, b, a, b, a, b]
    );

    // 用户总览
    const totalUsers = safeCount('SELECT COUNT(*) as count FROM users');
    const todayNewUsers = safeCount('SELECT COUNT(*) as count FROM users WHERE date(created_at) BETWEEN ? AND ?', [s, e]);
    const todayActiveUsers = countActive(s, e);
    const yesterdayActiveUsers = countActive(ps, pe);

    const dauChangeRate = yesterdayActiveUsers > 0
      ? parseFloat(((todayActiveUsers - yesterdayActiveUsers) / yesterdayActiveUsers * 100).toFixed(2))
      : (todayActiveUsers > 0 ? 100 : 0);

    // 签到
    const todayCheckinUsers = safeCount('SELECT COUNT(*) as count FROM checkins WHERE checkin_date BETWEEN ? AND ?', [s, e]);
    const checkinRate = todayActiveUsers > 0
      ? parseFloat((todayCheckinUsers / todayActiveUsers * 100).toFixed(2))
      : 0;

    // 记录统计
    const todayRecordUsers = safeCount(`
      SELECT COUNT(DISTINCT user_id) as count FROM (
        SELECT user_id FROM diet_records WHERE date(created_at) BETWEEN ? AND ?
        UNION
        SELECT user_id FROM exercise_records WHERE date(created_at) BETWEEN ? AND ?
        UNION
        SELECT user_id FROM body_records WHERE date(created_at) BETWEEN ? AND ?
        UNION
        SELECT user_id FROM habit_records WHERE date(created_at) BETWEEN ? AND ?
        UNION
        SELECT user_id FROM fasting_records WHERE date(created_at) BETWEEN ? AND ?
      )`, [s, e, s, e, s, e, s, e, s, e]);
    const recordRate = todayActiveUsers > 0
      ? parseFloat((todayRecordUsers / todayActiveUsers * 100).toFixed(2))
      : 0;

    // 宠物互动
    const todayPetInteractUsers = safeCount(`
      SELECT COUNT(DISTINCT user_id) as count FROM pet_states
      WHERE date(updated_at) BETWEEN ? AND ? AND (daily_interact_count > 0 OR daily_feed_count > 0 OR daily_exercise_count > 0)
    `, [s, e]);
    const petInteractRate = todayActiveUsers > 0
      ? parseFloat((todayPetInteractUsers / todayActiveUsers * 100).toFixed(2))
      : 0;

    // 公告漏斗
    const annParams = [];
    const annWhere = buildDateWhere('a.start_time', start_date, end_date, annParams);
    let announcementRow = { total_show: 0, total_click: 0, total_read: 0 };
    try {
      announcementRow = db.prepare(`
        SELECT
          COALESCE(SUM(ua.show_count), 0) as total_show,
          COALESCE(SUM(CASE WHEN ua.click_at IS NOT NULL THEN 1 ELSE 0 END), 0) as total_click,
          COALESCE(SUM(CASE WHEN ua.status IN ('read', 'clicked') THEN 1 ELSE 0 END), 0) as total_read
        FROM announcements a
        LEFT JOIN user_announcements ua ON ua.announcement_id = a.id
        WHERE 1=1 ${annWhere}
      `).get(...annParams) || announcementRow;
    } catch (err) {
      console.error('[operation-stats] 公告漏斗查询失败:', err.message);
    }

    // 弹窗漏斗
    const popupParams = [];
    const popupWhere = buildDateWhere('date', start_date, end_date, popupParams);
    let popupRow = { total_show: 0, total_click: 0, total_close: 0 };
    try {
      popupRow = db.prepare(`
        SELECT
          COALESCE(SUM(shows), 0) as total_show,
          COALESCE(SUM(clicks), 0) as total_click,
          COALESCE(SUM(closes), 0) as total_close
        FROM popup_daily_stats
        WHERE 1=1 ${popupWhere}
      `).get(...popupParams) || popupRow;
    } catch (err) {
      console.error('[operation-stats] 弹窗漏斗查询失败:', err.message);
    }

    // 模板消息漏斗
    const tmplParams = [];
    const tmplWhere = buildDateWhere('date(tm.sent_at)', start_date, end_date, tmplParams);
    let templateRow = { total_sent: 0, total_read: 0 };
    try {
      templateRow = db.prepare(`
        SELECT
          COUNT(*) as total_sent,
          COALESCE(SUM(CASE WHEN tm.is_read = 1 THEN 1 ELSE 0 END), 0) as total_read
        FROM template_messages tm
        WHERE 1=1 ${tmplWhere}
      `).get(...tmplParams) || templateRow;
    } catch (err) {
      console.error('[operation-stats] 模板消息漏斗查询失败:', err.message);
    }

    return res.json(success({
      range: { is_range: hasRange, start: s, end: e, prev_start: ps, prev_end: pe },
      overview: {
        total_users: totalUsers,
        today_new_users: todayNewUsers,
        today_active_users: todayActiveUsers,
        yesterday_active_users: yesterdayActiveUsers,
        dau_change_rate: dauChangeRate,
        today_checkin_users: todayCheckinUsers,
        checkin_rate: checkinRate,
        today_record_users: todayRecordUsers,
        record_rate: recordRate,
        today_pet_interact_users: todayPetInteractUsers,
        pet_interact_rate: petInteractRate
      },
      announcement: {
        total_show: announcementRow.total_show || 0,
        total_click: announcementRow.total_click || 0,
        total_read: announcementRow.total_read || 0,
        ctr: (announcementRow.total_show || 0) > 0
          ? parseFloat(((announcementRow.total_click || 0) / (announcementRow.total_show || 1) * 100).toFixed(2))
          : 0,
        read_rate: (announcementRow.total_click || 0) > 0
          ? parseFloat(((announcementRow.total_read || 0) / (announcementRow.total_click || 1) * 100).toFixed(2))
          : 0
      },
      popup: {
        total_show: popupRow.total_show || 0,
        total_click: popupRow.total_click || 0,
        total_close: popupRow.total_close || 0,
        ctr: (popupRow.total_show || 0) > 0
          ? parseFloat(((popupRow.total_click || 0) / (popupRow.total_show || 1) * 100).toFixed(2))
          : 0
      },
      template: {
        total_sent: templateRow.total_sent || 0,
        total_read: templateRow.total_read || 0,
        read_rate: (templateRow.total_sent || 0) > 0
          ? parseFloat(((templateRow.total_read || 0) / (templateRow.total_sent || 1) * 100).toFixed(2))
          : 0
      }
    }));
  } catch (err) {
    console.error('[operation-stats] dashboard 整体异常（已降级返回空值）:', err && err.stack || err);
    return res.json(success(EMPTY_DASHBOARD));
  }
}

/**
 * 公告明细
 * GET /cms/operation-stats/announcements
 */
function announcementStats(req, res) {
  try {
    const { start_date, end_date, page = 1, size = 20 } = req.query;
    const limit = parseInt(size, 10) || 20;
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

    const params = [];
    let where = buildDateWhere('a.start_time', start_date, end_date, params);

    let total = 0;
    try {
      total = (db.prepare(`SELECT COUNT(*) as count FROM announcements a WHERE 1=1 ${where}`).get(...params) || {}).count || 0;
    } catch (err) {
      console.error('[operation-stats] 公告明细COUNT失败:', err.message);
    }

    let rows = [];
    try {
      rows = db.prepare(`
        SELECT
          a.id,
          a.title,
          a.type,
          a.position,
          a.status,
          a.start_time,
          a.end_time,
          COALESCE(SUM(ua.show_count), 0) as show_count,
          COALESCE(SUM(CASE WHEN ua.click_at IS NOT NULL THEN 1 ELSE 0 END), 0) as click_count,
          COALESCE(SUM(CASE WHEN ua.status IN ('read', 'clicked') THEN 1 ELSE 0 END), 0) as read_count
        FROM announcements a
        LEFT JOIN user_announcements ua ON ua.announcement_id = a.id
        WHERE 1=1 ${where}
        GROUP BY a.id
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset) || [];
    } catch (err) {
      console.error('[operation-stats] 公告明细LIST失败:', err.message);
      rows = [];
    }

    const list = (rows || []).map(r => ({
      ...r,
      ctr: (r.show_count || 0) > 0 ? parseFloat(((r.click_count || 0) / (r.show_count || 1) * 100).toFixed(2)) : 0,
      read_rate: (r.click_count || 0) > 0 ? parseFloat(((r.read_count || 0) / (r.click_count || 1) * 100).toFixed(2)) : 0
    }));

    return res.json(success({
      list,
      pagination: { page: parseInt(page, 10), size: limit, total, has_more: total > offset + list.length }
    }));
  } catch (err) {
    console.error('[operation-stats] announcementStats 整体异常:', err && err.stack || err);
    return res.json(success({ list: [], pagination: { page: 1, size: 20, total: 0, has_more: false } }));
  }
}

/**
 * 弹窗明细
 * GET /cms/operation-stats/popups
 */
function popupStats(req, res) {
  try {
    const { start_date, end_date, page = 1, size = 20 } = req.query;
    const limit = parseInt(size, 10) || 20;
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

    const joinParams = [];
    const joinWhere = buildDateWhere('s.date', start_date, end_date, joinParams);

    const totalParams = [];
    const totalWhere = buildDateWhere('date', start_date, end_date, totalParams);
    let total = 0;
    try {
      total = (db.prepare(`
        SELECT COUNT(DISTINCT popup_id) as count
        FROM popup_daily_stats
        WHERE 1=1 ${totalWhere}
      `).get(...totalParams) || {}).count || 0;
    } catch (err) {
      console.error('[operation-stats] 弹窗明细COUNT失败:', err.message);
    }

    let rows = [];
    try {
      rows = db.prepare(`
        SELECT
          p.id,
          p.name,
          p.type,
          p.status,
          COALESCE(SUM(s.shows), 0) as show_count,
          COALESCE(SUM(s.clicks), 0) as click_count,
          COALESCE(SUM(s.closes), 0) as close_count,
          COALESCE(SUM(s.close_btn), 0) as close_btn,
          COALESCE(SUM(s.mask), 0) as mask,
          COALESCE(SUM(s.back), 0) as back,
          COALESCE(SUM(s.swipe), 0) as swipe
        FROM popups p
        LEFT JOIN popup_daily_stats s ON s.popup_id = p.id ${joinWhere}
        GROUP BY p.id
        ORDER BY show_count DESC, p.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...joinParams, limit, offset) || [];
    } catch (err) {
      console.error('[operation-stats] 弹窗明细LIST失败（很可能是close_btn/mask/back/swipe字段未迁移）:', err.message);
      // 兜底：只取不依赖新字段的列，保证表格不崩
      try {
        rows = db.prepare(`
          SELECT
            p.id, p.name, p.type, p.status,
            COALESCE(SUM(s.shows), 0) as show_count,
            COALESCE(SUM(s.clicks), 0) as click_count,
            COALESCE(SUM(s.closes), 0) as close_count
          FROM popups p
          LEFT JOIN popup_daily_stats s ON s.popup_id = p.id ${joinWhere}
          GROUP BY p.id
          ORDER BY show_count DESC, p.created_at DESC
          LIMIT ? OFFSET ?
        `).all(...joinParams, limit, offset) || [];
      } catch (e2) {
        console.error('[operation-stats] 弹窗明细降级查询也失败:', e2.message);
        rows = [];
      }
    }

    const list = (rows || []).map(r => ({
      ...r,
      close_btn: r.close_btn ?? 0,
      mask: r.mask ?? 0,
      back: r.back ?? 0,
      swipe: r.swipe ?? 0,
      ctr: (r.show_count || 0) > 0 ? parseFloat(((r.click_count || 0) / (r.show_count || 1) * 100).toFixed(2)) : 0,
      close_rate: (r.show_count || 0) > 0 ? parseFloat(((r.close_count || 0) / (r.show_count || 1) * 100).toFixed(2)) : 0
    }));

    return res.json(success({
      list,
      pagination: { page: parseInt(page, 10), size: limit, total, has_more: total > offset + list.length }
    }));
  } catch (err) {
    console.error('[operation-stats] popupStats 整体异常:', err && err.stack || err);
    return res.json(success({ list: [], pagination: { page: 1, size: 20, total: 0, has_more: false } }));
  }
}

/**
 * 模板消息明细
 * GET /cms/operation-stats/templates
 */
function templateStats(req, res) {
  try {
    const { start_date, end_date } = req.query;

    const params = [];
    let where = buildDateWhere('date(tm.sent_at)', start_date, end_date, params);

    let rows = [];
    try {
      rows = db.prepare(`
        SELECT
          tm.template_type,
          COUNT(*) as sent_count,
          COALESCE(SUM(CASE WHEN tm.is_read = 1 THEN 1 ELSE 0 END), 0) as read_count
        FROM template_messages tm
        WHERE 1=1 ${where}
        GROUP BY tm.template_type
        ORDER BY sent_count DESC
      `).all(...params) || [];
    } catch (err) {
      console.error('[operation-stats] 模板消息LIST失败:', err.message);
      rows = [];
    }

    const typeLabels = {
      breakfast: '早餐提醒',
      lunch: '午餐提醒',
      dinner: '晚餐提醒',
      exercise: '运动提醒',
      wakeup: '唤醒消息'
    };

    const list = (rows || []).map(r => ({
      template_type: r.template_type,
      template_name: typeLabels[r.template_type] || r.template_type,
      sent_count: r.sent_count || 0,
      read_count: r.read_count || 0,
      read_rate: (r.sent_count || 0) > 0 ? parseFloat(((r.read_count || 0) / (r.sent_count || 1) * 100).toFixed(2)) : 0
    }));

    return res.json(success({ list }));
  } catch (err) {
    console.error('[operation-stats] templateStats 整体异常:', err && err.stack || err);
    return res.json(success({ list: [] }));
  }
}

module.exports = {
  dashboard,
  announcementStats,
  popupStats,
  templateStats
};
