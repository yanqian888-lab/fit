/**
 * 全能助手 Agent（理性层 + 执行层）
 * 职责：身体指标计算、营养评估、运动方案、专业问题解答
 * 模型：腾讯混元 Hy3（备用：fit-Backup）
 */
const { db } = require('../../db');
const { callWithPrompt } = require('../aiClient');
const promptService = require('../promptService');
const petService = require('../petService');
const webSearchService = require('../webSearchService');
const nutritionService = require('../nutritionService');
const { safeJsonParse } = require('../../utils/safeJson');
const { getChinaDateStr } = require('../../utils/chinaTime');

/**
 * 调用全能助手 Agent
 */
async function callHelperAgent(question, userInfo = {}, partnerInfo = {}) {
  // 数据库表使用内部自增 id 作为 user_id，优先用 id（而不是对外 6 位 user_id）
  const userId = userInfo.id || userInfo.user_id;

  const genderMap = { 0: '未知', 1: '男', 2: '女' };
  const ageVal = userInfo.age > 0 ? userInfo.age : null;
  const activityFactor = userInfo.bmr && userInfo.tdee
    ? Number((userInfo.tdee / userInfo.bmr).toFixed(2))
    : null;

  const userInfoStr = JSON.stringify({
    gender: genderMap[userInfo.gender] || '未知',
    age: ageVal || '未知',
    height: userInfo.height || '未知',
    current_weight: userInfo.current_weight || '未知',
    target_weight: userInfo.target_weight || '未知',
    bmr: userInfo.bmr || '未知',
    tdee: userInfo.tdee || '未知',
    daily_calorie_target: userInfo.daily_calorie_target || '未知',
    calorie_deficit: userInfo.calorie_deficit || '未知',
    activity_factor: activityFactor || '未知（已按轻度活动1.375估算）'
  }, null, 2);

  // 获取/刷新用户今天的营养数据（在构建问题时实时查询，确保包含最新沉淀记录）
  let todayNutrition = null;
  let todayFoods = [];
  let todayExercises = [];
  if (userId) {
    try {
      todayNutrition = getTodayNutrition(userId);
      todayFoods = getTodayFoods(userId);
      todayExercises = getTodayExercises(userId);
    } catch (e) {
      console.error('获取今日营养数据失败:', e.message);
    }
  }

  // 优先本地计算常见指标（需要先拿到今日运动记录，确保和记录一致）
  const localAnswer = tryLocalCalculation(question, userInfo, todayExercises);
  if (localAnswer) {
    return localAnswer;
  }

  // 构建包含今日营养数据的问题（实时查询数据库）
  let enhancedQuestion = question;
  const needsFoodData = /(吃|喝|食物|酸奶|饭|菜|肉|水果|饮料|晚餐|午餐|早餐|加餐|零食|热量|卡路里|千卡|摄入|吃了多少|总计|汇总|算|脂肪|蛋白质|碳水|营养)/.test(question);
  const needsExerciseData = /(运动|训练|健身|哑铃|杠铃|跑步|游泳|跳绳|骑车|骑行|瑜伽|帕梅拉|周六野|刘畊宏|肩背|胸|腿|臀|腹|有氧|无氧|HIIT|Tabata|拉伸|深蹲|俯卧撑|平板支撑|卷腹|开合跳|波比跳|快走|慢跑|爬楼|爬山|登山|动感单车|椭圆机|划船机|壶铃|TRX|战绳|拳击|打拳|搏击|尊巴|舞蹈|跳操|健身操|有氧操|力量训练|体能训练|功能性训练|核心训练|臀腿训练|背部训练|肩部训练|手臂训练|胸部训练|腹部训练|拉伸训练|热身|冷身|放松|按摩|泡沫轴|筋膜枪|运动康复|体能测试|体测|马拉松|半程马拉松|越野跑|接力跑|冲刺跑|折返跑|高抬腿|登山跑|俄罗斯转体|臀桥|桥式|死虫式|鸟狗式|侧平板|倒立|手倒立|单腿硬拉|箭步蹲|保加利亚蹲|靠墙静蹲|马步|引体向上|仰卧起坐|弹力带|阻力带|拉力带|8字拉力器|开肩美背|哑铃弯举|哑铃推举|哑铃飞鸟|哑铃划船|哑铃深蹲|哑铃硬拉|哑铃侧平举|哑铃前平举|杠铃深蹲|杠铃硬拉|杠铃卧推|杠铃划船|杠铃推举|杠铃弯举|杠铃臀推|相扑硬拉|罗马尼亚硬拉|器械训练|器械推胸|器械划船|器械夹胸|腿举|腿弯举|腿屈伸|坐姿划船|高位下拉|史密斯机|龙门架|蝴蝶机|推胸机|壶铃摇摆|壶铃抓举|壶铃深蹲|壶铃推举|土耳其起立|TRX划船|TRX深蹲|TRX俯卧撑|悬挂训练|甩绳|药球|沙袋|轮胎翻|农夫行走|雪橇推|攀岩|攀冰|溯溪|漂流|滑雪|滑冰|轮滑|滑板|羽毛球|乒乓球|网球|排球|篮球|足球|棒球|垒球|高尔夫球|保龄球|台球|门球|壁球|橄榄球|曲棍球|冰球|手球|水球|马球|藤球|毽球|射箭|射击|击剑|马术|赛马|赛艇|皮划艇|帆船|帆板|冲浪|潜水|浮潜|深潜|跳水|水球|花样游泳|体操|艺术体操|蹦床|技巧|健美操|啦啦操|体育舞蹈|街舞|霹雳舞|爵士舞|芭蕾舞|现代舞|民族舞|古典舞|拉丁舞|国标舞|交谊舞|摇摆舞|广场舞|健身舞|燃脂舞|减脂舞|太极|气功|普拉提|冥想|正念|呼吸训练|产后恢复|盆底肌训练|凯格尔运动|腹直肌修复|办公室运动|椅子瑜伽|坐姿运动|床上运动|睡前拉伸|晨间唤醒|午休运动|碎片化运动|微运动|办公室微运动)/i.test(question);
  const needsBodyContext = /(体重|掉秤|涨秤|没瘦|徘徊|不动|平台期|体脂|腰围|臀围|胸围|腿围|臂围|BMI|进度|最近.*体重|这个体重|体重下|体重上)/i.test(question);

  if (needsFoodData) {
    // 再次刷新，确保沉淀已完成
    if (userId) {
      try {
        const latestNutrition = getTodayNutrition(userId);
        if (latestNutrition) todayNutrition = latestNutrition;
        const latestFoods = getTodayFoods(userId);
        if (latestFoods) todayFoods = latestFoods;
      } catch (e) {
        console.error('刷新今日营养数据失败:', e.message);
      }
    }
    if (todayNutrition) {
      const foodList = todayFoods.length > 0
        ? todayFoods.map(f => {
            const macros = [];
            if ((f.protein || 0) > 0) macros.push(`蛋白质${Math.round(f.protein)}g`);
            if ((f.carb || 0) > 0) macros.push(`碳水${Math.round(f.carb)}g`);
            if ((f.fat || 0) > 0) macros.push(`脂肪${Math.round(f.fat)}g`);
            const macroStr = macros.length > 0 ? `（${macros.join(' / ')}）` : '';
            // weight 字段固定是克数，unit 属于 quantity（如 1袋）；拼接时必须分开，避免把 100g 误读成 100袋
            const weightNum = parseFloat(f.weight) || 0;
            const qtyNum = parseFloat(f.quantity) || 0;
            const unitStr = f.unit || '';
            let amount = '';
            if (qtyNum > 0 && unitStr && unitStr !== 'g' && unitStr !== '克') {
              amount = weightNum > 0 ? `${qtyNum}${unitStr}（${weightNum}g）` : `${qtyNum}${unitStr}`;
            } else if (weightNum > 0) {
              amount = `${weightNum}g`;
            }
            return `- ${f.name}${amount ? ' ' + amount : ''}：约${Math.round(f.calorie || 0)}千卡${macroStr}`;
          }).join('\n')
        : '今日暂无食物记录。';
      const hasMacros = (todayNutrition.protein || 0) > 0 || (todayNutrition.carb || 0) > 0 || (todayNutrition.fat || 0) > 0;
      const macroLines = hasMacros
        ? `- 蛋白质：${Math.round(todayNutrition.protein)}g\n- 碳水：${Math.round(todayNutrition.carb)}g\n- 脂肪：${Math.round(todayNutrition.fat)}g`
        : '- 蛋白质/碳水/脂肪：当前食物库暂未提供这些数值，请勿编造';
      const recordedMeals = new Set(todayFoods.map(f => f.meal_time).filter(Boolean)).size;
      const mealCountText = recordedMeals === 0
        ? '今天暂无已记录的餐别'
        : `今天已记录 ${recordedMeals} 个餐别`;
      const lowIntakeWarningRule = recordedMeals < 2
        ? '【重要】今天仅记录了不到 2 个餐别，数据不完整，禁止判断“总摄入过低”或提醒用户热量不足，也禁止建议加餐/补充热量。只需回答用户当前问题即可。'
        : '【重要】今天已记录至少 2 个餐别，可以基于总摄入给出合理的饮食建议或热量提醒。';

      // 如果用户提到的饮品/食品不在今日记录和食物库中，且明显在询问热量/含糖情况，尝试联网检索热量（区分有糖/无糖）
      // 注意：联网搜索仅作为兜底，优先使用本地食物库；只有疑似包装饮品/品牌食品/带容量单位时才触发
      let webSearchBlock = '';
      const unknownFood = extractUnknownFoodQuery(question, todayFoods);
      const asksCalorieOrSugar = /(热量|卡路里|千卡|大卡|含糖|无糖|有糖|低糖|能喝|能吃|可以喝|可以吃|多少卡|胖不胖|减肥|减脂|热量高)/.test(question);
      if (unknownFood && asksCalorieOrSugar && shouldUseWebSearch(question, unknownFood)) {
        try {
          const searchQuery = `${question}（${unknownFood} 热量 含糖/无糖）`;
          const webResult = await webSearchService.searchNutrition(searchQuery);
          if (webResult) {
            webSearchBlock = `\n【网络检索参考】用户提到的“${unknownFood}”不在今日记录和食物库中，已从公开网络/营养资料检索到以下参考信息：\n${webResult}\n`;
          }
        } catch (e) {
          console.error('[callHelperAgent] 网络检索失败:', e.message);
        }
      }

      enhancedQuestion = `${question}

【系统数据】用户今天已记录的饮食数据（实时）：
- 总摄入热量：${Math.round(todayNutrition.intake)} kcal
${macroLines}
- 运动消耗：${Math.round(todayNutrition.burned)} kcal
- ${mealCountText}

${lowIntakeWarningRule}

今天已记录的食物明细（食物名后面的 g/个 是该食物的重量/数量，冒号后是热量）：
${foodList}
${webSearchBlock}
请基于以上实际记录数据回答，并严格遵守以下规则：
1. 总摄入热量的单位是千卡，不是克数，不要把总热量数字错当成某种食物的重量；也不要把用户说的重量（如"100克"）直接当成热量。
2. 如果用户提到的食物已在上方记录中，必须直接引用记录里的热量，禁止自行改数。
3. 如果不在记录中但上方附有【网络检索参考】，可基于检索参考给出估算热量（需区分有糖/无糖，并明确说明是估算）。
4. 如果不在记录中且没有检索参考，必须基于你的营养学知识和公开营养资料给出合理估算，明确标注"估算值"及简要依据；禁止回答"不知道""无法给出""无权威数据""无法估算"。
5. 同一条回复中严禁前后矛盾：禁止先说"无数据/无法估算"紧接着又给出具体热量数字。要么只给建议不给出数字，要么给出估算并明确标注估算。`;
    }
  }

  // 运动相关问题：补充今天已记录的运动明细，避免搭子回复与记录不一致
  if (needsExerciseData && userId) {
    try {
      const latestExercises = getTodayExercises(userId);
      if (latestExercises) todayExercises = latestExercises;
    } catch (e) {
      console.error('刷新今日运动数据失败:', e.message);
    }
    const exerciseList = todayExercises.length > 0
      ? todayExercises.map(e => `- ${e.name} ${e.duration || ''}分钟：${Math.round(e.calorie || 0)}千卡`).join('\n')
      : '今日暂无运动记录。';
    const totalBurned = todayExercises.reduce((sum, e) => sum + (e.calorie || 0), 0);

    enhancedQuestion = `${enhancedQuestion}

【系统数据】用户今天已记录的运动数据（实时）：
- 总运动消耗：${Math.round(totalBurned)} kcal
- 运动明细：
${exerciseList}

请基于以上实际记录数据回答。如果用户提到的运动/训练已在上方记录中，必须直接引用记录里的消耗数值，不要再按 MET 或网络估算覆盖；如果不在记录中但运动库（exercise_db）中有匹配项，请使用运动库的 MET/每小时热量计算；如果都没有，才可给出估算范围并明确说明是估算。`;
  }

  // 体重/平台期/进度类问题：补充近几天的真实记录，避免泛泛而谈
  if (needsBodyContext && userId) {
    try {
      const bodyContext = getRecentBodyContext(userId, 7);
      // 基于已拼好的饮食/运动上下文追加，不能覆盖丢弃
      enhancedQuestion = `${enhancedQuestion}\n\n${bodyContext}`;
    } catch (e) {
      console.error('获取近期身体数据失败:', e.message);
    }
  }

  const modeMap = {
    gentle: '温柔鼓励型',
    strict: '严格监督型',
    tease: '毒舌模式'
  };
  const partnerMode = modeMap[partnerInfo.mode] || '温柔鼓励型';

  const pet = userId ? petService.getPet(userId) : null;
  const petPersona = pet
    ? `你同时以宠物形象出现在用户的小窝里，宠物名叫${pet.name || '搭搭'}，是一只${pet.species === 'red_panda' ? '小熊猫' : (pet.species || '小熊猫')}。你和小窝里的宠物是同一只搭搭，专业回复中同样以"我"自称，禁止把它说成另一个角色。`
    : '你同时以宠物形象出现在用户的小窝里，是一只陪伴用户减肥的小熊猫。你和小窝里的宠物是同一只搭搭，专业回复中同样以"我"自称，禁止把它说成另一个角色。';

  const systemPrompt = promptService.getPrompt('helper_agent', {
    user_info: userInfoStr,
    partner_mode: partnerMode,
    pet_persona: petPersona
  });

  try {
    console.log(`[callHelperAgent] 开始调用，问题: ${question.substring(0, 50)}...`);
    const response = await Promise.race([
      callWithPrompt(
        'helper_agent',
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'system',
            content: '补充规则：1）当用户询问的饮品/食品不在今日记录和食物库中时，优先使用用户消息中附带的【网络检索参考】数据给出估算热量，并区分有糖/无糖版本；如果没有附带检索参考，必须基于你的营养学知识和公开营养资料给出合理估算，明确标注"估算值"，禁止回答"不知道""无法给出""无数据"。2）同一条回复中严禁前后矛盾：禁止先说"无数据/无法估算"紧接着又给出具体热量数字；要么只给建议不给出数字，要么给出估算并明确标注估算。3）APP 目前没有睡眠、盐分摄入、水肿记录功能，回答中不要建议用户记录或分析睡眠、盐分、水肿相关内容。4）当前用户信息中已提供 BMR、TDEE、每日热量目标等数据时，请直接基于这些数据进行分析和建议，不要再要求用户补充性别、年龄、活动水平等基础信息。'
          },
          { role: 'user', content: enhancedQuestion }
        ],
        { temperature: 0.5, max_tokens: 8000 }
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('全能助手 Agent 调用超时')), 120000)
      )
    ]);
    console.log('[callHelperAgent] 调用成功');
    let reply = stripThinkingTags(response.choices[0].message.content || '这个问题我暂时没有思路，你换个问法试试？');
    
    // 修正回复中的热量数值，确保与数据库记录一致（修正前再刷新一次最新数据）
    if (userId) {
      try {
        const latestNutrition = getTodayNutrition(userId);
        if (latestNutrition) todayNutrition = latestNutrition;
      } catch (e) {
        console.error('修正前刷新今日营养数据失败:', e.message);
      }
    }
    if (todayNutrition) {
      const explicitMealSum = extractExplicitCalories(question);
      const corrected = correctCalorieNumbers(reply, todayNutrition, question, explicitMealSum, todayFoods);
      if (corrected !== reply) {
        console.log('[callHelperAgent] 热量数值已修正:', reply.substring(0, 100), '→', corrected.substring(0, 100));
        reply = corrected;
      }
    }
    
    return reply;
  } catch (error) {
    console.error('全能助手 Agent 调用失败:', error.message);
    return '哎呀，我这边算不过来了，你等一下再问好不好？';
  }
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
 * 修正回复中的热量数值，确保与数据库记录一致
 * 防止LLM自行计算导致数值错误
 */
