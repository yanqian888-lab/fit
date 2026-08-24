/**
 * 模板消息服务
 * 负责管理话术模板库、发送策略、定时任务
 */
const { db, withTransaction } = require('../db');
const chatState = require('./chatState');
const { getChinaDateStr, getChinaTimeStr, getMsUntilChinaMidnight } = require('../utils/chinaTime');

// ==================== 话术模板库 ====================

const TEMPLATE_LIBRARY = {
  breakfast: {
    gentle: [
      '又是美好的一天，不要忘记今天的减肥计划哦，你早上吃什么呢？🌞',
      '早安呀～新的一天从健康早餐开始，今天打算吃什么呀？',
      '早上好！记得吃点蛋白质哦，鸡蛋牛奶安排上～',
      '新的一天开始啦，早餐想好吃什么了吗？我陪你一起规划～',
      '早安！今天也要元气满满，早餐别偷懒呀，吃好了才有力气减肥～'
    ],
    strict: [
      '起床了没？早餐热量控制在400大卡以内，别吃多了！',
      '新的一天，新的自律。早餐吃什么，报上来。',
      '早上好，别想着跳过早餐，代谢会掉。吃什么？',
      '早餐时间到，高蛋白低碳水，记住哦！',
      '早上好，今天的第一餐，决定你今天的状态～'
    ],
    tease: [
      '醒了？早餐再炫油条包子，今天的热量缺口就提前下班了。',
      '早上好，今天早餐准备糊弄还是认真减？',
      '新的一天，新的借口。早餐吃什么，别又说没时间。',
      '起床了吗？昨晚偷吃的现在还没消化吧，早餐自觉点。',
      '早餐时间到，再乱吃我就当你放弃治疗了。'
    ]
  },
  lunch: {
    gentle: [
      '到饭点啦～今天午餐吃什么好吃的减脂餐呀？',
      '中午好！记得多吃蔬菜，少油少盐，我陪你一起吃～',
      '午餐时间到！今天有没有准备健康便当呀？',
      '吃饭了吗？今天午餐想吃什么，我可以帮你看看热量～',
      '中午啦，别忘记吃饭哦，健康午餐吃起来～'
    ],
    strict: [
      '午餐时间，热量别超600大卡，蔬菜占一半。',
      '吃饭！别等到饿晕了才吃，那样会暴食。',
      '午餐吃什么？先拍照给我看看，我帮你把关。',
      '中午了，你的减脂餐呢？别告诉我你又在吃外卖。',
      '午餐是承上启下的一餐，吃对了下午才有精神。'
    ],
    tease: [
      '午饭时间到，今天不会又在吃麻辣烫配奶茶吧？',
      '干饭了，让我看看你所谓的“减脂餐”有多离谱。',
      '中午好，午餐热量超标的话，晚上加练30分钟，我说真的。',
      '吃饭了吗？别又偷偷点外卖，热量表不会替你撒谎。',
      '午餐时间，吃草还是吃肉，选一个，别装鸵鸟。'
    ]
  },
  dinner: {
    gentle: [
      '晚上好呀～晚餐记得少吃点，七分饱就好哦。',
      '晚餐时间到！今天想吃什么呢？记得控制量哦～',
      '晚上啦，晚餐清淡一点，明天掉秤更开心～',
      '该吃晚餐啦，别吃太多哦，睡前有点饥饿感是最好的～',
      '晚餐吃什么呀？我陪你一起选低热量的～'
    ],
    strict: [
      '晚餐时间，热量控制在400以内，7点前吃完。',
      '晚上了，管住嘴！晚餐吃什么，报上来。',
      '晚餐是减肥的关键，吃错了今天白练。吃什么？',
      '7点前吃完晚餐，之后除了水什么都别碰。',
      '晚餐时间，碳水减半，蔬菜加倍。记住没？'
    ],
    tease: [
      '晚饭时间，今天还吃火锅的话，体重秤明天会教育你。',
      '晚上了，嘴馋就喝水，别用吃饭奖励自己。',
      '晚餐吃什么？烧烤炸鸡就别汇报了，我不想听。',
      '该吃晚饭了，7点前吃完，之后除了水什么都别想。',
      '晚餐时间到，碳水减半蔬菜加倍，做不到就别上秤。'
    ]
  },
  exercise: {
    gentle: [
      '晚上好～今天运动了吗？走了多少步呀？',
      '今天有没有去运动呀？哪怕散步也很好哦～',
      '晚上啦，今天运动打卡了吗？我陪你一起动～',
      '今天走了多少步？有没有完成运动小目标呀？',
      '运动时间到！今天打算做点什么运动呢？'
    ],
    strict: [
      '今天运动了吗？步数报上来，别偷懒。',
      '晚上了，今天有没有完成运动计划？',
      '今天走了多少步？低于8000的话，现在去补。',
      '运动打卡！今天做了什么运动，汇报一下。',
      '别告诉我你今天又没动，赶紧起来活动活动。'
    ],
    tease: [
      '今天运动了吗？别告诉我你又“改天再说”。',
      '步数多少？低于3000的话，你现在就去楼下走两圈。',
      '晚上了，今天有没有燃烧卡路里？还是只燃烧了手机电量？',
      '今天运动打卡了吗？没有的话别回我，先去动20分钟。',
      '运动时间到，沙发不会帮你瘦，站起来。'
    ]
  },
  weight: {
    gentle: [
      '早上好～今天称体重了吗？记录一下才能看到进步哦～',
      '新的一天，先上秤看看成果吧，我陪你一起面对数字～',
      '体重记录时间到，今天的数字是什么样的呀？'
    ],
    strict: [
      '起床第一件事：称体重。今天的数字报上来。',
      '每天早上固定称重，别偷懒，数据不会骗你。',
      '称体重了吗？没称的话现在去，我等着记录。'
    ],
    tease: [
      '早上好，体重秤在等你，你不会是不敢看吧？',
      '今天称体重了吗？别告诉我你把它藏起来了。',
      '上秤！逃避数字可不会让脂肪自己消失。'
    ]
  },
  water: {
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
  },
  wakeup: {
    gentle: [
      '你去哪儿了？我一个人减肥好寂寞，最近进度怎么样啦？',
      '好久不见啦，想你了～最近有没有好好坚持呀？',
      '你终于来了！我还以为你放弃了呢，快告诉我最近怎么样。',
      '最近去哪儿了？减肥计划还在执行吗？我等你好久了。',
      '欢迎回来！这段时间有没有想我呀？快说说你的近况～'
    ],
    strict: [
      '你还知道回来？这几天有没有偷懒，汇报一下。',
      '消失了这么久，体重涨了几斤？老实交代。',
      '终于出现了，我以为你放弃了呢。最近什么情况？',
      '去哪儿了？减肥计划暂停了吗？现在立刻恢复。',
      '回来了就好，别废话，今天开始重新打卡。'
    ],
    tease: [
      '哟，还活着呢？我以为你已经胖得不想打开APP了。',
      '终于舍得出现了？消失这几天，脂肪可没休息。',
      '你去哪儿了？不会是被奶茶炸鸡绑架了吧？',
      '好久不见，还以为你瘦了就不需要我了呢，结果？',
      '欢迎回来，这段时间胖了几斤自己心里有数吧。'
    ]
  },
  recall: {
    gentle: [
      '已经 {days} 天没见到你啦，今天回来记录一下吗？',
      '{days} 天不见，减肥路上别把我丢下呀～',
      '好久不见啦，最近还好吗？我一直在等你。',
      '最近去哪儿了？快回来看看，我陪你一起坚持。'
    ],
    strict: [
      '已经 {days} 天没登录了，减肥计划不能停，现在回来。',
      '{days} 天没打卡，再这样下去前功尽弃，立刻恢复。',
      '消失了 {days} 天，体重涨了几斤？老实交代。',
      '{days} 天不见，你是放弃了吗？马上回来打卡。'
    ],
    tease: [
      '{days} 天不露面，脂肪可没放假。',
      '还以为你瘦到不需要我了呢，结果 {days} 天没动静？',
      '{days} 天不见，你是被奶茶炸鸡绑架了吗？',
      '你再不回来，我都要以为你胖得打不开 App 了。'
    ]
  }
};

