/**
 * 记录中心控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const { getUsedDays } = require('../utils/date');
const helperAgent = require('../services/agents/helperAgent');
const { computeFoodNutrition } = require('../services/nutritionService');

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

  // 推荐三大营养素（按热量目标：蛋白25%、碳水50%、脂肪25%）
  const proteinTarget = target * 0.25 / 4;
  const carbTarget = target * 0.50 / 4;
  const fatTarget = target * 0.25 / 9;

  // 计算减肥坚持天数（从注册日期到今天，至少1天）
  const userInfo = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
  const weightDays = getUsedDays(userInfo ? userInfo.created_at : null);

  return res.json(success({
    date: today,
    intake: Math.round(nutrition.intake),
    burned: Math.round(nutrition.burned),
    remaining: Math.round(remaining),
    target: Math.round(target),
    status,
    current_weight: todayWeight ? todayWeight.value : (profile ? profile.current_weight : null),
    initial_weight: profile ? profile.initial_weight : null,
    target_weight: profile ? profile.target_weight : null,
    weight_change: weightChange,
    protein: Math.round(nutrition.protein),
    protein_target: Math.round(proteinTarget),
    carb: Math.round(nutrition.carb),
    carb_target: Math.round(carbTarget),
    fat: Math.round(nutrition.fat),
    fat_target: Math.round(fatTarget),
    protein_ratio: proteinRatio,
    carb_ratio: carbRatio,
    fat_ratio: fatRatio,
    exercise_duration: nutrition.exercise_duration,
    pending_count: pendingCount,
    weight_days: weightDays
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
      meal_time: row.meal_time,
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

  // 由后端根据食物数据库直接计算每个食物的营养数据，不再依赖 Agent/前端传入的估算值
  const computedFoods = (foods || []).map(f => computeFoodNutrition(f));

  const totalCalorie = computedFoods.reduce((sum, f) => sum + (f.calorie || 0), 0);
  const totalProtein = computedFoods.reduce((sum, f) => sum + (f.protein || 0), 0);
  const totalCarb = computedFoods.reduce((sum, f) => sum + (f.carb || 0), 0);
  const totalFat = computedFoods.reduce((sum, f) => sum + (f.fat || 0), 0);

  if (id) {
    db.prepare(`
      UPDATE diet_records
      SET record_date = ?, meal_time = ?, foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, tags = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(record_date, meal_time, JSON.stringify(computedFoods), totalCalorie, totalProtein, totalCarb, totalFat, tags, remark, id, userId);
    return res.json(success(null, '更新成功'));
  } else {
    const insertId = db.prepare(`
      INSERT INTO diet_records (user_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, tags, remark, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(userId, record_date, meal_time, JSON.stringify(computedFoods), totalCalorie, totalProtein, totalCarb, totalFat, tags, remark).lastInsertRowid;
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

  // 兼容处理：前端传weight，数据库可能是'体重'或'weight'
  const typeFilter = type === 'weight' ? "(type = 'weight' OR type = '体重')" : "type = ?";
  const params = type === 'weight' ? [userId, since] : [userId, type, since];

  const rows = db.prepare(`
    SELECT record_date, value, unit
    FROM body_records
    WHERE user_id = ? AND ${typeFilter} AND record_date >= ? AND status = 1
    AND created_at = (
      SELECT MAX(created_at) 
      FROM body_records AS b2 
      WHERE b2.user_id = body_records.user_id 
        AND b2.record_date = body_records.record_date 
        AND b2.type = body_records.type
    )
    ORDER BY record_date DESC
  `).all(...params);

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

/**
 * 获取生活习惯记录
 */
function getHabits(req, res) {
  const userId = req.userId;
  const type = req.query.type || null;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  let sql = `
    SELECT id, type, value, unit, remark, created_at
    FROM habit_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `;
  const params = [userId, date];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY created_at DESC';

  const list = db.prepare(sql).all(...params);
  return res.json(success({ date, list }));
}

