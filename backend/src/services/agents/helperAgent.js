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
const { getChinaDateStr, getChinaDateStrOffset } = require('../../utils/chinaTime');

/**
 * 根据本轮沉淀结果构造给 helper 的系统上下文块
 * 核心原则：搭子只能基于沉淀系统的真实结果反馈"记录状态"，
 * 严禁在未沉淀成功时对用户谎称"已经记录好"（诚信红线）；
 * "没记全/拿不到数据"这类内部状态不告诉用户，直接跳过
 * @param {object|null|undefined} precipitation callPrecipitationAgent 返回结果
 *        成功：{ precipitation_id, type, sub_type, status(1=已落库/2=待确认), extracted_data }
 *        失败：{ extracted:false, reason }；未知（超时）：null
 * @returns {string} 注入给 LLM 的系统消息文本
 */
function buildPrecipitationContextBlock(precipitation) {
  // 结果未知（沉淀超时/未等待）：无法确认是否记录成功，禁止声称完成
  if (!precipitation) {
    return `【沉淀结果通知】本轮消息的自动记录结果尚未返回（可能仍在处理中）。
硬性规则：你此刻无法确认数据是否已经记录成功，因此严禁说"已经帮你记录/记好了/已记录到……"这类确认记录完成的话。
若用户要求记录饮食/运动，请说"我在帮你记啦，稍等几秒可以在记录页核对一下；万一没记上，你补充下具体时长/份量我再帮你记"，不要虚构记录内容或热量数字。`;
  }

  // 沉淀失败：未提取到任何可记录内容
  // 注意：拿不到数据/没沉淀上是系统内部状态，禁止对用户透露"没记全"类话术，直接跳过正常回答
  if (precipitation.extracted === false || !precipitation.type) {
    return `【沉淀结果通知】本轮用户消息没有生成任何新的记录（沉淀系统未提取到可记录内容，原因：${precipitation.reason || '信息不足或无需记录'}）。
硬性规则：
1. 严禁说"已经帮你记录/记好了/已记录"这类话——本轮没有任何记录生成，谎称已记录是严重错误；此前已记录的数据依然有效，可正常引用。
2. 严禁向用户提及"还没记全/没记上/没有记录成功/请补充食物名称和份量/去记录页手动添加"这类话术——拿不到数据属于系统内部情况，不需要告诉用户，直接跳过这部分，基于对话上下文和【系统数据】正常回答消息里的其他内容。
3. 若用户明显在尝试记录但缺份量/时长（如"爬了几层楼"），用自然语气追问一句即可（如"大概爬了几层呀"），严禁编造热量数字。`;
  }

  // 沉淀成功：拼出实际记录内容摘要（数值以沉淀系统为准，helper 不得改写）
  const lines = [];
  const data = precipitation.extracted_data || {};
  if (precipitation.type === 'diet_record') {
    // 营养来源标注：搭子话术需区分"已核实数据"与"估算值"，避免对估算值过度承诺
    const sourceLabel = {
      food_db: '（食品库数据）',
      web_verified: '（网络核实）',
      web_learned: '（网络核实）',
      llm_estimate: '（估算值）',
      generic_fallback: '（估算值）',
      user_specified: ''
    };
    const foods = Array.isArray(data.foods) ? data.foods : [];
    foods.forEach(f => {
      const amount = f.weight ? `${f.weight}g` : (f.quantity ? `${f.quantity}${f.unit || ''}` : '');
      const label = sourceLabel[f.nutrition_source] ?? '（估算值）';
      lines.push(`- 饮食：${f.name}${amount ? ' ' + amount : ''}，约${Math.round(f.calorie || 0)}千卡${label}`);
    });
    if (data.total_calorie != null) lines.push(`- 本餐合计约 ${Math.round(data.total_calorie)} 千卡`);
  } else if (precipitation.type === 'exercise_record') {
    const exercises = Array.isArray(data.exercises) ? data.exercises : [];
    exercises.forEach(e => {
      const dist = e.distance ? `、${e.distance}公里` : '';
      lines.push(`- 运动：${e.name}${e.duration != null ? ' ' + e.duration + '分钟' : ''}${dist}，约${Math.round(e.calorie || 0)}千卡`);
    });
    if (data.total_calorie != null) lines.push(`- 运动合计约 ${Math.round(data.total_calorie)} 千卡`);
  } else if (precipitation.type === 'body_data') {
    const parts = [];
    if (data.weight != null) parts.push(`体重${data.weight}kg`);
    if (data.body_fat != null) parts.push(`体脂${data.body_fat}%`);
    lines.push(`- 身体数据：${parts.join('、') || '已记录'}`);
  }
  const summary = lines.length ? lines.join('\n') : '- 记录已生成';

  // status=2：低置信度，已生成待确认记录，用户点确认卡片后才正式落库
  if (precipitation.status === 2) {
    return `【沉淀结果通知】系统已从本轮消息提取到记录，但置信度较低，需要用户在确认卡片中核对后才正式生效：
${summary}
规则：
1. 不要说"已经记录好/已保存"，应说"我先帮你记下来啦，你点一下确认卡片核对，确认后就正式生效"。
2. 引用的内容与数值必须以上方摘要为准，禁止编造摘要之外的食物、运动或热量数字。`;
  }

  // status=1：已自动确认并正式落库
  // 饮食记录确认后必须附上简短分析（减脂影响/今日总摄入/下一餐建议），不能只有干巴巴的热量清单
  const dietAnalysisRule = precipitation.type === 'diet_record'
    ? `
3. 确认记录后必须紧接着给出简短的饮食分析（2-4句，不要展开成长篇）：这餐热量约占用户每日热量目标的比例、对用户减脂的影响、今日已记录总摄入情况、以及下一餐/今天的饮食建议。分析中的总摄入热量必须引用【系统数据】里的数值，禁止自行编造。若【系统数据】提示今天记录的餐别不足2个，分析只针对本餐本身，不要评价全天总摄入是否过低。`
    : '';
  return `【沉淀结果通知】系统已成功从本轮消息提取记录并正式写入用户的记录数据：
${summary}
规则：
1. 可以告诉用户"记好啦"，但记录内容与数值必须严格引用上方摘要，禁止编造摘要之外的食物、运动或热量数字（例如摘要里是爬楼梯6分钟约35千卡，就不许说成30千卡或其他数字）。用户询问本条消息中食物/运动的热量时，必须引用摘要数值回答，严禁改用你自己的估算值或网络值覆盖摘要——即使你觉得摘要数值偏高/偏低，也要先按摘要回答。
2. 摘要中标注"（估算值）"的数据，如用户追问准确度，需如实说明这是估算参考，可以帮 ta 稍后核实；标注"（食品库数据）/（网络核实）"的数据可直接作为准确值引用。若摘要内容与用户口述可能有出入（如名称/份量不对），提醒用户可在记录页手动修改。${dietAnalysisRule}`;
}

