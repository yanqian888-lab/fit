#!/bin/bash
set -e

# ============================================================
# 管理后台部署脚本
# 用法：
#   ./scripts/deploy-admin.sh test
#   ./scripts/deploy-admin.sh prod
# ============================================================

ENV=$1

if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
  echo ""
  echo "错误：请指定部署环境"
  echo "用法："
  echo "  ./scripts/deploy-admin.sh test"
  echo "  ./scripts/deploy-admin.sh prod"
  echo ""
  exit 1
fi

if [[ "$ENV" == "test" ]]; then
  BUILD_SCRIPT="build:test"
  WWW_DIR="/var/www/fit-admin-test"
  DEFAULT_DOMAIN="test.fit.mianyan.xin"
else
  BUILD_SCRIPT="build:prod"
  WWW_DIR="/var/www/fit-admin"
  DEFAULT_DOMAIN="fit.mianyan.xin"
fi

DOMAIN=${2:-$DEFAULT_DOMAIN}

cd /opt/jianfeidazi/admin

echo "====================================="
echo "  管理后台部署 - $ENV 环境"
echo "====================================="

echo "[1/3] 安装依赖..."
npm install

echo "[2/3] 构建 $ENV 环境..."
npm run "$BUILD_SCRIPT"

echo "[3/3] 部署到 Nginx 目录..."
mkdir -p "$WWW_DIR"
rm -rf "${WWW_DIR:?}/"*
cp -r dist/* "$WWW_DIR/"

# 复制 Nginx 配置（如未配置）
NGINX_AVAILABLE="/etc/nginx/sites-available/jianfeidazi-admin-$ENV"
if [ ! -f "$NGINX_AVAILABLE" ]; then
  cp /opt/jianfeidazi/nginx/admin.conf "$NGINX_AVAILABLE"
  sed -i "s|server_name .*;|server_name $DOMAIN;|" "$NGINX_AVAILABLE"
  sed -i "s|root /var/www/fit-admin;|root $WWW_DIR;|" "$NGINX_AVAILABLE"
  ln -sf "$NGINX_AVAILABLE" "/etc/nginx/sites-enabled/jianfeidazi-admin-$ENV"
  nginx -t && systemctl reload nginx
fi

echo ""
echo "✅ $ENV 环境管理后台部署完成"
echo "访问地址：http://$DOMAIN"
