# 减脂陪伴 App 改造 — 技术规格说明

## 一、总体技术选型

| 层级 | 技术栈 | 说明 |
|---|---|---|
| 前端 | uni-app Vue3 + Vite | 继续沿用，新增页面按平台条件编译处理 Lottie |
| 后端 | Node.js + Express + better-sqlite3 | 继续沿用，新增服务模块 |
| 管理后台 | Vue3 + Vite + Element Plus | 继续沿用，新增 CMS 模块 |
| 动画 | lottie-web (H5) / lottie-miniprogram (小程序) / GIF 降级 | 后台配置多格式 URL |
| 配置存储 | SQLite `app_configs` + 新增业务配置表 | P0 不强制实现独立配置中心服务 |
| 消息推送 | 对话内消息优先，本地通知 secondary | 复用现有模板消息体系 |

---

## 二、数据库新增表结构（P0）

### 2.1 宠物主表 `pets`
```sql
CREATE TABLE pets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  species VARCHAR(32) DEFAULT 'red_panda' COMMENT '当前固定小熊猫',
  name VARCHAR(64) DEFAULT '搭搭' COMMENT '固定为搭搭，用户不可修改',
  level INTEGER DEFAULT 1,
  skin_id VARCHAR(64) DEFAULT 'default',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2.2 宠物实时状态 `pet_states`
```sql
CREATE TABLE pet_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  mood INTEGER DEFAULT 80,          -- 心情值 0-100
  satiety INTEGER DEFAULT 80,       -- 饱食度 0-100
  location VARCHAR(16) DEFAULT 'home', -- home | away
  state_key VARCHAR(32) DEFAULT 'idle', -- 当前居家状态
  daily_interact_count INTEGER DEFAULT 0,
  daily_feed_count INTEGER DEFAULT 0,
  last_feed_at DATETIME,
  last_interact_at DATETIME,
  last_explore_at DATETIME,
  last_decay_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2.3 宠物外观库 `pet_skins`