/**
 * 添加/编辑生活习惯记录
 */
function saveHabit(req, res) {
  const userId = req.userId;
  const { id, record_date, type, value, unit, remark } = req.body;

  if (id) {
    db.prepare(`
      UPDATE habit_records
      SET record_date = ?, type = ?, value = ?, unit = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(record_date, type, value, unit, remark, id, userId);
    return res.json(success(null, '更新成功'));
  } else {
    const insertId = db.prepare(`
      INSERT INTO habit_records (user_id, record_date, type, value, unit, remark, status)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(userId, record_date, type, value, unit || null, remark || null).lastInsertRowid;
    return res.json(success({ id: insertId }, '添加成功'));
  }
}

/**
 * 删除生活习惯记录
 */
function deleteHabit(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM habit_records WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

/**
 * 获取里程碑所需数据
 */
function getMilestoneData(req, res) {
  const userId = req.userId;

  // 用户资料
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);

  // 所有体测记录（按时间排序）
  const bodyRecords = db.prepare(`
    SELECT * FROM body_records
    WHERE user_id = ? AND status = 1
    ORDER BY record_date ASC, created_at ASC
  `).all(userId);

  // 习惯记录统计
  const habitStats = db.prepare(`
    SELECT 
      COUNT(*) as total_days,
      SUM(CASE WHEN water_ml >= 2000 THEN 1 ELSE 0 END) as water_days,
      SUM(CASE WHEN has_diet_record = 1 THEN 1 ELSE 0 END) as diet_days,
      SUM(CASE WHEN has_exercise = 1 THEN 1 ELSE 0 END) as exercise_days,
      SUM(CASE WHEN rejected_food = 1 THEN 1 ELSE 0 END) as reject_count
    FROM habit_records
    WHERE user_id = ?
  `).get(userId);

  // 连续饮水天数
  const waterRecords = db.prepare(`
    SELECT record_date, water_ml FROM habit_records
    WHERE user_id = ? ORDER BY record_date ASC
  `).all(userId);

  // 连续饮食打卡天数
  const dietRecords = db.prepare(`
    SELECT record_date, has_diet_record FROM habit_records
    WHERE user_id = ? ORDER BY record_date ASC
  `).all(userId);

  // 连续运动天数
  const exerciseRecords = db.prepare(`
    SELECT record_date, has_exercise FROM habit_records
    WHERE user_id = ? ORDER BY record_date ASC
  `).all(userId);

  // 计算最大连续天数（支持条件函数）
  function maxStreak(records, checkFn) {
    let max = 0, current = 0;
    for (const r of records) {
      if (checkFn(r)) {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }
    return max;
  }

  // 周运动时长统计
  const exerciseMinutes = db.prepare(`
    SELECT 
      strftime('%Y-%W', record_date) as week,
      SUM(duration) as total_minutes
    FROM exercise_records
    WHERE user_id = ? AND status = 1
    GROUP BY week
    ORDER BY week ASC
  `).all(userId);

  // 不吃宵夜统计
  const lateNightRecords = db.prepare(`
    SELECT record_date, no_late_night FROM habit_records
    WHERE user_id = ? ORDER BY record_date ASC
  `).all(userId);

  // 规律称重统计
  const weighRecords = db.prepare(`
    SELECT record_date FROM body_records
    WHERE user_id = ? AND type = 'weight' AND status = 1
    ORDER BY record_date ASC
  `).all(userId);

  // 计算保持目标体重天数
  let maintainDays = 0;
  if (profile && profile.target_weight && bodyRecords.length > 0) {
    const target = profile.target_weight;
    const reversed = [...bodyRecords].reverse();
    for (const r of reversed) {
      if (r.type === 'weight' && Math.abs(r.value - target) <= 1) {
        maintainDays++;
      } else if (r.type === 'weight') {
        break;
      }
    }
  }

  // 检测平台期突破（连续14天体重变化<0.2kg后再次下降）
  let hasPlateauBreak = false;
  const weightRecords = bodyRecords.filter(r => r.type === 'weight');
  if (weightRecords.length >= 15) {
    for (let i = 14; i < weightRecords.length; i++) {
      const prev14 = weightRecords[i - 14];
      const prev7 = weightRecords[i - 7];
      const curr = weightRecords[i];
      if (Math.abs(curr.value - prev14.value) < 0.2 && curr.value < prev7.value) {
        hasPlateauBreak = true;
        break;
      }
    }
  }

  // 围度逆袭：体重不变但腰围减少3cm以上
  let hasMeasureWin = false;
  if (bodyRecords.length >= 2) {
    const latest = bodyRecords[bodyRecords.length - 1];
    const prev = bodyRecords[bodyRecords.length - 2];
    if (latest.type === prev.type && latest.type === 'body' && 
        latest.waist && prev.waist && latest.weight && prev.weight &&
        Math.abs(latest.weight - prev.weight) < 0.5 && 
        (prev.waist - latest.waist) >= 3) {
      hasMeasureWin = true;
    }
  }

  // 肌肉增长：体重不变但肌肉量提升1kg以上
  let hasMuscleWin = false;
  if (bodyRecords.length >= 2) {
    const latest = bodyRecords[bodyRecords.length - 1];
    const prev = bodyRecords[bodyRecords.length - 2];
    if (latest.type === prev.type && latest.type === 'body' && 
        latest.muscle_mass && prev.muscle_mass && latest.weight && prev.weight &&
        Math.abs(latest.weight - prev.weight) < 0.5 && 
        (latest.muscle_mass - prev.muscle_mass) >= 1) {
      hasMuscleWin = true;
    }
  }

  return res.json(success({
    user: {
      initial_weight: profile ? profile.initial_weight : null,
      current_weight: profile ? profile.current_weight : null,
      target_weight: profile ? profile.target_weight : null,
      gender: profile ? profile.gender : 'female',
    },
    records: bodyRecords,
    stats: {
      water_days: habitStats.water_days || 0,
      water_streak: maxStreak(waterRecords, r => r.water_ml >= 2000),
      diet_days: habitStats.diet_days || 0,
      diet_streak: maxStreak(dietRecords, r => r.has_diet_record === 1),
      exercise_days: habitStats.exercise_days || 0,
      exercise_streak: maxStreak(exerciseRecords, r => r.has_exercise === 1),
      reject_count: habitStats.reject_count || 0,
      exercise_week_minutes: exerciseMinutes.length > 0 ? exerciseMinutes[exerciseMinutes.length - 1].total_minutes : 0,
      exercise_week_streak: 0, // 简化处理
      no_late_night_week: 0,
      no_late_night_streak: maxStreak(lateNightRecords, r => r.no_late_night === 1),
      weigh_week: 0,
      weigh_streak: 0,
      maintain_target_days: maintainDays,
      plateau_break: hasPlateauBreak,
      measure_win: hasMeasureWin,
      muscle_win: hasMuscleWin,
    }
  }));
}

/**
 * 获取指定日期范围内有记录的日期列表
 */
function getRecordDates(req, res) {
  const userId = req.userId;
  const { type, start_date, end_date } = req.query;
  const start = start_date || new Date().toISOString().split('T')[0];
  const end = end_date || start;

  const tableMap = {
    diet: 'diet_records',
    exercise: 'exercise_records',
    body: 'body_records',
    habit: 'habit_records'
  };
  const table = tableMap[type] || 'diet_records';

  const rows = db.prepare(`
    SELECT DISTINCT record_date as date
    FROM ${table}
    WHERE user_id = ? AND record_date BETWEEN ? AND ? AND status = 1
    ORDER BY record_date ASC
  `).all(userId, start, end);

  return res.json(success({ dates: rows.map(r => r.date) }));
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
  deleteBody,
  getHabits,
  saveHabit,
  deleteHabit,
  getRecordDates,
  getMilestoneData
};
