# 减脂陪伴 App 宠物养成化改造计划

> 基于《减脂陪伴 App 产品需求文档（PRD）V2.1》与《减脂陪伴 App 功能架构表 V1.0》梳理
> 当前代码基线：fit `main` @ 9111243

---

## 一、改版目标与范围

### 1.1 核心目标
将现有「AI 减脂搭子」工具升级为「虚拟宠物陪伴式减脂工具」：
- **搭子人设统一为宠物**：一只努力减脂、精通营养与运动知识、热爱闲逛的小熊猫，名字固定为「搭搭」。
- **新增陪伴 Tab**：宠物养成主场景，含喂食、运动、亲密互动、外出探索、事件收集。
- **新增双货币经济**：浆果（日常行为获得）+ 鲜花（成就/高阶），用于商城购买食物、器材、道具。
- **新增游戏化激励**：签到、日常任务、周常任务、成就、里程碑、小确幸/多巴胺事件。
- **保留并迁移现有功能**：聊天记录自动沉淀、今日记录、博物馆、我的页等核心能力保持不变。
- **全面后台可配置**：所有数值、文案、开关、概率、奖励、商品价格均走 CMS / 统一配置中心。
- **预留广告位**：任务完成、获得浆果/鲜花、商店解锁、生成每日分析、跟练运动等场景预留广告观看位，当前版本默认关闭。

### 1.2 版本范围（按 PRD 优先级）

| 范围 | 内容 | 本次是否纳入 |
|---|---|---|
| **P0 MVP** | 聊天三 Agent、记录确认弹层、宠物状态/喂食/互动、事件相册、背包、签到/日常任务、双货币商城、今日总览与三类记录、生成今日分析、博物馆数据总览与食谱库、基础资料、天降彩蛋、对应后台配置 | **必须做** |
| **P1** | 陪你动跟练、轻断食、饮水记录、常驻任务、里程碑、心情日记、每日分析历史、运营活动配置 | 后续迭代 |
| **P2** | 消息精细化管控、强制升级、成长长线、外观体系、会员特权 | 后续迭代 |

**本次改造聚焦 P0**，P1/P2 做架构预留与接口设计，不实现完整功能。

---

## 二、当前系统现状

### 2.1 前端（uni-app Vue3）
- 4 个底部 Tab：搭子 / 今日 / 博物馆 / 我的（`src/custom-tab-bar/index.vue`）。
- 聊天首页 `pages/index/index.vue` 是 2400+ 行的大页面，同时承载对话与搭子状态展示。
- 单 Pinia store（`src/store/index.js`），无按领域拆分的 store。
- 已存在沉淀确认弹窗、PendingAssetCard、食物选择器、记录编辑等组件。
- 当前「搭子」只有 name / avatar / mode(gentle/strict/tease) / status_text，无宠物属性。

### 2.2 后端（Node.js + Express + better-sqlite3）
- 数据库：`users`, `user_profiles`, `partners`, `chat_messages`, `precipitation_records`, 各类 records, `museum_items`, `app_configs`, `ai_prompts`, `popups` 等。
- AI 体系：mainAgent（意图/工具调用）、helperAgent（专业知识）、precipitationAgent（记录沉淀）、partnerAssetAgent（搭子食谱提取）。
- CMS：已有 app_config / prompts / AI config / popup / museum / milestone / food/exercise lib / trial 等模块。
- **尚无**：宠物状态、货币、背包、商城、事件、任务、成就等任何相关表或服务。

### 2.3 管理后台（Vue3 + Vite + Element Plus）
- 菜单与路由分离维护（`router/index.js` 与 `router/menu.js`）。
- 权限硬编码在 6 处（router、menu、roles.vue、dashboard、seedCms、routes）。
- 无通用 CRUD 组件，每个页面独立实现 table + dialog + pagination。

---

## 三、目标架构（P0）

### 3.1 底部导航调整
```
Tab1：聊聊（原「搭子」改名，仍默认首页）
Tab2：搭搭（新增：宠物搭搭主页，陪伴养成核心）
Tab3：工具箱（原「今日」升级，含今日 / 陪你动两个子页）
Tab4：博物馆（保留）
我的：仍在聊聊页右上角头像入口
```

