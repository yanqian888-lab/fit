/**
 * 记录中心控制器
 */
const { db, withTransaction } = require('../db');
const { success, error } = require('../utils/response');
const { getUsedDays } = require('../utils/date');
const helperAgent = require('../services/agents/helperAgent');
const { computeFoodNutrition } = require('../services/nutritionService');
const taskService = require('../services/taskService');
const achievementService = require('../services/achievementService');
const fastingService = require('../services/fastingService');
const newbieTaskService = require('../services/newbieTaskService');
const rewardService = require('../services/rewardService');
const exerciseMergeService = require('../services/exerciseMergeService');
const rewardReceiptService = require('../services/rewardReceiptService');
const { safeJsonParse } = require('../utils/safeJson');

const VALID_MEAL_TIMES = ['breakfast', 'lunch', 'dinner', 'snack'];
const VALID_EXERCISE_TYPES = ['aerobic', 'strength', 'stretch', 'ball'];

function getHabitAction(type) {
  const map = {
    water: 'record_water',
    sleep: 'record_sleep',
    defecation: 'record_defecation',
    mood: 'record_mood'
  };
  return map[type] || 'record_habit';
}

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

  const userDetail = db.prepare('SELECT height FROM users WHERE id = ?').get(userId);

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
    height: userDetail ? userDetail.height : null,
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
      foods: safeJsonParse(row.foods, []),
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

  // 输入验证
  if (!record_date) {
    return res.status(400).json(error('缺少记录日期', 400));
  }
  
  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record_date)) {
    return res.status(400).json(error('日期格式不正确，应为 YYYY-MM-DD', 400));
  }
  
  if (!VALID_MEAL_TIMES.includes(meal_time)) {
    return res.status(400).json(error('餐次类型不合法', 400));
  }
  
  if (!Array.isArray(foods) || foods.length === 0) {
    return res.status(400).json(error('请至少添加一项食物', 400));
  }
  
  // 验证食物数量上限
  if (foods.length > 50) {
    return res.status(400).json(error('单次记录食物数量不能超过50项', 400));
  }
  
  // 验证每个食物项
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    if (!food.name || typeof food.name !== 'string') {
      return res.status(400).json(error(`第${i + 1}项食物名称不能为空`, 400));
    }
    // 修复：使用字节长度而非字符长度
    const nameBytes = Buffer.byteLength(food.name, 'utf8');
    if (nameBytes > 200) {
      return res.status(400).json(error(`第${i + 1}项食物名称过长`, 400));
    }
    // 修复：添加类型检查
    if (food.weight !== undefined) {
      const weight = parseFloat(food.weight);
      if (isNaN(weight) || weight < 0 || weight > 10000) {
        return res.status(400).json(error(`第${i + 1}项食物重量不合法`, 400));
      }
    }
    if (food.calorie !== undefined) {
      const calorie = parseFloat(food.calorie);
      if (isNaN(calorie) || calorie < 0 || calorie > 5000) {
        return res.status(400).json(error(`第${i + 1}项食物热量不合法`, 400));
      }
    }
  }
  
  // 验证备注长度
  if (remark && remark.length > 500) {
    return res.status(400).json(error('备注内容过长', 400));
  }

  // 由后端根据食物数据库直接计算每个食物的营养数据，不再依赖 Agent/前端传入的估算值
  const computedFoods = foods.map(f => computeFoodNutrition(f));

  const totalCalorie = computedFoods.reduce((sum, f) => sum + (f.calorie || 0), 0);
  const totalProtein = computedFoods.reduce((sum, f) => sum + (f.protein || 0), 0);
  const totalCarb = computedFoods.reduce((sum, f) => sum + (f.carb || 0), 0);
  const totalFat = computedFoods.reduce((sum, f) => sum + (f.fat || 0), 0);

  if (id) {
    withTransaction(() => {
      db.prepare(`
        UPDATE diet_records
        SET record_date = ?, meal_time = ?, foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, tags = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(record_date, meal_time, JSON.stringify(computedFoods), totalCalorie, totalProtein, totalCarb, totalFat, tags, remark, id, userId);
    });
    return res.json(success(null, '更新成功'));
  } else {
    const result = withTransaction(() => {
      const insertId = db.prepare(`
        INSERT INTO diet_records (user_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, tags, remark, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(userId, record_date, meal_time, JSON.stringify(computedFoods), totalCalorie, totalProtein, totalCarb, totalFat, tags, remark).lastInsertRowid;
      const rewardResult = rewardService.rewardForRecord(userId, 'record_diet', insertId);
      newbieTaskService.checkAction(userId, 'record_diet');
      achievementService.checkAll(userId);
      return { id: insertId, reward_messages: rewardResult.reward_messages || [] };
    });
    return res.json(success(result, '添加成功'));
  }
}

/**
 * 删除饮食记录
 */
function deleteDiet(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('UPDATE diet_records SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(id, userId);
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
      exercises: safeJsonParse(row.exercises, []),
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

  if (!record_date) {
    return res.status(400).json(error('缺少记录日期', 400));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record_date)) {
    return res.status(400).json(error('日期格式不正确，应为 YYYY-MM-DD', 400));
  }
  if (!VALID_EXERCISE_TYPES.includes(exercise_type)) {
    return res.status(400).json(error('运动类型不合法', 400));
  }
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json(error('请至少添加一项运动', 400));
  }
  
  // 修复：验证运动数量上限
  if (exercises.length > 20) {
    return res.status(400).json(error('单次记录运动数量不能超过20项', 400));
  }
  
  // 修复：验证每个运动项
  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i];
    if (!exercise.name || typeof exercise.name !== 'string') {
      return res.status(400).json(error(`第${i + 1}项运动名称不能为空`, 400));
    }
    if (exercise.duration !== undefined) {
      const duration = parseFloat(exercise.duration);
      if (isNaN(duration) || duration < 0 || duration > 480) {
        return res.status(400).json(error(`第${i + 1}项运动时长不合法`, 400));
      }
    }
    if (exercise.calorie !== undefined) {
      const calorie = parseFloat(exercise.calorie);
      if (isNaN(calorie) || calorie < 0 || calorie > 5000) {
        return res.status(400).json(error(`第${i + 1}项运动消耗热量不合法`, 400));
      }
    }
  }

  const totalDuration = exercises.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalCalorie = exercises.reduce((sum, e) => sum + (e.calorie || 0), 0);

  if (id) {
    withTransaction(() => {
      db.prepare(`
        UPDATE exercise_records
        SET record_date = ?, exercise_type = ?, exercises = ?, total_duration = ?, total_calorie = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(record_date, exercise_type, JSON.stringify(exercises), totalDuration, totalCalorie, remark, id, userId);
    });
    return res.json(success(null, '更新成功'));
  } else {
    const result = withTransaction(() => {
      // 同一天同名运动自动合并（时长/消耗累加），不产生多行重复记录
      const { recordId } = exerciseMergeService.mergeOrInsertExercise(userId, record_date, exercise_type, exercises);
      const rewardResult = rewardService.rewardForRecord(userId, 'record_exercise', recordId);
      newbieTaskService.checkAction(userId, 'record_exercise');
      achievementService.checkAll(userId);
      return { id: recordId, reward_messages: rewardResult.reward_messages || [] };
    });
    return res.json(success(result, '添加成功'));
  }
}

/**
 * 删除运动记录
 */
function deleteExercise(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('UPDATE exercise_records SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(id, userId);
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
    SELECT record_date, value, unit, body_fat_rate
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
      body_fat: row.body_fat_rate || null,
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
  const { record_date, type, value, unit, body_fat } = req.body;

  if (!record_date) {
    return res.status(400).json(error('缺少记录日期', 400));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record_date)) {
    return res.status(400).json(error('日期格式不正确，应为 YYYY-MM-DD', 400));
  }
  if (!['weight', 'waist', 'hip', 'chest', 'thigh', 'arm', 'calf', 'body_fat'].includes(type)) {
    return res.status(400).json(error('身体数据类型不合法', 400));
  }
  const numValue = parseFloat(value);
  if (isNaN(numValue) || numValue <= 0) {
    return res.status(400).json(error('请输入有效的数值', 400));
  }

  const result = withTransaction(() => {
    // 同一天同类型去重：更新而非插入，避免重复奖励
    const existing = db.prepare(`
      SELECT id FROM body_records WHERE user_id = ? AND record_date = ? AND type = ? AND status = 1
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, record_date, type);

    if (existing) {
      if (type === 'weight' && body_fat !== undefined && body_fat !== null) {
        db.prepare(`
          UPDATE body_records SET value = ?, unit = ?, body_fat_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(numValue, unit || 'kg', body_fat, existing.id);
      } else {
        db.prepare(`
          UPDATE body_records SET value = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(numValue, unit || 'kg', existing.id);
      }

      if (type === 'weight') {
        db.prepare('UPDATE user_profiles SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
          .run(numValue, userId);
        // 更新场景不再重复发放奖励，但检查体重目标是否达成
        rewardReceiptService.checkWeightGoalReached(userId, numValue);
        achievementService.checkAll(userId);
      }
      return { id: existing.id };
    }

    let insertId;
    if (type === 'weight' && body_fat !== undefined && body_fat !== null) {
      insertId = db.prepare(`
        INSERT INTO body_records (user_id, record_date, type, value, unit, body_fat_rate, status)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(userId, record_date, type, numValue, unit || 'kg', body_fat).lastInsertRowid;
    } else {
      insertId = db.prepare(`
        INSERT INTO body_records (user_id, record_date, type, value, unit, status)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(userId, record_date, type, numValue, unit || 'kg').lastInsertRowid;
    }

    // 如果是体重，更新当前体重
    let rewardMessages = [];
    if (type === 'weight') {
      db.prepare('UPDATE user_profiles SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
        .run(numValue, userId);
      const rewardResult = rewardService.handleWeightRecord(userId, insertId, numValue);
      rewardMessages = rewardResult.reward_messages || [];
      newbieTaskService.checkAction(userId, 'record_body');
    }

    achievementService.checkAll(userId);
    return { id: insertId, reward_messages: rewardMessages };
  });
  return res.json(success(result, '记录成功'));
}

/**
 * 删除身体数据
 */
function deleteBody(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('UPDATE body_records SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(id, userId);
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
const VALID_HABIT_TYPES = ['water', 'sleep', 'defecation', 'mood'];

function saveHabit(req, res) {
  const userId = req.userId;
  const { id, record_date, type, value, unit, remark } = req.body;

  if (!record_date) {
    return res.status(400).json(error('缺少记录日期', 400));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record_date)) {
    return res.status(400).json(error('日期格式不正确，应为 YYYY-MM-DD', 400));
  }
  if (!VALID_HABIT_TYPES.includes(type)) {
    return res.status(400).json(error('习惯类型不合法', 400));
  }
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return res.status(400).json(error('请输入有效的数值', 400));
  }
  if (numValue < 0) {
    return res.status(400).json(error('数值不能为负数', 400));
  }
  // 按习惯类型设置合理上限，避免异常数据入库
  const typeUpperLimits = { water: 10000, sleep: 24, defecation: 10, mood: 10 };
  const upperLimit = typeUpperLimits[type];
  if (typeof upperLimit === 'number' && numValue > upperLimit) {
    return res.status(400).json(error(`数值过大（${type} 上限 ${upperLimit}）`, 400));
  }

  if (id) {
    const waterMl = type === 'water' ? (parseInt(value) || 0) : 0;
    db.prepare(`
      UPDATE habit_records
      SET record_date = ?, type = ?, value = ?, unit = ?, remark = ?, water_ml = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(record_date, type, value, unit, remark, waterMl, id, userId);
    return res.json(success(null, '更新成功'));
  } else {
    const result = withTransaction(() => {
      // 同一天同类型去重：若已存在则更新而非插入，避免唯一约束冲突
      const existing = db.prepare(`
        SELECT id FROM habit_records
        WHERE user_id = ? AND record_date = ? AND type = ? AND status = 1
        ORDER BY created_at DESC LIMIT 1
      `).get(userId, record_date, type);

      if (existing) {
        const waterMl = type === 'water' ? (parseInt(value) || 0) : 0;
        db.prepare(`
          UPDATE habit_records
          SET value = ?, unit = ?, remark = ?, water_ml = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(value, unit || null, remark || null, waterMl, existing.id);

        if (type === 'water') {
          db.prepare('UPDATE user_profiles SET total_water = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
            .run(value, userId);
        }
        achievementService.checkAll(userId);
        return { id: existing.id, updated: true };
      }

      const waterMl = type === 'water' ? (parseInt(value) || 0) : 0;
      const insertId = db.prepare(`
        INSERT INTO habit_records (user_id, record_date, type, value, unit, remark, water_ml, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(userId, record_date, type, value, unit || null, remark || null, waterMl).lastInsertRowid;
      const action = getHabitAction(type);
      const rewardResult = rewardService.rewardForRecord(userId, action, insertId, value);
      newbieTaskService.checkAction(userId, action);
      // habits also count toward the generic habit daily task
      taskService.updateTaskProgress(userId, 'record_habit', 1);

      achievementService.checkAll(userId);
      return { id: insertId, reward_messages: rewardResult.reward_messages || [] };
    });
    return res.json(success(result, '添加成功'));
  }
}

/**
 * 删除生活习惯记录
 */
function deleteHabit(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('UPDATE habit_records SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(id, userId);
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
      SUM(total_duration) as total_minutes
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

  // 围度逆袭：最新体重稳定但最新腰围比上次减少3cm以上
  let hasMeasureWin = false;
  const latestWeight = bodyRecords.filter(r => r.type === 'weight').slice(-1)[0];
  const latestWaist = bodyRecords.filter(r => r.type === 'waist').slice(-1)[0];
  const prevWaist = bodyRecords.filter(r => r.type === 'waist').slice(-2, -1)[0];
  if (latestWeight && latestWaist && prevWaist && latestWeight.value &&
      Math.abs(latestWeight.value - (bodyRecords.filter(r => r.type === 'weight').slice(-2, -1)[0]?.value || latestWeight.value)) < 0.5 &&
      (prevWaist.value - latestWaist.value) >= 3) {
    hasMeasureWin = true;
  }

  // 肌肉增长：体重稳定但体脂率下降（增肌减脂指标）
  let hasMuscleWin = false;
  const latestBodyFat = bodyRecords.filter(r => r.type === 'body_fat').slice(-1)[0];
  const prevBodyFat = bodyRecords.filter(r => r.type === 'body_fat').slice(-2, -1)[0];
  const prevWeight = bodyRecords.filter(r => r.type === 'weight').slice(-2, -1)[0];
  if (latestWeight && latestBodyFat && prevBodyFat && latestWeight.value &&
      Math.abs(latestWeight.value - (prevWeight?.value || latestWeight.value)) < 0.5 &&
      (prevBodyFat.value - latestBodyFat.value) >= 1) {
    hasMuscleWin = true;
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
      exercise_week_streak: (() => {
        if (exerciseMinutes.length === 0) return 0;
        let streak = 0;
        for (let i = exerciseMinutes.length - 1; i >= 0; i--) {
          if ((exerciseMinutes[i].total_minutes || 0) > 0) streak++;
          else break;
        }
        return streak;
      })(),
      no_late_night_week: (() => {
        const now = new Date();
        const day = now.getDay() || 7; // 周一为起点
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day - 1));
        const weekStart = monday.toISOString().split('T')[0];
        const count = db.prepare(`
          SELECT COUNT(*) as c FROM habit_records
          WHERE user_id = ? AND status = 1
            AND no_late_night = 1
            AND record_date >= ? AND record_date <= ?
        `).get(userId, weekStart, new Date().toISOString().split('T')[0]).c || 0;
        return count;
      })(),
      no_late_night_streak: maxStreak(lateNightRecords, r => r.no_late_night === 1),
      weigh_week: (() => {
        const now = new Date();
        const day = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day - 1));
        const weekStart = monday.toISOString().split('T')[0];
        const count = db.prepare(`
          SELECT COUNT(DISTINCT record_date) as c FROM body_records
          WHERE user_id = ? AND status = 1
            AND type = 'weight'
            AND record_date >= ? AND record_date <= ?
        `).get(userId, weekStart, new Date().toISOString().split('T')[0]).c || 0;
        return count;
      })(),
      weigh_streak: (() => {
        const dates = [...new Set(weighRecords.map(r => r.record_date))].sort();
        if (dates.length === 0) return 0;
        let streak = 0;
        let prev = null;
        for (let i = dates.length - 1; i >= 0; i--) {
          const cur = new Date(dates[i] + 'T00:00:00');
          if (!prev) {
            streak = 1;
            prev = cur;
            continue;
          }
          const diffDays = Math.round((prev - cur) / 86400000);
          if (diffDays === 1) {
            streak++;
            prev = cur;
          } else {
            break;
          }
        }
        return streak;
      })(),
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

/**
 * 获取今日轻断食状态
 */
function getFasting(req, res) {
  const userId = req.userId;
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const fasting = fastingService.getTodayFasting(userId, date);
  return res.json(success({ fasting }));
}

/**
 * 创建/操作轻断食计划
 */
function saveFasting(req, res) {
  const userId = req.userId;
  const { action, mode, target_hours, eating_window_start, eating_window_end, note } = req.body;

  let result;
  if (action === 'start') {
    result = fastingService.startFasting(userId, req.body);
  } else if (action === 'end') {
    result = fastingService.endFasting(userId, req.body);
  } else if (action === 'cancel') {
    result = fastingService.cancelFasting(userId);
  } else {
    result = fastingService.planFasting(userId, { mode, target_hours, eating_window_start, eating_window_end, note });
  }

  if (result.error) return res.status(400).json(error(result.error));
  achievementService.checkAll(userId);
  return res.json(success(result));
}

/**
 * 获取轻断食统计
 */
function getFastingStats(req, res) {
  const userId = req.userId;
  const stats = fastingService.getFastingStats(userId);
  return res.json(success(stats));
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
  getFasting,
  saveFasting,
  getFastingStats,
  getRecordDates,
  getMilestoneData
};