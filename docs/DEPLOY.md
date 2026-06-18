# 减肥搭子 APP —— 部署教程

> 本教程指导你将「减肥搭子」后端和前端部署到服务器，并配置微信小程序上线。

---

## 一、环境准备

### 1.1 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 2 核 | 2 核 |
| 内存 | 2G | 2G |
| 硬盘 | 40G SSD | 40G SSD |
| 带宽 | 3M | 3M+ |
| 系统 | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### 1.2 必须准备的账号

- 腾讯云 / 阿里云账号（已实名认证）
- 火山引擎 / 豆包开放平台账号（已获取 API Key）
- 微信小程序账号（已完成认证）
- 域名（可选，但微信小程序正式上线需要 HTTPS + 备案域名）

---

## 二、后端部署

### 2.1 购买服务器并登录

```bash
# 使用 SSH 登录服务器（Mac/Linux 终端）
ssh root@你的服务器IP

# 如果使用密钥
ssh -i ~/.ssh/your_key.pem root@你的服务器IP
```

### 2.2 安装 Node.js

```bash
# 安装 nvm（Node 版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# 安装 Node.js LTS
nvm install 20
nvm use 20
nvm alias default 20

# 验证
node -v  # v20.x.x
npm -v   # 10.x.x
```

### 2.3 安装 PM2 和 Nginx

```bash
# 安装 PM2
npm install -g pm2

# 安装 Nginx
sudo apt update
sudo apt install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.4 上传后端代码

```bash
# 本地终端执行，将 backend 目录上传到服务器
scp -r backend root@你的服务器IP:/opt/jianfeidazi/

# 或使用 Git
# 在服务器上
cd /opt
mkdir jianfeidazi
cd jianfeidazi
git clone 你的仓库地址 .
cd backend
```

### 2.5 安装依赖并配置环境变量

```bash
cd /opt/jianfeidazi/backend
npm install --production

# 创建环境变量文件
cp .env.example .env
nano .env
```

编辑 `.env` 文件，填写真实配置：

```bash
PORT=3000
NODE_ENV=production
JWT_SECRET=你的随机字符串（至少32位）
JWT_EXPIRES_IN=7d

# 豆包配置
DOUBAO_API_KEY=你的豆包API Key
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MAIN_AGENT_ENDPOINT=ep-xxxxxx
DOUBAO_PRECIPITATION_ENDPOINT=ep-xxxxxx
DOUBAO_HELPER_ENDPOINT=ep-xxxxxx

# 微信小程序
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序AppSecret

# 腾讯云 COS（可选）
COS_SECRET_ID=你的SecretId
COS_SECRET_KEY=你的SecretKey
COS_BUCKET=你的Bucket
COS_REGION=ap-guangzhou
COS_DOMAIN=https://你的Bucket.cos.ap-guangzhou.myqcloud.com

# 数据库
DB_PATH=./data/app.db
```

### 2.6 初始化数据库

```bash
cd /opt/jianfeidazi/backend
npm run init-db
```

### 2.7 使用 PM2 启动服务

```bash
cd /opt/jianfeidazi/backend
pm2 start ecosystem.config.js

# 查看运行状态
pm2 status
pm2 logs jianfeidazi-backend

# 设置开机自启
pm2 startup
pm2 save
```

### 2.8 配置 Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/jianfeidazi
```

填写以下内容（HTTP 版本）：

```nginx
server {
    listen 80;
    server_name 你的域名或服务器IP;

    client_max_body_size 20M;

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
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/jianfeidazi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2.9 配置 HTTPS（强烈推荐）

微信小程序要求后端接口必须使用 HTTPS。可以使用腾讯云免费 SSL 证书或 Let's Encrypt。

#### 方案 A：Let's Encrypt + certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名

# 自动续期
sudo certbot renew --dry-run
```

#### 方案 B：腾讯云免费证书

1. 在腾讯云 SSL 控制台申请免费证书
2. 下载 Nginx 版本证书
3. 上传到服务器 `/etc/nginx/ssl/`
4. 修改 Nginx 配置：

```nginx
server {
    listen 443 ssl;
    server_name 你的域名;

    ssl_certificate /etc/nginx/ssl/your_domain.crt;
    ssl_certificate_key /etc/nginx/ssl/your_domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 80;
    server_name 你的域名;
    return 301 https://$server_name$request_uri;
}
```

