#!/bin/bash
set -e

# ============================================================
# H5 站点部署脚本
# 用法：
#   ./scripts/deploy-h5.sh test
#   ./scripts/deploy-h5.sh prod
# ============================================================

ENV=$1

if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
  echo ""
  echo "错误：请指定部署环境"
  echo "用法："
  echo "  ./scripts/deploy-h5.sh test"
  echo "  ./scripts/deploy-h5.sh prod"
  echo ""
  exit 1
fi

if [[ "$ENV" == "test" ]]; then
  BUILD_SCRIPT="build:h5:test"
  WWW_DIR="/var/www/fit-h5-test"
  DEFAULT_DOMAIN="test-h5.fitapp.com"
else
  BUILD_SCRIPT="build:h5:prod"
  WWW_DIR="/var/www/fit-h5"
  DEFAULT_DOMAIN="h5.fitapp.com"
fi

DOMAIN=${2:-$DEFAULT_DOMAIN}

cd /opt/jianfeidazi/frontend

echo "====================================="
echo "  H5 部署 - $ENV 环境"
echo "====================================="

echo "[1/3] 安装依赖..."
npm install

echo "[2/3] 构建 $ENV 环境..."
npm run "$BUILD_SCRIPT"

echo "[3/3] 部署到 Nginx 目录..."
mkdir -p "$WWW_DIR"
rm -rf "${WWW_DIR:?}/"*
cp -r dist/build/h5/* "$WWW_DIR/"

# 复制 Nginx 配置（如未配置）
NGINX_AVAILABLE="/etc/nginx/sites-available/jianfeidazi-h5-$ENV"
if [ ! -f "$NGINX_AVAILABLE" ]; then
  cp /opt/jianfeidazi/nginx/h5.conf "$NGINX_AVAILABLE"
  sed -i "s|server_name .*;|server_name $DOMAIN;|" "$NGINX_AVAILABLE"
  sed -i "s|root /var/www/fit-h5;|root $WWW_DIR;|" "$NGINX_AVAILABLE"
  ln -sf "$NGINX_AVAILABLE" "/etc/nginx/sites-enabled/jianfeidazi-h5-$ENV"
  nginx -t && systemctl reload nginx
fi

echo ""
echo "✅ $ENV 环境 H5 部署完成"
echo "访问地址：http://$DOMAIN"
