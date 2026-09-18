#!/bin/bash
# ============================================================
# 生产数据库每日备份（SQLite 在线备份）
# 用法：./backup-db-prod.sh        手动执行一次备份
#       ./backup-db-prod.sh cron   安装每日 03:30 定时任务
# 保留最近 14 天备份，自动清理过期文件
# ============================================================
set -e

REMOTE_HOST="root@39.96.67.113"
REMOTE_DIR="/opt/jianfeidazi/backend"
BACKUP_DIR="/opt/backup/fit-prod"
# 生产后端实际使用 app_production.db（.env.production: DB_PATH=./data/app_production.db）
DB_NAME="app_production.db"
KEEP_DAYS=14

if [ "$1" = "cron" ]; then
  SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/backup-db-prod.sh"
  CRON_LINE="30 3 * * * $SCRIPT_PATH >> /tmp/fit-backup.log 2>&1"
  (crontab -l 2>/dev/null | grep -v 'backup-db-prod.sh'; echo "$CRON_LINE") | crontab -
  echo "✅ 已安装每日 03:30 自动备份定时任务"
  crontab -l | grep backup-db-prod
  exit 0
fi

echo "[备份] 生产数据库 → ${REMOTE_HOST}:${BACKUP_DIR}"
ssh "${REMOTE_HOST}" "
  set -e
  mkdir -p ${BACKUP_DIR}
  TS=\$(date +%Y%m%d-%H%M%S)
  sqlite3 ${REMOTE_DIR}/data/${DB_NAME} \".backup '${BACKUP_DIR}/${DB_NAME}-\${TS}.db'\"
  # 清理超过保留期的备份
  find ${BACKUP_DIR} -name '${DB_NAME}-*.db' -mtime +${KEEP_DAYS} -delete
  ls -lh ${BACKUP_DIR}/ | tail -5
  echo '备份文件数:' \$(ls ${BACKUP_DIR}/${DB_NAME}-*.db 2>/dev/null | wc -l)
"
echo "✅ 备份完成"