/**
 * 根据饮食更正结果构造给 helper 的系统上下文块
 * 核心原则：搭子只能"如实"反馈删除结果——
 * 只有下方明确列出"已删除"的项目才能说"已帮你删掉"；
 * 未找到/多条匹配的项目绝不允许承诺删除或替换，只能引导用户手动处理
 * @param {object|null} correction dietCorrectionService.detectAndApplyDietCorrection 返回结果
 * @returns {string|null} 注入给 LLM 的系统消息文本；无更正时返回 null
 */
function buildCorrectionContextBlock(correction) {
  if (!correction) return null;
  const lines = [];
  if (Array.isArray(correction.removed) && correction.removed.length) {
    const items = correction.removed.map(r =>
      `${r.name}（约${r.calorie}千卡，${r.mealTime || ''}）`).join('、');
    lines.push(`【已执行删除】系统已从用户今日记录中删除：${items}。`);
  }
  if (Array.isArray(correction.notFound) && correction.notFound.length) {
    lines.push(`【未删除-未找到】用户说没吃「${correction.notFound.join('、')}」，但今日记录中没有找到对应记录，未做任何删除。`);
  }
  if (Array.isArray(correction.ambiguous) && correction.ambiguous.length) {
    lines.push(`【未删除-多条匹配】「${correction.ambiguous.join('、')}」匹配到多条记录，为避免误删未自动删除。`);
  }
  const summary = lines.length ? lines.join('\n') : '【更正结果】本轮没有删除任何记录。';

  return `【饮食更正结果通知】用户本轮消息包含对已有饮食记录的更正（比如"我后来没吃X，吃了Y"）。
${summary}
硬性规则：
1. 只有上方【已执行删除】里明确列出的项目，你才能对用户说"已帮你删掉/去掉了"。列表之外严禁承诺删除、替换、改掉任何记录——说了就必须真的做过，没做过就绝对不许说。
2. 对【未删除-未找到】和【未删除-多条匹配】的项目：如实告诉用户"这条没找到/匹配到多条，怕删错我没敢动，你可以在记录页长按手动删除或修改"。严禁说"我帮你删除/换成/更新"这类话。
3. 如果本轮【已执行删除】为空，严禁出现任何"帮你把X换成Y/帮你删掉"的表述。
4. "吃了Y"的新增部分以【沉淀结果通知】为准：沉淀成功才说记好了，未成功不许说已记录。`;
}

/**
 * 调用全能助手 Agent
 * @param {string} question 用户问题/对话内容
 * @param {object} userInfo 用户信息
 * @param {object} partnerInfo 搭子人设信息
 * @param {object} [options] 额外选项
 * @param {object|null} [options.precipitation] 本轮消息的沉淀结果，用于如实反馈记录状态，防止谎称已记录
 * @param {object|null} [options.correction] 饮食更正结果（dietCorrectionService 返回），
 *        约束搭子只能如实反馈删除结果，严禁承诺未执行的删除/替换
 * @param {Array} [options.history] 最近对话消息（{role:'user'|'partner', content}，按时间正序），
 *        用于让 helper 理解"这只是午餐哦"这类依赖上下文的追问；不是本轮新消息
 */
