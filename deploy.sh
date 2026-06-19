#!/bin/bash
set -e

echo "====================================="
echo "  减肥搭子 APP 服务端部署脚本"
echo "====================================="

PROJECT_DIR="/opt/jianfeidazi"
REPO_URL="https://github.com/yanqian888-lab/fit.git"

echo "[1/10] 更新系统并安装基础依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl wget git nginx build-essential python3

echo "[2/10] 安装 Node.js LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
npm -v

echo "[3/10] 安装 PM2..."
npm install -g pm2
pm2 -v

echo "[4/10] 克隆代码..."
if [ -d "$PROJECT_DIR" ]; then
  rm -rf "$PROJECT_DIR"
fi
mkdir -p /opt
git clone "$REPO_URL" "$PROJECT_DIR"
cd "$PROJECT_DIR/backend"

echo "[5/10] 安装后端依赖..."
npm install

echo "[6/10] 配置环境变量..."
if [ ! -f .env ]; then
  cp .env.example .env
  # 生成随机 JWT 密钥
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
  sed -i "s|^PORT=.*|PORT=3000|" .env
fi
echo "当前 .env 配置："
grep -E "^PORT=|^JWT_SECRET=|^DB_PATH=" .env

echo "[7/10] 初始化数据库..."
npm run init-db || node src/scripts/init-db.js

echo "[8/10] 使用 PM2 启动后端服务..."
pm2 start src/app.js --name jianfeidazi-backend
pm2 save

echo "[9/10] 配置 PM2 开机自启..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
pm2 save

echo "[10/10] 配置 Nginx 反向代理..."
cat > /etc/nginx/sites-available/jianfeidazi << 'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/jianfeidazi /etc/nginx/sites-enabled/jianfeidazi
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

echo ""
echo "====================================="
echo "  部署完成！"
echo "====================================="
echo "后端服务: http://39.96.67.113:3000"
echo "Nginx 代理: http://39.96.67.113"
echo ""
echo "注意：请编辑 $PROJECT_DIR/backend/.env 文件，"
echo "填写真实的豆包 API Key 和 Endpoint ID 后重启服务："
echo "  pm2 restart jianfeidazi-backend"
