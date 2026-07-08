# 减肥搭子 APP —— 测试环境与正式环境分离部署方案

> 本文档说明如何将「减肥搭子」拆分为 **测试环境** 和 **正式环境**，实现：代码一份、配置多套、数据隔离、独立部署、验证通过后再上架。

---

## 一、总体思路

### 1.1 为什么需要两套环境

| 问题 | 解决方案 |
|---|---|
| 新功能直接上正式环境风险高 | 先在测试环境验证 |
| 测试数据污染真实用户数据 | 测试、正式使用独立数据库 |
| 上架包接口地址写错 | 通过环境变量自动切换 API 地址 |
| 多人协作互相覆盖 | 分支隔离 + 自动化部署脚本 |

### 1.2 核心原则

- **代码一份**：所有环境共用同一个 Git 仓库。
- **配置多套**：通过 `.env.{mode}` 文件区分不同环境的接口地址、密钥、数据库路径。
- **数据隔离**：测试库与生产库物理分离，互不影响。
- **验证上线**：只有测试环境跑通的代码，才合并/部署到正式环境。

### 1.3 环境规划

| 环境 | 用途 | 分支建议 | 后端地址示例 | 数据库文件 |
|---|---|---|---|---|
| `development` | 本地开发 | `feature/*` | `http://localhost:3000` | `app.db` |
| `test` | 功能测试、内测包 | `develop` / `release-*` | `https://test-api.fitapp.com` | `app_test.db` |
| `production` | 商店正式包 | `main` / `master` | `https://api.fitapp.com` | `app_production.db` |

---

## 二、实现方案

### 2.1 后端：按 `NODE_ENV` 加载环境配置

#### 配置加载机制

`backend/src/config/index.js` 做了如下改造：

1. 读取 `process.env.NODE_ENV`，默认为 `development`。
2. 先加载 `.env`（通用默认配置）。
3. 再加载 `.env.${NODE_ENV}`（环境专属配置），覆盖默认值。

后端：
```
.env
.env.development   ← 本地开发（已提交，安全默认值）
.env.test          ← 测试环境（不提交，服务器手动配置）
.env.production    ← 正式环境（不提交，服务器手动配置）
```

前端 / 管理后台：
```
.env.development   ← 本地开发（已提交）
.env.test          ← 测试环境（已提交，仅公开域名）
.env.production    ← 正式环境（已提交，仅公开域名）
.env.*.local       ← 本地覆盖（不提交）
```

> 前端和管理后台的 `.env.test` / `.env.production` 只包含 API 域名，没有密钥，因此可以提交到 Git。如需在本地临时改成其他地址，请创建 `.env.test.local` 或 `.env.production.local`，它们会被 Git 忽略。

> `.env.test` 和 `.env.production` 不会进入 Git，避免密钥泄露。仓库中只保留 `.env.test.example` 和 `.env.production.example` 作为模板。

#### 本地开发配置

`backend/.env.development` 已包含本地开发默认值。如需覆盖（例如使用不同的豆包 API Key），可创建 `backend/.env.development.local`：

```bash
cp backend/.env.development backend/.env.development.local
# 编辑 backend/.env.development.local 修改所需配置
```

> `.env.development.local` 会被 Git 忽略，适合存放个人本地密钥。

#### 后端启动方式

```bash
cd backend

# 本地开发
npm run dev

# 测试环境
npm run start:test

# 正式环境
npm run start:prod

# 使用 PM2 托管（推荐服务器使用）
npm run pm2:test
npm run pm2:prod
```

#### PM2 配置

`backend/ecosystem.config.js` 中定义了两个进程：

- `fit-backend-test`：监听 `3001` 端口（建议）
- `fit-backend-prod`：监听 `3000` 端口

两个进程使用同一份代码、不同的 `NODE_ENV`，分别读取 `.env.test` / `.env.production`。

### 2.2 前端（uni-app）：按 Vite mode 切换 API 地址