async function callHelperAgent(question, userInfo = {}, partnerInfo = {}, options = {}) {
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
  // 用户质疑已记录数据时（如"这个数据不对"，不含任何食物关键词，needsFoodData 不会命中）：
  // 今日记录中来源非食物库（LLM估算/兜底）的食物热量不可靠，强制联网核实，
  // 差异明显时直接更正记录（真实案例：瑞幸小黄油美式被记成10千卡，实际约173千卡）
  // 修正通知在下方所有数据块拼完后统一追加，避免被【系统数据】模板覆盖
  let challengedCorrections = [];
  if (userId && /(不对|错了|有误|不准|怀疑|真的吗|核实|重新核|重新算|数据不|不靠谱|有问题)/.test(question || '')) {
    try {
      challengedCorrections = await verifyChallengedRecords(userId, question);
    } catch (e) {
      console.error('[helper] 质疑数据联网核实失败:', e.message);
    }
  }

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

      // ===== 食物数据源择优：高/中置信食品库 → 网络核实+学习入库 → 未校验网络原文兜底 =====
      // 核心原则：食品库不再"强行匹配"——逐字符硬凑的低置信结果一律舍弃，
      // 改走联网核实；网络数据经结构化+合理性校验后回流入库，后续消息即成为高置信库条目
      let webSearchBlock = ''; // 未通过校验的网络原文（仅供 LLM 估算参考，禁止当作权威值）
      let foodDbBlock = '';    // 可靠营养条目（食品库命中 + 网络核实后新收录）
      try {
        const asksCalorieOrSugar = /(热量|卡路里|千卡|大卡|含糖|无糖|有糖|低糖|能喝|能吃|可以喝|可以吃|多少卡|胖不胖|减肥|减脂|热量高|营养)/.test(question);
        // 本轮饮食沉淀已成功：本条消息里的食物已由沉淀系统定值（摘要为准），
        // helper 不再联网核实这些食物——否则网搜失败会退化成"估算值"，
        // 和刚写入的记录数值打架（真实案例：记录604.5千卡 vs helper估算504千卡）
        const skipWebSearch = !!(options.precipitation
          && options.precipitation.type === 'diet_record'
          && options.precipitation.extracted !== false);

        // 收集候选食物，排除今日已记录的
        const candidates = collectFoodCandidates(question)
          .filter(cleaned => !todayFoods.some(f => f.name && (f.name.includes(cleaned) || cleaned.includes(f.name))));

        const dbRefs = [];
        const webCandidates = [];
        const seenDb = new Set();
        for (const cleaned of candidates) {
          // 仅采纳中置信以上的库匹配；低置信（逐字符硬凑）视为"库中无可靠条目"
          const info = nutritionService.getFoodNutrition(cleaned, null, { minConfidence: 'medium' });
          if (info && info.calorie_per_100g > 0) {
            if (seenDb.has(info.food_name)) continue;
            seenDb.add(info.food_name);
            dbRefs.push({ name: cleaned, info });
          } else if (asksCalorieOrSugar && !skipWebSearch && shouldUseWebSearch(question, cleaned)) {
            webCandidates.push(cleaned);
          }
        }

        // 网络核实+学习入库：检索 → 结构化 → 营养校验 → 校验通过回流入库；最多处理 2 个候选，控制延迟
        const learnedRefs = [];
        const webRawTexts = [];
        await Promise.all(webCandidates.slice(0, 2).map(async (name) => {
          try {
            const r = await webSearchService.searchAndLearnFood(name, question);
            if (r.validated && r.info) {
              learnedRefs.push({ name, info: r.info, newlyLearned: !!r.learned });
            } else if (r.webText) {
              webRawTexts.push(`「${name}」网络参考资料：\n${r.webText}`);
            }
          } catch (e) {
            console.error(`[callHelperAgent] 网络核实失败（${name}）:`, e.message);
          }
        }));

        // 可靠条目：食品库中高置信命中 + 网络核实通过（含本次新收录）条目
        const allReliableRefs = [
          ...dbRefs.map(r => ({ ...r, newlyLearned: false })),
          ...learnedRefs
        ];
        if (allReliableRefs.length) {
          const lines = allReliableRefs.map(({ info, newlyLearned }) => {
            const macro = `蛋白质${Number(info.protein_per_100g || 0)}g、碳水${Number(info.carb_per_100g || 0)}g、脂肪${Number(info.fat_per_100g || 0)}g`;
            const unitTip = info.common_unit ? `；常见份量参考：${info.common_unit}` : '';
            const tag = newlyLearned ? '（刚联网核实并收录进食物库）' : '';
            return `- ${info.food_name}${tag}：${Math.round(info.calorie_per_100g)}千卡/100g（每100g含${macro}）${unitTip}`;
          }).join('\n');
          foodDbBlock = `\n【食物库参考】用户提到的以下食物有可靠营养数据（与饮食记录沉淀使用同一数据源）：\n${lines}\n计算这些食物的热量时，必须以每100g营养值×实际克数/份量计算并直接引用，禁止自行估算覆盖；标注"刚联网核实"的条目可顺带用自然语气告诉用户"这个食物我已经帮你记住啦，下次直接用这个数据"。\n`;
        }

        // 未通过校验的网络原文（数据矛盾/无法结构化）：仅可作为估算参考
        if (webRawTexts.length) {
          webSearchBlock = `\n【网络检索参考】以下食物本地食物库暂无可靠条目、网络数据也未通过校验，仅可作为粗略估算参考（引用时必须明确标注"估算值"，严禁说已记录/已收录/已记住）：\n${webRawTexts.join('\n\n')}\n`;
        }
      } catch (e) {
        console.error('[callHelperAgent] 食物数据源择优处理失败:', e.message);
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
${foodDbBlock}${webSearchBlock}
请基于以上实际记录数据回答，并严格遵守以下规则：
1. 总摄入热量的单位是千卡，不是克数，不要把总热量数字错当成某种食物的重量；也不要把用户说的重量（如"100克"）直接当成热量。
2. 如果用户提到的食物已在上方记录中，必须直接引用记录里的热量，禁止自行改数。
3. 如果上方附有【食物库参考】，其中食物的热量必须按每100g营养值×实际克数/份量计算并直接引用（食物库与饮食记录沉淀同源，含"刚联网核实并收录"的条目），禁止用其他估算覆盖。
4. 如果附有【网络检索参考】（标注"未通过校验、仅可粗略估算"），只能基于其中数据给出估算并明确标注"估算值"，严禁把估算值说成已记录/已收录的确定数据。
5. 如果不在记录中且没有任何参考（没有【食物库参考】也没有【网络检索参考】），严禁凭空编造具体热量/营养素数字；明确告诉用户"这款我暂时没查到准确的营养数据"，可以给定性建议（如"含糖茶饮普遍不低，建议按中高热量的饮品来规划今日剩余额度"），但不许报具体数字。绝不允许拍脑袋估算。
6. 同一条回复中严禁前后矛盾：禁止先说"无数据/无法估算"紧接着又给出具体热量数字。要么只给定性建议不给出数字，要么给出有来源（记录/食物库/检索参考）的数字。`;
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

  // 质疑核实修正通知：在所有数据块拼完后统一追加（记录已更正，回复必须引用新值）
  if (challengedCorrections.length) {
    const lines = challengedCorrections.map(c =>
      `- ${c.name}（${c.weight}g）：原记录约${c.oldCalorie}千卡 → 经联网核实更正为约${c.newCalorie}千卡，记录已更新`);
    enhancedQuestion += `\n\n【数据修正通知】用户质疑了已记录数据的热量，系统已联网核实并更正：\n${lines.join('\n')}\n规则：回复必须引用更正后的数值，并用自然语气告知用户"我重新联网核对了一下，之前这条确实记低了/有误，已经帮你更新记录"；严禁再引用旧数值，也不要说成用户自己改的。`;
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

  // 最近对话上下文：让 helper 能理解"这只是午餐哦""我喝的是无糖的"这类依赖上文的追问。
  // 仅供理解指代，不是本轮新消息；上下文里的旧数字以【系统数据】/沉淀摘要为准
  const historyMessages = Array.isArray(options.history) ? options.history.slice(-10) : [];
  const historyBlock = historyMessages.length
    ? `【最近对话上下文】（仅供你理解上下文和指代，不是本轮用户的新消息；你的回答仍只针对本轮问题，严禁把上下文里的旧食物/旧数字说成是本轮新记录，上下文里的饮食若已沉淀以【系统数据】和沉淀摘要为准）\n`
      + historyMessages.map(m => {
          const who = m.role === 'partner' ? '搭子' : '用户';
          const text = String(m.content || '').replace(/\s+/g, ' ').trim().slice(0, 200);
          return `${who}：${text}`;
        }).join('\n')
    : null;

  try {
    
    const response = await Promise.race([
      callWithPrompt(
        'helper_agent',
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'system',
            content: '补充规则：1）当用户询问的饮品/食品不在今日记录和食物库中时，优先使用用户消息中附带的【网络检索参考】数据给出估算热量，并区分有糖/无糖版本；如果没有附带检索参考，严禁凭空编造具体热量数字——明确告诉用户"这款我暂时没查到准确的营养数据"，可给定性建议但不报具体数字。2）同一条回复中严禁前后矛盾：禁止先说"无数据/无法估算"紧接着又给出具体热量数字；要么只给定性建议不给出数字，要么给出有来源（记录/食物库/检索参考）的数字。3）APP 目前没有睡眠、盐分摄入、水肿记录功能，回答中不要建议用户记录或分析睡眠、盐分、水肿相关内容。4）当前用户信息中已提供 BMR、TDEE、每日热量目标等数据时，请直接基于这些数据进行分析和建议，不要再要求用户补充性别、年龄、活动水平等基础信息。'
          },
          // 本轮沉淀结果通知：搭子必须基于真实沉淀结果反馈记录状态，未沉淀成功严禁谎称已记录
          { role: 'system', content: buildPrecipitationContextBlock(options.precipitation) },
          // 本轮饮食更正结果通知：搭子只能如实反馈删除结果，严禁承诺未执行的删除/替换（可为 null，自动跳过）
          ...(buildCorrectionContextBlock(options.correction) ? [{ role: 'system', content: buildCorrectionContextBlock(options.correction) }] : []),
          // 最近对话上下文：让 helper 理解依赖上文的追问（可为 null，自动跳过）
          ...(historyBlock ? [{ role: 'system', content: historyBlock }] : []),
          { role: 'user', content: enhancedQuestion }
        ],
        { temperature: 0.5, max_tokens: 8000 }
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('全能助手 Agent 调用超时')), 120000)
      )
    ]);
    
    let reply = stripThinkingTags(response.choices[0].message.content || '');

    // 混元 Hy3 偶发只输出 reasoning_content、content 为空；尝试从推理内容提取最终结论
    if (!reply.trim() && response.choices[0].message.reasoning_content) {
      const extracted = extractReplyFromReasoning(response.choices[0].message.reasoning_content, [enhancedQuestion]);
      if (extracted) {
        console.log('[callHelperAgent] 从 reasoning_content 提取到回复');
        reply = extracted;
      }
    }

    if (!reply.trim()) {
      reply = '这个问题我暂时没有思路，你换个问法试试？';
    }

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

    // 兜底清洗：拿不到数据/没沉淀上是系统内部状态，即使模型违反指令
    // 也不让"没记全/去补充/去记录页手动添加"这类话术发给用户，只保留回复的其余部分
    const stripped = stripRecordFailureSentences(reply);
    if (stripped !== reply) {
      console.log('[callHelperAgent] 已移除记录失败碎片句子');
      reply = stripped;
    }

    return reply;
  } catch (error) {
    console.error('全能助手 Agent 调用失败:', error.message);
    return '哎呀，我这边算不过来了，你等一下再问好不好？';
  }
}

/**
 * 用户质疑已记录数据时的联网核实与记录自愈
 * 场景：用户说"这个数据不对"——今日记录中来源非食物库（LLM估算/人工兜底）的食物热量不可靠，
 * 对这些食物强制联网核实（searchAndLearnFood：检索→结构化→合理性校验→回流食品库），
 * 核实值与记录值差异明显时直接更新 diet_records 并同步沉淀记录，返回修正清单注入 prompt
 * @param {number} userId 用户ID
 * @param {string} question 本轮用户消息
 * @returns {Promise<Array<{name, weight, oldCalorie, newCalorie}>>} 修正清单（无修正返回空数组）
 */
async function verifyChallengedRecords(userId, question) {
  if (!userId) return [];

  const today = getChinaDateStr();
  const rows = db.prepare(`
    SELECT id, meal_time, precipitation_id, foods FROM diet_records
    WHERE user_id = ? AND record_date = ? AND status = 1
  `).all(userId, today);

  // 收集来源非食物库的待核实食物（每条名字只取第一次出现）
  const suspects = new Map();
  for (const row of rows) {
    const foods = safeJsonParse(row.foods, []);
    for (const food of foods) {
      if (!food || !food.name || suspects.has(food.name)) continue;
      const src = food.nutrition_source || 'food_db';
      if (src === 'food_db' || src === 'web_learned' || src === 'web_verified') continue;
      suspects.set(food.name, { row, food });
    }
  }
  if (!suspects.size) return [];

  const { searchAndLearnFood } = require('../webSearchService');
  const { syncDietExtractedDataToPrecipitation } = require('./precipitationAgent');
  const corrections = [];
  for (const [name, { row, food }] of [...suspects.entries()].slice(0, 2)) {
    try {
      const r = await searchAndLearnFood(name, question);
      if (!r || !r.validated || !r.info || !(r.info.calorie_per_100g > 0)) continue;
      const weight = parseFloat(food.weight) || 100;
      const ratio = weight / 100;
      const newCalorie = Math.round(r.info.calorie_per_100g * ratio);
      const oldCalorie = Math.round(parseFloat(food.calorie) || 0);
      // 差异不大不动记录，避免频繁改动
      if (Math.abs(newCalorie - oldCalorie) <= Math.max(10, oldCalorie * 0.15)) continue;
      // 按核实值重算该食物与整行合计
      const foods = safeJsonParse(row.foods, []);
      let changed = false;
      for (const f of foods) {
        if (f && f.name === name) {
          f.calorie = Math.round(r.info.calorie_per_100g * ratio * 10) / 10;
          f.protein = Math.round((r.info.protein_per_100g || 0) * ratio * 10) / 10;
          f.carb = Math.round((r.info.carb_per_100g || 0) * ratio * 10) / 10;
          f.fat = Math.round((r.info.fat_per_100g || 0) * ratio * 10) / 10;
          f.nutrition_source = 'web_verified';
          changed = true;
        }
      }
      if (!changed) continue;
      const totals = foods.reduce((acc, f) => ({
        calorie: acc.calorie + (parseFloat(f.calorie) || 0),
        protein: acc.protein + (parseFloat(f.protein) || 0),
        carb: acc.carb + (parseFloat(f.carb) || 0),
        fat: acc.fat + (parseFloat(f.fat) || 0)
      }), { calorie: 0, protein: 0, carb: 0, fat: 0 });
      db.prepare(`
        UPDATE diet_records
        SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(JSON.stringify(foods), totals.calorie, totals.protein, totals.carb, totals.fat, row.id, userId);
      if (row.precipitation_id) {
        try { syncDietExtractedDataToPrecipitation(userId, row.precipitation_id, row.meal_time); } catch (e) { /* 非阻塞 */ }
      }
      corrections.push({ name, weight, oldCalorie, newCalorie });
      console.log(`[helper] 质疑核实更正：「${name}」${oldCalorie} → ${newCalorie} 千卡，记录已更新`);
    } catch (e) {
      console.warn(`[helper] 质疑联网核实失败（${name}）:`, e.message);
    }
  }
  return corrections;
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
 * 移除回复中的"记录失败"碎片句子（没记全/去补充/去记录页手动添加等）。
 * 拿不到数据/没沉淀上是系统内部状态，即使模型违反系统指令也不让这些话术泄露给用户；
 * 只删除命中句子，保留回复其余部分（如正常的饮食分析）
 */