// 发送时段配置
const TIME_SLOTS = {
  breakfast: { start: '07:30', end: '09:00' },
  lunch: { start: '11:30', end: '13:00' },
  dinner: { start: '17:30', end: '19:00' },
  exercise: { start: '19:00', end: '20:00' },
  water: { start: '14:00', end: '14:30' },
  weight: { start: '08:00', end: '09:00' }
};

// 运动相关关键词
const EXERCISE_KEYWORDS = ['运动', '步数', '跑步', '走路', '健身', '锻炼', '散步', '快走', '跳绳', '游泳', '瑜伽', '打卡'];

/**
 * 从数据库加载启用的模板，内存常量作为 fallback
 */
function loadTemplateLibrary() {
  try {
    const rows = db.prepare(`
      SELECT template_type, mode, content FROM template_configs
      WHERE is_enabled = 1 ORDER BY sort_order ASC
    `).all();
    if (rows.length === 0) return TEMPLATE_LIBRARY;

    const lib = JSON.parse(JSON.stringify(TEMPLATE_LIBRARY));
    for (const row of rows) {
      if (!lib[row.template_type]) lib[row.template_type] = {};
      if (!lib[row.template_type][row.mode]) lib[row.template_type][row.mode] = [];
      lib[row.template_type][row.mode].push(row.content);
    }
    return lib;
  } catch (err) {
    console.error('[模板消息] 从数据库加载模板失败:', err.message);
    return TEMPLATE_LIBRARY;
  }
}

