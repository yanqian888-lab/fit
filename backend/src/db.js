/**
 * SQLite 数据库连接与初始化
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.db.path);

// 启用外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * 初始化数据库表
 */
function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid VARCHAR(64) UNIQUE NOT NULL,
      unionid VARCHAR(64) DEFAULT NULL,
      nickname VARCHAR(64) DEFAULT '减肥搭子用户',
      avatar_url VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      gender TINYINT DEFAULT 0,
      age TINYINT DEFAULT NULL,
      height DECIMAL(5,2) DEFAULT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME DEFAULT NULL
    );

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      name VARCHAR(32) DEFAULT '瘦瘦',
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

    CREATE TABLE IF NOT EXISTS exercise_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      precipitation_id INTEGER DEFAULT NULL,
      record_date DATE NOT NULL,
      exercise_type VARCHAR(16) NOT NULL,
      exercises TEXT NOT NULL,
      total_duration INT DEFAULT 0,
      total_calorie DECIMAL(8,2) DEFAULT 0,
      remark VARCHAR(255) DEFAULT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_exercise_user_date ON exercise_records(user_id, record_date);

    CREATE TABLE IF NOT EXISTS body_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      precipitation_id INTEGER DEFAULT NULL,
      record_date DATE NOT NULL,
      type VARCHAR(16) NOT NULL,
      value DECIMAL(6,2) NOT NULL,
      unit VARCHAR(8) NOT NULL,
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (precipitation_id) REFERENCES precipitation_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_body_user_date ON body_records(user_id, record_date);

    CREATE TABLE IF NOT EXISTS museum_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
      status TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_museum_user_type ON museum_items(user_id, type, created_at);

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
      name VARCHAR(64) NOT NULL,
      category VARCHAR(32) DEFAULT NULL,
      calorie_per_100g DECIMAL(8,2) DEFAULT 0,
      protein_per_100g DECIMAL(6,2) DEFAULT 0,
      carb_per_100g DECIMAL(6,2) DEFAULT 0,
      fat_per_100g DECIMAL(6,2) DEFAULT 0,
      fiber_per_100g DECIMAL(6,2) DEFAULT 0,
      gi DECIMAL(5,2) DEFAULT NULL,
      is_common TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_food_name ON food_db(name);

    CREATE TABLE IF NOT EXISTS exercise_db (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(64) NOT NULL,
      type VARCHAR(16) NOT NULL,
      calorie_per_hour DECIMAL(8,2) DEFAULT 0,
      intensity VARCHAR(16) DEFAULT 'moderate',
      is_common TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_exercise_name ON exercise_db(name);

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
  `);
}

/**
 * 初始化基础数据
 */
function initSeedData() {
  const foodCount = db.prepare('SELECT COUNT(*) as count FROM food_db').get().count;
  if (foodCount === 0) {
    const insertFood = db.prepare(`
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
      ('奶茶', '饮品', 65, 1.2, 12.0, 2.5),
      ('牛肉面', '外卖', 150, 6.0, 20.0, 4.5)
    `);
    insertFood.run();
  }

  const exerciseCount = db.prepare('SELECT COUNT(*) as count FROM exercise_db').get().count;
  if (exerciseCount === 0) {
    const insertExercise = db.prepare(`
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
      ('做家务', 'daily', 150, 'low')
    `);
    insertExercise.run();
  }
}

module.exports = {
  db,
  initTables,
  initSeedData
};