function stripRecordFailureSentences(reply) {
  if (!reply) return reply;
  const badSentence = /没.{0,4}记[全上]|记不全|没太记|记录失败|没有记录成功|补充.{0,20}(食物|份量|名称|时长|距离).{0,25}(记录|添加)?|去记录页手动添加/;
  const sentences = String(reply).split(/(?<=[。！？!?；;])|\n+/);
  const kept = sentences.filter(s => s.trim() && !badSentence.test(s));
  return kept.join('').trim();
}

/**
 * 从 reasoning_content 中提取可作为最终回复的句子
 * 用于混元 Hy3 只返回 reasoning_content、content 为空时的兜底恢复
 */
function extractReplyFromReasoning(reasoning, userMessages = []) {
  if (!reasoning || typeof reasoning !== 'string') return '';
  const text = reasoning.trim();
  if (!text) return '';

  const userMsgs = (Array.isArray(userMessages) ? userMessages : [userMessages])
    .map(m => String(m || '').trim())
    .filter(m => m.length >= 2);

  function cleanMeta(s) {
    return s.replace(/(字数|回复|答案|输出|最终回复)[：:]\s*/g, '').trim();
  }

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
    if (t.length < 4 || t.length > 200) return false;
    if (!/[。！？.!?]$/.test(t) || /\.{3,}|…{1,}|——$/.test(t)) return false;
    if (/^我(今天|中午|早上|晚上|刚|现在|刚才|又|还|只|先|然后|接着)?(吃|喝|运动|练|跑|走|跳|健身|做|上|称|测|量)/.test(t)) return false;
    if (thinkPrefixes.test(t) || internalHints.test(t) || isEchoingUser(t)) return false;
    return true;
  }

  // 策略1：优先提取最后一段完整引号里的内容
  const quotes = [];
  const quoteRegex = /["“]([\s\S]*?)["”]/g;
  let m;
  while ((m = quoteRegex.exec(text)) !== null) {
    const q = cleanMeta(m[1]).replace(/^["“'']+|["”'']+$/g, '');
    if (isSafeReply(q)) quotes.push(q);
  }
  if (quotes.length > 0) {
    return quotes[quotes.length - 1];
  }

  // 策略2：按句子拆分，从后往前找第一个安全回复
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
 * 从用户问题中收集可能的饮品/食品候选名称（已做量词/噪声清洗）
 * 供"联网检索判断"与"食物库参考注入"两处复用，保证候选口径一致
 * @param {string} question 原始用户消息
 * @returns {string[]} 清洗后的候选食物名列表
 */
