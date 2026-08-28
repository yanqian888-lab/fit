#!/bin/bash
# ========================================================
# 掉秤搭搭 一键部署脚本
# 用途：将本地最新代码部署到线上服务器（单实例 + SQLite）
# 前置条件：
#   1. 已配置好线上服务器的 SSH 免密登录
#   2. 已修改 REMOTE_HOST / REMOTE_DIR / PM2_NAME 变量
# 注意：生产环境建议先备份数据库
# ========================================================

set -e

# ---------------- 请修改以下配置 ----------------
REMOTE_HOST="root@your-server-ip"      # 线上服务器 SSH 地址
REMOTE_DIR="/path/to/your/fit"         # 线上项目部署目录
PM2_NAME="fit-backend"                 # pm2 应用名称
# ------------------------------------------------

echo "🚀 开始构建前端..."
cd "$(dirname "$0")/frontend"
npm run build:mp-weixin:prod

echo "📦 同步代码到线上服务器..."
# 同步 backend 和 frontend 源码（排除 node_modules / data / dist 等）
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='data' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.git' \
  "$(dirname "$0")/backend/" "${REMOTE_HOST}:${REMOTE_DIR}/backend/"

rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.git' \
  "$(dirname "$0")/frontend/" "${REMOTE_HOST}:${REMOTE_DIR}/frontend/"

echo "🔧 线上安装依赖并重启服务..."
ssh "${REMOTE_HOST}" "
  cd ${REMOTE_DIR}/backend
  npm install --production
  cd ${REMOTE_DIR}/frontend
  npm install
  npm run build:mp-weixin:prod
  pm2 restart ${PM2_NAME}
"

echo "✅ 部署完成！"
