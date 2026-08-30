/**
 * 聊天控制器
 * 核心：接收用户消息，调用主协调 Agent，异步沉淀信息
 */
const { db, withTransaction } = require('../db');
const { success, error } = require('../utils/response');
const mainAgent = require('../services/agents/mainAgent');
const precipitationAgent = require('../services/agents/precipitationAgent');
const helperAgent = require('../services/agents/helperAgent');
const partnerAssetAgent = require('../services/agents/partnerAssetAgent');
const templateMessageService = require('../services/templateMessageService');
const promptService = require('../services/promptService');
const { callWithPrompt } = require('../services/aiClient');
const chatState = require('../services/chatState');
const tagMatcher = require('../services/tagMatcher');
const taskService = require('../services/taskService');
const achievementService = require('../services/achievementService');
const petService = require('../services/petService');
const newbieTaskService = require('../services/newbieTaskService');
const rewardService = require('../services/rewardService');
const { safeJsonParse } = require('../utils/safeJson');

// ============================================================
// Section 2: Partner asset extraction helpers
// 从搭子回复中提取食谱、方法等沉淀资产，走「待确认 → 已记录」流程
// ============================================================

/**
 * 将搭子回复中的食谱提取为沉淀记录，走和饮食/运动一致的「待确认 → 已记录」流程
 * 确认后再写入 museum_items，避免聊天页同时出现待确认标签和 PendingAssetCard
 */
async function savePartnerRecipes(userId, content, chatMessageId = null) {
  try {
    const recipes = await partnerAssetAgent.extractPartnerRecipes(content);
    if (!recipes || recipes.length === 0) return [];

    const insertPrecipitation = db.prepare(`
      INSERT INTO precipitation_records
      (user_id, chat_id, type, sub_type, content, extracted_data, confidence, status, source, tags, remark)
      VALUES (?, ?, 'recipe', ?, ?, ?, ?, 0, 1, ?, ?)
    `);

    let linkedChatMsg = false;

    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i];
      const subType = recipe.title || '搭子推荐食谱';
      const contentText = recipe.content || subType;
      const extractedData = {
        title: subType,
        content: contentText,
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || '',
        tip: recipe.tip || '',
        meal_type: recipe.meal_type || '',
        total_weight: recipe.total_weight || 0,
        total_calorie: recipe.total_calorie || 0
      };
      const extractedJson = JSON.stringify(extractedData);

      // 每条食谱的沉淀记录与聊天消息关联放在同一事务
      withTransaction(() => {
        // 为每条食谱创建沉淀记录，让用户可以像饮食/运动一样走「待确认 → 已记录」流程
        const precipitationId = insertPrecipitation.run(
          userId,
          chatMessageId || null,
          subType,
          contentText,
          extractedJson,
          recipe.confidence || 0.9,
          null,
          null
        ).lastInsertRowid;

        // 聊天消息只关联第一条食谱的沉淀记录（消息只能有一个 precipitation_id）
        if (chatMessageId && !linkedChatMsg) {
          db.prepare(`
            UPDATE chat_messages
            SET precipitation_status = 2, precipitation_type = 'recipe', precipitation_id = ?
            WHERE id = ? AND user_id = ?
          `).run(precipitationId, chatMessageId, userId);
          linkedChatMsg = true;
        }
      });

      console.log('[搭子食谱] 已提取待确认:', subType);
    }

    return recipes;
  } catch (err) {
    console.error('[搭子食谱] 提取失败:', err.message);
    return [];
  }
}

/**
 * 将搭子/Helper 回复中的方法提取为待确认资产
 */
function savePartnerMethod(userId, method, chatMessageId = null) {
  if (!method || !method.title) return null;
  try {
    const insert = db.prepare(`
      INSERT INTO museum_items (user_id, chat_message_id, type, sub_type, content, extracted_data, author, effectiveness, status)
      VALUES (?, ?, 'method', ?, ?, ?, 'partner', 1, 0)
    `);
    insert.run(
      userId,
      chatMessageId || null,
      method.title,
      method.content,
      JSON.stringify({ title: method.title, content: method.content })
    );
    console.log('[搭子方法] 已提取待确认:', method.title);
    return method;
  } catch (err) {
    console.error('[搭子方法] 提取失败:', err.message);
    return null;
  }
}

// ============================================================
// Section 3: Content heuristics & constants
// 食物/运动关键词表、消息长度/日期校验、通用关键词匹配函数
// ============================================================