```sql
CREATE TABLE pet_skins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skin_id VARCHAR(64) NOT NULL UNIQUE,
  species VARCHAR(32) DEFAULT 'red_panda',
  name VARCHAR(64) NOT NULL,
  icon_url VARCHAR(255),
  lottie_url VARCHAR(255),
  gif_url VARCHAR(255),
  static_url VARCHAR(255),
  unlock_condition JSON,
  sort_order INTEGER DEFAULT 0,
  is_enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 居家状态库 `pet_states_lib`
```sql
CREATE TABLE pet_states_lib (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_key VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64),
  lottie_url VARCHAR(255),
  gif_url VARCHAR(255),
  static_url VARCHAR(255),
  time_ranges JSON, -- 可选，哪些时段可出现
  mood_range JSON,  -- 可选，心情区间
  sort_order INTEGER DEFAULT 0,
  is_enabled TINYINT DEFAULT 1
);
```

### 2.5 用户余额 `user_currency`
```sql
CREATE TABLE user_currency (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  berries INTEGER DEFAULT 0,
  flowers INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2.6 货币流水 `currency_transactions`
```sql
CREATE TABLE currency_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  currency_type VARCHAR(16) NOT NULL, -- berries | flowers
  amount INTEGER NOT NULL,
  type VARCHAR(32) NOT NULL, -- reward | consume | task | achievement | shop | admin_adjust
  source VARCHAR(64),        -- 来源标识，如 task_id
  related_id INTEGER,
  balance_after INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2.7 商城商品 `shop_items`
```sql
CREATE TABLE shop_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category VARCHAR(32) NOT NULL, -- food | equipment | prop
  name VARCHAR(128) NOT NULL,
  description TEXT,
  icon_url VARCHAR(255),
  price_berries INTEGER DEFAULT 0,
  price_flowers INTEGER DEFAULT 0,
  stock INTEGER DEFAULT -1, -- -1 无限
  item_type VARCHAR(32),    -- 与 inventory 对应
  effect_json JSON,         -- 使用效果：{ mood: 10, satiety: 15, ... }
  unlock_condition JSON,
  duration_seconds INTEGER, -- 器材使用时限，永久为 null
  sort_order INTEGER DEFAULT 0,
  status TINYINT DEFAULT 1, -- 0 下架 1 上架
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.8 用户背包 `user_inventory`
```sql
CREATE TABLE user_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  shop_item_id INTEGER,
  category VARCHAR(32) NOT NULL,
  name VARCHAR(128),
  icon_url VARCHAR(255),
  quantity INTEGER DEFAULT 1, -- -1 表示永久/已拥有
  effect_json JSON,
  acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_item_id) REFERENCES shop_items(id) ON DELETE SET NULL
);
```

### 2.9 事件库 `pet_events_lib`
```sql
CREATE TABLE pet_events_lib (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key VARCHAR(64) NOT NULL UNIQUE,
  type VARCHAR(32) NOT NULL, -- dopamine | small_joy
  title VARCHAR(128),
  content TEXT,
  image_url VARCHAR(255),
  rarity VARCHAR(16) DEFAULT 'common', -- common | rare | epic | legend
  region VARCHAR(64),
  unlock_condition JSON,
  reward_json JSON,
  sort_order INTEGER DEFAULT 0,
  is_enabled TINYINT DEFAULT 1
);
```

### 2.10 用户事件 `user_events`
```sql
CREATE TABLE user_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  is_new TINYINT DEFAULT 1,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES pet_events_lib(id) ON DELETE CASCADE,
  UNIQUE(user_id, event_id)
);
```

### 2.11 任务定义 `tasks`
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL, -- daily | weekly | once | permanent
  description TEXT,
  condition_json JSON NOT NULL, -- { action: 'feed', count: 1 }
  reward_berries INTEGER DEFAULT 0,
  reward_flowers INTEGER DEFAULT 0,
  jump_page VARCHAR(128),
  sort_order INTEGER DEFAULT 0,
  start_time DATETIME,
  end_time DATETIME,
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.12 用户任务进度 `user_tasks`
```sql
CREATE TABLE user_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  progress_json JSON DEFAULT '{}',
  status TINYINT DEFAULT 0, -- 0 进行中 1 已完成 2 已领奖
  completed_at DATETIME,
  claimed_at DATETIME,
  cycle_key VARCHAR(32), -- 用于区分每日/每周，如 20250712
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(user_id, task_id, cycle_key)
);
```

### 2.13 签到 `checkins`
```sql
CREATE TABLE checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  checkin_date DATE NOT NULL,
  continuous_days INTEGER DEFAULT 1,
  reward_berries INTEGER DEFAULT 0,
  reward_flowers INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, checkin_date)
);
```

### 2.14 成就 `achievements`
```sql
CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL, -- weight_loss | streak | recipe | event | social
  description TEXT,
  condition_json JSON NOT NULL,
  reward_berries INTEGER DEFAULT 0,
  reward_flowers INTEGER DEFAULT 0,
  badge_icon VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  is_enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.15 用户成就 `user_achievements`
```sql
CREATE TABLE user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
  UNIQUE(user_id, achievement_id)
);
```

### 2.16 宠物对话库 `pet_dialogues`
```sql
CREATE TABLE pet_dialogues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene VARCHAR(64) NOT NULL, -- feed | play | hug | explore_return | reward | greet | ...
  text TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  probability DECIMAL(3,2) DEFAULT 1.00, -- 1=必触发，0.5=50%
  is_enabled TINYINT DEFAULT 1
);
```

---

## 三、关键接口设计（C 端）

### 3.1 宠物
```
GET    /api/pet              # 获取宠物状态
POST   /api/pet/feed         # 喂食 { inventory_item_id }
POST   /api/pet/play         # 摸一摸 / 抱一抱 { type }
POST   /api/pet/explore      # 外出探索
GET    /api/pet/events       # 我的事件相册
PUT    /api/pet/events/:id/read  # 标记事件已读
```

### 3.2 货币
```
GET    /api/currency         # 余额
GET    /api/currency/transactions # 流水
```

### 3.3 商城与背包
```
GET    /api/shop/items       # 商品列表（category, status）
POST   /api/shop/buy         # 购买 { item_id, quantity }
GET    /api/inventory        # 背包
POST   /api/inventory/use    # 使用 { item_id }
```

### 3.4 任务与签到
```
GET    /api/tasks            # 任务列表
POST   /api/tasks/:id/claim  # 领取奖励
POST   /api/checkin          # 签到
GET    /api/checkin/status   # 签到状态
GET    /api/achievements     # 成就列表
```

### 3.5 内容
```
GET    /api/pet/events-lib   # 事件库（CMS 配置后 C 端只读）
GET    /api/pet/dialogues    # 对话库（内部使用，C 端可能不需要）
```

---

## 四、关键接口设计（CMS）

```
/cms/pet-config         宠物参数、状态库、外观库、对话库
/cms/currency-config    货币规则、流水查询
/cms/shop-config        商品 CRUD
/cms/event-config       事件库 CRUD
/cms/task-config        任务 CRUD、签到配置
/cms/achievement-config 成就/里程碑 CRUD
```

每个接口权限：`:read` / `:write`。

---

## 五、状态衰减算法

宠物心情/饱食度采用「读取时计算」策略，避免定时任务。

```
now = CURRENT_TIMESTAMP
hours = (now - last_decay_at) / 3600
mood_loss = hours * randomBetween(5, 10)  # 心情每小时衰减 5–10 随机
satiety_loss = hours * config.satiety_decay_per_hour  # 饱食度衰减待确认

