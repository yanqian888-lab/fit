/**
 * 系统数据控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

/**
 * 获取食物数据库（含自定义与收藏标记）
 */
function getFoods(req, res) {
  const userId = req.userId;
  const keyword = req.query.keyword || '';
  const category = req.query.category || '';
  const favoritesOnly = req.query.favorites === '1';
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  const favIds = new Set(
    db.prepare('SELECT food_id FROM favorite_foods WHERE user_id = ? AND is_common = 1').all(userId).map(r => r.food_id)
  );

  // 分类映射：前端key -> 数据库category值
  const categoryMap = {
    'staple': '主食类',
    'vegetable': '蔬菜水果类',
    'meat': '肉蛋奶类',
    'bean': '豆类坚果类',
    'snack': '零食饮料类',
    'dish': '中西菜肴类',
    'seasoning': '调味油脂类',
    'meal_replacement': '代餐特殊食品'
  };

  const parts = [];
  const params = [];

  // 1) 公共食物库
  if (category !== 'custom') {
    let commonSql = `
      SELECT 'common' as source, id, food_name as name, category, sub_category, calories_per_100g as calorie_per_100g,
             protein_per_100g, carb_per_100g, fat_per_100g,
             common_unit, edible_rate, remark, created_at
      FROM food_db WHERE 1=1
    `;
    if (keyword) {
      commonSql += ' AND food_name LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (category && category !== 'all') {
      const mapped = categoryMap[category];
      if (mapped) {
        commonSql += ' AND category = ?';
        params.push(mapped);
      }
    }
    parts.push(commonSql);
  }

  // 2) 当前用户自定义食物（自定义 tab 只显示这部分）
  let customSql = `
    SELECT 'custom' as source, id, name, category, '' as sub_category, calorie_per_100g,
           protein_per_100g, carb_per_100g, fat_per_100g,
           unit as common_unit, 1.0 as edible_rate, '' as remark, created_at
    FROM custom_foods WHERE user_id = ?
  `;
  params.push(userId);
  if (keyword) {
    customSql += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }
  if (category && category !== 'all' && category !== 'custom') {
    const mapped = categoryMap[category];
    if (mapped) {
      customSql += ' AND category = ?';
      params.push(mapped);
    }
  }
  parts.push(customSql);

  // 3) 其他用户公开且审核通过的自定义食物
  if (category !== 'custom') {
    let publicSql = `
      SELECT 'custom' as source, id, name, category, '' as sub_category, calorie_per_100g,
             protein_per_100g, carb_per_100g, fat_per_100g,
             unit as common_unit, 1.0 as edible_rate, '' as remark, created_at
      FROM custom_foods WHERE user_id != ? AND is_public = 1 AND status = 'approved'
    `;
    params.push(userId);
    if (keyword) {
      publicSql += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (category && category !== 'all') {
      const mapped = categoryMap[category];
      if (mapped) {
        publicSql += ' AND category = ?';
        params.push(mapped);
      }
    }
    parts.push(publicSql);
  }

  const sql = parts.join(' UNION ALL ');

  const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
  const total = db.prepare(countSql).all(...params)[0].count;

  const pagedSql = sql + ' ORDER BY name ASC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(pagedSql).all(...params).map(item => ({
    ...item,
    is_favorite: favIds.has(item.id) ? 1 : 0
  }));

  if (favoritesOnly) {
    const filtered = list.filter(item => item.is_favorite);
    return res.json(success({ list: filtered, pagination: { page, size, total: filtered.length, has_more: false } }));
  }

  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

/**
 * 获取食物详情
 */
function getFoodDetail(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const source = req.query.source || 'common';

  let item;
  if (source === 'custom') {
    item = db.prepare('SELECT * FROM custom_foods WHERE id = ? AND user_id = ?').get(id, userId);
  } else {
    item = db.prepare('SELECT id, food_name as name, category, sub_category, calories_per_100g as calorie_per_100g, protein_per_100g, carb_per_100g, fat_per_100g, common_unit, edible_rate, remark, created_at FROM food_db WHERE id = ?').get(id);
  }

  if (!item) {
    return res.status(404).json(error('食物不存在', 404));
  }

  const favorite = db.prepare('SELECT id FROM favorite_foods WHERE user_id = ? AND food_id = ?').get(userId, id);

  return res.json(success({ ...item, source, is_favorite: favorite ? 1 : 0 }));
}

