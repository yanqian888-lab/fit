# 减肥搭子 APP —— MVP 数据库设计

> 本设计基于 SQLite（本地主存储）+ MySQL（云端备份）。MVP 阶段以 SQLite 为主，所有表结构兼容 MySQL，方便后续迁移。

---

## 1. 设计原则

1. 最小可用：只包含 MVP 阶段必要表
2. 扩展友好：沉淀记录使用通用表 + JSON 扩展字段
3. 成本控制：优先使用 SQLite，减少运维
4. 多端同步：预留 `sync_status` 和 `cloud_id` 字段

---

## 2. 表结构总览

| 序号 | 表名 | 说明 |
|------|------|------|
| 1 | `users` | 用户基础资料 |
| 2 | `user_profiles` | 用户减肥目标与身体数据 |
| 3 | `partners` | AI 搭子设置 |
| 4 | `chat_messages` | 聊天记录 |
| 5 | `precipitation_records` | 沉淀记录通用表 |
| 6 | `diet_records` | 饮食记录 |
| 7 | `exercise_records` | 运动记录 |
| 8 | `body_records` | 身体数据记录 |
| 9 | `museum_items` | 博物馆内容（金句、感悟、食谱、方法） |
| 10 | `milestones` | 里程碑记录 |
| 11 | `timelines` | 时间轴事件 |
| 12 | `food_db` | 食物数据库 |
| 13 | `exercise_db` | 运动数据库 |
| 14 | `settings` | 用户系统设置 |

---

## 3. 详细表结构

### 3.1 用户表（users）

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid VARCHAR(64) UNIQUE NOT NULL COMMENT '微信小程序 openid',
  unionid VARCHAR(64) DEFAULT NULL COMMENT '微信 unionid',
  nickname VARCHAR(64) DEFAULT '减肥搭子用户' COMMENT '昵称',
  avatar_url VARCHAR(255) DEFAULT NULL COMMENT '头像 URL',
  phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  gender TINYINT DEFAULT 0 COMMENT '性别：0 未知，1 男，2 女',
  age TINYINT DEFAULT NULL COMMENT '年龄',
  height DECIMAL(5,2) DEFAULT NULL COMMENT '身高 cm',
  status TINYINT DEFAULT 1 COMMENT '状态：0 禁用，1 正常',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME DEFAULT NULL
);
```

### 3.2 用户资料表（user_profiles）

```sql
CREATE TABLE user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  initial_weight DECIMAL(6,2) DEFAULT NULL COMMENT '初始体重 kg',
  current_weight DECIMAL(6,2) DEFAULT NULL COMMENT '当前体重 kg',
  target_weight DECIMAL(6,2) DEFAULT NULL COMMENT '目标体重 kg',
  target_date DATE DEFAULT NULL COMMENT '目标完成日期',
  bmr DECIMAL(8,2) DEFAULT NULL COMMENT '基础代谢 kcal',
  daily_calorie_target DECIMAL(8,2) DEFAULT NULL COMMENT '每日目标摄入热量',
  calorie_deficit DECIMAL(6,2) DEFAULT 500 COMMENT '每日热量缺口',
  dietary_taboos VARCHAR(255) DEFAULT NULL COMMENT '忌口，逗号分隔',
  preferences VARCHAR(255) DEFAULT NULL COMMENT '偏好，逗号分隔',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3.3 搭子设置表（partners）

```sql
CREATE TABLE partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(32) DEFAULT '瘦瘦' COMMENT '搭子名字',
  gender TINYINT DEFAULT 2 COMMENT '性别：1 男，2 女',
  avatar_url VARCHAR(255) DEFAULT NULL,
  mode VARCHAR(16) DEFAULT 'gentle' COMMENT '模式：gentle 温柔，strict 严格，tease 损友',
  voice_speed TINYINT DEFAULT 5 COMMENT '语速 1-10',
  strictness TINYINT DEFAULT 5 COMMENT '严格程度 1-10',
  humor TINYINT DEFAULT 5 COMMENT '幽默感 1-10',
  status VARCHAR(16) DEFAULT 'awake' COMMENT '当前状态',
  status_text VARCHAR(32) DEFAULT '刚刚起床' COMMENT '状态描述',
  status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3.4 聊天记录表（chat_messages）

```sql
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role VARCHAR(16) NOT NULL COMMENT '角色：user 用户，partner 搭子，system 系统',
  content TEXT NOT NULL COMMENT '消息内容',
  content_type VARCHAR(16) DEFAULT 'text' COMMENT '类型：text 文字，image 图片，voice 语音',
  media_url VARCHAR(255) DEFAULT NULL COMMENT '图片/语音 URL',
  precipitation_status TINYINT DEFAULT 0 COMMENT '沉淀状态：0 无，1 已自动记录，2 待确认，3 已拒绝',
  precipitation_id INTEGER DEFAULT NULL COMMENT '关联沉淀记录 ID',
  mode VARCHAR(16) DEFAULT NULL COMMENT '当时搭子模式',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_user_created ON chat_messages(user_id, created_at);