/**
 * 检查当前是否处于用户勿扰时段（优先读 settings.dnd_start/end）
 */
function isInQuietHours(userId) {
  const settings = db.prepare('SELECT dnd_start, dnd_end FROM settings WHERE user_id = ?').get(userId);
  const fallback = db.prepare('SELECT quiet_hours_start, quiet_hours_end FROM user_profiles WHERE user_id = ?').get(userId);

  const toHHMM = (t) => {
    if (!t) return null;
    return String(t).slice(0, 5);
  };

  const start = toHHMM(settings?.dnd_start) || fallback?.quiet_hours_start || '22:00';
  const end = toHHMM(settings?.dnd_end) || fallback?.quiet_hours_end || '08:00';

  const current = getChinaTimeStr();

  if (start <= end) {
    return current >= start && current <= end;
  }
  // 跨午夜，例如 22:00-08:00
  return current >= start || current <= end;
}

// ==================== 工具函数 ====================

/**
 * 获取当前时间是否在发送时段内
 */
function getCurrentTimeSlot() {
  const currentTime = getChinaTimeStr();

  for (const [type, slot] of Object.entries(TIME_SLOTS)) {
    if (currentTime >= slot.start && currentTime <= slot.end) {
      return type;
    }
  }
  return null;
}

/**
 * 检查用户在该时段内是否已有聊天
 */
function hasChatInTimeSlot(userId, slotType) {
  const slot = TIME_SLOTS[slotType];
  if (!slot) return false;
  
  const today = getChinaDateStr();
  const startTime = `${today} ${slot.start}:00`;
  const endTime = `${today} ${slot.end}:00`;

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM chat_messages
    WHERE user_id = ? AND role = 'user'
    AND datetime(created_at, '+8 hours') >= ? AND datetime(created_at, '+8 hours') <= ?
  `).get(userId, startTime, endTime);
  
  return result.count > 0;
}

/**
 * 检查当天是否已聊过运动
 */
function hasMentionedExercise(userId) {
  const today = getChinaDateStr();

  // 先检查缓存
  const stats = db.prepare('SELECT today_exercise_mentioned FROM user_chat_stats WHERE user_id = ?').get(userId);
  if (stats && stats.today_exercise_mentioned === 1) return true;
  
  // 查询当天消息（东八区）
  const messages = db.prepare(`
    SELECT content FROM chat_messages
    WHERE user_id = ? AND role = 'user'
    AND date(created_at, '+8 hours') = ?
  `).all(userId, today);
  
  const hasExercise = messages.some(msg => 
    EXERCISE_KEYWORDS.some(keyword => msg.content.includes(keyword))
  );
  
  // 更新缓存
  if (hasExercise) {
    db.prepare(`
      INSERT INTO user_chat_stats (user_id, today_exercise_mentioned)
      VALUES (?, 1)
      ON CONFLICT(user_id) DO UPDATE SET today_exercise_mentioned = 1
    `).run(userId);
  }
  
  return hasExercise;
}

/**
 * 检查用户今天是否已有某餐饮食记录
 */
function hasDietRecordToday(userId, mealTime) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM diet_records
    WHERE user_id = ? AND record_date = ? AND meal_time = ?
  `).get(userId, getChinaDateStr(), mealTime);
  return result.count > 0;
}

