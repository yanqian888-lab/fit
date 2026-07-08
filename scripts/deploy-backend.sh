#!/bin/bash
set -e

# ============================================================
# 后端增量部署脚本
# 用于在已有服务器上更新测试或正式环境后端代码
# 用法：
#   ./scripts/deploy-backend.sh test
#   ./scripts/deploy-backend.sh prod
# ============================================================

ENV=$1

if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
  echo ""
  echo "错误：请指定部署环境"
  echo "用法："
  echo "  ./scripts/deploy-backend.sh test"
  echo "  ./scripts/deploy-backend.sh prod"
  echo ""
  exit 1
fi

PM2_NAME="fit-backend-$ENV"
ENV_FILE=".env.$ENV"

cd /opt/jianfeidazi/backend

echo "====================================="
echo "  后端增量部署 - $ENV 环境"
echo "====================================="

echo "[1/5] 拉取最新代码..."
git pull origin $(git rev-parse --abbrev-ref HEAD)

echo "[2/5] 安装依赖..."
npm install --production

echo "[3/5] 备份数据库..."
../scripts/backup-db.sh "$ENV" || true

echo "[4/5] 初始化/迁移数据库..."
NODE_ENV=$ENV npm run init-db || NODE_ENV=$ENV node src/scripts/init-db.js

echo "[5/5] 重启 PM2 服务..."
pm run "pm2:restart:$ENV" || pm2 restart "$PM2_NAME"
pm2 save

echo ""
echo "✅ $ENV 环境后端部署完成"
echo "查看日志：pm2 logs $PM2_NAME"
