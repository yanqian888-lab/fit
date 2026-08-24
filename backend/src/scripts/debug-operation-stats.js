/**
 * 运营数据接口排错脚本：逐条执行 dashboard 的 SQL，打印每条耗时/结果/报错
 * 用法：DEBUG_DB_PATH=./data/app_production.db node src/scripts/debug-operation-stats.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });

const { db, initTables, migrateTables } = require('../db');

/**
 * 安全执行一条 SQL，捕获异常不中断后续，打印信息
 */
function safeExec(label, sql, params = []) {
  const t0 = Date.now();
  try {
    const isSelect = /^\s*SELECT/i.test(sql);
    const result = isSelect
      ? (/\sCOUNT\(|\sCOALESCE\(|\sLIMIT\s+1\b|FROM \([^)]*\)\s*$/i.test(sql) && /COUNT\(DISTINCT|as count/.test(sql) ? db.prepare(sql).get(...params) : db.prepare(sql).all(...params))
      : db.prepare(sql).run(...params);
    const dt = Date.now() - t0;
    const preview = Array.isArray(result) ? `rows=${result.length}` : JSON.stringify(result).slice(0, 120);
    console.log(`✅ [${dt}ms] ${label} → ${preview}`);
    return { ok: true, result };
  } catch (e) {
    const dt = Date.now() - t0;
    console.log(`❌ [${dt}ms] ${label} → ERROR: ${e.message}`);
    console.log(`   SQL: ${sql.replace(/\s+/g, ' ').trim().slice(0, 200)}`);
    console.log(`   Params:`, params);
    return { ok: false, error: e };
  }
}

function main() {
  // 先建表+迁移，确保 schema 完整（不影响已有数据）
  try { initTables(); } catch (e) { console.log('⚠️ initTables 跳过:', e.message); }
  try { migrateTables(); } catch (e) { console.log('⚠️ migrateTables 跳过:', e.message); }
  const dbPath = process.env.DB_PATH || './data/app.db';
  console.log(`🗄️  使用数据库：${dbPath}\n`);

  // 1. 检查所有会用到的表是否存在
  const TABLES = ['users', 'chat_messages', 'diet_records', 'exercise_records',
    'body_records', 'habit_records', 'fasting_records', 'checkins', 'pet_states',
    'announcements', 'user_announcements', 'popup_daily_stats', 'popups', 'template_messages'];
  console.log('📋 第1步：检查表是否存在');
  for (const t of TABLES) {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t);
    console.log(row ? `  ✅ ${t} 存在` : `  ❌ ${t} 不存在！！！`);
  }

  // 2. 检查 users 表必要字段
  console.log('\n📋 第2步：检查 users 表字段');
  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  ['last_login_at', 'created_at'].forEach(col => {
    console.log(userCols.includes(col) ? `  ✅ users.${col}` : `  ❌ 缺少 users.${col}`);
  });

  // 3. 模拟 dashboard 里的 SQL
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() + 8 * 3600 * 1000 - 86400000).toISOString().split('T')[0];
  const s = today, e = today, ps = yesterday, pe = yesterday;
  console.log(`\n📋 第3步：执行 dashboard 核心 SQL（区间：${s} ~ ${e}）`);

  safeExec('总用户数', 'SELECT COUNT(*) as count FROM users');
  safeExec('今日新增用户', 'SELECT COUNT(*) as count FROM users WHERE date(created_at) BETWEEN ? AND ?', [s, e]);

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
  safeExec('今日活跃数(UNION)', `SELECT COUNT(DISTINCT user_id) as count FROM (${ACTIVE_UNION})`,
    [s, e, s, e, s, e, s, e, s, e, s, e, s, e, s, e]);
  safeExec('昨日活跃数(UNION)', `SELECT COUNT(DISTINCT user_id) as count FROM (${ACTIVE_UNION})`,
    [ps, pe, ps, pe, ps, pe, ps, pe, ps, pe, ps, pe, ps, pe, ps, pe]);

  safeExec('今日签到人数', 'SELECT COUNT(*) as count FROM checkins WHERE checkin_date BETWEEN ? AND ?', [s, e]);

  safeExec('今日记录人数', `
    SELECT COUNT(DISTINCT user_id) as count FROM (
      SELECT user_id FROM diet_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM exercise_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM body_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM habit_records WHERE date(created_at) BETWEEN ? AND ?
      UNION SELECT user_id FROM fasting_records WHERE date(created_at) BETWEEN ? AND ?
    )`, [s, e, s, e, s, e, s, e, s, e]);

  safeExec('今日宠物互动人数', `
    SELECT COUNT(DISTINCT user_id) as count FROM pet_states
    WHERE date(updated_at) BETWEEN ? AND ? AND (daily_interact_count > 0 OR daily_feed_count > 0 OR daily_exercise_count > 0)
  `, [s, e]);

  safeExec('公告漏斗', `
    SELECT
      COALESCE(SUM(ua.show_count), 0) as total_show,
      COALESCE(SUM(CASE WHEN ua.click_at IS NOT NULL THEN 1 ELSE 0 END), 0) as total_click,
      COALESCE(SUM(CASE WHEN ua.status IN ('read', 'clicked') THEN 1 ELSE 0 END), 0) as total_read
    FROM announcements a
    LEFT JOIN user_announcements ua ON ua.announcement_id = a.id
  `);

  safeExec('弹窗漏斗', `
    SELECT COALESCE(SUM(shows), 0) as total_show, COALESCE(SUM(clicks), 0) as total_click,
           COALESCE(SUM(closes), 0) as total_close
    FROM popup_daily_stats
  `);

  safeExec('模板消息漏斗', `
    SELECT COUNT(*) as total_sent,
           COALESCE(SUM(CASE WHEN tm.is_read = 1 THEN 1 ELSE 0 END), 0) as total_read
    FROM template_messages tm
  `);

  console.log('\n🎉 调试完成，看看上面哪条 SQL 标了 ❌，就是它导致的后端报错！');
}

main();
