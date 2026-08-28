# CMS 管理员重置脚本

## reset-cms-admin.sql

用于在任意环境（开发/测试/生产）快速恢复或创建 `admin888` 超级管理员账号。

### 执行后效果

- 账号：`admin888`
- 密码：`admin123`
- 权限：超级管理员（全部 CMS 权限）
- 如果账号已存在：重置密码并启用
- 如果账号不存在：创建新账号

### 使用方法

#### 1. 线上服务器执行

SSH 登录到线上服务器，进入后端数据库所在目录，执行：

```bash
# 先停止后端服务，避免数据库被占用时产生锁
pm2 stop your-app-name
# 或
systemctl stop your-app-service

# 执行重置脚本（根据实际数据库路径修改）
sqlite3 /path/to/your/backend/data/app_production.db < /path/to/reset-cms-admin.sql

# 重新启动后端服务
pm2 start your-app-name
# 或
systemctl start your-app-service
```

#### 2. 本地开发环境执行

```bash
cd /path/to/fit/backend
sqlite3 ./data/app.db < ./scripts/reset-cms-admin.sql
```

### 安全提醒

- 此脚本会覆盖 `admin888` 的密码，请在确认需要重置时使用。
- 生产环境执行前建议先备份数据库。