new_mood = max(0, min(100, mood - mood_loss))
new_satiety = max(0, min(100, satiety - satiety_loss))
```

写入时机：
- 每次互动/喂食/外出结束时写回 `mood`, `satiety`, `last_decay_at`。
- 避免纯查询写库。

---

## 六、奖励发放防刷

1. **每日上限**：`currency_transactions` 按 `user_id + currency_type + date(created_at) + source` 聚合校验。
2. **任务周期**：`user_tasks.cycle_key` 区分每日/每周，防止重复完成。
3. **签到防重**：`checkins` 表 `(user_id, checkin_date)` 唯一索引。
4. **心情衰减规则补充：低于 60 不出门；22:00–08:00 睡觉时段暂停衰减。

### 购买事务**：
   ```sql
   BEGIN;
   SELECT berries FROM user_currency WHERE user_id = ?;
   UPDATE user_currency SET berries = berries - ?;
   INSERT INTO user_inventory ...;
   INSERT INTO currency_transactions ...;
   COMMIT;
   ```

---

## 七、AI Prompt 改造要点

### 7.1 统一人设注入
在每次调用大模型前，system message 中注入：
```
你是「搭搭」，一只努力减脂的小熊猫。你系统学习过营养搭配与健身运动学知识，
精通减脂方法，平时热爱四处闲逛、享受生活。你是用户并肩减脂的伙伴，
语气温暖、陪伴感强，像懂行的闺蜜/伙伴，而非冰冷教练。
```

### 7.2 体重达标分支
调用前读取 `user_profiles.current_weight` 与 `target_weight`：
- 若 `current_weight <= target_weight`，system message 追加：
  ```
  用户已达到减脂目标，当前体重不高于目标体重。请输出健康生活、保持体重相关内容，
  不再主动推荐减脂方案、热量缺口、节食等内容。若用户明确询问减脂，可简要回答。
  ```

### 7.3 管家回执
记录确认后，由管家 Agent 发送简短回执：
```
「记录成功！搭搭刚刚 xxx，心情 +x，你还获得了 x 颗浆果哦～」
```
文案从 `pet_dialogues` 中按 scene=reward 随机抽取。

---

## 八、动画组件设计

### 8.1 PetAvatar.vue
```vue
<template>
  <view class="pet-avatar">
    <lottie-player v-if="lottieUrl" :src="lottieUrl" loop />
    <image v-else-if="gifUrl" :src="gifUrl" mode="aspectFit" />
    <image v-else :src="staticUrl" mode="aspectFit" />
  </view>
</template>
```

### 8.2 平台适配
- H5：`lottie-web` 渲染 JSON URL。
- 微信小程序：条件编译使用 `lottie-miniprogram`。
- App：优先 GIF/静态图，或引入原生 Lottie 插件。

---

## 九、广告位预留

抽象 `AdSlot.vue`：
```vue
<template>
  <view v-if="adEnabled" class="ad-slot" @click="onAdClick">
    <!-- 广告内容 -->
  </view>
</template>
```

全局开关 `ad_enabled` 放 `app_configs`。P0 默认 `false`，组件不渲染，但埋点事件已预留。

---

## 十、迁移策略

1. **老用户**：注册脚本/启动时自动创建 `pets` + `pet_states` + `user_currency` 默认记录。
2. **Partner 表**：保留不删除，宠物名字默认取 `partners.name`，找不到则取用户昵称/「搭搭」。
3. **博物馆**：`museum_items` 现有数据不动，新增 type=diary 用于心情日记。
4. **Prompt**：使用 `backend/scripts/sync-prompts.js` 同步新版 prompt。
