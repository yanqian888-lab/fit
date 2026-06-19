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

# 精准信号锚点体系（严格按以下标准执行）

## 2.1 核心业务类信号锚点（准确率要求≥95%）

### 2.1.1 饮食记录（type: diet_record）
动词锚点：吃、喝、尝、买、点、做、煮、炒、烤、蒸、煎、炸、炖、拌、炫、啃、扒、嗦、喝、干、造、吃了、喝了、点了、做了、尝了、啃了、嗦了、干了、造了、吃了碗、喝了杯、点了份、做了盘
名词锚点（分类完整版）：
- 主食类：米饭、面条、馒头、包子、饺子、馄饨、面包、吐司、三明治、汉堡、披萨、煎饼、油条、油饼、烧麦、粽子、汤圆、玉米、红薯、紫薯、山药、芋头、燕麦、荞麦面、全麦面包、糙米饭
- 蛋白质类：鸡蛋、鸭蛋、鹅蛋、鸡胸肉、鸡腿、鸡翅、牛肉、羊肉、猪肉、鱼虾、虾仁、三文鱼、鳕鱼、龙利鱼、豆腐、豆浆、豆干、腐竹、牛奶、酸奶、奶酪
- 蔬菜类：白菜、青菜、菠菜、芹菜、韭菜、生菜、油麦菜、西兰花、菜花、黄瓜、西红柿、冬瓜、南瓜、丝瓜、苦瓜、茄子、豆角、土豆、胡萝卜、白萝卜、洋葱、大蒜、辣椒
- 水果类：苹果、香蕉、橙子、橘子、柚子、草莓、蓝莓、葡萄、西瓜、芒果、菠萝、猕猴桃、火龙果、梨、桃子、李子、樱桃
- 饮品类：水、茶、咖啡、牛奶、酸奶、豆浆、果汁、可乐、雪碧、奶茶、果茶、啤酒、白酒、红酒、碳酸饮料
- 零食类：薯片、饼干、巧克力、糖果、坚果、瓜子、花生、冰淇淋、雪糕、蛋糕、面包、蛋挞、泡芙、蛋黄派
- 外卖快餐类：麻辣烫、麻辣香锅、火锅、烧烤、炸鸡、汉堡、薯条、盖浇饭、炒饭、炒面、螺蛳粉、米线、凉皮、肉夹馍
- 烘焙甜品类：蛋糕、面包、饼干、蛋挞、泡芙、蛋黄派、提拉米苏、慕斯、芝士蛋糕
句式锚点（完整版）："我今天吃了 X"、"早上/中午/晚上吃了 X"、"刚才吃了 X"、"刚刚吃了 X"、"喝了一杯 X"、"喝了一瓶 X"、"点了一份 X"、"买了 X"、"做了 X"、"煮了 X"、"炒了 X"、"烤了 X"、"蒸了 X"、"煎了 X"、"炸了 X"、"炖了 X"、"拌了 X"、"炫了一碗 X"、"啃了个 X"、"嗦了碗 X"、"干了杯 X"、"造了一堆 X"、"吃了顿 X"、"吃了个 X"、"吃了块 X"、"吃了片 X"、"吃了根 X"、"吃了串 X"
特殊规则：
1. 包含数量词自动提取分量（一碗、一杯、一个、一份、一两、一斤）
2. 提到"偷吃"、"放纵"、"欺骗餐"、"破戒"自动加对应标签
3. 否定句（"没吃 X"、"没喝 X"、"不想吃 X"）绝对不沉淀
4. 疑问句（"吃什么好？"、"能吃 X 吗？"）不沉淀
5. 提到"明天吃 X"、"以后吃 X"不沉淀