function collectFoodCandidates(question) {
  if (!question) return [];
  const normalized = question.replace(/[，。！？；、,.!?;]/g, ' ');
  const candidates = new Set();

  // 数量+单位+名称（如：500ml羽衣甘蓝汁、一杯美式）
  const unitAfterRe = /(\d+(?:\.\d+)?)\s*(ml|mL|毫升|L|升|g|克|kg|千克|个|杯|瓶|罐|份|碗|袋|包|盒|只|片|支|根|条|粒|颗|口|张|枚)\s*([\u4e00-\u9fa5a-zA-Z]{2,})/g;
  // 名称+数量+单位（如：羽衣甘蓝汁500ml）
  const unitBeforeRe = /([\u4e00-\u9fa5a-zA-Z]{2,})\s*(\d+(?:\.\d+)?)\s*(ml|mL|毫升|L|升|g|克|kg|千克|个|杯|瓶|罐|份|碗|袋|包|盒|只|片|支|根|条|粒|颗|口|张|枚)/g;
  // 量词+名称（如：一大碗卤煮、一份黄焖鸡、一只烤鸡；注意不含数字）
  const portionRe = /(?:一|两|几|半|大|小|中)?\s*(?:份|碗|盘|个|只|杯|瓶|罐|袋|包|盒|根|条|片|块|勺|张|枚)(?:半)?\s*([\u4e00-\u9fa5a-zA-Z]{2,})/g;
  // 中文数字+单位+名称（如：两张山东大煎饼、三片吐司；兼容"两张半"写法）
  const cnUnitRe = /(?:一|两|三|四|五|六|七|八|九|十|半)(?:张|片|块|个|只|份|碗|杯|瓶|罐|袋|包|盒|根|条|粒|颗|枚|支|勺|口)(?:半)?\s*([\u4e00-\u9fa5a-zA-Z]{2,})/g;
  // 常见饮品/食品关键词（无数量时也尝试）
  // 后缀含"奶青"：一点点"四季奶青"以"青"结尾，不含品类字会被截断成"四季奶"
  const drinkRe = /([\u4e00-\u9fa5]{2,}(?:汁|饮|茶|奶青|奶|酸奶|咖啡|酒|水|汽水|苏打|气泡|美式|拿铁|摩卡|果汁|奶茶))/g;
  // 品牌+品名点单模式（如"霸王茶姬的伯牙绝弦""一点点四季奶青"）：
  // 伯牙绝弦这类纯专名不含茶/奶品类字，drinkRe 无法覆盖，靠品牌前缀兜底捕获
  const brandRe = /(?:一点点|1點點|1点点|霸王茶姬|霸王茶机|喜茶|奈雪的茶|奈雪|蜜雪冰城|蜜雪|茶百道|古茗|沪上阿姨|书亦烧仙草|书亦|益禾堂|瑞幸|星巴克|coco|CoCo|COCO)\s*的?\s*([\u4e00-\u9fa5a-zA-Z]{2,10})/g;
  // 奶茶/糖水小料专名（无量词无数字时也能识别，如"加了小珍珠和黑糖粉稞小料"）
  const toppingRe = /(小珍珠|大珍珠|黑糖珍珠|珍珠|波霸|粉圆|黑糖粉稞|黑糖粉粿|粉稞|粉粿|椰果粒|椰果|芋圆|仙草|布丁|脆啵啵|寒天|燕麦|红豆)/g;

  let m;
  while ((m = unitAfterRe.exec(normalized)) !== null) candidates.add(m[3]);
  while ((m = unitBeforeRe.exec(normalized)) !== null) candidates.add(m[1]);
  while ((m = portionRe.exec(normalized)) !== null) candidates.add(m[1]);
  while ((m = cnUnitRe.exec(normalized)) !== null) candidates.add(m[1]);
  while ((m = drinkRe.exec(normalized)) !== null) candidates.add(m[1]);
  while ((m = brandRe.exec(normalized)) !== null) candidates.add(m[1]);
  while ((m = toppingRe.exec(normalized)) !== null) candidates.add(m[1]);

  const stopWords = new Set([
    '今天','现在','这个','那个','这些','那些','多少','热量','卡路里','千卡','大卡',
    '含糖','无糖','有糖','糖分','蛋白质','脂肪','碳水','摄入','食物','饮品','饮料'
  ]);
  // 候选内部连接词：一个正则片段里可能抓了"伯牙绝弦和珍珠奶茶"，按连接词拆成独立候选
  const connectorSplit = /\s*(?:和|跟|与|还有|以及|或者|还是|加了?|外加|还有)\s*/;
  // 前缀噪声：量词单字/杯型/品牌名/语气词等，允许连续剥离（如"中杯的一点点四季奶青"→"四季奶青"）
  // "霸王茶"为品牌名"霸王茶姬"被饮品类后缀正则截断的残段，一并剥离
  const prefixNoise = /^(?:的|了|吗|呢|吧|啊|哦|嗯|喂|是|有|吃|喝|要|想|问|算|约|大概|大约|差不多|可能|应该|建议|推荐|怎么|如何|什么|多少|热量|卡路里|千卡|大卡|含糖|无糖|有糖|纯|鲜|现|超大杯|特大杯|中杯|大杯|小杯|一杯|一瓶|一碗|一份|一个|一包|一袋|一盒|一罐|一支|一根|一条|一片|一只|一点点|1點點|1点点|霸王茶姬|霸王茶机|霸王茶|喜茶|奈雪的茶|奈雪|蜜雪冰城|蜜雪|茶百道|古茗|沪上阿姨|书亦烧仙草|书亦|益禾堂|瑞幸|星巴克|coco|CoCo|COCO|杯|碗|盘|个|只|瓶|罐|袋|包|盒|根|条|片|块|勺|张|枚|的|了|是|有|喝|吃)+/;
  // 后缀噪声：语气词/热量疑问词组（brandRe 品名捕获可能带入"热量高吗/含糖量高/会胖/多少卡"等尾巴）
  const suffixNoise = /(的|了|吗|呢|吧|啊|哦|嗯|热量高吗|热量高不高|热量高|含糖量高吗|含糖量高|含糖量|卡路里|千卡|大卡|热量|含糖|无糖|有糖|多少卡|几卡|多少卡|多少钱|多少|哪个|哪种|会胖吗|会胖|好喝吗|好喝|好吃吗|一大杯|一中杯|一小杯|一杯|一瓶|一碗|一份|一个|一包|一袋|一盒|一罐|一大瓶|小料|配料|卡|杯|瓶|碗|份|袋|盒|罐)$/;

  const cleanedList = [];
  const seen = new Set();
  for (const raw0 of candidates) {
    // 先按连接词拆分（"伯牙绝弦和珍珠奶茶" → 伯牙绝弦 / 珍珠奶茶）
    for (const raw of String(raw0).split(connectorSplit).filter(Boolean)) {
      // 连续剥离前缀噪声与后缀噪声，直到稳定
      let cleaned = raw;
      for (let i = 0; i < 6; i++) {
        const next = cleaned.replace(prefixNoise, '').replace(suffixNoise, '').trim();
        if (next === cleaned) break;
        cleaned = next;
      }
      if (!cleaned || cleaned.length < 2 || stopWords.has(cleaned) || /^\d+$/.test(cleaned)) continue;
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      cleanedList.push(cleaned);
    }
  }
  return cleanedList;
}