### 3.2 核心数据域
```
用户域：users / user_profiles / settings（保留扩展）
聊天域：chat_messages / precipitation_records / ai_prompts（保留扩展）
记录域：diet_records / exercise_records / body_records / habit_records（保留）
宠物养成域：pets, pet_states, pet_interactions, pet_events（新增）
经济域：user_currency, currency_transactions, shop_items, user_inventory（新增）
任务成就域：tasks, user_tasks, achievements, user_achievements, checkins（新增）
内容域：food_db / exercise_db / recipes / events / dialogues（新增/扩展）
配置域：app_configs（扩展）+ 各新增配置表
```

### 3.3 服务拆分（在现有单体后端内按模块拆分）
| 服务模块 | 说明 |
|---|---|
| UserService | 用户资料、初始体重/目标体重 |
| ChatService | 三 Agent 协作、消息路由 |
| RecordService | 饮食/运动/体重/饮水记录 |
| PetService | 宠物状态、心情/饱食度衰减、互动、外出 |
| CurrencyService | 浆果/鲜花余额、发放、消费、上限 |
| ShopService | 商品、购买、库存、解锁条件 |
| InventoryService | 背包、使用道具/食物/器材 |
| EventService | 多巴胺/小确幸事件掉落、收集 |
| TaskService | 签到、日常任务、周常任务、新手任务 |
| AchievementService | 成就/里程碑判定、奖励 |
| ToolService | 今日分析生成、陪你动（P1） |
| ConfigService | 统一配置读取、热更新 |

---

## 四、详细改动计划

### 4.1 数据库层（新增表）

#### 4.1.1 宠物相关
- `pets`：用户宠物主表（user_id, species, name, level, skin_id, created_at）。
- `pet_states`：实时状态（user_id, mood, satiety, location[home/away], last_feed_at, last_interact_at, last_explore_at, daily_interact_count）。
- `pet_interactions`：互动日志（type, mood_delta, satiety_delta, currency_delta, created_at）。
- `pet_explorations`：外出记录（start_at, end_at, event_id, status）。
- `pet_events`：用户已获得事件（event_id, type, rarity, unlocked_at, is_new）。

#### 4.1.2 经济与商城
- `user_currency`：用户余额（berries, flowers, updated_at）。
- `currency_transactions`：流水（type, currency_type, amount, source, related_id, balance_after）。
- `shop_items`：商品（category[food/equipment/prop], name, description, icon, price_berries, price_flowers, stock, status, unlock_condition, effect_json）。
- `user_inventory`：背包（item_id, category, quantity, acquired_at, expires_at）。

#### 4.1.3 任务与成就
- `tasks`：任务定义（name, type[daily/weekly/once/permanent], condition_json, reward_berries, reward_flowers, jump_page, sort_order, start_time, end_time, status）。
- `user_tasks`：用户任务进度（task_id, progress_json, status, completed_at, reward_claimed）。
- `achievements`：成就定义（name, category, condition_json, reward_berries, reward_flowers, badge_icon）。
- `user_achievements`：用户已获得成就。
- `checkins`：签到记录（date, reward_type, reward_amount, continuous_days）。

#### 4.1.4 内容资源
- `pet_events_lib`：多巴胺/小确幸事件库（type, title, content, image_url, rarity, region, unlock_condition, reward_json）。
- `pet_dialogues`：宠物对话/反馈文案库（scene, text, weight, probability）。
- `pet_skins`：宠物外观（species, skin_id, name, icon, lottie_url, gif_url, unlock_condition）。
- `pet_states_lib`：居家状态库（state_key, name, lottie_url, gif_url, time_ranges）。

#### 4.1.5 配置中心（扩展 `app_configs`）
- 新增 key：
  - `pet_global`：心情/饱食度衰减速度、互动上限、外出参数等。
  - `currency_rules`：浆果/鲜花获取规则、每日上限、初始赠送。
  - `shop_categories`：商城分类与展示规则。
  - `task_global`：任务刷新时间、签到周期。
  - `museum_modules`：博物馆入口开关（已存在，扩展）。

### 4.2 后端服务层

