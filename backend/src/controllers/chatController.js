/**
 * 聊天控制器
 * 核心：接收用户消息，调用主协调 Agent，异步沉淀信息
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const mainAgent = require('../services/agents/mainAgent');
const precipitationAgent = require('../services/agents/precipitationAgent');
const helperAgent = require('../services/agents/helperAgent');
const partnerAssetAgent = require('../services/agents/partnerAssetAgent');
const templateMessageService = require('../services/templateMessageService');
const chatState = require('../services/chatState');
const tagMatcher = require('../services/tagMatcher');

/**
 * 将搭子回复中的食谱自动保存到食谱库
 */
async function savePartnerRecipes(userId, content) {
  try {
    const recipes = await partnerAssetAgent.extractPartnerRecipes(content);
    if (!recipes || recipes.length === 0) return [];

    const insert = db.prepare(`
      INSERT INTO museum_items (user_id, type, sub_type, content, extracted_data, author, status)
      VALUES (?, 'recipe', ?, ?, ?, 'partner', 1)
    `);
    const titleMap = { recipe: '食谱' };
    const today = new Date().toISOString().split('T')[0];

    for (const recipe of recipes) {
      const subType = recipe.title || '搭子推荐食谱';
      const contentText = recipe.content || subType;
      const extractedData = {
        title: subType,
        content: contentText,
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || '',
        tip: recipe.tip || ''
      };
      const museumId = insert.run(
        userId,
        subType,
        contentText,
        JSON.stringify(extractedData)
      ).lastInsertRowid;

      // 写入时间轴
      db.prepare(`
        INSERT INTO timelines (user_id, event_type, title, content, related_id, related_type, event_date)
        VALUES (?, 'recipe', ?, ?, ?, 'museum_items', ?)
      `).run(userId, titleMap.recipe, contentText, museumId, today);

      console.log('[搭子食谱] 已保存到食谱库:', subType);
    }

    return recipes;
  } catch (err) {
    console.error('[搭子食谱] 保存失败:', err.message);
    return [];
  }
}

/**
 * 将 helper/搭子长回复拆分成多条逐步发送的片段
 * - 有编号列表时按编号拆分（保留编号项的完整内容）
 * - 无编号时按段落/句子拆分
 */