const MAX_MESSAGE_LENGTH = 2000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// 食物相关关键词（用于快速判断是否需要饮食辅助）
const FOOD_KEYWORDS = [
  '吃', '喝', '食物', '早餐', '午餐', '晚餐', '加餐', '零食', '饭', '菜', '肉',
  '水果', '鸡蛋', '香蕉', '酸奶', '面包', '米饭', '面条', '燕麦', '牛奶', '豆浆',
  '咖啡', '坚果', '蔬菜', '主食', '玉米', '红薯', '紫薯', '土豆', '西红柿', '黄瓜',
  '苹果', '橙子', '葡萄', '西瓜', '草莓', '蓝莓', '猕猴桃', '牛油果', '奶酪', '芝士',
  '肉包', '水饺', '馄饨', '肠粉', '粥', '粉', '面', '饵块', '年糕', '汤圆', '粽子',
  '青团', '月饼', '蛋黄酥', '绿豆糕', '红豆糕', '桂花糕', '发糕', '米糕', '糍粑',
  '锅盔', '馕', '大饼', '油条', '豆腐脑', '豆花', '豆腐', '豆干', '豆皮', '腐竹',
  '千张', '素鸡', '面筋', '烤麸', '窝头', '馒头', '花卷', '包子', '饺子', '抄手',
  '云吞', '锅贴', '生煎', '小笼包', '灌汤包', '肉夹馍', '煎饼果子', '鸡蛋灌饼',
  '手抓饼', '葱油饼', '韭菜盒子', '馅饼', '烧饼', '烙饼', '春饼', '荷叶饼', '口袋饼',
  '油饼', '麻球', '糖糕', '粢饭糕', '糍饭团', '饭团', '寿司', '便当', '盒饭',
  '盖浇饭', '盖饭', '木桶饭', '竹筒饭', '荷叶饭', '煲仔饭', '卤肉饭', '猪脚饭',
  '鸡腿饭', '牛腩饭', '排骨饭', '鳗鱼饭', '石锅拌饭', '扬州炒饭', '蛋炒饭',
  '酱油炒饭', '海鲜炒饭', '牛肉炒饭', '鸡肉炒饭', '腊肠炒饭', '泡菜炒饭',
  '咖喱饭', '焗饭', '烩饭', '焖饭', '蒸饭', '捞饭', '汤饭', '泡饭', '稀饭',
  '白粥', '小米粥', '南瓜粥', '皮蛋瘦肉粥', '艇仔粥', '及第粥', '海鲜粥',
  '猪肝粥', '鱼片粥', '蔬菜粥', '杂粮粥', '八宝粥', '银耳羹', '燕窝羹', '桃胶',
  '皂角米', '雪燕', '马蹄糕', '椰汁糕', '布丁', '奶冻', '慕斯', '提拉米苏',
  '芝士蛋糕', '奶油蛋糕', '水果蛋糕', '巧克力蛋糕', '千层蛋糕', '磅蛋糕',
  '海绵蛋糕', '戚风蛋糕', '马芬', '纸杯蛋糕', '甜甜圈', '曲奇', '饼干', '威化',
  '蛋卷', '蛋挞', '泡芙', '马卡龙', '牛轧糖', '雪花酥', '沙琪玛', '麻花', '馓子',
  '江米条', '萨其马', '糕点', '甜点', '甜品', '糖水', '甜汤', '奶茶', '奶盖',
  '烧仙草', '芋圆', '西米', '红豆', '绿豆', '薏仁', '紫米', '黑米', '糯米',
  '麻糬', '芋泥', '地瓜泥', '南瓜泥', '紫薯泥', '山药泥', '土豆泥', '果酱',
  '果冻', '冰淇淋', '雪糕', '冰棍', '冰棒', '圣代', '奶昔', '思慕雪', '果汁',
  '汽水', '可乐', '雪碧', '苏打水', '气泡水', '矿泉水', '纯净水', '饮用水',
  '白开水', '茶'
];

// 运动相关关键词（用于快速判断是否需要运动辅助）
const EXERCISE_KEYWORDS = [
  '运动', '训练', '健身', '哑铃', '杠铃', '跑步', '游泳', '跳绳', '骑车', '骑行',
  '瑜伽', '帕梅拉', '周六野', '刘畊宏', '肩背', '胸', '腿', '臀', '腹', '有氧',
  '无氧', 'HIIT', 'Tabata', '拉伸', '深蹲', '俯卧撑', '平板支撑', '卷腹',
  '开合跳', '波比跳', '快走', '慢跑', '爬楼', '爬山', '登山', '动感单车',
  '椭圆机', '划船机', '壶铃', 'TRX', '战绳', '拳击', '打拳', '搏击', '尊巴',
  '舞蹈', '跳操', '健身操', '有氧操', '力量训练', '体能训练', '功能性训练',
  '核心训练', '臀腿训练', '背部训练', '肩部训练', '手臂训练', '胸部训练',
  '腹部训练', '拉伸训练', '热身', '冷身', '放松', '按摩', '泡沫轴', '筋膜枪',
  '运动康复', '体能测试', '体测', '马拉松', '半程马拉松', '越野跑', '接力跑',
  '冲刺跑', '折返跑', '高抬腿', '登山跑', '俄罗斯转体', '臀桥', '桥式',
  '死虫式', '鸟狗式', '侧平板', '倒立', '手倒立', '单腿硬拉', '箭步蹲',
  '保加利亚蹲', '靠墙静蹲', '马步', '引体向上', '引体向上机', '仰卧起坐',
  '弹力带', '阻力带', '拉力带', '乳胶带', '8字拉力器', '开肩美背',
  '哑铃弯举', '哑铃推举', '哑铃飞鸟', '哑铃划船', '哑铃深蹲', '哑铃硬拉',
  '哑铃侧平举', '哑铃前平举', '杠铃深蹲', '杠铃硬拉', '杠铃卧推', '杠铃划船',
  '杠铃推举', '杠铃弯举', '杠铃臀推', '相扑硬拉', '罗马尼亚硬拉', '器械训练',
  '器械推胸', '器械划船', '器械夹胸', '腿举', '腿弯举', '腿屈伸', '坐姿划船',
  '高位下拉', '史密斯机', '龙门架', '蝴蝶机', '推胸机', '壶铃摇摆', '壶铃抓举',
  '壶铃深蹲', '壶铃推举', '土耳其起立', 'TRX划船', 'TRX深蹲', 'TRX俯卧撑',
  '悬挂训练', '甩绳', '药球', '药球抛', '沙袋', '轮胎翻', '农夫行走', '雪橇推',
  '攀岩', '攀冰', '溯溪', '漂流', '滑雪', '滑冰', '轮滑', '滑板', '羽毛球',
  '乒乓球', '网球', '排球', '篮球', '足球', '棒球', '垒球', '高尔夫球',
  '保龄球', '台球', '门球', '壁球', '橄榄球', '曲棍球', '冰球', '手球', '水球',
  '马球', '藤球', '毽球', '蹴鞠', '射箭', '射击', '击剑', '马术', '赛马',
  '赛艇', '皮划艇', '帆船', '帆板', '冲浪', '潜水', '浮潜', '深潜', '跳水',
  '花样游泳', '体操', '艺术体操', '蹦床', '技巧', '健美操', '啦啦操',
  '体育舞蹈', '街舞', '霹雳舞', '爵士舞', '芭蕾舞', '现代舞', '民族舞',
  '古典舞', '拉丁舞', '国标舞', '交谊舞', '摇摆舞', '广场舞', '健身舞',
  '燃脂舞', '减脂舞', '太极', '气功', '普拉提', '冥想', '正念', '呼吸训练',
  '产后恢复', '盆底肌训练', '凯格尔运动', '腹直肌修复', '办公室运动',
  '椅子瑜伽', '坐姿运动', '床上运动', '睡前拉伸', '晨间唤醒', '午休运动',
  '碎片化运动', '微运动', '办公室微运动'
];