---

## 三、前端部署

### 3.1 本地开发环境

```bash
cd frontend
npm install
```

### 3.2 修改 API 地址

编辑 `frontend/src/utils/request.js`：

```javascript
const BASE_URL = 'https://你的域名/api';
```

### 3.3 配置微信小程序 AppID

编辑 `frontend/src/manifest.json`：

```json
{
  "mp-weixin": {
    "appid": "你的小程序AppID",
    "setting": {
      "urlCheck": false
    }
  }
}
```

### 3.4 使用 HBuilderX 编译微信小程序

1. 打开 HBuilderX
2. 导入 `frontend` 目录
3. 点击菜单「运行」→「运行到小程序模拟器」→「微信开发者工具」
4. 首次运行需要配置微信开发者工具路径

### 3.5 在微信公众平台配置服务器域名

登录 [微信公众平台](https://mp.weixin.qq.com)：

1. 进入「开发」→「开发管理」→「开发设置」
2. 在「服务器域名」中配置：
   - request 合法域名：`https://你的域名`
   - uploadFile 合法域名：`https://你的域名` 和 COS 域名
   - downloadFile 合法域名：`https://你的域名` 和 COS 域名
3. 保存并提交

### 3.6 上传代码并提交审核

1. 在 HBuilderX 中点击「发行」→「小程序-微信」
2. 在微信开发者工具中点击「上传」
3. 登录微信公众平台，进入「版本管理」
4. 将开发版本提交审核
5. 审核通过后发布上线

---

## 四、H5 部署（可选）

```bash
cd frontend
npm run build:h5
```

构建产物在 `frontend/dist/build/h5` 目录，将其上传到服务器 Nginx 静态目录：

```bash
sudo mkdir -p /var/www/jianfeidazi
sudo cp -r dist/build/h5/* /var/www/jianfeidazi/
```

Nginx 配置：

```nginx
server {
    listen 80;
    server_name h5.你的域名;
    root /var/www/jianfeidazi;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 五、常见问题

### 5.1 后端启动失败

```bash
# 查看错误日志
pm2 logs jianfeidazi-backend

# 常见原因：
# 1. 端口被占用：sudo lsof -i :3000
# 2. 环境变量未配置
# 3. 数据库目录无写入权限
```

### 5.2 小程序请求失败

- 检查服务器域名是否配置正确
- 检查 SSL 证书是否有效
- 检查 Nginx 配置是否正确转发到 Node 服务
- 检查 `.env` 中 API Key 是否有效

### 5.3 AI 调用失败

- 检查豆包 API Key 是否正确
- 检查 Endpoint ID 是否填写正确
- 检查账户是否还有免费额度

### 5.4 数据库权限问题

```bash
# 确保 data 目录有写入权限
chmod -R 755 /opt/jianfeidazi/backend/data
```

---

## 六、部署检查清单

| 检查项 | 状态 |
|--------|------|
| 服务器已购买并配置安全组 | ☐ |
| Node.js 已安装 | ☐ |
| PM2 和 Nginx 已安装 | ☐ |
| 后端代码已上传 | ☐ |
| `.env` 配置正确 | ☐ |
| 数据库已初始化 | ☐ |
| PM2 已启动并设置开机自启 | ☐ |
| Nginx 已配置并重启 | ☐ |
| HTTPS 证书已配置 | ☐ |
| 小程序 AppID 已配置 | ☐ |
| 小程序服务器域名已配置 | ☐ |
| 代码已上传并通过审核 | ☐ |

---

## 七、后续维护

### 7.1 更新后端

```bash
cd /opt/jianfeidazi/backend
git pull
npm install --production
pm2 restart jianfeidazi-backend
```

### 7.2 备份数据库

```bash
# 手动备份
cp /opt/jianfeidazi/backend/data/app.db /opt/backup/app-$(date +%Y%m%d).db

# 可配置定时任务
crontab -e
# 每天凌晨 3 点备份
0 3 * * * cp /opt/jianfeidazi/backend/data/app.db /opt/backup/app-$(date +\%Y\%m\%d).db
```

### 7.3 监控日志

```bash
pm2 logs jianfeidazi-backend --lines 100
```