```

### 3.5 沉淀记录通用表（precipitation_records）

```sql
CREATE TABLE precipitation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  chat_id INTEGER DEFAULT NULL COMMENT '来源聊天记录 ID',
  type VARCHAR(32) NOT NULL COMMENT '一级分类：diet_record, exercise_record, body_data, habit, recipe, method, pitfall, product, quote, insight, emotion, milestone_weight, milestone_duration, milestone_behavior, photo_body, photo_food, photo_exercise, plan_daily, plan_weekly, plan_cheat_meal, question, advice',
  sub_type VARCHAR(32) DEFAULT NULL COMMENT '二级分类',
  content TEXT NOT NULL COMMENT '原始聊天内容',
  extracted_data TEXT DEFAULT NULL COMMENT '结构化提取数据 JSON',
  confidence DECIMAL(3,2) DEFAULT 0 COMMENT '提取置信度 0-1',
  status TINYINT DEFAULT 0 COMMENT '状态：0 待确认，1 已确认，2 已拒绝',
  source TINYINT DEFAULT 0 COMMENT '来源：0 自动提取，1 手动添加，2 手动修改',
  tags VARCHAR(255) DEFAULT NULL COMMENT '标签，逗号分隔',
  remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
  sync_status TINYINT DEFAULT 0 COMMENT '同步状态：0 未同步，1 已同步，2 同步失败',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (chat_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_precipitation_user ON precipitation_records(user_id, created_at);
CREATE INDEX idx_precipitation_type ON precipitation_records(user_id, type, status);
```

### 3.6 饮食记录表（diet_records）

```sql
CREATE TABLE diet_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  precipitation_id INTEGER DEFAULT NULL,
  record_date DATE NOT NULL COMMENT '记录日期',
  meal_time VARCHAR(16) NOT NULL COMMENT '早餐 breakfast，午餐 lunch，晚餐 dinner，加餐 snack',
  foods TEXT NOT NULL COMMENT '食物列表 JSON：[{name, weight, calorie, protein, carb, fat}]',
  total_calorie DECIMAL(8,2) DEFAULT 0 COMMENT '总热量 kcal',
  total_protein DECIMAL(6,2) DEFAULT 0 COMMENT '总蛋白质 g',
  total_carb DECIMAL(6,2) DEFAULT 0 COMMENT '总碳水 g',
  total_fat DECIMAL(6,2) DEFAULT 0 COMMENT '总脂肪 g',
  tags VARCHAR(255) DEFAULT NULL,
  remark VARCHAR(255) DEFAULT NULL,
  status TINYINT DEFAULT 1 COMMENT '状态：0 待确认，1 已确认',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
);

CREATE INDEX idx_diet_user_date ON diet_records(user_id, record_date);
```

### 3.7 运动记录表（exercise_records）

```sql
CREATE TABLE exercise_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  precipitation_id INTEGER DEFAULT NULL,
  record_date DATE NOT NULL,
  exercise_type VARCHAR(16) NOT NULL COMMENT 'aerobic 有氧，strength 力量，stretch 拉伸，ball 球类',
  exercises TEXT NOT NULL COMMENT '运动列表 JSON：[{name, duration, intensity, calorie}]',
  total_duration INT DEFAULT 0 COMMENT '总时长 分钟',
  total_calorie DECIMAL(8,2) DEFAULT 0 COMMENT '总消耗 kcal',
  remark VARCHAR(255) DEFAULT NULL,
  status TINYINT DEFAULT 1 COMMENT '状态：0 待确认，1 已确认',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
);

CREATE INDEX idx_exercise_user_date ON exercise_records(user_id, record_date);
```

### 3.8 身体数据记录表（body_records）

```sql
CREATE TABLE body_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  precipitation_id INTEGER DEFAULT NULL,
  record_date DATE NOT NULL,
  type VARCHAR(16) NOT NULL COMMENT 'weight 体重，body_fat 体脂，muscle 肌肉，waist 腰围，hip 臀围，chest 胸围，thigh 大腿围',
  value DECIMAL(6,2) NOT NULL,
  unit VARCHAR(8) NOT NULL COMMENT 'kg, jin, cm, %',
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
);