/**
 * 判断文本内容是否包含任意给定关键词
 * @param {string} content 待检测文本
 * @param {string[]} keywords 关键词数组
 * @returns {boolean}
 */
function containsAnyKeyword(content, keywords) {
  if (!content) return false;
  const text = String(content);
  return keywords.some(kw => text.includes(kw));
}

/**
 * 判断内容是否为陈述饮食行为（而非疑问/咨询）
 * 用于触发 helperAgent 自动计算并返回热量总结
 * @param {string} content 用户消息
 * @returns {boolean}
 */
function isDeclarativeFoodStatement(content) {
  if (!content) return false;
  const text = String(content).trim();
  // 以疑问词结尾、含明显疑问语气或征求建议，视为疑问句
  if (/[吗嘛呢？?]\s*$/.test(text)) return false;
  if (/^(多少|什么|怎么|为什么|建议|推荐|能|可以|能不能|可不可以|好吗|行吗)/.test(text)) return false;
  // 否则视为陈述句
  return true;
}

// ============================================================
// Section 4: Core message handler (sendMessage)
// 聊天主流程：参数校验 → 保存用户消息 → 调用主 Agent → 同步/异步 Helper → 沉淀 Agent
// ============================================================

/**
 * 发送消息
 * 核心：接收用户消息，调用主协调 Agent，异步沉淀信息
 */
