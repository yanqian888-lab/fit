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
      content = generateContextualFallbackReply(userMessage, history, mode);
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
    const reply = cleanToolCallMarkers(content).trim();

    console.log('[callMainAgent] toolCalls count:', toolCalls.length, 'reply length:', reply.length);
    if (toolCalls.length > 0) {
      console.log('[callMainAgent] 解析到工具调用:', JSON.stringify(toolCalls));
    }

    // 强制兜底：如果模型说"方案""计划""方法""给你""算算""整""热量""消耗""卡路里"但没有调用工具，强制添加工具调用
    if (toolCalls.length === 0 && 
        (reply.includes('方案') || reply.includes('计划') || reply.includes('方法') || 
         reply.includes('给你') || reply.includes('算算') || reply.includes('整') ||
         reply.includes('算') || reply.includes('方案') || reply.includes('安排') ||
         reply.includes('热量') || reply.includes('消耗') || reply.includes('卡路里') ||
         reply.includes('千卡') || reply.includes('卡') || reply.includes('适配') ||
         reply.includes('告诉你') || reply.includes('说说') || reply.includes('建议') ||
         reply.includes('推荐') || reply.includes('教') || reply.includes('怎么')) &&
        !hasToolCall) {
      console.log('主Agent未调用工具但提到了方案/方法/给你/整/适配等，强制添加工具调用');
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
  const internalHints = /工具调用|FunctionCall|回复中需要|嵌入工具|调用工具|函数调用|我需要调用|我应该调用|这里应该|请调用|可以调用|毒舌模式|温柔鼓励型|严格监督型|1-3句话|最多50字|50字|字数限制|严格按照|按照.*回复|模式.*回复|回复.*模式|生成.*回复|输出.*回复|系统提示|用户消息|角色设定|人设约束|为了安全|如果不调用|基于记忆|专业人士|直接基于|直接给/;

  function isSafeReply(s) {
    const t = s.trim();
    return t.length >= 4 && t.length <= 200 && /[。！？.!?]$/.test(t) && !thinkPrefixes.test(t) && !internalHints.test(t) && !isEchoingUser(t);
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
 */
function stripLeadingHistoryEcho(reply, history) {
  if (!reply || typeof reply !== 'string') return reply;
  const recentPartner = (history || [])
    .filter(msg => msg.role === 'partner' || msg.role === 'assistant')
    .slice(-5)
    .map(msg => String(msg.content || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // 优先匹配长的，避免短句误伤
  for (const prev of recentPartner) {
    // 完整重复上一轮自己的话，直接丢弃
    if (reply === prev) return '';
    if (reply.startsWith(prev)) {
      const rest = reply.slice(prev.length).replace(/^[，,、；;。！?？\s]+/, '').trim();
      if (rest.length >= 2) return rest;
    }
  }
  return reply;
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
function generateContextualFallbackReply(userMessage, history = [], partnerMode = 'gentle') {
  const mode = partnerMode || 'gentle';
  const text = String(userMessage || '').trim();

  // 合并最近几条用户消息，用于判断当前话题
  const recentUserTexts = (history || [])
    .filter(msg => msg.role === 'user')
    .slice(-3)
    .map(msg => msg.content)
    .concat(text)
    .join(' ');

  const isShortCasual = /^[？?！!，,。\.\s哈呵嘿哼嗯哦啊呀…~～]{1,6}$/.test(text);
  const hasFood = /吃|喝|饭|菜|肉|蛋|奶|面|米|粥|包|饺|饼|糕|零食|奶茶|咖啡|水果|蔬菜|蛋糕|巧克力|冰淇淋|薯片|坚果|酸奶|牛奶|豆浆|饮料|白开水|茶/.test(recentUserTexts);
  const hasExercise = /运动|跑|走|跳|练|健身|瑜伽|游泳|骑车|骑行|哑铃|杠铃|深蹲|俯卧撑|平板支撑|HIIT|Tabata|帕梅拉|拉伸|公里|千卡|卡|步|爬楼|爬山|动感单车|椭圆机|划船机/.test(recentUserTexts);
  const hasBody = /体重|体脂|腰围|腿围|臀围|胸围|身高|BMI|掉秤|涨秤|平台期|瘦了|胖了/.test(recentUserTexts);

  const templates = {
    gentle: {
      casual: ['在呢，我听着呢～', '怎么啦，想跟我说说吗？', '我在，慢慢讲～', '嗯，我陪着你呢～'],
      food: ['又吃到好吃的啦？偶尔放纵一下也没关系～', '饮食上的小纠结吗？我陪你一起理清～', '我记着呢，慢慢来，不着急～', '吃到什么啦？跟我说说～'],
      exercise: ['动起来就是进步，已经很棒啦～', '今天运动了吗？我陪你坚持～', '运动这事，动了就比不动强～'],
      body: ['身体变化我帮你盯着呢，别着急～', '我记下来啦，一起观察变化～', '体重波动很正常，继续按节奏来～'],
      default: ['说说看，我陪你～', '嗯嗯，我在听～', '我在呢，继续讲～', '有什么想跟我聊的吗？']
    },
    strict: {
      casual: ['有话直说，别只发符号。', '我在等你的正事。', '别绕弯子，说。'],
      food: ['吃了什么直接报。', '饮食记录呢？', '别藏着，吃了多少如实说。'],
      exercise: ['运动了就说，没运动也老实交代。', '动起来，别光说。', '今天练了什么？'],
      body: ['数据报上来。', '体重/体脂多少？', '别逃避，面对现实。'],
      default: ['说重点。', '我在听，但要说正事。', '有话快说。']
    },
    tease: {
      casual: ['咋了，手指累了？', '一个问号是想让我猜？', '神秘感拿捏了？', '说吧，别欲言又止。'],
      food: ['又惦记吃的了？', '说吧，今天偷吃了啥？', '张嘴让我听听是蛋糕还是奶茶？', '吃货本色不改啊。'],
      exercise: ['运动了吗？还是只动了动嘴？', '今天的热量债打算怎么还？', '别告诉我你又躺了一天。'],
      body: ['体重涨了不敢说话？', '平台期了？还是又偷吃了？', '数字不会骗人，人呢？'],
      default: ['说，是不是又偷懒了？', '快交代，别让我催。', '你这意志力，我可盯着你呢。', '别装死，说话。']
    }
  };

  const modeTemplates = templates[mode] || templates.gentle;
  let pool = modeTemplates.default;
  if (isShortCasual) pool = modeTemplates.casual;
  else if (hasFood) pool = modeTemplates.food;
  else if (hasExercise) pool = modeTemplates.exercise;
  else if (hasBody) pool = modeTemplates.body;

  // 用用户消息做简单散列，保证同一条消息多次进来时也有固定但多样的选择
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % pool.length;
  return pool[idx];
}

module.exports = {
  callMainAgent,
  parseToolCalls,
  cleanToolCallMarkers,
  executeToolCalls
};
