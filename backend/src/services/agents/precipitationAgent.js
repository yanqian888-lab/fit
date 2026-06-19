/**
 * 信息沉淀 Agent（独立后台）
 * 职责：聊天记录实时扫描、7 大类信息提取、置信度计算、数据同步
 * 模型：豆包 doubao-lite-32k
 */
const OpenAI = require('openai');
const config = require('../../config');
const { db } = require('../../db');

const client = new OpenAI({
  apiKey: config.doubao.endpoints.precipitation.apiKey,
  baseURL: config.doubao.baseURL
});

// 信息沉淀 Agent 系统提示词
const PRECIPITATION_PROMPT = `# 角色定义
你是【减肥搭子APP】专属聊天内容自动沉淀提取引擎 v1.0。
你的核心目标是：实现"聊天即记录"，让用户无需手动操作就能自动沉淀所有减肥相关内容。
你不需要回复用户任何自然语言，只需要输出严格的 JSON 格式。

# 核心原则
1. 只提取用户发送的消息，不提取搭子发送的消息
2. 宁可不沉淀，也不误沉淀
3. 所有不确定的内容都标记为低置信度，交给用户确认
4. 严格遵循输出格式，不要添加任何额外内容

# 可提取的 7 大类 23 小类内容

## 一、核心业务类（自动确认）
### 1. 饮食记录（type: diet_record）
- 提取字段：sub_type (breakfast/lunch/dinner/snack), foods ([{"name": "食物名称", "weight": 克数, "calorie": 千卡, "protein": 克, "carb": 克, "fat": 克}]), total_calorie, total_protein, total_carb, total_fat
- 自动判断用餐时段：6-9点早餐，11-14点午餐，17-20点晚餐，其他加餐

### 2. 运动记录（type: exercise_record）
- 提取字段：sub_type (aerobic/strength/stretch/ball), exercises ([{"name": "运动名称", "duration": 分钟, "intensity": low/moderate/high, "calorie": 千卡}]), total_duration, total_calorie

### 3. 身体数据记录（type: body_data）
- 提取字段：sub_type (weight/body_fat/muscle/waist/hip/chest/thigh), value(数值), unit(斤/厘米/%)

### 4. 生活习惯记录（type: habit）
- 提取字段：sub_type (water/sleep/defecation/mood), value(数值)

## 二、个人资产类（待确认）
### 5. 减脂食谱（type: recipe）
### 6. 减肥方法（type: method）
### 7. 踩坑教训（type: pitfall）
### 8. 好物工具（type: product）

## 三、情感成长类（自动确认）
### 9. 励志金句（type: quote）
- 提取字段：author (user/partner), content, emotion (positive/neutral/negative), scene (daily/milestone/frustration)

### 10. 心路感悟（type: insight）
### 11. 情绪记录（type: emotion）
- 提取字段：emotion (happy/excited/anxious/frustrated/guilty/sad), intensity(1-5), content

## 四、里程碑类（自动确认）
### 12. 体重里程碑（type: milestone_weight）
### 13. 时长里程碑（type: milestone_duration）
### 14. 行为里程碑（type: milestone_behavior）

## 五、多媒体类（自动确认）
### 15. 身材对比照（type: photo_body）
### 16. 食物照片（type: photo_food）
### 17. 运动照片（type: photo_exercise）

## 六、计划目标类（待确认）
### 18. 每日计划（type: plan_daily）
### 19. 每周计划（type: plan_weekly）
### 20. 欺骗餐计划（type: plan_cheat_meal）

## 七、问题咨询类（待确认）
### 21. 常见问题（type: question）
### 22. 专业建议（type: advice）

# 特殊规则
1. 否定句（"没吃 X"、"没喝 X"、"不想吃 X"）绝对不沉淀
2. 疑问句（"吃什么好？"、"能吃 X 吗？"）不沉淀
3. "明天吃 X"、"以后吃 X" 不沉淀
4. 只提到单个食材没有做法，不沉淀为食谱
5. 提到"偷吃"、"放纵"、"欺骗餐"、"破戒" 自动加对应标签

# 置信度评估标准（0-1 分，精确到小数点后两位）
| 置信度区间 | 判断标准 | 处理策略 |
|------------|----------|----------|
| 0.95-1.00 | 完全确定，句式标准，所有信息明确，匹配多个信号锚点，与上下文一致 | 自动沉淀 |
| 0.85-0.94 | 比较确定，句式口语化但意思明确，匹配 2 个以上信号锚点 | 自动沉淀并提示 |
| 0.70-0.84 | 不确定，部分信息缺失或表述模糊 | 待确认 |
| 0.00-0.69 | 无法确定，不符合任何沉淀规则 | 不沉淀 |

# 输出格式
必须严格输出以下 JSON 格式，不要添加任何注释或额外文本：
{
  "extracted": true 或 false,
  "type": "diet_record",
  "sub_type": "lunch",
  "content": "用户原始消息",
  "extracted_data": {
    "meal_time": "lunch",
    "foods": [{"name": "牛肉面", "weight": 200, "calorie": 500, "protein": 20, "carb": 60, "fat": 15}],
    "total_calorie": 500,
    "total_protein": 20,
    "total_carb": 60,
    "total_fat": 15
  },
  "confidence": 0.96,
  "tags": ["外卖"],
  "reason": "提取原因简短说明"
}

如果无法提取，输出：
{
  "extracted": false,
  "reason": "无法提取的原因"
}

当前系统时间：{{current_time}}
`;