/**
 * 按运动类型获取配速（分钟/公里），与沉淀提示词的换算规则保持一致；
 * 无配速规则的运动类型返回 0（不进入距离换算）。
 * 注意：骑行/跑步/游泳的强度分级（快速/休闲）优先走 getDistanceTier，本表为兜底。
 */
function getPacePerKm(q) {
  // 顺序即优先级：具体运动名在前，泛称在后（如"快走"须先于"走路"判断）
  const paceRules = [
    { keys: ['快跑', '冲刺跑', '短跑', '变速跑', '间歇跑'], pace: 5 },
    { keys: ['爬坡跑'], pace: 7 },
    { keys: ['超慢跑'], pace: 9 },
    { keys: ['跑步', '慢跑', '夜跑', '晨跑', '长跑', '越野跑', '跑步机'], pace: 6 },
    { keys: ['快走', '健走', '暴走'], pace: 10 },
    { keys: ['徒步', '登山', '爬山'], pace: 18 },
    { keys: ['走路', '慢走', '散步'], pace: 15 },
    // 普通通勤骑行约 15km/h ≈ 4min/km；快速/休闲分级见 getDistanceTier
    { keys: ['骑车', '骑行', '自行车', '单车'], pace: 4 },
    { keys: ['游泳', '蛙泳', '自由泳', '仰泳', '蝶泳'], pace: 30 }
  ];
  for (const rule of paceRules) {
    if (rule.keys.some(k => q.includes(k))) return rule.pace;
  }
  return 0;
}

/**
 * 检测消息中的运动强度修饰词
 * 注意：慢跑/慢走是运动专名（本身已在配速/MET 表中），不作为"低强度"信号；
 * @param {string} q 归一化后的问题文本
 * @returns {'fast'|'slow'|null} 强度档位
 */
function detectExerciseIntensity(q) {
  // 高强度：快速骑/骑得很快/猛骑/竞速/全力/加速等（不含单字"快"，避免"快乐/痛快"类误判）
  if (/(快速|飞快|很快|好快|猛骑|猛跑|猛游|使劲|竞速|全力|加速|极速|高速|快点|快骑|快游|冲刺)/.test(q)) {
    return 'fast';
  }
  // 低强度：慢慢骑/休闲骑/骑车兜风/骑得慢等（慢跑/慢走专名不在此列）
  if (/(慢速|很慢|慢点|慢慢|悠闲|休闲|兜风|慢悠悠|慢骑|慢游)/.test(q)) {
    return 'slow';
  }
  return null;
}

