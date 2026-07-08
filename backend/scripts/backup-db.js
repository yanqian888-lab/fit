#!/usr/bin/env node
/**
 * SQLite 数据库在线备份脚本
 * 使用 better-sqlite3 的 .backup() 方法，热备不锁库
 *
 * 用法：
 *   NODE_ENV=production node scripts/backup-db.js
 *   # 或加入 cron 每日执行：
 *   # 0 3 * * * cd /opt/jianfeidazi/backend && NODE_ENV=production node scripts/backup-db.js >> /var/log/fit-db-backup.log 2>&1
 */

// 通过统一配置加载环境变量，确保 .env / .env.${NODE_ENV} 优先级一致
const config = require('../src/config');

const fs = require('fs');
const path = require('path');

const dbPath = config.db.path;
const keepDays = parseInt(process.env.DB_BACKUP_KEEP_DAYS, 10) || 14;

if (!fs.existsSync(dbPath)) {
  console.error(`[backup-db] 数据库文件不存在: ${dbPath}`);
  process.exit(1);
}

const dbDir = path.dirname(dbPath);
const backupDir = path.join(dbDir, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const now = new Date();
const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
const backupName = `app_${timestamp}.db`;
const backupPath = path.join(backupDir, backupName);

console.log(`[backup-db] 开始备份 ${dbPath} -> ${backupPath}`);

(async () => {
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);

    // db.backup() 返回 Promise，必须等待完成后再关闭连接
    const info = await db.backup(backupPath);
    console.log(`[backup-db] 备份完成: ${backupName}`);
    console.log(`[backup-db] 备份信息:`, info);

    // 清理过期备份
    const files = fs.readdirSync(backupDir)
      .filter(f => /^app_\d{14}\.db$/.test(f))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const file of files) {
      if (file.mtime < cutoff) {
        fs.unlinkSync(file.path);
        deleted++;
        console.log(`[backup-db] 删除过期备份: ${file.name}`);
      }
    }
    console.log(`[backup-db] 保留 ${files.length - deleted} 份，删除 ${deleted} 份过期备份`);
  } catch (err) {
    console.error('[backup-db] 备份失败:', err.message);
    process.exit(1);
  } finally {
    if (db) {
      try { db.close(); } catch (_) {}
    }
  }
})();
