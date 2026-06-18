/**
 * 记录中心控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const helperAgent = require('../services/agents/helperAgent');

/**
 * 获取今日概览
 */
function getToday(req, res) {
  const userId = req.userId;
  const today = new Date().toISOString().split('T')[0];

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  const nutrition = helperAgent.getTodayNutrition(userId);

  // 今日体重
  const todayWeight = db.prepare(`
    SELECT value, unit FROM body_records
    WHERE user_id = ? AND record_date = ? AND type = 'weight' AND status = 1
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, today);

  // 昨日体重
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayWeight = db.prepare(`
    SELECT value FROM body_records
    WHERE user_id = ? AND record_date = ? AND type = 'weight' AND status = 1
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, yesterday);

  // 待确认数量
  const pendingCount = db.prepare(`
    SELECT COUNT(*) as count FROM precipitation_records
    WHERE user_id = ? AND status = 0
  `).get(userId).count;

  const target = profile ? (profile.daily_calorie_target || 1500) : 1500;
  const remaining = target - nutrition.intake + nutrition.burned;

  let status = 'green';
  if (remaining < -300) status = 'red';
  else if (remaining < 0) status = 'yellow';

  let weightChange = null;
  if (todayWeight && yesterdayWeight) {
    weightChange = parseFloat((todayWeight.value - yesterdayWeight.value).toFixed(2));
  }

  // 计算三大营养素比例
  const totalMacro = nutrition.protein * 4 + nutrition.carb * 4 + nutrition.fat * 9;
  const proteinRatio = totalMacro > 0 ? Math.round((nutrition.protein * 4 / totalMacro) * 100) : 0;
  const carbRatio = totalMacro > 0 ? Math.round((nutrition.carb * 4 / totalMacro) * 100) : 0;
  const fatRatio = totalMacro > 0 ? Math.round((nutrition.fat * 9 / totalMacro) * 100) : 0;

  return res.json(success({
    date: today,
    intake: Math.round(nutrition.intake),
    burned: Math.round(nutrition.burned),
    remaining: Math.round(remaining),
    target: Math.round(target),
    status,
    current_weight: todayWeight ? todayWeight.value : (profile ? profile.current_weight : null),
    weight_change: weightChange,
    protein_ratio: proteinRatio,
    carb_ratio: carbRatio,
    fat_ratio: fatRatio,
    exercise_duration: nutrition.exercise_duration,
    pending_count: pendingCount
  }));
}

/**
 * 获取饮食记录
 */
function getDiet(req, res) {
  const userId = req.userId;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT * FROM diet_records
    WHERE user_id = ? AND record_date = ?
    ORDER BY created_at DESC
  `).all(userId, date);

  const meals = { breakfast: [], lunch: [], dinner: [], snack: [] };
  let totalCalorie = 0;

  rows.forEach(row => {
    totalCalorie += row.total_calorie || 0;
    meals[row.meal_time] = meals[row.meal_time] || [];
    meals[row.meal_time].push({
      id: row.id,
      foods: JSON.parse(row.foods || '[]'),
      total_calorie: row.total_calorie,
      total_protein: row.total_protein,
      total_carb: row.total_carb,
      total_fat: row.total_fat,
      tags: row.tags,
      remark: row.remark,
      status: row.status
    });
  });

  return res.json(success({
    date,
    total_calorie: totalCalorie,
    meals
  }));
}

/**
 * 添加/编辑饮食记录
 */
function saveDiet(req, res) {
  const userId = req.userId;
  const { id, record_date, meal_time, foods, tags, remark } = req.body;

  const totalCalorie = foods.reduce((sum, f) => sum + (f.calorie || 0), 0);
  const totalProtein = foods.reduce((sum, f) => sum + (f.protein || 0), 0);
  const totalCarb = foods.reduce((sum, f) => sum + (f.carb || 0), 0);
  const totalFat = foods.reduce((sum, f) => sum + (f.fat || 0), 0);

  if (id) {
    db.prepare(`
      UPDATE diet_records
      SET record_date = ?, meal_time = ?, foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, tags = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(record_date, meal_time, JSON.stringify(foods), totalCalorie, totalProtein, totalCarb, totalFat, tags, remark, id, userId);
    return res.json(success(null, '更新成功'));
  } else {
    const insertId = db.prepare(`
      INSERT INTO diet_records (user_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, tags, remark, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(userId, record_date, meal_time, JSON.stringify(foods), totalCalorie, totalProtein, totalCarb, totalFat, tags, remark).lastInsertRowid;
    return res.json(success({ id: insertId }, '添加成功'));
  }
}

/**
 * 删除饮食记录
 */
function deleteDiet(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM diet_records WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

/**
 * 获取运动记录
 */
function getExercise(req, res) {
  const userId = req.userId;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT * FROM exercise_records
    WHERE user_id = ? AND record_date = ?
    ORDER BY created_at DESC
  `).all(userId, date);

  const types = { aerobic: [], strength: [], stretch: [], ball: [] };
  let totalCalorie = 0;
  let totalDuration = 0;

  rows.forEach(row => {
    totalCalorie += row.total_calorie || 0;
    totalDuration += row.total_duration || 0;
    types[row.exercise_type] = types[row.exercise_type] || [];
    types[row.exercise_type].push({
      id: row.id,
      exercises: JSON.parse(row.exercises || '[]'),
      total_duration: row.total_duration,
      total_calorie: row.total_calorie,
      remark: row.remark,
      status: row.status
    });
  });

  return res.json(success({
    date,
    total_calorie: totalCalorie,
    total_duration: totalDuration,
    types
  }));
}