#### 4.2.1 新增服务
- `src/services/petService.js`：宠物状态 CRUD、心情/饱食度衰减计算、外出判定。
- `src/services/currencyService.js`：余额查询、发放（带上限校验）、消费、流水。
- `src/services/shopService.js`：商品列表、购买、库存扣减、解锁检查。
- `src/services/inventoryService.js`：背包查询、使用物品、消耗/永久型区分。
- `src/services/eventService.js`：事件掉落、收集、相册。
- `src/services/taskService.js`：任务列表、进度更新、签到、奖励发放。
- `src/services/achievementService.js`：成就判定、里程碑检查、奖励发放。
- `src/services/petDialogueService.js`：根据场景随机抽取反馈文案。

#### 4.2.2 改造现有服务
- `src/services/agents/mainAgent.js`：
  - 人设改为「努力减脂的小熊猫」，统一口吻。
  - 当用户当前体重 ≤ 目标体重时，切换为「健康生活/保持体重」模式，不再主动输出减脂建议。
  - 增加「体重达标」分支判断。
- `src/services/agents/helperAgent.js`：
  - 人设同步改为宠物口吻。
  - 体重达标后，输出保持体重、健康饮食、维持运动相关内容。
- `src/services/agents/precipitationAgent.js`：
  - 保留现有记录沉淀能力。
  - 记录确认后调用 `currencyService` 发放浆果奖励。
  - 心情感悟识别后沉淀到心情日记（扩展 `museum_items` type=diary 或新建表）。
- `src/controllers/chatController.js`：
  - 记录确认/忽略流程中接入奖励发放。
  - 管家 Agent 回执消息中增加宠物口吻与奖励文案。

#### 4.2.3 新增控制器与路由
- 宠物：`GET/POST /api/pet`, `/api/pet/feed`, `/api/pet/play`, `/api/pet/hug`, `/api/pet/explore`, `/api/pet/events`
- 货币：`GET /api/currency`, `GET /api/currency/transactions`
- 商城：`GET /api/shop/items`, `POST /api/shop/buy`
- 背包：`GET /api/inventory`, `POST /api/inventory/use`
- 任务：`GET /api/tasks`, `POST /api/tasks/claim`, `/api/checkin`, `/api/checkin/status`
- 成就：`GET /api/achievements`, `GET /api/achievements/milestones`
- 内容：`GET /api/pet/events-lib`, `/api/pet/dialogues`

#### 4.2.4 CMS 后端
新增 controllers：
- `cmsPetController.js`：宠物配置、状态库、外观库、对话库。
- `cmsCurrencyController.js`：货币规则、流水查询。
- `cmsShopController.js`：商品 CRUD、分类、库存。
- `cmsEventController.js`：事件库 CRUD。
- `cmsTaskController.js`：任务 CRUD、签到配置。
- `cmsAchievementController.js`：成就/里程碑 CRUD。

### 4.3 前端页面与组件

#### 4.3.1 底部 Tab 调整
- `src/custom-tab-bar/index.vue`：新增「陪伴」Tab，顺序改为 聊聊 / 搭搭 / 工具箱 / 博物馆。
- `pages.json`：同步 tabBar.list、新增 `pages/pet/index.vue`、将 `pages/record/index.vue` 作为工具箱首页。

#### 4.3.2 新增搭搭 Tab（`pages/pet/index.vue`）
- 宠物主展示区（居家/外出状态、Lottie/GIF 动画）。
- 状态条：心情值、饱食度。
- 叹号气泡：吃饭、运动、心情低落、外出归来。
- 互动按钮区：喂食、运动、摸一摸、抱一抱、聊会天。
- 快捷入口：商城、背包、任务、事件相册。
- 组件拆分：
  - `PetAvatar.vue`（动画容器，支持 lottie/gif/static）
  - `PetStatusBar.vue`
  - `PetBubble.vue`
  - `InteractionPanel.vue`
  - `EventCard.vue`

#### 4.3.3 聊天页改造（`pages/index/index.vue`）
- 顶部从「搭子模式」改为「宠物信息条」：宠物头像、心情、状态文案。
- 保留对话流与沉淀确认弹窗。
- 新增「聊会天」入口可跳转回聊天。
- 宠物不再展示 gentle/strict/tease 模式切换（P0 可保留配置位但 UI 弱化）。

#### 4.3.4 工具箱 Tab（`pages/record/index.vue` 升级）
- 顶部增加「今日 / 陪你动」切换（P1 实现陪你动，P0 可占位）。
- 今日页增加生成今日分析入口（消耗货币）。
- 记录入口保持现有饮食/运动/体重/饮水（饮水 P1）。

