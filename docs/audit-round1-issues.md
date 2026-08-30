# 上线前走查 - 第一轮问题清单

**走查时间**：2026-08-30  
**走查范围**：静态代码检查、三端构建、单元测试、关键接口冒烟测试  
**环境**：backend test（PORT=3001, DB=app_test.db）

---

## 已确认可立即修复的问题

### 1. backend 存在未提交临时修改
- **模块**：backend - 聊天控制器
- **文件**：`backend/src/controllers/chatController.js`
- **问题描述**：沉淀 Agent 等待超时从 20 秒改为 8 秒，当前处于未提交状态。
- **影响**：影响聊天中饮食/运动计算类回复的等待时长。8 秒可覆盖沉淀 Agent 内部 6 秒超时，但若网络/LLM 抖动在 6-8 秒之间完成会错过。
- **级别**：P1（逻辑选择，需确认）
- **建议**：请确认是保留 8 秒优化、恢复 20 秒，还是采用其他值。确认后统一提交。

---

## 需要用户确认的问题（需求/逻辑不明确，暂不修复）

### 2. backend 本地环境文件包含真实 API Key 且标注“已泄露”
- **模块**：后端 - 环境配置
- **文件**：`backend/.env`、`backend/.env.development`、`backend/.env.test`、`backend/.env.production`
- **问题描述**：`.env` 文件注释明确标注“API密钥已泄露，请立即更换！”，且 `TENCENT_LLM_API_KEY`/`DOUBAO_*_API_KEY`/`WECHAT_APPID`/`WECHAT_SECRET` 均为真实值。虽然这些文件已被 `.gitignore` 忽略不会入 Git，但本地明文存储 + 历史泄露风险对生产部署是重大隐患。
- **级别**：P0（安全风险）
- **需要确认**：
  - 生产服务器上的 `.env.production` 是否已更换为新的独立密钥？
  - 腾讯云/豆包平台上旧的 Key 是否已 revoke？
  - 是否需要我把 `.env.example` 更新为更严格的安全提示，或在代码中增加启动时密钥强度检查？

### 3. admin `app-config` 为空壳页面
- **模块**：CMS 后台 - 应用配置
- **文件**：`admin/src/views/app-config/index.vue`
- **问题描述**：页面文案写“此处用于配置弹窗、挂角、博物馆入口等运营工具（待后续补充）”，无实际功能。
- **级别**：P1（功能缺失）
- **需要确认**：
  - 上线前是否需要补齐该页面？还是作为已知未上线功能隐藏入口？
  - 如果要补齐，具体需要配置哪些项？

### 4. frontend 宠物分享二维码为占位图
- **模块**：前端 - 搭搭页
- **文件**：`frontend/src/pages/pet/index.vue:1098`
- **问题描述**：`SHARE_QR_PLACEHOLDER = '/static/image/icon/qr_placeholder.png'`，注释写“占位二维码，后续替换为正式 App 二维码”。
- **级别**：P1（上线阻断，如果分享功能启用）
- **需要确认**：
  - 宠物页分享功能是否在本次上线范围？
  - 正式 App 二维码图片路径是什么？是否已准备好？

### 5. admin 大量静默吞错
- **模块**：CMS 后台 - 错误处理
- **文件**：`admin/src/views/*` 中多处 `} catch (e) {}`
- **问题描述**：多个 CMS 页面在请求失败时静默吞掉异常，用户看不到错误提示，可能导致配置保存失败但误以为成功。
- **级别**：P1（体验/数据一致性）
- **需要确认**：
  - 是否统一修复为 ElMessage 错误提示？
  - 还是只修复关键配置页面（如宠物、货币、商城、任务）？

---

## P2 级问题（不影响主流程，建议记录排期）

### 6. admin 生产构建产物 chunk 过大
- **模块**：admin - 构建
- **问题描述**：`npm run build:prod` 后 `dist/assets/index-*.js` 1,209 KB（gzip 383 KB），构建日志提示大于 500 KB。
- **影响**：CMS 后台首次加载较慢。
- **级别**：P2

### 7. 前端小程序构建产物体积需复核
- **模块**：frontend - 小程序构建
- **问题描述**：`build:mp-weixin:prod` 产物总大小 1.8 MB。虽然总包可控，但需确认主包未超过 2 MB 限制。
- **级别**：P2

### 8. 测试覆盖严重不足
- **模块**：三端 - 测试
- **问题描述**：
  - backend 单测仅覆盖 auth/currency/validation，未覆盖聊天/AI/记录/商城/宠物等核心业务。
  - frontend 单测仅 setup.test.js。
  - admin 无单测。
- **影响**：无法通过自动化测试拦截回归问题。
- **级别**：P2/P3

### 9. backend 启动时大量 console.log
- **模块**：backend - 日志
- **问题描述**：app.js、agents、services 中保留大量调试级 console.log。
- **影响**：生产日志噪音大，可能泄露敏感信息。
- **级别**：P2

### 10. frontend `login/index.vue:584` 非小程序分支仅用于占位
- **模块**：frontend - 登录页
- **问题描述**：手输手机号绑定分支标记为“仅用于占位”，后端目前仅支持微信授权。
- **影响**：H5/非小程序环境下登录路径可能不完整。
- **级别**：P2

---

## 验证结果汇总

| 检查项 | 结果 |
|--------|------|
| backend `npm test` | ✅ 34/34 通过 |
| frontend `npm test` | ✅ 19/19 通过 |
| admin `build:prod` | ✅ 成功（有 chunk 过大警告） |
| frontend `build:mp-weixin:prod` | ✅ 成功 |
| 后端 `/api/health` | ✅ 200 |
| 注册/登录 | ✅ 正常 |
| `users/me`、`records/today`、`pet`、`shop/items`、`inventory`、`tasks`、`achievements`、`museum/overview` | ✅ 正常 |
| `records/diet`、`records/exercise`、`checkin`、`shop/buy`、`pet/feed` | ✅ 正常 |
| CMS 登录错误提示 | ✅ 正常 |
| CMS 未登录访问 | ✅ 返回 401 |

---

## 下一步建议

1. 请确认上方 5 个“需用户确认”问题的处理意见。
2. 我会根据你的回复进行第一轮修复（预计 1-2 轮对话）。
3. 修复完成后进入第二轮功能链路深度验证。