/**
 * 添加/编辑运动记录
 */
function saveExercise(req, res) {
  const userId = req.userId;
  const { id, record_date, exercise_type, exercises, remark } = req.body;

  const totalDuration = exercises.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalCalorie = exercises.reduce((sum, e) => sum + (e.calorie || 0), 0);

  if (id) {
    db.prepare(`
      UPDATE exercise_records
      SET record_date = ?, exercise_type = ?, exercises = ?, total_duration = ?, total_calorie = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(record_date, exercise_type, JSON.stringify(exercises), totalDuration, totalCalorie, remark, id, userId);
    return res.json(success(null, '更新成功'));
  } else {
    const insertId = db.prepare(`
      INSERT INTO exercise_records (user_id, record_date, exercise_type, exercises, total_duration, total_calorie, remark, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(userId, record_date, exercise_type, JSON.stringify(exercises), totalDuration, totalCalorie, remark).lastInsertRowid;
    return res.json(success({ id: insertId }, '添加成功'));
  }
}

/**
 * 删除运动记录
 */
function deleteExercise(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM exercise_records WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

/**
 * 获取身体数据记录
 */
function getBody(req, res) {
  const userId = req.userId;
  const type = req.query.type || 'weight';
  const days = parseInt(req.query.days) || 7;

  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT record_date, value, unit
    FROM body_records
    WHERE user_id = ? AND type = ? AND record_date >= ? AND status = 1
    ORDER BY record_date DESC
  `).all(userId, type, since);

  const profile = db.prepare('SELECT target_weight FROM user_profiles WHERE user_id = ?').get(userId);

  const list = rows.map((row, index) => {
    let change = 0;
    if (index < rows.length - 1) {
      change = parseFloat((row.value - rows[index + 1].value).toFixed(2));
    }
    return {
      date: row.record_date,
      value: row.value,
      change
    };
  });

  return res.json(success({
    type,
    unit: rows.length > 0 ? rows[0].unit : 'kg',
    target: profile ? profile.target_weight : null,
    list
  }));
}

/**
 * 添加身体数据
 */
function saveBody(req, res) {
  const userId = req.userId;
  const { record_date, type, value, unit } = req.body;

  const insertId = db.prepare(`
    INSERT INTO body_records (user_id, record_date, type, value, unit, status)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(userId, record_date, type, value, unit || 'kg').lastInsertRowid;

  // 如果是体重，更新当前体重
  if (type === 'weight') {
    db.prepare('UPDATE user_profiles SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
      .run(value, userId);
  }

  return res.json(success({ id: insertId }, '记录成功'));
}

/**
 * 删除身体数据
 */
function deleteBody(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM body_records WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

module.exports = {
  getToday,
  getDiet,
  saveDiet,
  deleteDiet,
  getExercise,
  saveExercise,
  deleteExercise,
  getBody,
  saveBody,
  deleteBody
};
