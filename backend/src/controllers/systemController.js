/**
 * 系统数据控制器
 */
const { db, withTransaction } = require('../db');
const { success, error } = require('../utils/response');
const { invalidateAppConfig } = require('../utils/configCache');

// 常见计量单位（长的在前，避免"小碗"被"碗"截断）
const MEASURE_UNITS = ['小碗', '大碗', '中碗', '小杯', '大杯', '中杯', '个', '颗', '粒', '碗', '杯', '根', '段', '块', '片', '勺', '袋', '盒', '瓶', '串', '份', '只', '条', '听', '罐', '支', '卷', '把', '盘', '碟', '屉', '枚', '颗(大)', '颗(小)'];

function pickKcal(text) {
  const m = String(text).match(/≈?\s*(\d+(?:\.\d+)?)\s*(?:kcal|千卡)/i);
  return m ? parseFloat(m[1]) : null;
}

/**
 * 解析 common_unit 文本（如 "10颗（50g）≈ 132 kcal"、"1个中等（200g）"、"300ml瓶≈135 kcal"、"1份≈353 kcal"）
 * 返回 { unit, unit_weight, unit_calorie }：单位名、每单位克数、每单位热量（后两者可空）
 */
function parseCommonUnit(commonUnit) {
  const text = String(commonUnit || '').trim();
  if (!text) return { unit: null, unit_weight: null, unit_calorie: null };

  // 反向写法：容量+容器单位，如 "300ml瓶"、"250毫升盒"（液体 ml≈g）
  let m = text.match(/^(\d+(?:\.\d+)?)\s*(ml|毫升|g|克)([一-龥]+)/i);
  if (m && m[3].length <= 2) {
    const grams = parseFloat(m[1]);
    const kcal = pickKcal(text);
    return {
      unit: m[3],
      unit_weight: grams,
      unit_calorie: kcal ? Math.round(kcal * 10) / 10 : null
    };
  }

  // 正向写法：数量+单位+可选（克数），如 "10颗（50g）"、"1个中等（200g）"、"1份"
  m = text.match(/^(\d+(?:\.\d+)?)([一-龥]+?)(?:（(\d+(?:\.\d+)?)\s*(?:g|克|ml|毫升)）)?/);
  if (!m) return { unit: null, unit_weight: null, unit_calorie: null };
  const count = parseFloat(m[1]);
  const rawUnit = m[2];
  const unit = MEASURE_UNITS.find(u => rawUnit.startsWith(u)) || rawUnit;
  const grams = m[3] ? parseFloat(m[3]) : null;
  const kcal = pickKcal(text);
  return {
    unit,
    unit_weight: count && grams ? Math.round((grams / count) * 10) / 10 : null,
    unit_calorie: count && kcal ? Math.round((kcal / count) * 10) / 10 : null
  };
}

/**
 * 获取食物数据库（含自定义与收藏标记）
 */
