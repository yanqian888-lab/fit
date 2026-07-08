/**
 * SQLite 数据库连接与初始化
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { DEFAULT_USER_AGREEMENT, DEFAULT_PRIVACY_POLICY, DEFAULT_ABOUT_US } = require('./config/policies');
const promptDefaults = require('./config/promptDefaults');

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
      user_id VARCHAR(16) UNIQUE DEFAULT NULL,
      openid VARCHAR(64) UNIQUE DEFAULT NULL,
      unionid VARCHAR(64) DEFAULT NULL,
      username VARCHAR(16) UNIQUE DEFAULT NULL,
      password_hash VARCHAR(255) DEFAULT NULL,
      plain_password VARCHAR(16) DEFAULT NULL,
      nickname VARCHAR(64) DEFAULT '减肥搭子用户',
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
      type VARCHAR(32) NOT NULL CHECK(type IN ('weight_loss', 'duration', 'checkin')),
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

  // 保留明文密码字段供 CMS 查看（内部管理使用）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN plain_password VARCHAR(16) DEFAULT NULL;`);
  } catch (err) {
    // 列已存在时忽略
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
        type VARCHAR(32) NOT NULL CHECK(type IN ('weight_loss', 'duration', 'checkin')),
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

  // 先执行迁移，确保旧库也有 ai_configs / ai_config_id 等字段
  migrateTables();

  // 初始化默认 AI Prompt
  for (const [key, content] of Object.entries(promptDefaults)) {
    ensureAiPrompt(key, content);
  }

  // 初始化默认 AI 配置（首次或 Prompt 未绑定配置时）
  const aiConfigCount = db.prepare('SELECT COUNT(*) as count FROM ai_configs').get().count;
  if (aiConfigCount === 0) {
    const helperKey = config.doubao.endpoints.helper.apiKey || config.doubao.apiKey;
    const mainKey = config.doubao.endpoints.main.apiKey || config.doubao.apiKey;
    const precipitationKey = config.doubao.endpoints.precipitation.apiKey || config.doubao.apiKey;
    const backupKey = config.backup.apiKey;

    ensureAiConfig({
      name: '豆包-Helper',
      provider: 'doubao',
      baseUrl: config.doubao.baseURL,
      apiKey: helperKey,
      endpointId: config.doubao.endpoints.helper.id,
      temperature: 0.7,
      maxTokens: 500,
      timeoutMs: 30000,
      role: 'primary',
      sortOrder: 0
    });
    ensureAiConfig({
      name: '豆包-主Agent',
      provider: 'doubao',
      baseUrl: config.doubao.baseURL,
      apiKey: mainKey,
      endpointId: config.doubao.endpoints.main.id,
      temperature: 0.7,
      maxTokens: 1000,
      timeoutMs: 30000,
      role: 'primary',
      sortOrder: 0
    });
    ensureAiConfig({
      name: '豆包-沉淀',
      provider: 'doubao',
      baseUrl: config.doubao.baseURL,
      apiKey: precipitationKey,
      endpointId: config.doubao.endpoints.precipitation.id,
      temperature: 0.3,
      maxTokens: 2000,
      timeoutMs: 30000,
      role: 'primary',
      sortOrder: 0
    });
    ensureAiConfig({
      name: '备用模型',
      provider: 'doubao',
      baseUrl: config.backup.baseURL,
      apiKey: backupKey,
      endpointId: config.backup.endpoint.id,
      temperature: 0.7,
      maxTokens: 1000,
      timeoutMs: 30000,
      role: 'backup',
      sortOrder: 1
    });
  }

  // 为未绑定配置的 Prompt 绑定默认 AI 配置
  const defaultMappings = {
    'main_agent': '豆包-主Agent',
    'helper_agent': '豆包-Helper',
    'precipitation_agent': '豆包-沉淀',
    'recipe_extraction': '豆包-Helper',
    'method_extraction': '豆包-Helper',
    'diary_system': '豆包-Helper',
    'diary_user': '豆包-Helper',
    'monthly_diary': '豆包-Helper',
    'plateau_analysis': '豆包-Helper'
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

  // 初始化里程碑文案模板
  const milestoneTemplateCount = db.prepare('SELECT COUNT(*) as count FROM milestone_templates').get().count;
  if (milestoneTemplateCount === 0) {
    const defaults = [
      { type: 'weight_loss', content: '太棒了！累计减重{value}kg，你的努力正在开花结果，继续加油！' },
      { type: 'weight_loss', content: '恭喜达成减重{value}kg里程碑！每一步都算数，你比昨天更优秀！' },
      { type: 'weight_loss', content: '减重{value}kg达成！坚持就是胜利，你正在变成更好的自己！' },
      { type: 'weight_loss', content: '哇！{value}kg的目标达成！你的自律和坚持让人佩服！' },
      { type: 'weight_loss', content: '里程碑达成！{value}kg的蜕变，证明你的努力没有白费！' },
      { type: 'duration', content: '坚持减肥第{value}天！你的毅力让人佩服，继续冲！' },
      { type: 'duration', content: '第{value}天打卡！日复一日的坚持，正在悄悄改变你！' },
      { type: 'duration', content: '{value}天的坚持，你已经超越了大多数人，继续保持！' },
      { type: 'duration', content: '恭喜坚持{value}天！习惯的力量正在带你走向更好的自己！' },
      { type: 'duration', content: '{value}天不是终点，而是新起点，你真的很棒！' },
      { type: 'checkin', content: '累计打卡{value}天！你的自律正在开花结果，太厉害了！' },
      { type: 'checkin', content: '{value}天打卡达成！每一次记录都是对自己的承诺！' },
      { type: 'checkin', content: '恭喜打卡{value}天！坚持记录的人，运气都不会太差！' },
      { type: 'checkin', content: '{value}天的打卡记录，见证了你每一天的努力！' },
      { type: 'checkin', content: '打卡{value}天！你的坚持正在悄悄改变一切！' }
    ];
    const insert = db.prepare('INSERT INTO milestone_templates (type, content, sort_order) VALUES (?, ?, ?)');
    defaults.forEach((item, index) => insert.run(item.type, item.content, index));
  }

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

module.exports = {
  db,
  initTables,
  initSeedData,
  migrateTables
};