/**
 * 检查用户今天是否已有运动记录
 */
function hasExerciseRecordToday(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM exercise_records
    WHERE user_id = ? AND record_date = ?
  `).get(userId, getChinaDateStr());
  return result.count > 0;
}

/**
 * 获取用户设置
 */
function getUserSettings(userId) {
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  const profile = db.prepare('SELECT water_goal FROM user_profiles WHERE user_id = ?').get(userId);
  return {
    notification_enabled: settings?.notification_enabled ?? 1,
    reminder_water: settings?.reminder_water ?? 1,
    reminder_weight: settings?.reminder_weight ?? 1,
    reminder_exercise: settings?.reminder_exercise ?? 1,
    water_goal: profile?.water_goal || 2000
  };
}

/**
 * 获取今日饮水量
 */
function getTodayWaterTotal(userId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(water_ml), 0) as total FROM habit_records
    WHERE user_id = ? AND record_date = ? AND type = 'water' AND status = 1
  `).get(userId, getChinaDateStr());
  return result.total || 0;
}

/**
 * 检查用户今天是否已有饮水记录
 */
function hasWaterRecordToday(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM habit_records
    WHERE user_id = ? AND record_date = ? AND type = 'water' AND status = 1
  `).get(userId, getChinaDateStr());
  return result.count > 0;
}

/**
 * 获取当天已发送的模板消息数量
 */
function getTodayTemplateCount(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM template_messages
    WHERE user_id = ? AND date(sent_at, '+8 hours') = ?
  `).get(userId, getChinaDateStr());
  return result.count;
}

/**
 * 获取当天已发送的模板类型列表
 */
function getTodaySentTypes(userId) {
  const rows = db.prepare(`
    SELECT DISTINCT template_type FROM template_messages
    WHERE user_id = ? AND date(sent_at, '+8 hours') = ?
  `).all(userId, getChinaDateStr());
  return rows.map(r => r.template_type);
}

/**
 * 检查当天是否已发送过某类型模板
 */