新增 `frontend/src/config/env.js`，根据 `import.meta.env.VITE_APP_ENV` 选择后端地址：

```js
// .env.development
VITE_APP_ENV=development
VITE_SERVER_URL=http://localhost:3000

// .env.test
VITE_APP_ENV=test
VITE_SERVER_URL=https://test-api.fitapp.com

// .env.production
VITE_APP_ENV=production
VITE_SERVER_URL=https://api.fitapp.com
```

`frontend/src/utils/request.js` 从 `env.js` 读取 `BASE_URL`，不再硬编码 IP。

#### 前端打包命令

```bash
cd frontend

# H5
npm run build:h5:test      # 测试环境 H5
npm run build:h5:prod      # 正式环境 H5

# 微信小程序
npm run build:mp-weixin:test
npm run build:mp-weixin:prod

# APP（Android / iOS）
npm run build:app-android:test
npm run build:app-android:prod
npm run build:app-ios:test
npm run build:app-ios:prod
```

> 上架商店时，**只使用 `*:prod` 命令构建的安装包**，确保接口指向正式环境。

### 2.3 管理后台：按环境切换 API BaseURL

新增 `admin/src/config/env.js` 和 `.env.development / .env.test / .env.production`：

```js
// .env.development
VITE_API_BASE_URL=/api

// .env.test
VITE_API_BASE_URL=https://test-api.fitapp.com/api

// .env.production
VITE_API_BASE_URL=https://api.fitapp.com/api
```

`admin/src/api/request.js` 使用 `API_BASE_URL` 作为 `axios.baseURL`。

#### 管理后台打包命令

```bash
cd admin
npm run build:test
npm run build:prod
```

### 2.4 数据库隔离

通过 `.env` 中的 `DB_PATH` 指定不同数据库文件：

```bash
# 测试环境
DB_PATH=./data/app_test.db

# 正式环境
DB_PATH=./data/app_production.db
```

两个数据库文件在同一台服务器上也能物理隔离，避免误操作。

### 2.5 Nginx 反向代理

`nginx/` 目录下提供四份模板配置：

| 配置文件 | 用途 | 默认域名 | 后端端口 |
|---|---|---|---|
| `backend-test.conf` | 测试环境 API | `test-api.fitapp.com` | 3001 |
| `backend-prod.conf` | 正式环境 API | `api.fitapp.com` | 3000 |
| `admin.conf` | 管理后台 | `admin.fitapp.com` | 静态站点 |
| `h5.conf` | H5 站点 | `h5.fitapp.com` | 静态站点 |

部署脚本会根据传入的域名自动替换 `server_name`。

---

## 三、文件与目录说明

```
fit/
├── backend/
│   ├── .env.example                  # 通用环境变量模板
│   ├── .env.development              # 本地开发默认值（已提交）
│   ├── .env.test.example             # 测试环境模板
│   ├── .env.production.example       # 正式环境模板
│   ├── ecosystem.config.js           # PM2 双环境配置
│   ├── src/config/index.js           # 多环境配置加载器
│   └── package.json                  # 新增 start:test / pm2:prod 等脚本
├── frontend/
│   ├── src/config/env.js             # 前端环境配置入口
│   ├── src/utils/request.js          # 读取环境 BASE_URL
│   ├── .env.development              # 开发环境接口地址
│   ├── .env.test                     # 测试环境接口地址
│   ├── .env.production               # 正式环境接口地址
│   └── package.json                  # 新增 *:test / *:prod 构建脚本
├── admin/
│   ├── src/config/env.js             # 后台环境配置入口
│   ├── src/api/request.js            # 读取环境 API_BASE_URL
│   ├── .env.development              # 开发环境代理配置
│   ├── .env.test                     # 测试环境接口地址
│   ├── .env.production               # 正式环境接口地址
│   └── package.json                  # 新增 build:test / build:prod
├── nginx/
│   ├── backend-test.conf             # 测试 API Nginx 配置
│   ├── backend-prod.conf             # 正式 API Nginx 配置
│   ├── admin.conf                    # 管理后台 Nginx 配置
│   └── h5.conf                       # H5 站点 Nginx 配置
├── scripts/
│   ├── deploy-backend.sh             # 后端增量部署
│   ├── deploy-admin.sh               # 管理后台部署
│   ├── deploy-h5.sh                  # H5 部署
│   └── backup-db.sh                  # 数据库备份
└── deploy.sh                         # 首次部署脚本（test / prod）
```