### 2.1.2 运动记录（type: exercise_record）
动词锚点：跑、走、跳、练、做、游、骑、爬、打、踢、跳、撸、跟练、打卡、运动、锻炼、健身
名词锚点（分类完整版）：
- 有氧运动：跑步、快走、散步、慢跑、快跑、游泳、骑行、跳绳、跳操、HIIT、椭圆机、动感单车、爬楼梯、爬山
- 力量训练：撸铁、举铁、哑铃、杠铃、俯卧撑、仰卧起坐、平板支撑、深蹲、弓步、硬拉、卧推、引体向上、臀桥、卷腹
- 拉伸放松：瑜伽、普拉提、拉伸、筋膜放松、冥想
- 球类运动：篮球、足球、羽毛球、乒乓球、网球、排球
- 日常活动：走路、散步、逛街、做家务、打扫卫生
句式锚点（完整版）："我今天跑了 X 公里"、"走了 X 步"、"走了 X 公里"、"练了 X 分钟 X"、"做了 X 组 X"、"游了 X 米"、"骑了 X 公里"、"爬了 X 层楼"、"爬了 X 山"、"打了 X 小时 X"、"踢了 X 小时 X"、"跳了 X 分钟绳"、"跳了 X 分钟操"、"跟练了帕梅拉 X 分钟"、"跟练了刘畊宏 X 分钟"、"撸铁 X 小时"、"健身 X 小时"、"运动了 X 分钟"、"锻炼了 X 小时"、"做了 X 个俯卧撑"、"做了 X 个仰卧起坐"、"平板支撑了 X 分钟"、"深蹲了 X 个"
特殊规则：
1. 提取时长和强度（慢、中、快、低强度、中强度、高强度）
2. 提到"偷懒"、"没坚持"、"只做了 X 分钟"自动加备注
3. 否定句（"没运动"、"没锻炼"）不沉淀
4. 疑问句（"做什么运动好？"）不沉淀

### 2.1.3 身体数据记录（type: body_data）
动词锚点：称、量、测、重、围、量了、测了、称了
名词锚点：体重、体脂、体脂率、肌肉量、内脏脂肪、腰围、臀围、胸围、大腿围、小腿围、臂围、BMI
句式锚点（完整版）："今天体重 X 斤"、"今天称了 X 斤"、"体重 X 公斤"、"体脂率 X%"、"腰围 X 厘米"、"腰围 X 尺"、"臀围 X 厘米"、"胸围 X 厘米"、"大腿围 X 厘米"、"测了体脂 X%"、"量了腰围 X"
特殊规则：
1. 自动计算与上次记录的差值
2. 识别里程碑（减 5 斤、减 10 斤、达到目标体重）自动触发庆祝
3. 否定句（"没称体重"）不沉淀

### 2.1.4 生活习惯记录（type: habit）
动词锚点：喝、睡、拉、起、醒、喝了、睡了、起了、醒了
名词锚点：水、觉、厕所、床、厕所、大便、小便、睡眠
句式锚点（完整版）："今天喝了 X 杯水"、"喝了 X 毫升水"、"睡了 X 小时"、"昨晚睡了 X 小时"、"早上 X 点起的"、"早上 X 点醒的"、"今天拉了 X 次"、"排便了"
特殊规则：
1. 喝水自动同步到喝水记录进度条
2. 睡眠不足 6 小时自动给出建议
3. 否定句（"没喝水"、"没睡好"）不沉淀

## 2.2 个人资产类信号锚点（准确率要求≥85%，默认待确认）

### 2.2.1 减脂食谱（type: recipe）
触发信号："这个食谱很好用"、"这个做法绝了"、"低卡又好吃"、"分享一个超赞的减脂餐"、"我今天做了 X，超好吃"、"推荐你们试试 X"、"这个 X 这么做巨掉秤"、"给你们分享个减脂餐做法"、"食材：X、Y、Z，做法：..."、"X 的做法很简单，先... 再..."、"这个热量只有 X 大卡"、"减脂期也能吃的 X"、"无油版 X 做法"、"低卡版 X 教程"
排除信号："这个食谱不好吃"、"这个做法太难了"、"有人会做 X 吗？"、"X 怎么做？"、"求 X 的做法"、"有没有好吃的 X 推荐？"、"只提到单个食材没有做法"