function hasSentToday(userId, templateType) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM template_messages
    WHERE user_id = ? AND template_type = ? AND date(sent_at, '+8 hours') = ?
  `).get(userId, templateType, getChinaDateStr());
  return result.count > 0;
}

/**
 * 获取用户连续未回复次数
 */
function getConsecutiveUnread(userId) {
  const result = db.prepare('SELECT consecutive_unread FROM user_chat_stats WHERE user_id = ?').get(userId);
  return result ? result.consecutive_unread : 0;
}

/**
 * 更新用户连续未回复次数
 */
function updateConsecutiveUnread(userId, increment = true) {
  const today = getChinaDateStr();
  if (increment) {
    db.prepare(`
      INSERT INTO user_chat_stats (user_id, consecutive_unread, last_active_date)
      VALUES (?, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        consecutive_unread = consecutive_unread + 1,
        last_active_date = ?
    `).run(userId, today, today);
  } else {
    db.prepare(`
      INSERT INTO user_chat_stats (user_id, consecutive_unread, last_active_date)
      VALUES (?, 0, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        consecutive_unread = 0,
        last_active_date = ?
    `).run(userId, today, today);
  }
}

/**
 * 重置每日统计（每天0点调用）
 */
function resetDailyStats() {
  const today = getChinaDateStr();
  db.prepare(`
    UPDATE user_chat_stats
    SET today_message_count = 0,
        today_exercise_mentioned = 0,
        last_active_date = ?
    WHERE last_active_date < ?
  `).run(today, today);
}

/**
 * 随机获取一条话术
 */
function getRandomTemplate(templateType, mode) {
  const lib = loadTemplateLibrary();
  const templates = lib[templateType]?.[mode];
  if (!templates || templates.length === 0) {
    return lib[templateType]?.gentle?.[0] || '你好呀，今天过得怎么样？';
  }
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * 获取用户搭子模式
 */
function getUserPartnerMode(userId) {
  const result = db.prepare('SELECT mode FROM partners WHERE user_id = ?').get(userId);
  return result ? result.mode : 'gentle';
}

// ==================== 核心发送逻辑 ====================

/**
 * 检查并发送当前时段模板消息（单用户）
 */
function checkAndSendTemplatesForUser(userId) {
  const currentSlot = getCurrentTimeSlot();
  if (!currentSlot) return null;

  // 0. 读取用户通知设置
  const settings = getUserSettings(userId);
  if (!settings.notification_enabled) {
    console.log(`[模板消息] 用户${userId}关闭了通知总开关，跳过`);
    return null;
  }

  // 细分提醒开关过滤
  const slotSwitchMap = {
    water: settings.reminder_water,
    exercise: settings.reminder_exercise,
    weight: settings.reminder_weight,
    breakfast: settings.reminder_weight,
    lunch: settings.reminder_weight,
    dinner: settings.reminder_weight
  };
  if (slotSwitchMap[currentSlot] === 0) {
    console.log(`[模板消息] 用户${userId}关闭了${currentSlot}提醒，跳过`);
    return null;
  }

  // 0. 勿扰时段不发送
  if (isInQuietHours(userId)) {
    console.log(`[模板消息] 用户${userId}处于勿扰时段，跳过`);
    return null;
  }

  // 0. 检查是否有正在生成的 helper 回复，避免打断 AI
  if (chatState.isHelperPending(userId)) {
    console.log(`[模板消息] 用户${userId}的helper回复pending，跳过`);
    return null;
  }

  // 1. 检查连续未回复是否>=5
  const consecutiveUnread = getConsecutiveUnread(userId);
  if (consecutiveUnread >= 5) return null;

  // 2. 检查当天是否已发送过该类型
  if (hasSentToday(userId, currentSlot)) return null;

  // 3. 检查时段内是否已聊天
  if (hasChatInTimeSlot(userId, currentSlot)) {
    // 用户已聊天，重置未回复计数
    updateConsecutiveUnread(userId, false);
    return null;
  }

  // 4. 检查当天发送数量
  const todayCount = getTodayTemplateCount(userId);
  if (todayCount >= 3) return null; // 已达上限

  // 5. 检查用户今天是否已有对应记录（聊天或记录表中）
  if (currentSlot === 'breakfast' || currentSlot === 'lunch' || currentSlot === 'dinner') {
    if (hasDietRecordToday(userId, currentSlot)) return null;
  } else if (currentSlot === 'exercise') {
    if (hasExerciseRecordToday(userId)) return null;
  } else if (currentSlot === 'weight') {
    const todayWeight = db.prepare(`
      SELECT id FROM body_records
      WHERE user_id = ? AND record_date = ? AND type = 'weight' AND status = 1
    `).get(userId, getChinaDateStr());
    if (todayWeight) return null;
  } else if (currentSlot === 'water') {
    const todayWater = getTodayWaterTotal(userId);
    if (todayWater >= settings.water_goal) return null;
    if (hasWaterRecordToday(userId)) return null;
  }

  // 6. 运动消息特殊检查（聊天中已提到运动）
  if (currentSlot === 'exercise' && hasMentionedExercise(userId)) return null;

  // 7. 智能降级：晚餐时段检查早午餐是否均未回复
  if (currentSlot === 'dinner') {
    const sentTypes = getTodaySentTypes(userId);
    const hasBreakfast = sentTypes.includes('breakfast');
    const hasLunch = sentTypes.includes('lunch');

    if (hasBreakfast && hasLunch) {
      // 检查早午餐是否都未回复（用户没有在这些时段内聊天）
      const breakfastReplied = hasChatInTimeSlot(userId, 'breakfast');
      const lunchReplied = hasChatInTimeSlot(userId, 'lunch');

      if (!breakfastReplied && !lunchReplied) {
        // 跳过晚餐，改发运动消息（如果运动时段还没到，先记录标记）
        return null;
      }
    }
  }

  // 8. 发送模板消息
  const mode = getUserPartnerMode(userId);
  let content = getRandomTemplate(currentSlot, mode);

  // 饮水提醒注入今日数据
  if (currentSlot === 'water') {
    const todayWater = getTodayWaterTotal(userId);
    const remaining = Math.max(0, settings.water_goal - todayWater);
    content = content
      .replace(/{drank}/g, todayWater)
      .replace(/{goal}/g, settings.water_goal)
      .replace(/{remaining}/g, remaining);
  }

  // 保存到聊天记录、记录模板发送、更新未回复计数放在同一事务
  return withTransaction(() => {
    const messageResult = db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, mode, created_at)
      VALUES (?, 'partner', ?, ?, datetime('now'))
    `).run(userId, content, mode);

    db.prepare(`
      INSERT INTO template_messages (user_id, template_type, content, sent_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, currentSlot, content);

    updateConsecutiveUnread(userId, true);

    return {
      userId,
      type: currentSlot,
      content,
      messageId: messageResult.lastInsertRowid
    };
  });
}

/**
 * 检查并发送模板消息（定时任务调用）
 */
function checkAndSendTemplates() {
  // 获取所有活跃用户
  const users = db.prepare(`
    SELECT u.id
    FROM users u
    JOIN partners p ON u.id = p.user_id
    WHERE u.status = 1
  `).all();

  const sentMessages = [];

  for (const user of users) {
    const sent = checkAndSendTemplatesForUser(user.id);
    if (sent) sentMessages.push(sent);
  }

  return sentMessages;
}

/**
 * 发送冷启动唤醒消息（APP启动时调用）
 */
function sendWakeupMessage(userId) {
  // 检查连续未回复
  const consecutiveUnread = getConsecutiveUnread(userId);
  if (consecutiveUnread < 5) return null;

  // 当天已发送过唤醒消息则不再发送
  if (hasSentToday(userId, 'wakeup')) return null;

  // 勿扰时段不发送
  if (isInQuietHours(userId)) return null;

  // 获取用户模式
  const mode = getUserPartnerMode(userId);
  const content = getRandomTemplate('wakeup', mode);
  
  // 保存到聊天记录、记录模板发送、重置未回复计数放在同一事务
  return withTransaction(() => {
    const messageResult = db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, mode, created_at)
      VALUES (?, 'partner', ?, ?, datetime('now'))
    `).run(userId, content, mode);

    db.prepare(`
      INSERT INTO template_messages (user_id, template_type, content, sent_at)
      VALUES (?, 'wakeup', ?, datetime('now'))
    `).run(userId, content);

    updateConsecutiveUnread(userId, false);

    return {
      userId,
      type: 'wakeup',
      content,
      messageId: messageResult.lastInsertRowid
    };
  });
}

