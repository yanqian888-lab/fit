/**
 * SQLite 数据库连接与初始化
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { DEFAULT_USER_AGREEMENT, DEFAULT_PRIVACY_POLICY, DEFAULT_ABOUT_US } = require('./config/policies');
const promptDefaults = require('./config/promptDefaults');
const { safeJsonParse } = require('./utils/safeJson');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.db.path);

// 启用外键约束与 WAL，设置 busy_timeout 避免并发访问时 SQLITE_BUSY
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/**
 * 初始化数据库表
 */
function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id VARCHAR(16) UNIQUE DEFAULT NULL,
      openid VARCHAR(64) UNIQUE DEFAULT NULL,
      unionid VARCHAR(64) DEFAULT NULL,
      username VARCHAR(16) UNIQUE DEFAULT NULL,
      password_hash VARCHAR(255) DEFAULT NULL,
      nickname VARCHAR(64) DEFAULT '掉秤搭搭用户',
      avatar_url VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      gender TINYINT DEFAULT 0,
      age TINYINT DEFAULT NULL,
      birth_date DATE DEFAULT NULL,
      height DECIMAL(5,2) DEFAULT NULL,
      role VARCHAR(16) DEFAULT 'user',
      status TINYINT DEFAULT 1,
      source VARCHAR(16) DEFAULT 'app',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME DEFAULT NULL
    );

    -- 清理历史重复手机号，确保 phone 唯一索引可创建（保留最早注册用户）
    UPDATE users SET phone = NULL WHERE id NOT IN (
      SELECT MIN(id) FROM users WHERE phone IS NOT NULL AND phone != '' GROUP BY phone
    ) AND phone IS NOT NULL AND phone != '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_unionid ON users(unionid);

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      initial_weight DECIMAL(6,2) DEFAULT NULL,
      current_weight DECIMAL(6,2) DEFAULT NULL,
      target_weight DECIMAL(6,2) DEFAULT NULL,
      target_date DATE DEFAULT NULL,
      bmr DECIMAL(8,2) DEFAULT NULL,
      daily_calorie_target DECIMAL(8,2) DEFAULT NULL,
      calorie_deficit DECIMAL(6,2) DEFAULT 500,
      dietary_taboos VARCHAR(255) DEFAULT NULL,
      preferences VARCHAR(255) DEFAULT NULL,
      quiet_hours_start VARCHAR(8) DEFAULT '22:00',
      quiet_hours_end VARCHAR(8) DEFAULT '08:00',
      water_goal INTEGER DEFAULT 2000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      name VARCHAR(32) DEFAULT '你的搭子',
      gender TINYINT DEFAULT 2,
      avatar_url VARCHAR(255) DEFAULT NULL,
      mode VARCHAR(16) DEFAULT 'gentle',
      voice_speed TINYINT DEFAULT 5,
      strictness TINYINT DEFAULT 5,
      humor TINYINT DEFAULT 5,
      status VARCHAR(16) DEFAULT 'awake',
      status_text VARCHAR(32) DEFAULT '刚刚起床',
      status_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role VARCHAR(16) NOT NULL,
      content TEXT NOT NULL,
      content_type VARCHAR(16) DEFAULT 'text',
      media_url VARCHAR(255) DEFAULT NULL,
      precipitation_status TINYINT DEFAULT 0,
      precipitation_id INTEGER DEFAULT NULL,
      precipitation_type VARCHAR(32) DEFAULT NULL,
      mode VARCHAR(16) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_messages(user_id, created_at);

    CREATE TABLE IF NOT EXISTS precipitation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      chat_id INTEGER DEFAULT NULL,
      type VARCHAR(32) NOT NULL,
      sub_type VARCHAR(32) DEFAULT NULL,
      content TEXT NOT NULL,
      extracted_data TEXT DEFAULT NULL,
      confidence DECIMAL(3,2) DEFAULT 0,
      status TINYINT DEFAULT 0,
      source TINYINT DEFAULT 0,
      tags VARCHAR(255) DEFAULT NULL,
      remark VARCHAR(255) DEFAULT NULL,
      sync_status TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (chat_id) REFERENCES chat_messages(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_precipitation_user ON precipitation_records(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_precipitation_type ON precipitation_records(user_id, type, status);

    -- ==================== 宠物陪伴系统 ====================
    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      species VARCHAR(32) DEFAULT 'red_panda',
      name VARCHAR(64) DEFAULT '搭搭',
      level INTEGER DEFAULT 1,
      skin_id VARCHAR(64) DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pets_user ON pets(user_id);

    CREATE TABLE IF NOT EXISTS pet_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      mood INTEGER DEFAULT 80,
      satiety INTEGER DEFAULT 80,
      location VARCHAR(16) DEFAULT 'home',
      state_key VARCHAR(32) DEFAULT 'idle',
      daily_interact_count INTEGER DEFAULT 0,
      daily_feed_count INTEGER DEFAULT 0,
      daily_exercise_count INTEGER DEFAULT 0,
      last_feed_at DATETIME,
      last_interact_at DATETIME,
      last_exercise_at DATETIME,
      last_explore_at DATETIME,
      last_decay_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      current_state_key VARCHAR(32) DEFAULT NULL,
      state_expires_at DATETIME DEFAULT NULL,
      buff_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pet_states_user ON pet_states(user_id);

    CREATE TABLE IF NOT EXISTS pet_skins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_id VARCHAR(64) NOT NULL UNIQUE,
      species VARCHAR(32) DEFAULT 'red_panda',
      name VARCHAR(64) NOT NULL,
      icon_url VARCHAR(255),
      lottie_url VARCHAR(255),
      gif_url VARCHAR(255),
      static_url VARCHAR(255),
      unlock_condition TEXT,
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pet_states_lib (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state_key VARCHAR(32) NOT NULL UNIQUE,
      name VARCHAR(64),
      lottie_url VARCHAR(255),
      gif_url VARCHAR(255),
      static_url VARCHAR(255),
      frames_json TEXT,
      frame_rate INTEGER DEFAULT 2,
      pos_x INTEGER,
      pos_y INTEGER,
      width INTEGER,
      height INTEGER,
      scene_key VARCHAR(32),
      time_ranges TEXT,
      mood_range TEXT,
      duration_minutes INTEGER DEFAULT 30,
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pet_exercise_lib (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_key VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(64) NOT NULL,
      use_equipment TINYINT DEFAULT 0,
      equipment_item_id INTEGER DEFAULT NULL,
      anim_url VARCHAR(255) DEFAULT NULL,
      has_workout TINYINT DEFAULT 0,
      workout_key VARCHAR(64) DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pet_dialogues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene VARCHAR(64) NOT NULL,
      text TEXT NOT NULL,
      weight INTEGER DEFAULT 1,
      probability DECIMAL(3,2) DEFAULT 1.00,
      is_enabled TINYINT DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_pet_dialogues_scene ON pet_dialogues(scene, is_enabled);

    CREATE TABLE IF NOT EXISTS pet_explorations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_at DATETIME,
      duration_seconds INTEGER DEFAULT 1800,
      event_id INTEGER,
      status VARCHAR(16) DEFAULT 'ongoing',
      reward_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pet_explorations_user ON pet_explorations(user_id, status);

    -- ==================== 货币经济系统 ====================
    CREATE TABLE IF NOT EXISTS user_currency (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      berries INTEGER DEFAULT 0,
      flowers INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_currency_user ON user_currency(user_id);

    CREATE TABLE IF NOT EXISTS currency_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      currency_type VARCHAR(16) NOT NULL,
      amount INTEGER NOT NULL,
      type VARCHAR(32) NOT NULL,
      source VARCHAR(64),
      related_id INTEGER,
      balance_after INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_currency_tx_user ON currency_transactions(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_currency_tx_type ON currency_transactions(user_id, currency_type, type, created_at);

    -- ==================== 商城与背包 ====================
    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category VARCHAR(32) NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      icon_url VARCHAR(255),
      price_berries INTEGER DEFAULT 0,
      price_flowers INTEGER DEFAULT 0,
      stock INTEGER DEFAULT -1,
      item_type VARCHAR(32),
      effect_json TEXT,
      unlock_condition TEXT,
      duration_seconds INTEGER,
      sort_order INTEGER DEFAULT 0,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category, status, sort_order);

    CREATE TABLE IF NOT EXISTS user_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_item_id INTEGER,
      category VARCHAR(32) NOT NULL,
      name VARCHAR(128),
      icon_url VARCHAR(255),
      quantity INTEGER DEFAULT 1,
      effect_json TEXT,
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shop_item_id) REFERENCES shop_items(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_user ON user_inventory(user_id, category);

    -- 合并用户背包中同一商品的重复记录，确保唯一索引可创建
    DELETE FROM user_inventory WHERE id NOT IN (
      SELECT MIN(id) FROM user_inventory WHERE shop_item_id IS NOT NULL GROUP BY user_id, shop_item_id
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_item ON user_inventory(user_id, shop_item_id)
      WHERE shop_item_id IS NOT NULL;

    -- ==================== 事件系统 ====================
    CREATE TABLE IF NOT EXISTS pet_events_lib (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key VARCHAR(64) NOT NULL UNIQUE,
      type VARCHAR(32) NOT NULL,
      title VARCHAR(128),
      content TEXT,
      image_url VARCHAR(255),
      rarity VARCHAR(16) DEFAULT 'common',
      region VARCHAR(64),
      drop_rate DECIMAL(5,4) DEFAULT 0.1000,
      unlock_condition TEXT,
      reward_json TEXT,
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_pet_events_type ON pet_events_lib(type, is_enabled, rarity);

    -- 事件集表：事件按集合分组（如 消除多巴胺/小确幸），后台可 CRUD，App 相册 tab 同源
    CREATE TABLE IF NOT EXISTS event_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coll_key VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(64) NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 事件照片表：同一事件可配置多张照片，掉落时随机一张，不同照片算不同收集项
    CREATE TABLE IF NOT EXISTS pet_event_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      photo_url VARCHAR(255) NOT NULL,
      is_enabled TINYINT DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES pet_events_lib(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pet_event_photos_event ON pet_event_photos(event_id, is_enabled, sort_order);

    CREATE TABLE IF NOT EXISTS user_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      photo_id INTEGER DEFAULT 0,
      is_new TINYINT DEFAULT 1,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES pet_events_lib(id) ON DELETE CASCADE,
      UNIQUE(user_id, event_id, photo_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, unlocked_at);

    -- ==================== 任务与签到 ====================
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL,
      type VARCHAR(32) NOT NULL,
      description TEXT,
      condition_json TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type, status, sort_order);

    CREATE TABLE IF NOT EXISTS user_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      progress_json TEXT DEFAULT '{}',
      status TINYINT DEFAULT 0,
      completed_at DATETIME,
      claimed_at DATETIME,
      cycle_key VARCHAR(32),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(user_id, task_id, cycle_key)
    );

    CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON user_tasks(user_id, status);

    CREATE TABLE IF NOT EXISTS checkins (
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

    CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id, checkin_date);

    -- ==================== 成就与里程碑 ====================
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL,
      category VARCHAR(32) NOT NULL,
      description TEXT,
      condition_json TEXT,
      reward_berries INTEGER DEFAULT 0,
      reward_flowers INTEGER DEFAULT 0,
      badge_icon VARCHAR(255),
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category, is_enabled, sort_order);

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      UNIQUE(user_id, achievement_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, unlocked_at);

    -- 新手任务
    CREATE TABLE IF NOT EXISTS user_newbie_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_key VARCHAR(32) NOT NULL,
      title VARCHAR(128) NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      status VARCHAR(16) DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'claimed')),
      reward_berries INTEGER DEFAULT 20,
      completed_at DATETIME DEFAULT NULL,
      claimed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, task_key)
    );
    CREATE INDEX IF NOT EXISTS idx_user_newbie_tasks_user ON user_newbie_tasks(user_id, status, sort_order);

    CREATE TABLE IF NOT EXISTS diet_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      precipitation_id INTEGER DEFAULT NULL,
      record_date DATE NOT NULL,
      meal_time VARCHAR(16) NOT NULL,
      foods TEXT NOT NULL,
      total_calorie DECIMAL(8,2) DEFAULT 0,
      total_protein DECIMAL(6,2) DEFAULT 0,
      total_carb DECIMAL(6,2) DEFAULT 0,
      total_fat DECIMAL(6,2) DEFAULT 0,
      tags VARCHAR(255) DEFAULT NULL,
      remark VARCHAR(255) DEFAULT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_diet_user_date ON diet_records(user_id, record_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_diet_user_precipitation ON diet_records(user_id, precipitation_id);

    CREATE TABLE IF NOT EXISTS exercise_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      precipitation_id INTEGER DEFAULT NULL,
      record_date DATE NOT NULL,
      exercise_type VARCHAR(16) NOT NULL,
      exercises TEXT NOT NULL,
      total_duration INT DEFAULT 0,
      total_calorie DECIMAL(8,2) DEFAULT 0,
      is_workout TINYINT DEFAULT 0,
      source VARCHAR(16) DEFAULT NULL,
      workout_key VARCHAR(32) DEFAULT NULL,
      video_url VARCHAR(255) DEFAULT NULL,
      remark VARCHAR(255) DEFAULT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_records(user_id, record_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_user_precipitation ON exercise_records(user_id, precipitation_id);

    -- 陪你动课程库
    CREATE TABLE IF NOT EXISTS workout_lib (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_key VARCHAR(32) NOT NULL UNIQUE,
      name VARCHAR(128) NOT NULL,
      category VARCHAR(32) DEFAULT 'aerobic',
      video_url VARCHAR(255) DEFAULT NULL,
      cover_url VARCHAR(255) DEFAULT NULL,
      duration_seconds INTEGER DEFAULT 0,
      calorie_per_session DECIMAL(8,2) DEFAULT 0,
      required_equipment_key VARCHAR(32) DEFAULT NULL,
      description TEXT DEFAULT NULL,
      sort_order INTEGER DEFAULT 0,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_workout_status ON workout_lib(status, sort_order);

    CREATE TABLE IF NOT EXISTS body_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      precipitation_id INTEGER DEFAULT NULL,
      record_date DATE NOT NULL,
      type VARCHAR(16) NOT NULL,
      value DECIMAL(6,2) NOT NULL,
      unit VARCHAR(8) NOT NULL,
      weight DECIMAL(8,2) DEFAULT NULL,
      waist DECIMAL(8,2) DEFAULT NULL,
      thigh DECIMAL(8,2) DEFAULT NULL,
      hip DECIMAL(8,2) DEFAULT NULL,
      arm DECIMAL(8,2) DEFAULT NULL,
      body_fat_rate DECIMAL(8,2) DEFAULT NULL,
      muscle_mass DECIMAL(8,2) DEFAULT NULL,
      visceral_fat_level INTEGER DEFAULT NULL,
      basal_metabolism INTEGER DEFAULT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_body_user_date ON body_records(user_id, record_date);
    -- 清理历史重复的身体记录，确保唯一索引可创建（保留 id 最小记录）
    DELETE FROM body_records WHERE id NOT IN (
      SELECT MIN(id) FROM body_records GROUP BY user_id, record_date, type
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_body_unique ON body_records(user_id, record_date, type);

    CREATE TABLE IF NOT EXISTS habit_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      precipitation_id INTEGER DEFAULT NULL,
      record_date DATE NOT NULL,
      type VARCHAR(16) NOT NULL,
      value DECIMAL(8,2) DEFAULT 0,
      unit VARCHAR(16) DEFAULT NULL,
      remark VARCHAR(255) DEFAULT NULL,
      water_ml INTEGER DEFAULT 0,
      has_diet_record INTEGER DEFAULT 0,
      has_exercise INTEGER DEFAULT 0,
      rejected_food INTEGER DEFAULT 0,
      no_late_night INTEGER DEFAULT 0,
      weight DECIMAL(8,2) DEFAULT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_habit_user_date ON habit_records(user_id, record_date);
    -- 清理历史重复的习惯记录，确保唯一索引可创建（保留 id 最小记录）
    DELETE FROM habit_records WHERE id NOT IN (
      SELECT MIN(id) FROM habit_records GROUP BY user_id, record_date, type
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_unique ON habit_records(user_id, record_date, type);

    -- ==================== 轻断食记录 ====================
    CREATE TABLE IF NOT EXISTS fasting_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      record_date DATE NOT NULL,
      mode VARCHAR(32) NOT NULL,
      target_hours INTEGER DEFAULT 16,
      eating_window_start TIME DEFAULT NULL,
      eating_window_end TIME DEFAULT NULL,
      status VARCHAR(16) DEFAULT 'planned',
      started_at DATETIME DEFAULT NULL,
      actual_hours INTEGER DEFAULT 0,
      note TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fasting_user_date ON fasting_records(user_id, record_date);

    CREATE TABLE IF NOT EXISTS museum_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      chat_message_id INTEGER DEFAULT NULL,
      type VARCHAR(32) NOT NULL,
      sub_type VARCHAR(32) DEFAULT NULL,
      content TEXT NOT NULL,
      extracted_data TEXT DEFAULT NULL,
      author VARCHAR(16) DEFAULT 'user',
      emotion VARCHAR(16) DEFAULT NULL,
      scene VARCHAR(16) DEFAULT NULL,
      effectiveness TINYINT DEFAULT NULL,
      is_favorite TINYINT DEFAULT 0,
      tags VARCHAR(255) DEFAULT NULL,
      record_date DATE DEFAULT NULL,
      status TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (chat_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_museum_user_type ON museum_items(user_id, type, created_at);

    -- 注意：idx_museum_user_type_title 依赖 title 列（由迁移补充），在迁移阶段创建，
    -- 否则全新库执行 initTables 时会因 title 列不存在而报错

    -- 清理日记/心情重复记录，确保同日同用户同子类型唯一
    DELETE FROM museum_items WHERE status = 1 AND sub_type IN ('daily_diary', 'mood') AND id NOT IN (
      SELECT MIN(id) FROM museum_items
      WHERE status = 1 AND sub_type IN ('daily_diary', 'mood') AND record_date IS NOT NULL
      GROUP BY user_id, sub_type, record_date
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_museum_diary_unique
      ON museum_items(user_id, sub_type, record_date)
      WHERE sub_type IN ('daily_diary', 'mood') AND status = 1;
    CREATE INDEX IF NOT EXISTS idx_museum_user_type_subtype ON museum_items(user_id, type, sub_type, created_at);

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type VARCHAR(32) NOT NULL,
      title VARCHAR(128) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      value DECIMAL(8,2) DEFAULT NULL,
      unit VARCHAR(16) DEFAULT NULL,
      icon VARCHAR(32) DEFAULT NULL,
      achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_milestone_user ON milestones(user_id, achieved_at);

    CREATE TABLE IF NOT EXISTS timelines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type VARCHAR(32) NOT NULL,
      title VARCHAR(128) NOT NULL,
      content TEXT DEFAULT NULL,
      related_id INTEGER DEFAULT NULL,
      related_type VARCHAR(32) DEFAULT NULL,
      event_date DATE NOT NULL,
      is_important TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_user_date ON timelines(user_id, event_date DESC);
    CREATE INDEX IF NOT EXISTS idx_timeline_type ON timelines(user_id, event_type, event_date DESC);

    CREATE TABLE IF NOT EXISTS food_db (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER UNIQUE NOT NULL,
      category VARCHAR(32) NOT NULL,
      sub_category VARCHAR(32) NOT NULL,
      food_name VARCHAR(128) NOT NULL,
      calories_per_100g DECIMAL(8,2) NOT NULL,
      common_unit VARCHAR(128),
      edible_rate DECIMAL(3,2) DEFAULT 1.0,
      remark TEXT,
      protein_per_100g DECIMAL(6,2) DEFAULT 0,
      carb_per_100g DECIMAL(6,2) DEFAULT 0,
      fat_per_100g DECIMAL(6,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_food_name ON food_db(food_name);
    CREATE INDEX IF NOT EXISTS idx_food_category ON food_db(category);

    CREATE TABLE IF NOT EXISTS exercise_db (
      id INTEGER PRIMARY KEY,
      exercise_name VARCHAR(64) NOT NULL,
      category VARCHAR(32) DEFAULT NULL,
      sub_category VARCHAR(32) DEFAULT NULL,
      intensity_desc VARCHAR(64) DEFAULT NULL,
      met_value DECIMAL(5,2) DEFAULT 0,
      calorie_per_hour DECIMAL(8,2) DEFAULT 0,
      remark VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_exercise_name ON exercise_db(exercise_name);

    CREATE TABLE IF NOT EXISTS favorite_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      food_id INTEGER NOT NULL,
      is_common TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fav_food_user ON favorite_foods(user_id, created_at);

    CREATE TABLE IF NOT EXISTS favorite_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      is_common TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fav_exercise_user ON favorite_exercises(user_id, created_at);

    CREATE TABLE IF NOT EXISTS custom_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name VARCHAR(64) NOT NULL,
      category VARCHAR(32) DEFAULT NULL,
      calorie_per_100g DECIMAL(8,2) DEFAULT 0,
      protein_per_100g DECIMAL(6,2) DEFAULT 0,
      carb_per_100g DECIMAL(6,2) DEFAULT 0,
      fat_per_100g DECIMAL(6,2) DEFAULT 0,
      fiber_per_100g DECIMAL(6,2) DEFAULT 0,
      gi DECIMAL(5,2) DEFAULT NULL,
      unit VARCHAR(32) DEFAULT 'g',
      is_public TINYINT DEFAULT 0,
      status VARCHAR(16) DEFAULT 'approved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_custom_food_user ON custom_foods(user_id, name);

    CREATE TABLE IF NOT EXISTS custom_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name VARCHAR(64) NOT NULL,
      type VARCHAR(16) NOT NULL,
      calorie_per_hour DECIMAL(8,2) DEFAULT 0,
      intensity VARCHAR(16) DEFAULT 'moderate',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_custom_exercise_user ON custom_exercises(user_id, name);

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      url VARCHAR(255) NOT NULL,
      angle VARCHAR(16) DEFAULT 'front',
      weight DECIMAL(6,2) DEFAULT NULL,
      description VARCHAR(255) DEFAULT NULL,
      record_date DATE DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_photo_user_date ON photos(user_id, record_date DESC);

    CREATE TABLE IF NOT EXISTS user_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title VARCHAR(128) NOT NULL,
      content TEXT DEFAULT NULL,
      category VARCHAR(32) DEFAULT NULL,
      effectiveness TINYINT DEFAULT 1,
      is_favorite TINYINT DEFAULT 0,
      tags VARCHAR(255) DEFAULT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_method_user ON user_methods(user_id, created_at);

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type VARCHAR(32) DEFAULT 'other',
      content TEXT NOT NULL,
      images TEXT DEFAULT NULL,
      contact VARCHAR(64) DEFAULT NULL,
      status VARCHAR(16) DEFAULT 'pending',
      score TINYINT DEFAULT NULL,
      reply TEXT DEFAULT NULL,
      replied_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id, created_at);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      notification_enabled TINYINT DEFAULT 1,
      reminder_weight TINYINT DEFAULT 1,
      reminder_water TINYINT DEFAULT 1,
      reminder_exercise TINYINT DEFAULT 1,
      dnd_start TIME DEFAULT '22:00:00',
      dnd_end TIME DEFAULT '08:00:00',
      theme VARCHAR(16) DEFAULT 'light',
      font_size VARCHAR(16) DEFAULT 'medium',
      data_storage VARCHAR(16) DEFAULT 'local',
      cloud_backup_enabled TINYINT DEFAULT 0,
      guide_completed TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 应用全局配置表（用户协议、隐私政策、开关等）
    CREATE TABLE IF NOT EXISTS app_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key VARCHAR(64) UNIQUE NOT NULL,
      config_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 模板消息配置表（CMS后台配置，预留）
    CREATE TABLE IF NOT EXISTS template_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_type VARCHAR(32) NOT NULL, -- breakfast/lunch/dinner/exercise/wakeup
      mode VARCHAR(16) NOT NULL, -- gentle/strict/tease
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 模板消息发送记录
    CREATE TABLE IF NOT EXISTS template_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_type VARCHAR(32) NOT NULL, -- breakfast/lunch/dinner/exercise/wakeup
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read TINYINT DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_template_user_type ON template_messages(user_id, template_type, sent_at);

    -- 用户消息互动统计（用于判断是否需要发送模板消息）
    CREATE TABLE IF NOT EXISTS user_chat_stats (
      user_id INTEGER PRIMARY KEY,
      last_message_at DATETIME,
      consecutive_unread INTEGER DEFAULT 0,
      today_message_count INTEGER DEFAULT 0,
      today_exercise_mentioned TINYINT DEFAULT 0,
      last_active_date DATE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- CMS 管理员账号表
    CREATE TABLE IF NOT EXISTS cms_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(32) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      nickname VARCHAR(64) DEFAULT '',
      role_id INTEGER NOT NULL,
      status TINYINT DEFAULT 1,
      last_login_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES cms_roles(id)
    );

    -- CMS 角色与权限表
    CREATE TABLE IF NOT EXISTS cms_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(32) UNIQUE NOT NULL,
      description VARCHAR(255) DEFAULT '',
      permissions TEXT NOT NULL,
      is_system TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- CMS 操作日志表
    CREATE TABLE IF NOT EXISTS cms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cms_user_id INTEGER NOT NULL,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(32) DEFAULT '',
      target_id VARCHAR(64) DEFAULT '',
      detail TEXT DEFAULT '',
      ip VARCHAR(64) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cms_user_id) REFERENCES cms_users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_cms_logs_user ON cms_logs(cms_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_cms_logs_action ON cms_logs(action, created_at);

    -- AI 配置表
    CREATE TABLE IF NOT EXISTS ai_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(64) NOT NULL,
      provider VARCHAR(32) DEFAULT 'doubao',
      base_url VARCHAR(255) DEFAULT 'https://ark.cn-beijing.volces.com/api/v3',
      api_key VARCHAR(255) NOT NULL,
      endpoint_id VARCHAR(64) NOT NULL,
      temperature DECIMAL(3,2) DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 500,
      timeout_ms INTEGER DEFAULT 30000,
      role VARCHAR(16) DEFAULT 'primary' CHECK(role IN ('primary', 'backup')),
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_configs_role_sort ON ai_configs(role, sort_order);

    -- AI Prompt 版本管理表
    CREATE TABLE IF NOT EXISTS ai_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_key VARCHAR(64) NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      ai_config_id INTEGER DEFAULT NULL REFERENCES ai_configs(id),
      is_enabled TINYINT DEFAULT 1,
      is_latest TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(prompt_key, version)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_prompts_key_version ON ai_prompts(prompt_key, version);

    -- 里程碑文案模板表
    CREATE TABLE IF NOT EXISTS milestone_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type VARCHAR(32) NOT NULL,
      value DECIMAL(6,2) DEFAULT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_enabled TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_milestone_templates_type ON milestone_templates(type, is_enabled, value, sort_order);

    -- 弹窗广告配置表
    CREATE TABLE IF NOT EXISTS popups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(64) NOT NULL,
      style VARCHAR(16) NOT NULL CHECK(style IN ('center', 'top')),
      type VARCHAR(16) NOT NULL CHECK(type IN ('system', 'operational', 'version', 'activity')),
      status VARCHAR(16) NOT NULL CHECK(status IN ('draft', 'enabled', 'disabled')),
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      priority INTEGER DEFAULT 5,
      image_url TEXT NOT NULL,
      title VARCHAR(255) DEFAULT '',
      content TEXT DEFAULT '',
      show_close_button TINYINT DEFAULT 1,
      mask_closeable TINYINT DEFAULT 1,
      jump_type VARCHAR(16) NOT NULL CHECK(jump_type IN ('none', 'internal', 'h5')),
      jump_route_id INTEGER DEFAULT NULL REFERENCES app_routes(id),
      jump_url TEXT DEFAULT '',
      jump_params TEXT DEFAULT '{}',
      scope_type VARCHAR(16) NOT NULL CHECK(scope_type IN ('global', 'specific')),
      scope_pages TEXT DEFAULT '[]',
      excluded_pages TEXT DEFAULT '[]',
      trigger_type VARCHAR(16) NOT NULL CHECK(trigger_type IN ('immediate', 'duration', 'back', 'cold_start', 'operation')),
      trigger_delay_seconds INTEGER DEFAULT 0,
      frequency_period VARCHAR(16) DEFAULT 'day' CHECK(frequency_period IN ('day', 'week', 'forever')),
      frequency_max INTEGER DEFAULT 1,
      one_time TINYINT DEFAULT 0,
      wifi_only TINYINT DEFAULT 0,
      version_min VARCHAR(32) DEFAULT '',
      version_max VARCHAR(32) DEFAULT '',
      os_type TEXT DEFAULT '["ios","android","h5","mp-weixin"]',
      target_users TEXT DEFAULT '[]',
      sort_order INTEGER DEFAULT 0,
      created_by VARCHAR(64) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_popups_status_time ON popups(status, start_time, end_time, priority);

    -- 外部 H5 域名白名单表
    CREATE TABLE IF NOT EXISTS h5_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain VARCHAR(255) NOT NULL UNIQUE,
      status VARCHAR(16) DEFAULT 'enabled' CHECK(status IN ('enabled', 'disabled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 站内路由字典表
    CREATE TABLE IF NOT EXISTS app_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_key VARCHAR(64) NOT NULL UNIQUE,
      route_name VARCHAR(128) NOT NULL,
      path VARCHAR(255) DEFAULT '',
      params_schema TEXT DEFAULT '{}',
      status VARCHAR(16) DEFAULT 'enabled' CHECK(status IN ('enabled', 'disabled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 弹窗埋点事件日志表
    CREATE TABLE IF NOT EXISTS popup_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      popup_id INTEGER NOT NULL REFERENCES popups(id),
      user_id INTEGER DEFAULT NULL REFERENCES users(id),
      device_id VARCHAR(64) DEFAULT '',
      page VARCHAR(128) DEFAULT '',
      event_type VARCHAR(16) NOT NULL CHECK(event_type IN ('show', 'click', 'close')),
      trigger VARCHAR(32) DEFAULT '',
      close_way VARCHAR(16) DEFAULT '',
      app_version VARCHAR(32) DEFAULT '',
      os_type VARCHAR(16) DEFAULT '',
      event_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_popup_events_popup ON popup_events(popup_id, event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_popup_events_user ON popup_events(user_id, created_at);

    -- 弹窗每日统计聚合表
    CREATE TABLE IF NOT EXISTS popup_daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      popup_id INTEGER NOT NULL,
      shows INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      closes INTEGER DEFAULT 0,
      close_btn INTEGER DEFAULT 0,
      mask INTEGER DEFAULT 0,
      back INTEGER DEFAULT 0,
      swipe INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, popup_id)
    );
    CREATE INDEX IF NOT EXISTS idx_popup_daily_stats_date ON popup_daily_stats(date, popup_id);

    -- 弹窗用户/设备级频次统计表（服务端频次控制）
    CREATE TABLE IF NOT EXISTS popup_user_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      popup_id INTEGER NOT NULL REFERENCES popups(id) ON DELETE CASCADE,
      identifier VARCHAR(128) NOT NULL,
      identifier_type VARCHAR(16) NOT NULL CHECK(identifier_type IN ('user', 'device')),
      show_count INTEGER DEFAULT 0,
      click_count INTEGER DEFAULT 0,
      close_count INTEGER DEFAULT 0,
      first_show_at DATETIME DEFAULT NULL,
      last_show_at DATETIME DEFAULT NULL,
      last_click_at DATETIME DEFAULT NULL,
      last_close_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(popup_id, identifier, identifier_type)
    );
    CREATE INDEX IF NOT EXISTS idx_popup_user_stats_identifier ON popup_user_stats(identifier_type, identifier, popup_id);

    -- 站内公告配置表
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(255) NOT NULL,
      content TEXT DEFAULT '',
      type VARCHAR(32) NOT NULL CHECK(type IN ('banner', 'notice', 'fullscreen', 'message')),
      position VARCHAR(64) DEFAULT 'home',
      target_type VARCHAR(32) NOT NULL CHECK(target_type IN ('all', 'specified_users', 'segments')),
      target_users TEXT DEFAULT '[]',
      segments TEXT DEFAULT '[]',
      status VARCHAR(16) NOT NULL CHECK(status IN ('draft', 'enabled', 'disabled')),
      priority INTEGER DEFAULT 5,
      image_url TEXT DEFAULT '',
      background_color VARCHAR(16) DEFAULT '',
      text_color VARCHAR(16) DEFAULT '',
      jump_type VARCHAR(16) NOT NULL CHECK(jump_type IN ('none', 'internal', 'h5')),
      jump_route_id INTEGER DEFAULT NULL REFERENCES app_routes(id),
      jump_url TEXT DEFAULT '',
      jump_params TEXT DEFAULT '{}',
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      version_min VARCHAR(32) DEFAULT '',
      version_max VARCHAR(32) DEFAULT '',
      os_type TEXT DEFAULT '["ios","android","h5","mp-weixin"]',
      max_show_count INTEGER DEFAULT 0,
      dismissible TINYINT DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_by VARCHAR(64) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_announcements_status_time ON announcements(status, start_time, end_time, priority);
    CREATE INDEX IF NOT EXISTS idx_announcements_position ON announcements(position, status, priority);

    -- 用户公告阅读/曝光记录表（同时作为站内消息收件箱）
    CREATE TABLE IF NOT EXISTS user_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      status VARCHAR(16) DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'clicked')),
      first_show_at DATETIME DEFAULT NULL,
      last_show_at DATETIME DEFAULT NULL,
      click_at DATETIME DEFAULT NULL,
      show_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, announcement_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_announcements_user ON user_announcements(user_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_user_announcements_announcement ON user_announcements(announcement_id, status);

    -- 通知渠道配置表（预留站内信/推送/SMS/微信订阅消息抽象）
    CREATE TABLE IF NOT EXISTS notification_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_key VARCHAR(32) NOT NULL UNIQUE,
      channel_name VARCHAR(64) NOT NULL,
      is_enabled TINYINT DEFAULT 1,
      config TEXT DEFAULT '{}',
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notification_channels_key ON notification_channels(channel_key, is_enabled);

    -- 已注销用户日志表（审计用途，记录注销时间和关键信息，不保留业务数据）
    CREATE TABLE IF NOT EXISTS deleted_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_user_id INTEGER NOT NULL,
      username VARCHAR(16) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      openid VARCHAR(64) DEFAULT NULL,
      reason VARCHAR(255) DEFAULT NULL,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_deleted_users_phone ON deleted_users(phone);
    CREATE INDEX IF NOT EXISTS idx_deleted_users_original_id ON deleted_users(original_user_id);

    CREATE TABLE IF NOT EXISTS system_meta (
      key VARCHAR(64) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/**
 * 数据库迁移（轻量版，兼容已有数据库）
 */
function migrateTables() {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN birth_date DATE DEFAULT NULL;`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 新增用户角色字段
  try {
    db.exec(`ALTER TABLE users ADD COLUMN role VARCHAR(16) DEFAULT 'user';`);
    // 默认将第一个注册用户设为管理员，便于管理后台使用
    db.exec(`UPDATE users SET role = 'admin' WHERE id = 1;`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 为 food_db 补充三大营养素字段
  try {
    db.exec(`ALTER TABLE food_db ADD COLUMN protein_per_100g DECIMAL(6,2) DEFAULT 0;`);
    db.exec(`ALTER TABLE food_db ADD COLUMN carb_per_100g DECIMAL(6,2) DEFAULT 0;`);
    db.exec(`ALTER TABLE food_db ADD COLUMN fat_per_100g DECIMAL(6,2) DEFAULT 0;`);
  } catch (err) {
    // 列已存在时忽略
  }
  // 根据已有年龄回填出生日期（生日取当年同日）
  try {
    db.exec(`
      UPDATE users
      SET birth_date = date('now', '-' || CAST(age AS TEXT) || ' years')
      WHERE age IS NOT NULL AND birth_date IS NULL;
    `);
  } catch (err) {
    console.error('出生日期回填失败:', err.message);
  }
  // 新增 TDEE 字段
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN tdee DECIMAL(8,2) DEFAULT NULL;`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 新增减重建议待生成标记（首次完善资料/更新身体信息后进入聊聊页时触发）
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN advice_pending INTEGER DEFAULT 0;`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 运动时段配置迁移：pet_exercise_time 由单时段 {start,end,options} 迁为多时段 {windows:[...]}
  // 运动选项迁移到 pet_exercise_lib 独立配置
  try {
    const row = db.prepare("SELECT config_value FROM app_configs WHERE config_key = 'pet_exercise_time'").get();
    if (row && row.config_value) {
      const cfg = JSON.parse(row.config_value);
      if (!Array.isArray(cfg.windows) && (cfg.start || cfg.end)) {
        const migrated = { windows: [{ key: 'default', start: cfg.start || '19:30', end: cfg.end || '21:00' }] };
        db.prepare("UPDATE app_configs SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = 'pet_exercise_time'")
          .run(JSON.stringify(migrated));
        console.log('[迁移] pet_exercise_time 已升级为多时段结构');
      }
    }
  } catch (err) {
    console.error('pet_exercise_time 迁移失败:', err.message);
  }

  // 事件系统升级：pet_events_lib 增加 概率权重weight(0-10)/必要条件required_item_id/地点location
  try {
    db.exec(`ALTER TABLE pet_events_lib ADD COLUMN weight INTEGER DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  try {
    db.exec(`ALTER TABLE pet_events_lib ADD COLUMN required_item_id INTEGER DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  try {
    db.exec(`ALTER TABLE pet_events_lib ADD COLUMN location VARCHAR(16) DEFAULT 'explore';`);
  } catch (err) { /* 列已存在时忽略 */ }
  // 外出时长改为按事件配置（分钟，仅 location=explore 的事件需要）
  try {
    db.exec(`ALTER TABLE pet_events_lib ADD COLUMN explore_minutes INTEGER DEFAULT NULL;`);
    db.exec(`UPDATE pet_events_lib SET explore_minutes = 120 WHERE location = 'explore' AND explore_minutes IS NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  // 旧 drop_rate(0-1) 迁移为 weight(0-10)：weight = max(1, round(drop_rate*10))
  try {
    db.exec(`UPDATE pet_events_lib SET weight = MAX(1, MIN(10, ROUND(drop_rate * 10))) WHERE weight IS NULL;`);
  } catch (err) {
    console.error('事件 weight 迁移失败:', err.message);
  }
  // 事件优先掉落有效期（日期范围，NULL=不参与优先掉落；有效期内进搭搭tab必优先掉落，占每日额度）
  try {
    db.exec(`ALTER TABLE pet_events_lib ADD COLUMN priority_start_date DATE DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  try {
    db.exec(`ALTER TABLE pet_events_lib ADD COLUMN priority_end_date DATE DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  // 当天已优先掉落的事件 id 列表（JSON：{date, event_ids}，跨天自动失效）
  try {
    db.exec(`ALTER TABLE pet_states ADD COLUMN priority_drops_json TEXT DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  // 事件集不再由代码预置种子，全部通过 CMS 事件配置维护（后台清空即为空）
  // 居家事件掉落日期（用于每天最多一次居家事件）
  try {
    db.exec(`ALTER TABLE pet_states ADD COLUMN last_home_event_at DATETIME DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  // 每日事件掉落计数（home+explore 合计，按东八区日期重置）
  try {
    db.exec(`ALTER TABLE pet_states ADD COLUMN daily_event_count INTEGER DEFAULT 0;`);
  } catch (err) { /* 列已存在时忽略 */ }
  try {
    db.exec(`ALTER TABLE pet_states ADD COLUMN last_event_at DATETIME DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  // 宠物当前居家状态及时长（避免每次刷新都重新随机状态）
  try {
    db.exec(`ALTER TABLE pet_states ADD COLUMN current_state_key VARCHAR(32) DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  try {
    db.exec(`ALTER TABLE pet_states ADD COLUMN state_expires_at DATETIME DEFAULT NULL;`);
  } catch (err) { /* 列已存在时忽略 */ }
  try {
    db.exec(`ALTER TABLE pet_states_lib ADD COLUMN duration_minutes INTEGER DEFAULT 30;`);
  } catch (err) { /* 列已存在时忽略 */ }
  // 每日事件掉落上限规则调整为 2（产品规则：每天最多掉落 2 个事件）
  try {
    const row = db.prepare("SELECT config_value FROM app_configs WHERE config_key = 'pet_explore_times'").get();
    if (row && row.config_value) {
      const cfg = JSON.parse(row.config_value);
      if (!cfg.daily_event_max || cfg.daily_event_max > 2) {
        cfg.daily_event_max = 2;
        db.prepare("UPDATE app_configs SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = 'pet_explore_times'")
          .run(JSON.stringify(cfg));
        console.log('[迁移] 每日事件掉落上限已调整为 2');
      }
    }
  } catch (err) {
    console.error('事件掉落上限迁移失败:', err.message);
  }

  // 新增 chat_messages 沉淀类型字段
  try {
    db.exec(`ALTER TABLE chat_messages ADD COLUMN precipitation_type VARCHAR(32) DEFAULT NULL;`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 新增用户来源字段（app / cms），旧数据默认 app
  try {
    db.exec(`ALTER TABLE users ADD COLUMN source VARCHAR(16) DEFAULT 'app';`);
    db.exec(`UPDATE users SET source = 'app' WHERE source IS NULL OR source = '';`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 移除明文凭据列 plain_password（安全整改），SQLite < 3.35 不支持 DROP COLUMN 则忽略
  try {
    db.exec(`ALTER TABLE users DROP COLUMN plain_password;`);
  } catch (err) {
    // 老版本 SQLite 不支持 DROP COLUMN 时静默跳过，该列已从新库 CREATE TABLE 中移除
  }

  // 新增 AI 配置表相关迁移
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(64) NOT NULL,
        provider VARCHAR(32) DEFAULT 'doubao',
        base_url VARCHAR(255) DEFAULT 'https://ark.cn-beijing.volces.com/api/v3',
        api_key VARCHAR(255) NOT NULL,
        endpoint_id VARCHAR(64) NOT NULL,
        temperature DECIMAL(3,2) DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 500,
        timeout_ms INTEGER DEFAULT 30000,
        role VARCHAR(16) DEFAULT 'primary' CHECK(role IN ('primary', 'backup')),
        sort_order INTEGER DEFAULT 0,
        is_enabled TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_configs_role_sort ON ai_configs(role, sort_order);`);
  } catch (err) {
    console.error('AI 配置表迁移失败:', err.message);
  }

  try {
    db.exec(`ALTER TABLE ai_prompts ADD COLUMN ai_config_id INTEGER DEFAULT NULL REFERENCES ai_configs(id);`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 新增里程碑文案模板表
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS milestone_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type VARCHAR(32) NOT NULL,
        value DECIMAL(6,2) DEFAULT NULL,
        content TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_enabled TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_milestone_templates_type ON milestone_templates(type, is_enabled, value, sort_order);`);
  } catch (err) {
    console.error('里程碑文案模板表迁移失败:', err.message);
  }

  // 为里程碑文案模板表补充 value 字段
  try {
    db.exec(`ALTER TABLE milestone_templates ADD COLUMN value DECIMAL(6,2) DEFAULT NULL;`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 为 custom_foods 补充单位、公开状态、审核状态字段
  try {
    db.exec(`ALTER TABLE custom_foods ADD COLUMN unit VARCHAR(32) DEFAULT 'g';`);
  } catch (err) {
    // 列已存在时忽略
  }
  try {
    db.exec(`ALTER TABLE custom_foods ADD COLUMN is_public TINYINT DEFAULT 0;`);
  } catch (err) {
    // 列已存在时忽略
  }
  try {
    db.exec(`ALTER TABLE custom_foods ADD COLUMN status VARCHAR(16) DEFAULT 'approved';`);
  } catch (err) {
    // 列已存在时忽略
  }

  // 新增已注销用户日志表
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS deleted_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_user_id INTEGER NOT NULL,
        username VARCHAR(16) DEFAULT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        openid VARCHAR(64) DEFAULT NULL,
        reason VARCHAR(255) DEFAULT NULL,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_deleted_users_phone ON deleted_users(phone);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_deleted_users_original_id ON deleted_users(original_user_id);`);
  } catch (err) {
    console.error('已注销用户日志表迁移失败:', err.message);
  }

  // 兼容旧库：补充 CMS 控制器依赖的字段
  function tableColumns(table) {
    return db.pragma(`table_info(${table})`).map(col => col.name);
  }

  function addColumnIfNotExists(table, column, def) {
    const columns = tableColumns(table);
    if (!columns.includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def};`);
    }
  }

  try {
    addColumnIfNotExists('users', 'username', "VARCHAR(16) DEFAULT NULL");
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
  } catch (err) {}

  try {
    addColumnIfNotExists('food_db', 'food_id', 'INTEGER DEFAULT NULL');
    addColumnIfNotExists('food_db', 'food_name', "VARCHAR(128) DEFAULT NULL");
    addColumnIfNotExists('food_db', 'sub_category', "VARCHAR(32) DEFAULT ''");
    addColumnIfNotExists('food_db', 'calories_per_100g', 'DECIMAL(8,2) DEFAULT 0');
    addColumnIfNotExists('food_db', 'common_unit', "VARCHAR(128) DEFAULT ''");
    addColumnIfNotExists('food_db', 'edible_rate', 'DECIMAL(3,2) DEFAULT 1.0');
    addColumnIfNotExists('food_db', 'remark', "TEXT DEFAULT ''");
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_food_db_food_id ON food_db(food_id);`);

    const foodColumns = tableColumns('food_db');
    if (foodColumns.includes('name')) {
      db.exec(`UPDATE food_db SET food_name = name WHERE food_name IS NULL OR food_name = '';`);
    }
    if (foodColumns.includes('calorie_per_100g')) {
      db.exec(`UPDATE food_db SET calories_per_100g = calorie_per_100g WHERE calories_per_100g = 0 AND calorie_per_100g > 0;`);
    }
    db.exec(`UPDATE food_db SET food_id = id WHERE food_id IS NULL;`);
  } catch (err) {
    console.error('food_db 字段迁移失败:', err.message);
  }

  try {
    addColumnIfNotExists('exercise_db', 'exercise_name', "VARCHAR(64) DEFAULT NULL");
    addColumnIfNotExists('exercise_db', 'category', "VARCHAR(32) DEFAULT NULL");
    addColumnIfNotExists('exercise_db', 'sub_category', "VARCHAR(32) DEFAULT ''");
    addColumnIfNotExists('exercise_db', 'intensity_desc', "VARCHAR(64) DEFAULT ''");
    addColumnIfNotExists('exercise_db', 'met_value', 'DECIMAL(5,2) DEFAULT 0');
    addColumnIfNotExists('exercise_db', 'calorie_per_hour', 'DECIMAL(8,2) DEFAULT 0');
    addColumnIfNotExists('exercise_db', 'remark', "VARCHAR(255) DEFAULT ''");

    const exerciseColumns = tableColumns('exercise_db');
    if (exerciseColumns.includes('name')) {
      db.exec(`UPDATE exercise_db SET exercise_name = name WHERE exercise_name IS NULL OR exercise_name = '';`);
    }
    if (exerciseColumns.includes('type')) {
      db.exec(`UPDATE exercise_db SET category = type WHERE category IS NULL OR category = '';`);
    }
  } catch (err) {
    console.error('exercise_db 字段迁移失败:', err.message);
  }

  // 新增弹窗广告系统相关表（兼容旧库）
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS popups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(64) NOT NULL,
        style VARCHAR(16) NOT NULL CHECK(style IN ('center', 'top')),
        type VARCHAR(16) NOT NULL CHECK(type IN ('system', 'operational', 'version', 'activity')),
        status VARCHAR(16) NOT NULL CHECK(status IN ('draft', 'enabled', 'disabled')),
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        priority INTEGER DEFAULT 5,
        image_url TEXT NOT NULL,
        title VARCHAR(255) DEFAULT '',
        content TEXT DEFAULT '',
        show_close_button TINYINT DEFAULT 1,
        mask_closeable TINYINT DEFAULT 1,
        jump_type VARCHAR(16) NOT NULL CHECK(jump_type IN ('none', 'internal', 'h5')),
        jump_route_id INTEGER DEFAULT NULL REFERENCES app_routes(id),
        jump_url TEXT DEFAULT '',
        jump_params TEXT DEFAULT '{}',
        scope_type VARCHAR(16) NOT NULL CHECK(scope_type IN ('global', 'specific')),
        scope_pages TEXT DEFAULT '[]',
        excluded_pages TEXT DEFAULT '[]',
        trigger_type VARCHAR(16) NOT NULL CHECK(trigger_type IN ('immediate', 'duration', 'back', 'cold_start', 'operation')),
        trigger_delay_seconds INTEGER DEFAULT 0,
        frequency_period VARCHAR(16) DEFAULT 'day' CHECK(frequency_period IN ('day', 'week', 'forever')),
        frequency_max INTEGER DEFAULT 1,
        one_time TINYINT DEFAULT 0,
        wifi_only TINYINT DEFAULT 0,
        version_min VARCHAR(32) DEFAULT '',
        version_max VARCHAR(32) DEFAULT '',
        os_type TEXT DEFAULT '["ios","android","h5","mp-weixin"]',
        target_users TEXT DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        created_by VARCHAR(64) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_popups_status_time ON popups(status, start_time, end_time, priority);

      CREATE TABLE IF NOT EXISTS h5_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(16) DEFAULT 'enabled' CHECK(status IN ('enabled', 'disabled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_key VARCHAR(64) NOT NULL UNIQUE,
        route_name VARCHAR(128) NOT NULL,
        path VARCHAR(255) DEFAULT '',
        params_schema TEXT DEFAULT '{}',
        status VARCHAR(16) DEFAULT 'enabled' CHECK(status IN ('enabled', 'disabled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS popup_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        popup_id INTEGER NOT NULL,
        user_id INTEGER DEFAULT NULL,
        device_id VARCHAR(64) DEFAULT '',
        page VARCHAR(128) DEFAULT '',
        event_type VARCHAR(16) NOT NULL CHECK(event_type IN ('show', 'click', 'close')),
        trigger VARCHAR(32) DEFAULT '',
        close_way VARCHAR(16) DEFAULT '',
        app_version VARCHAR(32) DEFAULT '',
        os_type VARCHAR(16) DEFAULT '',
        event_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_popup_events_popup ON popup_events(popup_id, event_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_popup_events_user ON popup_events(user_id, created_at);

      CREATE TABLE IF NOT EXISTS popup_daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        popup_id INTEGER NOT NULL,
        shows INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        closes INTEGER DEFAULT 0,
        close_btn INTEGER DEFAULT 0,
        mask INTEGER DEFAULT 0,
        back INTEGER DEFAULT 0,
        swipe INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, popup_id)
      );
      CREATE INDEX IF NOT EXISTS idx_popup_daily_stats_date ON popup_daily_stats(date, popup_id);
    `);
  } catch (err) {
    console.error('弹窗系统表迁移失败:', err.message);
  }

  // 为弹窗表补充用户定向字段
  try {
    db.exec(`ALTER TABLE popups ADD COLUMN target_users TEXT DEFAULT '[]';`);
  } catch (err) {
    // 列已存在时忽略
  }

  // museum_items 支持聊天沉淀待确认（status: 0 pending / 1 confirmed / 2 discarded）
  try {
    addColumnIfNotExists('museum_items', 'chat_message_id', 'INTEGER DEFAULT NULL');
    db.exec(`CREATE INDEX IF NOT EXISTS idx_museum_chat_msg ON museum_items(chat_message_id);`);
    // 注意：status 字段已存在，旧数据默认 status=1 视为已确认；
    // 新产生的 pending 资产由业务代码显式写入 status=0。
  } catch (err) {
    console.error('museum_items 待确认字段迁移失败:', err.message);
  }

  // precipitation_records 增加 chat_message_id 字段，与 chat_id 含义一致，便于按消息维度查询
  try {
    addColumnIfNotExists('precipitation_records', 'chat_message_id', 'INTEGER DEFAULT NULL');
    db.exec(`CREATE INDEX IF NOT EXISTS idx_precipitation_chat_msg ON precipitation_records(chat_message_id);`);
    // 回填已有数据：chat_id 即对应 chat_messages.id
    db.exec(`UPDATE precipitation_records SET chat_message_id = chat_id WHERE chat_message_id IS NULL AND chat_id IS NOT NULL;`);
  } catch (err) {
    console.error('precipitation_records chat_message_id 字段迁移失败:', err.message);
  }

  // museum_items 增加 title 字段
  try {
    addColumnIfNotExists('museum_items', 'title', 'VARCHAR(255) DEFAULT NULL');
    // title 列在此迁移中补充，依赖它的索引也在此创建（全新库 initTables 阶段 title 尚不存在）
    db.exec(`CREATE INDEX IF NOT EXISTS idx_museum_user_type_title ON museum_items(user_id, type, title);`);
  } catch (err) {
    console.error('museum_items title 字段迁移失败:', err.message);
  }

  // museum_items 增加记录日期（用于每日分析历史、心情日记按日期查询）
  try {
    addColumnIfNotExists('museum_items', 'record_date', 'DATE DEFAULT NULL');
    db.exec(`CREATE INDEX IF NOT EXISTS idx_museum_user_date ON museum_items(user_id, record_date);`);
    // 回填已有每日分析数据：解析 tags 中的 ['日记','YYYY-MM-DD']
    const rows = db.prepare(`
      SELECT id, tags FROM museum_items
      WHERE sub_type = 'daily_diary' AND (record_date IS NULL OR record_date = '')
    `).all();
    const update = db.prepare('UPDATE museum_items SET record_date = ? WHERE id = ?');
    for (const row of rows) {
      try {
        const tags = JSON.parse(row.tags || '[]');
        const date = tags.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t));
        if (date) update.run(date, row.id);
      } catch (e) {}
    }
  } catch (err) {
    console.error('museum_items record_date 迁移失败:', err.message);
  }

  // 轻断食表增加开始时间
  try {
    addColumnIfNotExists('fasting_records', 'started_at', 'DATETIME DEFAULT NULL');
  } catch (err) {
    console.error('fasting_records started_at 字段迁移失败:', err.message);
  }

  // 用户资料增加勿扰时段、饮水目标
  try {
    addColumnIfNotExists('user_profiles', 'quiet_hours_start', "VARCHAR(8) DEFAULT '22:00'");
    addColumnIfNotExists('user_profiles', 'quiet_hours_end', "VARCHAR(8) DEFAULT '08:00'");
    addColumnIfNotExists('user_profiles', 'water_goal', 'INTEGER DEFAULT 2000');
  } catch (err) {
    console.error('user_profiles 勿扰时段/饮水目标字段迁移失败:', err.message);
  }

  // 身高字段：users/user_profiles 双表兜底（历史版本两表都读过 height，旧库升级时缺列会 500）
  try {
    addColumnIfNotExists('users', 'height', 'DECIMAL(5,2) DEFAULT NULL');
    addColumnIfNotExists('user_profiles', 'height', 'DECIMAL(5,2) DEFAULT NULL');
  } catch (err) {
    console.error('height 字段迁移失败:', err.message);
  }

  // users 表增加状态字段，用于鉴权时判断账号是否被禁用
  try {
    addColumnIfNotExists('users', 'status', 'TINYINT DEFAULT 1');
  } catch (err) {
    console.error('users.status 字段迁移失败:', err.message);
  }

  // 运动记录扩展陪你动来源
  try {
    addColumnIfNotExists('exercise_records', 'is_workout', 'TINYINT DEFAULT 0');
    addColumnIfNotExists('exercise_records', 'source', 'VARCHAR(16) DEFAULT NULL');
    addColumnIfNotExists('exercise_records', 'workout_key', 'VARCHAR(32) DEFAULT NULL');
    addColumnIfNotExists('exercise_records', 'video_url', 'VARCHAR(255) DEFAULT NULL');
  } catch (err) {
    console.error('exercise_records 陪你动字段迁移失败:', err.message);
  }

  // 新建陪你动课程库
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workout_lib (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_key VARCHAR(32) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL,
        category VARCHAR(32) DEFAULT 'aerobic',
        video_url VARCHAR(255) DEFAULT NULL,
        cover_url VARCHAR(255) DEFAULT NULL,
        duration_seconds INTEGER DEFAULT 0,
        calorie_per_session DECIMAL(8,2) DEFAULT 0,
        required_equipment_key VARCHAR(32) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        sort_order INTEGER DEFAULT 0,
        status TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_workout_status ON workout_lib(status, sort_order);
    `);
  } catch (err) {
    console.error('workout_lib 表迁移失败:', err.message);
  }

  // 陪你动课程升级：时长模式（不限/分组定时）+ 按小时消耗
  // duration_mode: 'unlimited' 不限时长（秒表正计时，不支持多组） | 'sets' 分组定时
  // set_minutes 每组时长（分钟）、sets_count 组数、rest_seconds 组间休息（秒）
  // calorie_per_hour 每小时消耗（千卡），消耗 = calorie_per_hour × 实际跟练秒数 / 3600
  try {
    addColumnIfNotExists('workout_lib', 'duration_mode', "VARCHAR(16) DEFAULT 'sets'");
    addColumnIfNotExists('workout_lib', 'set_minutes', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('workout_lib', 'sets_count', 'INTEGER DEFAULT 1');
    addColumnIfNotExists('workout_lib', 'rest_seconds', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('workout_lib', 'calorie_per_hour', 'DECIMAL(8,2) DEFAULT 0');
    // 所需器材改为关联商店器材商品 id（user_inventory 持有即解锁，与宠物运动选项同一机制）
    addColumnIfNotExists('workout_lib', 'required_item_id', 'INTEGER DEFAULT NULL');
    // 存量映射：旧的 required_equipment_key 字符串 == 器材商品 effect_json.unlock_workout
    db.exec(`
      UPDATE workout_lib SET required_item_id = (
        SELECT s.id FROM shop_items s
        WHERE s.category = 'equipment'
          AND json_extract(s.effect_json, '$.unlock_workout') = workout_lib.required_equipment_key
        LIMIT 1
      ) WHERE required_item_id IS NULL AND required_equipment_key IS NOT NULL;
    `);
    // 课程可关联运动库（exercise_db）：关联后跟练记录的消耗按运动库的每小时消耗计算
    addColumnIfNotExists('workout_lib', 'exercise_id', 'INTEGER DEFAULT NULL');
    // 跳绳课程关联运动库的「跳绳」
    db.exec(`
      UPDATE workout_lib SET exercise_id = (
        SELECT id FROM exercise_db WHERE exercise_name = '跳绳' LIMIT 1
      ) WHERE exercise_id IS NULL AND (workout_key = 'jump_rope_10min' OR name LIKE '%跳绳%');
    `);
    // 存量数据迁移：按旧的"目标时长+每次消耗"折算为单组定时+每小时消耗（只迁一次）
    db.exec(`
      UPDATE workout_lib
      SET set_minutes = MAX(1, ROUND(duration_seconds / 60.0)),
          sets_count = 1,
          rest_seconds = 0,
          calorie_per_hour = CASE WHEN duration_seconds > 0
            THEN ROUND(calorie_per_session * 3600.0 / duration_seconds)
            ELSE calorie_per_session END
      WHERE (set_minutes IS NULL OR set_minutes = 0) AND duration_seconds > 0;
    `);
  } catch (err) {
    console.error('workout_lib 时长模式字段迁移失败:', err.message);
  }

  // pet_exercise_lib 添加 duration_seconds 字段（搭搭运动弹窗倒计时时长）
  try {
    addColumnIfNotExists('pet_exercise_lib', 'duration_seconds', 'INTEGER DEFAULT 180');
  } catch (err) {
    console.error('pet_exercise_lib duration_seconds 字段迁移失败:', err.message);
  }

  // 新增试用权限相关表
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS trial_user_count (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT NULL,
        device_id VARCHAR(64) DEFAULT NULL,
        feature_type VARCHAR(32) NOT NULL CHECK(feature_type IN ('ai_chat', 'diary')),
        used_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_count_user_feature ON trial_user_count(user_id, feature_type);`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_count_device_feature ON trial_user_count(device_id, feature_type);`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS trial_system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key VARCHAR(64) NOT NULL UNIQUE,
        config_value TEXT NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS trial_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type VARCHAR(16) NOT NULL CHECK(type IN ('user', 'version', 'ip')),
        value VARCHAR(255) NOT NULL,
        expire_at DATETIME DEFAULT NULL,
        remark VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_trial_whitelist_type_value ON trial_whitelist(type, value);`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS trial_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT NULL,
        device_id VARCHAR(64) DEFAULT NULL,
        feature_type VARCHAR(32) DEFAULT NULL,
        action VARCHAR(16) NOT NULL,
        reason VARCHAR(255) DEFAULT NULL,
        ip VARCHAR(64) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_trial_logs_user ON trial_logs(user_id, created_at);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_trial_logs_device ON trial_logs(device_id, created_at);`);
  } catch (err) {
    console.error('试用权限表迁移失败:', err.message);
  }

  // P3 站内运营内容中台：公告/消息中心表迁移
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(255) NOT NULL,
        content TEXT DEFAULT '',
        type VARCHAR(32) NOT NULL CHECK(type IN ('banner', 'notice', 'fullscreen', 'message')),
        position VARCHAR(64) DEFAULT 'home',
        target_type VARCHAR(32) NOT NULL CHECK(target_type IN ('all', 'specified_users', 'segments')),
        target_users TEXT DEFAULT '[]',
        segments TEXT DEFAULT '[]',
        status VARCHAR(16) NOT NULL CHECK(status IN ('draft', 'enabled', 'disabled')),
        priority INTEGER DEFAULT 5,
        image_url TEXT DEFAULT '',
        background_color VARCHAR(16) DEFAULT '',
        text_color VARCHAR(16) DEFAULT '',
        jump_type VARCHAR(16) NOT NULL CHECK(jump_type IN ('none', 'internal', 'h5')),
        jump_route_id INTEGER DEFAULT NULL REFERENCES app_routes(id),
        jump_url TEXT DEFAULT '',
        jump_params TEXT DEFAULT '{}',
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        version_min VARCHAR(32) DEFAULT '',
        version_max VARCHAR(32) DEFAULT '',
        os_type TEXT DEFAULT '["ios","android","h5","mp-weixin"]',
        max_show_count INTEGER DEFAULT 0,
        dismissible TINYINT DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_by VARCHAR(64) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_announcements_status_time ON announcements(status, start_time, end_time, priority);
      CREATE INDEX IF NOT EXISTS idx_announcements_position ON announcements(position, status, priority);

      CREATE TABLE IF NOT EXISTS user_announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        status VARCHAR(16) DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'clicked')),
        first_show_at DATETIME DEFAULT NULL,
        last_show_at DATETIME DEFAULT NULL,
        click_at DATETIME DEFAULT NULL,
        show_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, announcement_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_announcements_user ON user_announcements(user_id, status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_user_announcements_announcement ON user_announcements(announcement_id, status);

      CREATE TABLE IF NOT EXISTS notification_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_key VARCHAR(32) NOT NULL UNIQUE,
        channel_name VARCHAR(64) NOT NULL,
        is_enabled TINYINT DEFAULT 1,
        config TEXT DEFAULT '{}',
        description TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notification_channels_key ON notification_channels(channel_key, is_enabled);

      CREATE TABLE IF NOT EXISTS popup_user_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        popup_id INTEGER NOT NULL REFERENCES popups(id) ON DELETE CASCADE,
        identifier VARCHAR(128) NOT NULL,
        identifier_type VARCHAR(16) NOT NULL CHECK(identifier_type IN ('user', 'device')),
        show_count INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        close_count INTEGER DEFAULT 0,
        first_show_at DATETIME DEFAULT NULL,
        last_show_at DATETIME DEFAULT NULL,
        last_click_at DATETIME DEFAULT NULL,
        last_close_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(popup_id, identifier, identifier_type)
      );
      CREATE INDEX IF NOT EXISTS idx_popup_user_stats_identifier ON popup_user_stats(identifier_type, identifier, popup_id);
    `);

    // 初始化默认通知渠道
    const channels = [
      { channel_key: 'in_app', channel_name: '站内信', description: 'APP 内公告栏与消息中心' },
      { channel_key: 'push', channel_name: 'App Push', description: '原生推送（预留）' },
      { channel_key: 'sms', channel_name: '短信', description: '短信通道（预留）' },
      { channel_key: 'wechat_sub', channel_name: '微信订阅消息', description: '微信小程序订阅消息（预留）' }
    ];
    for (const ch of channels) {
      const exists = db.prepare('SELECT id FROM notification_channels WHERE channel_key = ?').get(ch.channel_key);
      if (!exists) {
        db.prepare('INSERT INTO notification_channels (channel_key, channel_name, description, sort_order) VALUES (?, ?, ?, ?)')
          .run(ch.channel_key, ch.channel_name, ch.description, 0);
      }
    }
  } catch (err) {
    console.error('公告/消息中心表迁移失败:', err.message);
  }

  // 新手任务表（兼容旧库）
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_newbie_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_key VARCHAR(32) NOT NULL,
        title VARCHAR(128) NOT NULL,
        description TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        status VARCHAR(16) DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'claimed')),
        reward_berries INTEGER DEFAULT 20,
        completed_at DATETIME DEFAULT NULL,
        claimed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, task_key)
      );
      CREATE INDEX IF NOT EXISTS idx_user_newbie_tasks_user ON user_newbie_tasks(user_id, status, sort_order);
    `);
  } catch (err) {
    console.error('新手任务表迁移失败:', err.message);
  }

  // 宠物状态表补充运动计数字段（宠物运动时间状态机）
  try {
    addColumnIfNotExists('pet_states', 'daily_exercise_count', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('pet_states', 'last_exercise_at', 'DATETIME DEFAULT NULL');
  } catch (err) {
    console.error('pet_states 运动计数字段迁移失败:', err.message);
  }

  // 宠物状态库补充序列帧、坐标、场景字段
  try {
    addColumnIfNotExists('pet_states_lib', 'frames_json', 'TEXT DEFAULT NULL');
    addColumnIfNotExists('pet_states_lib', 'frame_rate', 'INTEGER DEFAULT 2');
    addColumnIfNotExists('pet_states_lib', 'pos_x', 'INTEGER DEFAULT NULL');
    addColumnIfNotExists('pet_states_lib', 'pos_y', 'INTEGER DEFAULT NULL');
    addColumnIfNotExists('pet_states_lib', 'width', 'INTEGER DEFAULT NULL');
    addColumnIfNotExists('pet_states_lib', 'height', 'INTEGER DEFAULT NULL');
    addColumnIfNotExists('pet_states_lib', 'scene_key', 'VARCHAR(32) DEFAULT NULL');
  } catch (err) {
    console.error('pet_states_lib 序列帧/坐标/场景字段迁移失败:', err.message);
  }

  // 事件照片表（同一事件多照片，掉落时随机一张）
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pet_event_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        photo_url VARCHAR(255) NOT NULL,
        is_enabled TINYINT DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES pet_events_lib(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_pet_event_photos_event ON pet_event_photos(event_id, is_enabled, sort_order);
    `);
  } catch (err) {
    console.error('pet_event_photos 表迁移失败:', err.message);
  }

  // user_events 补充 photo_id：同一事件不同照片算新事件（唯一键升级为 user_id+event_id+photo_id）
  try {
    const ueColumns = tableColumns('user_events');
    if (!ueColumns.includes('photo_id')) {
      db.exec(`
        ALTER TABLE user_events RENAME TO user_events_old;
        CREATE TABLE user_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          event_id INTEGER NOT NULL,
          photo_id INTEGER DEFAULT 0,
          is_new TINYINT DEFAULT 1,
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (event_id) REFERENCES pet_events_lib(id) ON DELETE CASCADE,
          UNIQUE(user_id, event_id, photo_id)
        );
        INSERT INTO user_events (id, user_id, event_id, is_new, unlocked_at)
          SELECT id, user_id, event_id, is_new, unlocked_at FROM user_events_old;
        DROP TABLE user_events_old;
        CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, unlocked_at);
      `);
    }
  } catch (err) {
    console.error('user_events photo_id 迁移失败:', err.message);
  }

  // 为已有用户补全陪伴系统数据
  try {
    const users = db.prepare('SELECT id FROM users').all();
    for (const user of users) {
      initUserCompanionData(user.id);
    }
  } catch (err) {
    console.error('老用户陪伴数据迁移失败:', err.message);
  }
}

/**
 * 初始化基础数据
 */
function ensureAppConfig(key, value) {
  const existing = db.prepare('SELECT id FROM app_configs WHERE config_key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO app_configs (config_key, config_value) VALUES (?, ?)').run(key, value);
  }
}

function ensureAiPrompt(key, content) {
  const existing = db.prepare('SELECT id FROM ai_prompts WHERE prompt_key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO ai_prompts (prompt_key, version, content, is_enabled, is_latest) VALUES (?, 1, ?, 1, 1)').run(key, content);
  }
}

function getSystemMeta(key) {
  const row = db.prepare('SELECT value FROM system_meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSystemMeta(key, value) {
  const exists = db.prepare('SELECT 1 FROM system_meta WHERE key = ?').get(key);
  if (exists) {
    db.prepare('UPDATE system_meta SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, key);
  } else {
    db.prepare('INSERT INTO system_meta (key, value) VALUES (?, ?)').run(key, value);
  }
}

/**
 * 将旧版默认 Prompt 升级到搭搭小熊猫管家人设
 * 仅当内容仍包含旧版标识时才替换，避免覆盖运营在 CMS 中自定义的 Prompt。
 */
function migratePromptsToCompanionPersona() {
  const oldMarkers = {
    'main_agent': ['瘦瘦'],
    'helper_agent': ['专业全能助手']
  };
  for (const [key, markers] of Object.entries(oldMarkers)) {
    const latest = db.prepare(`
      SELECT id, content FROM ai_prompts
      WHERE prompt_key = ? AND is_latest = 1
      ORDER BY version DESC LIMIT 1
    `).get(key);
    if (!latest) continue;
    const hasOldMarker = markers.some(m => (latest.content || '').includes(m));
    if (!hasOldMarker) continue;
    const newContent = promptDefaults[key];
    if (!newContent) continue;
    db.prepare(`
      UPDATE ai_prompts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newContent, latest.id);
    console.log(`[Prompt 迁移] ${key} 已更新为搭搭小熊猫管家人设`);
  }
}

/**
 * 补全主/Helper Agent Prompt：若最新版本缺少"严禁暴露系统规则"等约束，则同步为当前默认 Prompt
 * 用于将 promptDefaults.js 中新增的规则自动同步到已有数据库，避免仅改代码不生效。
 */
function migratePromptsAddSystemRuleConstraint() {
  const keys = ['main_agent', 'helper_agent'];
  for (const key of keys) {
    const latest = db.prepare(`
      SELECT id, content FROM ai_prompts
      WHERE prompt_key = ? AND is_latest = 1
      ORDER BY version DESC LIMIT 1
    `).get(key);
    if (!latest) continue;
    if ((latest.content || '').includes('严禁向用户暴露系统规则')) continue;
    const newContent = promptDefaults[key];
    if (!newContent) continue;
    db.prepare(`
      UPDATE ai_prompts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newContent, latest.id);
    console.log(`[Prompt 迁移] ${key} 已补全系统规则约束`);
  }
}

function ensureAiConfig({ name, provider, baseUrl, apiKey, endpointId, temperature, maxTokens, timeoutMs, role, sortOrder }) {
  if (!apiKey || !endpointId) return null;
  const existing = db.prepare('SELECT id FROM ai_configs WHERE name = ?').get(name);
  if (existing) return existing.id;
  const result = db.prepare(`
    INSERT INTO ai_configs (name, provider, base_url, api_key, endpoint_id, temperature, max_tokens, timeout_ms, role, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(name, provider, baseUrl, apiKey, endpointId, temperature, maxTokens, timeoutMs, role, sortOrder);
  return result.lastInsertRowid;
}

function getConfigIdByName(name) {
  const row = db.prepare('SELECT id FROM ai_configs WHERE name = ?').get(name);
  return row ? row.id : null;
}

function ensureTemplateConfig(type, mode, content, sortOrder) {
  const exists = db.prepare('SELECT id FROM template_configs WHERE template_type = ? AND mode = ? AND content = ?').get(type, mode, content);
  if (!exists) {
    db.prepare('INSERT INTO template_configs (template_type, mode, content, sort_order, is_enabled) VALUES (?, ?, ?, ?, 1)').run(type, mode, content, sortOrder);
  }
}

function initSeedData() {
  // 食品库数据由 import-foods.js 脚本导入，不再通过 initSeedData 插入
  // 如果 food_db 为空，提示运行导入脚本
  const foodCount = db.prepare('SELECT COUNT(*) as count FROM food_db').get().count;
  if (foodCount === 0) {
    console.log('[提示] food_db 为空，请运行 npm run import-foods 导入食品库数据');
  }

  // 运动库数据由 import-exercises.js 脚本导入，不再通过 initSeedData 插入
  const exerciseCount = db.prepare('SELECT COUNT(*) as count FROM exercise_db').get().count;
  if (exerciseCount === 0) {
    console.log('[提示] exercise_db 为空，请运行 npm run import-exercises 导入运动库数据');
  }

  // 初始化默认用户协议、隐私政策及相关开关
  ensureAppConfig('user_agreement', DEFAULT_USER_AGREEMENT);
  ensureAppConfig('user_agreement_url', '');
  ensureAppConfig('privacy_policy', DEFAULT_PRIVACY_POLICY);
  ensureAppConfig('privacy_policy_url', '');
  ensureAppConfig('privacy_version', '1.0.0');
  ensureAppConfig('force_privacy_update', '0');
  ensureAppConfig('about_us_content', DEFAULT_ABOUT_US);
  ensureAppConfig('popup_global_enabled', '1');
  ensureAppConfig('popup_daily_limit', '3');

  ensureAppConfig('museum_modules', JSON.stringify({
    recipe: true,
    insight: true,
    photo: true,
    method: true,
    diary: true,
    milestone: true
  }));

  // ==================== 宠物陪伴系统默认配置 ====================
  ensureAppConfig('pet_global', JSON.stringify({
    sleep_start: '22:00',
    sleep_end: '08:00',
    explore: {
      duration_seconds: 1800,
      daily_max_count: 3
    }
  }));

  // 三餐吃饭时间：到点宠物头上出叹号，引导用户进入喂食流程
  ensureAppConfig('pet_meal_times', JSON.stringify({
    meals: [
      { key: 'breakfast', name: '早餐', start: '07:00', end: '09:00' },
      { key: 'lunch', name: '午餐', start: '11:30', end: '13:30' },
      { key: 'dinner', name: '晚餐', start: '17:30', end: '19:30' }
    ]
  }));

  // 运动时间（晚饭后）：到点出叹号，运动选项由 options 随机
  ensureAppConfig('pet_exercise_time', JSON.stringify({
    start: '19:30',
    end: '21:00',
    options: [
      { key: 'walk', name: '散步', mood: 5, satiety: -3 },
      { key: 'jump_rope', name: '跳绳', mood: 8, satiety: -5 },
      { key: 'yoga', name: '瑜伽', mood: 6, satiety: -3 },
      { key: 'dance', name: '跳舞', mood: 8, satiety: -5 }
    ]
  }));

  // 逛逛时间：上午/下午/夜间按概率随机外出，daily_event_max 限制每天事件掉落数
  ensureAppConfig('pet_explore_times', JSON.stringify({
    windows: [
      { key: 'morning', start: '08:00', end: '11:00', probability: 0.3 },
      { key: 'afternoon', start: '14:00', end: '17:00', probability: 0.3 },
      { key: 'night', start: '20:00', end: '22:00', probability: 0.2 }
    ],
    daily_event_max: 5
  }));

  // 喂食限制：每次最多 2 种食物，每天最多 6 次
  ensureAppConfig('pet_feed_limits', JSON.stringify({
    max_items_per_feed: 2,
    max_feeds_per_day: 6
  }));

  // 运动限制：每天最多 2 次
  ensureAppConfig('pet_exercise_limits', JSON.stringify({
    max_per_day: 2
  }));

  // 货币规则：首次插入默认值，后续启动时自动合并新增 sources
  (function ensureCurrencyRules() {
    const key = 'currency_rules';
    // 行为类浆果奖励已全部收口到任务系统（任务配置页按行为配置奖励），
    // 这里不再维护 sources/daily_limits 等按行为发放的口子
    const defaults = {
      berries: {
        daily_max: 500
      },
      initial: {
        berries: 100,
        flowers: process.env.NODE_ENV === 'test' ? 1000 : 0
      }
    };
    const existing = db.prepare('SELECT config_value FROM app_configs WHERE config_key = ?').get(key);
    let current = {};
    if (existing) {
      try { current = JSON.parse(existing.config_value || '{}'); } catch (e) {}
    }
    current.berries = { daily_max: (current.berries && current.berries.daily_max) || defaults.berries.daily_max };
    // 测试环境每次初始化都重置初始货币，方便回归测试；生产环境保留用户已有配置
    current.initial = process.env.NODE_ENV === 'test' ? defaults.initial : { ...defaults.initial, ...current.initial };
    delete current.flowers; // 旧版 flowers.milestone/checkin_continuous 为死配置，清除
    const value = JSON.stringify(current);
    if (existing) {
      db.prepare('UPDATE app_configs SET config_value = ? WHERE config_key = ?').run(value, key);
    } else {
      db.prepare('INSERT INTO app_configs (config_key, config_value) VALUES (?, ?)').run(key, value);
    }
  })();

  (function initAnalysisCost() {
    const isTest = process.env.NODE_ENV === 'test';
    const value = JSON.stringify(isTest ? { berries: 0, flowers: 0 } : { berries: 50, flowers: 5 });
    const existing = db.prepare('SELECT id FROM app_configs WHERE config_key = ?').get('analysis_cost');
    if (existing) {
      db.prepare('UPDATE app_configs SET config_value = ? WHERE config_key = ?').run(value, 'analysis_cost');
    } else {
      db.prepare('INSERT INTO app_configs (config_key, config_value) VALUES (?, ?)').run('analysis_cost', value);
    }
  })();

  ensureAppConfig('ad_slots', JSON.stringify({
    enabled: false,
    slots: ['task_reward', 'shop_unlock', 'analysis_generate', 'workout_bonus', 'flower_reward', 'event_bonus']
  }));

  // CMS 可管理的内容只初始化一次；后续运营在 CMS 中增删改后，重启服务不应恢复默认值
  const cmsSeeded = getSystemMeta('cms_seeded') === '1';
  if (!cmsSeeded) {
    // 默认宠物外观
    // 2026-08-27 修复：默认皮肤不再绑定兜底图片，static_url 留空，避免未配置时展示错误默认图
    const defaultSkin = db.prepare("SELECT id FROM pet_skins WHERE skin_id = 'default'").get();
    if (!defaultSkin) {
      db.prepare(`
        INSERT INTO pet_skins (skin_id, species, name, static_url, sort_order, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('default', 'red_panda', '默认小熊猫', '', 0, 1);
    }

    // 默认居家状态库
    // 2026-08-27 修复：默认状态图片不再绑定兜底图片，static_url 留空
    const stateKeys = ['idle', 'sleep', 'read', 'phone', 'exercise', 'hungry', 'sad'];
    for (const key of stateKeys) {
      const exists = db.prepare('SELECT id FROM pet_states_lib WHERE state_key = ?').get(key);
      if (!exists) {
        const nameMap = {
          idle: '发呆', sleep: '睡觉', read: '看书', phone: '刷手机',
          exercise: '运动', hungry: '饿了', sad: '低落'
        };
        db.prepare(`
          INSERT INTO pet_states_lib (state_key, name, static_url, sort_order, is_enabled)
          VALUES (?, ?, ?, ?, ?)
        `).run(key, nameMap[key] || key, '', 0, 1);
      }
    }

  // 默认运动库（独立模块配置：非器械/器械运动，器械来源于商城器材类商品，可关联跟练课程）
  const exerciseLibCount = db.prepare('SELECT COUNT(*) as count FROM pet_exercise_lib').get().count;
  if (exerciseLibCount === 0) {
    const ropeItem = db.prepare("SELECT id FROM shop_items WHERE category = 'equipment' AND name = '基础跳绳'").get();
    const defaultExercises = [
      { exercise_key: 'walk', name: '散步', use_equipment: 0, equipment_item_id: null, has_workout: 0, workout_key: null, sort_order: 0 },
      { exercise_key: 'jump_rope', name: '跳绳', use_equipment: 1, equipment_item_id: ropeItem ? ropeItem.id : null, has_workout: 1, workout_key: 'jump_rope_10min', sort_order: 1 },
      { exercise_key: 'yoga', name: '瑜伽', use_equipment: 0, equipment_item_id: null, has_workout: 1, workout_key: 'yoga_stretch', sort_order: 2 },
      { exercise_key: 'dance', name: '跳舞', use_equipment: 0, equipment_item_id: null, has_workout: 0, workout_key: null, sort_order: 3 }
    ];
    const insertExercise = db.prepare(`
      INSERT INTO pet_exercise_lib (exercise_key, name, use_equipment, equipment_item_id, has_workout, workout_key, sort_order, is_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const ex of defaultExercises) {
      insertExercise.run(ex.exercise_key, ex.name, ex.use_equipment, ex.equipment_item_id, ex.has_workout, ex.workout_key, ex.sort_order);
    }
    console.log('[种子] 默认运动库已初始化（4 项）');
  }

  // 默认对话库
  const dialogueScenes = {
    feed: ['好吃！搭搭又有力气陪你减脂啦～', '嗯嗯，这个味道真不错，心情变好了！'],
    explore_return: ['搭搭回来啦！给你带了今天的小惊喜～', '外面风景真好，下次还想出去！'],
    reward: ['记录成功！你获得了 {berries} 颗浆果，搭搭也替你开心～', '太棒了！奖励已到账，继续加油！'],
    greet: ['嗨，今天想聊点什么？', '搭搭一直在等你哦～'],
    task_reward: ['任务完成！搭搭给你比心，奖励已到账～', '又完成一个小目标，你超棒的！', '任务达成！{berries} 颗浆果已到账，继续保持哦～'],
    checkin_reward: ['签到成功！连续 {continuousDays} 天啦，搭搭陪你一起坚持～', '今日打卡完成，离更好的自己又近了一步！', '连续签到 {continuousDays} 天！这份坚持，搭搭都看在眼里～'],
    achievement_reward: ['解锁成就「{name}」！搭搭为你骄傲～', '太厉害了！这个成就来之不易，继续冲！', '叮！成就「{name}」已解锁，你比想象中更强大～'],
    milestone_reward: ['里程碑达成：{title}！你的努力搭搭都看在眼里～', '哇！{title}，这绝对值得庆祝！', '恭喜达成「{title}」！每一步都算数，继续向前～'],
    newbie_task_reward: ['新手任务「{name}」完成！搭搭已经迫不及待看你变瘦啦～', '第一步迈得漂亮，奖励收好！'],
    joy_event: ['小确幸：{title}！生活里的甜味，搭搭也感受到了～', '今天的小美好已到账，继续加油！'],
    weight_goal_reached: ['天呐！你达到了目标体重 {targetWeight}kg，搭搭激动得转圈圈！', '目标达成！你做到了，接下来我们一起保持～', '太了不起了！{targetWeight}kg 的目标真的实现了，为你疯狂打call～'],
    pet_tap: [
      '哎呀好痒啊，没事的话和我聊聊天吧～',
      '记得完成今天的任务哦！获得浆果可以解锁专属健康食谱～',
      '今天吃了什么还没告诉我呢，快去聊聊里跟我念叨念叨～',
      '今天还没记录饮食呢，吃完的东西告诉我，我来帮你算热量！',
      '起来动一动嘛～哪怕 10 分钟拉伸也很棒哦！',
      '咕嘟咕嘟，该喝水啦！多喝水代谢才会 up up～',
      '今天的体重记录了吗？坚持记录才能看到变化曲线呀～',
      '运动跟练已经开始等你啦，完成后我陪你一起休息～',
      '完成一个小任务就能拿浆果，攒够了可以去商店给我换好吃的！',
      '嗯？快去忙你的吧！记得不要吃零食哦！',
      '可以想想下一餐吃什么，热量别超了哦！',
      '哎？无聊的话起来走走活动一下吧！',
      '最近量围度了吗？围度小了才是真的瘦了！',
      '每口都嚼20下，别贪嘴吃多哦！'
    ]
  };
  for (const [scene, texts] of Object.entries(dialogueScenes)) {
    for (const text of texts) {
      const exists = db.prepare('SELECT id FROM pet_dialogues WHERE scene = ? AND text = ?').get(scene, text);
      if (!exists) {
        db.prepare('INSERT INTO pet_dialogues (scene, text, weight, probability) VALUES (?, ?, ?, ?)')
          .run(scene, text, 1, 1.0);
      }
    }
  }

  // 默认商城商品
  const defaultShopItems = [
    { category: 'food', name: '全麦面包', price_berries: 20, effect_json: { satiety: 5, mood: 0 } },
    { category: 'food', name: '水煮鸡胸肉', price_berries: 30, effect_json: { satiety: 10, mood: 0 } },
    { category: 'food', name: '时令蔬菜沙拉', price_berries: 25, effect_json: { satiety: 8, mood: 0 } },
    { category: 'food', name: '低糖水果盘', price_berries: 20, effect_json: { satiety: 5, mood: 3 } },
    { category: 'food', name: '原味无糖酸奶', price_berries: 25, effect_json: { satiety: 8, mood: 0 } },
    { category: 'equipment', name: '基础跳绳', price_berries: 80, effect_json: { unlock_workout: 'jump_rope' }, duration_seconds: null },
    { category: 'equipment', name: '标准瑜伽垫', price_berries: 100, effect_json: { unlock_workout: 'squat_plank' }, duration_seconds: null },
    { category: 'prop', name: '普通逗趣玩具', price_berries: 30, effect_json: { mood: 10 } },
    { category: 'prop', name: '外出加速券', price_berries: 50, effect_json: { reduce_explore_seconds: 1800 } },
    { category: 'prop', name: '饱腹补充包', price_berries: 40, effect_json: { satiety: 20 } },
    { category: 'prop', name: '高级外出通行证', price_flowers: 2, effect_json: { increase_rare_drop: 0.2 } }
  ];
  for (const item of defaultShopItems) {
    const exists = db.prepare('SELECT id FROM shop_items WHERE name = ? AND category = ?').get(item.name, item.category);
    if (!exists) {
      db.prepare(`
        INSERT INTO shop_items (category, name, price_berries, price_flowers, stock, effect_json, sort_order, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(item.category, item.name, item.price_berries || 0, item.price_flowers || 0, -1, JSON.stringify(item.effect_json), 0, 1);
    }
  }
  }

  // 补全饮水提醒模板
  const waterTemplates = {
    gentle: [
      '今天已经喝了 {drank}ml 水，距离 {goal}ml 目标还差 {remaining}ml，来一口水吧～',
      '喝水时间到！目前 {drank}ml，再喝 {remaining}ml 就达标啦，慢慢来～',
      '身体在等你补水哦，今日已喝 {drank}ml，目标 {goal}ml，还剩 {remaining}ml。'
    ],
    strict: [
      '今日饮水 {drank}ml，距离 {goal}ml 还差 {remaining}ml，现在去喝。',
      '已经 {drank}ml 了，还差 {remaining}ml 才达标，别等渴了再喝。',
      '喝水打卡！当前 {drank}ml，目标 {goal}ml，立刻补 {remaining}ml。'
    ],
    tease: [
      '今天才喝 {drank}ml，距离 {goal}ml 还有 {remaining}ml，你是打算让脂肪缺水吗？',
      '喝水了吗？{drank}ml 而已，还差 {remaining}ml，杯子不是用来当摆件的。',
      '再不喝 {remaining}ml 水，代谢就要罢工了，目前进度 {drank}/{goal}ml。'
    ]
  };
  let waterOrder = 0;
  for (const [mode, list] of Object.entries(waterTemplates)) {
    for (const content of list) {
      ensureTemplateConfig('water', mode, content, waterOrder++);
    }
  }

  if (!cmsSeeded) {
  // 默认陪你动课程
  const defaultWorkouts = [
    { workout_key: 'warmup_basic', name: '基础热身', category: 'aerobic', duration_seconds: 300, calorie_per_session: 30, required_equipment_key: null, description: '5 分钟全身热身，激活关节与心肺', sort_order: 1 },
    { workout_key: 'jump_rope_10min', name: '跳绳燃脂 10 分钟', category: 'aerobic', duration_seconds: 600, calorie_per_session: 100, required_equipment_key: 'jump_rope', description: '中速跳绳，高效燃脂', sort_order: 2 },
    { workout_key: 'yoga_stretch', name: '瑜伽全身拉伸', category: 'stretch', duration_seconds: 900, calorie_per_session: 60, required_equipment_key: 'squat_plank', description: '舒缓拉伸，改善体态', sort_order: 3 },
    { workout_key: 'hiit_15min', name: '15 分钟 HIIT', category: 'aerobic', duration_seconds: 900, calorie_per_session: 150, required_equipment_key: null, description: '自重高强度间歇训练', sort_order: 4 },
    { workout_key: 'core_plank', name: '核心平板支撑', category: 'strength', duration_seconds: 600, calorie_per_session: 50, required_equipment_key: 'squat_plank', description: '强化核心肌群', sort_order: 5 }
  ];
  for (const w of defaultWorkouts) {
    const exists = db.prepare('SELECT id FROM workout_lib WHERE workout_key = ?').get(w.workout_key);
    if (!exists) {
      db.prepare(`
        INSERT INTO workout_lib (workout_key, name, category, duration_seconds, calorie_per_session, required_equipment_key, description, sort_order, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(w.workout_key, w.name, w.category, w.duration_seconds, w.calorie_per_session, w.required_equipment_key, w.description, w.sort_order);
    }
  }

  // 默认任务
  const defaultTasks = [
    { name: '每日签到', type: 'daily', condition_json: { action: 'checkin', count: 1 }, reward_berries: 10, sort_order: 1 },
    { name: '每周连续签到', type: 'weekly', condition_json: { action: 'checkin', count: 7 }, reward_berries: 0, reward_flowers: 2, sort_order: 1 },
    { name: '习惯打卡', type: 'daily', condition_json: { action: 'record_habit', count: 1 }, reward_berries: 10, sort_order: 2 },
    { name: '记录饮食', type: 'daily', condition_json: { action: 'record_diet', count: 1 }, reward_berries: 10, sort_order: 3 },
    { name: '记录运动', type: 'daily', condition_json: { action: 'record_exercise', count: 1 }, reward_berries: 10, sort_order: 3 },
    { name: '记录体重', type: 'daily', condition_json: { action: 'record_body', count: 1 }, reward_berries: 10, sort_order: 3 },
    { name: '记录排便', type: 'daily', condition_json: { action: 'record_defecation', count: 1 }, reward_berries: 10, sort_order: 5 },
    { name: '记录饮水', type: 'daily', condition_json: { action: 'record_water', count: 1 }, reward_berries: 10, sort_order: 4 },
    { name: '记录睡眠', type: 'daily', condition_json: { action: 'record_sleep', count: 1 }, reward_berries: 10, sort_order: 5 },
    { name: '记录心情', type: 'daily', condition_json: { action: 'record_mood', count: 1 }, reward_berries: 10, sort_order: 6 },
    { name: '和搭搭聊天', type: 'daily', condition_json: { action: 'chat', count: 1 }, reward_berries: 10, sort_order: 7 },
    { name: '给搭搭喂食', type: 'daily', condition_json: { action: 'feed', count: 1 }, reward_berries: 5, sort_order: 9 },
    { name: '完成外出', type: 'daily', condition_json: { action: 'explore_complete', count: 1 }, reward_berries: 10, sort_order: 10 },
    { name: '生成今日分析', type: 'daily', condition_json: { action: 'generate_analysis', count: 1 }, reward_berries: 10, sort_order: 11 },
    { name: '饮水达标', type: 'daily', condition_json: { action: 'drink_water_goal', count: 1 }, reward_berries: 5, sort_order: 12 },
    { name: '完成轻断食', type: 'daily', condition_json: { action: 'record_fasting_complete', count: 1 }, reward_berries: 15, sort_order: 13 },
    { name: '完善个人资料', type: 'once', condition_json: { action: 'complete_profile', count: 1 }, reward_berries: 10, sort_order: 101 },
    { name: '首次商城购买', type: 'once', condition_json: { action: 'shop_buy', count: 1 }, reward_berries: 10, sort_order: 102 },
    { name: '首次使用道具', type: 'once', condition_json: { action: 'use_item', count: 1 }, reward_berries: 10, sort_order: 103 },
    { name: '首次分享', type: 'once', condition_json: { action: 'share', count: 1 }, reward_berries: 10, sort_order: 104 },
    { name: '首次收藏金句', type: 'once', condition_json: { action: 'favorite', count: 1 }, reward_berries: 10, sort_order: 105 },
    { name: '首次上传对比照', type: 'once', condition_json: { action: 'upload_photo', count: 1 }, reward_berries: 10, sort_order: 106 }
  ];
  for (const task of defaultTasks) {
    const exists = db.prepare('SELECT id FROM tasks WHERE name = ? AND type = ?').get(task.name, task.type);
    if (!exists) {
      db.prepare(`
        INSERT INTO tasks (name, type, condition_json, reward_berries, reward_flowers, sort_order, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(task.name, task.type, JSON.stringify(task.condition_json), task.reward_berries || 0, task.reward_flowers || 0, task.sort_order || 0, 1);
    }
  }

  // 默认成就/里程碑
  const defaultAchievements = [
    { name: '减重 1kg', category: 'weight_loss', condition_json: { weight_loss: 1 }, reward_flowers: 5 },
    { name: '减重 3kg', category: 'weight_loss', condition_json: { weight_loss: 3 }, reward_flowers: 5 },
    { name: '减重 5kg', category: 'weight_loss', condition_json: { weight_loss: 5 }, reward_flowers: 5 },
    { name: '减重 10kg', category: 'weight_loss', condition_json: { weight_loss: 10 }, reward_flowers: 10 },
    { name: '减重 15kg', category: 'weight_loss', condition_json: { weight_loss: 15 }, reward_flowers: 10 },
    { name: '连续打卡 7 天', category: 'streak', condition_json: { checkin_streak: 7 }, reward_flowers: 2 },
    { name: '连续打卡 30 天', category: 'streak', condition_json: { checkin_streak: 30 }, reward_flowers: 5 },
    { name: '连续打卡 60 天', category: 'streak', condition_json: { checkin_streak: 60 }, reward_flowers: 5 },
    { name: '连续打卡 100 天', category: 'streak', condition_json: { checkin_streak: 100 }, reward_flowers: 10 },
    { name: '解锁 10 个事件', category: 'event_collection', condition_json: { event_count: 10 }, reward_flowers: 5 },
    { name: '解锁 30 个事件', category: 'event_collection', condition_json: { event_count: 30 }, reward_flowers: 5 },
    { name: '解锁 50 个事件', category: 'event_collection', condition_json: { event_count: 50 }, reward_flowers: 10 },
    { name: '解锁 100 个事件', category: 'event_collection', condition_json: { event_count: 100 }, reward_flowers: 10 },
    { name: '累计对话 10 轮', category: 'chat', condition_json: { chat_count: 10 }, reward_flowers: 0 },
    { name: '累计对话 100 轮', category: 'chat', condition_json: { chat_count: 100 }, reward_flowers: 5 },
    { name: '累计对话 300 轮', category: 'chat', condition_json: { chat_count: 300 }, reward_flowers: 5 },
    { name: '累计对话 500 轮', category: 'chat', condition_json: { chat_count: 500 }, reward_flowers: 10 },
    { name: '累计对话 1000 轮', category: 'chat', condition_json: { chat_count: 1000 }, reward_flowers: 10 },
    { name: '累计对话 1500 轮', category: 'chat', condition_json: { chat_count: 1500 }, reward_flowers: 20 },
    { name: '累计运动 10 次', category: 'exercise_count', condition_json: { exercise_count: 10 }, reward_flowers: 2 },
    { name: '累计运动 30 次', category: 'exercise_count', condition_json: { exercise_count: 30 }, reward_flowers: 5 },
    { name: '累计运动 50 次', category: 'exercise_count', condition_json: { exercise_count: 50 }, reward_flowers: 5 },
    { name: '累计运动 100 次', category: 'exercise_count', condition_json: { exercise_count: 100 }, reward_flowers: 10 },
    { name: '累计运动 200 次', category: 'exercise_count', condition_json: { exercise_count: 200 }, reward_flowers: 20 },
    { name: '累计运动 300 分钟', category: 'exercise_duration', condition_json: { exercise_duration: 300 }, reward_flowers: 2 },
    { name: '累计运动 600 分钟', category: 'exercise_duration', condition_json: { exercise_duration: 600 }, reward_flowers: 5 },
    { name: '累计运动 1200 分钟', category: 'exercise_duration', condition_json: { exercise_duration: 1200 }, reward_flowers: 10 },
    { name: '累计运动 2400 分钟', category: 'exercise_duration', condition_json: { exercise_duration: 2400 }, reward_flowers: 10 },
    { name: '累计运动 3600 分钟', category: 'exercise_duration', condition_json: { exercise_duration: 3600 }, reward_flowers: 20 },
    { name: '累计运动消耗 3000 千卡', category: 'exercise_calorie', condition_json: { exercise_calorie: 3000 }, reward_flowers: 2 },
    { name: '累计运动消耗 6000 千卡', category: 'exercise_calorie', condition_json: { exercise_calorie: 6000 }, reward_flowers: 5 },
    { name: '累计运动消耗 12000 千卡', category: 'exercise_calorie', condition_json: { exercise_calorie: 12000 }, reward_flowers: 10 },
    { name: '累计运动消耗 24000 千卡', category: 'exercise_calorie', condition_json: { exercise_calorie: 24000 }, reward_flowers: 10 },
    { name: '累计运动消耗 36000 千卡', category: 'exercise_calorie', condition_json: { exercise_calorie: 36000 }, reward_flowers: 20 },
    { name: '饮食记录 7 天', category: 'diet_days', condition_json: { diet_days: 7 }, reward_flowers: 2 },
    { name: '饮食记录 14 天', category: 'diet_days', condition_json: { diet_days: 14 }, reward_flowers: 5 },
    { name: '饮食记录 30 天', category: 'diet_days', condition_json: { diet_days: 30 }, reward_flowers: 5 },
    { name: '饮食记录 60 天', category: 'diet_days', condition_json: { diet_days: 60 }, reward_flowers: 10 },
    { name: '饮食记录 100 天', category: 'diet_days', condition_json: { diet_days: 100 }, reward_flowers: 20 },
    { name: '达成目标体重', category: 'weight_goal', condition_json: { weight_goal: true }, reward_flowers: 50 },
    { name: '收集 100 个事件', category: 'event_collection', condition_json: { event_count: 100 }, reward_flowers: 5 },
    { name: '收集 200 个事件', category: 'event_collection', condition_json: { event_count: 200 }, reward_flowers: 10 },
    { name: '收集 300 个事件', category: 'event_collection', condition_json: { event_count: 300 }, reward_flowers: 20 },
    { name: '收集 50 个食谱', category: 'recipe_collection', condition_json: { recipe_count: 50 }, reward_flowers: 5 },
    { name: '收集 100 个食谱', category: 'recipe_collection', condition_json: { recipe_count: 100 }, reward_flowers: 10 },
    { name: '收集 150 个食谱', category: 'recipe_collection', condition_json: { recipe_count: 150 }, reward_flowers: 15 },
    { name: '收集 200 个食谱', category: 'recipe_collection', condition_json: { recipe_count: 200 }, reward_flowers: 20 },
    { name: '坚持 7 天', category: 'duration', condition_json: { used_days: 7 }, reward_flowers: 2 },
    { name: '坚持 30 天', category: 'duration', condition_json: { used_days: 30 }, reward_flowers: 5 },
    { name: '坚持 60 天', category: 'duration', condition_json: { used_days: 60 }, reward_flowers: 5 },
    { name: '坚持 100 天', category: 'duration', condition_json: { used_days: 100 }, reward_flowers: 10 },
    { name: '坚持 180 天', category: 'duration', condition_json: { used_days: 180 }, reward_flowers: 10 },
    { name: '坚持 365 天', category: 'duration', condition_json: { used_days: 365 }, reward_flowers: 20 },
    { name: '连续 7 天饮水达标', category: 'habit', condition_json: { habit_type: 'water', streak_days: 7, goal: 2000 }, reward_flowers: 2 },
    { name: '连续 30 天饮水达标', category: 'habit', condition_json: { habit_type: 'water', streak_days: 30, goal: 2000 }, reward_flowers: 5 },
    { name: '连续 7 天睡眠打卡', category: 'habit', condition_json: { habit_type: 'sleep', streak_days: 7 }, reward_flowers: 2 },
    { name: '体脂率下降 2%', category: 'body', condition_json: { metric: 'body_fat', decrease_pct: 2 }, reward_flowers: 5 },
    { name: '体脂率下降 5%', category: 'body', condition_json: { metric: 'body_fat', decrease_pct: 5 }, reward_flowers: 10 },
    { name: '腰围减少 3cm', category: 'measure', condition_json: { metric: 'waist', decrease_cm: 3 }, reward_flowers: 5 },
    { name: '腰围减少 5cm', category: 'measure', condition_json: { metric: 'waist', decrease_cm: 5 }, reward_flowers: 10 },
    { name: '大腿围减少 2cm', category: 'measure', condition_json: { metric: 'thigh', decrease_cm: 2 }, reward_flowers: 5 },
    { name: '臀围减少 2cm', category: 'measure', condition_json: { metric: 'hip', decrease_cm: 2 }, reward_flowers: 5 },
    { name: '臂围增加 1cm', category: 'measure', condition_json: { metric: 'arm', increase_cm: 1 }, reward_flowers: 5 },
    { name: '胸围增加 1cm', category: 'measure', condition_json: { metric: 'chest', increase_cm: 1 }, reward_flowers: 5 },
    { name: '首次完成轻断食', category: 'special', condition_json: { key: 'first_fasting' }, reward_flowers: 5 },
    { name: '连续 7 天完成轻断食', category: 'special', condition_json: { key: 'fasting_streak_7' }, reward_flowers: 10 },
    { name: '每周完成 2 天 5:2 轻断食', category: 'special', condition_json: { key: 'fasting_5_2_week' }, reward_flowers: 5 }
  ];
  for (const ach of defaultAchievements) {
    const exists = db.prepare('SELECT id FROM achievements WHERE name = ?').get(ach.name);
    if (!exists) {
      db.prepare(`
        INSERT INTO achievements (name, category, condition_json, reward_flowers, sort_order, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(ach.name, ach.category, JSON.stringify(ach.condition_json), ach.reward_flowers, ach.sort_order || 0, 1);
    }
  }

  // 事件不再由代码预置种子，全部通过 CMS 事件配置维护
    setSystemMeta('cms_seeded', '1');
  }

  // 先执行迁移，确保旧库也有 ai_configs / ai_config_id 等字段
  migrateTables();

  // 初始化默认 AI Prompt
  for (const [key, content] of Object.entries(promptDefaults)) {
    ensureAiPrompt(key, content);
  }

  // 将旧版默认 Prompt 升级到搭搭小熊猫管家人设
  migratePromptsToCompanionPersona();

  // 补全主/Helper Agent 的系统规则约束（promptDefaults.js 更新后自动同步）
  migratePromptsAddSystemRuleConstraint();

  // 初始化默认 AI 配置（首次或 Prompt 未绑定配置时）
  // 统一使用腾讯云 TokenHub Hy3，三角色通过 thinking_mode 参数区分能力（见 aiConfigService.js）
  const aiConfigCount = db.prepare('SELECT COUNT(*) as count FROM ai_configs').get().count;
  if (aiConfigCount === 0) {
    const helperKey = config.llm.endpoints.helper.apiKey || config.llm.apiKey;
    const mainKey = config.llm.endpoints.main.apiKey || config.llm.apiKey;
    const precipitationKey = config.llm.endpoints.precipitation.apiKey || config.llm.apiKey;
    const backupKey = config.backup.apiKey;

    ensureAiConfig({
      name: 'Hy3-Helper（think_high）',
      provider: 'hunyuan',
      baseUrl: config.llm.baseURL,
      apiKey: helperKey,
      endpointId: config.llm.endpoints.helper.id,
      temperature: 0.5,
      maxTokens: 2000,
      timeoutMs: 120000,
      role: 'primary',
      sortOrder: 0
    });
    ensureAiConfig({
      name: 'Hy3-主Agent（no_think）',
      provider: 'hunyuan',
      baseUrl: config.llm.baseURL,
      apiKey: mainKey,
      endpointId: config.llm.endpoints.main.id,
      temperature: 0.7,
      maxTokens: 1000,
      timeoutMs: 55000,
      role: 'primary',
      sortOrder: 0
    });
    ensureAiConfig({
      name: 'Hy3-沉淀（no_think）',
      provider: 'hunyuan',
      baseUrl: config.llm.baseURL,
      apiKey: precipitationKey,
      endpointId: config.llm.endpoints.precipitation.id,
      temperature: 0.1,
      maxTokens: 1200,
      timeoutMs: 60000,
      role: 'primary',
      sortOrder: 0
    });
    ensureAiConfig({
      name: '备用模型（Hy3）',
      provider: 'hunyuan',
      baseUrl: config.backup.baseURL,
      apiKey: backupKey,
      endpointId: config.backup.endpoint.id,
      temperature: 0.7,
      maxTokens: 1000,
      timeoutMs: 60000,
      role: 'backup',
      sortOrder: 1
    });
  }

  // 为未绑定配置的 Prompt 绑定默认 AI 配置
  // 兼容处理：优先匹配 Hy3-* 名称，不存在则回退到旧名称（便于逐步迁移）
  function resolveCfgName(newName, legacyName) {
    return getConfigIdByName(newName) ? newName : legacyName;
  }
  const defaultMappings = {
    'main_agent': resolveCfgName('Hy3-主Agent（no_think）', '豆包-主Agent'),
    'helper_agent': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper'),
    'precipitation_agent': resolveCfgName('Hy3-沉淀（no_think）', '豆包-沉淀'),
    'recipe_extraction': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper'),
    'method_extraction': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper'),
    'diary_system': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper'),
    'diary_user': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper'),
    'monthly_diary': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper'),
    'plateau_analysis': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper'),
    'weight_loss_advice': resolveCfgName('Hy3-Helper（think_high）', '豆包-Helper')
  };
  for (const [key, cfgName] of Object.entries(defaultMappings)) {
    const cfgId = getConfigIdByName(cfgName);
    if (!cfgId) continue;
    db.prepare(`UPDATE ai_prompts SET ai_config_id = ? WHERE prompt_key = ? AND ai_config_id IS NULL`).run(cfgId, key);
  }

  // 初始化试用权限默认配置
  const ensureTrialConfig = (key, value, description) => {
    const existing = db.prepare('SELECT id FROM trial_system_config WHERE config_key = ?').get(key);
    if (!existing) {
      db.prepare('INSERT INTO trial_system_config (config_key, config_value, description) VALUES (?, ?, ?)')
        .run(key, value, description);
    }
  };

  ensureTrialConfig('global_enabled', '0', '限流全局总开关：0=关闭（全量放行），1=开启');
  ensureTrialConfig('grayscale_percent', '0', '灰度放量比例 0-100');
  ensureTrialConfig('ai_chat_enabled', '1', 'AI对话分项开关：0=关闭，1=开启');
  ensureTrialConfig('ai_chat_threshold', '30', 'AI对话免费试用阈值');
  ensureTrialConfig('diary_enabled', '1', '生成日记分项开关：0=关闭，1=开启');
  ensureTrialConfig('diary_threshold', '2', '生成日记免费试用阈值');
  ensureTrialConfig('popup_ai_title', '试用权限已用尽', 'AI对话弹窗标题');
  ensureTrialConfig('popup_ai_content', '您的免费试用次数已使用完毕，如需继续使用该功能，可联系客服获取正式使用授权。', 'AI对话弹窗正文');
  ensureTrialConfig('popup_ai_primary_btn', '联系客服获取授权', 'AI对话弹窗主按钮');
  ensureTrialConfig('popup_ai_secondary_btn', '取消', 'AI对话弹窗次按钮');
  ensureTrialConfig('popup_ai_contact', '客服微信号', 'AI对话客服微信号');
  ensureTrialConfig('popup_diary_title', '试用权限已用尽', '日记弹窗标题');
  ensureTrialConfig('popup_diary_content', '您的免费试用次数已使用完毕，如需继续使用该功能，可联系客服获取正式使用授权。', '日记弹窗正文');
  ensureTrialConfig('popup_diary_primary_btn', '联系客服获取授权', '日记弹窗主按钮');
  ensureTrialConfig('popup_diary_secondary_btn', '取消', '日记弹窗次按钮');
  ensureTrialConfig('popup_diary_contact', '客服微信号', '日记客服微信号');

  // 初始化里程碑文案模板（按 value 区分，便于不同档位配置不同文案）
  const milestoneDefaults = [
    { type: 'weight_loss', value: 2.5, content: '太棒了！累计减重{value}kg，你的努力正在开花结果，继续加油！' },
    { type: 'weight_loss', value: 5, content: '恭喜达成减重{value}kg里程碑！每一步都算数，你比昨天更优秀！' },
    { type: 'weight_loss', value: 10, content: '减重{value}kg达成！坚持就是胜利，你正在变成更好的自己！' },
    { type: 'weight_loss', value: 15, content: '哇！{value}kg的目标达成！你的自律和坚持让人佩服！' },
    { type: 'weight_loss', value: 20, content: '里程碑达成！{value}kg的蜕变，证明你的努力没有白费！' },
    { type: 'weight_loss', value: 30, content: '不可思议！累计减重{value}kg，你已经完成了了不起的蜕变！' },
    { type: 'duration', value: 7, content: '坚持减肥第{value}天！你的毅力让人佩服，继续冲！' },
    { type: 'duration', value: 30, content: '第{value}天打卡！日复一日的坚持，正在悄悄改变你！' },
    { type: 'duration', value: 60, content: '{value}天的坚持，你已经超越了大多数人，继续保持！' },
    { type: 'duration', value: 100, content: '恭喜坚持{value}天！习惯的力量正在带你走向更好的自己！' },
    { type: 'duration', value: 180, content: '{value}天不是终点，而是新起点，你真的很棒！' },
    { type: 'duration', value: 365, content: '整整{value}天！你已经是自律生活的主角，未来可期！' },
    { type: 'checkin', value: 7, content: '累计打卡{value}天！你的自律正在开花结果，太厉害了！' },
    { type: 'checkin', value: 30, content: '{value}天打卡达成！每一次记录都是对自己的承诺！' },
    { type: 'checkin', value: 60, content: '恭喜打卡{value}天！坚持记录的人，运气都不会太差！' },
    { type: 'checkin', value: 100, content: '{value}天的打卡记录，见证了你每一天的努力！' },
    { type: 'chat', value: 10, content: '已与搭搭对话{value}轮！你们越来越默契啦～' },
    { type: 'chat', value: 100, content: '累计对话{value}轮！搭搭已经成了你离不开的小伙伴！' },
    { type: 'chat', value: 300, content: '{value}轮深度对话！你们的友谊小船越划越远啦～' },
    { type: 'chat', value: 500, content: '哇！{value}轮对话！搭搭对你的了解越来越深啦！' },
    { type: 'chat', value: 1000, content: '累计{value}轮对话！你和搭搭的默契值爆表！' },
    { type: 'chat', value: 1500, content: '难以置信！{value}轮对话！搭搭已经是你生活的一部分！' },
    { type: 'exercise_count', value: 10, content: '累计运动{value}次！你已经迈出了健康的步伐！' },
    { type: 'exercise_count', value: 30, content: '运动{value}次达成！坚持就是胜利，继续动起来！' },
    { type: 'exercise_count', value: 50, content: '哇！{value}次运动！你的自律让人佩服！' },
    { type: 'exercise_count', value: 100, content: '累计{value}次运动！运动已经成为你生活的一部分！' },
    { type: 'exercise_count', value: 200, content: '{value}次运动达成！你就是传说中的运动达人！' },
    { type: 'exercise_duration', value: 300, content: '累计运动{value}分钟（5小时）！汗水不会白费！' },
    { type: 'exercise_duration', value: 600, content: '{value}分钟运动达成！你的坚持正在改变身体！' },
    { type: 'exercise_duration', value: 1200, content: '累计{value}分钟（20小时）！你已经超越了大多数人！' },
    { type: 'exercise_duration', value: 2400, content: '{value}分钟运动！运动已经融入你的血液！' },
    { type: 'exercise_duration', value: 3600, content: '累计{value}分钟（60小时）！你就是自律的代名词！' },
    { type: 'exercise_calorie', value: 3000, content: '累计运动消耗{value}千卡！脂肪正在远离你！' },
    { type: 'exercise_calorie', value: 6000, content: '{value}千卡消耗达成！你的努力正在开花结果！' },
    { type: 'exercise_calorie', value: 12000, content: '哇！累计消耗{value}千卡！你真的很拼！' },
    { type: 'exercise_calorie', value: 24000, content: '{value}千卡消耗！你的身体正在悄悄蜕变！' },
    { type: 'exercise_calorie', value: 36000, content: '累计{value}千卡消耗！你就是燃烧卡路里的王者！' },
    { type: 'diet_days', value: 7, content: '连续{value}天饮食打卡！你正在养成健康饮食习惯！' },
    { type: 'diet_days', value: 14, content: '{value}天饮食记录！健康饮食已经成为你的习惯！' },
    { type: 'diet_days', value: 30, content: '累计{value}天饮食打卡！你的自律让人佩服！' },
    { type: 'diet_days', value: 60, content: '{value}天饮食记录！你已经是健康饮食达人！' },
    { type: 'diet_days', value: 100, content: '累计{value}天！健康饮食已经刻进你的DNA！' },
    { type: 'weight_goal', value: 1, content: '恭喜达成目标体重！你的坚持终于收获了最美的果实！' },
    { type: 'event_collection', value: 200, content: '累计收集{value}个事件！你的生活越来越精彩！' },
    { type: 'event_collection', value: 300, content: '哇！收集{value}个事件！你的记忆库里满是美好！' },
    { type: 'recipe_collection', value: 50, content: '累计收藏{value}个食谱！你的美食库越来越丰富啦！' },
    { type: 'recipe_collection', value: 100, content: '{value}个食谱达成！你就是行走的美食达人！' },
    { type: 'recipe_collection', value: 150, content: '哇！收藏{value}个食谱！你的厨房已经成了美食殿堂！' },
    { type: 'recipe_collection', value: 200, content: '累计{value}个食谱！你的食谱库堪比米其林！' }
  ];
  const milestoneInsert = db.prepare('INSERT INTO milestone_templates (type, value, content, sort_order) VALUES (?, ?, ?, ?)');
  milestoneDefaults.forEach((item, index) => {
    const exists = db.prepare('SELECT id FROM milestone_templates WHERE type = ? AND content = ?').get(item.type, item.content);
    if (!exists) {
      milestoneInsert.run(item.type, item.value, item.content, index);
    }
  });

  // 新增用户唯一标识 user_id（6位字母+数字），并为旧数据补填
  try {
    db.exec(`ALTER TABLE users ADD COLUMN user_id VARCHAR(16) DEFAULT NULL;`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);`);
  } catch (err) {
    // 列已存在时忽略
  }
  try {
    const needIds = db.prepare(`SELECT id FROM users WHERE user_id IS NULL OR user_id = ''`).all();
    if (needIds.length > 0) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const updateStmt = db.prepare(`UPDATE users SET user_id = ? WHERE id = ?`);
      for (const row of needIds) {
        let code;
        let safe = 0;
        do {
          code = '';
          for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          safe++;
        } while ((![...code].some(c => /[a-zA-Z]/.test(c)) || ![...code].some(c => /[0-9]/.test(c)) || db.prepare('SELECT 1 FROM users WHERE user_id = ?').get(code)) && safe < 1000);
        updateStmt.run(code, row.id);
      }
    }
  } catch (err) {
    console.error('user_id 回填失败:', err.message);
  }
}

/**
 * 初始化用户陪伴系统数据（宠物、货币、背包等）
 * 新用户注册或老用户迁移时调用
 */
function initUserCompanionData(userId) {
  try {
    // 宠物
    const pet = db.prepare('SELECT id FROM pets WHERE user_id = ?').get(userId);
    if (!pet) {
      db.prepare(`
        INSERT INTO pets (user_id, species, name, level, skin_id)
        VALUES (?, 'red_panda', '搭搭', 1, 'default')
      `).run(userId);
    }

    // 宠物状态
    const petState = db.prepare('SELECT id FROM pet_states WHERE user_id = ?').get(userId);
    if (!petState) {
      db.prepare(`
        INSERT INTO pet_states (user_id, mood, satiety, location, state_key, last_decay_at)
        VALUES (?, 80, 80, 'home', 'idle', CURRENT_TIMESTAMP)
      `).run(userId);
    }

    // 货币
    const currency = db.prepare('SELECT id FROM user_currency WHERE user_id = ?').get(userId);
    if (!currency) {
      const initial = safeJsonParse(db.prepare("SELECT config_value FROM app_configs WHERE config_key = 'currency_rules'").get()?.config_value, {});
      const berries = initial.initial?.berries || 100;
      const flowers = initial.initial?.flowers || 0;
      db.prepare(`
        INSERT INTO user_currency (user_id, berries, flowers)
        VALUES (?, ?, ?)
      `).run(userId, berries, flowers);
    }
  } catch (err) {
    console.error('初始化用户陪伴数据失败:', err.message);
    throw err;
  }
}

function withTransaction(fn) {
  if (db.inTransaction) return fn();
  return db.transaction(fn)();
}

// 慢查询监控（开发环境默认开启，生产环境可通过 SLOW_QUERY_MS=0 关闭）
const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || '100', 10);
if (SLOW_QUERY_MS > 0) {
  const originalPrepare = db.prepare.bind(db);
  db.prepare = function(sql) {
    const stmt = originalPrepare(sql);
    const originalRun = stmt.run.bind(stmt);
    const originalGet = stmt.get.bind(stmt);
    const originalAll = stmt.all.bind(stmt);

    function logSlow(method, args, duration) {
      if (duration > SLOW_QUERY_MS) {
        console.warn(`[慢查询] ${duration}ms | ${method} | ${sql.slice(0, 200)}`);
      }
    }

    stmt.run = function(...args) {
      const start = Date.now();
      const result = originalRun(...args);
      logSlow('run', args, Date.now() - start);
      return result;
    };
    stmt.get = function(...args) {
      const start = Date.now();
      const result = originalGet(...args);
      logSlow('get', args, Date.now() - start);
      return result;
    };
    stmt.all = function(...args) {
      const start = Date.now();
      const result = originalAll(...args);
      logSlow('all', args, Date.now() - start);
      return result;
    };
    return stmt;
  };
}

module.exports = {
  db,
  initTables,
  initSeedData,
  migrateTables,
  initUserCompanionData,
  withTransaction
};