async function sendMessage(req, res) {
  const userId = req.userId;
  const { content, content_type = 'text', record_date } = req.body;
  const today = record_date || new Date().toISOString().split('T')[0];

  if (!content || !content.trim()) {
    return res.status(400).json(error('消息内容不能为空', 400));
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json(error(`消息内容不能超过 ${MAX_MESSAGE_LENGTH} 字`, 400));
  }
  if (!DATE_REGEX.test(today)) {
    return res.status(400).json(error('记录日期格式不正确', 400));
  }

  let userMessageId = null;
  let partner = null;

  try {
    // 获取用户信息和搭子信息
    const user = db.prepare(`
      SELECT u.*, p.current_weight, p.target_weight, p.initial_weight,
             p.bmr, p.tdee, p.daily_calorie_target, p.calorie_deficit,
             p.dietary_taboos, p.preferences
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(userId);

    partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);

    // 把「创建搭子 + 保存用户消息 + 标签 + 统计 + 任务」包入同一事务
    const initResult = withTransaction(() => {
      // 如果没有搭子，自动创建一个默认搭子
      if (!partner) {
        db.prepare(`
          INSERT INTO partners (user_id, name, mode, avatar_url)
          VALUES (?, '你的搭子', 'gentle', '/static/partner-avatar.png')
        `).run(userId);
        partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);
      }

      // 保存用户消息
      const insertUserMsg = db.prepare(`
        INSERT INTO chat_messages (user_id, role, content, content_type, mode)
        VALUES (?, 'user', ?, ?, ?)
      `);
      const messageId = insertUserMsg.run(userId, content, content_type, partner.mode).lastInsertRowid;

      // 同步标签匹配
      const preliminaryTag = tagMatcher.matchMessageTags(content);
      if (preliminaryTag) {
        db.prepare('UPDATE chat_messages SET precipitation_status = ?, precipitation_type = ? WHERE id = ?')
          .run(preliminaryTag.status, preliminaryTag.type, messageId);
        console.log('[TagMatcher] 消息已打标签:', messageId, preliminaryTag.type, preliminaryTag.status);
      }

      // 更新用户聊天统计（模板消息系统）
      templateMessageService.onUserMessage(userId);

      // 推进「和搭搭聊天」任务
      taskService.updateTaskProgress(userId, 'chat', 1);
      newbieTaskService.checkAction(userId, 'chat');

      return { messageId, preliminaryTag };
    });

    userMessageId = initResult.messageId;
    const preliminaryTag = initResult.preliminaryTag;

    // 获取最近历史消息（排除刚保存的当前消息）
    const history = db.prepare(`
      SELECT role, content, mode FROM chat_messages
      WHERE user_id = ? AND id != ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(userId, userMessageId).reverse();

    // 调用主协调 Agent
    const agentResult = await mainAgent.callMainAgent(content, history, user, partner);

    let finalReply = agentResult.reply;
    let helperInfo = null;
    let jumpPage = null;
    let isAsyncHelper = false; // 标记是否启用了异步 helper

    // 检查是否需要调用 helperAgent（工具调用或兜底）
    const hasFood = containsAnyKeyword(content, FOOD_KEYWORDS);
    const hasExercise = containsAnyKeyword(content, EXERCISE_KEYWORDS);
    const needsHelper = (agentResult.toolCalls && agentResult.toolCalls.some(t =>
      t.name === 'call_allround_helper' ||
      (t.parameters && (t.parameters.question || t.parameters.query))
    ))
      || (isProfessionalQuestion(content) && !finalReply.includes('千卡') && !finalReply.includes('kcal') && !finalReply.includes('BMI'))
      || (hasFood && hasExercise && !finalReply.includes('千卡') && !finalReply.includes('kcal'))
      // 关键修复：用户发送纯饮食记录消息（如"早上吃了一个牛角包"）时，
      // 主 Agent 往往只回复共情话术而不调用 helper，导致用户感知"helper不工作"。
      // 此处增加兜底：陈述句饮食内容直接触发异步 helper，自动计算热量并返回结果。
      || (hasFood && isDeclarativeFoodStatement(content) && !finalReply.includes('千卡') && !finalReply.includes('kcal'))
      || (preliminaryTag && preliminaryTag.type === 'body_data' && !finalReply.includes('千卡') && !finalReply.includes('kcal') && !finalReply.includes('BMI'));

    // ========== 异步调用信息沉淀 Agent（聊天即记录，不阻塞回复） ==========
    // 无论同步还是异步模式，都触发沉淀；保留 Promise 供异步 helper 等待
    const precipitationPromise = precipitationAgent.callPrecipitationAgent(content, userId, userMessageId, today)
      .then(result => {
        console.log('沉淀结果:', JSON.stringify(result));
        if (result && result.precipitation_id && result.status !== 2) {
          const status = result.status === 1 ? 1 : 2;
          try {
            // 关键修复：不覆盖 finalReconcilePrecipitations 已设置的最佳 precipitation_id
            // 当批量处理多个食物 item 时，finalReconcilePrecipitations 会选择食物数最多的 precipitation_id
            // chatMessage.precipitation_id 可能已被设置为该最佳 ID，不能被最后一个 item 的 ID 覆盖
            db.prepare(`
              UPDATE chat_messages
              SET precipitation_status = ?,
                  precipitation_id = CASE WHEN precipitation_id IS NULL OR precipitation_id = 0 THEN ? ELSE precipitation_id END,
                  precipitation_type = ?
              WHERE id = ?
            `).run(status, result.precipitation_id, result.type || null, userMessageId);
            console.log('沉淀状态已更新:', userMessageId, status, result.precipitation_id, result.type);
          } catch (dbErr) {
            console.error('沉淀状态更新失败:', dbErr.message);
          }
        } else if (result && result.precipitation_id && result.status === 2) {
          // 低置信度沉淀已按设计自动忽略（precipitation_records.status=2）：
          // 不把该记录关联到消息，避免用户点击「待确认」卡片时确认到一条已忽略的记录（无法写入业务表）；
          // 同时保留同步标签给出的待确认状态，用户仍可走手动确认路径
          console.log('沉淀置信度不足自动忽略，不更新消息状态:', result.precipitation_id);
        } else {
          // 沉淀 Agent 未提取到有效内容时：
          // - 如果同步标签已命中食物/运动库，保留「待确认」状态，让用户可手动确认，避免漏记
          // - 只有同步标签也未命中时，才清空待确认状态，避免误标
          if (result && result.extracted === false && !preliminaryTag) {
            try {
              const cleared = db.prepare('UPDATE chat_messages SET precipitation_status = 0 WHERE id = ? AND precipitation_status = 2')
                .run(userMessageId);
              console.log('沉淀未提取且同步标签未命中，清空待确认状态:', userMessageId, cleared.changes);
            } catch (dbErr) {
              console.error('清空待确认状态失败:', dbErr.message);
            }
          } else {
            console.log('沉淀未提取，保留同步标签状态:', userMessageId, preliminaryTag?.type || '无');
          }
        }
        return result;
      })
      .catch(err => {
        console.error('异步沉淀失败:', err);
        return null;
      });

    // 如果需要 helper 且回复中没有包含计算结果（说明 helper 还没执行），启用异步模式
    if (needsHelper && !finalReply.includes('千卡') && !finalReply.includes('kcal') && !finalReply.includes('BMI')) {
      isAsyncHelper = true;
      // 标记正在等待 helper 回复，防止模板消息打断
      chatState.setHelperPending(userId, true);
      // 先保存并返回第一条消息（共情话术）
      const firstReply = finalReply || '嗯嗯，我在听～';
      const insertFirstMsg = db.prepare(`
        INSERT INTO chat_messages (user_id, role, content, content_type, mode)
        VALUES (?, 'partner', ?, 'text', ?)
      `);
      const firstMessageId = insertFirstMsg.run(userId, firstReply, partner.mode).lastInsertRowid;

      // 异步调用 helperAgent
      const helperQuestion = agentResult.toolCalls?.find(t => 
        t.name === 'call_allround_helper'
      )?.parameters?.question || content;

      // 启动异步 helper 调用（等待沉淀Agent完成后再执行，确保数据一致性）
      setTimeout(async () => {
        try {
          // 等待沉淀Agent完成，确保当前消息的饮食/运动记录已写入后再回答
          // 沉淀涉及 LLM 调用，通常 3-10 秒，最多等 20 秒；超时仍继续调用 helperAgent
          const precipitationResult = await Promise.race([
            precipitationPromise,
            new Promise(r => setTimeout(r, 20000))
          ]);
          if (!precipitationResult || precipitationResult.extracted === false) {
            console.log('[AsyncHelper] 沉淀未在超时内完成或为空，继续调用 helperAgent');
          }

          console.log('[AsyncHelper] 沉淀等待完成，开始调用 helperAgent');
          const helperAnswer = await helperAgent.callHelperAgent(helperQuestion, user, partner);
          const isUnhelpful = !helperAnswer || /没有思路|换个问法|我不太明白|不知道你在说什么/i.test(helperAnswer);
          if (helperAnswer && helperAnswer !== '这个问题有点复杂，我慢慢算一下，你先忙别的～' && !isUnhelpful) {
            // 一次性保存完整 helper 回答，避免分片丢失后续内容
            const insertHelperMsg = db.prepare(`
              INSERT INTO chat_messages (user_id, role, content, content_type, mode)
              VALUES (?, 'partner', ?, 'text', ?)
            `);
            const helperMessageId = insertHelperMsg.run(userId, helperAnswer, partner.mode).lastInsertRowid;

            try {
              // 自动提取 helper 回答中的食谱/方法（待确认）
              const recipes = await savePartnerRecipes(userId, helperAnswer, helperMessageId);
              if (recipes.length === 0 && isMethodContent(content)) {
                const method = await partnerAssetAgent.extractPartnerMethod(helperAnswer);
                if (method) {
                  savePartnerMethod(userId, method, helperMessageId);
                }
              }
            } catch (e) {
              console.error('[AsyncHelper] 食谱/方法提取失败:', e.message);
            } finally {
              chatState.setHelperPending(userId, false);
            }
          } else {
            console.log('[AsyncHelper] helper 返回空或超时');
            chatState.setHelperPending(userId, false);
          }
        } catch (e) {
          console.error('[AsyncHelper] 异步 helper 调用失败:', e.message);
          chatState.setHelperPending(userId, false);
        }
      }, 100);

      // 立即返回第一条消息
      return res.json(success({
        user_message: {
          id: userMessageId,
          role: 'user',
          content,
          content_type,
          created_at: new Date().toISOString(),
          precipitation_status: preliminaryTag ? preliminaryTag.status : 0,
          precipitation_type: preliminaryTag ? preliminaryTag.type : null
        },
        partner_message: {
          id: firstMessageId,
          role: 'partner',
          content: firstReply,
          content_type: 'text',
          created_at: new Date().toISOString(),
          precipitation_status: 0
        },
        helper_info: null,
        jump_page: jumpPage,
        async_helper: true // 标记异步 helper 已启动
      }));
    }

    // 执行工具调用（helper / 跳转）- 同步模式
    if (agentResult.toolCalls && agentResult.toolCalls.length > 0) {
      const toolResults = await mainAgent.executeToolCalls(
        agentResult.toolCalls,
        userId,
        content,
        user,
        partner
      );

      for (const result of toolResults) {
        if (result.name === 'call_allround_helper' && result.answer) {
          helperInfo = result.answer;
          // 把专业回答追加到搭子回复中
          finalReply = finalReply ? `${finalReply}\n\n${result.answer}` : result.answer;
        }
        if (result.name === 'jump_to_page') {
          jumpPage = result.page;
        }
      }
    }
    
    // 兜底：如果主Agent没有调用helper且用户问题明显是专业问题，强制调用
    if (!helperInfo && isProfessionalQuestion(content) && (!finalReply || finalReply === '嗯嗯，我在听～')) {
      try {
        const helperAnswer = await helperAgent.callHelperAgent(content, user, partner);
        if (helperAnswer) {
          helperInfo = helperAnswer;
          finalReply = helperAnswer;
        }
      } catch (e) {
        console.error('兜底helper调用失败:', e.message);
      }
    }

    // 保存搭子回复；若来自 helper 的专业回答，完整保存避免分片丢失
    let partnerMessageId = null;
    const partnerReplyText = finalReply || '嗯嗯，我在听～';
    if (helperInfo && partnerReplyText) {
      const insertHelperMsg = db.prepare(`
        INSERT INTO chat_messages (user_id, role, content, content_type, mode)
        VALUES (?, 'partner', ?, 'text', ?)
      `);
      partnerMessageId = insertHelperMsg.run(userId, partnerReplyText, partner.mode).lastInsertRowid;
      try {
        const recipes = await savePartnerRecipes(userId, partnerReplyText, partnerMessageId);
        if (recipes.length === 0 && isMethodContent(content)) {
          const method = await partnerAssetAgent.extractPartnerMethod(helperInfo);
          if (method) {
            savePartnerMethod(userId, method, partnerMessageId);
          }
        }
      } catch (e) {
        console.error('[Streaming] 食谱/方法提取失败:', e.message);
      }
    } else {
      const insertPartnerMsg = db.prepare(`
        INSERT INTO chat_messages (user_id, role, content, content_type, mode)
        VALUES (?, 'partner', ?, 'text', ?)
      `);
      partnerMessageId = insertPartnerMsg.run(userId, partnerReplyText, partner.mode).lastInsertRowid;
      const recipes = await savePartnerRecipes(userId, partnerReplyText, partnerMessageId);
      if (recipes.length === 0 && helperInfo && isMethodContent(content)) {
        try {
          const method = await partnerAssetAgent.extractPartnerMethod(helperInfo);
          if (method) {
            savePartnerMethod(userId, method, partnerMessageId);
          }
        } catch (e) {
          console.error('自动沉淀方法失败:', e.message);
        }
      }
    }

    // 检查聊天里程碑（异步，不阻塞返回）
    try {
      achievementService.checkChatCount(userId);
    } catch (e) {
      console.error('[聊天里程碑] 检查失败:', e.message);
    }

    return res.json(success({
      user_message: {
        id: userMessageId,
        role: 'user',
        content,
        content_type,
        created_at: new Date().toISOString(),
        precipitation_status: preliminaryTag ? preliminaryTag.status : 0,
        precipitation_type: preliminaryTag ? preliminaryTag.type : null
      },
      partner_message: {
        id: partnerMessageId,
        role: 'partner',
        content: finalReply || '嗯嗯，我在听～',
        content_type: 'text',
        created_at: new Date().toISOString(),
        precipitation_status: 0
      },
      helper_info: helperInfo,
      jump_page: jumpPage
    }));
  } catch (err) {
    console.error('发送消息失败:', err);
    // 用户消息已落库但 AI 异常，补一条兜底 partner 消息，避免「有问无答」
    try {
      if (userMessageId && partner) {
        const fallbackContent = '搭搭刚才有点走神，能再说一遍吗？😅';
        db.prepare(`
          INSERT INTO chat_messages (user_id, role, content, content_type, mode)
          VALUES (?, 'partner', ?, 'text', ?)
        `).run(userId, fallbackContent, partner.mode);
      }
    } catch (fallbackErr) {
      console.error('兜底消息写入失败:', fallbackErr.message);
    }
    return res.status(500).json(error('发送消息失败', 500));
  }
}

// ============================================================
// Section 5: Supporting route handlers
// 聊天记录查询、待确认资产查询/确认、管理员推荐消息下发等辅助路由
// ============================================================

/**
 * 获取聊天记录
 */
function getMessages(req, res) {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(parseInt(req.query.size) || 20, 100);
  const offset = (page - 1) * size;

  // 进入聊天页（第一页）时主动检查是否需要发送当前时段模板消息
  if (page === 1) {
    try {
      templateMessageService.checkAndSendTemplatesForUser(userId);
    } catch (err) {
      console.error('进入聊天页模板消息检查失败:', err);
    }
  }

  const list = db.prepare(`
    SELECT id, role, content, content_type, precipitation_status, precipitation_id, precipitation_type, mode, created_at
    FROM chat_messages
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, size, offset);

  // 对历史消息补打标签（不依赖 Agent，避免旧消息无标签）
  const updateTagStmt = db.prepare('UPDATE chat_messages SET precipitation_status = ?, precipitation_type = ? WHERE id = ?');
  for (const msg of list) {
    if (msg.role === 'user' && (!msg.precipitation_type || msg.precipitation_status === 0 || msg.precipitation_status === null)) {
      const matched = tagMatcher.matchMessageTags(msg.content);
      if (matched) {
        updateTagStmt.run(matched.status, matched.type, msg.id);
        msg.precipitation_status = matched.status;
        msg.precipitation_type = matched.type;
      }
    }
  }

  const total = db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ?').get(userId).count;

  return res.json(success({
    list: list.reverse(),
    pagination: {
      page,
      size,
      total,
      has_more: total > page * size
    }
  }));
}

/**
 * 批量查询聊天消息关联的待确认资产
 */
function getPendingAssets(req, res) {
  const userId = req.userId;
  const idsParam = req.query.message_ids || '';
  if (!idsParam) {
    return res.json(success({ list: [] }));
  }
  const messageIds = idsParam.split(',').map(id => parseInt(id, 10)).filter(Boolean);
  if (messageIds.length === 0) {
    return res.json(success({ list: [] }));
  }

  const placeholders = messageIds.map(() => '?').join(',');
  const items = db.prepare(`
    SELECT id, chat_message_id, type, sub_type, content, extracted_data, author, created_at
    FROM museum_items
    WHERE user_id = ? AND status = 0 AND chat_message_id IN (${placeholders})
    ORDER BY chat_message_id, created_at ASC
  `).all(userId, ...messageIds);

  const parsedItems = items.map(item => ({
    ...item,
    extracted_data: safeParseJson(item.extracted_data)
  }));

  return res.json(success({ list: parsedItems }));
}

function safeParseJson(str) {
  try {
    return JSON.parse(str || '{}');
  } catch (e) {
    return {};
  }
}

/**
 * 确认待确认沉淀
 */
function confirmPrecipitation(req, res) {
  const userId = req.userId;
  const { precipitation_id, confirmed, modified_data } = req.body;

  if (!precipitation_id) {
    return res.status(400).json(error('缺少沉淀 ID', 400));
  }
  if (typeof confirmed !== 'boolean') {
    return res.status(400).json(error('confirmed 必须是布尔值', 400));
  }
  if (modified_data !== undefined && modified_data !== null && typeof modified_data !== 'object') {
    return res.status(400).json(error('modified_data 格式不正确', 400));
  }

  const record = db.prepare('SELECT * FROM precipitation_records WHERE id = ? AND user_id = ?').get(precipitation_id, userId);
  if (!record) {
    return res.status(404).json(error('沉淀记录不存在', 404));
  }

  // 幂等：已确认/已忽略的沉淀不再重复处理
  if (record.status === 1) {
    return res.json(success(null, '记录已确认'));
  }
  if (record.status === 2 || record.status === 3) {
    return res.json(success(null, '记录已忽略'));
  }

  if (confirmed) {
    const result = withTransaction(() => {
      // 更新沉淀记录为已确认
      db.prepare('UPDATE precipitation_records SET status = 1, extracted_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(modified_data ? JSON.stringify(modified_data) : record.extracted_data, precipitation_id);

      const extractedData = modified_data || safeJsonParse(record.extracted_data, {});
      // 判断是否为用户编辑场景（modified_data 存在表示用户修改了数据）
      const isUserEdit = modified_data !== undefined && modified_data !== null;

      // 食谱需要像饮食/运动一样，在确认时才同步到 museum_items；
      // 其他个人资产类（方法/感悟/踩坑/金句）已经在沉淀时以 pending 状态写入 museum_items，避免重复入库。
      if (record.type === 'recipe') {
        precipitationAgent.syncToBusinessTable(userId, 'recipe', record.content, extractedData, null, record.sub_type, precipitation_id, record.chat_id, isUserEdit);
      } else if (!['method', 'insight', 'pitfall'].includes(record.type)) {
        // 同步到业务表
        precipitationAgent.syncToBusinessTable(userId, record.type, record.content, extractedData, null, record.sub_type, precipitation_id, record.chat_id, isUserEdit);
      }

      // 更新聊天消息状态：同一消息可能沉淀多条记录（如一条回复含多个食谱），
      // 全部处理完才翻转消息为「已记录」，否则保持「待确认」
      if (record.chat_id) {
        const remaining = db.prepare('SELECT COUNT(*) as c FROM precipitation_records WHERE chat_id = ? AND status = 0').get(record.chat_id).c;
        if (remaining === 0) {
          db.prepare('UPDATE chat_messages SET precipitation_status = 1, precipitation_type = ? WHERE id = ?').run(record.type, record.chat_id);
        }
      }

      // 发放浆果奖励 + 任务进度 + 里程碑检查 + 小确幸事件
      const rewardResult = rewardService.rewardForPrecipitationRecord(userId, record.type, record.sub_type, extractedData, record.id);
      const rewardMessages = rewardResult?.reward_messages || [];

      return { reward_messages: rewardMessages };
    });

    return res.json(success(result, '已确认记录'));
  } else {
    // 拒绝沉淀
    db.prepare('UPDATE precipitation_records SET status = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(precipitation_id);
    if (record.chat_id) {
      // 同一消息的全部待确认记录都处理完才翻转消息状态：有已确认的记为「已记录」，否则「已忽略」
      const remaining = db.prepare('SELECT COUNT(*) as c FROM precipitation_records WHERE chat_id = ? AND status = 0').get(record.chat_id).c;
      if (remaining === 0) {
        const anyConfirmed = db.prepare('SELECT COUNT(*) as c FROM precipitation_records WHERE chat_id = ? AND status = 1').get(record.chat_id).c;
        db.prepare('UPDATE chat_messages SET precipitation_status = ?, precipitation_type = ? WHERE id = ?')
          .run(anyConfirmed > 0 ? 1 : 3, record.type, record.chat_id);
      }
    }
    return res.json(success(null, '已忽略记录'));
  }
}

/**
 * 判断用户问题是否为专业问题（需要调用helperAgent）
 * 兜底机制：当主Agent没有正确调用工具时，后端强制判断
 */
function isProfessionalQuestion(content) {
  const professionalKeywords = [
    '热量', '代谢', 'BMI', '基础代谢', '热量缺口', '碳蛋脂', '营养', '食谱',
    '运动', '为什么不掉秤', '平台期', '怎么瘦', '吃什么', '推荐', '建议',
    '适合', '方法', '技巧', '如何', '怎样', '做什么', '可以', '偷偷',
    '减肥', '减脂', '增肌', '塑形', '卡路里', '蛋白质', '脂肪', '碳水',
    '饮食', '健身', '训练', '有氧', '无氧', '拉伸', '瑜伽', '跑步',
    '游泳', '跳绳', 'HIIT', 'Tabata', '深蹲', '平板支撑', '俯卧撑',
    '健康', '体重', '体脂', '围度', '腰围', '腿围', '臀围', '胸围',
    '早餐', '午餐', '晚餐', '零食', '加餐', '水果', '蔬菜', '肉类',
    '鸡蛋', '牛奶', '豆浆', '咖啡', '茶', '水', '喝水', '饮水',
    '饿', '饱', '馋', '暴食', '节食', '断食', '轻断食', '168',
    '睡眠', '熬夜', '压力', '激素', '内分泌', '便秘', '水肿',
    '代餐', '蛋白粉', '补剂', '维生素', '矿物质', '膳食纤维',
    '升糖', '血糖', '胰岛素', '低碳', '生酮', '地中海', '轻食',
    '外卖', '食堂', '聚餐', '应酬', '喝酒', '奶茶', '饮料',
    '零食', '甜品', '蛋糕', '巧克力', '冰淇淋', '薯片', '坚果'
  ];
  
  const contentLower = content.toLowerCase();
  return professionalKeywords.some(keyword => contentLower.includes(keyword));
}

/**
 * 判断用户问题是否包含可沉淀为方法的内容
 * 运动建议、饮食建议、减脂技巧等
 */
function isMethodContent(content) {
  const methodKeywords = [
    '运动', '健身', '训练', '有氧', '无氧', '拉伸', '瑜伽', '跑步',
    '游泳', '跳绳', 'HIIT', 'Tabata', '深蹲', '平板支撑', '俯卧撑',
    '食谱', '饮食', '早餐', '午餐', '晚餐', '加餐', '怎么吃',
    '减脂', '减肥', '方法', '技巧', '建议', '推荐'
  ];
  const contentLower = content.toLowerCase();
  return methodKeywords.some(keyword => contentLower.includes(keyword));
}

/**
 * 获取用户聊天统计（用于冷启动检测）
 */
function getChatStats(req, res) {
  const userId = req.userId;
  const stats = templateMessageService.getUserChatStats(userId);
  return res.json(success(stats));
}

/**
 * 发送冷启动唤醒消息
 */
function sendWakeupMessage(req, res) {
  const userId = req.userId;
  const result = templateMessageService.sendWakeupMessage(userId);
  
  if (!result) {
    return res.json(success(null, '无需唤醒'));
  }
  
  return res.json(success({
    message: {
      id: result.messageId,
      role: 'partner',
      content: result.content,
      content_type: 'text',
      created_at: new Date().toISOString(),
      is_template: true,
      template_type: result.type
    }
  }));
}

/**
 * 恢复减重建议待生成标记（AI 生成失败时兜底，下次进入聊聊页自动重试）
 */
function restoreAdvicePending(userId) {
  try {
    db.prepare('UPDATE user_profiles SET advice_pending = 1 WHERE user_id = ?').run(userId);
  } catch (e) {
    console.error('恢复减重建议标记失败:', e.message);
  }
}

/**
 * 后台异步生成减重建议并落库
 * AI（Hy3 think_high）实测耗时 19~74s+，同步等待会把 HTTP 请求挂到前端 60s 超时，
 * 表现为「修改目标后过一会儿报 500」，故改为后台执行：
 * 成功 → 消息直接入库，前端靠增量同步/轮询补显；
 * 失败（异常或两次空内容）→ 恢复 advice_pending 标记，下次进入聊聊页自动重试。
 */
async function generateAdviceAsync(userId, userInfoStr, mode) {
  // AI 生成（失败自动重试 1 次：AI 服务偶发超时/空响应）
  // max_tokens=10000：Hy3 think 模式下 reasoning_tokens 计入 completion_tokens，
  // 实测 4000 全被思考耗尽（finish=length, contentLen=0）导致建议永远生成失败
  const generateContent = async () => {
    const systemPrompt = promptService.getPrompt('weight_loss_advice', { user_info: userInfoStr });
    const opts = { temperature: 0.7, max_tokens: 10000, timeout: 180000 };
    const response = await callWithPrompt('weight_loss_advice', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请根据我的身体数据，严格按照【输出结构】给出完整的减重方案。' }
    ], opts);
    return (response.choices?.[0]?.message?.content || '').trim();
  };

  try {
    let content = await generateContent();
    if (!content) {
      console.warn('[sendAdviceMessage] AI 返回空内容，自动重试 1 次');
      content = await generateContent();
    }
    if (!content) {
      restoreAdvicePending(userId);
      console.error('[sendAdviceMessage] AI 两次返回空内容，已恢复标记待下次重试');
      return;
    }
    db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, content_type, mode)
      VALUES (?, 'partner', ?, 'text', ?)
    `).run(userId, content, mode);
    console.log('[sendAdviceMessage] 减重建议已生成并入库');
  } catch (err) {
    restoreAdvicePending(userId);
    console.error('[sendAdviceMessage] 生成失败已恢复标记:', err.message);
  }
}

