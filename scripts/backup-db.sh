#!/bin/bash
set -e

# ============================================================
# 数据库备份脚本
# 用法：
#   ./scripts/backup-db.sh test
#   ./scripts/backup-db.sh prod
# ============================================================

ENV=$1

if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
  echo ""
  echo "错误：请指定备份环境"
  echo "用法："
  echo "  ./scripts/backup-db.sh test"
  echo "  ./scripts/backup-db.sh prod"
  echo ""
  exit 1
fi

BACKUP_DIR="/opt/backup/fit-$ENV"
DB_DIR="/opt/jianfeidazi/backend/data"

if [[ "$ENV" == "test" ]]; then
  DB_NAME="app_test.db"
else
  DB_NAME="app_production.db"
fi

DB_FILE="$DB_DIR/$DB_NAME"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME%.db}_$TIMESTAMP.db"

if [ ! -f "$DB_FILE" ]; then
  echo "数据库文件不存在，跳过备份：$DB_FILE"
  exit 0
fi

mkdir -p "$BACKUP_DIR"
cp "$DB_FILE" "$BACKUP_FILE"

echo "✅ 数据库已备份：$BACKUP_FILE"

# 可选：保留最近 30 份备份，删除更旧的
ls -1t "$BACKUP_DIR"/*.db | tail -n +31 | xargs -r rm -f
