/**
 * 模板消息服务
 * 负责管理话术模板库、发送策略、定时任务
 */
const { db } = require('../db');
const chatState = require('./chatState');

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
  }
};

// 发送时段配置
const TIME_SLOTS = {
  breakfast: { start: '07:30', end: '09:00' },
  lunch: { start: '11:30', end: '13:00' },
  dinner: { start: '17:30', end: '19:00' },
  exercise: { start: '19:00', end: '20:00' }
};

// 运动相关关键词
const EXERCISE_KEYWORDS = ['运动', '步数', '跑步', '走路', '健身', '锻炼', '散步', '快走', '跳绳', '游泳', '瑜伽', '打卡'];

// ==================== 工具函数 ====================

/**
 * 获取当前时间是否在发送时段内
 */
function getCurrentTimeSlot() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
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
  
  const today = new Date().toISOString().split('T')[0];
  const startTime = `${today} ${slot.start}:00`;
  const endTime = `${today} ${slot.end}:00`;
  
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM chat_messages
    WHERE user_id = ? AND role = 'user' 
    AND created_at >= ? AND created_at <= ?
  `).get(userId, startTime, endTime);
  
  return result.count > 0;
}

/**
 * 检查当天是否已聊过运动
 */
function hasMentionedExercise(userId) {
  const today = new Date().toISOString().split('T')[0];
  
  // 先检查缓存
  const stats = db.prepare('SELECT today_exercise_mentioned FROM user_chat_stats WHERE user_id = ?').get(userId);
  if (stats && stats.today_exercise_mentioned === 1) return true;
  
  // 查询当天消息
  const messages = db.prepare(`
    SELECT content FROM chat_messages
    WHERE user_id = ? AND role = 'user'
    AND created_at >= date('now') AND created_at < date('now', '+1 day')
  `).all(userId);
  
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
    WHERE user_id = ? AND record_date = date('now') AND meal_time = ?
  `).get(userId, mealTime);
  return result.count > 0;
}

/**
 * 检查用户今天是否已有运动记录
 */
function hasExerciseRecordToday(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM exercise_records
    WHERE user_id = ? AND record_date = date('now')
  `).get(userId);
  return result.count > 0;
}

/**
 * 获取当天已发送的模板消息数量
 */
function getTodayTemplateCount(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM template_messages
    WHERE user_id = ? AND date(sent_at) = date('now')
  `).get(userId);
  return result.count;
}

/**
 * 获取当天已发送的模板类型列表
 */
function getTodaySentTypes(userId) {
  const rows = db.prepare(`
    SELECT DISTINCT template_type FROM template_messages
    WHERE user_id = ? AND date(sent_at) = date('now')
  `).all(userId);
  return rows.map(r => r.template_type);
}

/**
 * 检查当天是否已发送过某类型模板
 */
function hasSentToday(userId, templateType) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM template_messages
    WHERE user_id = ? AND template_type = ? AND date(sent_at) = date('now')
  `).get(userId, templateType);
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
  if (increment) {
    db.prepare(`
      INSERT INTO user_chat_stats (user_id, consecutive_unread, last_active_date)
      VALUES (?, 1, date('now'))
      ON CONFLICT(user_id) DO UPDATE SET 
        consecutive_unread = consecutive_unread + 1,
        last_active_date = date('now')
    `).run(userId);
  } else {
    db.prepare(`
      INSERT INTO user_chat_stats (user_id, consecutive_unread, last_active_date)
      VALUES (?, 0, date('now'))
      ON CONFLICT(user_id) DO UPDATE SET 
        consecutive_unread = 0,
        last_active_date = date('now')
    `).run(userId);
  }
}

/**
 * 重置每日统计（每天0点调用）
 */
function resetDailyStats() {
  db.prepare(`
    UPDATE user_chat_stats 
    SET today_message_count = 0, 
        today_exercise_mentioned = 0,
        last_active_date = date('now')
    WHERE last_active_date < date('now')
  `).run();
}

/**
 * 随机获取一条话术
 */
function getRandomTemplate(templateType, mode) {
  const templates = TEMPLATE_LIBRARY[templateType]?.[mode];
  if (!templates || templates.length === 0) {
    return TEMPLATE_LIBRARY[templateType]?.gentle?.[0] || '你好呀，今天过得怎么样？';
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
  const content = getRandomTemplate(currentSlot, mode);

  // 保存到聊天记录
  const messageResult = db.prepare(`
    INSERT INTO chat_messages (user_id, role, content, mode, created_at)
    VALUES (?, 'partner', ?, ?, datetime('now'))
  `).run(userId, content, mode);

  // 记录模板发送
  db.prepare(`
    INSERT INTO template_messages (user_id, template_type, content, sent_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(userId, currentSlot, content);

  // 更新未回复计数
  updateConsecutiveUnread(userId, true);

  return {
    userId,
    type: currentSlot,
    content,
    messageId: messageResult.lastInsertRowid
  };
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
  
  // 获取用户模式
  const mode = getUserPartnerMode(userId);
  const content = getRandomTemplate('wakeup', mode);
  
  // 保存到聊天记录
  const messageResult = db.prepare(`
    INSERT INTO chat_messages (user_id, role, content, mode, created_at)
    VALUES (?, 'partner', ?, ?, datetime('now'))
  `).run(userId, content, mode);
  
  // 记录模板发送
  db.prepare(`
    INSERT INTO template_messages (user_id, template_type, content, sent_at)
    VALUES (?, 'wakeup', ?, datetime('now'))
  `).run(userId, content);
  
  // 重置未回复计数
  updateConsecutiveUnread(userId, false);
  
  return {
    userId,
    type: 'wakeup',
    content,
    messageId: messageResult.lastInsertRowid
  };
}

/**
 * 用户发送消息后更新统计
 */
function onUserMessage(userId) {
  // 重置未回复计数
  updateConsecutiveUnread(userId, false);
  
  // 检查是否提到运动
  const today = new Date().toISOString().split('T')[0];
  const messages = db.prepare(`
    SELECT content FROM chat_messages
    WHERE user_id = ? AND role = 'user'
    AND created_at >= ? AND created_at < date(?, '+1 day')
    ORDER BY created_at DESC LIMIT 1
  `).all(userId, today, today);
  
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
  
  // 更新当天消息计数
  db.prepare(`
    INSERT INTO user_chat_stats (user_id, today_message_count, last_active_date)
    VALUES (?, 1, date('now'))
    ON CONFLICT(user_id) DO UPDATE SET 
      today_message_count = today_message_count + 1,
      last_active_date = date('now')
  `).run(userId);
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
  onUserMessage,
  getUserChatStats,
  resetDailyStats,
  initTemplateConfigs,
  
  // 工具函数（供测试用）
  getCurrentTimeSlot,
  hasChatInTimeSlot,
  hasMentionedExercise,
  getTodayTemplateCount,
  getConsecutiveUnread
};
