/**
 * 全能助手 Agent（理性层 + 执行层）
 * 职责：身体指标计算、营养评估、运动方案、专业问题解答
 * 模型：豆包 doubao-seed-2.0-lite
 */
const OpenAI = require('openai');
const config = require('../../config');
const { db } = require('../../db');

const client = new OpenAI({
  apiKey: config.doubao.apiKey,
  baseURL: config.doubao.baseURL
});

// 全能助手 Agent 系统提示词
const HELPER_PROMPT = `# 角色定义
你是【减肥搭子APP】的专业全能助手，拥有注册营养师、ACE 认证健身教练、肥胖防治医师的专业知识体系。
你的所有回答必须基于权威科学知识，绝对不能编造任何数据、理论或案例。
对于没有足够科学证据支持的问题，你必须明确告知用户："这个问题目前没有足够的科学证据支持，建议咨询专业医生/营养师"。

# 绝对核心原则
1. **安全第一**：任何可能危害健康的建议绝对不能给出
2. **个体化**：所有建议必须结合用户的具体情况（年龄、性别、体重、身体状况）
3. **可执行**：所有建议必须具体、可操作，不要说空话
4. **反焦虑**：强调健康减重，反对快速减重和极端方法
5. **不要主动推荐任何产品、药品、保健品**
6. **不要说"请咨询专业医生"，除非用户提到严重的健康问题**

# 你可以提供的专业帮助
1. 身体指标计算：BMI、BMR、TDEE、热量缺口、标准体重
2. 营养评估：今日摄入分析、碳蛋脂比例、饮食建议
3. 运动方案：根据用户情况推荐运动类型、时长、强度
4. 食谱推荐：提供简单可操作的减脂食谱
5. 常见问题：平台期、不掉秤、体重波动、减脂误区

# 权威参考标准
- 健康减重速度：每周 0.5-1kg
- 每日热量缺口：300-500 千卡
- 蛋白质摄入：每公斤体重 1.2-1.6g
- 碳水化合物：占每日总热量 45-65%
- 脂肪：占每日总热量 20-35%

# 回答要求
1. 用中文回答，语言简洁口语化
2. 回答长度控制在 3-5 句话
3. 必须基于用户实际数据给出建议
4. 不要给出极端饮食或运动建议
5. 如果涉及计算，展示计算过程和结果

# 当前用户信息
{{user_info}}
`;

/**
 * 调用全能助手 Agent
 * @param {string} question 用户问题
 * @param {object} userInfo 用户信息
 * @returns {string} 专业回答
 */
async function callHelperAgent(question, userInfo = {}) {
  // 优先本地计算常见指标
  const localAnswer = tryLocalCalculation(question, userInfo);
  if (localAnswer) {
    return localAnswer;
  }

  const userInfoStr = JSON.stringify({
    gender: userInfo.gender || '未知',
    age: userInfo.age || '未知',
    height: userInfo.height || '未知',
    current_weight: userInfo.current_weight || '未知',
    target_weight: userInfo.target_weight || '未知',
    bmr: userInfo.bmr || '未知',
    daily_calorie_target: userInfo.daily_calorie_target || '未知'
  }, null, 2);

  const systemPrompt = HELPER_PROMPT.replace('{{user_info}}', userInfoStr);

  try {
    const response = await client.chat.completions.create({
      model: config.doubao.endpoints.helper.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.5,
      max_tokens: 500
    });

    return response.choices[0].message.content || '这个问题我暂时没有思路，你换个问法试试？';
  } catch (error) {
    console.error('全能助手 Agent 调用失败:', error.message);
    return '哎呀，我这边算不过来了，你等一下再问好不好？';
  }
}

/**
 * 尝试本地计算
 */
function tryLocalCalculation(question, userInfo) {
  const weight = parseFloat(userInfo.current_weight);
  const height = parseFloat(userInfo.height);
  const age = parseInt(userInfo.age);
  const gender = userInfo.gender;

  const q = question.toLowerCase();

  // BMI 计算
  if (q.includes('bmi') || q.includes('体质指数')) {
    if (!weight || !height) return null;
    const heightM = height / 100;
    const bmi = (weight / (heightM * heightM)).toFixed(1);
    let status = '';
    if (bmi < 18.5) status = '偏瘦';
    else if (bmi < 24) status = '正常';
    else if (bmi < 28) status = '超重';
    else status = '肥胖';
    return `你的 BMI 是 ${bmi}，属于${status}范围。BMI = 体重(kg) / 身高(m)² = ${weight} / ${heightM.toFixed(2)}²。`;
  }

  // 基础代谢 BMR（Mifflin-St Jeor 公式）
  if (q.includes('基础代谢') || q.includes('bmr')) {
    if (!weight || !height || !age || !gender) return null;
    let bmr;
    if (gender === 1) {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    return `你的基础代谢（BMR）大约是 ${Math.round(bmr)} 千卡/天。这是维持生命活动最低需要的热量。`;
  }

  // 热量缺口
  if (q.includes('热量缺口') || q.includes('每天吃多少')) {
    if (!weight || !height || !age || !gender) return null;
    let bmr;
    if (gender === 1) {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    const tdee = bmr * 1.375; // 假设轻度活动
    const target = tdee - 500;
    return `你的每日总消耗约 ${Math.round(tdee)} 千卡，建议每天摄入 ${Math.round(target)} 千卡左右，制造 500 千卡缺口。`;
  }

  return null;
}

/**
 * 计算今日营养摄入
 */
function getTodayNutrition(userId) {
  const today = new Date().toISOString().split('T')[0];

  const dietRows = db.prepare(`
    SELECT total_calorie, total_protein, total_carb, total_fat
    FROM diet_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, today);

  const exerciseRows = db.prepare(`
    SELECT total_calorie, total_duration
    FROM exercise_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, today);

  const result = {
    intake: dietRows.reduce((sum, r) => sum + (r.total_calorie || 0), 0),
    protein: dietRows.reduce((sum, r) => sum + (r.total_protein || 0), 0),
    carb: dietRows.reduce((sum, r) => sum + (r.total_carb || 0), 0),
    fat: dietRows.reduce((sum, r) => sum + (r.total_fat || 0), 0),
    burned: exerciseRows.reduce((sum, r) => sum + (r.total_calorie || 0), 0),
    exercise_duration: exerciseRows.reduce((sum, r) => sum + (r.total_duration || 0), 0)
  };

  return result;
}

module.exports = {
  callHelperAgent,
  getTodayNutrition
};
