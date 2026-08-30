# 上线前整体走查问题清单

**走查时间**：2026-08-30  
**范围**：frontend / backend / admin / 前后端联调 / CMS 配置联动  
**走查环境**：本地 development（localhost:3000）+ 真实 LLM API Key

---

## 已修复的 P0/P1 问题

### 1. LLM 环境变量命名不一致导致生产 AI 调用可能失败
- **模块**：backend - 配置
- **文件**：`backend/src/config/index.js`
- **问题描述**：代码读取 `TENCENT_LLM_*`，而 `.env.test` / `.env.production` 使用 `DOUBAO_*`。若生产 `.env.production` 未配置 `TENCENT_LLM_API_KEY`，AI 调用会因 Key 为空失败。
- **修复内容**：增加 `DOUBAO_*` 优先、`TENCENT_LLM_*` 回退的兼容读取逻辑。
- **验证**：development 环境聊天 → 沉淀 → 记录中心链路正常。
- **提交**：`5931090`

---

## 待用户确认 / 不在本轮修复的 P0/P1 问题

### 2. 本地环境文件包含真实 API Key 且标注“已泄露”
- **模块**：后端 - 环境配置
- **文件**：`backend/.env`、`backend/.env.development`、`.env.test`、`.env.production`
- **问题描述**：文件中存在真实 `TENCENT_LLM_API_KEY` / `DOUBAO_*_API_KEY` / `WECHAT_APPID` / `WECHAT_SECRET`，且 `.env` 注释明确写“API密钥已泄露，请立即更换”。这些文件虽被 `.gitignore` 忽略不入 Git，但本地明文存储 + 历史泄露风险对生产部署是重大隐患。
- **级别**：P0（安全风险）
- **处置**：本轮不修改你的 `.env` 文件。部署前请务必确认：
  1. 生产服务器 `.env.production` 已使用全新、独立的密钥；
  2. 腾讯云 / 豆包 / 微信小程序后台已 revoke 旧 Key；
  3. 旧 Key 不在任何日志、截图、备份中残留。

### 3. admin `app-config` 为空壳页面
- **模块**：CMS 后台 - 应用配置
- **文件**：`admin/src/views/app-config/index.vue`
- **问题描述**：页面文案“此处用于配置弹窗、挂角、博物馆入口等运营工具（待后续补充）”，无实际功能。
- **级别**：P1（功能缺失）
- **处置**：需求不明，本轮不修复。请确认：
  - 上线前是否需要补齐该页面？
  - 如不需要，是否隐藏菜单入口？

### 4. frontend 宠物分享二维码为占位图
- **模块**：前端 - 搭搭页
- **文件**：`frontend/src/pages/pet/index.vue:1098`
- **问题描述**：`SHARE_QR_PLACEHOLDER = '/static/image/icon/qr_placeholder.png'`，注释写“占位二维码，后续替换为正式 App 二维码”。
- **级别**：P1（若分享功能在本次上线范围）
- **处置**：需求不明，本轮不修复。请确认：
  - 宠物页分享功能是否在本次上线范围？
  - 如是，请提供正式 App 二维码图片路径或上传文件。

### 5. backend `chatController.js` 20s→8s 未提交修改
- **模块**：backend - 聊天控制器
- **文件**：`backend/src/controllers/chatController.js`
- **问题描述**：沉淀 Agent 等待超时从 20 秒改为 8 秒，处于未提交状态。你说明是“其他 agent 正在调试中，不要动”。
- **级别**：P1（逻辑选择，可能因调试改动上线）
- **处置**：本轮未动，保持现状。部署前请确认该调试修改是否应提交或回滚。

---

## P2 问题清单（不影响主流程，建议记录排期）

### 6. admin 生产构建 chunk 过大
- **模块**：admin - 构建
- **问题描述**：`npm run build:prod` 后 `dist/assets/index-*.js` 1,209 KB（gzip 383 KB），构建日志提示大于 500 KB。
- **影响**：CMS 后台首次加载较慢。
- **级别**：P2

### 7. 前端小程序构建产物体积需复核主包
- **模块**：frontend - 小程序构建
- **问题描述**：`build:mp-weixin:prod` 产物总大小 1.8 MB。总包可控，但需在微信开发者工具中确认主包未超过 2 MB。
- **级别**：P2

### 8. 测试覆盖严重不足
- **模块**：三端 - 测试
- **问题描述**：
  - backend 单测仅覆盖 auth/currency/validation，未覆盖聊天/AI/记录/商城/宠物等核心业务。
  - frontend 单测仅 `setup.test.js`。
  - admin 无单测。
- **影响**：无法通过自动化测试拦截回归问题。
- **级别**：P2/P3

### 9. backend 启动时大量调试级 console.log
- **模块**：backend - 日志
- **问题描述**：app.js、agents、services 中保留大量 `console.log`。
- **影响**：生产日志噪音大，部分日志可能包含用户消息内容，存在泄露风险。
- **级别**：P2

### 10. frontend 登录页非小程序分支仅用于占位
- **模块**：frontend - 登录页
- **文件**：`frontend/src/pages/login/index.vue:584`
- **问题描述**：手输手机号绑定分支标记为“仅用于占位”，后端目前仅支持微信授权。
- **影响**：H5/非小程序环境下登录路径可能不完整。
- **级别**：P2

### 11. admin 多处 `catch (e) {}` 静默吞错
- **模块**：CMS 后台 - 错误处理
- **问题描述**：多个 CMS 视图在请求失败时静默吞掉异常。
- **影响**：request.js 拦截器已会弹错误提示，所以用户能看到报错；但 catch 后继续执行刷新逻辑可能加载旧数据。
- **级别**：P2

---

## 验证结果汇总

| 检查项 | 结果 |
|--------|------|
| backend `npm test` | ✅ 34/34 通过 |
| frontend `npm test` | ✅ 19/19 通过 |
| admin `build:prod` | ✅ 成功（有 chunk 过大警告） |
| frontend `build:mp-weixin:prod` | ✅ 成功 |
| frontend `build:h5:prod` | ✅ 成功 |
| 后端 `/api/health` | ✅ 200 |
| 注册/登录 | ✅ 正常 |
| 聊天 → AI 回复 → 异步 helper → 沉淀 → 记录中心 | ✅ 正常 |
| AI 每日分析生成 | ✅ 正常 |
| 博物馆时间轴/日记项 | ✅ 正常 |
| CMS 登录/权限 | ✅ 正常 |
| CMS 货币调整 → C 端实时生效 | ✅ 正常 |
| CMS 分析消耗配置 → C 端实时生效 | ✅ 正常 |
| 签到/任务/成就 | ✅ 正常 |
| 商城购买/背包/宠物喂食/运动/外出 | ✅ 正常 |

---

## 部署前必须确认清单

1. 生产服务器 `.env.production` 已使用全新密钥，旧 Key 已 revoke。
2. 生产数据库 `app_production.db` 已存在且不需要清空/迁移（你要求保留现有生产数据库）。
3. `chatController.js` 的 8s 调试修改是否已确认提交或回滚。
4. admin `app-config` 空壳页面和宠物二维码占位是否已处理或接受不上线。
5. 小程序已在微信开发者工具/真机验证通过主包体积和代码质量扫描。
