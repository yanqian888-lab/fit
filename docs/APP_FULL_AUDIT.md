# 减肥搭子 App 整体走查文档

> 走查日期：2026-08-15
> 走查范围：backend / frontend / admin 三端全量代码
> 文档目的：模块框架整理 + 每个模块逻辑详解 + 全量数据字段说明

---

## 目录

- [一、整体框架模块整理](#一整体框架模块整理)
  - [1.1 技术栈与三端架构](#11-技术栈与三端架构)
  - [1.2 后端模块划分](#12-后端模块划分)
  - [1.3 前端模块划分](#13-前端模块划分)
  - [1.4 Admin 后台模块划分](#14-admin-后台模块划分)
- [二、各模块逻辑详解](#二各模块逻辑详解)
  - [2.1 后端：路由 / 控制器 / 服务层 / 中间件](#21-后端路由--控制器--服务层--中间件)
    - [2.1.5 认证与会话模块逻辑](#215-认证与会话模块逻辑)
    - [2.1.6 聊天与 AI Agent 模块逻辑](#216-聊天与-ai-agent-模块逻辑)
    - [2.1.7 记录中心模块逻辑](#217-记录中心模块逻辑)
    - [2.1.8 博物馆模块逻辑](#218-博物馆模块逻辑)
    - [2.1.9 宠物陪伴模块逻辑](#219-宠物陪伴模块逻辑)
    - [2.1.10 货币经济模块逻辑](#2110-货币经济模块逻辑)
    - [2.1.11 任务系统模块逻辑](#2111-任务系统模块逻辑)
    - [2.1.12 弹窗广告模块逻辑](#2112-弹窗广告模块逻辑)
    - [2.1.13 公告模块逻辑](#2113-公告模块逻辑)
    - [2.1.14 试用权限模块逻辑](#2114-试用权限模块逻辑)
    - [2.1.15 模板消息模块逻辑](#2115-模板消息模块逻辑)
  - [2.2 前端：页面 / 组件 / Store / 工具](#22-前端页面--组件--store--工具)
  - [2.3 Admin 后台：页面与功能](#23-admin-后台页面与功能)
- [三、全量数据字段说明](#三全量数据字段说明)
  - [3.1 用户与配置域](#31-用户与配置域)
  - [3.2 聊天与沉淀域](#32-聊天与沉淀域)
  - [3.3 宠物陪伴域](#33-宠物陪伴域)
  - [3.4 货币经济与商城域](#34-货币经济与商城域)
  - [3.5 事件与成就域](#35-事件与成就域)
  - [3.6 记录中心域](#36-记录中心域)
  - [3.7 博物馆与里程碑域](#37-博物馆与里程碑域)
  - [3.8 食物 / 运动 / 自定义库](#38-食物--运动--自定义库)
  - [3.9 弹窗 / 公告 / 通知域](#39-弹窗--公告--通知域)
  - [3.10 CMS 管理后台域](#310-cms-管理后台域)
  - [3.11 AI 与 Prompt 域](#311-ai-与-prompt-域)
  - [3.12 试用权限域](#312-试用权限域)
  - [3.13 系统辅助表](#313-系统辅助表)

---

## 一、整体框架模块整理

### 1.1 技术栈与三端架构

| 端 | 技术栈 | 端口 | 数据库 | 入口 |
|----|--------|------|--------|------|
| **backend** | Node.js + Express + better-sqlite3 | 3000 | SQLite (`app.db` / `app_test.db` / `app_production.db`) | [backend/src/app.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/app.js) |
| **frontend** | uni-app (Vue3) + Vite + Pinia + uview-plus | 5173 | - | [frontend/src/main.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/main.js) |
| **admin** | Vue3 + Vite + Element Plus + Pinia | 5174 | - | [admin/src/main.js](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/main.js) |

**多环境支持**：
- 开发：`.env.development`（前端指向 `localhost:3000`）
- 测试：`.env.test`（指向 `test-api.fitapp.com`）
- 生产：`.env.production`（指向 `api.fitapp.com`）
- 后端通过 [backend/src/config/index.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/config/index.js) 按 `NODE_ENV` 加载 `.env.{NODE_ENV}`，自动跳过占位符防覆盖真实密钥

**部署架构**：
- 后端用 PM2 托管（[ecosystem.config.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/ecosystem.config.js) 同时管理 `fit-backend-test` 与 `fit-backend-prod`）
- 前端 H5 通过 [scripts/deploy-h5.sh](file:///Users/yanqian/Desktop/练习项目/fit/scripts/deploy-h5.sh) 构建后部署到 Nginx
- Admin 后台通过 [scripts/deploy-admin.sh](file:///Users/yanqian/Desktop/练习项目/fit/scripts/deploy-admin.sh) 构建后部署到 Nginx
- 三端共用同一份后端 API，通过域名区分环境

### 1.2 后端模块划分

```
backend/src/
├── app.js                  # 应用入口（Express 实例、中间件链、路由挂载）
├── db.js                   # SQLite 数据库初始化与迁移（60+ 张表）
├── config/                 # 配置层
│   ├── index.js            # 环境变量加载与导出
│   ├── policies.js         # 用户协议、隐私政策、关于我们默认文案
│   └── promptDefaults.js   # AI Prompt 默认值
├── constants/
│   └── configKeys.js       # app_configs 表的配置键常量
├── middleware/             # 中间件层
│   ├── auth.js             # C 端用户 JWT 鉴权 + admin 角色校验
│   ├── cmsAuth.js          # CMS 管理员鉴权 + 细粒度权限校验
│   └── configRateLimiter.js # 接口限流
├── controllers/            # 控制器层（C 端 + CMS 共 40+ 控制器）
├── services/               # 服务层（业务逻辑）
│   ├── agents/             # AI Agent 层
│   │   ├── mainAgent.js    # 主协调 Agent（意图识别、共情回复、工具调度）
│   │   ├── helperAgent.js  # 全能助手（营养计算、运动建议）
│   │   ├── precipitationAgent.js # 沉淀 Agent（自动抽取记录）
│   │   └── partnerAssetAgent.js  # 搭子资产 Agent（提取食谱/方法/感悟）
│   ├── aiClient.js         # 大模型调用封装（超时、重试、备用模型）
│   ├── aiConfigService.js  # AI 配置管理
│   ├── promptService.js    # Prompt 版本管理
│   ├── petService.js       # 宠物状态机
│   ├── currencyService.js  # 货币与交易
│   ├── shopService.js      # 商城
│   ├── inventoryService.js # 背包
│   ├── taskService.js      # 任务系统
│   ├── achievementService.js # 成就
│   ├── eventService.js     # 事件掉落
│   ├── eventDropService.js # 事件掉落概率
│   ├── museumService.js    # 博物馆
│   ├── nutritionService.js # 营养计算
│   ├── workoutService.js   # 陪你动课程
│   ├── fastingService.js   # 轻断食
│   ├── milestoneTemplateService.js # 里程碑文案模板
│   ├── newbieTaskService.js # 新手任务
│   ├── templateMessageService.js # 模板消息
│   ├── trialService.js     # 试用权限
│   ├── voiceService.js     # 语音转写/TTS
│   ├── webSearchService.js # 网络搜索
│   ├── exerciseMergeService.js # 运动库合并
│   ├── tagMatcher.js       # 标签匹配
│   ├── rewardService.js    # 奖励
│   ├── rewardReceiptService.js # 奖励凭证
│   ├── chatState.js        # 聊天上下文
│   ├── configMonitorService.js # 配置监控
│   ├── configVersionService.js # 配置版本控制
│   └── cmsLogService.js    # CMS 操作日志
├── routes/
│   └── index.js            # 路由聚合（200+ 条路由）
└── utils/                  # 工具函数
    ├── chinaTime.js         # 东八区时间
    ├── configCache.js       # 配置缓存
    ├── date.js              # 日期处理
    ├── deleteUserFiles.js   # 删除用户文件
    ├── intent.js            # 意图识别
    ├── lruCache.js          # LRU 缓存
    ├── response.js          # 统一响应封装
    ├── safeJson.js          # 安全 JSON 解析
    ├── seedCms.js           # CMS 种子数据
    └── staticUrl.js         # 静态资源 URL
```

### 1.3 前端模块划分

**TabBar 四大主页面**（见 [frontend/src/pages.json](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/pages.json#L238-L269)）：
1. `pages/index/index` — 今日/聊聊
2. `pages/pet/index` — 宠物小窝
3. `pages/record/index` — 记录中心
4. `pages/museum/index` — 博物馆

**业务模块分组**：
```
frontend/src/pages/
├── splash/         # 启动屏
├── onboarding/     # 引导页（含任务引导）
├── login/          # 登录
├── register/       # 注册
├── profile/        # 资料设置
├── partner/        # 搭子设置（模式选择、配置）
├── index/          # 今日首页（聊天入口）
├── pet/            # 宠物小窝（含 currency-detail）
│   └── panels/     # 弹层面板（背包/事件/商店/任务）
├── record/         # 记录中心
│   ├── add-food / create-food / food-detail / diet-detail
│   ├── add-exercise / exercise-detail
│   ├── body-data / habit / mood
├── museum/         # 博物馆
│   ├── diary / diary-generate / diary-detail
│   ├── milestones / recipes / recipe-detail
│   ├── insights / methods / item-edit
│   ├── compare / photo-upload
├── workout/        # 陪你动课程会话
├── chat/           # 聊天设置
├── tasks/          # 任务中心
├── shop/           # 商店
├── inventory/      # 背包
├── user/           # 我的
│   ├── profile / data-manage / achievement
│   ├── notifications / messages
│   ├── about / privacy / agreement
│   ├── help / help-detail / feedback
│   ├── account-settings / delete-account-agreement
├── admin/          # 内嵌 Admin（feedback / privacy）
├── guide/          # 功能引导
├── webview/        # H5 容器
└── blank/          # 空白页
```

### 1.4 Admin 后台模块划分

参考 [admin/src/router/menu.js](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/router/menu.js)，分为 7 大菜单组：

| 菜单组 | 路径 | 子页面 | 权限 |
|--------|------|--------|------|
| 首页 | `/dashboard` | 仪表盘 | `dashboard` |
| 运营数据 | `/operation-stats` | 数据看板 | `operation_stats:read` |
| 运营内容 | `/operation` | 公告管理 / 通知渠道 / 弹窗广告管理 | `announcement:read` |
| 应用配置 | `/app-config` | 协议配置 / 模板消息 / 公共食品库 / 自定义食物审核 / 运动库 / 里程碑文案 / 博物馆入口 | `app_config:read` |
| AI 配置 | `/ai-config` | AI 配置 / Prompt 管理 | `ai_config:read` |
| 陪伴系统 | `/companion-config` | 宠物 / 货币 / 商店 / 事件 / 任务 / 成就 / 对话 | `pet_config:read` |
| C 端用户 | `/app-users` | 用户列表 / 详情 | `app_user:read` |
| 试用权限 | `/trial-config` | 试用配置 / 白名单 | `trial_config:read` |
| 反馈管理 | `/feedbacks` | 反馈列表 | `feedback:read` |
| 管理员 | `/cms-users` | 管理员账号 / 角色 | `cms_user:read` |
| 操作日志 | `/logs` | 日志列表 | `log:read` |

---

## 二、各模块逻辑详解

### 2.1 后端：路由 / 控制器 / 服务层 / 中间件

#### 2.1.1 路由清单（按模块分组）

完整路由见 [backend/src/routes/index.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/routes/index.js)。下表按业务域分组：

| 模块 | 路由前缀 | 鉴权 | 主要接口 |
|------|---------|------|---------|
| **认证** | `/auth` | 公开 | `login` / `register` / `wechat-login` / `wechat-bind` |
| **用户** | `/users` | `authMiddleware` | `getMe` / `updateMe` / `updateProfile` / `uploadAvatar` / `exportData` / `clearData` / `deleteAccount` |
| **搭子** | `/partners` | `authMiddleware` | `getPartner` / `updatePartner` / `switchMode` / `getStatus` |
| **聊天** | `/chat` | `authMiddleware` | `send` / `messages` / `pending-assets` / `confirm-precipitation` / `stats` / `wakeup` / `advice` |
| **记录中心** | `/records` | `authMiddleware` | `today` / `diet`(CRUD) / `exercise`(CRUD) / `body`(CRUD) / `habit`(CRUD) / `fasting` / `milestone-data` / `dates` |
| **博物馆** | `/museum` | `authMiddleware` | `overview` / `timeline` / `items`(CRUD) / `confirm` / `discard` / `favorite` / `share` / `mood` |
| **沉淀记录** | `/precipitations` | `authMiddleware` | CRUD |
| **宠物** | `/pet` | `authMiddleware` | `getPet` / `feed` / `exercise` / `explore` / `events` / `dialogues` |
| **货币** | `/currency` | `authMiddleware` | `getCurrency` / `transactions` |
| **商城** | `/shop` | `authMiddleware` | `items` / `buy` |
| **背包** | `/inventory` | `authMiddleware` | `getInventory` / `use` |
| **任务** | `/tasks` | `authMiddleware` | `getTasks` / `claim` |
| **签到** | `/checkin` | `authMiddleware` | `status` / `checkin` |
| **成就** | `/achievements` | `authMiddleware` | `getAchievements` |
| **新手任务** | `/newbie-tasks` | `authMiddleware` | `list` / `claim` |
| **陪你动** | `/workouts` | `authMiddleware` | `list` / `detail` / `start` / `complete` |
| **食物库** | `/foods` | `authMiddleware` | `list` / `detail` / `favorite` / `custom` |
| **运动库** | `/exercises` | `authMiddleware` | `list` / `detail` / `favorite` / `custom` |
| **设置** | `/settings` | `authMiddleware` | `get` / `update` |
| **AI 日记** | `/ai/diary` | `authMiddleware` | `generate` / `history` / `monthly` / `detail` / `delete` / `favorite` |
| **AI 里程碑** | `/ai/milestones` | `authMiddleware` | `get` / `check` |
| **AI 平台期** | `/ai/plateau` | `authMiddleware` | `analyze` |
| **反馈** | `/feedback` | `authMiddleware` | `list` / `create` |
| **试用** | `/trial` | `authMiddleware` | `get-config` / `check-permission` / `report-count` |
| **应用配置** | `/app-config` | 公开 | `getAppConfig`（协议/隐私/关于） |
| **弹窗广告** | `/app/popup` | 公开+鉴权 | `config/list` / `report` |
| **公告** | `/app/announcements` | `authMiddleware` | `list` / `detail` / `read` / `show` / `unread-count` / `channels` |
| **方法库** | `/methods` | `authMiddleware` | CRUD |
| **语音** | `/voice` | `authMiddleware` | `transcribe` / `tts` |
| **照片** | `/photos` | `authMiddleware` | `list` / `upload` / `delete` |
| **上传** | `/upload` | `authMiddleware` | `image` |
| **CMS 鉴权** | `/cms/auth` | `cmsAuthMiddleware` | `login` / `profile` / `password` |
| **CMS 角色** | `/cms/roles` | `cmsAuth+perm` | CRUD |
| **CMS 管理员** | `/cms/users` | `cmsAuth+perm` | CRUD + 重置密码 |
| **CMS 应用配置** | `/cms/app-config` | `cmsAuth+perm` | `get` / `update` |
| **CMS Prompt** | `/cms/prompts` | `cmsAuth+perm` | `list` / `detail` / `publish` / `setEnabled` / `setAiConfig` |
| **CMS AI 配置** | `/cms/ai-configs` | `cmsAuth+perm` | CRUD + `simple` |
| **CMS 里程碑模板** | `/cms/milestone-templates` | `cmsAuth+perm` | CRUD + `seed` |
| **CMS 博物馆入口** | `/cms/museum-config` | `cmsAuth+perm` | `get` / `update` |
| **CMS 模板消息** | `/cms/template-config` | `cmsAuth+perm` | CRUD + `types` + `seed` |
| **CMS C 端用户** | `/cms/app-users` | `cmsAuth+perm` | `list` / `create` / `detail` / `status` / `delete` / `records` |
| **CMS 反馈** | `/cms/feedbacks` | `cmsAuth+perm` | `list` / `detail` / `reply` / `status` |
| **CMS 食品库** | `/cms/foods` | `cmsAuth+perm` | CRUD + `import` |
| **CMS 自定义食物审核** | `/cms/custom-foods` | `cmsAuth+perm` | `list` / `detail` / `approve` / `reject` |
| **CMS 运动库** | `/cms/exercises` | `cmsAuth+perm` | CRUD |
| **CMS 日志** | `/cms/logs` | `cmsAuth+perm` | `list` |
| **CMS 试用管理** | `/cms/trial/*` | `cmsAuth+perm` | `dashboard` / `config` / `audit-mode` / `whitelist`(CRUD+batch) / `logs` |
| **CMS 弹窗管理** | `/cms/popups` | `cmsAuth+perm` | CRUD + `copy` + `batch-status` + `batch-delete` |
| **CMS 弹窗白名单** | `/cms/popup-whitelist` | `cmsAuth+perm` | CRUD |
| **CMS 站内路由** | `/cms/app-routes` | `cmsAuth+perm` | CRUD |
| **CMS 弹窗统计** | `/cms/popup-stats` | `cmsAuth+perm` | `dashboard` / `detail` / `export` |
| **CMS 弹窗全局配置** | `/cms/popup-global` | `cmsAuth+perm` | `get` / `update` |
| **CMS 公告** | `/cms/announcements` | `cmsAuth+perm` | CRUD + `batch-status` + `batch-delete` |
| **CMS 通知渠道** | `/cms/notification-channels` | `cmsAuth+perm` | `list` / `update` |
| **CMS 运营统计** | `/cms/operation-stats` | `cmsAuth+perm` | `dashboard` / `announcements` / `popups` / `templates` |
| **CMS 宠物配置** | `/cms/pet-config/*` | `cmsAuth+perm` | `global` / `schedules` / `sprite` / `scenes` / `skins`(CRUD) / `states`(CRUD) / `exercises`(CRUD) / `dialogues`(CRUD) |
| **CMS 货币配置** | `/cms/currency-config` | `cmsAuth+perm` | `rules` / `analysis-cost` / `transactions` / `adjust` |
| **CMS 商城配置** | `/cms/shop/items` | `cmsAuth+perm` | CRUD |
| **CMS 事件配置** | `/cms/events` | `cmsAuth+perm` | CRUD + `collections`(CRUD) |
| **CMS 陪你动配置** | `/cms/workouts` | `cmsAuth+perm` | CRUD + `status` |
| **CMS 任务配置** | `/cms/tasks` | `cmsAuth+perm` | CRUD |
| **CMS 成就配置** | `/cms/achievements` | `cmsAuth+perm` | CRUD |
| **CMS 对话配置** | `/cms/dialogues` | `cmsAuth+perm` | CRUD |

#### 2.1.2 控制器职责

##### C 端控制器

| 控制器 | 职责 |
|--------|------|
| [authController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/authController.js) | 用户登录（账密/微信）、注册、微信绑定手机号；签发 JWT |
| [userController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/userController.js) | 获取/更新用户资料、头像上传、数据导出、清空数据、注销账号 |
| [partnerController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/partnerController.js) | 搭子信息读取、更新、模式切换（温柔/严格/毒舌）、状态查询 |
| [chatController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/chatController.js) | 发送消息（触发 AI Agent 链）、历史消息、待确认沉淀资产、确认沉淀、聊天统计、唤醒消息、减重建议 |
| [recordController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/recordController.js) | 今日汇总、饮食/运动/身体/习惯/轻断食记录的 CRUD、里程碑数据、有记录的日期列表 |
| [museumController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/museumController.js) | 博物馆总览、时间轴、物品 CRUD、确认/丢弃/收藏/分享、心情记录与统计 |
| [precipitationController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/precipitationController.js) | 沉淀记录的手动 CRUD |
| [companionController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/companionController.js) | 宠物（喂食/运动/外出/事件/对话）、货币、商城、背包、任务、签到、成就 |
| [newbieTaskController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/newbieTaskController.js) | 新手任务列表、领取奖励 |
| [workoutController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/workoutController.js) | 陪你动课程列表、详情、开始、完成 |
| [systemController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/systemController.js) | 食物/运动库查询、收藏、自定义、用户设置、应用全局配置（协议/隐私/关于） |
| [aiController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/aiController.js) | AI 日记生成/历史/月报/详情/删除/收藏、里程碑检查、平台期分析 |
| [feedbackController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/feedbackController.js) | 用户反馈创建/列表、管理员回复/状态更新 |
| [methodController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/methodController.js) | 方法库 CRUD |
| [photoController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/photoController.js) | 对比墙照片列表/上传/删除 |
| [voiceController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/voiceController.js) | 语音转文字、文字转语音 |
| [uploadController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/uploadController.js) | 通用图片/视频上传 |
| [announcementController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/announcementController.js) | 公告列表/详情/已读/曝光上报、未读数、通知渠道 |
| [popupController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/popupController.js) | 弹窗配置下发、事件上报 |
| [trialController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/trialController.js) | 试用配置、权限校验、使用次数上报 |

##### CMS 后台控制器

| 控制器 | 职责 |
|--------|------|
| [cmsAuthController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsAuthController.js) | CMS 登录、获取 profile、修改密码 |
| [cmsUserController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsUserController.js) | 管理员账号 CRUD、角色 CRUD、重置密码 |
| [cmsConfigController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsConfigController.js) | 应用全局配置（协议/隐私/关于）读写 |
| [cmsTemplateController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsTemplateController.js) | 模板消息配置 CRUD、类型枚举、种子初始化 |
| [cmsAppUserController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsAppUserController.js) | C 端用户管理、状态变更、删除、记录概览 |
| [cmsFeedbackController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsFeedbackController.js) | 反馈列表、详情、回复、状态更新 |
| [cmsFoodController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsFoodController.js) | 食品库 CRUD、批量导入 |
| [cmsCustomFoodController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsCustomFoodController.js) | 自定义食物审核（通过/拒绝） |
| [cmsExerciseController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsExerciseController.js) | 运动库 CRUD |
| [cmsLogController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsLogController.js) | CMS 操作日志查询 |
| [cmsPromptController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsPromptController.js) | Prompt 版本管理、发布、启停、绑定 AI 配置 |
| [cmsAiConfigController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsAiConfigController.js) | AI 配置 CRUD（主备模型、温度、超时等） |
| [cmsMilestoneController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsMilestoneController.js) | 里程碑文案模板 CRUD、种子初始化 |
| [cmsMuseumConfigController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsMuseumConfigController.js) | 博物馆入口配置 |
| [cmsTrialController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsTrialController.js) | 试用配置管理、白名单 CRUD、试用日志、看板 |
| [cmsPopupController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsPopupController.js) | 弹窗 CRUD、复制、批量操作、白名单、站内路由、统计看板、全局配置 |
| [cmsAnnouncementController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsAnnouncementController.js) | 公告 CRUD、批量操作、通知渠道管理 |
| [cmsOperationStatsController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsOperationStatsController.js) | 运营数据看板（公告/弹窗/模板统计） |
| [cmsPetController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsPetController.js) | 宠物全局配置、时段、序列帧、场景、皮肤、状态库、运动库、对话 |
| [cmsCurrencyController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsCurrencyController.js) | 货币规则、分析消耗、交易流水、手动调整 |
| [cmsShopController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsShopController.js) | 商城商品 CRUD |
| [cmsEventController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsEventController.js) | 事件库 CRUD、事件集合 CRUD |
| [cmsWorkoutController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsWorkoutController.js) | 陪你动课程 CRUD、上下架 |
| [cmsTaskController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsTaskController.js) | 任务配置 CRUD |
| [cmsAchievementController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsAchievementController.js) | 成就配置 CRUD |
| [cmsDialogueController](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/controllers/cmsDialogueController.js) | 宠物对话配置 CRUD |

#### 2.1.3 服务层职责

##### AI Agent 层

| Agent | 职责 |
|-------|------|
| [mainAgent](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/agents/mainAgent.js) | **主协调 Agent**：对话上下文维护（保留最近 10 条）、意图识别、共情话术生成、工具调用调度。根据搭子模式（温柔/严格/毒舌）切换 system prompt，融合用户信息（昵称/性别/年龄/身高/体重/目标/忌口/偏好）和宠物人设。55 秒超时保护 |
| [helperAgent](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/agents/helperAgent.js) | **全能助手 Agent**：负责具体营养计算、运动建议、卡路里分析等专业任务，被 mainAgent 调度 |
| [precipitationAgent](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/agents/precipitationAgent.js) | **沉淀 Agent**：分析用户消息内容，自动抽取饮食/运动/身体/习惯等结构化记录；对 `recipe` 类型显式返回 null（食谱由 partnerAssetAgent 处理，避免双处理路径） |
| [partnerAssetAgent](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/agents/partnerAssetAgent.js) | **搭子资产 Agent**：从 AI 回复中提取食谱、方法、感悟、金句等内容沉淀到博物馆；通过 `normalizeRecipeData()` 将食材标准化为 `[{name, amount}]` 结构 |

##### 业务服务

| 服务 | 职责 |
|------|------|
| [aiClient](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/aiClient.js) | 大模型调用封装：超时控制、重试、主备模型切换 |
| [aiConfigService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/aiConfigService.js) | AI 配置读取与缓存（主备模型、温度、max_tokens） |
| [promptService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/promptService.js) | Prompt 版本管理：按 key 取最新启用版本，支持变量插值 |
| [petService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/petService.js) | 宠物状态机：心情/饱腹度衰减、状态切换、每日计数重置、buff 管理 |
| [currencyService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/currencyService.js) | 货币增减、交易流水记录、余额校验 |
| [shopService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/shopService.js) | 商品上架校验、购买、库存扣减 |
| [inventoryService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/inventoryService.js) | 背包物品添加、使用、过期清理 |
| [taskService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/taskService.js) | 任务进度更新、完成校验、奖励发放、周期重置 |
| [achievementService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/achievementService.js) | 成就解锁条件检查、徽章发放 |
| [eventService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/eventService.js) | 事件掉落触发、用户事件记录 |
| [eventDropService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/eventDropService.js) | 事件掉落概率计算（按权重、稀有度、必要条件） |
| [museumService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/museumService.js) | 博物馆物品入库、去重、分类索引 |
| [nutritionService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/nutritionService.js) | 营养素计算（蛋白质/碳水/脂肪/热量） |
| [workoutService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/workoutService.js) | 陪你动课程进度、消耗计算（按小时消耗折算） |
| [fastingService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/fastingService.js) | 轻断食模式（16:8 等）、进食窗口、实际时长 |
| [milestoneTemplateService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/milestoneTemplateService.js) | 里程碑文案模板匹配（按类型和数值） |
| [newbieTaskService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/newbieTaskService.js) | 新手任务初始化、完成检测、奖励领取 |
| [templateMessageService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/templateMessageService.js) | 模板消息触发（早餐/午餐/晚餐/运动/唤醒）、发送记录 |
| [trialService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/trialService.js) | 试用次数统计、白名单校验、版本/IP 白名单 |
| [voiceService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/voiceService.js) | 语音转文字、TTS 合成 |
| [webSearchService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/webSearchService.js) | 联网搜索（AI 工具调用） |
| [exerciseMergeService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/exerciseMergeService.js) | 系统运动库与自定义运动合并查询 |
| [tagMatcher](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/tagMatcher.js) | 标签匹配（食物/运动分类） |
| [rewardService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/rewardService.js) | 奖励统一发放（货币/物品/成就） |
| [rewardReceiptService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/rewardReceiptService.js) | 奖励凭证记录（防重发） |
| [chatState](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/chatState.js) | 聊天上下文管理（最近 N 轮） |
| [configMonitorService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/configMonitorService.js) | 配置变更监控 |
| [configVersionService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/configVersionService.js) | 配置版本控制 |
| [cmsLogService](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/services/cmsLogService.js) | CMS 操作日志记录 |

#### 2.1.4 中间件

| 中间件 | 文件 | 职责 |
|--------|------|------|
| `authMiddleware` | [middleware/auth.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/middleware/auth.js) | C 端用户 JWT 校验，从 token 解析 user_id 注入 `req.user` |
| `adminMiddleware` | 同上 | 校验 `req.user.role === 'admin'`，用于 `/admin/*` 路由 |
| `cmsAuthMiddleware` | [middleware/cmsAuth.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/middleware/cmsAuth.js) | CMS 管理员 JWT 校验，注入 `req.cmsUser`（含 role_id） |
| `cmsPermissionMiddleware(perm)` | 同上 | 细粒度权限校验：从 `cms_roles.permissions`（JSON 数组）中查找 `perm`，未命中则 403 |
| `configRateLimiter` | [middleware/configRateLimiter.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/middleware/configRateLimiter.js) | 接口限流，防止恶意调用 |

#### 2.1.5 认证与会话模块逻辑

##### 账号注册（`authController.register`）

1. **参数校验**：账号须 6-10 位字母+数字且同时包含字母和数字（`validateUsernameCombo`）；密码须 6-12 位字母+数字且同时包含字母和数字（`validatePassword`）；手机号必须 11 位。
2. **唯一性校验**：分别查询 `users.username` 和 `users.phone`，任一已存在返回 409。
3. **密码加密**：`bcrypt.hashSync(password, 10)`（10 轮加盐）。
4. **用户初始化**（`createUserWithInit`，事务内完成）：
   - 生成全局唯一 `user_id`（`fit_` + 时间戳 + 随机数）；
   - 插入 `users` 主表；
   - 插入 `user_profiles` 健康档案（初始体重/目标体重/BMR/TDEE 等留空，待用户完善）；
   - 插入 `partners` 默认搭子（名称"你的搭子"，模式 `gentle`）；
   - 插入 `pet_states` 宠物状态（位置 `home`，计数清零）；
   - 插入 `user_currency` 货币账户（浆果/鲜花初始为 0）；
   - 插入 `settings` 默认设置（通知开关全开，饮水目标 2000ml）；
   - 初始化新手任务（`newbieTaskService.initNewbieTasks`）。
5. **签发 JWT**：载荷 `{ id, role, source }`，有效期由 `JWT_EXPIRES_IN` 控制（默认 7d）。
6. **游客合并**：若请求带 `device_id`，调用 `trialService.mergeDeviceCountToUser` 将设备级试用次数合并到用户账号。

##### 账号登录（`authController.login`）

1. **参数校验**同注册。
2. **用户查询**：按 `username` 查 `users`，不存在返回 401"账号或密码错误"（不区分账号/密码错误，防枚举）。
3. **状态校验**：`user.status !== 1` 返回 403"账号已被禁用"。
4. **密码校验**：`bcrypt.compareSync`，失败返回 401。
5. **更新登录时间**：`last_login_at = CURRENT_TIMESTAMP`。
6. **签发 JWT** + **游客合并**同注册。

##### 微信小程序登录（`authController.wechatLogin`）

1. 用 `code` 调微信 `jscode2session` 换取 `openid` 与 `session_key`。
2. 按 `openid` 查 `users.wechat_openid`：
   - **已存在**：直接签发 token；
   - **不存在**：返回 `need_bind_phone: true`，前端引导绑定手机号（调 `wechatBindPhone`）。
3. `wechatBindPhone`：校验手机号是否已注册——已注册则绑定 openid，未注册则创建新用户（source=`wechat`）。

##### JWT 中间件校验（`authMiddleware`）

1. 从 `Authorization: Bearer <token>` 提取 token。
2. `jwt.verify` 校验签名与有效期，失败返回 401。
3. 查 `users` 确认用户存在且 `status=1`，注入 `req.userId` 与 `req.user`。
4. `adminMiddleware` 在此基础上额外校验 `req.user.role === 'admin'`。

##### CMS 管理员鉴权（`cmsAuthMiddleware`）

1. 从 token 解析 `cmsUser`（含 `id`、`username`、`role_id`）。
2. 查 `cms_users` 确认账号存在且 `status=1`。
3. **权限实时拉取**：从 `cms_roles.permissions`（JSON 数组）读取该角色的权限列表，注入 `req.cmsUser.permissions`。
4. `cmsPermissionMiddleware(perm)`：检查 `req.cmsUser.permissions` 是否包含 `perm`，未命中返回 403。

#### 2.1.6 聊天与 AI Agent 模块逻辑

##### 发送消息主流程（`chatController.sendMessage`）

整个流程分为"同步返回 + 异步沉淀/Helper"两阶段：

**阶段一：初始化与同步响应**

1. **参数校验**：内容非空、不超过 `MAX_MESSAGE_LENGTH` 字、日期格式合法。
2. **加载用户与搭子**：联查 `users` + `user_profiles`（含 BMR/TDEE/目标体重/忌口/偏好），查 `partners`。
3. **事务初始化**（`withTransaction`）：
   - 搭子不存在时自动创建默认搭子；
   - 保存用户消息到 `chat_messages`；
   - **同步标签匹配**：`tagMatcher.matchMessageTags(content)` 按关键词给消息打 `precipitation_status=2`（待确认）与 `precipitation_type`；
   - 更新用户聊天统计（`templateMessageService.onUserMessage`，重置连续未回复计数）；
   - 推进"和搭搭聊天"任务（`taskService.updateTaskProgress(userId, 'chat', 1)`）；
   - 检查新手任务（`newbieTaskService.checkAction(userId, 'chat')`）。
4. **加载历史消息**：取最近 20 条（排除当前消息），按时间正序。
5. **调用主协调 Agent**：`mainAgent.callMainAgent(content, history, user, partner)`，55 秒超时保护。
6. **判断是否需要 Helper**（`needsHelper`）：满足以下任一条件且回复中未出现"千卡/kcal/BMI"时触发：
   - mainAgent 返回 `call_allround_helper` 工具调用；
   - 内容是专业问题（`isProfessionalQuestion`：包含热量/代谢/BMI/食谱/运动等关键词）且回复无计算结果；
   - 同时包含食物和运动关键词且回复无计算结果；
   - 同步标签命中 `body_data` 且回复无计算结果。

**阶段二A：异步 Helper 模式**（`needsHelper && 回复无计算结果`）

1. 标记 `chatState.setHelperPending(userId, true)`，防止模板消息打断。
2. 先保存并返回第一条共情话术消息（`finalReply || '嗯嗯，我在听～'`），响应 `async_helper: true`。
3. **异步执行**（`setTimeout 100ms`）：
   - 等待沉淀 Agent 完成（`Promise.race`，最多等 20 秒），确保饮食/运动记录已写入后再调用 Helper；
   - 调用 `helperAgent.callHelperAgent`；
   - 保存完整 Helper 回答为第二条 partner 消息；
   - 自动提取食谱（`savePartnerRecipes`）或方法（`partnerAssetAgent.extractPartnerMethod`）；
   - 清除 `helperPending` 标记。

**阶段二B：同步 Helper 模式**（`!needsHelper || 回复已有计算结果`）

1. 执行工具调用（`mainAgent.executeToolCalls`）：`call_allround_helper` 的回答追加到 `finalReply`，`jump_to_page` 返回跳转页。
2. **兜底**：若 `isProfessionalQuestion` 但 mainAgent 未调 Helper 且回复为空/兜底语，强制调一次 `helperAgent`。
3. 保存搭子回复，提取食谱/方法。
4. 异步检查聊天里程碑（`achievementService.checkChatCount`）。

**兜底容错**：若 AI 异常但用户消息已落库，补一条"搭搭刚才有点走神，能再说一遍吗？"消息，避免"有问无答"。

##### 主协调 Agent（`mainAgent.callMainAgent`）

1. **System Prompt 构建**：根据搭子模式（`gentle`/`strict`/`tease`）映射为"温柔鼓励型/严格监督型/毒舌模式"，注入用户信息（昵称/性别/年龄/身高/体重/目标/忌口/偏好）和宠物人设（宠物名+物种，强调"你和小窝里的宠物是同一只搭搭"）。
2. **上下文截取**：保留最近 10 条历史，`partner` 角色映射为 `assistant`。
3. **模型调用**：`temperature=0.7`、`max_tokens=1000`，55 秒超时。
4. **工具调用解析**（`parseToolCalls`）：支持两种标记格式——`<<<FunctionCall>>>...<<<FunctionCallEnd>>>` 和 `<|FunctionCallBegin|>...<|FunctionCallEnd|>`，解析为 `{name, parameters}` 数组。
5. **强制兜底**：若模型提到"方案/计划/方法/算算/热量/消耗/卡路里/怎么"等词但未调用工具，强制注入 `call_allround_helper` 工具调用。
6. **清理回复**：`cleanToolCallMarkers` 移除工具调用标记，`stripThinkingTags` 移除思考过程标签。

##### 沉淀 Agent（`precipitationAgent.callPrecipitationAgent`）

负责从用户消息中自动提取结构化记录，是"聊天即记录"的核心：

1. **本地预过滤**：
   - `shouldPrecipitate(content)`：不含沉淀关键词（吃/喝/运动/体重/步数等）直接跳过；
   - `isQuestionContent(content)`：疑问句/咨询句（如"黄瓜可以吗？"）且无自我报告标记时跳过，避免错误沉淀；
   - `hasNegativeRecordIntent(content)`：否定/犹豫意图（"不想吃了/没吃/懒得动"）且无自我报告标记时跳过。
2. **LLM 调用**：`temperature=0.1`（低温度保证稳定）、`max_tokens=1200`、`response_format: json_object`。
3. **结果解析**：支持数组和单对象格式，尝试 JSON 解析，失败时用 `extractJsonObjects` 兜底提取。
4. **后处理兜底**（逐项修正 LLM 漏提取/误判）：
   - `recoverExplicitCalorieFoods`：正则匹配"XX大卡"格式，补回 LLM 漏提取的食物；
   - `normalizeHalfQuantities`：将"半个"等分数转换为 0.5；
   - `sanitizeFoodNames`：清理食物名前缀/后缀填充词（"一个/一份/少量"等）；
   - `sanitizeFoodWeights`：校验食物重量合理性；
   - `recoverMissedExercises`：按运动关键词补回 LLM 漏提取的运动。
5. **有效性校验**（`isValidPrecipitationItem`）：
   - `diet_record`：foods 数组非空且至少一个有名称；
   - `exercise_record`：exercises 非空，步数/时长/消耗/距离全为 0 的项被过滤；步数>0 时自动折算时长（步数/100）和消耗（步数×0.04）；
   - `body_data`：value 非空；
   - `habit`：value 和 sub_type 非空；
   - 资产类（recipe/method/insight/quote）：`hasAssetContent` 检查实质内容。
6. **类型过滤**：
   - 仅保留 `sub_type=water` 的喝水习惯，睡眠/排便/心情等暂不沉淀；
   - `emotion` 类型过滤掉；
   - **`recipe` 类型显式返回 false**——食谱由 `partnerAssetAgent` 专属处理，避免双处理路径。
7. **疑问句守卫**：疑问句中的资产类沉淀需置信度≥0.85 且有实质内容，否则过滤。
8. **写入与同步**：写入 `precipitation_records`，调用 `syncToBusinessTable` 同步到 `diet_records`/`exercise_records`/`body_records`/`habit_records` 业务表，返回 `precipitation_id` 供消息关联。
9. **饮品兜底转换**：LLM 把牛奶/咖啡/果汁误判为喝水习惯时，`convertBeverageHabitToDiet` 转成 `diet_record`，从食物库查营养数据折算热量。

##### 搭子资产 Agent（`partnerAssetAgent`）

从 AI 回复中提取个人资产沉淀到博物馆：

1. **食谱提取**（`extractPartnerRecipes`）：
   - 调用 LLM 分析回复，提取食谱列表；
   - `normalizeRecipeData()` 将食材标准化为 `[{name, amount}]` 结构；
   - 通过 `savePartnerRecipes` 写入 `precipitation_records`（type=`recipe`，status=0 待确认），含标题/内容/食材/步骤/小贴士/餐别/总重量/总热量。
2. **方法提取**（`extractPartnerMethod`）：当消息包含运动/健身/训练等关键词（`isMethodContent`）时，提取方法写入 `museum_items`（type=`method`，author=`partner`，status=0 待确认）。

##### 获取待确认资产（`getPendingAssets`）

按 `message_ids` 批量查询 `precipitation_records` 和 `museum_items` 中 `status=0` 的待确认资产，供前端展示"待确认卡片"。

##### 确认沉淀（`confirmPrecipitation`）

1. 查 `precipitation_records` 中 `status=0` 的记录。
2. 若 `confirmed=true`：
   - 支持用户修改数据（`modified_data`）覆盖 `extracted_data`；
   - 调用 `syncToBusinessTable` 写入业务表（饮食/运动/身体/习惯）；
   - 更新沉淀记录 `status=1`；
   - 同步 `chat_messages.precipitation_status=1`；
   - 触发奖励（`rewardService.rewardForPrecipitationRecord`）。
3. 若 `confirmed=false`：更新 `status=2`（已忽略），同步消息 `precipitation_status=0`。

#### 2.1.7 记录中心模块逻辑

##### 今日汇总（`recordController.getToday`）

聚合查询当日各类型记录：饮食（按餐别分组+总热量）、运动（总时长+总消耗）、身体数据（体重/体脂）、习惯（饮水/睡眠）、轻断食状态，返回给前端记录中心首页。

##### 饮食记录 CRUD

- **保存**（`saveDiet`）：支持单条/批量，按 `precipitation_id` upsert（有则更新、无则插入），自动计算总热量（从 `food_db` 查营养数据 × 数量）。
- **删除**：软删除（`status=0`）。
- **查询**：按日期+餐别过滤，联查 `food_db` 补充食物图标/分类。

##### 运动记录 CRUD

- **保存**：按 `precipitation_id` upsert，从 `exercise_db` 查 MET 值，按体重×时长×MET 计算消耗。
- **步数折算**：仅步数时自动折算时长（步数/100）和消耗（步数×0.04）。

##### 身体数据记录

- 支持体重/体脂率/围度（腰/臀/大腿/手臂）。
- 保存时检查是否触发里程碑（减重达到 5/10/15... 斤）。

##### 习惯记录

- 饮水：累加当日总量，与目标对比；
- 睡眠/排便：单条记录。

##### 轻断食（`fastingService`）

- 模式：16:8 / 18:6 等，配置进食窗口；
- 状态计算：当前是否在进食窗口内、累计断食时长；
- 记录：开始/结束时间、实际断食时长。

##### 沉淀同步到业务表（`precipitationAgent.syncToBusinessTable`）

- `diet_record` → `diet_records`（按 `precipitation_id` upsert，非旧版食物级去重）；
- `exercise_record` → `exercise_records`；
- `body_data` → `body_records`；
- `habit` → `habit_records`（仅 water 类型）。

#### 2.1.8 博物馆模块逻辑

##### 总览（`getOverview`）

按类型聚合统计：日记/食谱/方法/感悟/金句/照片的数量，待确认数，收藏数，按时间倒序的最近物品。

##### 物品入库与去重

- AI 沉淀的资产（食谱/方法/感悟/金句）写入 `museum_items`，`status=0`（待确认）。
- 喂食掉落的食谱（`saveRecipeToMuseum`）：按 `title` 去重，已存在不重复入库，仅首次喂食掉落。

##### 确认资产（`confirmItem`）

1. 查 `status=0` 的待确认资产。
2. 支持用户修改（`modified_data` 合并到 `extracted_data`）。
3. 事务内：
   - 更新 `status=1`（已确认）；
   - 写入 `timelines` 时间轴（类型/标题/关联 ID）；
   - 同步 `chat_messages.precipitation_status=1`；
   - 同步关联的 `precipitation_records.status=1`；
   - 触发奖励（`rewardService.rewardForPrecipitationRecord`）。

##### 舍弃资产（`discardItem`）

直接删除 `status=0` 的待确认资产（物理删除）。

##### 心情记录

- `saveMood`：记录当日心情（emoji + 文字）；
- `getMoodStats`：按周/月统计心情分布。

#### 2.1.9 宠物陪伴模块逻辑

##### 宠物状态机（`petService`）

**四状态优先级**：`away`（外出中）> `meal_time`（饭点）> `exercise_time`（运动时段）> `explore_time`（逛逛窗口）> `home`（居家）。

**每日计数重置**（`checkAndResetDailyCounters`）：
- 按"东八区日期"判断 `last_feed_at`/`last_exercise_at`/`last_interact_at` 是否跨天；
- 跨天则对应计数清零（`daily_feed_count`/`daily_exercise_count`/`daily_interact_count`）。

**时段判断**（`computeTimeState`）：
- 外出中（`location='away'`）优先级最高，不提示喂食/运动；
- 当前餐次（早/午/晚）已喂过（`isActionInWindow` 判断 `last_feed_at` 是否在当前时段内）或达上限→不出叹号；
- 当前运动窗口已运动过或达上限→不出叹号；
- 逛逛窗口按概率命中（`stableRandom` 以 userId 为种子，稳定随机）。

**居家活动**（`getHomeActivity`）：
- 从 `pet_states_lib` 按时段筛选可用状态；
- 状态有 `duration_minutes`（默认 30 分钟），持续时长内不变化；
- 过期后随机挑选新状态并写入 `state_expires_at`。

##### 喂食（`feed`）

1. **前置校验**：搭子外出中/睡眠时间不可喂食；每次最多 `max_items_per_feed` 种食物；每日 `max_feeds_per_day`（默认 6）次。
2. **食物校验**：批量校验所有食物合法（属于 `food` 类别、数量>0），全部合法才生效。
3. **事务执行**：
   - `daily_feed_count + 1`，更新 `last_feed_at`；
   - 原子扣减背包食物（`quantity - 1`，为 0 时删除）；
   - 关联食谱首次喂食时保存到博物馆（去重）；
   - 发放喂食奖励（默认 5 浆果，可配置）；
   - 推进"喂食"任务。

##### 运动（`exercise`）

1. **前置校验**：外出中/睡眠时间不可运动；每日 `max_per_day`（默认 2）次。
2. **运动选项**（`getExerciseOptions`）：从 `pet_exercise_lib` 查询，器械运动需用户已持有对应商城器材（永久物品），未持有则 `locked=true`。
3. **执行**：`daily_exercise_count + 1`，更新 `last_exercise_at`，推进"宠物运动"任务。

##### 外出探索（`startExplore` / `completeExplore`）

**开始外出**（`startExplore`）：
1. 校验未在外出中、当日外出次数未达上限（默认 3）。
2. `beginExploration`：预选一个外出事件（`eventDropService.pickEvent`），外出时长取该事件配置的 `explore_minutes`（未配置则全局默认 30 分钟）。
3. 写入 `pet_explorations`（`status='ongoing'`），更新 `pet_states.location='away'`。

**完成外出**（`completeExplore`）：
1. 校验外出已到结束时间。
2. **事件掉落**（`eventDropService.dropEvent`）：优先外出开始时预选的事件，无预选则按权重随机；受每日上限约束。
3. **奖励发放**：事件 `reward_json` 中的浆果/鲜花/食谱。
4. **食谱掉落**：自动保存到博物馆（按 title 去重），计算总重量/总热量。
5. 更新 `pet_states.location='home'`，推进"外出"任务。

##### 事件掉落（`eventDropService`）

- `pickEvent`：按权重预选事件（不立即解锁），用于确定外出时长；
- `dropEvent`：实际掉落事件，检查是否已解锁（`user_events` 去重）、每日上限、稀有度权重；
- 掉落结果含事件信息 + 照片（`pet_event_photos`）+ 是否新解锁。

#### 2.1.10 货币经济模块逻辑

##### 货币增加（`currencyService.addCurrency`）

1. **每日上限控制**（仅 `berries` + `reward` 类型）：
   - 从 `app_configs.currency_rules` 读取 `berries.daily_max`（默认 500）；
   - 原子更新时检查当日总获奖数，超限则不再发放（`added: 0, limited: true`），但动作本身仍计入任务进度。
2. **分来源每日次数限制**：`currency_rules.berries.daily_limits[source]`（如 `pet_feed` 每日上限），0/缺省为不限；达上限后该来源不再发奖。
3. **原子更新**：`UPDATE user_currency SET berries = berries + ?`，事务内执行。
4. **流水记录**：写入 `currency_transactions`（user_id / currency_type / amount / type / source / related_id）。

##### 货币扣除（`currencyService.deductCurrency`）

1. **余额校验**：`current < amount` 返回"余额不足"。
2. **原子更新**：`UPDATE ... SET berries = berries + ? WHERE user_id = ? AND berries >= ?`，通过 WHERE 条件防并发竞态。
3. `result.changes === 0` 表示并发冲突或余额不足，返回错误。
4. **流水记录**：type=`consume`。

##### 货币调整（`adjustCurrencyCore`，CMS 后台用）

- 支持正负数调整，调整后余额不能为负；
- type=`adjust`，记录 reason。

##### 交易流水查询（`getTransactions`）

- 分页查询 `currency_transactions`，按 `created_at DESC` 排序。

#### 2.1.11 任务系统模块逻辑

##### 进度更新（`taskService.updateTaskProgress`）

1. 查询所有 `status=1`（启用）的任务，按 `condition_json.action` 匹配传入的 `action`（如 `chat`/`feed`/`pet_exercise`/`explore_complete`）。
2. **周期键计算**（`getCycleKey`）：根据任务 `type`（daily/weekly/monthly/once）生成周期键，如 `daily:2026-08-15`。
3. **进度初始化**：`user_tasks` 中无记录则插入（`progress_json='{}'`, `status=0`, `cycle_key`）。
4. **已完成跳过**：`status >= 2` 的不再更新。
5. **进度累加**：`progressData.count += count`，与 `condition.count`（目标值）比较。
6. **未完成**：`status=0`，更新 `progress_json`。
7. **完成**：
   - 自动发放奖励（`currencyService.addCurrency`）；
   - `status=2`（已自动领取）或 `status=1`（待领取，当奖励发放失败时）；
   - 写入奖励凭证（`rewardReceiptService.send`）。

##### 领取奖励（`claimTaskReward`）

1. 校验任务存在、进度记录存在、`status===1`（待领取）。
2. `status===2` 返回"奖励已领取"。
3. 发放奖励，`status` 更新为 2，记录 `claimed_at`。
4. 写入奖励凭证。

##### 签到（`getCheckinStatus` / `checkin`）

- 查当日 `checkins` 是否已签到；
- 计算连续签到天数（昨日有签到则 +1，否则重置为 1）；
- 签到奖励按连续天数梯度发放（`checkin_rewards` 配置）。

#### 2.1.12 弹窗广告模块逻辑

##### 配置下发（`popupController.getConfigList`）

1. **标识识别**（`getIdentifier`）：登录用户用 `u{userId}`，未登录用 `deviceId`。
2. **全局配置**：从 `app_configs.popup_global` 读取全局开关、每日展示上限。
3. **弹窗筛选**：
   - `status='enabled'`；
   - 时间窗口：`start_time <= now <= end_time`（北京时间解析）；
   - 平台过滤：`os_type`（ios/android/h5/mp-weixin）包含当前平台；
   - 版本过滤：`version_min <= app_version <= version_max`（语义化版本比较）；
   - 定向用户：`target_users`（JSON 数组，空为全部，非空则须包含当前 userId）；
   - 白名单过滤：`target_whitelist` 模式仅白名单用户可见。
4. **频次控制**（`filterByFrequency`）：
   - `one_time=true`：`popup_user_stats.show_count > 0` 则过滤（仅展示一次）；
   - `frequency_max > 0`：按 `frequency_period`（day/week/forever）统计周期内展示次数，超限则过滤。
5. **排序**：按 `priority` DESC、`sort_order` ASC。
6. **每日上限**：当日展示总数超过 `popup_global.daily_max_per_user` 则不再下发。

##### 事件上报（`popupController.report`）

1. 接收 `popup_id`、`event_type`（show/click/close）、`user_id`/`device_id`。
2. 写入 `popup_events`（明细流水）。
3. **更新用户级统计**（`upsertStat`）：
   - `show`：`show_count + 1`，记录 `first_show_at`/`last_show_at`；
   - `click`：`click_count + 1`，记录 `last_click_at`；
   - `close`：`close_count + 1`，记录 `last_close_at`。

#### 2.1.13 公告模块逻辑

##### 公告列表（`announcementController.getList`）

1. **筛选条件**：
   - `status='enabled'`；
   - 时间窗口：`start_time <= now <= end_time`；
   - 消息中心（`position=message_center`）是聚合视图，所有生效公告都进入，不按 position 过滤；
   - 其他 position 按精确匹配过滤；
   - 平台/版本/定向用户过滤逻辑同弹窗。
2. **用户状态关联**（`ensureUserAnnouncement`）：`INSERT OR IGNORE` 确保每条公告对每个用户有 `user_announcements` 记录（默认 `unread`）。
3. **跳转路由解析**：`jump_type='internal'` 时从 `app_routes` 查 `jump_route_id` 对应的 `route_key` 和 `path`。
4. **展示统计**：`show_count` 从 `user_announcements` 读取。

##### 已读标记（`markRead`）

- 更新 `user_announcements.status='read'`。
- 未读数（`getUnreadCount`）：`COUNT(*) WHERE status='unread'`。

##### 曝光上报（`recordShow`）

- `user_announcements.show_count + 1`，首次展示记录 `first_show_at`。

#### 2.1.14 试用权限模块逻辑

##### 权限校验（`trialService.checkPermission`）

**五层校验链**（任一层放行则直接返回）：

1. **功能类型校验**：未知功能类型（不在 `VALID_FEATURES` 中）默认放行。
2. **白名单校验**（最高优先级，永久豁免）：
   - 用户白名单：`trial_whitelist` 中 `type='user'` 且匹配 userId；
   - 用户名白名单：匹配 username；
   - 版本白名单：`appVersion` 匹配；
   - IP 白名单：`ip` 匹配。
   - 命中则 `allow_use=true`，记录 `action='whitelist'` 日志。
3. **全局总开关**：`global_enabled !== '1'` 则放行。
4. **灰度放量**：`hashToPercent(identifier)`（以 userId/deviceId/ip 为种子哈希到 0-100）> `grayscale_percent` 则放行（未命中灰度）。
5. **分项功能开关 + 次数阈值**：
   - `{featureType}_enabled !== '1'` 则放行；
   - `{featureType}_threshold` 未配置或 ≤0 则放行；
   - `trial_user_count.used_count >= threshold` 则拦截：`allow_use=false, show_popup=true`，返回 `popup_config` 引导用户；
   - 否则放行，返回 `remain_times`。

##### 次数上报（`reportCount`）

- 按 `user_id` 或 `device_id` 原子自增 `trial_user_count.used_count`；
- 记录 `action='report'` 日志。

##### 设备合并（`mergeDeviceCountToUser`）

- 用户登录/注册时，将设备级 `trial_user_count` 的 `used_count` 合并到用户账号，避免登录前后次数不一致。

#### 2.1.15 模板消息模块逻辑

##### 定时触发（`checkAndSendTemplates`）

由定时任务调用，遍历所有活跃用户（`status=1` 且有搭子），逐个调用 `checkAndSendTemplatesForUser`。

##### 单用户发送逻辑（`checkAndSendTemplatesForUser`）

**八层检查链**（任一不通过则跳过）：

1. **时段判断**（`getCurrentTimeSlot`）：当前时间是否落在某个模板时段（breakfast/lunch/dinner/exercise/water/weight）。
2. **通知总开关**：`settings.notification_enabled` 关闭则跳过。
3. **细分开关**：对应时段的细分提醒开关（`reminder_water`/`reminder_exercise`/`reminder_weight`）关闭则跳过。
4. **勿扰时段**（`isInQuietHours`）：用户设置的勿扰时段内不发送。
5. **Helper 待定**：`chatState.isHelperPending(userId)` 为 true 时跳过，避免打断 AI 回复。
6. **连续未回复**：`getConsecutiveUnread >= 5` 则跳过（用户明显不活跃，不再打扰）。
7. **当天已发**：`hasSentToday(userId, currentSlot)` 该类型当天已发则跳过。
8. **时段内已聊天**：`hasChatInTimeSlot` 用户在该时段已聊天则重置未回复计数并跳过。

**发送前内容检查**：

- 当天发送总数 ≥ 3 则跳过（每日上限）；
- 餐别消息：用户今天已有对应饮食记录（`hasDietRecordToday`）则跳过；
- 运动消息：已有运动记录或聊天中提到运动（`hasMentionedExercise`）则跳过；
- 体重消息：已有体重记录则跳过；
- 饮水消息：已达标或已有记录则跳过。

**智能降级**（晚餐时段）：
- 若早午餐都已发模板且用户均未回复，跳过晚餐消息（避免连续打扰）。

**发送执行**（事务）：
1. 从模板库随机选一条（按搭子模式 `gentle`/`strict`/`tease`）；
2. 饮水消息注入今日数据（`{drank}`/`{goal}`/`{remaining}`）；
3. 写入 `chat_messages`（role=`partner`）；
4. 写入 `template_messages` 发送记录；
5. `updateConsecutiveUnread(userId, true)` 递增连续未回复。

##### 唤醒消息（`sendWakeupMessage`）

用户打开聊天页时触发：
- 检查最后一条消息是否为 partner 发送且超过一定时间未读；
- 若 Helper 待定中则跳过；
- 发送一条唤醒话术（按搭子模式）。

##### 召回消息（`sendRecallMessage`）

定时任务（`checkAndSendRecalls`）：
- 计算用户最后活跃距今天数；
- 按天数选择召回文案（1天/3天/7天）；
- 发送召回消息到聊天记录。

##### 用户消息回调（`onUserMessage`）

用户发送消息时调用：
- 重置 `consecutive_unread` 为 0；
- 记录最后消息时间。

### 2.2 前端：页面 / 组件 / Store / 工具

#### 2.2.1 页面功能说明

##### 启动与引导

| 页面 | 路径 | 功能 |
|------|------|------|
| 启动屏 | `pages/splash/index` | App 启动动画、初始化检查（登录态、协议同意） |
| 引导页 | `pages/onboarding/index` | 首次启动功能引导 |
| 引导任务 | `pages/onboarding/tasks` | 新手任务引导列表 |
| 功能引导 | `pages/guide/feature` | 单个功能特性介绍 |

##### 认证与资料

| 页面 | 路径 | 功能 |
|------|------|------|
| 登录 | `pages/login/index` | 手机号+密码 / 微信登录 |
| 注册 | `pages/register/index` | 手机号注册 |
| 资料设置 | `pages/profile/setup` | 首次登录完善资料（性别/年龄/身高/体重/目标） |
| 搭子模式选择 | `pages/partner/select-mode` | 选择搭子风格（温柔/严格/毒舌） |
| 搭子设置 | `pages/partner/settings` | 搭子详细配置（语速/严格度/幽默度） |

##### TabBar 主页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 今日/聊聊 | `pages/index/index` | 与搭子聊天主页、快捷入口、公告栏 |
| 宠物小窝 | `pages/pet/index` | 宠物形象展示、互动入口、状态显示 |
| 记录中心 | `pages/record/index` | 今日饮食/运动/身体/习惯汇总 |
| 博物馆 | `pages/museum/index` | 个人资产总览（日记/食谱/方法/感悟/照片） |

##### 记录中心子页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 饮食详情 | `pages/record/diet-detail` | 单日饮食详情列表 |
| 添加食物 | `pages/record/add-food` | 搜索/选择食物加入记录 |
| 创建食物 | `pages/record/create-food` | 用户自定义食物（提交审核） |
| 食物详情 | `pages/record/food-detail` | 食物营养信息详情 |
| 运动详情 | `pages/record/exercise-detail` | 单日运动详情 |
| 添加运动 | `pages/record/add-exercise` | 搜索/选择运动加入记录 |
| 身体数据 | `pages/record/body-data` | 体重/体脂/围度记录 |
| 习惯 | `pages/record/habit` | 饮水/睡眠/排便等习惯 |
| 心情 | `pages/record/mood` | 心情记录与统计 |

##### 博物馆子页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 日记 | `pages/museum/diary` | AI 日记列表 |
| 日记生成 | `pages/museum/diary-generate` | 触发 AI 生成日记 |
| 日记详情 | `pages/museum/diary-detail` | 单篇日记查看 |
| 里程碑 | `pages/museum/milestones` | 减重里程碑展示 |
| 食谱 | `pages/museum/recipes` | AI 沉淀的食谱列表 |
| 食谱详情 | `pages/museum/recipe-detail` | 单个食谱详情（含食材结构化） |
| 感悟 | `pages/museum/insights` | AI 沉淀的感悟/金句 |
| 方法 | `pages/museum/methods` | 用户保存的减肥方法 |
| 物品编辑 | `pages/museum/item-edit` | 编辑博物馆物品 |
| 对比 | `pages/museum/compare` | 照片对比墙 |
| 照片上传 | `pages/museum/photo-upload` | 上传对比照片 |

##### 宠物与陪伴

| 页面 | 路径 | 功能 |
|------|------|------|
| 宠物主页 | `pages/pet/index` | 宠物展示、喂食/运动/外出入口 |
| 货币详情 | `pages/pet/currency-detail` | 货币余额与交易流水 |
| 背包面板 | `pages/pet/panels/BagPanel` | 背包物品弹层 |
| 事件面板 | `pages/pet/panels/EventsPanel` | 事件列表弹层 |
| 商店面板 | `pages/pet/panels/ShopPanel` | 商城弹层 |
| 任务面板 | `pages/pet/panels/TaskPanel` | 任务列表弹层 |

##### 其他业务页

| 页面 | 路径 | 功能 |
|------|------|------|
| 陪你动会话 | `pages/workout/session` | 视频跟练、计时、消耗统计 |
| 聊天设置 | `pages/chat/settings` | 聊天偏好设置 |
| 任务中心 | `pages/tasks/index` | 全部任务列表 |
| 商店 | `pages/shop/index` | 商城全屏页 |
| 背包 | `pages/inventory/index` | 背包全屏页 |

##### 我的中心

| 页面 | 路径 | 功能 |
|------|------|------|
| 我的主页 | `pages/user/index` | 个人信息卡片、功能入口 |
| 个人资料 | `pages/user/profile` | 编辑昵称/头像/性别等 |
| 数据管理 | `pages/user/data-manage` | 数据导出/清空/注销 |
| 成就 | `pages/user/achievement` | 成就徽章墙 |
| 通知 | `pages/user/notifications` | 通知设置 |
| 消息中心 | `pages/user/messages` | 站内消息列表 |
| 关于我们 | `pages/user/about` | 应用介绍 |
| 隐私政策 | `pages/user/privacy` | 隐私政策详情 |
| 用户协议 | `pages/user/agreement` | 用户协议详情 |
| 帮助 | `pages/user/help` | 帮助列表 |
| 帮助详情 | `pages/user/help-detail` | 单条帮助详情 |
| 意见反馈 | `pages/user/feedback` | 提交反馈 |
| 账号设置 | `pages/user/account-settings` | 账号安全设置 |
| 注销协议 | `pages/user/delete-account-agreement` | 注销账号协议确认 |

##### 其他

| 页面 | 路径 | 功能 |
|------|------|------|
| Admin 反馈 | `pages/admin/feedback` | 内嵌反馈管理 |
| Admin 隐私 | `pages/admin/privacy` | 内嵌隐私管理 |
| 空白页 | `pages/blank/index` | 占位页 |
| WebView | `pages/webview/index` | H5 容器（弹窗/公告跳转） |

#### 2.2.2 组件清单

| 组件 | 文件 | 用途 |
|------|------|------|
| 公告栏 | [AnnouncementBar.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AnnouncementBar.vue) | 首页顶部公告横幅 |
| 按钮 | [AppButton.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppButton.vue) | 通用按钮（主/次/文字样式） |
| 卡片 | [AppCard.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppCard.vue) | 通用卡片容器 |
| 空状态 | [AppEmpty.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppEmpty.vue) | 空数据占位 |
| 头部 | [AppHeader.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppHeader.vue) | 通用页头（标题+返回） |
| 输入框 | [AppInput.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppInput.vue) | 通用输入框 |
| 列表项 | [AppListItem.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppListItem.vue) | 列表行 |
| 加载更多 | [AppLoadMore.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppLoadMore.vue) | 滚动加载更多 |
| 页面容器 | [AppPage.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppPage.vue) | 页面骨架（背景/loading） |
| 弹窗 | [AppPopup.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppPopup.vue) | 通用弹窗 |
| 标签页 | [AppTabs.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AppTabs.vue) | 标签切换 |
| 认证弹窗 | [AuthPopup.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/AuthPopup.vue) | 未登录引导登录弹窗 |
| 全局加载 | [GlobalLoading.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/GlobalLoading.vue) | 全局 loading 遮罩 |
| 待处理资产卡 | [PendingAssetCard.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/PendingAssetCard.vue) | 聊天中待确认的沉淀资产卡片 |
| 宠物精灵 | [PetSprite.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/PetSprite.vue) | 宠物序列帧动画渲染 |
| 隐私弹窗 | [PrivacyModal.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/PrivacyModal.vue) | 首次启动隐私协议弹窗 |
| 食谱解锁弹窗 | [RecipeUnlockPopup.vue](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/components/RecipeUnlockPopup.vue) | 新食谱解锁提示 |

#### 2.2.3 Store 状态

##### [user store](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/store/index.js)

| 字段 | 类型 | 说明 |
|------|------|------|
| token | String | JWT token |
| userInfo | Object | 用户信息（id/nickname/avatar/gender...） |
| isLoggedIn | Boolean | 登录态 |
| isAdmin | Boolean | 是否管理员 |

方法：`init` / `login` / `logout` / `fetchUserInfo` / `setPartnerMode`

##### [notice store](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/store/notice.js)

| 字段 | 类型 | 说明 |
|------|------|------|
| unreadCount | Number | 未读消息总数 |
| announcements | Array | 公告列表 |
| messages | Array | 站内消息列表 |
| channels | Array | 通知渠道配置 |

方法：`fetchUnreadCount` / `fetchAnnouncements` / `fetchMessages` / `markRead` / `recordShow` / `fetchChannels` / `clear`

#### 2.2.4 前端 API 层

完整 API 见 [frontend/src/api/index.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/api/index.js)，共 18 个模块：

| 模块 | 对象 | 主要方法 |
|------|------|---------|
| 认证 | `authApi` | `wechatLogin` / `login` / `register` / `wechatBindPhone` |
| 用户 | `userApi` | `getMe` / `updateMe` / `updateProfile` / `exportData` / `clearData` / `deleteAccount` |
| 搭子 | `partnerApi` | `getPartner` / `updatePartner` / `switchMode` / `getStatus` |
| 聊天 | `chatApi` | `send` / `getMessages` / `getPendingAssets` / `confirmPrecipitation` / `getChatStats` / `sendWakeupMessage` / `getAdvice` |
| 记录 | `recordApi` | `getToday` / `getDiet` / `saveDiet` / `deleteDiet` / `getExercise` / `saveExercise` / `getBody` / `saveBody` / `getHabits` / `saveHabit` / `getFasting` / `getFastingStats` / `saveFasting` / `getRecordDates` / `getMilestoneData` |
| 博物馆 | `museumApi` | `getOverview` / `getTimeline` / `getItems` / `getItem` / `addItem` / `updateItem` / `deleteItem` / `confirmItem` / `discardItem` / `toggleFavorite` / `shareItem` / `saveMood` / `getMoods` / `getMoodStats` |
| 沉淀记录 | `precipitationApi` | `getList` / `create` / `update` / `delete` |
| 语音 | `voiceApi` | `transcribe` |
| AI | `aiApi` | `generateDiary` / `getDiaryHistory` / `getDiaryDetail` / `deleteDiary` / `toggleDiaryFavorite` / `generateMonthlyDiary` / `checkMilestones` / `getMilestones` / `analyzePlateau` |
| 数据管理 | `dataApi` | `export` / `clearAll` |
| 应用配置 | `configApi` | `getAppConfig` / `updateAppConfig` |
| 系统 | `systemApi` | `getFoods` / `getFoodDetail` / `toggleFavoriteFood` / `addCustomFood` / `getExercises` / `getExerciseDetail` / `toggleFavoriteExercise` / `addCustomExercise` / `getSettings` / `updateSettings` |
| 反馈 | `feedbackApi` | `getList` / `submit` / `getAdminList` / `reply` / `updateStatus` |
| 弹窗 | `popupApi` | `getConfigList` / `report` |
| 公告 | `noticeApi` | `getUnreadCount` / `getAnnouncements` / `getAnnouncement` / `markRead` / `recordShow` / `getChannels` |
| 陪你动 | `workoutApi` | `getList` / `getDetail` / `start` / `complete` |
| 方法库 | `methodApi` | `getList` / `add` / `update` / `delete` |
| 照片 | `photoApi` | `getList` / `upload` / `delete` |
| 新手任务 | `newbieTaskApi` | `list` / `claim` |
| 宠物陪伴 | `petApi` | `getPet` / `feed` / `exercise` / `startExplore` / `completeExplore` / `getDialogues` / `getEvents` / `getEventAlbum` / `markEventRead` / `getCurrency` / `getCurrencyTransactions` / `getShopItems` / `buyShopItem` / `getInventory` / `useInventoryItem` / `getTasks` / `claimTaskReward` / `getCheckinStatus` / `checkin` / `getAchievements` |

#### 2.2.5 工具函数

| 工具 | 文件 | 用途 |
|------|------|------|
| 请求封装 | [utils/request.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/request.js) | 统一 HTTP 请求（token 注入、错误处理、重试） |
| 常量 | [utils/constants.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/constants.js) | 全局常量定义 |
| 日期 | [utils/date.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/date.js) | 日期格式化 |
| 环境 | [utils/environment.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/environment.js) | 环境判断（H5/小程序/App） |
| 加载 | [utils/loading.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/loading.js) | loading 状态管理 |
| 导航 | [utils/navigate.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/navigate.js) | 页面跳转封装 |
| 弹窗管理 | [utils/popupManager.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/popupManager.js) | 弹窗队列与频次控制 |
| 奖励提示 | [utils/rewardToast.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/rewardToast.js) | 奖励获得 toast |
| 试用 | [utils/trial.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/trial.js) | 试用权限前端兜底 |
| 认证重定向 | [utils/authRedirect.js](file:///Users/yanqian/Desktop/练习项目/fit/frontend/src/utils/authRedirect.js) | 未登录重定向 |

### 2.3 Admin 后台：页面与功能

完整菜单见 [admin/src/router/menu.js](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/router/menu.js)。

| 页面目录 | 功能说明 |
|---------|---------|
| [dashboard](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/dashboard/index.vue) | 仪表盘：核心数据概览（用户数、活跃度、记录量等） |
| [operation-stats](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/operation-stats/index.vue) | 运营数据看板：公告/弹窗/模板消息效果统计 |
| [announcement-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/announcement-config/index.vue) | 公告管理：CRUD、批量操作、定向推送、跳转配置 |
| [notification-channel-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/notification-channel-config/index.vue) | 通知渠道：站内信/Push/短信/微信订阅消息开关 |
| [popup-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/popup-config/index.vue) | 弹窗广告管理：CRUD、复制、批量操作、白名单、路由字典、统计 |
| [agreement-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/agreement-config/index.vue) | 协议配置：用户协议、隐私政策、关于我们文案 |
| [template-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/template-config/index.vue) | 模板消息：搭子话术配置（早/午/晚/运动/唤醒） |
| [food-lib](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/food-lib/index.vue) | 公共食品库：CRUD、批量导入 |
| [custom-food-audit](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/custom-food-audit/index.vue) | 自定义食物审核：用户提交的食物审核通过/拒绝 |
| [exercise-lib](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/exercise-lib/index.vue) | 运动库：CRUD（MET 值、每小时消耗） |
| [milestone-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/milestone-config/index.vue) | 里程碑文案：按类型和数值配置文案模板 |
| [museum-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/museum-config/index.vue) | 博物馆入口：配置 App 端博物馆展示入口 |
| [ai-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/ai-config/index.vue) | AI 配置：主备模型、温度、max_tokens、超时 |
| [prompts](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/prompts/index.vue) | Prompt 管理：版本管理、发布、启停、绑定 AI 配置 |
| [pet-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/pet-config/index.vue) | 宠物配置：全局、时段、序列帧、场景、皮肤、状态库、运动库、对话 |
| [currency-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/currency-config/index.vue) | 货币配置：获取/消耗规则、分析消耗、交易流水、手动调整 |
| [shop-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/shop-config/index.vue) | 商店配置：商品 CRUD |
| [event-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/event-config/index.vue) | 事件配置：事件库 CRUD、事件集合 CRUD |
| [task-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/task-config/index.vue) | 任务配置：任务 CRUD |
| [achievement-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/achievement-config/index.vue) | 成就配置：成就 CRUD |
| [dialogue-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/dialogue-config/index.vue) | 对话配置：宠物对话文案 CRUD |
| [workout-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/workout-config/index.vue) | 陪你动配置：课程 CRUD、上下架 |
| [app-users](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/app-users/index.vue) | C 端用户：列表、详情、状态变更、删除 |
| [app-users/detail](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/app-users/detail.vue) | 用户详情：记录概览 |
| [trial-config](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/trial-config/index.vue) | 试用权限：配置、白名单、审计模式、日志 |
| [feedbacks](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/feedbacks/index.vue) | 反馈管理：列表、回复、状态更新 |
| [cms-users](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/cms-users/index.vue) | 管理员账号管理 |
| [cms-users/list](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/cms-users/list.vue) | 管理员列表 |
| [cms-users/roles](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/cms-users/roles.vue) | 角色与权限管理 |
| [logs](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/logs/index.vue) | 操作日志查询 |
| [login](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/login/index.vue) | CMS 登录页 |
| [layout](file:///Users/yanqian/Desktop/练习项目/fit/admin/src/views/layout/index.vue) | 后台整体布局（侧边栏+顶栏+内容区） |

---

## 三、全量数据字段说明

数据库共 60+ 张表，按业务域分组说明。所有表定义见 [backend/src/db.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/db.js)。

### 3.1 用户与配置域

#### users — 用户主表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | INTEGER | PK AUTOINCREMENT | - | 主键 |
| user_id | VARCHAR(16) | UNIQUE | NULL | 业务用户 ID（对外暴露） |
| openid | VARCHAR(64) | UNIQUE | NULL | 微信 openid |
| unionid | VARCHAR(64) | - | NULL | 微信 unionid |
| username | VARCHAR(16) | UNIQUE | NULL | 用户名（账密登录） |
| password_hash | VARCHAR(255) | - | NULL | bcrypt 密码哈希 |
| plain_password | VARCHAR(16) | - | NULL | 明文密码（兼容旧逻辑，建议清理） |
| nickname | VARCHAR(64) | - | '减肥搭子用户' | 昵称 |
| avatar_url | VARCHAR(255) | - | NULL | 头像 URL |
| phone | VARCHAR(20) | UNIQUE INDEX | NULL | 手机号（唯一） |
| gender | TINYINT | - | 0 | 性别（0未知/1男/2女） |
| age | TINYINT | - | NULL | 年龄 |
| birth_date | DATE | - | NULL | 出生日期（由 age 回填） |
| height | DECIMAL(5,2) | - | NULL | 身高 cm |
| role | VARCHAR(16) | - | 'user' | 角色（user/admin） |
| status | TINYINT | - | 1 | 状态（1正常/0禁用） |
| source | VARCHAR(16) | - | 'app' | 注册来源 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 注册时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |
| last_login_at | DATETIME | - | NULL | 最后登录时间 |

#### user_profiles — 用户健康档案

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER UNIQUE FK→users | - | 用户 ID |
| initial_weight | DECIMAL(6,2) | NULL | 初始体重 kg |
| current_weight | DECIMAL(6,2) | NULL | 当前体重 kg |
| target_weight | DECIMAL(6,2) | NULL | 目标体重 kg |
| target_date | DATE | NULL | 目标达成日期 |
| bmr | DECIMAL(8,2) | NULL | 基础代谢率 |
| tdee | DECIMAL(8,2) | NULL | 每日总能量消耗（迁移补充） |
| daily_calorie_target | DECIMAL(8,2) | NULL | 每日热量目标 |
| calorie_deficit | DECIMAL(6,2) | 500 | 热量缺口 |
| dietary_taboos | VARCHAR(255) | NULL | 饮食禁忌 |
| preferences | VARCHAR(255) | NULL | 偏好 |
| quiet_hours_start | VARCHAR(8) | '22:00' | 免打扰开始 |
| quiet_hours_end | VARCHAR(8) | '08:00' | 免打扰结束 |
| water_goal | INTEGER | 2000 | 每日饮水目标 ml |
| advice_pending | INTEGER | 0 | 减重建议待生成标记 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### partners — 搭子配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER UNIQUE FK | - | 用户 ID |
| name | VARCHAR(32) | '你的搭子' | 搭子名称 |
| gender | TINYINT | 2 | 搭子性别 |
| avatar_url | VARCHAR(255) | NULL | 搭子头像 |
| mode | VARCHAR(16) | 'gentle' | 模式（gentle/strict/tease） |
| voice_speed | TINYINT | 5 | 语音语速（1-10） |
| strictness | TINYINT | 5 | 严格度（1-10） |
| humor | TINYINT | 5 | 幽默度（1-10） |
| status | VARCHAR(16) | 'awake' | 状态（awake/sleep/busy） |
| status_text | VARCHAR(32) | '刚刚起床' | 状态文案 |
| status_updated_at | DATETIME | CURRENT_TIMESTAMP | 状态更新时间 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### settings — 用户设置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER UNIQUE FK | - | 用户 ID |
| notification_enabled | TINYINT | 1 | 通知总开关 |
| reminder_weight | TINYINT | 1 | 体重记录提醒 |
| reminder_water | TINYINT | 1 | 饮水提醒 |
| reminder_exercise | TINYINT | 1 | 运动提醒 |
| dnd_start | TIME | '22:00:00' | 免打扰开始 |
| dnd_end | TIME | '08:00:00' | 免打扰结束 |
| theme | VARCHAR(16) | 'light' | 主题 |
| font_size | VARCHAR(16) | 'medium' | 字号 |
| data_storage | VARCHAR(16) | 'local' | 数据存储位置 |
| cloud_backup_enabled | TINYINT | 0 | 云备份开关 |
| guide_completed | TINYINT | 0 | 引导完成标记 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### app_configs — 应用全局配置

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER PK | - | 主键 |
| config_key | VARCHAR(64) | UNIQUE NOT NULL | 配置键（如 user_agreement / privacy_policy / about_us / pet_exercise_time 等） |
| config_value | TEXT | - | 配置值（JSON 或文本） |
| updated_at | DATETIME | - | 更新时间 |

#### deleted_users — 已注销用户日志

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| original_user_id | INTEGER | 原用户 ID |
| username | VARCHAR(16) | 用户名 |
| phone | VARCHAR(20) | 手机号 |
| openid | VARCHAR(64) | 微信 openid |
| reason | VARCHAR(255) | 注销原因 |
| deleted_at | DATETIME | 注销时间 |

#### system_meta — 系统元信息

| 字段 | 类型 | 说明 |
|------|------|------|
| key | VARCHAR(64) PK | 元信息键 |
| value | TEXT | 元信息值 |
| updated_at | DATETIME | 更新时间 |

### 3.2 聊天与沉淀域

#### chat_messages — 聊天消息

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK→users | - | 用户 ID |
| role | VARCHAR(16) | - | 角色（user/partner/assistant） |
| content | TEXT | - | 消息内容 |
| content_type | VARCHAR(16) | 'text' | 内容类型（text/image/voice） |
| media_url | VARCHAR(255) | NULL | 媒体 URL |
| precipitation_status | TINYINT | 0 | 沉淀状态（0未处理/1已沉淀/2已确认/3已丢弃） |
| precipitation_id | INTEGER | NULL | 关联沉淀记录 ID |
| precipitation_type | VARCHAR(32) | NULL | 沉淀类型 |
| mode | VARCHAR(16) | NULL | 搭子模式（消息时） |
| created_at | DATETIME | CURRENT_TIMESTAMP | 发送时间 |

索引：`idx_chat_user_created(user_id, created_at)`

#### precipitation_records — 沉淀记录

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK→users | - | 用户 ID |
| chat_id | INTEGER FK→chat_messages | NULL | 关联聊天消息 |
| type | VARCHAR(32) | - | 类型（diet/exercise/body/habit/recipe/method/insight...） |
| sub_type | VARCHAR(32) | NULL | 子类型 |
| content | TEXT | - | 原始内容 |
| extracted_data | TEXT | NULL | 抽取的结构化数据（JSON） |
| confidence | DECIMAL(3,2) | 0 | 置信度（0-1） |
| status | TINYINT | 0 | 状态（0待确认/1已确认/2已丢弃） |
| source | TINYINT | 0 | 来源（0自动/1手动） |
| tags | VARCHAR(255) | NULL | 标签 |
| remark | VARCHAR(255) | NULL | 备注 |
| sync_status | TINYINT | 0 | 同步状态 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

索引：`idx_precipitation_user(user_id, created_at)` / `idx_precipitation_type(user_id, type, status)`

#### template_configs — 模板消息配置

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| template_type | VARCHAR(32) | 类型（breakfast/lunch/dinner/exercise/wakeup） |
| mode | VARCHAR(16) | 模式（gentle/strict/tease） |
| content | TEXT | 模板内容 |
| sort_order | INTEGER | 排序 |
| is_enabled | TINYINT | 启用 |
| created_at / updated_at | DATETIME | 时间戳 |

#### template_messages — 模板消息发送记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| template_type | VARCHAR(32) | 类型 |
| content | TEXT | 内容 |
| sent_at | DATETIME | 发送时间 |
| is_read | TINYINT | 已读 |

#### user_chat_stats — 用户消息互动统计

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | INTEGER PK FK | 用户 ID |
| last_message_at | DATETIME | 最后消息时间 |
| consecutive_unread | INTEGER | 连续未读条数 |
| today_message_count | INTEGER | 今日消息数 |
| today_exercise_mentioned | TINYINT | 今日是否提到运动 |
| last_active_date | DATE | 最后活跃日期 |

### 3.3 宠物陪伴域

#### pets — 宠物主表

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER UNIQUE FK | - | 用户 ID |
| species | VARCHAR(32) | 'red_panda' | 物种（red_panda 小熊猫） |
| name | VARCHAR(64) | '搭搭' | 宠物名 |
| level | INTEGER | 1 | 等级 |
| skin_id | VARCHAR(64) | 'default' | 当前皮肤 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### pet_states — 宠物状态

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER UNIQUE FK | - | 用户 ID |
| mood | INTEGER | 80 | 心情值（0-100） |
| satiety | INTEGER | 80 | 饱腹值（0-100） |
| location | VARCHAR(16) | 'home' | 位置（home/explore） |
| state_key | VARCHAR(32) | 'idle' | 状态键 |
| daily_interact_count | INTEGER | 0 | 今日互动次数 |
| daily_feed_count | INTEGER | 0 | 今日喂食次数 |
| daily_exercise_count | INTEGER | 0 | 今日运动次数 |
| daily_event_count | INTEGER | 0 | 今日事件掉落次数 |
| last_feed_at | DATETIME | NULL | 最后喂食时间 |
| last_interact_at | DATETIME | NULL | 最后互动时间 |
| last_exercise_at | DATETIME | NULL | 最后运动时间 |
| last_explore_at | DATETIME | NULL | 最后外出时间 |
| last_event_at | DATETIME | NULL | 最后事件时间 |
| last_home_event_at | DATETIME | NULL | 最后居家事件时间 |
| last_decay_at | DATETIME | CURRENT_TIMESTAMP | 最后衰减时间 |
| current_state_key | VARCHAR(32) | NULL | 当前居家状态 |
| state_expires_at | DATETIME | NULL | 状态过期时间 |
| buff_json | TEXT | NULL | buff 配置（JSON） |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### pet_skins — 宠物皮肤库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| skin_id | VARCHAR(64) UNIQUE | 皮肤 ID |
| species | VARCHAR(32) | 物种 |
| name | VARCHAR(64) | 皮肤名 |
| icon_url / lottie_url / gif_url / static_url | VARCHAR(255) | 各格式资源 URL |
| unlock_condition | TEXT | 解锁条件（JSON） |
| sort_order | INTEGER | 排序 |
| is_enabled | TINYINT | 启用 |
| created_at | DATETIME | 创建时间 |

#### pet_states_lib — 宠物状态库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| state_key | VARCHAR(32) UNIQUE | 状态键（idle/sleep/eat...） |
| name | VARCHAR(64) | 状态名 |
| lottie_url / gif_url / static_url | VARCHAR(255) | 资源 URL |
| frames_json | TEXT | 序列帧配置（JSON） |
| frame_rate | INTEGER | 帧率（默认 2） |
| pos_x / pos_y | INTEGER | 坐标 |
| width / height | INTEGER | 尺寸 |
| scene_key | VARCHAR(32) | 场景键 |
| time_ranges | TEXT | 时段（JSON） |
| mood_range | TEXT | 心情区间（JSON） |
| duration_minutes | INTEGER | 持续分钟（默认 30） |
| sort_order | INTEGER | 排序 |
| is_enabled | TINYINT | 启用 |

#### pet_exercise_lib — 宠物运动库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| exercise_key | VARCHAR(64) UNIQUE | 运动键 |
| name | VARCHAR(64) | 运动名 |
| use_equipment | TINYINT | 是否需要器材 |
| equipment_item_id | INTEGER | 关联器材商品 ID |
| anim_url | VARCHAR(255) | 动画 URL |
| has_workout | TINYINT | 是否关联陪你动课程 |
| workout_key | VARCHAR(64) | 关联课程 key |
| sort_order | INTEGER | 排序 |
| is_enabled | TINYINT | 启用 |
| created_at / updated_at | DATETIME | 时间戳 |

#### pet_dialogues — 宠物对话库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| scene | VARCHAR(64) | 场景（greet/feed/exercise...） |
| text | TEXT | 对话文本 |
| weight | INTEGER | 权重（默认 1） |
| probability | DECIMAL(3,2) | 概率（默认 1.0） |
| is_enabled | TINYINT | 启用 |

#### pet_explorations — 外出探索记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| start_at | DATETIME | 开始时间 |
| end_at | DATETIME | 结束时间 |
| duration_seconds | INTEGER | 时长秒（默认 1800） |
| event_id | INTEGER | 掉落事件 ID |
| status | VARCHAR(16) | 状态（ongoing/completed） |
| reward_json | TEXT | 奖励（JSON） |
| created_at | DATETIME | 创建时间 |

### 3.4 货币经济与商城域

#### user_currency — 用户货币

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER UNIQUE FK | - | 用户 ID |
| berries | INTEGER | 0 | 莓果（主要货币） |
| flowers | INTEGER | 0 | 鲜花（高级货币） |
| updated_at | DATETIME | CURRENT_TIMESTAMP | 更新时间 |

#### currency_transactions — 货币交易流水

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| currency_type | VARCHAR(16) | 货币类型（berries/flowers） |
| amount | INTEGER | 数量（正负） |
| type | VARCHAR(32) | 交易类型（earn/spend/reward/adjust） |
| source | VARCHAR(64) | 来源 |
| related_id | INTEGER | 关联 ID |
| balance_after | INTEGER | 交易后余额 |
| created_at | DATETIME | 时间 |

#### shop_items — 商城商品

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| category | VARCHAR(32) | - | 分类（food/equipment/decoration...） |
| name | VARCHAR(128) | - | 商品名 |
| description | TEXT | NULL | 描述 |
| icon_url | VARCHAR(255) | NULL | 图标 |
| price_berries | INTEGER | 0 | 莓果价格 |
| price_flowers | INTEGER | 0 | 鲜花价格 |
| stock | INTEGER | -1 | 库存（-1 无限） |
| item_type | VARCHAR(32) | NULL | 物品类型 |
| effect_json | TEXT | NULL | 效果配置（JSON） |
| unlock_condition | TEXT | NULL | 解锁条件 |
| duration_seconds | INTEGER | NULL | 持续时长 |
| sort_order | INTEGER | 0 | 排序 |
| status | TINYINT | 1 | 状态（1上架/0下架） |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### user_inventory — 用户背包

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| shop_item_id | INTEGER FK | 商品 ID |
| category | VARCHAR(32) | 分类 |
| name | VARCHAR(128) | 名称 |
| icon_url | VARCHAR(255) | 图标 |
| quantity | INTEGER | 数量（默认 1） |
| effect_json | TEXT | 效果 |
| acquired_at | DATETIME | 获取时间 |
| expires_at | DATETIME | 过期时间 |

唯一索引：`(user_id, shop_item_id)`

### 3.5 事件与成就域

#### pet_events_lib — 事件库

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| event_key | VARCHAR(64) UNIQUE | - | 事件键 |
| type | VARCHAR(32) | - | 类型 |
| title | VARCHAR(128) | NULL | 标题 |
| content | TEXT | NULL | 内容 |
| image_url | VARCHAR(255) | NULL | 图片 |
| rarity | VARCHAR(16) | 'common' | 稀有度（common/rare/epic/legendary） |
| region | VARCHAR(64) | NULL | 地区 |
| drop_rate | DECIMAL(5,4) | 0.1000 | 旧掉落率（0-1，已迁移为 weight） |
| weight | INTEGER | NULL | 权重（0-10） |
| required_item_id | INTEGER | NULL | 所需物品 ID |
| location | VARCHAR(16) | 'explore' | 位置（explore/home） |
| explore_minutes | INTEGER | NULL | 外出时长分钟 |
| unlock_condition | TEXT | NULL | 解锁条件 |
| reward_json | TEXT | NULL | 奖励（JSON） |
| sort_order | INTEGER | 0 | 排序 |
| is_enabled | TINYINT | 1 | 启用 |

#### event_collections — 事件集合

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| coll_key | VARCHAR(64) UNIQUE | 集合键 |
| name | VARCHAR(64) | 集合名 |
| sort_order | INTEGER | 排序 |
| is_enabled | TINYINT | 启用 |
| created_at / updated_at | DATETIME | 时间戳 |

#### pet_event_photos — 事件照片

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| event_id | INTEGER FK | 事件 ID |
| photo_url | VARCHAR(255) | 照片 URL |
| is_enabled | TINYINT | 启用 |
| sort_order | INTEGER | 排序 |
| created_at | DATETIME | 创建时间 |

#### user_events — 用户已解锁事件

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| event_id | INTEGER FK | 事件 ID |
| photo_id | INTEGER | 照片 ID（默认 0） |
| is_new | TINYINT | 是否新 |
| unlocked_at | DATETIME | 解锁时间 |

唯一键：`(user_id, event_id, photo_id)`

#### tasks — 任务定义

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| name | VARCHAR(128) | - | 任务名 |
| type | VARCHAR(32) | - | 类型（daily/weekly/achievement...） |
| description | TEXT | NULL | 描述 |
| condition_json | TEXT | NULL | 完成条件（JSON） |
| reward_berries | INTEGER | 0 | 莓果奖励 |
| reward_flowers | INTEGER | 0 | 鲜花奖励 |
| jump_page | VARCHAR(128) | NULL | 跳转页面 |
| sort_order | INTEGER | 0 | 排序 |
| start_time / end_time | DATETIME | NULL | 有效期 |
| status | TINYINT | 1 | 状态 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### user_tasks — 用户任务进度

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| task_id | INTEGER FK | 任务 ID |
| progress_json | TEXT | 进度（JSON，默认 {}） |
| status | TINYINT | 状态（0未完成/1已完成/2已领取） |
| completed_at | DATETIME | 完成时间 |
| claimed_at | DATETIME | 领取时间 |
| cycle_key | VARCHAR(32) | 周期键（用于日/周重置） |

唯一键：`(user_id, task_id, cycle_key)`

#### checkins — 签到记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| checkin_date | DATE | 签到日期 |
| continuous_days | INTEGER | 连续天数（默认 1） |
| reward_berries | INTEGER | 莓果奖励 |
| reward_flowers | INTEGER | 鲜花奖励 |
| created_at | DATETIME | 创建时间 |

唯一键：`(user_id, checkin_date)`

#### achievements — 成就定义

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| name | VARCHAR(128) | 成就名 |
| category | VARCHAR(32) | 分类 |
| description | TEXT | 描述 |
| condition_json | TEXT | 解锁条件（JSON） |
| reward_berries | INTEGER | 莓果奖励 |
| reward_flowers | INTEGER | 鲜花奖励 |
| badge_icon | VARCHAR(255) | 徽章图标 |
| sort_order | INTEGER | 排序 |
| is_enabled | TINYINT | 启用 |
| created_at | DATETIME | 创建时间 |

#### user_achievements — 用户成就

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| achievement_id | INTEGER FK | 成就 ID |
| unlocked_at | DATETIME | 解锁时间 |

唯一键：`(user_id, achievement_id)`

#### user_newbie_tasks — 新手任务

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| task_key | VARCHAR(32) | - | 任务键 |
| title | VARCHAR(128) | - | 标题 |
| description | TEXT | '' | 描述 |
| sort_order | INTEGER | 0 | 排序 |
| status | VARCHAR(16) CHECK | 'pending' | 状态（pending/completed/claimed） |
| reward_berries | INTEGER | 20 | 莓果奖励 |
| completed_at | DATETIME | NULL | 完成时间 |
| claimed_at | DATETIME | NULL | 领取时间 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

唯一键：`(user_id, task_key)`

### 3.6 记录中心域

#### diet_records — 饮食记录

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| precipitation_id | INTEGER FK | NULL | 关联沉淀记录 |
| record_date | DATE | - | 记录日期 |
| meal_time | VARCHAR(16) | - | 餐次（breakfast/lunch/dinner/snack） |
| foods | TEXT | - | 食物列表（JSON） |
| total_calorie | DECIMAL(8,2) | 0 | 总热量 kcal |
| total_protein | DECIMAL(6,2) | 0 | 总蛋白质 g |
| total_carb | DECIMAL(6,2) | 0 | 总碳水 g |
| total_fat | DECIMAL(6,2) | 0 | 总脂肪 g |
| tags | VARCHAR(255) | NULL | 标签 |
| remark | VARCHAR(255) | NULL | 备注 |
| status | TINYINT | 1 | 状态 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

唯一索引：`(user_id, precipitation_id)`

#### exercise_records — 运动记录

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| precipitation_id | INTEGER FK | NULL | 关联沉淀记录 |
| record_date | DATE | - | 记录日期 |
| exercise_type | VARCHAR(16) | - | 运动类型 |
| exercises | TEXT | - | 运动列表（JSON） |
| total_duration | INT | 0 | 总时长分钟 |
| total_calorie | DECIMAL(8,2) | 0 | 总消耗 kcal |
| is_workout | TINYINT | 0 | 是否陪你动课程 |
| source | VARCHAR(16) | NULL | 来源 |
| workout_key | VARCHAR(32) | NULL | 课程 key |
| video_url | VARCHAR(255) | NULL | 视频 URL |
| remark | VARCHAR(255) | NULL | 备注 |
| status | TINYINT | 1 | 状态 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### workout_lib — 陪你动课程库

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| workout_key | VARCHAR(32) UNIQUE | - | 课程键 |
| name | VARCHAR(128) | - | 课程名 |
| category | VARCHAR(32) | 'aerobic' | 分类（aerobic/anaerobic/stretch...） |
| video_url | VARCHAR(255) | NULL | 视频 URL |
| cover_url | VARCHAR(255) | NULL | 封面 URL |
| duration_seconds | INTEGER | 0 | 总时长秒（旧字段） |
| duration_mode | VARCHAR(16) | 'sets' | 时长模式（unlimited/sets） |
| set_minutes | INTEGER | 0 | 每组分钟 |
| sets_count | INTEGER | 1 | 组数 |
| rest_seconds | INTEGER | 0 | 组间休息秒 |
| calorie_per_session | DECIMAL(8,2) | 0 | 每次消耗（旧字段） |
| calorie_per_hour | DECIMAL(8,2) | 0 | 每小时消耗 |
| required_equipment_key | VARCHAR(32) | NULL | 旧器材键（已迁移） |
| required_item_id | INTEGER | NULL | 关联器材商品 ID |
| exercise_id | INTEGER | NULL | 关联运动库 ID |
| description | TEXT | NULL | 描述 |
| sort_order | INTEGER | 0 | 排序 |
| status | TINYINT | 1 | 状态（1上架/0下架） |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### body_records — 身体数据记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| precipitation_id | INTEGER FK | 关联沉淀记录 |
| record_date | DATE | 记录日期 |
| type | VARCHAR(16) | 类型（weight/waist/body_fat...） |
| value | DECIMAL(6,2) | 数值 |
| unit | VARCHAR(8) | 单位 |
| weight | DECIMAL(8,2) | 体重 kg |
| waist | DECIMAL(8,2) | 腰围 cm |
| thigh | DECIMAL(8,2) | 大腿围 cm |
| hip | DECIMAL(8,2) | 臀围 cm |
| arm | DECIMAL(8,2) | 臂围 cm |
| body_fat_rate | DECIMAL(8,2) | 体脂率 % |
| muscle_mass | DECIMAL(8,2) | 肌肉量 kg |
| basal_metabolism | INTEGER | 基础代谢 |
| status | TINYINT | 状态 |
| created_at / updated_at | DATETIME | 时间戳 |

唯一索引：`(user_id, record_date, type)`

#### habit_records — 习惯记录

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| precipitation_id | INTEGER FK | NULL | 关联沉淀记录 |
| record_date | DATE | - | 记录日期 |
| type | VARCHAR(16) | - | 类型（water/sleep/defecation...） |
| value | DECIMAL(8,2) | 0 | 数值 |
| unit | VARCHAR(16) | NULL | 单位 |
| remark | VARCHAR(255) | NULL | 备注 |
| water_ml | INTEGER | 0 | 饮水量 ml |
| has_diet_record | INTEGER | 0 | 是否有饮食记录 |
| has_exercise | INTEGER | 0 | 是否有运动 |
| rejected_food | INTEGER | 0 | 是否拒绝不健康食物 |
| no_late_night | INTEGER | 0 | 是否无夜宵 |
| weight | DECIMAL(8,2) | NULL | 当日体重 |
| status | TINYINT | 1 | 状态 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

唯一索引：`(user_id, record_date, type)`

#### fasting_records — 轻断食记录

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| record_date | DATE | - | 记录日期 |
| mode | VARCHAR(32) | - | 模式（16:8 / 5:2 等） |
| target_hours | INTEGER | 16 | 目标断食小时 |
| eating_window_start | TIME | NULL | 进食窗口开始 |
| eating_window_end | TIME | NULL | 进食窗口结束 |
| status | VARCHAR(16) | 'planned' | 状态（planned/ongoing/completed/broken） |
| started_at | DATETIME | NULL | 开始时间 |
| actual_hours | INTEGER | 0 | 实际断食小时 |
| note | TEXT | NULL | 备注 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

### 3.7 博物馆与里程碑域

#### museum_items — 博物馆物品

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| chat_message_id | INTEGER FK | NULL | 关联聊天消息 |
| type | VARCHAR(32) | - | 类型（diary/recipe/method/insight/mood/photo...） |
| sub_type | VARCHAR(32) | NULL | 子类型（daily_diary/weekly_diary...） |
| content | TEXT | - | 内容 |
| extracted_data | TEXT | NULL | 结构化数据（JSON） |
| author | VARCHAR(16) | 'user' | 作者（user/partner） |
| emotion | VARCHAR(16) | NULL | 情绪 |
| scene | VARCHAR(16) | NULL | 场景 |
| effectiveness | TINYINT | NULL | 有效性评分 |
| is_favorite | TINYINT | 0 | 是否收藏 |
| tags | VARCHAR(255) | NULL | 标签 |
| record_date | DATE | NULL | 记录日期 |
| status | TINYINT | 0 | 状态（0待确认/1已确认/2已丢弃） |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

唯一索引：`(user_id, sub_type, record_date)`（仅 daily_diary/mood 且 status=1）

#### milestones — 里程碑

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| type | VARCHAR(32) | 类型（weight_loss/days_streak...） |
| title | VARCHAR(128) | 标题 |
| description | VARCHAR(255) | 描述 |
| value | DECIMAL(8,2) | 数值 |
| unit | VARCHAR(16) | 单位 |
| icon | VARCHAR(32) | 图标 |
| achieved_at | DATETIME | 达成时间 |
| created_at | DATETIME | 创建时间 |

#### timelines — 时间轴

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| event_type | VARCHAR(32) | 事件类型 |
| title | VARCHAR(128) | 标题 |
| content | TEXT | 内容 |
| related_id | INTEGER | 关联 ID |
| related_type | VARCHAR(32) | 关联类型 |
| event_date | DATE | 事件日期 |
| is_important | TINYINT | 是否重要 |
| created_at | DATETIME | 创建时间 |

#### milestone_templates — 里程碑文案模板

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| type | VARCHAR(32) | 类型 |
| value | DECIMAL(6,2) | 数值 |
| content | TEXT | 文案 |
| sort_order | INTEGER | 排序 |
| is_enabled | TINYINT | 启用 |
| created_at / updated_at | DATETIME | 时间戳 |

#### user_methods — 用户方法库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| title | VARCHAR(128) | 标题 |
| content | TEXT | 内容 |
| category | VARCHAR(32) | 分类 |
| effectiveness | TINYINT | 有效性（默认 1） |
| is_favorite | TINYINT | 收藏 |
| tags | VARCHAR(255) | 标签 |
| status | TINYINT | 状态 |
| created_at / updated_at | DATETIME | 时间戳 |

#### photos — 照片墙

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| url | VARCHAR(255) | 照片 URL |
| angle | VARCHAR(16) | 角度（front/side/back，默认 front） |
| weight | DECIMAL(6,2) | 当时体重 |
| description | VARCHAR(255) | 描述 |
| record_date | DATE | 记录日期 |
| created_at | DATETIME | 创建时间 |

#### feedback — 用户反馈

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| type | VARCHAR(32) | 'other' | 类型 |
| content | TEXT | - | 内容 |
| images | TEXT | NULL | 图片（JSON 数组） |
| contact | VARCHAR(64) | NULL | 联系方式 |
| status | VARCHAR(16) | 'pending' | 状态（pending/replied/closed） |
| score | TINYINT | NULL | 评分 |
| reply | TEXT | NULL | 回复 |
| replied_at | DATETIME | NULL | 回复时间 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |

### 3.8 食物 / 运动 / 自定义库

#### food_db — 公共食物库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| food_id | INTEGER UNIQUE | 食物 ID |
| category | VARCHAR(32) | 分类 |
| sub_category | VARCHAR(32) | 子分类 |
| food_name | VARCHAR(128) | 食物名 |
| calories_per_100g | DECIMAL(8,2) | 每 100g 热量 |
| common_unit | VARCHAR(128) | 常用单位 |
| edible_rate | DECIMAL(3,2) | 可食率（默认 1.0） |
| protein_per_100g | DECIMAL(6,2) | 蛋白质 |
| carb_per_100g | DECIMAL(6,2) | 碳水 |
| fat_per_100g | DECIMAL(6,2) | 脂肪 |
| remark | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |

#### exercise_db — 公共运动库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| exercise_name | VARCHAR(64) | 运动名 |
| category | VARCHAR(32) | 分类 |
| sub_category | VARCHAR(32) | 子分类 |
| intensity_desc | VARCHAR(64) | 强度描述 |
| met_value | DECIMAL(5,2) | MET 值 |
| calorie_per_hour | DECIMAL(8,2) | 每小时消耗 |
| remark | VARCHAR(255) | 备注 |
| created_at | DATETIME | 创建时间 |

#### favorite_foods / favorite_exercises — 收藏

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| food_id / exercise_id | INTEGER | 食物/运动 ID |
| is_common | TINYINT | 是否常用 |
| created_at | DATETIME | 创建时间 |

#### custom_foods — 自定义食物

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| name | VARCHAR(64) | - | 名称 |
| category | VARCHAR(32) | NULL | 分类 |
| calorie_per_100g | DECIMAL(8,2) | 0 | 热量 |
| protein_per_100g | DECIMAL(6,2) | 0 | 蛋白质 |
| carb_per_100g | DECIMAL(6,2) | 0 | 碳水 |
| fat_per_100g | DECIMAL(6,2) | 0 | 脂肪 |
| fiber_per_100g | DECIMAL(6,2) | 0 | 纤维 |
| gi | DECIMAL(5,2) | NULL | 血糖生成指数 |
| unit | VARCHAR(32) | 'g' | 单位 |
| is_public | TINYINT | 0 | 是否公开（提交审核） |
| status | VARCHAR(16) | 'approved' | 状态（pending/approved/rejected） |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |

#### custom_exercises — 自定义运动

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| user_id | INTEGER FK | - | 用户 ID |
| name | VARCHAR(64) | - | 名称 |
| type | VARCHAR(16) | - | 类型 |
| calorie_per_hour | DECIMAL(8,2) | 0 | 每小时消耗 |
| intensity | VARCHAR(16) | 'moderate' | 强度 |
| created_at | DATETIME | CURRENT_TIMESTAMP | 创建时间 |

### 3.9 弹窗 / 公告 / 通知域

#### popups — 弹窗广告

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER PK | - | 主键 |
| name | VARCHAR(64) | - | 名称 |
| style | VARCHAR(16) CHECK | - | 样式（center/top） |
| type | VARCHAR(16) CHECK | - | 类型（system/operational/version/activity） |
| status | VARCHAR(16) CHECK | - | 状态（draft/enabled/disabled） |
| start_time / end_time | DATETIME | - | 生效时间 |
| priority | INTEGER | 5 | 优先级 |
| image_url | TEXT | - | 图片 URL |
| title | VARCHAR(255) | '' | 标题 |
| content | TEXT | '' | 内容 |
| show_close_button | TINYINT | 1 | 显示关闭按钮 |
| mask_closeable | TINYINT | 1 | 点击遮罩关闭 |
| jump_type | VARCHAR(16) CHECK | - | 跳转类型（none/internal/h5） |
| jump_route_id | INTEGER FK→app_routes | NULL | 站内路由 ID |
| jump_url | TEXT | '' | H5 URL |
| jump_params | TEXT | '{}' | 跳转参数（JSON） |
| scope_type | VARCHAR(16) CHECK | - | 范围（global/specific） |
| scope_pages | TEXT | '[]' | 生效页面（JSON） |
| excluded_pages | TEXT | '[]' | 排除页面（JSON） |
| trigger_type | VARCHAR(16) CHECK | - | 触发类型（immediate/duration/back/cold_start/operation） |
| trigger_delay_seconds | INTEGER | 0 | 延迟秒数 |
| frequency_period | VARCHAR(16) CHECK | 'day' | 频次周期（day/week/forever） |
| frequency_max | INTEGER | 1 | 最大次数 |
| one_time | TINYINT | 0 | 一次性 |
| wifi_only | TINYINT | 0 | 仅 WiFi |
| version_min / version_max | VARCHAR(32) | '' | 版本范围 |
| os_type | TEXT | '["ios","android","h5","mp-weixin"]' | 系统 |
| target_users | TEXT | '[]' | 目标用户（JSON） |
| sort_order | INTEGER | 0 | 排序 |
| created_by | VARCHAR(64) | '' | 创建人 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### h5_whitelist — H5 白名单

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| domain | VARCHAR(255) UNIQUE | 域名 |
| status | VARCHAR(16) CHECK | 状态（enabled/disabled） |
| created_at / updated_at | DATETIME | 时间戳 |

#### app_routes — 站内路由字典

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| route_key | VARCHAR(64) UNIQUE | 路由键 |
| route_name | VARCHAR(128) | 路由名 |
| path | VARCHAR(255) | 路径 |
| params_schema | TEXT | 参数 schema（JSON） |
| status | VARCHAR(16) CHECK | 状态 |
| created_at / updated_at | DATETIME | 时间戳 |

#### popup_events — 弹窗埋点

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| popup_id | INTEGER FK | 弹窗 ID |
| user_id | INTEGER FK | 用户 ID（可空） |
| device_id | VARCHAR(64) | 设备 ID |
| page | VARCHAR(128) | 页面 |
| event_type | VARCHAR(16) CHECK | 事件（show/click/close） |
| trigger | VARCHAR(32) | 触发 |
| close_way | VARCHAR(16) | 关闭方式 |
| app_version | VARCHAR(32) | 应用版本 |
| os_type | VARCHAR(16) | 系统 |
| event_time | DATETIME | 事件时间 |
| created_at | DATETIME | 创建时间 |

#### popup_daily_stats — 弹窗每日统计

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| date | DATE | 日期 |
| popup_id | INTEGER | 弹窗 ID |
| shows / clicks / closes | INTEGER | 展示/点击/关闭数 |
| close_btn / mask / back / swipe | INTEGER | 关闭方式细分 |
| updated_at | DATETIME | 更新时间 |

唯一键：`(date, popup_id)`

#### popup_user_stats — 弹窗用户级频次

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| popup_id | INTEGER FK | 弹窗 ID |
| identifier | VARCHAR(128) | 标识（user_id 或 device_id） |
| identifier_type | VARCHAR(16) CHECK | 类型（user/device） |
| show_count / click_count / close_count | INTEGER | 计数 |
| first_show_at / last_show_at | DATETIME | 首次/末次展示 |
| last_click_at / last_close_at | DATETIME | 末次点击/关闭 |
| created_at / updated_at | DATETIME | 时间戳 |

唯一键：`(popup_id, identifier, identifier_type)`

#### announcements — 公告

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER PK | - | 主键 |
| title | VARCHAR(255) | - | 标题 |
| content | TEXT | '' | 内容 |
| type | VARCHAR(32) CHECK | - | 类型（banner/notice/fullscreen/message） |
| position | VARCHAR(64) | 'home' | 位置 |
| target_type | VARCHAR(32) CHECK | - | 目标（all/specified_users/segments） |
| target_users | TEXT | '[]' | 指定用户（JSON） |
| segments | TEXT | '[]' | 分群（JSON） |
| status | VARCHAR(16) CHECK | - | 状态（draft/enabled/disabled） |
| priority | INTEGER | 5 | 优先级 |
| image_url | TEXT | '' | 图片 |
| background_color / text_color | VARCHAR(16) | '' | 颜色 |
| jump_type | VARCHAR(16) CHECK | - | 跳转类型 |
| jump_route_id | INTEGER FK | NULL | 站内路由 |
| jump_url | TEXT | '' | H5 URL |
| jump_params | TEXT | '{}' | 参数 |
| start_time / end_time | DATETIME | - | 生效时间 |
| version_min / version_max | VARCHAR(32) | '' | 版本范围 |
| os_type | TEXT | '["ios","android","h5","mp-weixin"]' | 系统 |
| max_show_count | INTEGER | 0 | 最大展示次数（0 不限） |
| dismissible | TINYINT | 1 | 可关闭 |
| sort_order | INTEGER | 0 | 排序 |
| created_by | VARCHAR(64) | '' | 创建人 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### user_announcements — 用户公告阅读记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK | 用户 ID |
| announcement_id | INTEGER FK | 公告 ID |
| status | VARCHAR(16) CHECK | 状态（unread/read/clicked） |
| first_show_at / last_show_at | DATETIME | 首次/末次展示 |
| click_at | DATETIME | 点击时间 |
| show_count | INTEGER | 展示次数 |
| created_at / updated_at | DATETIME | 时间戳 |

唯一键：`(user_id, announcement_id)`

#### notification_channels — 通知渠道

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| channel_key | VARCHAR(32) UNIQUE | 渠道键（in_app/push/sms/wechat_sub） |
| channel_name | VARCHAR(64) | 渠道名 |
| is_enabled | TINYINT | 启用 |
| config | TEXT | 配置（JSON） |
| description | TEXT | 描述 |
| sort_order | INTEGER | 排序 |
| created_at / updated_at | DATETIME | 时间戳 |

### 3.10 CMS 管理后台域

#### cms_users — 管理员账号

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| username | VARCHAR(32) UNIQUE | 用户名 |
| password_hash | VARCHAR(255) | 密码哈希 |
| nickname | VARCHAR(64) | 昵称 |
| role_id | INTEGER FK→cms_roles | 角色 ID |
| status | TINYINT | 状态 |
| last_login_at | DATETIME | 最后登录 |
| created_at / updated_at | DATETIME | 时间戳 |

#### cms_roles — 角色与权限

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| name | VARCHAR(32) UNIQUE | 角色名 |
| description | VARCHAR(255) | 描述 |
| permissions | TEXT | 权限列表（JSON 数组，如 `["app_config:read","app_config:write"]`） |
| is_system | TINYINT | 是否系统角色 |
| created_at | DATETIME | 创建时间 |

#### cms_logs — 操作日志

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| cms_user_id | INTEGER FK | 管理员 ID |
| action | VARCHAR(64) | 操作 |
| target_type | VARCHAR(32) | 目标类型 |
| target_id | VARCHAR(64) | 目标 ID |
| detail | TEXT | 详情 |
| ip | VARCHAR(64) | IP |
| created_at | DATETIME | 时间 |

### 3.11 AI 与 Prompt 域

#### ai_configs — AI 配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | INTEGER PK | - | 主键 |
| name | VARCHAR(64) | - | 配置名 |
| provider | VARCHAR(32) | 'doubao' | 提供方 |
| base_url | VARCHAR(255) | 'https://ark.cn-beijing.volces.com/api/v3' | 基础 URL |
| api_key | VARCHAR(255) | - | API Key |
| endpoint_id | VARCHAR(64) | - | 推理接入点 ID |
| temperature | DECIMAL(3,2) | 0.7 | 温度 |
| max_tokens | INTEGER | 500 | 最大 tokens |
| timeout_ms | INTEGER | 30000 | 超时毫秒 |
| role | VARCHAR(16) CHECK | 'primary' | 角色（primary/backup） |
| sort_order | INTEGER | 0 | 排序 |
| is_enabled | TINYINT | 1 | 启用 |
| created_at / updated_at | DATETIME | CURRENT_TIMESTAMP | 时间戳 |

#### ai_prompts — Prompt 版本管理

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| prompt_key | VARCHAR(64) | Prompt 键（main_agent/helper_agent/precipitation_agent/partner_asset_agent） |
| version | INTEGER | 版本号 |
| content | TEXT | Prompt 内容 |
| ai_config_id | INTEGER FK→ai_configs | 绑定的 AI 配置 |
| is_enabled | TINYINT | 启用 |
| is_latest | TINYINT | 是否最新 |
| created_at / updated_at | DATETIME | 时间戳 |

唯一键：`(prompt_key, version)`

### 3.12 试用权限域

#### trial_user_count — 试用次数统计

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER | 用户 ID（可空） |
| device_id | VARCHAR(64) | 设备 ID（可空） |
| feature_type | VARCHAR(32) CHECK | 功能类型（ai_chat/diary） |
| used_count | INTEGER | 已用次数 |
| created_at / updated_at | DATETIME | 时间戳 |

唯一索引：`(user_id, feature_type)` / `(device_id, feature_type)`

#### trial_system_config — 试用系统配置

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| config_key | VARCHAR(64) UNIQUE | 配置键 |
| config_value | TEXT | 配置值 |
| description | VARCHAR(255) | 描述 |
| created_at / updated_at | DATETIME | 时间戳 |

#### trial_whitelist — 试用白名单

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| type | VARCHAR(16) CHECK | 类型（user/version/ip） |
| value | VARCHAR(255) | 值 |
| expire_at | DATETIME | 过期时间 |
| remark | VARCHAR(255) | 备注 |
| created_at / updated_at | DATETIME | 时间戳 |

#### trial_logs — 试用日志

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| user_id | INTEGER | 用户 ID |
| device_id | VARCHAR(64) | 设备 ID |
| feature_type | VARCHAR(32) | 功能类型 |
| action | VARCHAR(16) | 动作 |
| reason | VARCHAR(255) | 原因 |
| ip | VARCHAR(64) | IP |
| created_at | DATETIME | 时间 |

### 3.13 系统辅助表

完整表清单见 [backend/src/db.js](file:///Users/yanqian/Desktop/练习项目/fit/backend/src/db.js)。

| 表名 | 用途 |
|------|------|
| system_meta | 系统元信息（键值对，如 schema_version） |
| deleted_users | 已注销用户审计日志 |

---

## 附录：关键业务流程

### A.1 聊天 → 沉淀 → 记录 主流程

```
用户发送消息
  ↓
chatController.sendMessage
  ↓
mainAgent.callMainAgent（意图识别 + 共情回复）
  ↓
precipitationAgent（自动抽取饮食/运动/身体/习惯）
  ↓
partnerAssetAgent（抽取食谱/方法/感悟到博物馆）
  ↓
返回回复 + 待确认资产
  ↓
用户确认 → precipitation_records.status = 1
  ↓
同步到 diet_records / exercise_records / body_records / habit_records
```

### A.2 宠物状态机

```
宠物状态衰减（定时任务）
  ↓ mood/satiety 随时间下降
用户互动（喂食/运动/外出）
  ↓ 增加对应数值 + 计数
每日 0 点重置计数（daily_feed_count 等）
  ↓
外出探索 → pet_explorations
  ↓ 倒计时结束
事件掉落（eventDropService 按权重计算）
  ↓
user_events 记录 + 奖励发放
```

### A.3 试用权限校验

```
前端调用 AI 功能
  ↓
trialController.checkPermission
  ↓
1. 检查白名单（user/version/ip）→ 命中则放行
  ↓
2. 检查试用次数（trial_user_count）
  ↓ 超限则拦截
3. 上报使用次数
  ↓
返回权限结果
```

---

**文档结束**

如需补充某个模块的更细节说明，或对某张表的字段有疑问，请告知。