/**
 * 距离型运动的配速 + MET 强度分级（用户给公里数时使用）。
 * 数值依据《身体活动汇编》(Compendium of Physical Activities)：
 *   骑行 <16km/h ≈ MET4、通勤约15km/h ≈ MET5、22-26km/h ≈ MET10；
 *   跑步 12km/h ≈ MET10；快走 6km/h ≈ MET5；快速游泳 ≈ MET10。
 * @param {string} q 归一化后的问题文本
 * @param {'fast'|'slow'|null} intensity detectExerciseIntensity 的结果
 * @returns {{pace:number, met:number, label:string|null}|null} 命中分级时返回配速(分钟/公里)、MET、展示名
 */
function getDistanceTier(q, intensity) {
  // 骑行三档：快速骑行 / 普通通勤 / 休闲慢骑（动感单车等室内器械不在此列）
  if (/骑车|骑行|自行车|单车|公路骑|山地骑/.test(q) && !/动感单车|磁控车|椭圆机|划船机/.test(q)) {
    if (intensity === 'fast') return { pace: 2.5, met: 10.0, label: '快速骑行' };
    if (intensity === 'slow') return { pace: 5, met: 3.5, label: '休闲骑行' };
    return { pace: 4, met: 5.0, label: null };
  }
  // 跑步：泛称"跑步"加高难度词 → 快跑档（慢跑/超慢跑/爬坡跑等具体跑法已在配速表中，不覆盖）
  if (intensity === 'fast' && /跑步|夜跑|晨跑|长跑|跑步机|越野跑/.test(q) && !/慢跑|超慢跑|爬坡跑/.test(q)) {
    return { pace: 5, met: 10.0, label: '快速跑' };
  }
  // 步行：泛称"走路"加高难度词 → 快走档（慢走/散步/徒步等不覆盖）
  if (intensity === 'fast' && /走路|步行|健走/.test(q) && !/慢走|散步|徒步|爬山|登山/.test(q)) {
    return { pace: 10, met: 5.0, label: '快走' };
  }
  // 游泳：高难度词 → 快速档（蝶泳/自由泳等具体泳姿 MET 已更高，不覆盖）
  if (intensity === 'fast' && /游泳|蛙泳|仰泳/.test(q) && !/蝶泳|自由泳/.test(q)) {
    return { pace: 25, met: 10.0, label: '快速游泳' };
  }
  return null;
}

/**
 * 按运动类别（骑/跑/游/走）查找今日最近一条同类运动记录。
 * 用于强度修正类追问（如"我是快速骑哦"）：消息本身不含距离/时长，
 * 从上文已沉淀的记录中取回距离/时长按新强度重算。
 * @param {string} qNorm 归一化后的问题文本
 * @param {Array} todayExercises 今日运动记录（含 name/duration/distance/calorie）
 * @returns {object|null} 命中的今日记录
 */