// ==================== 沉默召回 ====================

const RECALL_DAYS = [3, 7, 14, 30];

/**
 * 获取指定天数的召回文案
 */
function getRecallTemplate(days, mode) {
  const lib = loadTemplateLibrary();
  const templates = lib.recall?.[mode] || lib.recall?.gentle || [];
  if (templates.length === 0) {
    return `已经 ${days} 天没见到你啦，今天回来记录一下吗？`;
  }
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  return tpl.replace(/\{days\}/g, days);
}

/**
 * 给指定用户发送 N 天沉默召回消息
 */
function sendRecallMessage(userId, days) {
  const type = `recall_${days}d`;

  // 当天已发送过该节点召回则跳过
  if (hasSentToday(userId, type)) return null;

  // 勿扰时段不发送
  if (isInQuietHours(userId)) return null;

  const mode = getUserPartnerMode(userId);
  const content = getRecallTemplate(days, mode);

  return withTransaction(() => {
    const messageResult = db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, mode, created_at)
      VALUES (?, 'partner', ?, ?, datetime('now'))
    `).run(userId, content, mode);

    db.prepare(`
      INSERT INTO template_messages (user_id, template_type, content, sent_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, type, content);

    updateConsecutiveUnread(userId, false);

    return {
      userId,
      type,
      content,
      messageId: messageResult.lastInsertRowid
    };
  });
}

/**
 * 检查并发送沉默召回消息
 * 基于 last_login_at，按 3/7/14/30 天节点触发，每个节点每天只发一次
 */
