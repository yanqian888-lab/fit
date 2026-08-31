#!/bin/bash
set -e

# ============================================================
# 后端增量同步到生产环境
# 用法：./scripts/sync-backend-prod.sh
# 注意：不会删除生产 public/uploads 中的用户上传文件
# ============================================================

REMOTE_HOST="root@39.96.67.113"
REMOTE_DIR="/opt/jianfeidazi"
PM2_NAME="fit-backend-prod"

echo "====================================="
echo "  后端增量同步 - 生产环境"
echo "====================================="

echo "[1/3] 同步 backend 代码..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='data' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.jwt-secret.txt' \
  --exclude='.git' \
  --exclude='logs' \
  --exclude='*.log' \
  --exclude='public/uploads' \
  "$(dirname "$0")/../backend/" "${REMOTE_HOST}:${REMOTE_DIR}/backend/"

echo "[2/3] 恢复 .jwt-secret.txt..."
ssh "${REMOTE_HOST}" "
  cd ${REMOTE_DIR}/backend
  JWT_SECRET=\$(grep -i '^JWT_SECRET=' .env.production | cut -d= -f2)
  echo \"\$JWT_SECRET\" > .jwt-secret.txt
  chmod 600 .jwt-secret.txt
"

echo "[3/3] 重启 PM2 服务..."
ssh "${REMOTE_HOST}" "cd ${REMOTE_DIR}/backend && pm2 reload ${PM2_NAME}"

echo ""
echo "✅ 后端同步完成"
echo "查看日志：pm2 logs ${PM2_NAME}"
