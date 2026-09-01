/**
 * 主协调 Agent（大脑 + 感性层）
 * 职责：对话上下文维护、意图识别、共情话术生成、最终回复、工具调用调度
 * 模型：腾讯混元 Hy3（备用：fit-Backup）
 */
const { callWithPrompt } = require('../aiClient');
const promptService = require('../promptService');
const petService = require('../petService');

const helperAgent = require('./helperAgent');

/**
 * 调用主协调 Agent
 * @param {string} userMessage 用户消息
 * @param {Array} history 历史消息
 * @param {object} userInfo 用户信息
 * @param {object} partnerInfo 搭子信息
 * @returns {object} { reply, toolCalls }
 */
async function callMainAgent(userMessage, history = [], userInfo = {}, partnerInfo = {}) {
  const mode = partnerInfo.mode || 'gentle';
  const modeMap = {
    gentle: '温柔鼓励型',
    strict: '严格监督型',
    tease: '毒舌模式'
  };

  const userInfoStr = JSON.stringify({
    nickname: userInfo.nickname || '用户',
    gender: userInfo.gender || '未知',
    age: userInfo.age || '未知',
    height: userInfo.height || '未知',
    current_weight: userInfo.current_weight || '未知',
    target_weight: userInfo.target_weight || '未知',
    dietary_taboos: userInfo.dietary_taboos || '无',
    preferences: userInfo.preferences || '无'
  }, null, 2);

  const pet = userInfo.id ? petService.getPet(userInfo.id) : null;
  const petPersona = pet
    ? `你同时以宠物形象出现在用户的小窝里，宠物名叫${pet.name || '搭搭'}，是一只${pet.species === 'red_panda' ? '小熊猫' : (pet.species || '小熊猫')}。你和小窝里的宠物是同一只搭搭，回复中始终以"我"自称，不要把它说成另一个角色。`
    : '你同时以宠物形象出现在用户的小窝里，是一只陪伴用户减肥的小熊猫。你和小窝里的宠物是同一只搭搭，回复中始终以"我"自称，不要把它说成另一个角色。';

  const systemPrompt = promptService.getPrompt('main_agent', {
    user_info: userInfoStr,
    partner_mode: modeMap[mode] || '温柔鼓励型',
    pet_persona: petPersona
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(msg => ({
      role: msg.role === 'partner' ? 'assistant' : 'user',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await Promise.race([
      callWithPrompt(
        'main_agent',
        messages,
        { temperature: 0.7, max_tokens: 1000 }
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('主协调 Agent 调用超时')), 55000)
      )
    ]);

    let content = stripThinkingTags(response.choices[0].message.content || '');

    // 混元 Hy3 偶发在 high 下只输出 reasoning_content、content 为空。
    // 此时尝试从 reasoning_content 提取最终结论作为回复，避免业务层落入固定兜底。
    if (!content.trim() && response.choices[0].message.reasoning_content) {
      const recentHistoryMessages = history
        .filter(msg => msg.role === 'user' || msg.role === 'partner' || msg.role === 'assistant')
        .slice(-6)
        .map(msg => msg.content);
      const extracted = extractReplyFromReasoning(response.choices[0].message.reasoning_content, [
        userMessage,
        ...recentHistoryMessages
      ]);
      if (extracted) {
        console.log('[callMainAgent] 从 reasoning_content 提取到回复');
        content = extracted;
      }
    }

    // 去掉模型偶尔把上一轮自己的回复粘到当前回复开头的情况
    content = stripLeadingHistoryEcho(content, history);

    // 如果模型还是没给出可用回复，使用基于语境的兜底回复（避免一直重复固定句子）
    if (!content.trim()) {
      content = generateContextualFallbackReply(userMessage, history, mode, userInfo.id);
      console.log('[callMainAgent] 使用语境化兜底回复:', content);
    }

    // 检查是否有工具调用标记
    const hasToolCall = content.includes('<<<FunctionCall>>>') || content.includes('<|FunctionCallBegin|>');
    console.log('[callMainAgent] hasToolCall:', hasToolCall, 'content length:', content.length);
    if (hasToolCall) {
      console.log('[callMainAgent] 发现工具调用标记，开始解析...');
    }
    
    // 解析工具调用
    const toolCalls = parseToolCalls(content);
    let reply = cleanToolCallMarkers(content).trim();

    console.log('[callMainAgent] toolCalls count:', toolCalls.length, 'reply length:', reply.length);
    if (toolCalls.length > 0) {
      console.log('[callMainAgent] 解析到工具调用:', JSON.stringify(toolCalls));
    }

    // 过滤模型偶发的无意义反问（如“还是闲聊？”、“什么意思？”）
    if (toolCalls.length === 0 && isUnhelpfulReply(reply, userMessage)) {
      console.log('[callMainAgent] 主Agent返回无意义反问，使用语境化兜底:', reply);
      reply = generateContextualFallbackReply(userMessage, history, mode, userInfo.id);
    }

    // 强制兜底：如果模型明确要给方案/计算/推荐/适配但没有调用工具，才强制添加工具调用
    // 避免"我怎么这么胖""你怎么不回我"这类口语化表达误触发 Helper
    const forcedHelperPattern = /(方案|计划|安排|帮你算|帮你算算|帮你计算|帮你配|给你算|给你算算|给你整|帮你整|帮你安排|适配|推荐.*食谱|热量多少|消耗多少|BMI|基础代谢|平台期|怎么瘦|怎么减|怎么吃|如何瘦|如何减|吃什么好|适合.*运动|建议.*吃|建议.*练|该吃.*该练)/;
    if (toolCalls.length === 0 && forcedHelperPattern.test(reply) && !hasToolCall) {
      console.log('主Agent未调用工具但明确要给出方案/计算/推荐，强制添加工具调用');
      const forcedCall = {
        name: 'call_allround_helper',
        parameters: { question: userMessage }
      };
      return { reply, toolCalls: [forcedCall], raw: content };
    }

    return { reply, toolCalls, raw: content };
  } catch (error) {
    console.error('主协调 Agent 调用失败:', error.message);
    return {
      reply: '',
      toolCalls: [],
      raw: ''
    };
  }
}

/**
 * 解析工具调用
 * 支持两种格式：<<<FunctionCall>>> 和 <|FunctionCallBegin|>
 */
function parseToolCalls(content) {
  const calls = [];
  
  // 格式1：<<<FunctionCall>>>...<<<FunctionCallEnd>>>（支持2-4个>）
  const regex1 = /<<<FunctionCall>>>([\s\S]*?)<<<FunctionCallEnd>{2,4}/gs;
  let match;
  while ((match = regex1.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      calls.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (e) {
      console.error('工具调用解析失败(格式1):', match[1], e.message);
    }
  }
  
  // 格式2：<|FunctionCallBegin|>...<|FunctionCallEnd|>
  const regex2 = /<\|FunctionCallBegin\|>(.*?)<\|FunctionCallEnd\|>/gs;
  while ((match = regex2.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      calls.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (e) {
      console.error('工具调用解析失败(格式2):', match[1], e.message);
    }
  }
  
  return calls;
}

/**
 * 清除工具调用标记
 * 支持两种格式
 */
function cleanToolCallMarkers(content) {
  return content
    .replace(/<<<FunctionCall>>>[\s\S]*?<<<FunctionCallEnd>{2,4}/g, '')
    .replace(/<\|FunctionCallBegin\|>[\s\S]*?<\|FunctionCallEnd\|>/g, '')
    .trim();
}

/**
 * 去除模型内部思考/推理过程（如 <think>、<thinking>、<think_xxx> 标签）
 * 防止把思考过程泄露给用户
 */
function stripThinkingTags(content) {
  let result = content
    // 标准 think/thinking 标签对
    .replace(/<think(?:ing)?[^>]*>[\s\S]*?<\/think(?:ing)?[^>]*>/gi, '');

  // 混元等模型可能只输出 </think_xxx> 结束标记，取标记之后的内容
  const thinkEndMatch = result.match(/<\/think_[^>]+>/);
  if (thinkEndMatch && thinkEndMatch.index !== undefined) {
    result = result.slice(thinkEndMatch.index + thinkEndMatch[0].length);
  }

  return result.trim();
}

/**
 * 当模型只返回 reasoning_content、content 为空时，尝试从中提取最终回复。
 * 策略：取最后一段语义完整的句子，过滤掉明显的思考前缀和工具调用内部提示。
 * 如果提取结果仍像内部指令，返回空字符串，让业务层走安全兜底。
 */
function extractReplyFromReasoning(reasoning, userMessages = []) {
  if (!reasoning || typeof reasoning !== 'string') return '';
  const text = reasoning.trim();
  if (!text) return '';

  const userMsgs = (Array.isArray(userMessages) ? userMessages : [userMessages])
    .map(m => String(m || '').trim())
    .filter(m => m.length >= 2);

  // 去掉模型常用的 meta 标签（如 "字数：就这意志力？" → "就这意志力？"）
  function cleanMeta(s) {
    return s.replace(/(字数|回复|答案|输出|最终回复)[：:]\s*/g, '').trim();
  }

  // 判断提取的内容是不是在重复用户原话（包括历史消息）
  function isEchoingUser(s) {
    const t = s.trim();
    return userMsgs.some(userMsg => {
      if (t === userMsg || t.includes(userMsg)) return true;
      if (userMsg.includes(t) && t.length >= userMsg.length * 0.8) return true;
      return false;
    });
  }

  const thinkPrefixes = /^(思考|分析|首先|其次|然后|因此|所以|综上|结论|那么|这里|现在|接下来|我需|我应|我打算|让我|我需要|我应该|我认为|我觉得|看起来|从上面|基于|根据|由于|因为|虽然|但是|不过|而且|用户问|当前角色|要求|结合|选一个|或者|例如)/;
  const internalHints = /工具调用|FunctionCall|回复中需要|嵌入工具|调用工具|函数调用|我需要调用|我应该调用|这里应该|请调用|可以调用|毒舌模式|温柔鼓励型|严格监督型|1-3句话|最多50字|50字|字数限制|严格按照|按照.*回复|模式.*回复|回复.*模式|生成.*回复|输出.*回复|系统提示|用户消息|角色设定|人设约束|为了安全|如果不调用|基于记忆|专业人士|直接基于|直接给|我今天|我中午|我早上|我晚上|我吃了|我喝了|我运动|我体重|示例/;

  function isSafeReply(s) {
    const t = s.trim();
    // 允许更短的口语化共情话术，也允许稍长但不超 300 字
    if (t.length < 2 || t.length > 300) return false;
    // 不过度要求必须以标点结尾（口语短句常不带标点），但排除明显截断的省略号/破折号
    if (/\.{3,}|…{1,}|——$/.test(t)) return false;
    // 不能以第一人称用户自述开头（如“我今天吃了一碗牛肉面”）
    if (/^我(今天|中午|早上|晚上|刚|现在|刚才|又|还|只|先|然后|接着)?(吃|喝|运动|练|跑|走|跳|健身|做|上|称|测|量)/.test(t)) return false;
    if (thinkPrefixes.test(t) || internalHints.test(t) || isEchoingUser(t)) return false;
    return true;
  }

  // 策略1：模型常把最终选定的回复放在最后一段完整的引号里，优先提取
  const quotes = [];
  const quoteRegex = /[“"]([\s\S]*?)[”"]/g;
  let m;
  while ((m = quoteRegex.exec(text)) !== null) {
    const q = cleanMeta(m[1]).replace(/^["“'']+|["”'']+$/g, '');
    if (isSafeReply(q)) quotes.push(q);
  }
  if (quotes.length > 0) {
    return quotes[quotes.length - 1];
  }

  // 策略2：没有可用引号时，按句子拆分兜底
  const sentences = text
    .split(/(?<=[。！？.!?])\s*/)
    .map(s => cleanMeta(s).replace(/^["“'']+|["”'']+$/g, ''))
    .filter(s => s.length >= 4 && /[。！？.!?]$/.test(s));
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i].trim();
    if (isSafeReply(s)) return s;
  }

  return '';
}

/**
 * 如果模型把历史消息（尤其是上一轮自己的回复）粘到了开头，把它去掉。
 * 增强：不仅处理整段重复，也处理只重复了上一轮某一句开头的情况。
 */
function stripLeadingHistoryEcho(reply, history) {
  if (!reply || typeof reply !== 'string') return reply;
  let cleaned = reply.trim();

  const recentPartner = (history || [])
    .filter(msg => msg.role === 'partner' || msg.role === 'assistant')
    .slice(-5)
    .map(msg => String(msg.content || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // 优先匹配长的，避免短句误伤

  // 收集上轮自己回复里的所有句子，用于判断当前回复是否在重复其中的某一句开头
  const partnerSentences = new Set();
  for (const prev of recentPartner) {
    if (prev === cleaned) return '';
    if (cleaned.startsWith(prev)) {
      const rest = cleaned.slice(prev.length).replace(/^[，,、；;。！?？\s]+/, '').trim();
      if (rest.length >= 2) return rest;
    }
    // 把历史 partner 消息按句拆分（兼容中英文标点）
    const sentences = prev
      .split(/(?<=[。！？.?！])\s*/)
      .map(s => s.trim())
      .filter(s => s.length >= 4);
    for (const s of sentences) partnerSentences.add(s);
  }

  // 循环去掉当前回复开头、与历史 partner 句子完全相同的句子
  let changed = true;
  while (changed) {
    changed = false;
    const match = cleaned.match(/^([^。！？.?！]+[。！？.?！])\s*/);
    if (!match) break;
    const leading = match[1].trim();
    if (partnerSentences.has(leading)) {
      cleaned = cleaned.slice(match[0].length).replace(/^[，,、；;。！?？\s]+/, '').trim();
      changed = true;
    }
  }

  return cleaned || reply;
}

/**
 * 判断模型返回的回复是否是无意义反问/敷衍，需要走兜底。
 * 典型 bad case：用户说"下午喝了一杯茉莉花茶"，模型回"还是闲聊？"
 */
function isUnhelpfulReply(reply, userMessage) {
  if (!reply || typeof reply !== 'string') return true;
  const r = reply.trim();
  if (r.length === 0) return true;
  // 极短回复大概率是敷衍
  if (r.length <= 6) return true;
  // 包含明显无意义反问关键词
  const badPatterns = /(还是闲聊|这是闲聊|什么意思|再说一遍|你在说什么|只是闲聊|无聊|随便|都行|随便你|所以呢|然后呢)/i;
  if (badPatterns.test(r)) return true;
  // 用户不是提问，但模型回了一个短问句（如"还是闲聊？"）
  const isUserQuestion = /[？?]/.test(userMessage || '');
  const isReplyQuestion = /[？?]/.test(r);
  if (isReplyQuestion && !isUserQuestion && r.length < 20) return true;
  return false;
}

/**
 * 执行工具调用
 */
async function executeToolCalls(toolCalls, userId, userMessage, userInfo, partnerInfo = {}) {
  const results = [];
  for (const call of toolCalls) {
    try {
      let result = null;
      const callName = call.name || '';
      
      // 支持多种函数名映射到helperAgent
      if (callName === 'call_allround_helper' || 
          callName.includes('helper') || 
          callName.includes('weight_loss') ||
          callName.includes('scheme') ||
          callName.includes('plan') ||
          (call.parameters && call.parameters.question)) {
        const question = call.parameters?.question || call.parameters?.query || userMessage;
        console.log(`[executeToolCalls] 调用helperAgent，问题: ${question.substring(0, 50)}...`);
        const answer = await Promise.race([
          helperAgent.callHelperAgent(question, userInfo, partnerInfo),
          new Promise((resolve) => setTimeout(() => {
            console.log('[executeToolCalls] helperAgent调用超时，返回兜底回复');
            resolve('这个问题有点复杂，我慢慢算一下，你先忙别的～');
          }, 50000))
        ]);
        result = { name: 'call_allround_helper', answer };
      } else if (callName === 'jump_to_page') {
        result = { name: call.name, page: call.parameters.page };
      } else {
        result = { name: call.name, error: '未知工具' };
      }
      results.push(result);
    } catch (error) {
      results.push({ name: call.name, error: error.message });
    }
  }
  return results;
}

/**
 * 当模型无法返回可用 content 时，基于用户当前语境和搭子模式生成多样化兜底回复。
 * 避免一直重复固定句子。
 */
// 兜底回复防重：按 userId 记录上一次返回的兜底文案，避免连续重复，也避免用户间互相影响
const userLastFallbackMap = new Map();

function generateContextualFallbackReply(userMessage, history = [], partnerMode = 'gentle', userId = '') {
  const mode = partnerMode || 'gentle';
  const text = String(userMessage || '').trim();

  const isShortCasual = /^[？?！!，,。.\.\s哈呵嘿哼嗯哦啊呀…~～]{1,10}$/.test(text);
  // 只按当前消息内容分类，避免"上一句在说食物，这一句说运动"被错分到食物池
  const hasFood = /吃|喝|饭|菜|肉|蛋|奶|面|米|粥|包|饺|饼|糕|零食|奶茶|咖啡|水果|蔬菜|蛋糕|巧克力|冰淇淋|薯片|坚果|酸奶|牛奶|豆浆|饮料|白开水|茶/.test(text);
  const hasExercise = /运动|跑|走|跳|练|健身|瑜伽|游泳|骑车|骑行|自行车|哑铃|杠铃|深蹲|俯卧撑|平板支撑|HIIT|Tabata|帕梅拉|拉伸|公里|千卡|卡|步|爬楼|爬山|登山|动感单车|椭圆机|划船机/.test(text);
  const hasBody = /体重|体脂|腰围|腿围|臀围|胸围|身高|BMI|掉秤|涨秤|平台期|瘦了|胖了/.test(text);
  // 情绪/状态闲聊兜底，避免被误判为专业问题后给出生硬回复
  const emotion =
    /累|困|乏|疲惫|没劲/.test(text) ? 'tired' :
    /烦|焦虑|崩溃|无语|郁闷|烦躁|心烦|压力大/.test(text) ? 'upset' :
    /开心|高兴|兴奋|棒|厉害|瘦了|掉了|达成|完成/.test(text) ? 'happy' :
    /饿|馋|想吃|嘴馋/.test(text) ? 'craving' :
    /不想动|想放弃|摆烂|躺平|emo/.test(text) ? 'giveup' :
    'neutral';

  const templates = {
    gentle: {
      casual: ['在呢，我听着呢～', '怎么啦，想跟我说说吗？', '我在，慢慢讲～', '嗯，我陪着你呢～'],
      tired: ['累了就先歇会儿，不用一直绷着～', '辛苦啦，休息也是为了更好地继续～', '今天累坏了吧？抱抱你～'],
      upset: ['别急，慢慢来，我陪着你～', '情绪上来了就跟我说说，我听着～', '放轻松，你已经很棒了～'],
      happy: ['真好，替你开心～', '继续保持，你超棒的！', '好消息就要分享呀～'],
      craving: ['又馋啦？偶尔满足一下也没关系～', '想吃什么？跟我说说，我们一起看看～', '嘴馋很正常，别自责～'],
      giveup: ['别放弃呀，你已经走了这么远了～', '累了就歇，但不要停，我陪你～', '动摇的时候，想想自己为什么开始～'],
      food: ['又吃到好吃的啦？偶尔放纵一下也没关系～', '饮食上的小纠结吗？我陪你一起理清～', '我记着呢，慢慢来，不着急～', '吃到什么啦？跟我说说～'],
      exercise: ['动起来就是进步，已经很棒啦～', '今天运动了吗？我陪你坚持～', '运动这事，动了就比不动强～'],
      body: ['身体变化我帮你盯着呢，别着急～', '我记下来啦，一起观察变化～', '体重波动很正常，继续按节奏来～'],
      default: ['说说看，我陪你～', '嗯嗯，我在听～', '我在呢，继续讲～', '有什么想跟我聊的吗？']
    },
    strict: {
      casual: ['有话直说，别只发符号。', '我在等你的正事。', '别绕弯子，说。'],
      tired: ['累不是借口，数据照样要记。', '累了就休息，但别偷懒。', '休息可以，计划不能停。'],
      upset: ['情绪管理也是减脂的一部分。', '烦归烦，别拿吃的出气。', '稳住，别前功尽弃。'],
      happy: ['别得意太早，继续保持。', '好，继续保持这个节奏。', '有进步，但还不够。'],
      craving: ['馋？忍着。', '想吃什么先问热量。', '嘴馋就喝水。'],
      giveup: ['想放弃？想想你立的 flag。', '现在放弃，之前的苦都白受了。', '别让我看不起你。'],
      food: ['吃了什么直接报。', '饮食记录呢？', '别藏着，吃了多少如实说。'],
      exercise: ['运动了就说，没运动也老实交代。', '动起来，别光说。', '今天练了什么？'],
      body: ['数据报上来。', '体重/体脂多少？', '别逃避，面对现实。'],
      default: ['说重点。', '我在听，但要说正事。', '有话快说。']
    },
    tease: {
      casual: ['咋了，手指累了？', '一个问号是想让我猜？', '神秘感拿捏了？', '说吧，别欲言又止。'],
      tired: ['累了？那就躺着瘦呗。', '哎哟，今日份疲惫已到账？', '累成这样，昨晚偷牛去了？'],
      upset: ['烦躁？要不先吃块豆腐冷静下？', '焦虑能当饭吃吗？', '烦也没用，减肥还得继续。'],
      happy: ['哟，太阳打西边出来了？', '开心成这样，掉秤了？', '继续保持，别让我抓到你偷吃。'],
      craving: ['又馋了？小馋猫本猫。', '说吧，这次盯上啥了？', '馋可以，但得付出代价。'],
      giveup: ['想摆烂？我可不答应。', '躺平可以，躺着变胖也行？', '放弃这两个字，我不想再看到。'],
      food: ['又惦记吃的了？', '说吧，今天偷吃了啥？', '张嘴让我听听是蛋糕还是奶茶？', '吃货本色不改啊。'],
      exercise: ['运动了吗？还是只动了动嘴？', '今天的热量债打算怎么还？', '别告诉我你又躺了一天。'],
      body: ['体重涨了不敢说话？', '平台期了？还是又偷吃了？', '数字不会骗人，人呢？'],
      default: ['说，是不是又偷懒了？', '快交代，别让我催。', '你这意志力，我可盯着你呢。', '别装死，说话。']
    }
  };

  const modeTemplates = templates[mode] || templates.gentle;
  let pool = modeTemplates.default;
  if (isShortCasual) pool = modeTemplates.casual;
  else if (emotion !== 'neutral' && modeTemplates[emotion]) pool = modeTemplates[emotion];
  else if (hasFood) pool = modeTemplates.food;
  else if (hasExercise) pool = modeTemplates.exercise;
  else if (hasBody) pool = modeTemplates.body;

  // 用当前消息做简单散列，若结果与上一条兜底文案相同则顺移一位，避免连续重复
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  let idx = Math.abs(hash) % pool.length;
  const lastKey = String(userId || 'anonymous');
  const lastFallbackReply = userLastFallbackMap.get(lastKey);
  if (pool[idx] === lastFallbackReply && pool.length > 1) {
    idx = (idx + 1) % pool.length;
  }
  userLastFallbackMap.set(lastKey, pool[idx]);
  return pool[idx];
}

module.exports = {
  callMainAgent,
  parseToolCalls,
  cleanToolCallMarkers,
  executeToolCalls
};