CREATE INDEX idx_body_user_date ON body_records(user_id, record_date);
```

### 3.9 博物馆内容表（museum_items）

```sql
CREATE TABLE museum_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type VARCHAR(32) NOT NULL COMMENT 'quote 金句，insight 感悟，recipe 食谱，method 方法，pitfall 踩坑，product 好物',
  sub_type VARCHAR(32) DEFAULT NULL COMMENT '如 quote 下分 user/partner',
  content TEXT NOT NULL COMMENT '内容',
  extracted_data TEXT DEFAULT NULL COMMENT '扩展 JSON',
  author VARCHAR(16) DEFAULT 'user' COMMENT '作者：user 用户，partner 搭子',
  emotion VARCHAR(16) DEFAULT NULL COMMENT '情绪：positive, neutral, negative',
  scene VARCHAR(16) DEFAULT NULL,
  effectiveness TINYINT DEFAULT NULL COMMENT '有效性：1 无效，2 一般，3 有效',
  is_favorite TINYINT DEFAULT 0 COMMENT '是否收藏',
  tags VARCHAR(255) DEFAULT NULL,
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_museum_user_type ON museum_items(user_id, type, created_at);
```

### 3.10 里程碑表（milestones）

```sql
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type VARCHAR(32) NOT NULL COMMENT 'weight_loss 减重，duration 坚持天数，behavior 行为',
  title VARCHAR(128) NOT NULL COMMENT '里程碑标题',
  description VARCHAR(255) DEFAULT NULL,
  value DECIMAL(8,2) DEFAULT NULL COMMENT '数值，如减重 5 斤',
  unit VARCHAR(16) DEFAULT NULL,
  icon VARCHAR(32) DEFAULT NULL,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_milestone_user ON milestones(user_id, achieved_at);
```

### 3.11 时间轴事件表（timelines）

```sql
CREATE TABLE timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type VARCHAR(32) NOT NULL COMMENT 'weight 体重变化，milestone 里程碑，quote 金句，insight 感悟，photo 照片，diet 饮食，exercise 运动',
  title VARCHAR(128) NOT NULL,
  content TEXT DEFAULT NULL,
  related_id INTEGER DEFAULT NULL COMMENT '关联记录 ID',
  related_type VARCHAR(32) DEFAULT NULL COMMENT '关联表名',
  event_date DATE NOT NULL,
  is_important TINYINT DEFAULT 0 COMMENT '是否重要置顶',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_timeline_user_date ON timelines(user_id, event_date DESC);