---

## 四、操作手册

### 4.1 本地开发

#### 后端

```bash
cd backend
npm install
npm run dev
```

`backend/.env.development` 已提交本地默认配置，开发时直接可用。如需本地覆盖，创建 `backend/.env.development.local`。

服务默认运行在 `http://localhost:3000`。

#### 前端

```bash
cd frontend
npm install
npm run dev:h5
```

H5 预览会自动连接 `http://localhost:3000`。

如需用手机真机预览 H5，将 `frontend/.env.development` 中的 `VITE_SERVER_URL` 改为电脑局域网 IP：

```bash
VITE_SERVER_URL=http://192.168.x.x:3000
```

#### 管理后台

```bash
cd admin
npm install
npm run dev
```

开发时通过 Vite 代理自动转发 `/api` 到 `http://localhost:3000`。

---

### 4.2 首次部署测试环境

#### 前提条件

- 已购买一台 Ubuntu 22.04 服务器（测试环境配置可较低）。
- 已将仓库代码推送到 GitHub（或其他 Git 仓库）。
- 已准备测试域名（如 `test-api.fitapp.com`）并解析到服务器。

#### 执行部署

```bash
# 在服务器上执行（root 权限）
curl -fsSL https://raw.githubusercontent.com/yanqian888-lab/fit/main/deploy.sh -o deploy.sh
chmod +x deploy.sh
./deploy.sh test test-api.fitapp.com
```

> 如果仓库不是公开的，请先在服务器上 `git clone` 项目，再进入项目目录执行 `./deploy.sh test test-api.fitapp.com`。

#### 部署完成后必须做的事

脚本会自动创建 `/opt/jianfeidazi/backend/.env.test`，但其中的敏感信息需要手动补全：

```bash
nano /opt/jianfeidazi/backend/.env.test
```

至少填写：

```bash
JWT_SECRET=              # 保持脚本生成的随机值即可
DOUBAO_API_KEY=          # 豆包 API Key
DOUBAO_MAIN_AGENT_ENDPOINT=      # 主 Agent 接入点
DOUBAO_PRECIPITATION_ENDPOINT=   # 沉淀 Agent 接入点
DOUBAO_HELPER_ENDPOINT=          # 助手 Agent 接入点
WECHAT_APPID=            # 微信小程序 AppID
WECHAT_SECRET=           # 微信小程序 Secret
COS_SECRET_ID=           # 腾讯云 COS SecretId（如使用）
COS_SECRET_KEY=          # 腾讯云 COS SecretKey（如使用）
```

保存后重启服务：

```bash
pm2 restart fit-backend-test
```

#### 验证接口

```bash
curl http://test-api.fitapp.com/api/health
```

---

### 4.3 首次部署正式环境

与测试环境类似，只需改环境和域名：

```bash
./deploy.sh prod api.fitapp.com
```

部署完成后同样编辑 `/opt/jianfeidazi/backend/.env.production` 并重启：

```bash
pm2 restart fit-backend-prod
```

> **重要**：正式环境的 `JWT_SECRET`、数据库路径、豆包 API Key 必须与测试环境不同。

---

### 4.4 后端代码更新（增量部署）

当测试环境功能验证通过后，将代码合并到正式分支，然后在各环境执行增量部署：

```bash
# 更新测试环境
cd /opt/jianfeidazi
./scripts/deploy-backend.sh test

# 更新正式环境
cd /opt/jianfeidazi
./scripts/deploy-backend.sh prod
```

