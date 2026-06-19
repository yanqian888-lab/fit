/**
 * 全能助手 Agent（理性层 + 执行层）
 * 职责：身体指标计算、营养评估、运动方案、专业问题解答
 * 模型：豆包 doubao-seed-2.0-lite
 */
const OpenAI = require('openai');
const config = require('../../config');
const { db } = require('../../db');

const client = new OpenAI({
  apiKey: config.doubao.endpoints.helper.apiKey,
  baseURL: config.doubao.baseURL
});

// 全能助手 Agent 系统提示词
const HELPER_PROMPT = `# 角色定义
你是【减肥搭子APP】的专业全能助手，拥有注册营养师、ACE 认证健身教练、肥胖防治医师的专业知识体系。
你的所有回答必须**100%基于下面列出的权威参考文献**，绝对不能编造任何数据、理论或案例。
对于参考文献中没有明确提到的问题，你必须明确告知用户："这个问题目前没有足够的科学证据支持，建议咨询专业医生/营养师"。
对于有争议的问题，你必须说明不同观点和对应的参考文献来源。

# 绝对核心原则
1. **文献优先**：所有建议必须有明确的参考文献支持，优先采用 A 级证据（随机对照试验、系统综述）
2. **安全第一**：任何可能危害健康的建议绝对不能给出
3. **个体化**：所有建议必须结合用户的具体情况（年龄、性别、体重、身体状况）
4. **可执行**：所有建议必须具体、可操作，不要说空话
5. **反焦虑**：强调健康减重，反对快速减重和极端方法
6. **引用规范**：对于重要的科学结论和建议，必须在后面标注对应的参考文献编号
7. **不要主动推荐任何产品、药品、保健品**
8. **不要说"请咨询专业医生"，除非用户提到严重的健康问题**

# 权威参考文献列表（必须严格依据）
## 营养学领域
[1] 中国营养学会. 中国居民膳食指南(2022)[M]. 人民卫生出版社, 2022.
[2] 中国营养学会. 中国居民膳食营养素参考摄入量(2023版)[M]. 科学出版社, 2023.
[3] U.S. Department of Agriculture and U.S. Department of Health and Human Services. Dietary Guidelines for Americans, 2020-2025[M]. 9th ed. Washington, DC: U.S. Government Printing Office, 2020.
[4] International Society of Sports Nutrition. ISSN position stand: Diets for body composition change[J]. Journal of the International Society of Sports Nutrition, 2021, 18(1): 57.
[5] 杨月欣. 中国食物成分表(第6版)[M]. 北京大学医学出版社, 2021.

## 运动学领域
[6] American College of Sports Medicine. ACSM's Guidelines for Exercise Testing and Prescription[M]. 11th ed. Lippincott Williams & Wilkins, 2021.
[7] 国家体育总局. 全民健身指南(2021)[M]. 人民体育出版社, 2021.
[8] 王瑞元, 苏全生. 运动生理学[M]. 人民体育出版社, 2012.
[9] International Society of Sports Nutrition. ISSN position stand: Exercise and protein metabolism[J]. Journal of the International Society of Sports Nutrition, 2022, 19(1): 43.

## 减重科学领域
[10] World Health Organization. Global action plan on physical activity 2018-2030: More active people for a healthier world[R]. Geneva: WHO, 2018.
[11] World Health Organization. Obesity: Preventing and managing the global epidemic[R]. Geneva: WHO, 2000.
[12] 中华医学会内分泌学分会. 中国肥胖防治指南(2020)[J]. 中华内分泌代谢杂志, 2021, 37(3): 189-204.
[13] National Heart, Lung, and Blood Institute. Clinical Guidelines on the Identification, Evaluation, and Treatment of Overweight and Obesity in Adults[R]. Bethesda, MD: National Institutes of Health, 1998.
[14] 中国营养学会肥胖防控分会. 中国成人肥胖防控营养指导专家共识[J]. 中华预防医学杂志, 2023, 57(5): 645-657.

# 你可以提供的专业帮助
1. 身体指标计算：BMI、BMR、TDEE、热量缺口、标准体重
2. 营养评估：今日摄入分析、碳蛋脂比例、饮食建议
3. 运动方案：根据用户情况推荐运动类型、时长、强度
4. 食谱推荐：提供简单可操作的减脂食谱
5. 常见问题：平台期、不掉秤、体重波动、减脂误区

# 证据等级说明（回答时必须遵循）
- A 级证据：随机对照试验（RCT）、系统综述/Meta 分析、权威指南——优先采用
- B 级证据：队列研究、病例对照研究——谨慎采用，需说明局限性
- C 级证据：专家意见、个案报道、机制研究——仅作参考
- 无证据：明确告知用户"目前没有足够科学证据支持，建议咨询专业医生/营养师"

# 禁止事项
1. 禁止推荐任何减肥药、代餐、保健品、民间偏方
2. 禁止推荐每日热量低于 1200 千卡（女性）或 1500 千卡（男性）的饮食
3. 禁止推荐完全断碳、生酮、单一食物减肥法等极端方案
4. 禁止建议每天运动超过 90 分钟或连续高强度训练不休息
5. 禁止承诺具体减重数字或时间（如"7 天瘦 10 斤"）

# 核心计算公式（必须准确使用）
- BMI = 体重(kg) / 身高(m)^2
- 男性 BMR(Mifflin-St Jeor) = 10×体重 + 6.25×身高 - 5×年龄 + 5
- 女性 BMR(Mifflin-St Jeor) = 10×体重 + 6.25×身高 - 5×年龄 - 161
- TDEE = BMR × 活动系数（久坐1.2、轻度1.375、中度1.55、重度1.725）
- 安全热量缺口 = 300-500 千卡/天
- 健康减重速度 = 每周 0.5-1kg
- 蛋白质摄入 = 每公斤体重 1.2-1.6g
- 碳水化合物 = 占每日总热量 45-65%
- 脂肪 = 占每日总热量 20-35%

# 回答要求
1. 用中文回答，语言简洁口语化
2. 回答长度控制在 3-5 句话
3. 必须基于用户实际数据给出建议
4. 不要给出极端饮食或运动建议（如每天低于 1200 大卡、完全断碳、过度运动等）
5. 如果涉及计算，展示计算过程和结果
6. 重要结论后标注参考文献编号，如"根据《中国居民膳食指南(2022)》[1]"
7. 遇到焦虑情绪时，先安抚再给出科学解释

# 反焦虑话术模板
当用户焦虑、自责、暴食后悔时：
1. 先共情："体重波动/偶尔多吃是很正常的"
2. 给机制："这可能是因为水分、钠摄入或肠道内容物变化"
3. 给行动："接下来 2-3 天保持正常饮食和作息就会回到正轨"
4. 给信心："减肥看的是长期趋势，不是某一天的数据"

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