/**
 * 切换食物收藏
 */
function toggleFavoriteFood(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM favorite_foods WHERE user_id = ? AND food_id = ?').get(userId, id);

  if (existing) {
    db.prepare('DELETE FROM favorite_foods WHERE id = ?').run(existing.id);
    return res.json(success({ is_favorite: 0 }, '已取消收藏'));
  }

  db.prepare('INSERT INTO favorite_foods (user_id, food_id) VALUES (?, ?)').run(userId, id);
  return res.json(success({ is_favorite: 1 }, '收藏成功'));
}

/**
 * 添加自定义食物
 */
function addCustomFood(req, res) {
  const userId = req.userId;
  const { name, category, calorie_per_100g, protein_per_100g, carb_per_100g, fat_per_100g, fiber_per_100g, gi, unit, is_public } = req.body;

  if (!name) {
    return res.status(400).json(error('食物名称不能为空', 400));
  }

  const publicFlag = is_public === true || is_public === 1 ? 1 : 0;
  const status = publicFlag === 1 ? 'pending' : 'approved';

  const insertId = db.prepare(`
    INSERT INTO custom_foods (user_id, name, category, calorie_per_100g, protein_per_100g, carb_per_100g, fat_per_100g, fiber_per_100g, gi, unit, is_public, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, category || null, calorie_per_100g || 0, protein_per_100g || 0, carb_per_100g || 0, fat_per_100g || 0, fiber_per_100g || 0, gi || null, unit || 'g', publicFlag, status).lastInsertRowid;

  return res.json(success({ id: insertId, status }, publicFlag === 1 ? '已提交审核' : '添加成功'));
}

/**
 * 获取运动数据库
 */
function getExercises(req, res) {
  const userId = req.userId;
  const keyword = req.query.keyword || '';
  const category = req.query.category || '';
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
  const offset = (page - 1) * size;

  const favIds = new Set(
    db.prepare('SELECT exercise_id FROM favorite_exercises WHERE user_id = ? AND is_common = 1').all(userId).map(r => r.exercise_id)
  );

  let sql = `
    SELECT 'common' as source, id, exercise_name as name, category, sub_category, met_value, intensity_desc as intensity, calorie_per_hour, remark as description, created_at
    FROM exercise_db WHERE 1=1
  `;
  const params = [];

  if (keyword) {
    sql += ' AND exercise_name LIKE ?';
    params.push(`%${keyword}%`);
  }

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += `
    UNION ALL
    SELECT 'custom' as source, id, name, type as category, '' as sub_category, 0 as met_value, intensity, calorie_per_hour, '' as description, created_at
    FROM custom_exercises WHERE user_id = ?
  `;
  params.push(userId);

  if (keyword) {
    sql += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }

  // 注意：custom_exercises 表没有 category 列，只有 type 列
  // 如果需要按 category 筛选自定义运动，需要额外处理
  // 这里暂时不筛选自定义运动的 category，避免 SQL 错误

  const countSql = `SELECT COUNT(*) as count FROM (${sql})`;
  const total = db.prepare(countSql).all(...params)[0].count;

  sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
  params.push(size, offset);

  const list = db.prepare(sql).all(...params).map(item => ({
    ...item,
    is_favorite: favIds.has(item.id) ? 1 : 0
  }));

  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

/**
 * 获取运动详情
 */
function getExerciseDetail(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const source = req.query.source || 'common';

  let item;
  if (source === 'custom') {
    item = db.prepare("SELECT id, name, type as category, '' as sub_category, 0 as met_value, intensity, calorie_per_hour, '' as description, created_at FROM custom_exercises WHERE id = ? AND user_id = ?").get(id, userId);
  } else {
    item = db.prepare('SELECT id, exercise_name as name, category, sub_category, met_value, intensity_desc as intensity, calorie_per_hour, remark as description, created_at FROM exercise_db WHERE id = ?').get(id);
  }

  if (!item) {
    return res.status(404).json(error('运动不存在', 404));
  }

  const favorite = db.prepare('SELECT id FROM favorite_exercises WHERE user_id = ? AND exercise_id = ?').get(userId, id);

  return res.json(success({ ...item, source, is_favorite: favorite ? 1 : 0 }));
}

/**
 * 切换运动收藏
 */
function toggleFavoriteExercise(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM favorite_exercises WHERE user_id = ? AND exercise_id = ?').get(userId, id);

  if (existing) {
    db.prepare('DELETE FROM favorite_exercises WHERE id = ?').run(existing.id);
    return res.json(success({ is_favorite: 0 }, '已取消收藏'));
  }

  db.prepare('INSERT INTO favorite_exercises (user_id, exercise_id) VALUES (?, ?)').run(userId, id);
  return res.json(success({ is_favorite: 1 }, '收藏成功'));
}

/**
 * 添加自定义运动
 */
function addCustomExercise(req, res) {
  const userId = req.userId;
  const { name, category, met_value, intensity, calorie_per_hour, description } = req.body;

  if (!name) {
    return res.status(400).json(error('运动名称不能为空', 400));
  }

  const insertId = db.prepare(`
    INSERT INTO custom_exercises (user_id, name, type, calorie_per_hour, intensity)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, name, category || 'aerobic', calorie_per_hour || 0, intensity || 'moderate').lastInsertRowid;

  return res.json(success({ id: insertId }, '添加成功'));
}

