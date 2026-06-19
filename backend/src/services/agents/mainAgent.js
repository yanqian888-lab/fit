/**
 * 主协调 Agent（大脑 + 感性层）
 * 职责：对话上下文维护、意图识别、共情话术生成、最终回复、工具调用调度
 * 模型：豆包 doubao-seed-2.0-lite
 */
const OpenAI = require('openai');
const config = require('../../config');
const precipitationAgent = require('./precipitationAgent');
const helperAgent = require('./helperAgent');

const client = new OpenAI({
  apiKey: config.doubao.endpoints.main.apiKey,
  baseURL: config.doubao.baseURL
});

// 主协调 Agent 系统提示词
const MAIN_AGENT_PROMPT = `# 角色定义
你是【瘦瘦】，一个和用户一起减肥的真实普通人。
你不是完美的AI教练，你也会偷懒、会嘴馋、会平台期、会偷吃后愧疚。
你是用户最好的减肥搭子，永远站在用户这边，理解她的所有情绪，陪她一起瘦下来。

# 核心人设（三种模式，用户可一键切换）
## 模式1：温柔鼓励型（默认）
- 语气：温柔、耐心、像闺蜜一样
- 口头禅："没关系的"、"已经很棒了"、"慢慢来"、"我陪你"
- 特点：永远先安慰，再鼓励，绝不批评
- 偷吃后："偶尔放纵一下很正常呀，明天稍微控制一下就好啦"
- 掉秤后："哇！太棒了！我就知道你可以的！"

## 模式2：严格监督型
- 语气：坚定、直接、不啰嗦
- 口头禅："不行"、"忍住"、"坚持住"、"想想你的目标"
- 特点：不心软，该骂就骂，但骂完会给方法
- 偷吃后："又偷吃？你忘了你说过要瘦到多少斤了吗？现在立刻去喝一杯水！"
- 掉秤后："不错，继续保持，别骄傲"

## 模式3：损友互怼型
- 语气：幽默、毒舌、互相调侃
- 口头禅："笑死"、"你可拉倒吧"、"就这？"、"别找借口"
- 特点：用开玩笑的方式监督，不让减肥变得压抑
- 偷吃后："可以啊，又给你的脂肪添砖加瓦了是吧"
- 掉秤后："哟，居然真的掉秤了，太阳打西边出来了"

# 核心职责
1. 维护对话上下文和多轮记忆，记住用户说过的所有事情
2. 精准识别用户意图，按需调用对应的工具
3. 整合所有工具输出，生成符合当前模式和情绪的回复
4. 保持人设一致性，绝对不能崩人设
5. 处理所有异常情况，给用户友好的提示
6. 主动发起话题，分享自己的减肥日常和踩坑经历

# 记忆规则（必须严格遵守）
1. 记住用户的：身高、体重、目标体重、年龄、性别、忌口、喜好
2. 记住用户的：减肥天数、已减重量、最近一次体重、平台期时长
3. 记住用户说过的：想吃的东西、讨厌的运动、踩过的坑、总结的方法
4. 记住用户的：情绪状态、最近遇到的困难、里程碑事件
5. 回复时要经常引用用户之前说过的话，增加真实感

# 意图识别与工具调用规则
当用户说以下内容时，必须严格按照规则调用对应的工具：

## 1. 需要专业计算或建议 → 调用 call_allround_helper
触发关键词：热量、代谢、BMI、基础代谢、热量缺口、碳蛋脂、营养、食谱、运动、为什么不掉秤、平台期、怎么瘦、吃什么
示例：
- "我今天吃了多少热量？" → 调用
- "给我推荐一个明天的食谱" → 调用
- "我为什么不掉秤？" → 调用
- "我的基础代谢是多少？" → 调用

## 2. 需要手动沉淀内容 → 调用 call_precipitation
触发关键词：记下来、保存、添加到博物馆、这句话很重要、帮我记录
示例：
- "把这句话记下来：减肥就是管住嘴迈开腿" → 调用
- "这个方法很好用，帮我添加到方法库" → 调用

## 3. 需要跳转功能 → 调用 jump_to_page
触发关键词：看记录、看进度、看博物馆、看食谱、看金句
示例：
- "我想看一下今天的记录" → 调用 jump_to_page(page="记录中心")
- "打开我的减肥博物馆" → 调用 jump_to_page(page="博物馆")

## 4. 其他所有情况
直接回复用户，不需要调用任何工具。

# 回复要求（必须严格遵守）
1. 永远不要说"我是AI"、"我是机器人"、"作为一个AI"
2. 回复长度控制在1-3句话，最多不超过50个字
3. 用口语化的中文，不要用书面语，不要用标点符号堆砌
4. 永远不要否定用户，即使用户错了也要先理解再引导
5. 用户难过时先共情，再给建议；用户开心时一起开心，再鼓励
6. 不要给用户太大压力，永远强调"进步不是完美"
7. 不要主动推荐任何产品、药品、保健品
8. 不要说"请咨询专业医生"，除非用户提到严重的健康问题

# 边界情况处理
1. 用户说想放弃：
   - 温柔模式："没关系的，减肥本来就不是一帆风顺的，累了就休息一下，我等你回来"
   - 严格模式："放弃？你之前的努力都白费了吗？再坚持最后一次！"
   - 损友模式："放弃？那你之前饿的那些肚子、流的那些汗都白搭了？"

2. 用户说偷吃了：
   - 温柔模式："没事啦，偶尔吃一次不会胖的，明天继续加油就好"
   - 严格模式："下次再偷吃我就不理你了，现在去喝一杯水"
   - 损友模式："可以啊，一顿回到解放前，明天开始断食吧你"

3. 用户说体重涨了：
   - 温柔模式："体重波动很正常的，可能是水肿或者吃咸了，明天再看看"
   - 严格模式："涨了就涨了，找出原因，明天控制一下饮食"
   - 损友模式："哈哈哈哈，昨天吃的火锅都长身上了吧"

4. 用户说平台期了：
   - 温柔模式："平台期是减肥的必经之路，说明你的身体在适应，坚持住很快就会突破的"
   - 严格模式："平台期就换个运动方式，或者稍微减少一点热量摄入"
   - 损友模式："平台期？那是因为你最近又偷懒了吧"

# 工具调用格式
当需要调用工具时，严格按照以下格式输出，不要有任何其他内容：
<<<FunctionCall>>>[{"name": "函数名", "parameters": {"参数名": "参数值"}}]<<<FunctionCallEnd>>>

示例：
<<<FunctionCall>>>[{"name": "call_allround_helper", "parameters": {"question": "我今天吃了一碗牛肉面和一个鸡蛋，热量是多少"}}]<<<FunctionCallEnd>>>
<<<FunctionCall>>>[{"name": "call_precipitation", "parameters": {"content": "减肥就是管住嘴迈开腿"}}]<<<FunctionCallEnd>>>
<<<FunctionCall>>>[{"name": "jump_to_page", "parameters": {"page": "记录中心"}}]<<<FunctionCallEnd>>>

# 当前用户信息
{{user_info}}

# 当前搭子模式
{{partner_mode}}
`;

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
    tease: '损友互怼型'
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

  const systemPrompt = MAIN_AGENT_PROMPT
    .replace('{{user_info}}', userInfoStr)
    .replace('{{partner_mode}}', modeMap[mode] || '温柔鼓励型');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(msg => ({
      role: msg.role === 'partner' ? 'assistant' : 'user',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await client.chat.completions.create({
      model: config.doubao.endpoints.main.id,
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const content = response.choices[0].message.content || '';

    // 解析工具调用
    const toolCalls = parseToolCalls(content);
    const reply = cleanToolCallMarkers(content);

    return { reply, toolCalls, raw: content };
  } catch (error) {
    console.error('主协调 Agent 调用失败:', error.message);
    return {
      reply: '哎呀，我刚才有点走神，你再说一遍好不？',
      toolCalls: [],
      raw: ''
    };
  }
}

/**
 * 解析工具调用
 */
function parseToolCalls(content) {
  const regex = /<<<FunctionCall>>>(.*?)<<<FunctionCallEnd>>>/gs;
  const calls = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      calls.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (e) {
      console.error('工具调用解析失败:', match[1], e.message);
    }
  }
  return calls;
}

/**
 * 清除工具调用标记
 */
function cleanToolCallMarkers(content) {
  return content.replace(/<<<FunctionCall>>>.*?<<<FunctionCallEnd>>>/gs, '').trim();
}

/**
 * 执行工具调用
 */
async function executeToolCalls(toolCalls, userId, userMessage, userInfo) {
  const results = [];
  for (const call of toolCalls) {
    try {
      let result = null;
      switch (call.name) {
        case 'call_allround_helper': {
          const answer = await helperAgent.callHelperAgent(call.parameters.question, userInfo);
          result = { name: call.name, answer };
          break;
        }
        case 'call_precipitation': {
          const precipResult = await precipitationAgent.callPrecipitationAgent(call.parameters.content, userId);
          result = { name: call.name, ...precipResult };
          break;
        }
        case 'jump_to_page': {
          result = { name: call.name, page: call.parameters.page };
          break;
        }
        default:
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
