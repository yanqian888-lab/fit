/**
 * CMS 操作日志服务
 */
const { db } = require('../db');

function log(req, action, targetType = '', targetId = '', detail = null) {
  try {
    const cmsUserId = req.cmsUserId || null;
    if (!cmsUserId) return;

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    db.prepare(`
      INSERT INTO cms_logs (cms_user_id, action, target_type, target_id, detail, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      cmsUserId,
      action,
      targetType,
      String(targetId || ''),
      detail ? JSON.stringify(detail) : '',
      ip
    );
  } catch (err) {
    console.error('[CMS日志] 写入失败:', err.message);
  }
}

module.exports = { log };
