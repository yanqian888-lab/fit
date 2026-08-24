/**
 * AI P1 功能控制器
 * 每日减肥日记、里程碑识别、平台期分析
 */
const { db, withTransaction } = require('../db');
const { success, error } = require('../utils/response');
const { getChinaDateStr } = require('../utils/chinaTime');
const mainAgent = require('../services/agents/mainAgent');
const helperAgent = require('../services/agents/helperAgent');
const { callWithPrompt } = require('../services/aiClient');
const promptService = require('../services/promptService');
const milestoneTemplateService = require('../services/milestoneTemplateService');
const currencyService = require('../services/currencyService');
const museumService = require('../services/museumService');
const taskService = require('../services/taskService');
const rewardReceiptService = require('../services/rewardReceiptService');

function getRandomTemplate(type, value) {
  return milestoneTemplateService.getRandomTemplate(type, value);
}

/**
 * 生成每日减肥日记
 */
async function generateDiary(req, res) {
  const userId = req.userId;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  // 幂等：同一天已生成过则直接返回已有日记，不重复调用 AI、不重复扣费
  const existing = db.prepare(`
    SELECT id, content FROM museum_items
    WHERE user_id = ? AND sub_type = 'daily_diary' AND record_date = ? AND status = 1
    ORDER BY id ASC LIMIT 1
  `).get(userId, date);
  if (existing) {
    return res.json(success({ date, diary: existing.content, item_id: existing.id, existing: true }));
  }

  // 校验余额，余额不足时直接拒绝，避免 AI 调用后再扣费失败
  const costConfig = currencyService.getAppConfig('analysis_cost');
  const currency = currencyService.getCurrency(userId);
  const deductedBerries = costConfig.berries || 0;
  const deductedFlowers = costConfig.flowers || 0;
  if ((currency.berries || 0) < deductedBerries) {
    return res.status(400).json(error(`生成每日分析需要 ${deductedBerries} 颗浆果，当前余额不足`, 400));
  }
  if ((currency.flowers || 0) < deductedFlowers) {
    return res.status(400).json(error(`生成每日分析需要 ${deductedFlowers} 朵鲜花，当前余额不足`, 400));
  }

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

  // 数据完整性校验：当天至少有一条记录（饮食/运动/身体/习惯）才进入 AI 分析，避免空跑扣费
  const recordCount = dietRows.length + exerciseRows.length + bodyRows.length + habitRows.length;
  if (recordCount === 0) {
    return res.status(400).json(error('今天还没有记录任何数据哦，先去记录饮食、运动或体重，再来生成今日分析吧', 400));
  }

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
  const museumMood = db.prepare(`
    SELECT emotion, content FROM museum_items
    WHERE user_id = ? AND sub_type = 'mood' AND record_date = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, date) || {};
  const mood = {
    emotion: museumMood.emotion || moodRecord.value || '',
    content: museumMood.content || moodRecord.remark || '',
    value: museumMood.emotion || moodRecord.value || ''
  };
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
      value: mood.value || '',
      emotion: mood.emotion || '',
      content: mood.content || ''
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

    // AI 调用成功后再扣费并写入，扣费与落地在同一事务内完成
    let itemId;
    try {
      itemId = withTransaction(() => {
        // 同一事务内扣费，任一失败则整体回滚
        if (deductedBerries > 0) {
          const berryResult = currencyService.deductCurrencyCore(userId, 'berries', deductedBerries, 'consume', 'generate_analysis', null);
          if (berryResult.error) throw new Error(berryResult.error);
        }
        if (deductedFlowers > 0) {
          const flowerResult = currencyService.deductCurrencyCore(userId, 'flowers', deductedFlowers, 'consume', 'generate_analysis', null);
          if (flowerResult.error) throw new Error(flowerResult.error);
        }

        // 保存到博物馆感悟集（同一用户同一天仅一条日记，由 idx_museum_diary_unique 约束）
        const insert = db.prepare(`
          INSERT INTO museum_items (user_id, type, sub_type, content, author, emotion, tags, status, record_date)
          VALUES (?, 'insight', 'daily_diary', ?, 'system', 'positive', ?, 1, ?)
        `);
        const id = insert.run(userId, diary, JSON.stringify(['日记', date]), date).lastInsertRowid;

        // 写入时间轴
        db.prepare(`
          INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
          VALUES (?, 'insight', '每日减肥日记', ?, ?, 'museum_items', ?, 0)
        `).run(userId, diary, id, date);

        // 推进生成分析任务
        taskService.updateTaskProgress(userId, 'generate_analysis', 1);

        return id;
      });
    } catch (txErr) {
      console.error(`[generateDiary] 写入事务失败 user=${userId}:`, txErr);
      return res.status(500).json(error('每日分析保存失败，未扣除费用，请重试', 500));
    }

    return res.json(success({ date, diary, item_id: itemId }));
  } catch (err) {
    console.error('生成日记失败:', err);
    // 扣费在 AI 成功后的同一事务中，失败时未扣费，无需退款
    return res.status(500).json(error('AI 服务调用失败，未扣除费用，请检查模型配置或网络后重试', 500));
  }
}

function getPreviousDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * 获取每日分析历史列表
 */
function getDiaryHistory(req, res) {
  const userId = req.userId;
  const month = req.query.month;
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const result = museumService.getDiaryHistory(userId, month, page, size);
  return res.json(success(result));
}

/**
 * 获取每日分析详情
 */
function getDiaryDetail(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const detail = museumService.getDiaryDetail(userId, id);
  if (!detail) return res.status(404).json(error('记录不存在', 404));
  return res.json(success(detail));
}

/**
 * 删除每日分析
 */
function deleteDiary(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const result = museumService.deleteDiary(userId, id);
  if (result.error) return res.status(404).json(error(result.error, 404));
  return res.json(success(null, '删除成功'));
}

/**
 * 收藏/取消收藏每日分析
 */
function toggleDiaryFavorite(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const result = museumService.toggleFavorite(userId, id);
  if (result.error) return res.status(404).json(error(result.error, 404));
  return res.json(success(result));
}

/**
 * 检查并生成里程碑
 */
async function checkMilestones(req, res) {
  try {
    const userId = req.userId;
    const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);

    const checkinDays = db.prepare(`
      SELECT COUNT(DISTINCT record_date) as count FROM (
        SELECT record_date FROM diet_records WHERE user_id = ? AND status = 1
        UNION
        SELECT record_date FROM exercise_records WHERE user_id = ? AND status = 1
        UNION
        SELECT record_date FROM body_records WHERE user_id = ? AND status = 1
      )
    `).get(userId, userId, userId).count;

    const today = getChinaDateStr();
    const newMilestones = [];

    // 里程碑写入（milestones + timelines）整体包事务，避免部分记录丢失
    withTransaction(() => {
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
              `).run(userId, title, msg, id, today);

              newMilestones.push({ id, title, description: msg });
            }
          }
        }
      }

      if (checkinDays > 0) {
        const durationLevels = [7, 30, 60, 100, 180, 365];
        for (const level of durationLevels) {
          if (checkinDays >= level) {
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
              `).run(userId, title, msg, id, today);

              newMilestones.push({ id, title, description: msg });
            }
          }
        }
      }

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
            `).run(userId, title, msg, id, today);

            newMilestones.push({ id, title, description: msg });
          }
        }
      }

      // === 对话里程碑 ===
      const chatCount = db.prepare(
        "SELECT COUNT(*) as c FROM chat_messages WHERE user_id = ? AND role = 'user'"
      ).get(userId).c;
      const chatLevels = [10, 100, 300, 500, 1000, 1500];
      for (const level of chatLevels) {
        if (chatCount >= level) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'chat' AND value = ?"
          ).get(userId, level);
          if (!exists) {
            const title = `与搭搭对话 ${level} 轮`;
            const msg = getRandomTemplate('chat', level);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'chat', ?, ?, ?, ?, '💬')
            `).run(userId, title, msg, level, '轮').lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
            `).run(userId, title, msg, id, today);
            newMilestones.push({ id, title, description: msg });
          }
        }
      }

      // === 运动里程碑 ===
      const exerciseStats = db.prepare(`
        SELECT COUNT(*) as total_count,
               COALESCE(SUM(total_duration), 0) as total_duration,
               COALESCE(SUM(total_calorie), 0) as total_calorie
        FROM exercise_records WHERE user_id = ? AND status = 1
      `).get(userId);

      const exerciseCountLevels = [10, 30, 50, 100, 200];
      for (const level of exerciseCountLevels) {
        if (exerciseStats.total_count >= level) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'exercise_count' AND value = ?"
          ).get(userId, level);
          if (!exists) {
            const title = `累计运动 ${level} 次`;
            const msg = getRandomTemplate('exercise_count', level);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'exercise_count', ?, ?, ?, ?, '🏃')
            `).run(userId, title, msg, level, '次').lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
            `).run(userId, title, msg, id, today);
            newMilestones.push({ id, title, description: msg });
          }
        }
      }

      const exerciseDurationLevels = [300, 600, 1200, 2400, 3600];
      for (const level of exerciseDurationLevels) {
        if (exerciseStats.total_duration >= level) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'exercise_duration' AND value = ?"
          ).get(userId, level);
          if (!exists) {
            const title = `累计运动 ${level} 分钟`;
            const msg = getRandomTemplate('exercise_duration', level);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'exercise_duration', ?, ?, ?, ?, '⏱️')
            `).run(userId, title, msg, level, '分钟').lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
            `).run(userId, title, msg, id, today);
            newMilestones.push({ id, title, description: msg });
          }
        }
      }

      const exerciseCalorieLevels = [3000, 6000, 12000, 24000, 36000];
      for (const level of exerciseCalorieLevels) {
        if (exerciseStats.total_calorie >= level) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'exercise_calorie' AND value = ?"
          ).get(userId, level);
          if (!exists) {
            const title = `累计运动消耗 ${level} 千卡`;
            const msg = getRandomTemplate('exercise_calorie', level);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'exercise_calorie', ?, ?, ?, ?, '🔥')
            `).run(userId, title, msg, level, '千卡').lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
            `).run(userId, title, msg, id, today);
            newMilestones.push({ id, title, description: msg });
          }
        }
      }

      // === 饮食记录里程碑 ===
      const dietDays = db.prepare(`
        SELECT COUNT(DISTINCT record_date) as c FROM diet_records
        WHERE user_id = ? AND status = 1
      `).get(userId).c;
      const dietDaysLevels = [7, 14, 30, 60, 100];
      for (const level of dietDaysLevels) {
        if (dietDays >= level) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'diet_days' AND value = ?"
          ).get(userId, level);
          if (!exists) {
            const title = `累计饮食记录 ${level} 天`;
            const msg = getRandomTemplate('diet_days', level);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'diet_days', ?, ?, ?, ?, '🥗')
            `).run(userId, title, msg, level, '天').lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
            `).run(userId, title, msg, id, today);
            newMilestones.push({ id, title, description: msg });
          }
        }
      }

      // === 目标体重达成 ===
      if (profile && profile.goal_weight && profile.current_weight) {
        const goalMet = profile.current_weight <= profile.goal_weight;
        if (goalMet) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'weight_goal'"
          ).get(userId);
          if (!exists) {
            const msg = getRandomTemplate('weight_goal', 1);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'weight_goal', '达成目标体重', ?, 1, 'kg', '🎯')
            `).run(userId, msg).lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', '达成目标体重', ?, ?, 'milestones', ?, 1)
            `).run(userId, msg, id, today);
            newMilestones.push({ id, title: '达成目标体重', description: msg });
          }
        }
      }

      // === 收集事件里程碑 ===
      const eventCount = db.prepare(
        'SELECT COUNT(*) as c FROM user_events WHERE user_id = ?'
      ).get(userId).c;
      const eventLevels = [200, 300];
      for (const level of eventLevels) {
        if (eventCount >= level) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'event_collection' AND value = ?"
          ).get(userId, level);
          if (!exists) {
            const title = `累计收集 ${level} 个事件`;
            const msg = getRandomTemplate('event_collection', level);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'event_collection', ?, ?, ?, ?, '📸')
            `).run(userId, title, msg, level, '件').lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
            `).run(userId, title, msg, id, today);
            newMilestones.push({ id, title, description: msg });
          }
        }
      }

      // === 收集食谱里程碑 ===
      const recipeCount = db.prepare(
        "SELECT COUNT(*) as c FROM precipitation_records WHERE user_id = ? AND type = 'recipe' AND status = 1"
      ).get(userId).c;
      const recipeLevels = [50, 100, 150, 200];
      for (const level of recipeLevels) {
        if (recipeCount >= level) {
          const exists = db.prepare(
            "SELECT id FROM milestones WHERE user_id = ? AND type = 'recipe_collection' AND value = ?"
          ).get(userId, level);
          if (!exists) {
            const title = `累计收藏 ${level} 个食谱`;
            const msg = getRandomTemplate('recipe_collection', level);
            const id = db.prepare(`
              INSERT INTO milestones (user_id, type, title, description, value, unit, icon)
              VALUES (?, 'recipe_collection', ?, ?, ?, ?, '🍳')
            `).run(userId, title, msg, level, '个').lastInsertRowid;
            db.prepare(`
              INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
              VALUES (?, 'milestone', ?, ?, ?, 'milestones', ?, 1)
            `).run(userId, title, msg, id, today);
            newMilestones.push({ id, title, description: msg });
          }
        }
      }
    });

    // 事务提交后再发送管家回执，避免回执失败导致里程碑回滚
    for (const milestone of newMilestones) {
      rewardReceiptService.send({
        userId,
        source: 'milestone_reward',
        payload: { title: milestone.title, description: milestone.description }
      });
    }

    return res.json(success({ new_milestones: newMilestones, total_milestones: newMilestones.length }));
  } catch (err) {
    console.error('检查里程碑失败:', err);
    return res.status(500).json(error('检查里程碑失败', 500));
  }
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

  // 与每日分析同一消耗配置：先校验余额，AI 成功后再扣费
  const costConfig = currencyService.getAppConfig('analysis_cost');
  const currency = currencyService.getCurrency(userId);
  const deductedBerries = costConfig.berries || 0;
  const deductedFlowers = costConfig.flowers || 0;
  if ((currency.berries || 0) < deductedBerries) {
    return res.status(400).json(error(`生成月度总结需要 ${deductedBerries} 颗浆果，当前余额不足`, 400));
  }
  if ((currency.flowers || 0) < deductedFlowers) {
    return res.status(400).json(error(`生成月度总结需要 ${deductedFlowers} 朵鲜花，当前余额不足`, 400));
  }

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
    // AI 生成成功后扣费，失败则整体报错（不返回内容）
    if (deductedBerries > 0 || deductedFlowers > 0) {
      try {
        withTransaction(() => {
          if (deductedBerries > 0) {
            const r = currencyService.deductCurrencyCore(userId, 'berries', deductedBerries, 'consume', 'generate_analysis', null);
            if (r.error) throw new Error(r.error);
          }
          if (deductedFlowers > 0) {
            const r = currencyService.deductCurrencyCore(userId, 'flowers', deductedFlowers, 'consume', 'generate_analysis', null);
            if (r.error) throw new Error(r.error);
          }
        });
      } catch (deductErr) {
        return res.status(400).json(error(deductErr.message || '扣费失败', 400));
      }
    }
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

  // 服务端平台期判定：最近 N 天体重记录 >=7 条且波动 <=1.0kg
  let isPlateau = false;
  let plateauSuggestion = '数据不足，无法判断平台期。建议继续规律记录，一周后再看趋势。';
  if (weights.length >= 7) {
    const values = weights.map(w => Number(w.value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    if (range <= 1.0) {
      isPlateau = true;
      plateauSuggestion = `最近 ${weights.length} 天体重在 ${min.toFixed(1)}kg ~ ${max.toFixed(1)}kg 之间波动（差值 ${range.toFixed(1)}kg），疑似进入平台期。建议适当调整饮食结构、增加运动强度或关注睡眠与压力。`;
    } else {
      plateauSuggestion = `最近 ${weights.length} 天体重波动 ${range.toFixed(1)}kg，尚未出现明显平台期迹象，继续保持记录节奏。`;
    }
  }

  const prompt = promptService.getPrompt('plateau_analysis', {
    days,
    weights: JSON.stringify(weights),
    nutrition: JSON.stringify(nutrition),
    exercises: JSON.stringify(exercises),
    target: profile ? `从 ${profile.initial_weight}kg 减到 ${profile.target_weight}kg` : '暂无目标',
    is_plateau: isPlateau ? '是' : '否',
    plateau_suggestion: plateauSuggestion
  });

  try {
    const analysis = await helperAgent.callHelperAgent(prompt) || plateauSuggestion;
    return res.json(success({ days, weights, is_plateau: isPlateau, analysis }));
  } catch (err) {
    console.error(err);
    return res.json(success({ days, weights, is_plateau: isPlateau, analysis: plateauSuggestion }));
  }
}

module.exports = {
  generateDiary,
  getDiaryHistory,
  getDiaryDetail,
  deleteDiary,
  toggleDiaryFavorite,
  checkMilestones,
  getMilestones,
  generateMonthlyDiary,
  analyzePlateau
};
