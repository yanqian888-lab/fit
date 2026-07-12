#!/bin/bash
set -e

# ============================================================
# 减肥搭子 APP 服务端部署脚本
# 用法：
#   ./deploy.sh test [test-api.yourdomain.com] [--force]
#   ./deploy.sh prod [api.yourdomain.com] [--force]
# 说明：
#   默认情况下，如果 /opt/jianfeidazi 已存在且是 Git 仓库，会执行 git pull
#   增量更新，不会删除数据库与环境变量文件。如需清空重装，请加上 --force。
# ============================================================

ENV=""
DOMAIN=""
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    test|prod)
      ENV=$1
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      DOMAIN=$1
      shift
      ;;
  esac
done

if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
  echo ""
  echo "错误：请指定部署环境"
  echo "用法："
  echo "  ./deploy.sh test [test-api.yourdomain.com] [--force]"
  echo "  ./deploy.sh prod [api.yourdomain.com] [--force]"
  echo ""
  exit 1
fi

if [[ "$ENV" == "test" ]]; then
  PM2_NAME="fit-backend-test"
  PORT=3001
  DEFAULT_DOMAIN="test-api.fitapp.com"
  ENV_FILE=".env.test"
  NGINX_CONF="backend-test.conf"
else
  PM2_NAME="fit-backend-prod"
  PORT=3000
  DEFAULT_DOMAIN="api.fitapp.com"
  ENV_FILE=".env.production"
  NGINX_CONF="backend-prod.conf"
fi

DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
PROJECT_DIR="/opt/jianfeidazi"
REPO_URL="https://github.com/yanqian888-lab/fit.git"

echo "====================================="
echo "  减肥搭子 APP 服务端部署"
echo "  环境：$ENV"
echo "  域名：$DOMAIN"
echo "  端口：$PORT"
echo "====================================="

echo "[1/10] 更新系统并安装基础依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl wget git nginx build-essential python3

echo "[2/10] 安装 Node.js LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "[3/10] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi
pm2 -v

echo "[4/10] 克隆/更新代码..."
if [ -d "$PROJECT_DIR" ]; then
  if [ "$FORCE" == "true" ]; then
    echo "⚠️  检测到 --force，将清空 $PROJECT_DIR 并重新克隆（数据库、.env 等也会被删除）..."
    rm -rf "$PROJECT_DIR"
  elif [ -d "$PROJECT_DIR/.git" ]; then
    echo "目录 $PROJECT_DIR 已存在，执行 git pull 增量更新（如需清空重装请使用 --force）..."
    cd "$PROJECT_DIR"
    git pull origin $(git rev-parse --abbrev-ref HEAD)
  else
    echo "错误：$PROJECT_DIR 已存在且不是 Git 仓库。如需覆盖请使用 --force。"
    exit 1
  fi
fi

if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p /opt
  git clone "$REPO_URL" "$PROJECT_DIR"
fi

cd "$PROJECT_DIR/backend"

echo "[5/10] 安装后端依赖..."
npm install

echo "[6/10] 配置环境变量..."
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_FILE.example" ]; then
    cp "$ENV_FILE.example" "$ENV_FILE"
  else
    cp .env.example "$ENV_FILE"
  fi

  # 生成随机 JWT 密钥
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
  sed -i "s|^PORT=.*|PORT=$PORT|" "$ENV_FILE"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=$ENV|" "$ENV_FILE"

  # 设置数据库路径，确保不同环境隔离
  if [[ "$ENV" == "test" ]]; then
    sed -i "s|^DB_PATH=.*|DB_PATH=./data/app_test.db|" "$ENV_FILE"
  else
    sed -i "s|^DB_PATH=.*|DB_PATH=./data/app_production.db|" "$ENV_FILE"
  fi
fi

echo "当前 $ENV_FILE 关键配置："
grep -E "^PORT=|^NODE_ENV=|^JWT_SECRET=|^DB_PATH=" "$ENV_FILE" || true
echo ""
echo "⚠️  请手动编辑 $PROJECT_DIR/backend/$ENV_FILE，填写真实的："
echo "   - 豆包 API Key 和 Endpoint ID"
echo "   - 微信小程序 AppID / Secret"
echo "   - 腾讯云 COS 配置（如使用）"
echo ""

echo "[7/10] 初始化数据库..."
NODE_ENV=$ENV npm run init-db || NODE_ENV=$ENV node src/scripts/init-db.js

echo "[8/10] 使用 PM2 启动后端服务..."
npm run "pm2:$ENV"
pm2 save

echo "[9/10] 配置 PM2 开机自启..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root || true
pm2 save

echo "[10/10] 配置 Nginx 反向代理..."
cp "$PROJECT_DIR/nginx/$NGINX_CONF" /etc/nginx/sites-available/jianfeidazi-$ENV
# 替换域名占位符
sed -i "s|server_name .*;|server_name $DOMAIN;|" /etc/nginx/sites-available/jianfeidazi-$ENV

ln -sf /etc/nginx/sites-available/jianfeidazi-$ENV /etc/nginx/sites-enabled/jianfeidazi-$ENV
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "====================================="
echo "  $ENV 环境部署完成！"
echo "====================================="
echo "后端服务: http://127.0.0.1:$PORT"
echo "Nginx 代理: http://$DOMAIN"
echo "PM2 进程名: $PM2_NAME"
echo ""
echo "注意："
echo "1. 请确保域名 $DOMAIN 已解析到本服务器"
echo "2. 请编辑 $PROJECT_DIR/backend/$ENV_FILE 补全真实密钥"
echo "3. 配置完成后重启服务：pm2 restart $PM2_NAME"
echo "4. 建议尽快配置 HTTPS 证书（见 docs/deploy/ENV_DEPLOY.md）"