function findTodayExerciseRecord(qNorm, todayExercises) {
  if (!Array.isArray(todayExercises) || todayExercises.length === 0) return null;
  // 顺序即优先级：骑行含"单车"但不含"跑/游/走"，注意骑行判断避开动感单车等器械无妨（同为骑行类）
  const categories = [
    /骑车|骑行|自行车|单车|公路骑|山地骑/,
    /游泳|蛙泳|自由泳|仰泳|蝶泳|游泳/,
    /跑步|慢跑|快跑|超慢跑|夜跑|晨跑|长跑|越野跑|跑步机|爬坡跑/,
    /走路|快走|慢走|散步|健走|徒步|暴走|逛街/
  ];
  const cat = categories.find(re => re.test(qNorm));
  if (!cat) return null;
  // 取今天最后一条同类记录（最近一次对话的运动）
  for (let i = todayExercises.length - 1; i >= 0; i--) {
    const r = todayExercises[i];
    if (cat.test(String(r.name || ''))) return r;
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

  // 口语动词归一化（提前到触发判断之前，强度追问也要用）：
  // 把"跑了/走了/游了/骑了"补全为标准运动名，
  // 否则"刚才跑了3公里"既匹配不到配速表也匹配不到 MET 表，会退化成默认 30 分钟。
  // 注意顺序：具体词（慢跑/快走等）先于泛称（跑/走），避免改写破坏原有匹配
  let qNorm = q
    .replace(/慢跑了/g, '慢跑')
    .replace(/快走了/g, '快走')
    .replace(/健走了/g, '健走')
    .replace(/暴走了/g, '暴走')
    .replace(/跑了/g, '跑步')
    .replace(/游了/g, '游泳')
    .replace(/骑了/g, '骑车')
    .replace(/走了/g, '走路');
  // 强度词 + 裸动词补全："快速骑"→"快速骑车"、"慢慢游"→"慢慢游泳"，
  // 否则追问"我是快速骑哦"这类消息匹配不到运动名，强度分级也无法命中
  qNorm = qNorm
    // 高强度 + 骑/跑/游（负向断言避免"骑车/跑步/游泳"被重复替换）
    .replace(/(快速|飞快|很快|好快|猛|使劲|竞速|全力|加速|极速|高速|快点|快)骑(?!车|行)/g, '$1骑车')
    .replace(/(慢速|很慢|慢点|慢慢|悠闲|休闲|兜风|慢悠悠|慢)骑(?!车|行)/g, '$1骑车')
    .replace(/(快速|飞快|很快|好快|猛|使劲|竞速|全力|加速|极速|高速)跑(?!步)/g, '$1跑步')
    .replace(/(慢速|很慢|慢点|慢慢|悠闲|休闲|慢悠悠)跑(?!步)/g, '$1跑步')
    .replace(/(快速|飞快|猛|使劲|竞速|全力|加速|极速)游(?!泳)/g, '$1游泳')
    .replace(/(慢速|很慢|慢点|慢慢|悠闲|慢)游(?!泳)/g, '$1游泳');

  // 强度档位（快速/休闲），影响配速与 MET 分级
  const intensity = detectExerciseIntensity(qNorm);

  // 运动热量消耗计算（基于MET值，科学准确）
  // "单车"覆盖动感单车/单车，"机"覆盖椭圆机/划船机/磁控车等器械（不含"骑"字）
  const hasCalorieWord = q.includes('热量') || q.includes('消耗') || q.includes('卡路里') || q.includes('千卡');
  const hasExerciseWord = q.includes('运动') || q.includes('跑') || q.includes('走') || q.includes('游') || q.includes('跳') || q.includes('骑') || q.includes('单车') || q.includes('机') || q.includes('练') || q.includes('帕梅拉') || q.includes('周六野') || q.includes('刘畊宏');
  // 强度修正类追问（如"我是快速骑哦"）：不含热量词，但明显是针对上一条运动计算的强度纠正
  const isIntensityCorrection = !!intensity && /骑|跑|游|走|单车/.test(qNorm);

  if ((hasCalorieWord && hasExerciseWord) || isIntensityCorrection) {
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

    // 解析距离（公里）：用户只给公里数时按"强度配速"换算时长，回复以距离为主
    // （修复：此前不解析公里，"跑了3公里"会落到默认 duration=30 被说成"跑步30分钟"；
    //   且骑行固定 3min/km+MET5.5 不区分强度，"快速骑"重算结果与普通骑完全一样）
    let distanceKm = 0;
    let pacePerKm = 0;
    let distanceTier = null; // 距离型运动的强度分级 {pace, met, label}
    const distanceMatch = qNorm.match(/(\d+(?:\.\d+)?)\s*(公里|千米|km)/i);
    if (distanceMatch && !durationMatch) {
      const km = parseFloat(distanceMatch[1]);
      if (km > 0) {
        // 优先强度分级配速（骑行三档/快跑/快走/快游），无分级则走通用配速表
        const tier = getDistanceTier(qNorm, intensity);
        const pace = tier ? tier.pace : getPacePerKm(qNorm);
        if (pace > 0) {
          distanceKm = km;
          pacePerKm = pace;
          duration = Math.round(km * pace);
          distanceTier = tier;
        }
      }
    }

    // 追问兜底：消息本身没有距离/时长（如"我是快速骑哦"），从今日同类运动记录补全，
    // 按新强度重新配速/取 MET 重算；强度修正但今天根本没有同类记录时无法重算，交给 LLM
    if (distanceKm === 0 && !durationMatch) {
      const rec = findTodayExerciseRecord(qNorm, todayExercises);
      if (rec) {
        if (rec.distance > 0) {
          const tier = getDistanceTier(qNorm, intensity);
          const pace = tier ? tier.pace : getPacePerKm(qNorm);
          if (pace > 0) {
            distanceKm = rec.distance;
            pacePerKm = pace;
            duration = Math.round(rec.distance * pace);
            distanceTier = tier;
          }
        } else if (rec.duration > 0) {
          duration = rec.duration;
        }
      } else if (isIntensityCorrection) {
        return null;
      }
    }

    const qLower = qNorm.toLowerCase();

    // 1) 优先使用今天已记录的运动消耗，确保搭子回复和记录一致；
    //    但用户明确说"快速骑/慢慢骑"等强度修正时，属于要求按新强度重算，跳过记录值
    if (todayExercises && todayExercises.length > 0 && !intensity) {
      const recorded = todayExercises.find(e => {
        const name = String(e.name || '').toLowerCase();
        return name && (qLower.includes(name) || name.includes(qLower)) && Math.abs((e.duration || 0) - duration) <= 5;
      });
      if (recorded) {
        return distanceKm > 0
          ? `${recorded.name}${distanceKm}公里消耗 ${Math.round(recorded.calorie)} 千卡（与你今天的运动记录一致）。`
          : `${recorded.name}${recorded.duration}分钟消耗 ${Math.round(recorded.calorie)} 千卡（与你今天的运动记录一致）。`;
      }
    }

    // 2) 查询运动库 exercise_db，有数据就按库里 MET 计算
    const dbExercise = getExerciseFromDb(qNorm);
    if (dbExercise && dbExercise.met_value) {
      let met = parseFloat(dbExercise.met_value);
      // 强度分级覆盖：距离型用 distanceTier（配速与 MET 必须配套）；
      // 时长型仅在明确强度档（label 非空，如快速骑行）时覆盖，普通档保留运动库数值
      const tier = distanceKm > 0 ? distanceTier : getDistanceTier(qNorm, intensity);
      const applyTier = distanceKm > 0 ? !!tier : !!(tier && tier.label);
      if (applyTier && tier.met) met = tier.met;
      const displayName = (applyTier && tier.label) || dbExercise.exercise_name;
      const totalCalorie = Math.round(met * weight * (duration / 60) * 1.05);
      const paceText = tier && tier.label
        ? `按${tier.label}配速约${pacePerKm}分钟/公里`
        : `按配速约${pacePerKm}分钟/公里`;
      return distanceKm > 0
        ? `${displayName}${distanceKm}公里大约消耗 ${totalCalorie} 千卡（${paceText}≈${duration}分钟、你当前体重 ${weight}kg，MET值${met}计算）。`
        : `${displayName}${duration}分钟大约消耗 ${totalCalorie} 千卡（按运动库数据，MET值${met}计算）。`;
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
      // 普通通勤骑行约 15km/h ≈ MET5（快速/休闲分级由 getDistanceTier/getIntensityMet 处理）
      '骑车': 5.0, '骑行': 5.0, '自行车': 5.0, '动感单车': 6.0,
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
      if (qNorm.includes(exercise.toLowerCase()) && exercise.length > bestMatch.length) {
        met = value;
        bestMatch = exercise;
      }
    }
    
    if (bestMatch) {
      // 强度分级覆盖：距离型用 distanceTier（配速与 MET 配套）；
      // 时长型仅在明确强度档（label 非空，如快速骑行）时覆盖，普通档保留参考表数值
      const tier = distanceKm > 0 ? distanceTier : getDistanceTier(qNorm, intensity);
      const applyTier = distanceKm > 0 ? !!tier : !!(tier && tier.label);
      if (applyTier && tier.met) met = tier.met;
      const displayName = (applyTier && tier.label) || bestMatch;
      const durationHour = duration / 60;
      const totalCalorie = Math.round(met * weight * durationHour * 1.05);
      const paceText = tier && tier.label
        ? `按${tier.label}配速约${pacePerKm}分钟/公里`
        : `按配速约${pacePerKm}分钟/公里`;
      return distanceKm > 0
        ? `${displayName}${distanceKm}公里大约消耗 ${totalCalorie} 千卡（${paceText}≈${duration}分钟、你当前体重 ${weight}kg，MET值${met}计算）。`
        : `${displayName}${duration}分钟大约消耗 ${totalCalorie} 千卡（按你当前体重 ${weight}kg，MET值${met}计算）。`;
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
          nutrition_source: food.nutrition_source || null,
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
          calorie: ex.calorie || 0,
          // distance 由沉淀 Agent 提取（公里），强度修正类追问重算时需要用
          distance: parseFloat(ex.distance) || 0
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
  const since = getChinaDateStrOffset(-days);

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
  getRecentBodyContext,
  tryLocalCalculation
};