该脚本会自动：

1. `git pull` 拉取最新代码。
2. `npm install --production` 安装依赖。
3. 备份当前数据库。
4. 执行数据库初始化/迁移。
5. 重启对应 PM2 进程。

---

### 4.5 管理后台更新

```bash
# 测试环境后台
cd /opt/jianfeidazi
./scripts/deploy-admin.sh test test-admin.fitapp.com

# 正式环境后台
cd /opt/jianfeidazi
./scripts/deploy-admin.sh prod admin.fitapp.com
```

---

### 4.6 H5 站点更新

```bash
# 测试环境 H5
cd /opt/jianfeidazi
./scripts/deploy-h5.sh test test-h5.fitapp.com

# 正式环境 H5
cd /opt/jianfeidazi
./scripts/deploy-h5.sh prod h5.fitapp.com
```

---

### 4.7 数据库备份

#### 手动备份

```bash
cd /opt/jianfeidazi
./scripts/backup-db.sh test
./scripts/backup-db.sh prod
```

备份文件存放在 `/opt/backup/fit-test/` 和 `/opt/backup/fit-prod/`，保留最近 30 份。

#### 定时自动备份

```bash
crontab -e
```

添加：

```cron
# 每天凌晨 3 点备份测试和正式数据库
0 3 * * * /opt/jianfeidazi/scripts/backup-db.sh test >> /var/log/fit-backup-test.log 2>&1
0 3 * * * /opt/jianfeidazi/scripts/backup-db.sh prod >> /var/log/fit-backup-prod.log 2>&1
```

---

### 4.8 回滚（紧急）

如果正式环境更新后出现问题，最快回滚方式是：

1. 停止当前服务：
   ```bash
   pm2 stop fit-backend-prod
   ```

2. 用备份恢复数据库（如需）：
   ```bash
   cp /opt/backup/fit-prod/app_production_YYYYMMDD_HHMMSS.db /opt/jianfeidazi/backend/data/app_production.db
   ```

3. 回退代码到上一个稳定版本：
   ```bash
   cd /opt/jianfeidazi
   git log --oneline -5
   git reset --hard <上一个稳定 commit>
   ./scripts/deploy-backend.sh prod
   ```

---

## 五、APP 上架流程

```
1. 在 develop 分支完成新功能开发
2. 合并到 release 分支，部署到测试环境
3. 测试团队/内部用户验收通过
4. 将 release 分支合并到 main 分支
5. 部署正式环境后端
6. 使用以下命令构建正式 APP 包：

   cd frontend
   npm run build:app-android:prod
   npm run build:app-ios:prod

7. 在 HBuilderX 中打开 dist/build/app，生成签名安装包
8. 提交到应用商店审核
```

> **切记**：上架包必须是 `*:prod` 命令构建，确保连接正式环境 API。

---

## 六、安全与注意事项

### 6.1 不要提交真实密钥

以下文件已加入 `.gitignore`，不会进入版本控制：

```
backend/.env.test
backend/.env.production
frontend/.env.test
frontend/.env.production
admin/.env.test
admin/.env.production
*.env.local
*.env.*.local
```

### 6.2 JWT 密钥必须区分环境

测试环境和正式环境的 `JWT_SECRET` 必须不同，否则测试环境的 token 可能在正式环境也有效。

### 6.3 数据库路径不要写错

- 测试环境：`DB_PATH=./data/app_test.db`
- 正式环境：`DB_PATH=./data/app_production.db`

如果两个环境指向同一个文件，将导致数据污染。

### 6.4 上线前必须配置 HTTPS