/**
 * 从问题中提取用户明确写出的热量数字并求和
 */
function extractExplicitCalories(question) {
  if (!question) return 0;
  const regex = /(\d+(?:\.\d+)?)\s*(千卡|kcal|大卡|卡路里)/gi;
  let sum = 0;
  let match;
  while ((match = regex.exec(question)) !== null) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) sum += val;
  }
  return Math.round(sum);
}

function correctCalorieNumbers(reply, todayNutrition, question, explicitMealSum, todayFoods = []) {
  if (!todayNutrition) return reply;

  const intake = Math.round(todayNutrition.intake);
  const burned = Math.round(todayNutrition.burned);
  const protein = Math.round(todayNutrition.protein);
  const carb = Math.round(todayNutrition.carb);
  const fat = Math.round(todayNutrition.fat);

  let corrected = reply;

  // 取匹配片段中最后一个“数字+热量单位”，即汇总词后面的那个数字
  function getLastNumberInMatch(match) {
    const nums = match.match(/(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi);
    if (!nums || nums.length === 0) return null;
    const m = nums[nums.length - 1].match(/(\d{2,4})/);
    return m ? parseInt(m[1]) : null;
  }

  function replaceLastNumberInMatch(match, target) {
    const nums = match.match(/(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi);
    if (!nums || nums.length === 0) return match;
    const numStr = nums[nums.length - 1].match(/(\d{2,4})/)[1];
    const idx = match.lastIndexOf(numStr);
    if (idx === -1) return match;
    return match.slice(0, idx) + String(target) + match.slice(idx + numStr.length);
  }

  // 1. 修正总摄入热量：只修正明确指“今日/今天总摄入”的汇总数字，避免误改单食物热量
  // 例如“今日总摄入约 632 千卡”→改成系统真实值；但“200克黄瓜总热量约 30 千卡”不应被改
  const totalPatterns = [
    /(?:今日|今天|当前|目前)[^。；\n]*?总摄入[^。；\n]*?(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi,
    /总摄入[^。；\n]*?(?:约|为|是|大概|大约|约莫)?\s*(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi,
    /(?:今日|今天|当前|目前)[^。；\n]*?累计摄入[^。；\n]*?(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi,
    /(?:今日|今天|当前|目前)[^。；\n]*?总热量[^。；\n]*?(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi,
  ];

  for (const pattern of totalPatterns) {
    corrected = corrected.replace(pattern, (match) => {
      if (/缺口|这顿|这餐|这些|单根|单个|每|克/.test(match)) return match;
      const originalNum = getLastNumberInMatch(match);
      if (originalNum === null) return match;
      if (Math.abs(originalNum - intake) > 20) {
        return replaceLastNumberInMatch(match, intake);
      }
      return match;
    });
  }

  // 1.5 修正单个食物热量：防止模型把今日总摄入错填成某个食物的热量
  // 只处理“食物名...数字+热量单位”且数字等于总摄入的片段，跳过含汇总词的句子
  if (Array.isArray(todayFoods) && todayFoods.length > 0 && intake > 0) {
    for (const food of todayFoods) {
      const foodCalorie = Math.round(food.calorie || 0);
      if (!foodCalorie || !food.name) continue;
      const escapedName = food.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const foodPattern = new RegExp(`${escapedName}[^。；\\n]*?(\\d{2,4})\\s*(kcal|千卡|大卡|卡)`, 'gi');
      corrected = corrected.replace(foodPattern, (match, numStr) => {
        if (/今日|今天|当前|目前|累计|总摄入|总热量|运动消耗/.test(match)) return match;
        const num = parseInt(numStr, 10);
        if (num === intake && Math.abs(num - foodCalorie) > 20) {
          return match.replace(numStr, String(foodCalorie));
        }
        return match;
      });
    }
  }

  // 2. 修正营养素：匹配"分别为A、B、Cg"格式，按顺序替换为数据库值
  const respectivelyMatch = corrected.match(/分别为[^(]*?(\d{1,3})\s*g\s*、[^(]*?(\d{1,3})\s*g\s*、[^(]*?(\d{1,3})\s*g/i);
  if (respectivelyMatch) {
    const nums = [parseInt(respectivelyMatch[1]), parseInt(respectivelyMatch[2]), parseInt(respectivelyMatch[3])];
    const targets = [protein, carb, fat];
    let newStr = '分别为';
    for (let i = 0; i < 3; i++) {
      if (Math.abs(nums[i] - targets[i]) >= 3) {
        newStr += targets[i] + 'g';
      } else {
        newStr += nums[i] + 'g';
      }
      if (i < 2) newStr += '、';
    }
    corrected = corrected.replace(respectivelyMatch[0], newStr);
  }

  // 3. 修正运动消耗（只修正明确的“运动消耗”，避免误改 TDEE、BMR、日常活动消耗等估算值）
  const burnPattern = /(?:今日|今天)?运动消耗[^。；\n]*?(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi;
  corrected = corrected.replace(burnPattern, (match) => {
    const originalNum = getLastNumberInMatch(match);
    if (originalNum === null) return match;
    if (Math.abs(originalNum - burned) > 20) {
      return replaceLastNumberInMatch(match, burned);
    }
    return match;
  });

  // 4. 修正"这顿/这餐/这些食物"的热量：使用用户明确给出的数字之和
  // 限制在同一句话内（不超过句号/分号/换行），避免误改"包含这顿的今日总摄入"
  if (explicitMealSum > 0) {
    const mealPatterns = [
      /(这顿|这餐|这些食物|这一顿|这顿饭|这份餐|以上食物|这一餐)[^。；\n]*?(热量|总热量|卡路里|千卡|大卡)[^。；\n]*?(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi,
      /(这顿|这餐|这些食物|这一顿|这顿饭|这份餐|以上食物|这一餐)[^。；\n]*?(一共|总计|加起来|合计|总共)[^。；\n]*?(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi,
    ];
    for (const pattern of mealPatterns) {
      corrected = corrected.replace(pattern, (match) => {
        // 如果匹配到的文本里出现了"今日/今天/累计/总摄入"，说明是全天汇总，不要改
        if (/今日|今天|累计|总摄入/.test(match)) return match;
        const originalNum = getLastNumberInMatch(match);
        if (originalNum === null) return match;
        if (Math.abs(originalNum - explicitMealSum) > 20) {
          return replaceLastNumberInMatch(match, explicitMealSum);
        }
        return match;
      });
    }
  }

  // 5. 兜底：如果回复里出现了与系统总摄入或用户明确数字之和偏差很大的孤立热量数值，也进行修正
  if (explicitMealSum > 0) {
    const looseTotalPattern = /(总热量|热量一共|一共|总计|合计|加起来)[^。；\n]*?(\d{2,4})\s*(kcal|千卡|大卡|卡)/gi;
    corrected = corrected.replace(looseTotalPattern, (match) => {
      // 同样跳过全天汇总表述
      if (/今日|今天|累计|总摄入/.test(match)) return match;
      const originalNum = getLastNumberInMatch(match);
      if (originalNum === null) return match;
      if (Math.abs(originalNum - explicitMealSum) > 20 && Math.abs(originalNum - intake) > 20) {
        // 问题里明确给了数字，优先按用户给出的数字之和修正
        return replaceLastNumberInMatch(match, explicitMealSum);
      }
      return match;
    });
  }

  return corrected;
}

/**
 * 判断是否应该触发联网搜索。
 * 原则：本地食物库优先，只有明显是包装饮品/品牌食品/带容量单位时才使用 web_search 兜底。
 */
function shouldUseWebSearch(question, unknownFood) {
  if (!unknownFood) return false;
  const q = question || '';
  const f = unknownFood || '';

  // 1. 带容量/包装单位（ml/L/瓶/罐/杯/包/袋/盒）
  const packagedUnitRe = /\d\s*(ml|mL|毫升|L|升|瓶|罐|杯|包|袋|盒)/;
  if (packagedUnitRe.test(q)) return true;

  // 2. 常见饮品/即饮食品关键词（汁/饮/茶/奶/酸奶/咖啡/酒/水/汽水/苏打/气泡/美式/拿铁/奶茶/可乐/雪碧等）
  const drinkRe = /汁|饮|茶|奶|酸奶|咖啡|酒|水|汽水|苏打|气泡|美式|拿铁|摩卡|奶茶|可乐|雪碧|芬达|脉动|电解质|乌龙茶|柠檬水|红牛|东鹏|王老吉|加多宝|椰汁|旺仔|娃哈哈|AD钙|营养快线|椰树|红牛|脉动|宝矿力|佳得乐|气泡水|电解质水|NFC|鲜榨|浓缩|瓶装|罐装|盒装|袋装|杯装/;
  if (drinkRe.test(f)) return true;

  // 3. 常见连锁/品牌关键词（茶饮、咖啡、便利店、快餐品牌）
  const brandRe = /喜茶|瑞幸|星巴克|霸王茶姬|蜜雪冰城|茶百道|奈雪|乐乐茶|沪上阿姨|书亦|古茗|茶颜悦色|益禾堂|CoCo|一点点|肯德基|麦当劳|汉堡王|赛百味|便利店|罗森|全家|7-11|喜市多|美宜佳/;
  if (brandRe.test(q)) return true;

  // 4. 兜底：用户明显在问热量/营养/能不能吃/减脂相关，且该食物不在库中，一律尝试联网检索
  const asksCalorieOrDiet = /(热量|卡路里|千卡|大卡|含糖|无糖|有糖|低糖|能喝|能吃|可以喝|可以吃|多少卡|胖不胖|减肥|减脂|热量高|营养|脂肪|蛋白质|碳水)/.test(q);
  if (asksCalorieOrDiet) return true;

  return false;
}

/**
 * 从用户问题中提取可能不在今日记录/食物库中的饮品/食品名称
 * 仅用于触发联网热量检索
 */
function extractUnknownFoodQuery(question, todayFoods = []) {
  if (!question) return null;
  const normalized = question.replace(/[，。！？；、,.!?;]/g, ' ');
  const candidates = new Set();

  // 数量+单位+名称（如：500ml羽衣甘蓝汁、一杯美式）
  const unitAfterRe = /(\d+(?:\.\d+)?)\s*(ml|mL|毫升|L|升|g|克|kg|千克|个|杯|瓶|罐|份|碗|袋|包|盒|只|片|支|根|条|粒|颗|口)\s*([\u4e00-\u9fa5a-zA-Z]{2,})/g;
  // 名称+数量+单位（如：羽衣甘蓝汁500ml）
  const unitBeforeRe = /([\u4e00-\u9fa5a-zA-Z]{2,})\s*(\d+(?:\.\d+)?)\s*(ml|mL|毫升|L|升|g|克|kg|千克|个|杯|瓶|罐|份|碗|袋|包|盒|只|片|支|根|条|粒|颗|口)/g;
  // 量词+名称（如：一大碗卤煮、一份黄焖鸡、一只烤鸡；注意不含数字）
  const portionRe = /(?:一|两|几|半|大|小|中)?\s*(?:份|碗|盘|个|只|杯|瓶|罐|袋|包|盒|根|条|片|块|勺)\s*([\u4e00-\u9fa5a-zA-Z]{2,})/g;
  // 常见饮品/食品关键词（无数量时也尝试）
  const drinkRe = /([\u4e00-\u9fa5]{2,}(?:汁|饮|茶|奶|酸奶|咖啡|酒|水|汽水|苏打|气泡|美式|拿铁|摩卡|果汁|奶茶))/g;

  let m;
  while ((m = unitAfterRe.exec(normalized)) !== null) candidates.add(m[3]);
  while ((m = unitBeforeRe.exec(normalized)) !== null) candidates.add(m[1]);
  while ((m = portionRe.exec(normalized)) !== null) candidates.add(m[1]);
  while ((m = drinkRe.exec(normalized)) !== null) candidates.add(m[1]);

  const stopWords = new Set([
    '今天','现在','这个','那个','这些','那些','多少','热量','卡路里','千卡','大卡',
    '含糖','无糖','有糖','糖分','蛋白质','脂肪','碳水','摄入','食物','饮品','饮料'
  ]);
  const prefixNoise = /^(的|了|吗|呢|吧|啊|哦|嗯|喂|是|有|吃|喝|要|想|问|算|约|大概|大约|差不多|可能|应该|建议|推荐|怎么|如何|什么|多少|热量|卡路里|千卡|大卡|含糖|无糖|有糖|纯|鲜|现|一杯|一瓶|一碗|一份|一个|一包|一袋|一盒|一罐|一支|一根|一条|一片|一只)/;
  const suffixNoise = /(的|了|吗|呢|吧|啊|哦|嗯|热量|卡路里|千卡|大卡|含糖|无糖|有糖|多少)$/;

  for (const raw of candidates) {
    let cleaned = raw.replace(prefixNoise, '').replace(suffixNoise, '').trim();
    if (!cleaned || cleaned.length < 2 || stopWords.has(cleaned) || /^\d+$/.test(cleaned)) continue;

    // 是否已在今日记录中
    const inToday = todayFoods.some(f => f.name && (f.name.includes(cleaned) || cleaned.includes(f.name)));
    if (inToday) continue;

    // 是否在食物库中
    const inDb = nutritionService.getFoodNutrition(cleaned);
    if (inDb) continue;

    return cleaned;
  }
  return null;
}

/**
 * 尝试本地计算
 */
function tryLocalCalculation(question, userInfo, todayExercises = []) {
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

  // 基础代谢 BMR
  if (q.includes('基础代谢') || q.includes('bmr')) {
    if (!weight || !height || !age || !gender) return null;
    const genderText = gender === 1 ? '男' : '女';
    const genderOffset = gender === 1 ? 5 : -161;
    const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
    const roundedBmr = Math.round(bmr);
    return `你的基础代谢（BMR）计算过程如下：\n\n` +
      `采用 Mifflin-St Jeor 公式（目前国际上最常用的 BMR 估算公式）：\n` +
      `${genderText}性：BMR = 10×体重(kg) + 6.25×身高(cm) - 5×年龄 + ${genderOffset > 0 ? '+' : ''}${genderOffset}\n\n` +
      `代入你的数据：\n` +
      `= 10×${weight} + 6.25×${height} - 5×${age} ${genderOffset > 0 ? '+' : ''}${genderOffset}\n` +
      `= ${10 * weight} + ${(6.25 * height).toFixed(2)} - ${5 * age} ${genderOffset > 0 ? '+' : ''}${genderOffset}\n` +
      `≈ ${roundedBmr} 千卡/天\n\n` +
      `所以你的基础代谢大约是 ${roundedBmr} 千卡/天。这是维持生命活动最低需要的热量，实际摄入不建议长期低于这个数值。`;
  }

  // 热量缺口 / 每天吃多少：只回答“应该吃多少/摄入目标”类问题，不拦截“能减多少体重/脂肪”类问题
  if (/每天吃多少|每天应该吃多少|每天摄入多少|推荐摄入|建议吃多少|要吃多少卡|摄入目标/.test(q) && !/(一周|一个月|能减|减多少|掉多少|瘦多少|脂肪|体重).*?(多少|几斤|几公斤)/.test(q)) {
    if (!weight || !height || !age || !gender) return null;
    let bmr;
    if (gender === 1) {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    const tdee = bmr * 1.375;
    const target = tdee - 500;
    return `你的每日总消耗（TDEE，包含基础代谢、日常活动和运动消耗）约 ${Math.round(tdee)} 千卡。想健康减重，建议每天摄入 ${Math.round(target)} 千卡左右，制造约 500 千卡热量缺口。`;
  }

  // 每日总消耗 / TDEE / 加上运动系数的代谢
  if (q.includes('总消耗') || q.includes('tdee') || q.includes('每天代谢') || q.includes('每日代谢') ||
      (q.includes('代谢') && (q.includes('运动') || q.includes('活动') || q.includes('系数')))) {
    if (!weight || !height || !age || !gender) return null;
    let bmr;
    if (gender === 1) {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    const tdee = bmr * 1.375;
    return `你的每日总消耗（TDEE，按轻体力活动系数 1.375 计算，包含基础代谢、日常活动和基础运动）约 ${Math.round(tdee)} 千卡/天。其中基础代谢（BMR）约 ${Math.round(bmr)} 千卡，日常活动消耗约 ${Math.round(tdee - bmr)} 千卡。`;
  }

  // 热量、卡路里、千卡相关查询（需要系统数据的，跳过本地计算）
  if ((q.includes('今天') || q.includes('今日') || q.includes('总共') || q.includes('合计') || q.includes('汇总') || q.includes('记录')) &&
      (q.includes('热量') || q.includes('卡路里') || q.includes('千卡') || q.includes('摄入') || q.includes('吃了多少'))) {
    return null; // 跳过本地计算，让AI使用系统数据回答
  }

  // 运动热量消耗计算（基于MET值，科学准确）
  if ((q.includes('热量') || q.includes('消耗') || q.includes('卡路里') || q.includes('千卡')) && 
      (q.includes('运动') || q.includes('跑') || q.includes('走') || q.includes('游') || q.includes('跳') || q.includes('骑') || q.includes('练') || q.includes('帕梅拉') || q.includes('周六野') || q.includes('刘畊宏'))) {
    // 如果问题里同时提到饮食/食物，交给 LLM 统一回答，不要只算运动消耗
    const hasFood = /吃|喝|食物|早餐|午餐|晚餐|加餐|零食|饭|菜|肉|水果|鸡蛋|香蕉|酸奶|面包|米饭|面条|燕麦|牛奶|豆浆|咖啡|坚果|蔬菜|主食/.test(question);
    if (hasFood) return null;
    if (!weight) return null;

    // 先解析时长
    let duration = 30;
    const durationMatch = question.match(/(\d+)\s*(分钟|分|min|小时|h)/);
    if (durationMatch) {
      const num = parseInt(durationMatch[1]);
      if (durationMatch[2].includes('小时') || durationMatch[2].includes('h')) {
        duration = num * 60;
      } else {
        duration = num;
      }
    }
    const qLower = q.toLowerCase();

    // 1) 优先使用今天已记录的运动消耗，确保搭子回复和记录一致
    if (todayExercises && todayExercises.length > 0) {
      const recorded = todayExercises.find(e => {
        const name = String(e.name || '').toLowerCase();
        return name && (qLower.includes(name) || name.includes(qLower)) && Math.abs((e.duration || 0) - duration) <= 5;
      });
      if (recorded) {
        return `${recorded.name}${recorded.duration}分钟消耗 ${Math.round(recorded.calorie)} 千卡（与你今天的运动记录一致）。`;
      }
    }

    // 2) 查询运动库 exercise_db，有数据就按库里 MET 计算
    const dbExercise = getExerciseFromDb(question);
    if (dbExercise && dbExercise.met_value) {
      const met = parseFloat(dbExercise.met_value);
      const totalCalorie = Math.round(met * weight * (duration / 60) * 1.05);
      return `${dbExercise.exercise_name}${duration}分钟大约消耗 ${totalCalorie} 千卡（按运动库数据，MET值${met}计算）。`;
    }
    
    // 3) 兜底：本地MET值参考表
    const metValues = {
      // 拉伸/瑜伽
      '瑜伽': 2.5, '拉伸': 2.0, '普拉提': 3.0, '冥想': 1.5, '太极': 3.0,
      '美丽芭蕾': 3.0, '天鹅臂': 2.5, '天鹅腿': 3.0,
      '欧阳春晓': 4.5, '欧阳春晓直角肩': 3.0, '欧阳春晓少女背': 3.0,
      'Yuuka': 3.0, 'Yuuka瘦背': 2.5,
      
      // 低强度有氧
      '慢走': 2.5, '散步': 2.5, '走路': 3.0, '逛街': 2.5,
      '超慢跑': 3.5, '原地跑': 3.5,
      
      // 中等强度有氧
      '快走': 5.0, '健走': 5.5, '徒步': 5.0, '暴走': 5.5,
      '骑车': 5.5, '骑行': 5.5, '自行车': 5.0, '动感单车': 6.0,
      '椭圆机': 5.5, '划船机': 6.0, '磁控车': 4.5,
      '跳舞': 5.0, '广场舞': 4.5, '健身操': 5.0, '有氧操': 5.5,
      '搏击操': 6.0, '尊巴': 5.5, '街舞': 5.5, '拉丁舞': 5.0,
      '芭蕾舞': 5.0, '爵士舞': 5.0, '现代舞': 5.0, '民族舞': 4.5,
      '交谊舞': 4.0, '摇摆舞': 4.5, '燃脂舞': 5.5, '减脂舞': 5.5, '健身舞': 5.0,
      '爬楼梯': 6.0, '爬楼': 6.0,
      
      // 球类
      '乒乓球': 4.0, '台球': 3.0, '门球': 3.5,
      '排球': 4.0, '羽毛球': 5.5,
      '篮球': 6.5, '足球': 7.0, '网球': 7.0,
      '壁球': 8.0, '保龄球': 3.5, '高尔夫': 4.0,
      
      // 格斗
      '咏春': 4.5, '跆拳道': 8.0, '空手道': 8.0, '柔道': 8.0,
      '散打': 9.0, '拳击': 9.0, '打拳': 8.0, '泰拳': 10.0,
      
      // 跑步
      '跑步': 8.0, '慢跑': 7.0, '快跑': 10.0,
      '变速跑': 9.0, '间歇跑': 9.0, '长跑': 8.0,
      '短跑': 12.0, '冲刺跑': 12.0,
      '夜跑': 8.0, '晨跑': 8.0, '越野跑': 9.0,
      '跑步机': 8.0, '爬坡跑': 10.0,
      
      // 游泳
      '游泳': 8.0, '蛙泳': 8.0, '自由泳': 9.0, '仰泳': 7.0, '蝶泳': 10.0,
      '水中漫步': 4.5, '水中有氧': 5.0,
      
      // 跳绳
      '跳绳': 10.0, '单摇': 9.0, '双摇': 12.0, '花式跳绳': 10.0,
      
      // HIIT
      'HIIT': 10.0, 'Tabata': 12.0, '高强度间歇': 10.0,
      '开合跳': 8.0, '波比跳': 9.0, '高抬腿': 7.0,
      
      // 自重力量
      '深蹲': 5.5, '徒手深蹲': 5.0, '箭步蹲': 5.0, '保加利亚蹲': 5.5,
      '靠墙静蹲': 2.5, '马步': 2.5,
      '俯卧撑': 5.0, '引体向上': 6.0, '引体向上机': 5.0,
      '仰卧起坐': 4.0, '卷腹': 4.0, '俄罗斯转体': 4.5,
      '臀桥': 3.5, '桥式': 3.5, '死虫式': 3.0, '鸟狗式': 3.0,
      '平板支撑': 2.5, '侧平板': 2.5,
      '倒立': 4.0, '手倒立': 4.5,
      '登山跑': 6.0, '单腿硬拉': 4.5,
      
      // 弹力带
      '弹力带': 3.0, '弹力带练背': 3.0, '弹力带练臀': 3.0,
      '弹力带练肩': 3.0, '弹力带练胸': 3.0, '弹力带练腿': 3.0,
      '弹力带训练': 3.0, '阻力带': 3.0, '拉力带': 3.0, '乳胶带': 3.0,
      '8字拉力器': 2.5, '开肩美背': 2.5,
      
      // 哑铃
      '哑铃': 4.5, '哑铃弯举': 4.0, '哑铃推举': 4.5,
      '哑铃飞鸟': 4.0, '哑铃划船': 4.5, '哑铃深蹲': 5.0,
      '哑铃硬拉': 5.0, '哑铃侧平举': 3.5, '哑铃前平举': 3.5,
      
      // 杠铃
      '杠铃': 5.0, '杠铃深蹲': 6.0, '杠铃硬拉': 6.0,
      '杠铃卧推': 5.5, '杠铃划船': 5.5, '杠铃推举': 5.0,
      '杠铃弯举': 4.0, '杠铃臀推': 5.0,
      '相扑硬拉': 6.0, '罗马尼亚硬拉': 5.5,
      
      // 器械
      '器械训练': 5.0, '器械推胸': 4.5, '器械划船': 4.5,
      '器械夹胸': 4.0, '腿举': 5.0, '腿弯举': 4.0, '腿屈伸': 4.0,
      '坐姿划船': 4.5, '高位下拉': 4.5,
      '史密斯机': 5.0, '龙门架': 4.5, '蝴蝶机': 3.5, '推胸机': 4.5,
      
      // 壶铃
      '壶铃': 6.0, '壶铃摇摆': 7.0, '壶铃抓举': 7.0,
      '壶铃深蹲': 6.0, '壶铃推举': 6.0, '土耳其起立': 6.0,
      
      // TRX
      'TRX': 5.0, '悬挂训练': 5.0, 'TRX划船': 4.5,
      'TRX深蹲': 4.5, 'TRX俯卧撑': 5.0,
      
      // 战绳
      '战绳': 8.0, '甩绳': 8.0, '药球': 6.0, '药球抛': 6.0,
      '沙袋': 6.0, '轮胎翻': 7.0, '农夫行走': 5.5, '雪橇推': 7.0,
      
      // 登山
      '爬山': 6.5, '登山': 7.0, '攀岩': 8.0, '攀冰': 9.0,
      '溯溪': 6.0, '漂流': 4.0,
      
      // 冰雪
      '滑雪': 7.0, '滑冰': 7.0, '轮滑': 7.0, '滑板': 5.0,
      
      // 日常
      '做家务': 2.5, '打扫卫生': 2.5, '拖地': 3.0,
      '擦窗户': 3.0, '洗衣服': 2.5, '做饭': 2.5,
      '洗碗': 2.0, '整理房间': 2.5,
      '搬东西': 4.0, '抱孩子': 3.0, '遛狗': 3.0,
      '园艺': 3.5, '种菜': 3.5, '洗车': 3.0,
      
      // 产后/特殊
      '产后恢复': 3.0, '盆底肌训练': 2.0, '凯格尔运动': 2.0,
      '腹直肌修复': 2.5, '办公室运动': 2.5,
      '椅子瑜伽': 2.0, '坐姿运动': 2.0, '床上运动': 2.0,
      '碎片化运动': 2.5, '微运动': 2.5, '办公室微运动': 2.0,
      
      // 帕梅拉
      '帕梅拉': 6.0, '帕梅拉燃脂': 7.0, '帕梅拉HIIT': 8.0,
      '帕梅拉腹肌': 5.5, '帕梅拉臀腿': 6.0, '帕梅拉有氧': 7.0,
      '帕梅拉拉伸': 2.5, '帕梅拉舞蹈': 6.0,
      '帕梅拉初学者': 4.5, '帕梅拉10分钟': 6.0,
      '帕梅拉15分钟': 6.0, '帕梅拉20分钟': 6.0,
      
      // 周六野
      '周六野': 5.0, '周六野燃脂': 6.0, '周六野拉伸': 2.5,
      '周六野改善体态': 3.0, '周六野瘦小腿': 3.5,
      '周六野瘦腰': 4.0, '周六野马甲线': 4.5,
      '周六野全身燃脂': 6.0,
      
      // 欧阳春晓
      '欧阳春晓': 4.5, '欧阳春晓沙漏腰': 4.0,
      '欧阳春晓直角肩': 3.0, '欧阳春晓少女背': 3.0,
      '欧阳春晓拉伸': 2.5,
      
      // 韩小四
      '韩小四': 4.0, '韩小四瘦手臂': 3.5,
      '韩小四瘦小腿': 3.5, '韩小四瘦大腿': 4.0,
      '韩小四全身燃脂': 5.0,
      
      // 刘畊宏
      '刘畊宏': 6.0, '刘畊宏毽子操': 6.0,
      '刘畊宏本草纲目': 7.0, '刘畊宏龙拳': 8.0,
      '刘畊宏牛仔很忙': 6.0,
      '毽子操': 6.0, '本草纲目': 7.0, '龙拳': 8.0, '牛仔很忙': 6.0,
      
      // 郑多燕
      '郑多燕': 4.5, '郑多燕小红帽': 5.0, '郑多燕小灰帽': 4.5,
      
      // 海外博主
      'Chloe Ting': 6.0, 'Chloe Ting腹肌': 5.5, 'Chloe Ting燃脂': 7.0,
      'Growingannanas': 7.0, 'Growingannanas HIIT': 8.0,
      'Eleni Fit': 6.0, 'Eleni Fit站立': 5.5,
      'Mizi': 5.0, 'Mizi瘦腰': 4.5,
      'Yuuka Sagawa': 3.0, 'Yuuka瘦背': 2.5,
      'Caroline Girvan': 7.0, 'Caroline力量': 6.0,
      'Heather Robertson': 6.0,
      'MadFit': 5.5, 'MadFit舞蹈': 5.0,
      'Fitness Blender': 6.0,
      'Blogilates': 4.5, 'Blogilates普拉提': 4.0,
      
      // 健身APP
      'Keep': 5.5, 'Keep燃脂跑': 7.0, 'Keep马甲线': 4.5,
      'Keep腹肌撕裂者': 5.0, 'Keep哑铃': 4.5,
      'Keep瑜伽': 2.5, 'Keep拉伸': 2.0,
      'KeepHIIT': 8.0, 'Keep跳绳': 9.0,
      'Keep单车': 5.5, 'Keep操课': 5.0,
      '薄荷健康': 5.0, '薄荷HIIT': 7.0, '薄荷瑜伽': 2.5,
      '乐刻': 5.5, '乐刻团课': 6.0,
      '超级猩猩': 7.0, '超级猩猩战绳': 8.0,
      '超级猩猩单车': 7.0, '超级猩猩搏击': 8.0,
      
      // 局部训练
      '瘦手臂操': 3.0, '瘦腿操': 3.5, '瘦腰操': 4.0,
      '全身燃脂操': 6.0
    };
    
    // 查找匹配的运动（优先最长匹配）
    let met = 0;
    let bestMatch = '';
    for (const [exercise, value] of Object.entries(metValues)) {
      if (q.includes(exercise.toLowerCase()) && exercise.length > bestMatch.length) {
        met = value;
        bestMatch = exercise;
      }
    }
    
    if (bestMatch) {
      const durationHour = duration / 60;
      const totalCalorie = Math.round(met * weight * durationHour * 1.05);
      return `${bestMatch}${duration}分钟大约消耗 ${totalCalorie} 千卡（按你当前体重 ${weight}kg，MET值${met}计算）。`;
    }
  }

  return null;
}

/**
 * 获取今日已记录的食物明细
 */
function getTodayFoods(userId) {
  const today = getChinaDateStr();

  const rows = db.prepare(`
    SELECT meal_time, foods
    FROM diet_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, today);

  const foods = [];
  for (const row of rows) {
    const list = safeJsonParse(row.foods, []);
    for (const food of list) {
      if (food && food.name) {
        foods.push({
          name: food.name,
          weight: food.weight || 0,
          quantity: food.quantity || 0,
          unit: food.unit || 'g',
          calorie: food.calorie || 0,
          protein: food.protein || 0,
          carb: food.carb || 0,
          fat: food.fat || 0,
          meal_time: row.meal_time
        });
      }
    }
  }
  return foods;
}

/**
 * 获取今日已记录的运动明细
 */
function getTodayExercises(userId) {
  const today = getChinaDateStr();
  const rows = db.prepare(`
    SELECT exercises
    FROM exercise_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, today);

  const exercises = [];
  for (const row of rows) {
    const list = safeJsonParse(row.exercises, []);
    for (const ex of list) {
      if (ex && ex.name) {
        exercises.push({
          name: ex.name,
          duration: ex.duration || 0,
          intensity: ex.intensity || 'moderate',
          calorie: ex.calorie || 0
        });
      }
    }
  }
  return exercises;
}

/**
 * 从运动库（exercise_db）查找最匹配的运动
 * 优先最长名称匹配
 */
function getExerciseFromDb(name) {
  if (!name) return null;
  const input = String(name).toLowerCase();
  const rows = db.prepare(`SELECT exercise_name, met_value, calorie_per_hour, intensity_desc FROM exercise_db`).all();
  let best = null;
  let bestScore = 0;
  for (const row of rows) {
    const dbName = String(row.exercise_name || '').toLowerCase();
    if (!dbName) continue;
    // 互相包含视为匹配，越长越优先
    const matched = input.includes(dbName) || dbName.includes(input);
    if (matched && dbName.length > bestScore) {
      bestScore = dbName.length;
      best = row;
    }
  }
  return best;
}

/**
 * 计算今日营养摄入
 */
function getTodayNutrition(userId) {
  const today = getChinaDateStr();

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

/**
 * 获取最近 N 天的身体相关上下文（体重、饮食、运动、习惯）
 * 用于体重/平台期类问题时，让 AI 基于真实记录综合分析
 */
function getRecentBodyContext(userId, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  // 最近体重：每天取最新一条
  const weights = db.prepare(`
    SELECT record_date, value, unit
    FROM body_records b1
    WHERE user_id = ? AND type = 'weight' AND record_date >= ? AND status = 1
      AND created_at = (
        SELECT MAX(created_at) FROM body_records b2
        WHERE b2.user_id = b1.user_id
          AND b2.record_date = b1.record_date
          AND b2.type = b1.type
      )
    ORDER BY record_date ASC
  `).all(userId, since);

  // 每日饮食汇总
  const nutrition = db.prepare(`
    SELECT record_date,
           SUM(total_calorie) as calorie,
           SUM(total_protein) as protein,
           SUM(total_carb) as carb,
           SUM(total_fat) as fat
    FROM diet_records
    WHERE user_id = ? AND record_date >= ? AND status = 1
    GROUP BY record_date
    ORDER BY record_date ASC
  `).all(userId, since);

  // 每日运动汇总
  const exercises = db.prepare(`
    SELECT record_date,
           SUM(total_duration) as duration,
           SUM(total_calorie) as calorie
    FROM exercise_records
    WHERE user_id = ? AND record_date >= ? AND status = 1
    GROUP BY record_date
    ORDER BY record_date ASC
  `).all(userId, since);

  // 习惯（仅喝水，APP 不记录睡眠）
  const habits = db.prepare(`
    SELECT record_date,
           MAX(water_ml) as water_ml
    FROM habit_records
    WHERE user_id = ? AND record_date >= ? AND status = 1
    GROUP BY record_date
    ORDER BY record_date ASC
  `).all(userId, since);

  const weightLines = weights.length
    ? weights.map(r => `- ${r.record_date}: ${r.value}${r.unit || 'kg'}`).join('\n')
    : '最近无体重记录';

  const nutritionLines = nutrition.length
    ? nutrition.map(r => `- ${r.record_date}: 摄入 ${Math.round(r.calorie || 0)}kcal，蛋白质 ${Math.round(r.protein || 0)}g，碳水 ${Math.round(r.carb || 0)}g，脂肪 ${Math.round(r.fat || 0)}g`).join('\n')
    : '最近无饮食记录';

  const exerciseLines = exercises.length
    ? exercises.map(r => `- ${r.record_date}: 运动 ${r.duration || 0}分钟，消耗 ${Math.round(r.calorie || 0)}kcal`).join('\n')
    : '最近无运动记录';

  const habitLines = habits.length
    ? habits.map(r => `- ${r.record_date}: 喝水 ${r.water_ml || 0}ml`).join('\n')
    : '最近无习惯记录';

  return `【系统数据】用户最近 ${days} 天的真实记录：
一、体重记录
${weightLines}

二、每日饮食汇总
${nutritionLines}

三、每日运动汇总
${exerciseLines}

四、生活习惯汇总
${habitLines}

请基于以上真实记录分析用户的体重/平台期/身体情况，不要给出泛泛而谈的建议。如果记录不足，请直接说明还需要记录哪些数据。`;
}

module.exports = {
  callHelperAgent,
  getTodayNutrition,
  getRecentBodyContext
};