function getFoods(req, res) {
  const userId = req.userId;
  const keyword = req.query.keyword || '';
  const category = req.query.category || '';
  const favoritesOnly = req.query.favorites === '1';
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
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
    // 解析 common_unit 为结构化单位（个/颗/碗 + 每单位克数），前端按个数记录时用
    ...parseCommonUnit(item.common_unit),
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

  return res.json(success({ ...item, ...parseCommonUnit(item.common_unit || item.unit), source, is_favorite: favorite ? 1 : 0 }));
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

  if (!name || name.length > 50) {
    return res.status(400).json(error('食物名称不能为空且不能超过 50 字', 400));
  }

  // 营养素数值校验
  const nutrients = {
    calorie_per_100g: calorie_per_100g || 0,
    protein_per_100g: protein_per_100g || 0,
    carb_per_100g: carb_per_100g || 0,
    fat_per_100g: fat_per_100g || 0,
    fiber_per_100g: fiber_per_100g || 0
  };
  for (const [key, val] of Object.entries(nutrients)) {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 1000) {
      return res.status(400).json(error(`${key} 必须是 0-1000 之间的数值`, 400));
    }
    nutrients[key] = num;
  }
  const giValue = gi !== undefined && gi !== null ? parseFloat(gi) : null;
  if (giValue !== null && (isNaN(giValue) || giValue < 0 || giValue > 100)) {
    return res.status(400).json(error('GI 值必须是 0-100 之间的数值', 400));
  }

  const publicFlag = is_public === true || is_public === 1 ? 1 : 0;
  const status = publicFlag === 1 ? 'pending' : 'approved';

  const insertId = db.prepare(`
    INSERT INTO custom_foods (user_id, name, category, calorie_per_100g, protein_per_100g, carb_per_100g, fat_per_100g, fiber_per_100g, gi, unit, is_public, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, category || null, nutrients.calorie_per_100g, nutrients.protein_per_100g, nutrients.carb_per_100g, nutrients.fat_per_100g, nutrients.fiber_per_100g, giValue, unit || 'g', publicFlag, status).lastInsertRowid;

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
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
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

  const profile = db.prepare('SELECT water_goal FROM user_profiles WHERE user_id = ?').get(userId);

  return res.json(success({
    ...settings,
    water_goal: profile?.water_goal || 2000
  }));
}

/**
 * 更新用户设置
 */
function updateSettings(req, res) {
  const userId = req.userId;
  const { notification_enabled, reminder_weight, reminder_water, reminder_exercise, dnd_start, dnd_end, theme, font_size, data_storage, cloud_backup_enabled, water_goal, guide_completed } = req.body;

  if (water_goal !== undefined && water_goal !== null) {
    const goal = parseInt(water_goal);
    if (isNaN(goal) || goal < 500 || goal > 5000) {
      return res.status(400).json(error('每日饮水目标需在 500-5000ml 之间', 400));
    }
  }
  if (guide_completed !== undefined && guide_completed !== null && ![0, 1, true, false].includes(guide_completed)) {
    return res.status(400).json(error('guide_completed 格式不正确', 400));
  }

  withTransaction(() => {
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
        guide_completed = COALESCE(?, guide_completed),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      notification_enabled, reminder_weight, reminder_water, reminder_exercise,
      dnd_start, dnd_end, theme, font_size, data_storage, cloud_backup_enabled,
      guide_completed,
      userId
    );

    if (water_goal !== undefined && water_goal !== null) {
      db.prepare('UPDATE user_profiles SET water_goal = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(parseInt(water_goal), userId);
    }
  });

  return res.json(success(null, '更新成功'));
}

/**
 * 获取应用全局配置（用户协议、隐私政策、开关等）
 * 公开接口，无需登录，供启动页/协议页调用
 */
function getAppConfig(req, res) {
  const keys = ['user_agreement', 'user_agreement_url', 'privacy_policy', 'privacy_policy_url', 'privacy_version', 'force_privacy_update', 'about_us_content', 'delete_account_agreement', 'mp_qrcode_url'];
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
    about_us_content: config.about_us_content || '',
    delete_account_agreement: config.delete_account_agreement || '',
    mp_qrcode_url: config.mp_qrcode_url || ''
  }));
}

/**
 * 更新应用全局配置（管理员）
 */
function updateAppConfig(req, res) {
  const allowed = ['user_agreement', 'user_agreement_url', 'privacy_policy', 'privacy_policy_url', 'privacy_version', 'force_privacy_update', 'about_us_content', 'mp_qrcode_url'];
  const updates = req.body || {};

  const update = db.prepare('INSERT INTO app_configs (config_key, config_value) VALUES (?, ?) ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = CURRENT_TIMESTAMP');

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      let value = updates[key];
      if (key === 'force_privacy_update') value = value ? '1' : '0';
      update.run(key, String(value ?? ''));
      invalidateAppConfig(key);
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