小程序和 APP 上架都要求后端接口使用 HTTPS。参考 `../DEPLOY.md` 中的 HTTPS 配置章节，或使用 `certbot`：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.fitapp.com -d test-api.fitapp.com
```

### 6.5 域名与备案

国内上架 Android 应用商店和微信小程序，域名需要完成 ICP 备案。

---

## 七、常见问题

### Q1：测试环境和正式环境能部署在同一台服务器吗？

可以。它们使用不同端口（测试 3001，正式 3000）和不同数据库文件，通过 Nginx 不同域名区分。但为了安全和性能，建议正式环境使用独立服务器。

### Q2：本地开发时如何切换成测试环境接口？

修改 `frontend/.env.development`：

```bash
VITE_SERVER_URL=https://test-api.fitapp.com
```

然后重新运行 `npm run dev:h5`。

### Q3：为什么修改了 `.env.test` 后端没有生效？

环境变量只在进程启动时读取。修改 `.env.test` 后必须重启服务：

```bash
pm2 restart fit-backend-test
```

### Q4：PM2 进程起不来怎么办？

```bash
pm2 logs fit-backend-test
```

常见原因：

- `.env.test` 中的豆包 API Key 未填写
- 端口 3001 被占用：`sudo lsof -i :3001`
- `data` 目录没有写入权限：`chmod -R 755 /opt/jianfeidazi/backend/data`

### Q5：前端打包后接口地址不对？

检查打包命令和 `.env` 文件是否对应：

```bash
npm run build:app-android:prod   # 读取 .env.production
npm run build:app-android:test   # 读取 .env.test
```

---

## 八、附录

### 8.1 脚本速查表

| 脚本 | 用途 |
|---|---|
| `deploy.sh test [域名]` | 首次部署测试环境 |
| `deploy.sh prod [域名]` | 首次部署正式环境 |
| `scripts/deploy-backend.sh test` | 后端增量部署（测试） |
| `scripts/deploy-backend.sh prod` | 后端增量部署（正式） |
| `scripts/deploy-admin.sh test [域名]` | 部署管理后台（测试） |
| `scripts/deploy-admin.sh prod [域名]` | 部署管理后台（正式） |
| `scripts/deploy-h5.sh test [域名]` | 部署 H5（测试） |
| `scripts/deploy-h5.sh prod [域名]` | 部署 H5（正式） |
| `scripts/backup-db.sh test` | 备份测试数据库 |
| `scripts/backup-db.sh prod` | 备份正式数据库 |

### 8.2 推荐域名规划

| 服务 | 测试环境 | 正式环境 |
|---|---|---|
| 后端 API | `test-api.fitapp.com` | `api.fitapp.com` |
| H5 | `test-h5.fitapp.com` | `h5.fitapp.com` |
| 管理后台 | `test-admin.fitapp.com` | `admin.fitapp.com` |

### 8.3 推荐端口规划

| 服务 | 测试环境 | 正式环境 |
|---|---|---|
| Node 后端 | 3001 | 3000 |
| 管理后台 dev | 5174 | 5174 |

---

## 九、APP 内手动切换环境（测试包）

为方便测试人员在不重新打包的情况下切换后端环境，APP 提供了隐藏入口：

- **入口位置**：「我的」→「关于我们」页面底部空白区域。
- **触发方式**：长按底部约 300px × 300px 的隐藏区域 **5 秒**。
- **弹窗选项**：可选择「测试环境」或「正式环境」。
- **默认行为**：
  - 测试包（`npm run build:*:test`）默认连接测试环境。
  - 正式包（`npm run build:*:prod`）默认连接正式环境。
- **生效方式**：切换后应用会自动重启并回到首页。

> 该功能仅用于内部测试，正式上架包不会暴露此入口给普通用户。

### 9.1 相关文件

| 文件 | 说明 |
|---|---|
| `frontend/src/utils/environment.js` | 环境读取/切换/持久化逻辑 |
| `frontend/src/utils/request.js` | 动态读取当前环境的 API 地址 |
| `frontend/src/pages/user/about.vue` | 隐藏长按触发区与弹窗 |
| `frontend/src/config/env.js` | 构建时默认环境配置 |

---

> 文档版本：v1.1
> 最后更新：2026-07-05