function checkAndSendRecalls() {
  const today = getChinaDateStr();
  const sent = [];

  for (const days of RECALL_DAYS) {
    const type = `recall_${days}d`;
    const users = db.prepare(`
      SELECT u.id FROM users u
      WHERE u.status = 1
        AND (
          u.last_login_at IS NULL
          OR date(u.last_login_at, '+8 hours') <= date(?, '-' || ? || ' days')
        )
        AND NOT EXISTS (
          SELECT 1 FROM template_messages tm
          WHERE tm.user_id = u.id
            AND tm.template_type = ?
            AND date(tm.sent_at, '+8 hours') = ?
        )
    `).all(today, days, type, today);

    for (const user of users) {
      try {
        const result = sendRecallMessage(user.id, days);
        if (result) sent.push(result);
      } catch (err) {
        console.error(`[recall] 发送失败 user=${user.id} days=${days}:`, err.message);
      }
    }
  }

  if (sent.length > 0) {
    console.log(`[recall] 已发送 ${sent.length} 条沉默召回消息`);
  }
  return sent;
}

/**
 * 用户发送消息后更新统计
 */
function onUserMessage(userId) {
  // 重置未回复计数
  updateConsecutiveUnread(userId, false);
  
  // 检查是否提到运动（东八区当天）
  const today = getChinaDateStr();
  const messages = db.prepare(`
    SELECT content FROM chat_messages
    WHERE user_id = ? AND role = 'user'
    AND date(created_at, '+8 hours') = ?
    ORDER BY created_at DESC LIMIT 1
  `).all(userId, today);
  
  if (messages.length > 0) {
    const content = messages[0].content;
    const hasExercise = EXERCISE_KEYWORDS.some(keyword => content.includes(keyword));
    
    if (hasExercise) {
      db.prepare(`
        INSERT INTO user_chat_stats (user_id, today_exercise_mentioned)
        VALUES (?, 1)
        ON CONFLICT(user_id) DO UPDATE SET today_exercise_mentioned = 1
      `).run(userId);
    }
  }
  
  // 更新当天消息计数（跨天自动重置）
  db.prepare(`
    INSERT INTO user_chat_stats (user_id, today_message_count, last_active_date)
    VALUES (?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      today_message_count = CASE WHEN last_active_date = ? THEN today_message_count + 1 ELSE 1 END,
      last_active_date = ?
  `).run(userId, today, today, today);
}

/**
 * 获取用户聊天统计（用于前端冷启动检测）
 */
function getUserChatStats(userId) {
  const result = db.prepare('SELECT * FROM user_chat_stats WHERE user_id = ?').get(userId);
  if (!result) {
    return {
      consecutive_unread: 0,
      today_message_count: 0,
      today_exercise_mentioned: 0,
      last_active_date: null
    };
  }
  return result;
}

// ==================== 初始化模板配置 ====================

/**
 * 初始化模板配置到数据库（首次启动时调用）
 */
function initTemplateConfigs() {
  const count = db.prepare('SELECT COUNT(*) as count FROM template_configs').get().count;
  if (count > 0) return; // 已初始化过
  
  const insert = db.prepare(`
    INSERT INTO template_configs (template_type, mode, content, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  
  let order = 0;
  for (const [type, modes] of Object.entries(TEMPLATE_LIBRARY)) {
    for (const [mode, templates] of Object.entries(modes)) {
      for (const content of templates) {
        insert.run(type, mode, content, order++);
      }
    }
  }
  
  console.log('模板配置初始化完成');
}

module.exports = {
  // 模板库
  TEMPLATE_LIBRARY,
  TIME_SLOTS,
  
  // 核心功能
  checkAndSendTemplates,
  checkAndSendTemplatesForUser,
  sendWakeupMessage,
  checkAndSendRecalls,
  onUserMessage,
  getUserChatStats,
  resetDailyStats,
  initTemplateConfigs,
  
  // 工具函数（供测试用）
  getCurrentTimeSlot,
  hasChatInTimeSlot,
  hasMentionedExercise,
  getTodayTemplateCount,
  getConsecutiveUnread,
  getMsUntilChinaMidnight
};
