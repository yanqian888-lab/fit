/**
 * AI P1 功能控制器
 * 每日减肥日记、里程碑识别、平台期分析
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const { getUsedDays } = require('../utils/date');
const mainAgent = require('../services/agents/mainAgent');
const helperAgent = require('../services/agents/helperAgent');
const { callWithPrompt } = require('../services/aiClient');
const promptService = require('../services/promptService');
const milestoneTemplateService = require('../services/milestoneTemplateService');

function getRandomTemplate(type, value) {
  return milestoneTemplateService.getRandomTemplate(type, value);
}

/**
 * 生成每日减肥日记
 */
async function generateDiary(req, res) {
  const userId = req.userId;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  const dietRows = db.prepare(`
    SELECT meal_time, foods, total_calorie, total_protein, total_carb, total_fat
    FROM diet_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, date);

  const exerciseRows = db.prepare(`
    SELECT exercise_type, exercises, total_duration, total_calorie
    FROM exercise_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, date);

  const bodyRows = db.prepare(`
    SELECT type, value, unit, weight, waist, thigh, hip, arm, body_fat_rate
    FROM body_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, date);

  const habitRows = db.prepare(`
    SELECT type, value, unit, water_ml, remark
    FROM habit_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, date);

  const todayWeightRow = bodyRows.find(r => r.type === 'weight');
  const todayWeight = todayWeightRow ? todayWeightRow.value : (profile?.current_weight || null);

  const prevDate = getPreviousDate(date);
  const yesterdayWeightRow = db.prepare(`
    SELECT value FROM body_records
    WHERE user_id = ? AND record_date = ? AND type = 'weight' AND status = 1
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, prevDate);
  const yesterdayWeight = yesterdayWeightRow ? yesterdayWeightRow.value : null;

  const initialWeight = profile?.initial_weight || null;
  const targetWeight = profile?.target_weight || null;

  const dietSummary = dietRows.reduce((acc, r) => {
    acc.calorie += Number(r.total_calorie || 0);
    acc.protein += Number(r.total_protein || 0);
    acc.carb += Number(r.total_carb || 0);
    acc.fat += Number(r.total_fat || 0);
    return acc;
  }, { calorie: 0, protein: 0, carb: 0, fat: 0 });

  const exerciseSummary = exerciseRows.reduce((acc, r) => {
    acc.duration += Number(r.total_duration || 0);
    acc.calorie += Number(r.total_calorie || 0);
    acc.types.push(r.exercise_type);
    return acc;
  }, { duration: 0, calorie: 0, types: [] });

  const waterRecord = habitRows.find(r => r.type === 'water') || {};
  const waterMl = waterRecord.water_ml || waterRecord.value || 0;

  const moodRecord = habitRows.find(r => r.type === 'mood') || {};
  const sleepRecord = habitRows.find(r => r.type === 'sleep') || {};

  const fastingMode = req.query.fasting_mode || '';
  const eatingStart = req.query.eating_start || '';
  const eatingEnd = req.query.eating_end || '';
  const fastingStatus = req.query.fasting_status || '';

  const gender = user?.gender === 1 ? '男' : user?.gender === 2 ? '女' : null;
  const age = user?.age || null;
  const height = user?.height || null;

  function calculateBmr(weightKg, heightCm, ageVal, genderVal) {
    if (!weightKg || !heightCm || !ageVal || !genderVal) return null;
    const w = Number(weightKg);
    const h = Number(heightCm);
    const a = Number(ageVal);
    if (genderVal === '男') return 10 * w + 6.25 * h - 5 * a + 5;
    if (genderVal === '女') return 10 * w + 6.25 * h - 5 * a - 161;
    return null;
  }

  const bmr = calculateBmr(todayWeight, height, age, gender);
  const tdee = bmr ? Math.round(bmr * 1.2) : null;
  const calorieBalance = tdee !== null
    ? Math.round((tdee + exerciseSummary.calorie - dietSummary.calorie) * 10) / 10
    : null;

  const dataContext = {
    date,
    user: {
      nickname: user?.nickname || '用户',
      gender: gender || '未知',
      age: age || '未知',
      height: height || '未知'
    },
    target: {
      initial_weight: initialWeight,
      current_weight: todayWeight,
      target_weight: targetWeight,
      yesterday_weight: yesterdayWeight
    },
    diet: dietSummary,
    exercise: {
      duration: exerciseSummary.duration,
      calorie: exerciseSummary.calorie,
      types: [...new Set(exerciseSummary.types)]
    },
    energy: {
      bmr,
      tdee,
      calorie_balance: calorieBalance,
      formula: 'TDEE = BMR × 1.2（静坐少动系数），热量差 = TDEE + 运动消耗 - 饮食摄入，正数为热量缺口，负数为热量盈余'
    },
    water: waterMl,
    mood: {
      value: moodRecord.value || '',
      remark: moodRecord.remark || ''
    },
    sleep: {
      value: sleepRecord.value || '',
      remark: sleepRecord.remark || ''
    },
    fasting: {
      mode: fastingMode,
      eating_start: eatingStart,
      eating_end: eatingEnd,
      status: fastingStatus
    }
  };

  const systemPrompt = promptService.getPrompt('diary_system');
  const userPrompt = promptService.getPrompt('diary_user', {
    data_context: JSON.stringify(dataContext, null, 2)
  });

  console.log(`[generateDiary] 开始生成，prompt 长度 system=${systemPrompt.length} user=${userPrompt.length}`);
  const callStart = Date.now();
  try {
    const response = await Promise.race([
      callWithPrompt(
        'diary_system',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        { temperature: 0.6, max_tokens: 1200, timeout: 60000 }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI 调用超时')), 60000))
    ]);
    console.log(`[generateDiary] AI 调用耗时 ${Date.now() - callStart}ms`);

    const diary = (response.choices[0].message.content || '今天也是努力的一天，明天继续加油！').replace(/^###\s*/gm, '');

    // 保存到博物馆感悟集
    const insert = db.prepare(`
      INSERT INTO museum_items (user_id, type, sub_type, content, author, emotion, tags, status)
      VALUES (?, 'insight', 'daily_diary', ?, 'system', 'positive', ?, 1)
    `);
    const itemId = insert.run(userId, diary, JSON.stringify(['日记', date])).lastInsertRowid;

    // 写入时间轴
    db.prepare(`
      INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
      VALUES (?, 'insight', '每日减肥日记', ?, ?, 'museum_items', ?, 0)
    `).run(userId, diary, itemId, date);

    return res.json(success({ date, diary, item_id: itemId }));
  } catch (err) {
    console.error('生成日记失败:', err);
    return res.status(500).json(error('AI 服务调用失败，请检查模型配置或网络后重试', 500));
  }
}

function getPreviousDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * 检查并生成里程碑
 */
async function checkMilestones(req, res) {
  const userId = req.userId;
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);

  const newMilestones = [];

  if (profile && profile.initial_weight && profile.current_weight) {
    const lost = parseFloat((profile.initial_weight - profile.current_weight).toFixed(2));
    const weightLevels = [2.5, 5, 10, 15, 20, 30];

    for (const level of weightLevels) {
      if (lost >= level) {
        const exists = db.prepare(`
          SELECT id FROM milestones WHERE user_id = ? AND type = 'weight_loss' AND value = ?
        `).get(userId, level);
        if (!exists) {
          const title = `累计减重 ${level}kg`;
          const msg = getRandomTemplate('weight_loss', level);
          const id = db.prepare(`
            INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
            VALUES (?, 'weight_loss', ?, ?, ?, ?, '🏆')
          `).run(userId, title, msg, level, 'kg').lastInsertRowid;

          db.prepare(`
            INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
            VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
          `).run(userId, title, msg, id, new Date().toISOString().split('T')[0]);

          newMilestones.push({ id, title, description: msg });
        }
      }
    }
  }

  if (user && user.created_at) {
    const usedDays = getUsedDays(user.created_at);
    const durationLevels = [7, 30, 60, 100, 180, 365];
    for (const level of durationLevels) {
      if (usedDays >= level) {
        const exists = db.prepare(`
          SELECT id FROM milestones WHERE user_id = ? AND type = 'duration' AND value = ?
        `).get(userId, level);
        if (!exists) {
          const title = `坚持减肥第 ${level} 天`;
          const msg = getRandomTemplate('duration', level);
          const id = db.prepare(`
            INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
            VALUES (?, 'duration', ?, ?, ?, ?, '🔥')
          `).run(userId, title, msg, level, '天').lastInsertRowid;

          db.prepare(`
            INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
            VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
          `).run(userId, title, msg, id, new Date().toISOString().split('T')[0]);

          newMilestones.push({ id, title, description: msg });
        }
      }
    }
  }

  const checkinDays = db.prepare(`
    SELECT COUNT(DISTINCT record_date) as count FROM (
      SELECT record_date FROM diet_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM exercise_records WHERE user_id = ? AND status = 1
      UNION
      SELECT record_date FROM body_records WHERE user_id = ? AND status = 1
    )
  `).get(userId, userId, userId).count;

  const checkinLevels = [7, 30, 60, 100];
  for (const level of checkinLevels) {
    if (checkinDays >= level) {
      const exists = db.prepare(`
        SELECT id FROM milestones WHERE user_id = ? AND type = 'checkin' AND value = ?
      `).get(userId, level);
      if (!exists) {
        const title = `累计打卡 ${level} 天`;
        const msg = getRandomTemplate('checkin', level);
        const id = db.prepare(`
          INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
          VALUES (?, 'checkin', ?, ?, ?, ?, '✅')
        `).run(userId, title, msg, level, '天').lastInsertRowid;

        db.prepare(`
          INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
          VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
        `).run(userId, title, msg, id, new Date().toISOString().split('T')[0]);

        newMilestones.push({ id, title, description: msg });
      }
    }
  }

  return res.json(success({ new_milestones: newMilestones, total_milestones: newMilestones.length }));
}

/**
 * 获取用户里程碑列表
 */
function getMilestones(req, res) {
  const userId = req.userId;
  const list = db.prepare(`
    SELECT id, type, title, description, value, unit, icon, achieved_at, created_at
    FROM milestones
    WHERE user_id = ?
    ORDER BY achieved_at DESC
  `).all(userId);
  return res.json(success({ list }));
}

/**
 * 生成月度减肥日记
 */
async function generateMonthlyDiary(req, res) {
  const userId = req.userId;
  const month = req.query.month || new Date().toISOString().split('T')[0].slice(0, 7);
  const startDate = `${month}-01`;
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(userId);

  const dietRows = db.prepare(`
    SELECT record_date, SUM(total_calorie) as calorie
    FROM diet_records
    WHERE user_id = ? AND record_date >= ? AND record_date <= ? AND status = 1
    GROUP BY record_date
  `).all(userId, startDate, endDate);

  const exerciseRows = db.prepare(`
    SELECT record_date, SUM(total_duration) as duration, SUM(total_calorie) as calorie
    FROM exercise_records
    WHERE user_id = ? AND record_date >= ? AND record_date <= ? AND status = 1
    GROUP BY record_date
  `).all(userId, startDate, endDate);

  const weightRows = db.prepare(`
    SELECT record_date, value
    FROM body_records
    WHERE user_id = ? AND type = 'weight' AND record_date >= ? AND record_date <= ? AND status = 1
    ORDER BY record_date ASC
  `).all(userId, startDate, endDate);

  const prompt = promptService.getPrompt('monthly_diary', {
    month,
    nickname: user?.nickname || '用户',
    diet_rows: JSON.stringify(dietRows),
    exercise_rows: JSON.stringify(exerciseRows),
    weight_rows: JSON.stringify(weightRows),
    target: profile ? `从 ${profile.initial_weight}kg 减到 ${profile.target_weight}kg` : '暂无目标'
  });

  try {
    const diary = (await helperAgent.callHelperAgent(prompt) || '').replace(/^###\s*/gm, '');
    return res.json(success({ month, diary }));
  } catch (err) {
    console.error(err);
    return res.json(success({ month, diary: '这个月你一直在努力，继续坚持，下个月一定会更好！' }));
  }
}

/**
 * 平台期分析
 */
async function analyzePlateau(req, res) {
  const userId = req.userId;
  const days = parseInt(req.query.days) || 14;
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const weights = db.prepare(`
    SELECT record_date, value FROM body_records
    WHERE user_id = ? AND type = 'weight' AND record_date >= ? AND status = 1
    ORDER BY record_date ASC
  `).all(userId, since);

  const nutrition = db.prepare(`
    SELECT record_date,
           SUM(total_calorie) as calorie,
           SUM(total_protein) as protein,
           SUM(total_carb) as carb,
           SUM(total_fat) as fat
    FROM diet_records
    WHERE user_id = ? AND record_date >= ? AND status = 1
    GROUP BY record_date
  `).all(userId, since);

  const exercises = db.prepare(`
    SELECT record_date, SUM(total_duration) as duration, SUM(total_calorie) as calorie
    FROM exercise_records
    WHERE user_id = ? AND record_date >= ? AND status = 1
    GROUP BY record_date
  `).all(userId, since);

  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);

  const prompt = promptService.getPrompt('plateau_analysis', {
    days,
    weights: JSON.stringify(weights),
    nutrition: JSON.stringify(nutrition),
    exercises: JSON.stringify(exercises),
    target: profile ? `从 ${profile.initial_weight}kg 减到 ${profile.target_weight}kg` : '暂无目标'
  });

  try {
    const analysis = await helperAgent.callHelperAgent(prompt);
    return res.json(success({ days, weights, analysis }));
  } catch (err) {
    console.error(err);
    return res.json(success({ days, weights, analysis: '数据不足，无法判断平台期。建议继续规律记录，一周后再看趋势。' }));
  }
}

module.exports = {
  generateDiary,
  checkMilestones,
  getMilestones,
  generateMonthlyDiary,
  analyzePlateau
};