/**
 * 获取用户设置
 */
function getSettings(req, res) {
  const userId = req.userId;
  let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  
  if (!settings) {
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
    settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  }

  return res.json(success(settings));
}

/**
 * 更新用户设置
 */
function updateSettings(req, res) {
  const userId = req.userId;
  const { notification_enabled, reminder_weight, reminder_water, reminder_exercise, dnd_start, dnd_end, theme, font_size, data_storage, cloud_backup_enabled } = req.body;

  db.prepare(`
    UPDATE settings SET
      notification_enabled = COALESCE(?, notification_enabled),
      reminder_weight = COALESCE(?, reminder_weight),
      reminder_water = COALESCE(?, reminder_water),
      reminder_exercise = COALESCE(?, reminder_exercise),
      dnd_start = COALESCE(?, dnd_start),
      dnd_end = COALESCE(?, dnd_end),
      theme = COALESCE(?, theme),
      font_size = COALESCE(?, font_size),
      data_storage = COALESCE(?, data_storage),
      cloud_backup_enabled = COALESCE(?, cloud_backup_enabled),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    notification_enabled, reminder_weight, reminder_water, reminder_exercise,
    dnd_start, dnd_end, theme, font_size, data_storage, cloud_backup_enabled,
    userId
  );

  return res.json(success(null, '更新成功'));
}

/**
 * 获取应用全局配置（用户协议、隐私政策、开关等）
 * 公开接口，无需登录，供启动页/协议页调用
 */
function getAppConfig(req, res) {
  const keys = ['user_agreement', 'user_agreement_url', 'privacy_policy', 'privacy_policy_url', 'privacy_version', 'force_privacy_update', 'about_us_content'];
  const rows = db.prepare(`SELECT config_key, config_value FROM app_configs WHERE config_key IN (${keys.map(() => '?').join(',')})`).all(...keys);
  const config = {};
  for (const row of rows) {
    config[row.config_key] = row.config_value;
  }
  for (const key of keys) {
    if (!(key in config)) config[key] = '';
  }
  return res.json(success({
    user_agreement: config.user_agreement || '',
    user_agreement_url: config.user_agreement_url || '',
    privacy_policy: config.privacy_policy || '',
    privacy_policy_url: config.privacy_policy_url || '',
    privacy_version: config.privacy_version || '1.0.0',
    force_privacy_update: config.force_privacy_update === '1' || config.force_privacy_update === 'true',
    about_us_content: config.about_us_content || ''
  }));
}

/**
 * 更新应用全局配置（管理员）
 */
function updateAppConfig(req, res) {
  const allowed = ['user_agreement', 'user_agreement_url', 'privacy_policy', 'privacy_policy_url', 'privacy_version', 'force_privacy_update', 'about_us_content'];
  const updates = req.body || {};

  const update = db.prepare('INSERT INTO app_configs (config_key, config_value) VALUES (?, ?) ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = CURRENT_TIMESTAMP');

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      let value = updates[key];
      if (key === 'force_privacy_update') value = value ? '1' : '0';
      update.run(key, String(value ?? ''));
    }
  }

  return res.json(success(null, '更新成功'));
}

module.exports = {
  getFoods,
  getFoodDetail,
  toggleFavoriteFood,
  addCustomFood,
  getExercises,
  getExerciseDetail,
  toggleFavoriteExercise,
  addCustomExercise,
  getSettings,
  updateSettings,
  getAppConfig,
  updateAppConfig
};