#### 4.3.5 新增商城与背包
- `pages/shop/index.vue`：食物 / 器材 / 限定道具三个 Tab，双货币价格，购买。
- `pages/inventory/index.vue`：食物 / 器材 / 道具三个 Tab，使用物品。

#### 4.3.6 新增任务与事件
- `pages/tasks/index.vue`：签到日历、日常任务、周常任务。
- `pages/pet/events.vue`：事件相册（多巴胺/小确幸），支持查看、保存、分享。

#### 4.3.7 全局货币展示
- 在聊聊页、搭搭页、商城页顶部显示浆果/鲜花余额。
- 新增 `CurrencyBadge.vue` 组件。

#### 4.3.8 动画支持
- 新增 `LottiePlayer.vue` 组件，使用 `lottie-web`（需评估 uni-app 跨端兼容性）。
- GIF 使用 `<image>` 或 `<img>` 原生支持。
- 宠物动画配置优先级：Lottie > GIF > 静态图。

### 4.4 管理后台

#### 4.4.1 建议先做通用能力升级
- 新增 `src/directives/permission.js` 全局权限指令，替换各页面 copy-paste 的 `vPerm`。
- 新增 `src/utils/permissions.js` 集中管理权限码。
- （可选）新增通用 `CrudTable` / `EditDialog` 组件，减少重复代码。

#### 4.4.2 新增 CMS 页面
| 页面 | 路径 | 权限 |
|---|---|---|
| 宠物配置 | `/pet-config` | `pet_config:read/write` |
| 货币规则 | `/currency-config` | `currency_config:read/write` |
| 商城商品 | `/shop-config` | `shop_config:read/write` |
| 事件库 | `/event-config` | `event_config:read/write` |
| 任务配置 | `/task-config` | `task_config:read/write` |
| 成就里程碑 | `/achievement-config` | `achievement_config:read/write` |
| 话术/反馈库 | `/dialogue-config` | `dialogue_config:read/write` |

### 4.5 AI / Prompt 改造

#### 4.5.1 人设统一
- 所有 Agent 对外统一为「小熊猫搭搭」人设：
  - 为减肥系统学习过营养搭配与健身运动学知识。
  - 精通减脂方法，热爱四处闲逛享受生活。
  - 语气温暖、陪伴感强，不是冰冷教练。
- 在 `promptDefaults.js` 中新增/修改：
  - `main_agent`：加入宠物人设、体重达标分支。
  - `helper_agent`：同步人设，体重达标后输出保持体重建议。
  - `butler_agent`（可复用 main_agent 或拆分）：负责即时回执、奖励发放话术。

#### 4.5.2 体重达标逻辑
- 后端在调用 Agent 前读取 `user_profiles.current_weight` 与 `target_weight`。
- 若 `current_weight <= target_weight`，在 prompt system message 中注入「用户已达标，请输出健康生活/保持体重内容，不再推荐减脂方案」。
- 同时过滤工具调用：不再调用减脂计划生成、热量缺口计算等工具。

#### 4.5.3 奖励话术
- 管家 Agent 在记录确认后，使用 `pet_dialogues` 中配置的「奖励回执」文案，并提及获得浆果数量。

---

## 五、技术难点与风险

### 5.1 动画方案（Lottie / GIF）
- **难点**：uni-app 跨端（H5 / 小程序 / App）对 Lottie 支持不一致。
  - H5：可用 `lottie-web`。
  - 微信小程序：可用 `lottie-miniprogram` 或原生 `lottie` 组件。
  - App：可用 `lottie-ios` / `lottie-android` 原生插件或 nvue。
- **建议**：封装 `PetAvatar.vue`，按平台条件编译；提供 GIF/静态图降级；后台配置每个动作的 lottie_url / gif_url / static_url。

### 5.2 实时宠物状态
- **难点**：宠物心情/饱食度需要随时间衰减，外出状态需要倒计时。
- **建议**：
  - 状态以服务端计算为准（读取时根据 last_update 与衰减公式实时计算）。
  - 前端用定时器做本地倒计时，回到前台时重新拉取。
  - 避免高频写库，仅在发生互动/喂食/外出结束时写入。