CREATE INDEX idx_timeline_type ON timelines(user_id, event_type, event_date DESC);
```

### 3.12 食物数据库（food_db）

```sql
CREATE TABLE food_db (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(64) NOT NULL COMMENT '食物名称',
  category VARCHAR(32) DEFAULT NULL COMMENT '分类：主食/蛋白质/蔬菜/水果/饮品/零食/外卖/烘焙',
  calorie_per_100g DECIMAL(8,2) DEFAULT 0 COMMENT '每 100g 热量 kcal',
  protein_per_100g DECIMAL(6,2) DEFAULT 0,
  carb_per_100g DECIMAL(6,2) DEFAULT 0,
  fat_per_100g DECIMAL(6,2) DEFAULT 0,
  fiber_per_100g DECIMAL(6,2) DEFAULT 0,
  gi DECIMAL(5,2) DEFAULT NULL,
  is_common TINYINT DEFAULT 1 COMMENT '是否常见食物',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_food_name ON food_db(name);
```

### 3.13 运动数据库（exercise_db）

```sql
CREATE TABLE exercise_db (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(64) NOT NULL COMMENT '运动名称',
  type VARCHAR(16) NOT NULL COMMENT 'aerobic/strength/stretch/ball/daily',
  calorie_per_hour DECIMAL(8,2) DEFAULT 0 COMMENT '每小时消耗 kcal（70kg 参考）',
  intensity VARCHAR(16) DEFAULT 'moderate' COMMENT 'low/moderate/high',
  is_common TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exercise_name ON exercise_db(name);
```

### 3.14 系统设置表（settings）

```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  notification_enabled TINYINT DEFAULT 1 COMMENT '总通知开关',
  reminder_weight TINYINT DEFAULT 1 COMMENT '称重提醒',
  reminder_water TINYINT DEFAULT 1 COMMENT '喝水提醒',
  reminder_exercise TINYINT DEFAULT 1 COMMENT '运动提醒',
  dnd_start TIME DEFAULT '22:00:00' COMMENT '免打扰开始',
  dnd_end TIME DEFAULT '08:00:00' COMMENT '免打扰结束',
  theme VARCHAR(16) DEFAULT 'light' COMMENT 'light/dark',
  font_size VARCHAR(16) DEFAULT 'medium',
  data_storage VARCHAR(16) DEFAULT 'local' COMMENT 'local 本地，cloud 云端',
  cloud_backup_enabled TINYINT DEFAULT 0,
  guide_completed TINYINT DEFAULT 0 COMMENT '是否完成新用户引导',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 4. 核心字段说明

### 4.1 沉淀记录扩展字段 JSON 示例

#### 饮食记录（diet_record）

```json
{
  "meal_time": "lunch",
  "foods": [
    { "name": "牛肉面", "weight": 200, "calorie": 500, "protein": 20, "carb": 60, "fat": 15, "source": "common_food_db" },
    { "name": "鸡蛋", "weight": 50, "calorie": 70, "protein": 6, "carb": 0.6, "fat": 5, "source": "common_food_db" }
  ],
  "total_calorie": 570,
  "total_protein": 26,
  "total_carb": 65,
  "total_fat": 18
}
```

#### 运动记录（exercise_record）

```json
{
  "exercise_type": "aerobic",
  "exercises": [
    { "name": "跑步", "duration": 30, "intensity": "moderate", "calorie": 300 }
  ],
  "total_duration": 30,
  "total_calorie": 300
}
```

#### 金句（quote）

```json
{
  "author": "user",
  "emotion": "positive",
  "scene": "milestone",
  "original_text": "只要坚持，就没有瘦不下来的胖子"
}
```

---

## 5. 初始数据

### 5.1 内置常见食物（MVP 精简版）

```sql
INSERT INTO food_db (name, category, calorie_per_100g, protein_per_100g, carb_per_100g, fat_per_100g) VALUES
('米饭', '主食', 116, 2.6, 25.9, 0.3),
('面条', '主食', 137, 4.5, 28.5, 0.8),
('全麦面包', '主食', 246, 8.5, 45.0, 3.5),
('鸡胸肉', '蛋白质', 133, 19.4, 2.5, 5.0),
('鸡蛋', '蛋白质', 139, 13.1, 2.4, 8.6),
('牛奶', '蛋白质', 54, 3.0, 4.7, 3.2),
('西兰花', '蔬菜', 34, 2.8, 7.0, 0.4),
('西红柿', '蔬菜', 18, 0.9, 3.9, 0.2),
('苹果', '水果', 52, 0.3, 13.8, 0.2),
('香蕉', '水果', 89, 1.1, 22.8, 0.3),
('可乐', '饮品', 43, 0, 10.6, 0),
('奶茶', '饮品', 65, 1.2, 12.0, 2.5);
```

### 5.2 内置常见运动（MVP 精简版）

```sql
INSERT INTO exercise_db (name, type, calorie_per_hour, intensity) VALUES
('跑步', 'aerobic', 600, 'moderate'),
('快走', 'aerobic', 300, 'low'),
('跳绳', 'aerobic', 700, 'high'),
('游泳', 'aerobic', 500, 'moderate'),
('骑自行车', 'aerobic', 400, 'moderate'),
('瑜伽', 'stretch', 200, 'low'),
('俯卧撑', 'strength', 350, 'moderate'),
('深蹲', 'strength', 400, 'moderate'),
('平板支撑', 'strength', 300, 'moderate'),
('做家务', 'daily', 150, 'low');
```

---

## 6. 数据流转示例

### 6.1 用户说"今天中午吃了一碗牛肉面和一个鸡蛋"

1. 写入 `chat_messages`（role=user）
2. 主协调 Agent 立即回复，写入 `chat_messages`（role=partner）
3. 信息沉淀 Agent 提取饮食信息，写入 `precipitation_records`
4. 置信度 ≥ 0.95：自动写入 `diet_records`
5. 写入 `timelines`（event_type=diet）
6. 更新 `chat_messages` 的 `precipitation_status=1`

### 6.2 用户说"今天体重 58 斤"

1. 写入 `chat_messages`
2. 信息沉淀 Agent 提取体重，写入 `precipitation_records` 和 `body_records`
3. 更新 `user_profiles.current_weight`
4. 检测是否达到里程碑（如减 5 斤），写入 `milestones` 和 `timelines`
5. 更新聊天消息沉淀状态