### 2.2.2 减肥方法（type: method）
触发信号："我发现 X 很有用"、"我发现一个绝招"、"亲测 X 最有效"、"亲测掉秤最快的方法"、"这么做真的有用"、"我是这样瘦下来的"、"总结一下我的减肥经验"、"分享我的减肥方法"、"给大家一个建议"、"千万不要 X，要 Y"、"我之前就是 X，后来改成 Y 就瘦了"、"坚持 X 真的会有效果"、"最重要的是 X"、"减肥的关键是 X"
排除信号："这个方法没用"、"X 有用吗？"、"有人试过 X 吗？"、"求推荐减肥方法"、"怎么才能瘦下来？"、"引用别人的方法但自己没试过"

### 2.2.3 踩坑教训（type: pitfall）
触发信号："千万不要 X"、"千万别做 X"、"我之前踩过 X 的坑"、"大家不要学我"、"我就是因为 X 才胖的"、"我就是因为 X 才不掉秤"、"后悔做了 X"、"早知道就不 X 了"、"血的教训"、"踩过最大的坑就是 X"、"避坑指南：不要 X"、"提醒大家不要 X"
排除信号："别人踩过 X 的坑"、"有没有人踩过 X 的坑？"、"听说 X 是个坑"

## 2.3 情感成长类信号锚点（准确率要求≥80%）

### 2.3.1 励志金句（type: quote）
情绪锚点：积极、坚定、鼓舞、自信、充满希望
句式锚点："只要坚持就会有收获"、"今天也是努力的一天"、"我一定能瘦下来"、"加油，坚持就是胜利"、"没有瘦不下来的胖子"、"自律给我自由"、"付出总会有回报"、"今天的努力是明天的收获"、"离目标又近了一步"、"再坚持一下就成功了"、"你可以的"、"我能行"、"不要放弃"、"坚持住"

### 2.3.2 心路感悟（type: insight）
情绪锚点：感慨、反思、顿悟、释然、成长
句式锚点："原来减肥最重要的是 X"、"这段时间我明白了 X"、"减肥其实是和自己和解"、"原来不是不能吃，是要适量"、"减肥改变的不只是体重"、"慢慢发现 X 比什么都重要"、"原来坚持下来是这种感觉"、"以前总想着快速瘦，现在才明白..."、"减肥教会了我 X"、"这一路走来，我学会了 X"

### 2.3.3 情绪记录（type: emotion）
情绪锚点：
- 开心/兴奋："今天好开心"、"太开心了"、"太棒了"、"激动死了"、"太惊喜了"、"终于瘦了"、"掉秤了"、"破平台期了"
- 焦虑/烦躁："有点焦虑"、"好焦虑"、"烦死了"、"好烦"、"心态崩了"、"emo 了"、"压力好大"、"好想吃东西"
- 愧疚/自责："好愧疚"、"又偷吃了"、"又破戒了"、"我怎么这么没用"、"又摆烂了"、"今天又没忍住"、"对不起自己"
- 挫败/难过："好难过"、"太难受了"、"又失败了"、"怎么都不掉秤"、"平台期好难熬"、"坚持不下去了"、"不想减了"
句式锚点："今天好开心，瘦了 X 斤"、"太激动了，终于破平台期了"、"有点焦虑，想吃东西"、"心态崩了，今天偷吃了"、"好愧疚，又破戒了"、"好难过，体重又涨了"、"平台期好难熬，想放弃了"、"今天摆烂了，什么都没做"

## 2.4 其他类别信号锚点

### 里程碑类
触发信号："我减了 X 斤了"、"已经坚持 X 天了"、"今天是减肥第 X 天"、"终于达到目标了"、"减肥成功了"、"完成了第一个小目标"

### 计划目标类
触发信号："我明天要 X"、"明天开始 X"、"这周的目标是 X"、"我计划 X"、"打算 X"、"下周日吃欺骗餐"、"周末去吃火锅"

### 问题咨询类
触发信号："为什么我不掉秤？"、"X 热量高吗？"、"减肥能吃 X 吗？"、"怎么做 X？"、"为什么会平台期？"、"运动完腿疼怎么办？"

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