### 5.3 经济系统平衡
- **难点**：浆果/鲜花产出与消耗的平衡、每日上限防刷、并发购买库存扣减。
- **建议**：
  - 所有奖励数值走 `app_configs` 配置，方便运营调整。
  - 发放时用 `INSERT OR IGNORE` + 唯一索引防重；购买时用事务扣减库存与余额。
  - 每日上限在 `currencyService` 中按 `user_id + date + currency_type` 聚合校验。

### 5.4 三 Agent 协作与延迟
- **难点**：管家/专家/沉淀 Agent 接力处理可能增加响应延迟。
- **建议**：
  - 沉淀 Agent 与管家 Agent 可并行调用，专家 Agent 在需要专业知识时才调用。
  - 对于纯记录类消息，沉淀后由管家直接回执，不等待专家。
  - 后端缓存用户基础数据（BMR/目标）减少重复查询。

### 5.5 数据迁移
- **难点**：现有 `partners` 表需要迁移为宠物；老用户数据不能丢。
- **建议**：
  - `partners` 表保留，新增 `pets` 表；默认给老用户创建一只小熊猫宠物，继承 partner.name。
  - 老用户的 mode（gentle/strict/tease）可映射为宠物性格文案，P0 不再展示模式切换。

### 5.6 后台配置复杂性
- **难点**：12 个配置模块，每个模块都有大量字段，CMS 页面开发工作量大。
- **建议**：
  - 优先实现核心配置（宠物参数、货币规则、商城商品、任务、事件）。
  - 使用 JSON 字段存储复杂配置（effect_json, condition_json），后台用表单动态渲染。
  - 建立通用 CRUD 组件减少重复代码。

### 5.7 广告位预留
- **难点**：需在多处预留广告回调，但当前不展示广告。
- **建议**：
  - 抽象 `AdSlot.vue` 组件，内部根据全局开关 `ad_enabled` 决定是否渲染。
  - 在奖励发放、商店解锁、生成分析、跟练结束等位置插入 `<AdSlot />`。
  - 埋点事件命名统一，如 `ad_reward_earned`, `ad_shop_unlock`, `ad_analysis_generate`。

### 5.8 性能与包体积
- **难点**：新增大量图片/Lottie 资源、新页面可能导致包体积增大。
- **建议**：
  - 宠物动画资源按平台分包或 CDN 加载。
  - 商城/事件图片走 CDN 或后端 `static` 目录。
  - 使用 uni-app 分包加载（`subPackages`）将陪伴、商城、背包等拆为分包。

---

## 六、分阶段实施路线图

### 阶段 1：基础框架与数据层（约 2 周）
1. 新增数据库表（宠物、货币、商城、背包、任务、成就、事件库、对话库）。
2. 新增后端基础服务（petService, currencyService, shopService, inventoryService）。
3. 新增后端 API 与 CMS 接口框架。
4. 前端调整 Tab 结构，新增 `pages/pet/index.vue` 空壳与路由。
5. 管理后台新增权限文件与菜单框架。

### 阶段 2：宠物陪伴核心（约 2 周）
1. 实现宠物状态机（心情、饱食度、居家/外出）。
2. 实现喂食、摸一摸、抱一抱互动及动画播放。
3. 实现外出探索与事件掉落。
4. 实现事件相册。
5. 前端完成搭搭 Tab UI。

### 阶段 3：经济 + 商城 + 背包（约 2 周）
1. 实现浆果/鲜花余额与发放逻辑。
2. 实现商城购买、背包使用。
3. 实现记录确认后自动发放浆果。
4. 前端完成商城、背包、全局货币展示。

### 阶段 4：任务 + 成就 + 签到（约 1.5 周）
1. 实现签到、日常任务、成就判定。
2. 实现任务完成后管家 Agent 回执奖励。
3. 前端完成任务页、成就展示。

### 阶段 5：AI 人设与体重达标（约 1 周）
1. 重写 main_agent / helper_agent prompt 为宠物人设。
2. 实现体重达标分支逻辑。
3. 联调聊天回执与奖励话术。

### 阶段 6：CMS 完善与联调（约 1.5 周）
1. 完成所有新增 CMS 页面。
2. 配置中心录入默认值。
3. 全链路联调、测试、修复。

**总计约 10 周（3 人并行可压缩至 5–6 周）**，P1/P2 功能在 P0 上线后迭代。

---

## 七、待确认问题清单

详见 `pet-companion-questions.md`。