function splitReplyIntoChunks(reply) {
  const text = (reply || '').trim();
  if (!text) return [];

  // 1. 按编号切分，保留每个编号及其后续正文（直到下一个编号或结尾）
  const numberedParts = text
    .split(/(?:^|\n)(?=\d+\.\s+)/)
    .map(p => p.trim())
    .filter(Boolean);
  if (numberedParts.length >= 2 && /^\d+\.\s+/.test(numberedParts[0])) {
    return numberedParts;
  }
  if (numberedParts.length >= 2 && /^\d+\.\s+/.test(numberedParts[1])) {
    return numberedParts;
  }

  // 2. 按段落拆分
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
  if (paragraphs.length >= 2) {
    return paragraphs.map(p => p.trim());
  }

  // 3. 单段长文本按句子拆分
  const sentences = text.split(/([。！？\n]+)/).filter(s => s.trim().length > 0);
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    current += s;
    if (current.length >= 80) {
      chunks.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

/**
 * 将回复片段逐条保存为搭子消息，模拟一边生成一边发送
 * 第一段立即保存，后续片段按 delay 间隔依次保存
 */
function saveStreamingPartnerMessages(userId, partnerMode, chunks, onDone, options = {}) {
  const delay = options.delay || 600;
  if (!chunks || chunks.length === 0) {
    if (onDone) onDone();
    return null;
  }

  const insert = db.prepare(`
    INSERT INTO chat_messages (user_id, role, content, content_type, mode)
    VALUES (?, 'partner', ?, 'text', ?)
  `);

  const firstId = insert.run(userId, chunks[0], partnerMode).lastInsertRowid;
  console.log('[Streaming] 保存 helper 第 1 段');

  if (chunks.length === 1) {
    if (onDone) onDone();
    return firstId;
  }

  for (let i = 1; i < chunks.length; i++) {
    setTimeout(() => {
      try {
        insert.run(userId, chunks[i], partnerMode);
        console.log(`[Streaming] 保存 helper 第 ${i + 1}/${chunks.length} 段`);
      } catch (e) {
        console.error('[Streaming] 保存片段失败:', e.message);
      }
      if (i === chunks.length - 1 && onDone) {
        onDone();
      }
    }, i * delay);
  }

  return firstId;
}

/**
 * 发送消息
 */
async function sendMessage(req, res) {
  const userId = req.userId;
  const { content, content_type = 'text', record_date } = req.body;
  const today = record_date || new Date().toISOString().split('T')[0];

  if (!content || !content.trim()) {
    return res.status(400).json(error('消息内容不能为空', 400));
  }

  try {
    // 获取用户信息和搭子信息
    const user = db.prepare(`
      SELECT u.*, p.current_weight, p.target_weight, p.dietary_taboos, p.preferences
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(userId);

    let partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);
    
    // 如果没有搭子，自动创建一个默认搭子
    if (!partner) {
      const insertPartner = db.prepare(`
        INSERT INTO partners (user_id, name, mode, avatar_url)
        VALUES (?, '你的搭子', 'gentle', '/static/partner-avatar.png')
      `);
      insertPartner.run(userId);
      partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);
    }

    // 保存用户消息
    const insertUserMsg = db.prepare(`
      INSERT INTO chat_messages (user_id, role, content, content_type, mode)
      VALUES (?, 'user', ?, ?, ?)
    `);
    const userMessageId = insertUserMsg.run(userId, content, content_type, partner.mode).lastInsertRowid;

    // 同步标签匹配：不依赖 Agent，直接根据食物库/运动库/方法库等列表给消息打标签
    const preliminaryTag = tagMatcher.matchMessageTags(content);
    if (preliminaryTag) {
      db.prepare('UPDATE chat_messages SET precipitation_status = ?, precipitation_type = ? WHERE id = ?')
        .run(preliminaryTag.status, preliminaryTag.type, userMessageId);
      console.log('[TagMatcher] 消息已打标签:', userMessageId, preliminaryTag.type, preliminaryTag.status);
    }

    // 更新用户聊天统计（模板消息系统）
    templateMessageService.onUserMessage(userId);

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
    const hasFood = /吃|喝|食物|早餐|午餐|晚餐|加餐|零食|饭|菜|肉|水果|鸡蛋|香蕉|酸奶|面包|米饭|面条|燕麦|牛奶|豆浆|咖啡|坚果|蔬菜|主食|玉米|红薯|紫薯|土豆|西红柿|黄瓜|苹果|橙子|葡萄|西瓜|草莓|蓝莓|猕猴桃|牛油果|奶酪|芝士|肉包|水饺|馄饨|肠粉|粥|粉|面|饵块|年糕|汤圆|粽子|青团|月饼|蛋黄酥|绿豆糕|红豆糕|桂花糕|发糕|米糕|年糕|糍粑|锅盔|馕|大饼|油条|豆浆|豆腐脑|豆花|豆腐|豆干|豆皮|腐竹|千张|素鸡|面筋|烤麸|年糕|汤圆|元宵|粽子|青团|月饼|蛋黄酥|绿豆糕|红豆糕|桂花糕|发糕|米糕|年糕|糍粑|窝头|馒头|花卷|包子|饺子|馄饨|抄手|云吞|锅贴|生煎|小笼包|灌汤包|肉夹馍|煎饼果子|鸡蛋灌饼|手抓饼|葱油饼|韭菜盒子|馅饼|烧饼|烙饼|春饼|荷叶饼|口袋饼|锅盔|馕|大饼|油条|油饼|麻球|糖糕|粢饭糕|糍饭团|饭团|寿司|便当|盒饭|盖浇饭|盖饭|木桶饭|竹筒饭|荷叶饭|煲仔饭|卤肉饭|猪脚饭|鸡腿饭|牛腩饭|排骨饭|鳗鱼饭|石锅拌饭|扬州炒饭|蛋炒饭|酱油炒饭|海鲜炒饭|牛肉炒饭|鸡肉炒饭|腊肠炒饭|泡菜炒饭|咖喱饭|焗饭|烩饭|焖饭|蒸饭|捞饭|汤饭|泡饭|稀饭|粥|白粥|小米粥|南瓜粥|皮蛋瘦肉粥|艇仔粥|及第粥|海鲜粥|猪肝粥|鱼片粥|蔬菜粥|杂粮粥|八宝粥|银耳羹|燕窝羹|桃胶|皂角米|雪燕|汤圆|元宵|粽子|青团|月饼|蛋黄酥|绿豆糕|红豆糕|桂花糕|发糕|米糕|年糕|糍粑|马蹄糕|椰汁糕|布丁|奶冻|慕斯|提拉米苏|芝士蛋糕|奶油蛋糕|水果蛋糕|巧克力蛋糕|千层蛋糕|磅蛋糕|海绵蛋糕|戚风蛋糕|马芬|纸杯蛋糕|甜甜圈|曲奇|饼干|威化|蛋卷|蛋挞|泡芙|马卡龙|牛轧糖|雪花酥|沙琪玛|麻花|馓子|江米条|萨其马|糕点|甜点|甜品|糖水|甜汤|奶茶|奶盖|烧仙草|芋圆|西米|红豆|绿豆|薏仁|紫米|黑米|糯米|麻糬|芋泥|地瓜泥|南瓜泥|紫薯泥|山药泥|土豆泥|果酱|果冻|冰淇淋|雪糕|冰棍|冰棒|圣代|奶昔|思慕雪|果汁|汽水|可乐|雪碧|苏打水|气泡水|矿泉水|纯净水|饮用水|白开水|茶|咖啡/i.test(content);
    const hasExercise = /运动|训练|健身|哑铃|杠铃|跑步|游泳|跳绳|骑车|骑行|瑜伽|帕梅拉|周六野|刘畊宏|肩背|胸|腿|臀|腹|有氧|无氧|HIIT|Tabata|拉伸|深蹲|俯卧撑|平板支撑|卷腹|开合跳|波比跳|快走|慢跑|爬楼|爬山|登山|游泳|骑车|骑行|动感单车|椭圆机|划船机|壶铃|TRX|战绳|拳击|打拳|搏击|尊巴|舞蹈|跳操|健身操|有氧操|力量训练|体能训练|功能性训练|核心训练|臀腿训练|背部训练|肩部训练|手臂训练|胸部训练|腹部训练|拉伸训练|热身|冷身|放松|按摩|泡沫轴|筋膜枪|运动康复|体能测试|体测|马拉松|半程马拉松|越野跑|接力跑|冲刺跑|折返跑|高抬腿|登山跑|俄罗斯转体|臀桥|桥式|死虫式|鸟狗式|侧平板|倒立|手倒立|单腿硬拉|箭步蹲|保加利亚蹲|靠墙静蹲|马步|引体向上|引体向上机|仰卧起坐|卷腹|俄罗斯转体|弹力带|阻力带|拉力带|乳胶带|8字拉力器|开肩美背|哑铃弯举|哑铃推举|哑铃飞鸟|哑铃划船|哑铃深蹲|哑铃硬拉|哑铃侧平举|哑铃前平举|杠铃深蹲|杠铃硬拉|杠铃卧推|杠铃划船|杠铃推举|杠铃弯举|杠铃臀推|相扑硬拉|罗马尼亚硬拉|器械训练|器械推胸|器械划船|器械夹胸|腿举|腿弯举|腿屈伸|坐姿划船|高位下拉|史密斯机|龙门架|蝴蝶机|推胸机|壶铃摇摆|壶铃抓举|壶铃深蹲|壶铃推举|土耳其起立|TRX划船|TRX深蹲|TRX俯卧撑|悬挂训练|甩绳|战绳|药球|药球抛|沙袋|轮胎翻|农夫行走|雪橇推|攀岩|攀冰|溯溪|漂流|滑雪|滑冰|轮滑|滑板|羽毛球|乒乓球|网球|排球|篮球|足球|棒球|垒球|高尔夫球|保龄球|台球|门球|壁球|橄榄球|曲棍球|冰球|手球|水球|马球|藤球|毽球|蹴鞠|射箭|射击|击剑|马术|赛马|赛艇|皮划艇|帆船|帆板|冲浪|潜水|浮潜|深潜|游泳|跳水|水球|花样游泳|体操|艺术体操|蹦床|技巧|健美操|啦啦操|体育舞蹈|街舞|霹雳舞|爵士舞|芭蕾舞|现代舞|民族舞|古典舞|拉丁舞|国标舞|交谊舞|摇摆舞|广场舞|健身舞|燃脂舞|减脂舞|太极|气功|瑜伽|普拉提|冥想|正念|呼吸训练|产后恢复|盆底肌训练|凯格尔运动|腹直肌修复|办公室运动|椅子瑜伽|坐姿运动|床上运动|睡前拉伸|晨间唤醒|午休运动|碎片化运动|微运动|办公室微运动/i.test(content);
    const needsHelper = (agentResult.toolCalls && agentResult.toolCalls.some(t => 
      t.name === 'call_allround_helper' || 
      (t.parameters && (t.parameters.question || t.parameters.query))
    )) || (isProfessionalQuestion(content) && !finalReply.includes('千卡') && !finalReply.includes('kcal') && !finalReply.includes('BMI')) || (hasFood && hasExercise && !finalReply.includes('千卡') && !finalReply.includes('kcal')) || (preliminaryTag && preliminaryTag.type === 'body_data' && !finalReply.includes('千卡') && !finalReply.includes('kcal') && !finalReply.includes('BMI'));

    // ========== 异步调用信息沉淀 Agent（聊天即记录，不阻塞回复） ==========
    // 无论同步还是异步模式，都触发沉淀；保留 Promise 供异步 helper 等待
    const precipitationPromise = precipitationAgent.callPrecipitationAgent(content, userId, userMessageId, today)
      .then(result => {
        console.log('沉淀结果:', JSON.stringify(result));
        if (result && result.precipitation_id) {
          const status = result.status === 1 ? 1 : 2;
          try {
            db.prepare('UPDATE chat_messages SET precipitation_status = ?, precipitation_id = ?, precipitation_type = ? WHERE id = ?')
              .run(status, result.precipitation_id, result.type || null, userMessageId);
            console.log('沉淀状态已更新:', userMessageId, status, result.precipitation_id, result.type);
          } catch (dbErr) {
            console.error('沉淀状态更新失败:', dbErr.message);
          }
        } else {
          // 沉淀 Agent 未提取到有效内容时，把同步标签产生的「待确认」状态清空，避免误标
          if (result && result.extracted === false) {
            try {
              const cleared = db.prepare('UPDATE chat_messages SET precipitation_status = 0 WHERE id = ? AND precipitation_status = 2')
                .run(userMessageId);
              console.log('沉淀未提取，清空待确认状态:', userMessageId, cleared.changes);
            } catch (dbErr) {
              console.error('清空待确认状态失败:', dbErr.message);
            }
          } else {
            console.log('沉淀未提取，不更新状态');
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
          if (helperAnswer && helperAnswer !== '这个问题有点复杂，我慢慢算一下，你先忙别的～') {
            const chunks = splitReplyIntoChunks(helperAnswer);

            // 逐步输出 helper 内容，最后执行食谱/方法提取
            saveStreamingPartnerMessages(userId, partner.mode, chunks, async () => {
              try {
                // 自动提取 helper 回答中的食谱
                const recipes = await savePartnerRecipes(userId, helperAnswer);

                // 自动沉淀到方法库（仅当回复中确实包含可执行方法，且不是食谱时）
                if (recipes.length === 0 && isMethodContent(content)) {
                  const method = await partnerAssetAgent.extractPartnerMethod(helperAnswer);
                  if (method) {
                    db.prepare(`
                      INSERT INTO museum_items (user_id, type, sub_type, content, extracted_data, author, effectiveness, status)
                      VALUES (?, 'method', ?, ?, ?, 'partner', 1, 1)
                    `).run(
                      userId,
                      method.title,
                      method.content,
                      JSON.stringify({ title: method.title, content: method.content })
                    );
                    console.log('[搭子方法] 已保存到方法库:', method.title);
                  }
                }
              } catch (e) {
                console.error('[AsyncHelper] 食谱/方法提取失败:', e.message);
              } finally {
                chatState.setHelperPending(userId, false);
              }
            });
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

    // 保存搭子回复；若来自 helper 的专业回答，按片段逐步输出
    let partnerMessageId = null;
    const partnerReplyText = finalReply || '嗯嗯，我在听～';
    if (helperInfo && partnerReplyText) {
      const chunks = splitReplyIntoChunks(partnerReplyText);
      partnerMessageId = saveStreamingPartnerMessages(userId, partner.mode, chunks, async () => {
        try {
          const recipes = await savePartnerRecipes(userId, partnerReplyText);
          if (recipes.length === 0 && isMethodContent(content)) {
            const method = await partnerAssetAgent.extractPartnerMethod(helperInfo);
            if (method) {
              db.prepare(`
                INSERT INTO museum_items (user_id, type, sub_type, content, extracted_data, author, effectiveness, status)
                VALUES (?, 'method', ?, ?, ?, 'partner', 1, 1)
              `).run(
                userId,
                method.title,
                method.content,
                JSON.stringify({ title: method.title, content: method.content })
              );
              console.log('[搭子方法] 已保存到方法库:', method.title);
            }
          }
        } catch (e) {
          console.error('[Streaming] 食谱/方法提取失败:', e.message);
        }
      });
    } else {
      const insertPartnerMsg = db.prepare(`
        INSERT INTO chat_messages (user_id, role, content, content_type, mode)
        VALUES (?, 'partner', ?, 'text', ?)
      `);
      partnerMessageId = insertPartnerMsg.run(userId, partnerReplyText, partner.mode).lastInsertRowid;
      const recipes = await savePartnerRecipes(userId, partnerReplyText);
      if (recipes.length === 0 && helperInfo && isMethodContent(content)) {
        try {
          const method = await partnerAssetAgent.extractPartnerMethod(helperInfo);
          if (method) {
            db.prepare(`
              INSERT INTO museum_items (user_id, type, sub_type, content, extracted_data, author, effectiveness, status)
              VALUES (?, 'method', ?, ?, ?, 'partner', 1, 1)
            `).run(
              userId,
              method.title,
              method.content,
              JSON.stringify({ title: method.title, content: method.content })
            );
            console.log('[搭子方法] 已保存到方法库:', method.title);
          }
        } catch (e) {
          console.error('自动沉淀方法失败:', e.message);
        }
      }
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
    return res.status(500).json(error('发送消息失败', 500));
  }
}

/**
 * 获取聊天记录
 */
function getMessages(req, res) {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;
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
 * 确认待确认沉淀
 */
function confirmPrecipitation(req, res) {
  const userId = req.userId;
  const { precipitation_id, confirmed, modified_data } = req.body;

  if (!precipitation_id) {
    return res.status(400).json(error('缺少沉淀 ID', 400));
  }

  const record = db.prepare('SELECT * FROM precipitation_records WHERE id = ? AND user_id = ?').get(precipitation_id, userId);
  if (!record) {
    return res.status(404).json(error('沉淀记录不存在', 404));
  }

  if (confirmed) {
    // 更新沉淀记录为已确认
    db.prepare('UPDATE precipitation_records SET status = 1, extracted_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(modified_data ? JSON.stringify(modified_data) : record.extracted_data, precipitation_id);

    // 同步到业务表
    const extractedData = modified_data || JSON.parse(record.extracted_data || '{}');
    precipitationAgent.syncToBusinessTable(userId, record.type, record.content, extractedData, null, record.sub_type, precipitation_id);

    // 更新聊天消息状态
    if (record.chat_id) {
      db.prepare('UPDATE chat_messages SET precipitation_status = 1, precipitation_type = ? WHERE id = ?').run(record.type, record.chat_id);
    }

    return res.json(success(null, '已确认记录'));
  } else {
    // 拒绝沉淀
    db.prepare('UPDATE precipitation_records SET status = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(precipitation_id);
    if (record.chat_id) {
      db.prepare('UPDATE chat_messages SET precipitation_status = 3, precipitation_type = ? WHERE id = ?').run(record.type, record.chat_id);
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

module.exports = {
  sendMessage,
  getMessages,
  confirmPrecipitation,
  getChatStats,
  sendWakeupMessage
};
