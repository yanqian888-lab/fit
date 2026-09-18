#!/bin/bash
set -e

# ============================================================
# 后端增量同步到测试环境
# 用法：./scripts/sync-backend-test.sh
# 流程约定：本地改动先部署测试环境验证，通过后再发生产
# 注意：不会删除测试环境 public/uploads 中的文件
# ============================================================

REMOTE_HOST="root@39.96.67.113"
REMOTE_DIR="/opt/jianfeidazi"
PM2_NAME="fit-backend-test"

echo "====================================="
echo "  后端增量同步 - 测试环境"
echo "====================================="

echo "[1/2] 同步 backend 代码..."
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

echo "[2/2] 重启 PM2 服务..."
ssh "${REMOTE_HOST}" "cd ${REMOTE_DIR}/backend && pm2 reload ${PM2_NAME}"

echo ""
echo "✅ 后端同步完成（测试环境）"
echo "查看日志：pm2 logs ${PM2_NAME}"