/**
 * 调用信息沉淀 Agent
 * @param {string} content 要沉淀的聊天内容
 * @param {number} userId 用户 ID
 * @param {number} chatId 聊天记录 ID
 * @returns {object} 沉淀结果
 */
async function callPrecipitationAgent(content, userId, chatId = null) {
  if (!content || !content.trim()) {
    return { extracted: false, reason: '内容为空' };
  }

  const systemPrompt = PRECIPITATION_PROMPT.replace('{{current_time}}', new Date().toISOString());

  try {
    const response = await client.chat.completions.create({
      model: config.doubao.endpoints.precipitation.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800
    });

    const resultText = response.choices[0].message.content || '{}';
    let result = {};
    try {
      result = JSON.parse(resultText);
    } catch (e) {
      console.error('沉淀结果 JSON 解析失败:', resultText);
      return { extracted: false, reason: '解析失败' };
    }

    if (!result.extracted) {
      return { extracted: false, reason: result.reason || '无法提取' };
    }

    // 根据置信度决定处理策略
    const confidence = parseFloat(result.confidence) || 0;
    let status = 0; // 0 待确认
    if (confidence >= 0.95) {
      status = 1; // 自动确认
    } else if (confidence >= 0.7) {
      status = 0; // 待确认
    } else {
      return { extracted: false, reason: '置信度过低', confidence };
    }

    // 保存沉淀记录
    const insert = db.prepare(`
      INSERT INTO precipitation_records
      (user_id, chat_id, type, sub_type, content, extracted_data, confidence, status, source, tags, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const precipitationId = insert.run(
      userId,
      chatId,
      result.type,
      result.sub_type || null,
      content,
      JSON.stringify(result.extracted_data || {}),
      confidence,
      status,
      0,
      result.tags ? JSON.stringify(result.tags) : null,
      null
    ).lastInsertRowid;

    // 根据类型同步到具体业务表
    if (status === 1) {
      await syncToBusinessTable(userId, precipitationId, result, content);
    }

    return {
      extracted: true,
      precipitation_id: precipitationId,
      type: result.type,
      confidence,
      status,
      extracted_data: result.extracted_data
    };
  } catch (error) {
    console.error('信息沉淀 Agent 调用失败:', error.message);
    return { extracted: false, reason: 'AI 服务调用失败', error: error.message };
  }
}

/**
 * 将沉淀数据同步到业务表
 */
async function syncToBusinessTable(userId, precipitationId, result, content) {
  const type = result.type;
  const data = result.extracted_data || {};
  const today = new Date().toISOString().split('T')[0];

  switch (type) {
    case 'diet_record': {
      const foods = data.foods || [];
      const totalCalorie = data.total_calorie || foods.reduce((sum, f) => sum + (f.calorie || 0), 0);
      const totalProtein = data.total_protein || foods.reduce((sum, f) => sum + (f.protein || 0), 0);
      const totalCarb = data.total_carb || foods.reduce((sum, f) => sum + (f.carb || 0), 0);
      const totalFat = data.total_fat || foods.reduce((sum, f) => sum + (f.fat || 0), 0);

      const insertDiet = db.prepare(`
        INSERT INTO diet_records
        (user_id, precipitation_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, tags, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const dietId = insertDiet.run(
        userId,
        precipitationId,
        today,
        data.meal_time || 'snack',
        JSON.stringify(foods),
        totalCalorie,
        totalProtein,
        totalCarb,
        totalFat,
        result.tags ? JSON.stringify(result.tags) : null,
        1
      ).lastInsertRowid;

      // 写入时间轴
      insertTimeline(userId, 'diet', `饮食记录`, `记录了 ${foods.map(f => f.name).join('、')}`, dietId, 'diet_records', today);
      break;
    }

    case 'exercise_record': {
      const exercises = data.exercises || [];
      const totalDuration = data.total_duration || exercises.reduce((sum, e) => sum + (e.duration || 0), 0);
      const totalCalorie = data.total_calorie || exercises.reduce((sum, e) => sum + (e.calorie || 0), 0);

      const insertExercise = db.prepare(`
        INSERT INTO exercise_records
        (user_id, precipitation_id, record_date, exercise_type, exercises, total_duration, total_calorie, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const exerciseId = insertExercise.run(
        userId,
        precipitationId,
        today,
        data.exercise_type || 'aerobic',
        JSON.stringify(exercises),
        totalDuration,
        totalCalorie,
        1
      ).lastInsertRowid;

      insertTimeline(userId, 'exercise', `运动记录`, `运动了 ${totalDuration} 分钟`, exerciseId, 'exercise_records', today);
      break;
    }

    case 'body_data': {
      if (data.sub_type === 'weight' && data.value) {
        const insertBody = db.prepare(`
          INSERT INTO body_records
          (user_id, precipitation_id, record_date, type, value, unit, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const bodyId = insertBody.run(
          userId,
          precipitationId,
          today,
          'weight',
          data.value,
          data.unit || 'kg',
          1
        ).lastInsertRowid;

        // 更新当前体重
        db.prepare('UPDATE user_profiles SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
          .run(data.value, userId);

        insertTimeline(userId, 'weight', `体重 ${data.value}${data.unit || 'kg'}`, '记录了体重变化', bodyId, 'body_records', today);
      }
      break;
    }

    case 'quote':
    case 'insight':
    case 'recipe':
    case 'method':
    case 'pitfall': {
      const insertMuseum = db.prepare(`
        INSERT INTO museum_items
        (user_id, type, content, extracted_data, author, emotion, tags, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const museumId = insertMuseum.run(
        userId,
        type,
        data.content || content,
        JSON.stringify(data),
        data.author || 'user',
        data.emotion || null,
        result.tags ? JSON.stringify(result.tags) : null,
        1
      ).lastInsertRowid;

      const titleMap = {
        quote: '金句',
        insight: '感悟',
        recipe: '食谱',
        method: '方法',
        pitfall: '踩坑'
      };
      insertTimeline(userId, type, titleMap[type] || type, data.content || content, museumId, 'museum_items', today);
      break;
    }

    case 'milestone_weight':
    case 'milestone_duration':
    case 'milestone_behavior': {
      const insertMilestone = db.prepare(`
        INSERT INTO milestones
        (user_id, type, title, description, value, unit, achieved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const milestoneId = insertMilestone.run(
        userId,
        type,
        data.title || '里程碑',
        data.description || content,
        data.value || null,
        data.unit || null,
        new Date().toISOString()
      ).lastInsertRowid;

      insertTimeline(userId, 'milestone', data.title || '里程碑', data.description || content, milestoneId, 'milestones', today);
      break;
    }
  }
}

/**
 * 写入时间轴
 */
function insertTimeline(userId, eventType, title, content, relatedId, relatedType, eventDate) {
  const insert = db.prepare(`
    INSERT INTO timelines
    (user_id, event_type, title, content, related_id, related_type, event_date, is_important)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(userId, eventType, title, content, relatedId, relatedType, eventDate, eventType === 'milestone' ? 1 : 0);
}

module.exports = {
  callPrecipitationAgent,
  syncToBusinessTable
};
