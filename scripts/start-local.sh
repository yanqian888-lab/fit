#!/bin/bash
# 本地开发环境一键启动脚本
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# 清理已有进程
echo "清理端口 3000, 5174, 8081..."
lsof -ti:3000,5174,8081 | xargs -r kill -9 2>/dev/null || true
sleep 1

# 启动后端
echo "启动后端 API (localhost:3000)..."
cd "$ROOT_DIR/backend"
nohup npm start > "$ROOT_DIR/backend.log" 2>&1 &

# 启动管理后台
echo "启动管理后台 (localhost:5174)..."
cd "$ROOT_DIR/admin"
nohup npm run dev > "$ROOT_DIR/admin.log" 2>&1 &

# 启动 H5
echo "启动 H5 前端 (localhost:8081)..."
cd "$ROOT_DIR/frontend"
nohup npx serve dist/build/h5 -l 8081 --single --no-etag --config "$ROOT_DIR/frontend/serve.h5.json" > "$ROOT_DIR/h5.log" 2>&1 &

echo ""
echo "所有服务已启动："
echo "  后端 API:   http://localhost:3000"
echo "  管理后台:   http://localhost:5174"
echo "  H5 前端:    http://localhost:8081"
echo ""
echo "日志文件："
echo "  $ROOT_DIR/backend.log"
echo "  $ROOT_DIR/admin.log"
echo "  $ROOT_DIR/h5.log"
