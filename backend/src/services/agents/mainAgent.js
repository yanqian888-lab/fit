/**
 * 主协调 Agent（大脑 + 感性层）
 * 职责：对话上下文维护、意图识别、共情话术生成、最终回复、工具调用调度
 * 模型：豆包 doubao-seed-2.0-lite（备用：fit-Backup）
 */
const { callWithPrompt } = require('../aiClient');
const promptService = require('../promptService');

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

  const systemPrompt = promptService.getPrompt('main_agent', {
    user_info: userInfoStr,
    partner_mode: modeMap[mode] || '温柔鼓励型'
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

    const content = stripThinkingTags(response.choices[0].message.content || '');

    // 检查是否有工具调用标记
    const hasToolCall = content.includes('<<<FunctionCall>>>') || content.includes('<|FunctionCallBegin|>');
    console.log('[callMainAgent] hasToolCall:', hasToolCall, 'content length:', content.length);
    if (hasToolCall) {
      console.log('[callMainAgent] 发现工具调用标记，开始解析...');
    }
    
    // 解析工具调用
    const toolCalls = parseToolCalls(content);
    const reply = cleanToolCallMarkers(content);
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

  // 豆包 Seed 等模型可能只输出 </think_xxx> 结束标记，取标记之后的内容
  const thinkEndMatch = result.match(/<\/think_[^>]+>/);
  if (thinkEndMatch && thinkEndMatch.index !== undefined) {
    result = result.slice(thinkEndMatch.index + thinkEndMatch[0].length);
  }

  return result.trim();
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

module.exports = {
  callMainAgent,
  parseToolCalls,
  cleanToolCallMarkers,
  executeToolCalls
};