/**
 * 生成减重建议消息
 * 触发场景：新用户首次填写完身体信息、或更新身体信息（初始/目标体重）后进入聊聊页
 * 通过 user_profiles.advice_pending 标记保证幂等，仅在有标记时生成一次；
 * 接口只负责校验并领取任务，AI 生成在后台异步执行，立即返回 pending:true
 */
async function sendAdviceMessage(req, res) {
  const userId = req.userId;

  // 原子清除标记，避免并发/重复进入页面时重复生成
  const claimed = db.prepare(`
    UPDATE user_profiles SET advice_pending = 0 WHERE user_id = ? AND advice_pending = 1
  `).run(userId);
  if (claimed.changes === 0) {
    return res.json(success(null, '无需生成'));
  }

  try {
    const user = db.prepare('SELECT gender, age, height FROM users WHERE id = ?').get(userId);
    const profile = db.prepare(`
      SELECT initial_weight, current_weight, target_weight, target_date FROM user_profiles WHERE user_id = ?
    `).get(userId);

    const complete = user && profile
      && (user.gender === 1 || user.gender === 2) && user.age && user.height
      && profile.current_weight && profile.target_weight;
    if (!complete) {
      return res.json(success(null, '身体信息不完整，暂不生成'));
    }

    const userInfoStr = [
      `性别：${user.gender === 1 ? '男' : '女'}`,
      `年龄：${user.age}岁`,
      `身高：${user.height}cm`,
      `当前体重：${profile.current_weight}kg`,
      profile.initial_weight ? `初始体重：${profile.initial_weight}kg` : null,
      `目标体重：${profile.target_weight}kg`,
      profile.target_date ? `目标日期：${profile.target_date}` : null
    ].filter(Boolean).join('；');

    const partner = db.prepare('SELECT mode FROM partners WHERE user_id = ?').get(userId);

    // 后台异步生成，接口立即返回，避免 HTTP 长挂导致前端超时报错
    generateAdviceAsync(userId, userInfoStr, partner?.mode || 'gentle');

    return res.json(success({ pending: true }));
  } catch (err) {
    // 校验阶段异常恢复标记，下次进入聊聊页可重试
    restoreAdvicePending(userId);
    console.error('生成减重建议失败:', err.message);
    return res.status(500).json(error('生成减重建议失败', 500));
  }
}

// ============================================================
// Section 6: Exports
// ============================================================

module.exports = {
  sendMessage,
  getMessages,
  getPendingAssets,
  confirmPrecipitation,
  getChatStats,
  sendWakeupMessage,
  sendAdviceMessage
};
