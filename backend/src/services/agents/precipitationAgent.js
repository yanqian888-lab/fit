/**
 * 清理食物名称中的常见前缀/后缀填充词，并判断是否为有效食物名
 */
const FOOD_NAME_PREFIX_FILLERS = /^(?:好|我喝了|我吃了|我又喝了|我又吃了|我刚喝了|我刚吃了|早上|上午|中午|下午|晚上|今天|今早|今晚|昨天|明天|刚才|刚刚|之前|后来|现在|早餐|午餐|晚餐|加餐|吃了个|吃了一个|吃了|吃|又吃了|还吃了|刚吃了|又吃|刚吃|还吃|喝了|喝|来了|来个|来份|来点|来|点了|点个|点份|点|要了|要个|要份|要|那个|这个|刚才的|的|是|为|有|还有|我又|我又要|我又没|就|只是|不过|但是|而且|了|一个|一份|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一片|一只|一口|一点|一些|少量|适量|个|份|多|少)+/;
// 大/小/中 规格修饰 + 量词的组合（如"大杯奶茶""小碗粥"），仅在非语义保护名时剥除
// 注意不含"大半/小半"——它们是数量词（半个同类），由 stripLeadingQuantity 的 halfWholePattern 处理
const FOOD_NAME_SIZE_PREFIX = /^(?:大杯|小杯|大份|小份|中份|大碗|小碗|大盘|小盘|大个|小个)+/;
// 以大/小/中/数字开头但属于食物名本身的常见词条——剥除前优先保护，
// 避免"大闸蟹"被误剥成"闸蟹"、"三杯鸡"被误剥成"鸡"
const SIZE_PREFIX_FOOD_NAMES = new Set([
  '大闸蟹', '大虾', '大虾米', '大排', '大排骨', '大葱', '大蒜', '大豆', '大枣', '大麦', '大麦茶', '大白菜', '大头菜', '大豆油', '大列巴', '大红袍', '大黄鱼', '大米', '大米粥', '大骨汤', '大果粒', '大馄饨', '大饼', '大鸡腿', '大鸡排', '大福',
  '小笼包', '小馄饨', '小龙虾', '小番茄', '小米', '小米粥', '小白菜', '小酥肉', '小排', '小排骨', '小香肠', '小油菜', '小葱', '小笼', '小馕', '小蛋糕', '小饼干', '小面包', '小丸子', '小酥饼', '小鱼干', '小虾米', '小笼饺', '小汤圆',
  '中翅', '中翅根', '大盘鸡',
  '三杯鸡', '四喜丸子', '八宝粥', '九转大肠', '二锅头', '五仁月饼', '七喜', '六安瓜片', '三鲜豆皮', '点心', '早点'
]);
/**
 * 语义保护判断：判断名字是否为以大/小/中开头的有效食物名（而非量词修饰）
 * 优先查食品库（库中存在的名字即有效食物名），再查常见词典；都未命中返回 false
 * @param {string} name 待判断的食物名
 * @returns {boolean} true=是食物名本体，应保护不剥除
 */
function isProtectedFoodName(name) {
  if (!name || name.length < 2) return false;
  if (SIZE_PREFIX_FOOD_NAMES.has(name)) return true;
  try {
    const row = getFoodNutrition(name, null, { minConfidence: 'medium' });
    if (row && row.food_name) return true;
  } catch (e) { /* 库查询失败按未保护处理 */ }
  return false;
}
const FOOD_NAME_SUFFIX_FILLERS = /(?:一个|一份|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一片|一只|一口|一点|一些|少量|适量|多|少|的|了|吃|喝|还有|不过|但是|而且)$/;
const FOOD_NAME_STOP_ONLY = /^(?:早上|上午|中午|下午|晚上|今天|今早|今晚|昨天|明天|刚才|刚刚|之前|后来|现在|早餐|午餐|晚餐|加餐|吃|吃了|喝了|还吃|又吃|刚吃|又吃了|还吃了|刚吃了|吃了个|吃了一个|那个|这个|刚才的|的|是|为|有|还有|我又|我又要|我又没|就|只是|不过|但是|而且|一个|一份|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一片|一只|一口|一点|一些|少量|适量|多|少)+$/;

/**
 * 进一步去掉数字+单位、动词+数量等残留前缀
 * 例如 "15克油面筋" → "油面筋"、"还喝了一杯黑咖啡" → "黑咖啡"、
 * "2两大闸蟹" → "大闸蟹"（数字量词无条件剥除，与大小修饰的语义保护无关）
 */
function stripLeadingQuantity(name) {
  if (!name) return '';
  // 数字+单位：覆盖传统计量（两/斤/千克）与水果颗粒量词（颗/粒/瓣/串）等
  const qtyUnitPattern = /^\d+(?:\.\d+)?\s*(?:毫升|ml|ML|克|g|千克|公斤|kg|斤|两|颗|粒|瓣|串|条|支|张|枚|打|杯|瓶|盒|罐|碗|个|份|片|根|只|块|勺|包|袋)\s*/i;
  // 中文数字+量词（如"十颗草莓""三斤樱桃""两个香蕉"）
  // 剥后不足2字则回退：防"三杯鸡"（数字+量词字+真食物名）被误剥成"鸡"
  const cnQtyPattern = /^[一二三四五六七八九十百两几]+(?:毫升|克|千克|公斤|斤|两|颗|粒|瓣|串|条|支|张|枚|打|杯|瓶|盒|罐|碗|个|份|片|根|只|块|勺|包|袋)\s*/;
  const halfWholePattern = /^(?:半|大半|小半|整)(?:包|袋|碗|杯|盒|瓶|根|片|块|个|只|口|勺|份|斤|两|颗|粒|瓣|串)\s*/;
  const actionQtyPattern = /^(?:好[，,]\s*)?(?:我)?(?:又|还|刚|先|然后|接着|再|也就|只|顺便)?(?:吃|喝)(?:了|过)?(?:一个|一份|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一片|一只|一口|一点|一些|少量|适量|半包|半袋|半碗|半杯|大半|小半|整包|整袋|整碗|整杯|盘|碟)?\s*/;
  // 烹饪/点单动词+量词（如"烤个烤榴莲酥"→"烤榴莲酥"）：量词必选，
  // 避免误伤"烤鸭""煮鸡蛋""点心""蒸碗糕"等含动词字的食物名
  const cookActionPattern = /^(?:烤|蒸|煮|炒|炸|煎|炖|烫|涮|点|打包)(?:了)?(?:个|一个|一份|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一片|一只|半份|半碗|半杯|大盘|小盘)\s*/;
  // 烹饪动词+了+无量词（如"炖了大骨汤"→"大骨汤"），含"点了外卖"→"外卖"
  const cookDonePattern = /^(?:烤|蒸|煮|炒|炸|煎|炖|烫|涮|点|打包|点了)了\s*/;
  let cleaned = name.trim();
  // 中文数字量词单独处理：剥后不足2字则回退原名（保护"三杯鸡"类真食物名）
  const afterCn = cleaned.replace(cnQtyPattern, '').trim();
  if (afterCn !== cleaned && afterCn.length >= 2) cleaned = afterCn;
  while (true) {
    const next = cleaned
      .replace(qtyUnitPattern, '')
      .replace(halfWholePattern, '')
      .replace(actionQtyPattern, '')
      .replace(cookActionPattern, '')
      .replace(cookDonePattern, '')
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function cleanFoodName(name) {
  if (!name) return '';
  let cleaned = name.trim();
  // --- 前置清理：剥离所有标点符号 ---
  // 去掉中英文标点（逗号、句号、感叹、问号、分号、顿号、引号、括号等），
  // 让后续 FOOD_NAME_PREFIX_FILLERS / FOOD_NAME_SUFFIX_FILLERS 的循环能顺畅匹配和剥离填充词。
  // 典型案例："好，我喝了一杯低脂牛奶，180ml" 原来因逗号阻断 prefix 正则，
  // 只剥离了开头的 "好"，余下 "，我喝了一杯低脂牛奶，180ml" 无法继续清理。
  cleaned = cleaned.replace(/[，。！？；：、"'""''（）\[\]{}\(\)…—,.;:!?'"()\[\]{}]/g, ' ');
  // 去掉末尾数字+单位（如 "180ml" "250g" "西瓜5斤"）
  cleaned = cleaned.replace(/\d+(?:\.\d+)?\s*(?:毫升|ml|ML|克|g|千克|公斤|kg|斤|两|颗|粒|瓣|串|条|支|张|枚|打|杯|瓶|盒|罐|碗|个|份|片|根|只|块|勺|包|袋)\s*$/i, '');
  // 多空格合并为单空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 循环去除前缀填充词，直到没有变化；一旦剥出受保护的食物名（词典/库命中，
  // 如"点心""大闸蟹"）立即停止，语义优先，避免"点心"被裸动词"点"误剥成"心"
  while (true) {
    if (isProtectedFoodName(cleaned)) break;
    const next = cleaned.replace(FOOD_NAME_PREFIX_FILLERS, '').trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  cleaned = cleaned.replace(FOOD_NAME_SUFFIX_FILLERS, '').trim();
  // 语义判断剥除大小修饰：剥完口语词后，若剩余名字本身是有效食物名
  // （词典/食品库命中，如"大闸蟹"），则保留大小前缀不剥；仅对量词修饰
  // （如"大杯奶茶""小碗粥"）剥除，避免一刀切破坏食物名
  if (!isProtectedFoodName(cleaned)) {
    let sizeStripped = cleaned.replace(FOOD_NAME_SIZE_PREFIX, '').trim();
    if (sizeStripped !== cleaned) {
      cleaned = sizeStripped;
      // 大小词剥除后可能残留"的/了"等口语连接，再循环剥一次前缀
      while (true) {
        const next = cleaned.replace(FOOD_NAME_PREFIX_FILLERS, '').trim();
        if (next === cleaned) break;
        cleaned = next;
      }
      cleaned = cleaned.replace(FOOD_NAME_SUFFIX_FILLERS, '').trim();
    }
  }
  // 额外去掉数字+单位、动词+数量等残留前缀
  cleaned = stripLeadingQuantity(cleaned);
  return cleaned;
}

function isInvalidFoodName(name) {
  if (!name || name.length < 2) return true;
  if (FOOD_NAME_STOP_ONLY.test(name)) return true;
  // 整句话被误当食物名的拦截：LLM 偶尔把"哦买噶 这么多热量 我今晚不吃饭"这类
  // 聊天话术整体填进 name。特征：过长、含人称/语气/感叹词、含讨论性词汇（热量/千卡）。
  // 正常食物名一般 2~10 个汉字（如"零糖零脂希腊酸奶"7字、"西红柿炒鸡蛋"6字）。
  if (name.length > 12) return true;
  if (/[我你他她它们吗呢吧啊呀哦嗯哈嘛呗哎唉哇呜诶]/.test(name)) return true;
  if (/(热量|千卡|大卡|千焦|卡路里|这么多|怎么办|决定|发誓|以后|再也|不[吃喝]|没[吃喝])/.test(name)) return true;
  // 常见闲聊名词拦截："今天天气不错"被兜底拆出「天气不错」当食物入库的真实案例
  if (/(天气|心情|压力|加班|上班|公司|会议|电影|游戏|手机|电视|考试|老板|同事|客户|周末|股票)/.test(name)) return true;
  return false;
}

/**
 * 含热量的饮品关键词（不应沉淀为喝水习惯，应走饮食记录）
 */
const BEVERAGE_FOOD_KEYWORDS = [
  '牛奶', '酸奶', '豆浆', '豆奶', '奶昔', '咖啡', '奶茶',
  '果汁', '可乐', '雪碧', '汽水', '苏打水', '碳酸饮料',
  '啤酒', '红酒', '白酒', '葡萄酒', '鸡尾酒',
  '椰汁', '核桃露', '杏仁露', '燕麦奶', '养乐多', '优酸乳',
  '饮料'
];

function isBeverageFoodContent(content) {
  if (!content) return false;
  const text = String(content);
  return BEVERAGE_FOOD_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * 把 LLM 误识别为喝水习惯的饮品消息，转成 diet_record
 */
function convertBeverageHabitToDiet(item, content, userId = null, recordDate = null) {
  if (item.type !== 'habit') return item;
  const data = item.extracted_data || {};
  const subType = data.sub_type || 'water';
  if (subType !== 'water' && subType !== '喝水') return item;
  if (!isBeverageFoodContent(content)) return item;

  let value = parseFloat(data.value) || 0;
  let unit = String(data.unit || 'ml').toLowerCase();
  let namePart = content;

  // 优先从原文解析数量和单位，并截取出饮品名称
  const qtyMatch = content.match(/(\d+(?:\.\d+)?)\s*(毫升|ml|克|g|杯|瓶|盒|罐|碗)/i);
  if (qtyMatch) {
    value = parseFloat(qtyMatch[1]);
    unit = qtyMatch[2].toLowerCase();
    const idx = content.indexOf(qtyMatch[0]) + qtyMatch[0].length;
    namePart = content.slice(idx).replace(/^[\s的]+/, '');
  }

  // 把常见饮品单位换算成克（近似 ml=1g）
  let weight = value;
  if (['杯'].includes(unit)) weight = value * 250;
  else if (['瓶'].includes(unit)) weight = value * 500;
  else if (['盒'].includes(unit)) weight = value * 200;
  else if (['罐'].includes(unit)) weight = value * 330;
  else if (['碗'].includes(unit)) weight = value * 250;

  const cleanedName = cleanFoodName(namePart) || '饮品';
  const nutrition = getFoodNutrition(cleanedName) || {};
  const caloriePer100g = nutrition.calorie_per_100g || 0;
  const ratio = weight > 0 ? weight / 100 : 0;

  // 查询用户今天已有的餐别，用于午饭时段二次判断
  const today = recordDate || getChinaDateStr();
  let existingMeals = [];
  if (userId) {
    try {
      existingMeals = db.prepare(`
        SELECT DISTINCT meal_time FROM diet_records
        WHERE user_id = ? AND record_date = ? AND status = 1
      `).pluck().all(userId, today);
    } catch (e) {
      console.error('[convertBeverageHabitToDiet] 查询已有餐别失败:', e.message);
    }
  }

  const food = {
    name: cleanedName,
    weight: Math.round(weight),
    quantity: 1,
    unit: 'g',
    calorie: Math.round(caloriePer100g * ratio),
    protein: Math.round((nutrition.protein_per_100g || 0) * ratio * 10) / 10,
    carb: Math.round((nutrition.carb_per_100g || 0) * ratio * 10) / 10,
    fat: Math.round((nutrition.fat_per_100g || 0) * ratio * 10) / 10
  };

  item.type = 'diet_record';
  item.sub_type = undefined;
  item.extracted_data = {
    foods: [food],
    total_calorie: food.calorie,
    total_protein: food.protein,
    total_carb: food.carb,
    total_fat: food.fat,
    meal_time: inferMealTimeByContent(content) || normalizeMealTime(null, content, [], existingMeals)
  };
  item.reason = (item.reason || '') + '（饮品校正为饮食记录）';
  
  return item;
}

/**
 * 兜底补回用户明确写出热量的食物（如"卤鸭腿160千卡"）
 * 防止LLM将其误判为热量修正而丢弃
 */
function recoverExplicitCalorieFoods(content, data) {
  if (!data || !Array.isArray(data.foods) || !content) return data;
  const foods = data.foods;
  const regex = /([^，,、；;。]+?)\s*(\d+(?:\.\d+)?)\s*(千卡|kcal|大卡|卡路里)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const fullMatch = match[0];
    const rawName = match[1].trim();
    const calorie = parseFloat(match[2]);
    if (!rawName || rawName.length < 2 || isNaN(calorie) || calorie <= 0) continue;
    // 跳过热量汇总表述
    if (/(热量|总|一共|累计|总共|卡路里|千卡|大卡|^是$|^为$|多少)/.test(rawName)) continue;

    let foodName = cleanFoodName(rawName);
    // 如果前缀清理后不是有效食物名，尝试取"X大卡的YY"中的YY
    if (!foodName || isInvalidFoodName(foodName)) {
      const matchEnd = match.index + fullMatch.length;
      const after = content.slice(matchEnd);
      const afterMatch = after.match(/^\s*的\s*([^，,、；;。\s]{1,15})/);
      if (afterMatch) {
        foodName = cleanFoodName(afterMatch[1]);
      }
    }
    if (!foodName || isInvalidFoodName(foodName)) continue;

    // 如果已存在（名称互相包含），不再重复添加
    const exists = foods.some(f => {
      if (!f || !f.name) return false;
      const fn = cleanFoodName(f.name);
      return fn === foodName || foodName.includes(fn) || fn.includes(foodName);
    });
    if (exists) continue;

    foods.push({
      name: foodName,
      weight: 0,
      quantity: 1,
      unit: 'g',
      calorie,
      protein: 0,
      carb: 0,
      fat: 0
    });
    
  }
  data.foods = foods;
  return data;
}

/**
 * 清理食物名称并过滤掉非食物（如"中午还吃了一个"）
 */
function sanitizeFoodNames(content, data) {
  if (!content || !Array.isArray(data.foods)) return data;
  const cleanedFoods = [];
  for (const food of data.foods) {
    if (!food || !food.name) {
      cleanedFoods.push(food);
      continue;
    }
    const name = cleanFoodName(food.name);
    if (isInvalidFoodName(name)) {
      
      continue;
    }
    food.name = name;
    cleanedFoods.push(food);
  }
  data.foods = cleanedFoods;
  return data;
}

/**
 * 把"半个/半根/半片..."等分数表达修正为 quantity=0.5
 */
function normalizeHalfQuantities(content, data) {
  if (!content || !Array.isArray(data.foods)) return data;
  const halfUnits = ['个', '根', '片', '块', '碗', '杯', '勺', '只', '条', '颗', '粒', '把', '瓣', '份', '盒', '袋', '瓶'];
  for (const food of data.foods) {
    if (!food.unit || food.quantity !== 1) continue;
    if (halfUnits.includes(food.unit) && content.includes(`半${food.unit}`)) {
      food.quantity = 0.5;
      
    }
  }
  return data;
}

/**
 * 判断原消息中是否明确给出了某食物的重量或体积（ml/ml 等）
 * 体积单位（ml/ml）按 1:1 克近似处理（水/奶/饮料密度≈1g/ml，误差在合理范围内）
 * 返回 { found: boolean, value: number, unit: string } 便于上层换算
 */
function hasExplicitWeight(content, foodName) {
  if (!content || !foodName) return { found: false };
  const escaped = foodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 克/千克/公斤/斤/毫克（千 仅在非"千卡/千焦"时才算重量单位，避免"350千卡"被误读成350千克）
  const gramRegex = new RegExp(escaped + '[^\\n]*?(\\d+(?:\\.\\d+)?)\\s*([公斤克千mg]+)(?![卡焦])(?!\\w)', 'i');
  const gramMatch = content.match(gramRegex);
  if (gramMatch) {
    let v = parseFloat(gramMatch[1]);
    const u = gramMatch[2].toLowerCase();
    if (u.includes('千') || u.includes('公')) v *= 1000;  // 千克/公斤→克
    else if (u.includes('斤')) v *= 500;                  // 斤→克（1斤=500g）
    else if (u.includes('m')) v = v / 1000;               // mg→g（极小，基本不会出现）
    return { found: true, value: v, unit: 'g' };
  }
  // ml / mL / 毫升
  const mlRegex = new RegExp(escaped + '[^\\n]*?(\\d+(?:\\.\\d+)?)\\s*(ml|mL|ML|毫升)(?!\\w)', 'i');
  const mlMatch = content.match(mlRegex);
  if (mlMatch) {
    const v = parseFloat(mlMatch[1]);
    // 体积 1ml ≈ 1g（对牛奶/水/饮料足够近似）
    return { found: true, value: v, unit: 'ml' };
  }
  return { found: false };
}

/**
 * 兼容旧接口名，保留 hasExplicitGramWeight 但内部已扩展为克+体积
 */
function hasExplicitGramWeight(content, foodName) {
  return hasExplicitWeight(content, foodName).found;
}

/**
 * 根据原消息推断食物的计数数量
 */
function inferCountFromContent(content, foodName) {
  if (!content || !foodName) return null;
  const escaped = foodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const countUnits = '[个只片块杯碗勺条颗粒瓣份盒袋瓶根口]';
  // 半个/半只/半片...
  if (new RegExp(`半\\s*${countUnits}?\\s*${escaped}`).test(content)) {
    return { quantity: 0.5, unit: '个' };
  }
  // X个/片/根...
  const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${countUnits})\\s*${escaped}`, 'i');
  const match = content.match(regex);
  if (match) {
    return { quantity: parseFloat(match[1]), unit: match[2] };
  }
  return null;
}

/**
 * 校验并修正 LLM 估算的食物重量，避免“半个彩椒 497g”这类离谱值
 */
function sanitizeFoodWeights(content, data) {
  if (!content || !Array.isArray(data.foods)) return data;
  for (const food of data.foods) {
    // --- 第一步：强制把食物名清洗成干净实体 ---
    // LLM 常输出整句话如 "好，我喝了一杯低脂牛奶，180ml"，
    // cleanFoodName 会剥离填充词/标点/数字单位得到 "低脂牛奶"。
    // 如果名字被替换了，AI 基于脏名字估的 calorie/营养素大概率是幻觉，清掉让后端从食物库重算。
    const rawName = food.name || '';
    const name = cleanFoodName(rawName);
    if (name && name !== rawName) {
      food.name = name;
      food.calorie = 0;
      food.protein = 0;
      food.carb = 0;
      food.fat = 0;
    }

    let unit = food.unit || 'g';
    let quantity = parseFloat(food.quantity);
    if (isNaN(quantity) || quantity <= 0) quantity = 1;
    const currentWeight = parseFloat(food.weight) || 0;

    // --- 用户明确给了重量（g/千克）或体积（ml/ml），直接信任并换算 ---
    // 体积按 1ml ≈ 1g 处理（水/奶/饮料密度≈1，误差在合理范围）
    const explicit = hasExplicitWeight(content, name);
    if (explicit.found && explicit.value > 0) {
      const actualWeight = explicit.value;        // ml 已近似为 g
      const weightChanged = Math.abs(currentWeight - actualWeight) > 0.5;
      if (weightChanged || currentWeight <= 0) {
        food.weight = actualWeight;
        food.unit = 'g';
        food.quantity = 1;
        // 用户给了真实重量，清掉 AI 幻觉的 calorie/营养素让 computeFoodNutrition 从食物库重算
        food.calorie = 0;
        food.protein = 0;
        food.carb = 0;
        food.fat = 0;
      }
      continue;
    }

    // --- 用户没给重量但有 AI 估的 calorie + weight，校验 AI 给的 unit/weight 是否合理 ---
    let expectedUnit = unit;
    let expectedQty = quantity;
    if ((unit === 'g' || unit === '克') && currentWeight > 0) {
      const inferred = inferCountFromContent(content, name);
      if (inferred) {
        expectedUnit = inferred.unit;
        expectedQty = inferred.quantity;
      } else {
        continue; // 没有计数信息，无法校验
      }
    }

    const typicalPerUnit = getTypicalWeight(name, expectedUnit);
    if (!typicalPerUnit) continue;

    const expectedWeight = expectedQty * typicalPerUnit;
    const threshold = Math.max(expectedWeight * 1.5, typicalPerUnit * 3);

    if (currentWeight <= 0 || currentWeight > threshold) {
      food.weight = expectedWeight;
      food.unit = expectedUnit;
      food.quantity = expectedQty;
      // 重量被修正了，清掉 AI 幻觉的 calorie/营养素
      food.calorie = 0;
      food.protein = 0;
      food.carb = 0;
      food.fat = 0;
    }
  }
  return data;
}


/**
 * 兜底：聊天记录里明确写了「已知运动 + 时长」，但 LLM 没有提取成 exercise_record 时，
 * 通过关键词扫描补回。避免「早餐吃了…然后哑铃臀腿40分钟…」这类消息只记录饮食。
 */
const EXERCISE_PREFIX_FILLERS = /^(?:然后|接着|再|又|刚|就|还|也|先|后|最后|并且|不过|但是|而且|练了|做了|运动了|锻炼了|训练了|了|的|吃|喝)+/;

function cleanExerciseName(name) {
  return name.replace(EXERCISE_PREFIX_FILLERS, '').trim();
}

function extractExerciseNamesAroundKeyword(content, kw, startIdx) {
  // 向前后扩展中文，获取完整运动名称
  let start = startIdx;
  while (start > 0 && /[\u4e00-\u9fa5]/.test(content[start - 1]) && startIdx - start < 6) start--;
  let end = startIdx + kw.length;
  while (end < content.length && /[\u4e00-\u9fa5]/.test(content[end]) && end - start < 10) end++;
  return cleanExerciseName(content.slice(start, end));
}

/**
 * 爬楼层数兜底：用户说"爬了N层/爬N层楼"时没有分钟数，LLM 常因无法换算时长而漏提取
 * （或输出 duration=0 被有效性校验过滤）。
 * 单位语义保留：输出 {count, unit:'层'}，热量与时长换算由保存侧按运动库/联网核实数据计算，
 * 严禁把"N层"硬凑成"N分钟"（用户反馈过"爬6层楼梯记录成6分钟"的问题）。
 * @param {string} content 用户消息原文
 * @param {Array} rawItems LLM 提取的沉淀条目数组（原地补全或追加）
 * @param {Set<string>} [seenNames] 已提取运动名集合，避免重复追加
 */
function enrichStaircaseExercise(content, rawItems, seenNames) {
  if (!content || !Array.isArray(rawItems)) return;
  // 匹配"爬了6层""爬6层楼""爬过10层"等表述
  const floorMatch = content.match(/爬(?:了|过)?\s*(\d+(?:\.\d+)?)\s*层/);
  if (!floorMatch) return;
  const floors = parseFloat(floorMatch[1]);
  if (!(floors > 0)) return;

  // 1) 已提取的爬楼类运动：打上单位语义
  //    - LLM 常把"爬了20层"误提取为 duration=20（层数当分钟）：duration 数值恰等于层数时纠正
  //    - duration 与层数不等（如"20层花了15分钟"）：保留用户给的独立时长，同时补单位数量
  let patched = false;
  for (const item of rawItems) {
    if (item.type !== 'exercise_record' || !item.extracted_data || !Array.isArray(item.extracted_data.exercises)) continue;
    for (const e of item.extracted_data.exercises) {
      if (!/爬楼|楼梯/.test(e.name || '') || parseFloat(e.count) > 0) continue;
      const dur = parseFloat(e.duration) || 0;
      e.count = floors;
      e.unit = '层';
      // 时长恰等于层数 → 判定为"层数误当分钟"，清除时长交由单位换算
      // 时长与层数不同且有效 → 用户同时给了分钟数，保留
      if (!(dur > 0) || Math.abs(dur - floors) < 0.001) {
        e.duration = 0;
      }
      e.calorie = 0;
      patched = true;
    }
  }

  // 2) LLM 完全漏提取 → 兜底追加一条带单位数量的爬楼梯运动记录
  const alreadyHasStair = (seenNames ? [...seenNames] : []).some(n => /爬楼|楼梯/.test(n));
  if (!patched && !alreadyHasStair) {
    rawItems.push({
      extracted: true,
      type: 'exercise_record',
      confidence: 0.9,
      extracted_data: {
        exercises: [{ name: '爬楼梯', count: floors, unit: '层', duration: 0, intensity: 'moderate', calorie: 0 }],
        total_duration: 0,
        total_calorie: 0
      },
      tags: ['运动']
    });
    if (seenNames) seenNames.add('爬楼梯');
  }
}

/**
 * 通用"非时长单位"运动兜底：N个俯卧撑/深蹲/仰卧起坐、跳绳N下等。
 * 与爬楼梯兜底同理：保留 count/unit 原始语义，时长与热量交由保存侧按库/联网核实数据换算。
 * 骑行/跑步的公里数走 distance 字段机制（有配速可估时长），不在此处理。
 * @param {string} content 用户消息原文
 * @param {Array} rawItems LLM 提取的沉淀条目数组（原地补全或追加）
 * @param {Set<string>} seenNames 已提取运动名集合
 */
function enrichUnitBasedExercises(content, rawItems, seenNames) {
  if (!content || !Array.isArray(rawItems)) return;
  // 自重/跳跃类动作按"个/下"计：做了30个俯卧撑、跳绳1000下、50个深蹲
  // 两种语序：数量在前（"30个俯卧撑"）/ 数量在后（"俯卧撑30个"）
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:个|下|次)\s*(俯卧撑|深蹲|徒手深蹲|仰卧起坐|卷腹|开合跳|波比跳|引体向上|臀桥|跳绳)/g,
    /(俯卧撑|深蹲|徒手深蹲|仰卧起坐|卷腹|开合跳|波比跳|引体向上|臀桥|跳绳)\s*(\d+(?:\.\d+)?)\s*(?:个|下|次)/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      // 模式1：m[1]=数量 m[2]=动作名；模式2：m[1]=动作名 m[2]=数量
      const count = parseFloat(re === patterns[0] ? m[1] : m[2]);
      const rawName = (re === patterns[0] ? m[2] : m[1]).trim();
      if (!(count > 0) || !rawName) continue;
      const already = [...seenNames].some(n => n === rawName || n.includes(rawName) || rawName.includes(n));
      // 已提取条目缺 count/unit → 原地补全；LLM 误把"30个"当 duration=30 时纠正
      let patched = false;
      for (const item of rawItems) {
        if (item.type !== 'exercise_record' || !item.extracted_data || !Array.isArray(item.extracted_data.exercises)) continue;
        for (const e of item.extracted_data.exercises) {
          if (parseFloat(e.count) > 0) continue;
          if (e.name === rawName || (e.name || '').includes(rawName) || rawName.includes(e.name || '')) {
            const dur = parseFloat(e.duration) || 0;
            e.count = count;
            e.unit = '个';
            // 时长恰等于个数 → "个数误当分钟"，清除时长交由单位换算；否则保留独立时长
            if (!(dur > 0) || Math.abs(dur - count) < 0.001) {
              e.duration = 0;
            }
            e.calorie = 0;
            patched = true;
          }
        }
      }
      if (!patched && !already) {
        rawItems.push({
          extracted: true,
          type: 'exercise_record',
          confidence: 0.85,
          extracted_data: {
            exercises: [{ name: rawName, count, unit: '个', duration: 0, intensity: 'moderate', calorie: 0 }],
            total_duration: 0,
            total_calorie: 0
          },
          tags: ['运动']
        });
        seenNames.add(rawName);
      }
    }
  }
}

/**
 * 运动关键词表：用于检测 LLM 是否把运动误判为饮食记录
 * 当 diet_record 的 food_name 含这些关键词时，应转为 exercise_record
 */
const EXERCISE_KEYWORDS = [
  '俯卧撑', '深蹲', '徒手深蹲', '仰卧起坐', '卷腹', '开合跳', '波比跳',
  '引体向上', '臀桥', '跳绳', '平板支撑', '爬楼梯', '爬楼', '登山跑',
  '高抬腿', '弓步蹲', '硬拉', '卧推', '划船', '推举', '弯举',
  '哑铃', '杠铃', '壶铃', '弹力带',
  '跑步', '慢跑', '快跑', '超慢跑', '走路', '快走', '散步',
  '游泳', '骑车', '骑行', '瑜伽', '太极', '拳击', '跆拳道',
  '篮球', '足球', '羽毛球', '乒乓球', '网球',
  'HIIT', 'Tabata', '有氧', '力量训练'
];

/**
 * 后处理纠正：LLM 把运动误判为饮食记录的情况
 * 如"做了30个俯卧撑"→diet_record(food_name="做了30个俯卧撑")
 * 检测 food_name 含运动关键词时，将 diet_record 转为 exercise_record，
 * 并从原文提取 count/unit/duration 等运动字段
 * @param {string} content 原文
 * @param {Array} rawItems LLM 提取的条目数组
 * @returns {Array} 纠正后的条目数组
 */
function convertMisclassifiedExercises(content, rawItems) {
  if (!Array.isArray(rawItems)) return rawItems;
  const result = [];
  for (const item of rawItems) {
    if (item.type !== 'diet_record' || !item.extracted_data?.foods) {
      result.push(item);
      continue;
    }
    // 检查是否有食物名含运动关键词
    const exerciseFoods = [];
    const realFoods = [];
    for (const food of item.extracted_data.foods) {
      const name = String(food.name || '');
      const isExercise = EXERCISE_KEYWORDS.some(kw => name.includes(kw));
      if (isExercise) {
        exerciseFoods.push(food);
      } else {
        realFoods.push(food);
      }
    }
    if (exerciseFoods.length === 0) {
      result.push(item);
      continue;
    }
    // 有误判食物：提取运动信息并转为 exercise_record
    const exercises = exerciseFoods.map(f => {
      const name = String(f.name || '');
      // 找匹配的运动关键词
      const matchedKw = EXERCISE_KEYWORDS.find(kw => name.includes(kw)) || name;
      // 从原文提取数量
      const countMatch = content.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:个|下|次|组)\\s*' + matchedKw)) 
        || content.match(new RegExp(matchedKw + '\\s*(\\d+(?:\\.\\d+)?)\\s*(?:个|下|次|组)'));
      const count = countMatch ? parseFloat(countMatch[1]) : (parseFloat(f.quantity) || 0);
      const unit = countMatch ? (countMatch[0].includes('个') ? '个' : countMatch[0].includes('下') ? '下' : countMatch[0].includes('次') ? '次' : '个') : '个';
      // 从原文提取时长
      const durMatch = content.match(/(\d+(?:\.\d+)?)\s*分钟/);
      const duration = durMatch ? parseFloat(durMatch[1]) : 0;
      return {
        name: matchedKw,
        count: count > 0 ? count : undefined,
        unit: count > 0 ? unit : undefined,
        duration,
        intensity: 'moderate',
        calorie: 0
      };
    });
    // 如果还有真实食物，保留修正后的 diet_record
    if (realFoods.length > 0) {
      result.push({
        ...item,
        extracted_data: { ...item.extracted_data, foods: realFoods }
      });
    }
    // 添加转换后的 exercise_record
    result.push({
      extracted: true,
      type: 'exercise_record',
      confidence: 0.85,
      extracted_data: {
        exercises,
        total_duration: exercises.reduce((s, e) => s + (parseFloat(e.duration) || 0), 0),
        total_calorie: 0
      },
      tags: ['运动']
    });
    console.log(`[沉淀] 检测到运动被误判为饮食，已纠正：${exercises.map(e => e.name).join(', ')}`);
  }
  return result;
}

/**
 * 防御：LLM 把闲聊/情绪语句误判为饮食记录（如"心情不太好"→diet_record）
 * 检查食物名是否为整句/含情绪词，是则丢弃该食物条目
 * @param {string} content 原文
 * @param {Array} rawItems LLM 提取的条目数组
 * @returns {Array} 清理后的条目数组
 */
function sanitizeSuspiciousFoodNames(content, rawItems) {
  if (!Array.isArray(rawItems)) return rawItems;
  // 情绪/闲聊关键词
  const emotionKeywords = ['心情', '累', '烦', '开心', '难过', '焦虑', '崩溃', '无语',
    '兴奋', '激动', '失落', '沮丧', '生气', '委屈', '疲惫', '困', '饿', '馋', '饱',
    '睡不着', '压力大', '不想', 'emo', '今天', '最近', '感觉', '有点'];
  for (const item of rawItems) {
    if (item.type !== 'diet_record' || !item.extracted_data?.foods) continue;
    item.extracted_data.foods = item.extracted_data.foods.filter(food => {
      const name = String(food.name || '').trim();
      if (!name) return false;
      // 食物名=整句（长度>10且与原文相似度高）→ 丢弃
      if (name.length > 10 && content.includes(name)) {
        console.log(`[沉淀] 可疑食物名(整句)已丢弃: "${name.substring(0, 20)}"`);
        return false;
      }
      // 食物名含情绪词且不含实质食物名 → 丢弃
      const hasEmotion = emotionKeywords.some(kw => name.includes(kw));
      const realFoodKeywords = ['蛋', '奶', '米饭', '面条', '面包', '馒头', '粥', '汤',
        '肉', '鱼', '鸡', '牛', '猪', '羊', '菜', '果', '瓜', '茶', '咖啡', '水',
        '豆腐', '粉', '饼', '饺', '包子', '沙拉', '酸奶', '豆浆'];
      const hasRealFood = realFoodKeywords.some(kw => name.includes(kw));
      if (hasEmotion && !hasRealFood) {
        console.log(`[沉淀] 可疑食物名(情绪词)已丢弃: "${name}"`);
        return false;
      }
      return true;
    });
  }
  return rawItems;
}

function recoverMissedExercises(content, rawItems) {
  if (!content || !Array.isArray(rawItems)) return rawItems;

  const knownExercises = Object.keys(EXERCISE_MET_VALUES).sort((a, b) => b.length - a.length);
  const seenNames = new Set();

  // 收集 LLM 已经提取的运动名，避免重复兜底
  for (const item of rawItems) {
    if (item.type !== 'exercise_record') continue;
    for (const e of item.extracted_data?.exercises || []) {
      if (e.name) seenNames.add(e.name);
    }
  }

  // 爬楼层数兜底："爬了6层"无分钟数时保留层数单位，交由保存侧联网核实换算
  enrichStaircaseExercise(content, rawItems, seenNames);
  // 通用单位兜底："30个俯卧撑""跳绳1000下"等按个计的运动
  enrichUnitBasedExercises(content, rawItems, seenNames);

  for (const kw of knownExercises) {
    if (!content.includes(kw)) continue;
    let idx = content.indexOf(kw);
    while (idx !== -1) {
      const rawName = extractExerciseNamesAroundKeyword(content, kw, idx);
      if (!rawName || rawName.length < 2) {
        idx = content.indexOf(kw, idx + 1);
        continue;
      }

      // 在运动名后 15 个字符内找「X分钟」
      const after = content.slice(idx + kw.length, idx + kw.length + 15);
      const durMatch = after.match(/(\d+(?:\.\d+)?)\s*分钟/);
      if (durMatch) {
        const duration = parseFloat(durMatch[1]);
        const alreadyExtracted = [...seenNames].some(n =>
          n === rawName || n.includes(rawName) || rawName.includes(n)
        );
        if (!alreadyExtracted && duration > 0) {
          rawItems.push({
            extracted: true,
            type: 'exercise_record',
            confidence: 0.9,
            extracted_data: {
              exercises: [{ name: rawName, duration, intensity: 'moderate', calorie: 0 }],
              total_duration: duration,
              total_calorie: 0
            },
            tags: ['运动']
          });
          seenNames.add(rawName);
          
        }
      }
      idx = content.indexOf(kw, idx + 1);
    }
  }
  return rawItems;
}

/**
 * 信息沉淀 Agent（独立后台）
 * 职责：聊天记录实时扫描、信息提取、置信度计算、数据同步
 * 模型：腾讯混元 Hy3（备用：fit-Backup）
 */
const { db, withTransaction } = require('../../db');
const { callWithPrompt } = require('../aiClient');
const { computeFoodNutrition, computeRecipeTotals, getFoodNutrition, getTypicalWeight, extractFoodKeywords } = require('../nutritionService');
const promptService = require('../promptService');
const tagMatcher = require('../tagMatcher');
const rewardService = require('../rewardService');
const exerciseMergeService = require('../exerciseMergeService');
const { isQuestionContent, hasNegativeRecordIntent, hasSelfReportMarker, hasFutureOrIntentionIntent, hasAffirmativeActionMarker } = require('../../utils/intent');
const { safeJsonParse } = require('../../utils/safeJson');

/**
 * 沉淀 LLM 调用串行队列：防止连续快速发送消息时多个 LLM 调用并发导致超时
 * 每条消息的沉淀 LLM 调用排队执行，前一个完成（或超时）后才执行下一个
 */
let precipitationQueue = Promise.resolve();
function enqueuePrecipitationLLM(task) {
  const run = precipitationQueue.then(task, (e) => { console.log('[沉淀队列] 前一个任务异常:', e.message); return task(); });
  precipitationQueue = run.catch(() => {});
  // 队列自动清理：10秒后重置，避免异常残留导致永久阻塞
  setTimeout(() => { if (precipitationQueue === run.catch(() => {})) precipitationQueue = Promise.resolve(); }, 10000);
  return run;
}
const { getChinaDateStr, getChinaHour, getChinaDateTimeStr } = require('../../utils/chinaTime');


/**
 * 快速判断消息是否值得沉淀（本地过滤，避免浪费API调用）
 */
// 沉淀兜底匹配用的饮品/常见食物关键词（LLM 未提取到有效内容时，直接从 food_db 匹配）
const FALLBACK_FOOD_KEYWORDS = [
  ...BEVERAGE_FOOD_KEYWORDS,
  '苹果', '香蕉', '橙子', '西瓜', '葡萄', '西红柿', '黄瓜', '白菜', '菠菜', '胡萝卜',
  '土豆', '红薯', '玉米', '花生', '核桃', '巧克力', '饼干', '蛋糕', '面包', '汉堡',
  '披萨', '米饭', '面条', '馒头', '鸡蛋', '豆腐', '牛肉', '猪肉', '鸡肉', '鱼肉', '虾'
];

// 内容是否包含可兜底匹配的饮品/食物关键词
function hasBeverageFoodContent(content) {
  if (!content) return false;
  return FALLBACK_FOOD_KEYWORDS.some(kw => String(content).includes(kw));
}

function shouldPrecipitate(content) {
  const text = (content || '').trim();
  if (text.length < 5) return false;
  // 本地标签匹配器能识别出食物/运动/身体数据/喝水，直接触发沉淀
  if (tagMatcher.matchMessageTags(text)) {
    return true;
  }

  const contentLower = text.toLowerCase();

  const keywords = [
    '吃', '喝', '早餐', '午餐', '晚餐', '饭', '菜', '肉', '蛋', '奶', '水果', '零食',
    '卡路里', '千卡', '热量', '碳水', '蛋白质', '脂肪', '糖', '油',
    // 饮品关键词（确保饮品类内容能正确触发沉淀）
    '咖啡', '饮料', '果汁', '奶茶', '豆浆', '牛奶', '酸奶', '豆奶', '奶昔', '茶', '啤酒', '红酒', '白酒', '葡萄酒', '鸡尾酒', '椰汁', '核桃露', '杏仁露', '燕麦奶', '养乐多', '优酸乳', '气泡水', '苏打水', '碳酸饮料', '可乐', '雪碧', '汽水',
    '运动', '健身', '跑步', '慢跑', '快跑', '超慢跑', '变速跑', '间歇跑', '长跑', '短跑', '冲刺跑', '夜跑', '晨跑',
    '走路', '快走', '慢走', '散步', '健走', '徒步', '逛街', '爬楼梯', '爬山', '登山',
    '游泳', '蛙泳', '自由泳', '仰泳', '蝶泳', '潜水', '浮潜',
    '骑车', '骑行', '自行车', '动感单车', '椭圆机', '划船机',
    '篮球', '足球', '排球', '羽毛球', '乒乓球', '网球', '台球', '保龄球', '高尔夫',
    '瑜伽', '普拉提', '拉伸', '太极', '气功', '冥想',
    '深蹲', '俯卧撑', '平板支撑', '仰卧起坐', '卷腹', '引体向上', '举重', '哑铃', '杠铃', '器械训练',
    '跳绳', '跳舞', '广场舞', '健身操', '搏击操', '有氧操', '尊巴',
    'HIIT', 'Tabata', '拳击', '打拳', '跆拳道', '空手道', '柔道', '轮滑', '滑板', '攀岩', '滑雪', '滑冰',
    '有氧', '无氧', '力量', '训练', '公里', '千米', 'km', '分钟', '小时', '步', '米', 'm',
    '体重', '体脂', 'BMI', '腰围', '腿围', '臀围', '胸围', '肌肉',
    '斤', '公斤', '厘米', 'kg',
    '喝水', '睡眠', '睡觉', '熬夜', '排便', '便秘', '心情', '情绪',
    '方法', '技巧', '建议', '经验', '分享', '食谱', '做法', '教程',
    '感悟', '心得', '体会', '总结', '反思',
    '发现', '意识到', '原来', '终于明白', '悟到',
    '开心', '难过', '焦虑', '烦躁', '愧疚', '兴奋', '激动',
    '坚持', '放弃', '成功', '失败', '平台期', '掉秤', '涨秤',
    '目标', '计划', '今天', '明天'
  ];
  
  return keywords.some(k => contentLower.includes(k));
}

const ASSET_TYPES = ['recipe', 'method', 'pitfall', 'insight', 'quote'];

/**
 * 个人资产类沉淀必须有实质内容
 */
function hasAssetContent(data) {
  if (!data || typeof data !== 'object') return false;
  return !!(
    (data.title && String(data.title).trim()) ||
    (data.name && String(data.name).trim()) ||
    (data.content && String(data.content).trim()) ||
    (Array.isArray(data.steps) && data.steps.length > 0) ||
    (Array.isArray(data.ingredients) && data.ingredients.length > 0)
  );
}

/**
 * 验证沉淀项的有效性
 * - diet_record: 必须有 foods 数组且至少一个食物
 * - exercise_record: 必须有 exercises 数组且至少一项运动
 * - body_data: 必须有 value
 * - habit: 必须有 value 和 sub_type
 * - 个人资产类(recipe/method/pitfall/insight/quote): 必须有实质内容
 * - 其他类型: 有 extracted_data 即可
 */
function isValidPrecipitationItem(item) {
  if (!item.type) return false;
  
  const data = item.extracted_data || {};
  
  switch (item.type) {
    case 'diet_record': {
      const foods = data.foods || [];
      if (!Array.isArray(foods) || foods.length === 0) {
        
        return false;
      }
      // 检查每个食物是否有名称
      const validFoods = foods.filter(f => f && f.name && f.name.trim());
      if (validFoods.length === 0) {
        
        return false;
      }
      return true;
    }
    case 'exercise_record': {
      const exercises = data.exercises || [];
      if (!Array.isArray(exercises) || exercises.length === 0) {
        
        return false;
      }
      // 过滤无实质数据的运动项：步数/时长/消耗/距离全为 0 或空（如"走路0步"）直接舍弃，不进确认弹窗
      const meaningful = [];
      for (const e of exercises) {
        if (!e || !e.name || !String(e.name).trim()) continue;
        const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
        const steps = num(e.steps);
        // 只有步数时折算时长/消耗，避免确认弹窗里分钟数和热量值空白
        if (steps > 0) {
          if (num(e.duration) <= 0) e.duration = Math.max(1, Math.round(steps / 100)); // 走路约 100 步/分钟
          if (num(e.calorie) <= 0) e.calorie = Math.round(steps * 0.04); // 约 0.04 千卡/步
        }
        // 非时长单位条目（爬N层/做N个）：有 count 数量即视为有效，热量由保存侧换算
        const hasValue = [e.duration, e.calorie, e.steps, e.distance, e.count].some(v => num(v) > 0);
        if (hasValue) meaningful.push(e);
      }
      if (meaningful.length === 0) {
        
        return false;
      }
      data.exercises = meaningful;
      return true;
    }
    case 'body_data': {
      if (data.value === undefined || data.value === null || data.value === '') {
        
        return false;
      }
      return true;
    }
    case 'habit': {
      if (data.value === undefined || data.value === null) {
        
        return false;
      }
      if (!data.sub_type) {
        
        return false;
      }
      return true;
    }
    default: {
      if (ASSET_TYPES.includes(item.type)) {
        if (!hasAssetContent(data)) {
          
          return false;
        }
      }
      return true;
    }
  }
}

/**
 * 判断两个字符串是否有长度≥minLen的公共子串
 */
function hasCommonSubstring(a, b, minLen = 2) {
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  for (let len = minLen; len <= shorter.length; len++) {
    for (let i = 0; i <= shorter.length - len; i++) {
      if (longer.includes(shorter.slice(i, i + len))) return true;
    }
  }
  return false;
}

/**
 * 判断两个 exercise 数组是否重叠（同一条消息内去重）
 */
function exercisesOverlap(exercisesA, exercisesB) {
  if (!exercisesA.length || !exercisesB.length) return false;
  for (const a of exercisesA) {
    for (const b of exercisesB) {
      const aName = a.name || '';
      const bName = b.name || '';
      if (aName === bName) return true;
      if (hasCommonSubstring(aName, bName, 2)) return true;
    }
  }
  return false;
}

/**
 * 对同一批沉淀记录中的运动记录进行去重，保留名称更具体（更长）的一条
 */
function deduplicateExercisesInBatch(items) {
  const result = [];
  for (const item of items) {
    if (item.type !== 'exercise_record') {
      result.push(item);
      continue;
    }
    const newExercises = item.extracted_data?.exercises || [];
    let merged = false;
    for (let i = 0; i < result.length; i++) {
      const existing = result[i];
      if (existing.type !== 'exercise_record') continue;
      const existingExercises = existing.extracted_data?.exercises || [];
      if (exercisesOverlap(existingExercises, newExercises)) {
        const existingLen = existingExercises.reduce((sum, e) => sum + (e.name || '').length, 0);
        const newLen = newExercises.reduce((sum, e) => sum + (e.name || '').length, 0);
        if (newLen > existingLen) {
          result[i] = item;
        }
        merged = true;
        break;
      }
    }
    if (!merged) result.push(item);
  }
  return result;
}

/**
 * 从文本中提取所有顶层 JSON 对象
 */
function extractJsonObjects(text) {
  const objects = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

/**
 * 根据沉淀类型生成用于 precipitation_records.content 的摘要
 * 避免把用户整句话塞入库表；insight/quote 保留原话作为内容
 */
function summarizePrecipitationContent(content, type, data) {
  if (type === 'insight' || type === 'quote') {
    return content.trim();
  }
  if (type === 'diet_record') {
    const foods = (data.foods || []).map(f => f.name).filter(Boolean).join('、');
    const mealMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
    const mealName = mealMap[data.meal_time] || '饮食';
    return foods ? `${mealName}：${foods}` : content.slice(0, 40);
  }
  if (type === 'exercise_record') {
    const exercises = (data.exercises || []).map(e => e.name).filter(Boolean).join('、');
    return exercises ? `运动：${exercises}` : content.slice(0, 40);
  }
  if (type === 'body_data') {
    const subType = data.sub_type || '体重';
    const value = data.value !== undefined && data.value !== null ? data.value : '';
    const unit = data.unit || '';
    return value !== '' ? `${subType}${value}${unit}` : content.slice(0, 40);
  }
  if (type === 'habit') {
    const subType = data.sub_type || 'water';
    const value = data.value !== undefined && data.value !== null ? data.value : '';
    const unit = data.unit || '';
    if (subType === 'water' || subType === '喝水') {
      return value !== '' ? `喝水${value}${unit}` : content.slice(0, 40);
    }
    return value !== '' ? `${subType}${value}${unit}` : content.slice(0, 40);
  }
  if (type === 'method' || type === 'pitfall' || type === 'product') {
    return content.trim();
  }
  return content.slice(0, 40);
}

/**
 * 处理单个沉淀项
 */
function processSinglePrecipitation(userId, chatId, content, item, recordDate) {
  const confidence = parseFloat(item.confidence) || 0;
  if (confidence < 0.7) return null;

  let data = item.extracted_data || {};

  // 感悟/金句的实质内容必须是用户原话，不要 LLM 改写或摘要
  if (item.type === 'insight' || item.type === 'quote') {
    data = { ...data, content: content.trim() };

    // insight 原话不超过100字时，不需要标题（标题选填）
    if (item.type === 'insight' && content.trim().length <= 100) {
      data.title = '';
    }
  }

  // 食谱已由 partnerAssetAgent 专属处理（savePartnerRecipes），通用沉淀 Agent 不再创建 recipe 记录
  // 避免两条链路竞争导致格式不一致（precipitation_recipe 格式 vs 结构化 recipe 格式）
  if (item.type === 'recipe') {
    
    return null;
  }

  // 个人资产类（方法/感悟/踩坑/金句）统一进入 museum_items pending，由用户在聊天页确认。
  const isAsset = ASSET_TYPES.includes(item.type);
  let status;
  if (isAsset) {
    status = confidence >= 0.85 ? 1 : 2;
  } else {
    status = confidence >= 0.85 ? 1 : 2;
  }

  const insert = db.prepare(`
    INSERT INTO precipitation_records
    (user_id, chat_id, type, sub_type, content, extracted_data, confidence, status, source, tags, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const summaryContent = summarizePrecipitationContent(content, item.type, data);
  const precipitationId = insert.run(
    userId, chatId, item.type, item.sub_type || null, summaryContent,
    JSON.stringify(data), confidence, status, 0,
    item.tags ? JSON.stringify(item.tags) : null, null
  ).lastInsertRowid;

  return { precipitation_id: precipitationId, type: item.type, sub_type: item.sub_type || null, confidence, status, extracted_data: data };
}

/**
 * 检查今天是否已有相同或相似的记录（去重）
 * 对于饮食记录：检查同一餐别是否已有相同食物
 * 对于运动记录：检查今天是否已有相同运动
 * 对于习惯记录：检查今天是否已有相同类型记录
 * 对于身体数据：检查今天是否已有相同类型记录
 */
function hasDuplicateRecord(userId, type, data, recordDate) {
  const today = recordDate || getChinaDateStr();
  
  switch (type) {
    case 'diet_record': {
      const dietData = data || {};
      const mealTime = dietData.meal_time || 'snack';
      const newFoods = dietData.foods || [];
      if (newFoods.length === 0) return { isDuplicate: false, recordId: null };
      
      // 查询今天该餐别的所有记录
      const existingRecords = db.prepare(`
        SELECT id, foods FROM diet_records 
        WHERE user_id = ? AND record_date = ? AND meal_time = ?
      `).all(userId, today, mealTime);
      
      // 检查每个新食物是否已存在（按名称模糊匹配：互相包含即视为同一食物）
      const foodsToMerge = []; // 需要累加的食物
      const foodsToUpdate = []; // 需要更新（热量修正）的食物
      const newFoodsToAdd = []; // 全新的食物
      
      for (const newFood of newFoods) {
        let foundExisting = false;
        for (const record of existingRecords) {
          const existingFoods = safeJsonParse(record.foods, []);
          // 模糊匹配：新食物名包含已有食物名，或已有食物名包含新食物名
          const found = existingFoods.find(ef => {
            const efName = ef.name || '';
            const nfName = newFood.name || '';
            return efName === nfName || 
                   (efName.length > 1 && nfName.includes(efName)) || 
                   (nfName.length > 1 && efName.includes(nfName));
          });
          if (found) {
            foundExisting = true;
            // 判断是累加还是更新：如果新记录没有明确的重量/数量，只有热量，视为修正
            const isCorrection = (!newFood.weight || newFood.weight <= 0) && 
                                  (!newFood.quantity || newFood.quantity <= 0) &&
                                  (newFood.calorie > 0);
            if (isCorrection) {
              // 热量修正：用新热量替换旧热量
              foodsToUpdate.push({
                newFood,
                recordId: record.id,
                existingFood: found
              });
            } else {
              // 正常累加
              foodsToMerge.push({ 
                newFood, 
                recordId: record.id,
                existingFood: found
              });
            }
            break;
          }
        }
        if (!foundExisting) {
          newFoodsToAdd.push(newFood);
        }
      }
      
      // 如果有需要更新的食物（热量修正），返回更新标记
      if (foodsToUpdate.length > 0) {
        return {
          isDuplicate: false,
          recordId: null,
          hasUpdate: true,
          foodsToUpdate,
          newFoodsToAdd
        };
      }
      
      // 如果有需要累加的食物，返回累加标记
      if (foodsToMerge.length > 0) {
        return { 
          isDuplicate: false, 
          recordId: null, 
          hasMerge: true, 
          foodsToMerge,
          newFoodsToAdd
        };
      }
      
      // 如果所有食物都是全新的
      if (newFoodsToAdd.length > 0) {
        return { isDuplicate: false, recordId: null, newFoodsToAdd };
      }
      
      return { isDuplicate: true, recordId: null };
    }
    case 'exercise_record': {
      const exData = data || {};
      const newExercises = exData.exercises || [];
      if (newExercises.length === 0) return { isDuplicate: false, recordId: null };
      
      // 查询今天的所有运动记录
      const existingRecords = db.prepare(`
        SELECT id, exercises FROM exercise_records 
        WHERE user_id = ? AND record_date = ?
      `).all(userId, today);
      
      for (const record of existingRecords) {
        const existingExercises = safeJsonParse(record.exercises, []);
        for (const newEx of newExercises) {
          // 模糊匹配：名称完全相同，或存在≥2字的公共子串（如"哑铃练背"与"哑铃训练肩胸背"）
          const isDuplicate = existingExercises.some(ee => {
            const eeName = ee.name || '';
            const newName = newEx.name || '';
            const nameMatch = eeName === newName || hasCommonSubstring(eeName, newName, 2);
            return nameMatch && ee.duration == newEx.duration;
          });
          if (isDuplicate) return { isDuplicate: true, recordId: record.id };
        }
      }
      return { isDuplicate: false, recordId: null };
    }
    case 'habit': {
      const habitData = data || {};
      const subType = habitData.sub_type || 'water';
      
      // 查询今天是否有相同类型的习惯记录
      const existing = db.prepare(`
        SELECT id, value FROM habit_records 
        WHERE user_id = ? AND record_date = ? AND type = ?
      `).get(userId, today, subType);
      
      if (existing) {
        // 对于喝水，累加；对于睡眠/排便，更新
        return { isDuplicate: true, recordId: existing.id, existingValue: existing.value };
      }
      return { isDuplicate: false, recordId: null };
    }
    case 'body_data': {
      const bodyData = data || {};
      const subType = bodyData.sub_type || 'weight';
      
      // 查询今天是否有相同类型的身体数据记录
      const existing = db.prepare(`
        SELECT id FROM body_records 
        WHERE user_id = ? AND record_date = ? AND type = ?
      `).get(userId, today, subType);
      
      if (existing) return { isDuplicate: true, recordId: existing.id };
      return { isDuplicate: false, recordId: null };
    }
    default:
      return { isDuplicate: false, recordId: null };
  }
}

/**
 * 基于MET值计算运动热量消耗
 * 公式: 热量(千卡) = MET值 × 体重(kg) × 时长(小时) × 1.05
 * 默认体重60kg
 * MET值来源: Compendium of Physical Activities (2011)
 */
// 完整MET值参考表 (基于60kg体重计算出的千卡/小时)
const EXERCISE_MET_VALUES = {
    // ===== 拉伸/瑜伽 (MET 1.5-3.5) =====
    '冥想': 1.5, '正念': 1.5, '呼吸训练': 1.5,
    '拉伸': 2.0, '静态拉伸': 2.0, '动态拉伸': 2.5, 'PNF拉伸': 2.5,
    '筋膜放松': 2.0, '泡沫轴': 2.0,
    '瑜伽': 2.5, '阴瑜伽': 2.0, '流瑜伽': 3.0, '哈他瑜伽': 2.5,
    '阿斯汤加': 4.0, '高温瑜伽': 4.5, '空中瑜伽': 3.0,
    '普拉提': 3.0, '美丽芭蕾': 3.0, '天鹅臂': 2.5, '天鹅腿': 3.0, '纤腰': 3.0,
    '睡前拉伸': 1.5, '晨间唤醒': 2.5, '午休运动': 2.5,
    
    // ===== 低强度有氧 (MET 2.5-4.0) =====
    '慢走': 2.5, '散步': 2.5, '走路': 3.0,
    '超慢跑': 3.5, '原地跑': 3.5,
    '逛街': 2.5, '站立': 2.0, '久坐': 1.5,
    '太极': 3.0, '气功': 2.5,
    
    // ===== 中等强度有氧 (MET 4.0-6.0) =====
    '快走': 5.0, '健走': 5.5, '徒步': 5.0, '暴走': 5.5,
    '骑车': 5.5, '骑行': 5.5, '自行车': 5.0, '休闲骑车': 4.0,
    '动感单车': 6.0, '室内单车': 5.5, '磁控车': 4.5,
    '椭圆机': 5.5, '划船机': 6.0,
    '跳舞': 5.0, '广场舞': 4.5, '健身操': 5.0, '有氧操': 5.5,
    '搏击操': 6.0, '尊巴': 5.5, '街舞': 5.5, '拉丁舞': 5.0,
    '芭蕾舞': 5.0, '爵士舞': 5.0, '现代舞': 5.0, '民族舞': 4.5,
    '交谊舞': 4.0, '摇摆舞': 4.5, '燃脂舞': 5.5, '减脂舞': 5.5, '健身舞': 5.0,
    '爬楼梯': 6.0, '爬楼': 6.0,
    
    // ===== 球类运动 (MET 4.0-7.0) =====
    '乒乓球': 4.0, '台球': 3.0, '门球': 3.5,
    '排球': 4.0, '羽毛球': 5.5,
    '篮球': 6.5, '足球': 7.0, '网球': 7.0,
    '壁球': 8.0, '保龄球': 3.5, '高尔夫': 4.0,
    
    // ===== 格斗类 (MET 6.0-10.0) =====
    '咏春': 4.5, '太极': 3.0,
    '跆拳道': 8.0, '空手道': 8.0, '柔道': 8.0,
    '散打': 9.0, '拳击': 9.0, '打拳': 8.0, '泰拳': 10.0,
    
    // ===== 跑步 (MET 6.0-12.0) =====
    '跑步': 8.0, '慢跑': 7.0, '快跑': 10.0,
    '变速跑': 9.0, '间歇跑': 9.0, '长跑': 8.0,
    '短跑': 12.0, '冲刺跑': 12.0,
    '夜跑': 8.0, '晨跑': 8.0, '越野跑': 9.0,
    '跑步机': 8.0, '爬坡跑': 10.0,
    
    // ===== 游泳 (MET 6.0-10.0) =====
    '游泳': 8.0, '蛙泳': 8.0, '自由泳': 9.0, '仰泳': 7.0, '蝶泳': 10.0,
    '水中漫步': 4.5, '水中有氧': 5.0,
    
    // ===== 跳绳 (MET 8.0-12.0) =====
    '跳绳': 10.0, '单摇': 9.0, '双摇': 12.0, '花式跳绳': 10.0,
    
    // ===== 高强度间歇 (MET 8.0-12.0) =====
    'HIIT': 10.0, 'Tabata': 12.0, '高强度间歇': 10.0,
    '开合跳': 8.0, '波比跳': 9.0, '高抬腿': 7.0,
    
    // ===== 自重力量 (MET 3.5-6.0) =====
    '深蹲': 5.5, '徒手深蹲': 5.0, '箭步蹲': 5.0, '保加利亚蹲': 5.5,
    '靠墙静蹲': 2.5, '马步': 2.5,
    '俯卧撑': 5.0, '引体向上': 6.0, '引体向上机': 5.0,
    '仰卧起坐': 4.0, '卷腹': 4.0, '俄罗斯转体': 4.5,
    '臀桥': 3.5, '桥式': 3.5, '死虫式': 3.0, '鸟狗式': 3.0,
    '平板支撑': 2.5, '侧平板': 2.5,
    '倒立': 4.0, '手倒立': 4.5,
    '登山跑': 6.0, '单腿硬拉': 4.5,
    
    // ===== 弹力带/阻力带 (MET 2.5-3.5) =====
    '弹力带': 3.0, '弹力带练背': 3.0, '弹力带练臀': 3.0,
    '弹力带练肩': 3.0, '弹力带练胸': 3.0, '弹力带练腿': 3.0,
    '弹力带训练': 3.0, '阻力带': 3.0, '拉力带': 3.0, '乳胶带': 3.0,
    '8字拉力器': 2.5, '开肩美背': 2.5,
    
    // ===== 哑铃训练 (MET 3.5-5.5) =====
    '哑铃': 4.5, '哑铃弯举': 4.0, '哑铃推举': 4.5,
    '哑铃飞鸟': 4.0, '哑铃划船': 4.5, '哑铃深蹲': 5.0,
    '哑铃硬拉': 5.0, '哑铃侧平举': 3.5, '哑铃前平举': 3.5,
    '哑铃臀腿': 4.5, '臀腿': 4.5, '臀腿训练': 4.5,
    
    // ===== 杠铃训练 (MET 4.5-6.5) =====
    '杠铃': 5.0, '杠铃深蹲': 6.0, '杠铃硬拉': 6.0,
    '杠铃卧推': 5.5, '杠铃划船': 5.5, '杠铃推举': 5.0,
    '杠铃弯举': 4.0, '杠铃臀推': 5.0,
    '相扑硬拉': 6.0, '罗马尼亚硬拉': 5.5,
    
    // ===== 器械训练 (MET 4.0-6.0) =====
    '器械训练': 5.0, '器械推胸': 4.5, '器械划船': 4.5,
    '器械夹胸': 4.0, '腿举': 5.0, '腿弯举': 4.0, '腿屈伸': 4.0,
    '坐姿划船': 4.5, '高位下拉': 4.5,
    '史密斯机': 5.0, '龙门架': 4.5, '蝴蝶机': 3.5, '推胸机': 4.5,
    
    // ===== 壶铃训练 (MET 5.0-7.0) =====
    '壶铃': 6.0, '壶铃摇摆': 7.0, '壶铃抓举': 7.0,
    '壶铃深蹲': 6.0, '壶铃推举': 6.0, '土耳其起立': 6.0,
    
    // ===== TRX/悬挂 (MET 4.5-5.5) =====
    'TRX': 5.0, '悬挂训练': 5.0, 'TRX划船': 4.5,
    'TRX深蹲': 4.5, 'TRX俯卧撑': 5.0,
    
    // ===== 战绳/功能性 (MET 5.0-8.0) =====
    '战绳': 8.0, '甩绳': 8.0, '药球': 6.0, '药球抛': 6.0,
    '沙袋': 6.0, '轮胎翻': 7.0, '农夫行走': 5.5, '雪橇推': 7.0,
    
    // ===== 登山/攀岩 (MET 5.0-8.0) =====
    '爬山': 6.5, '登山': 7.0, '攀岩': 8.0, '攀冰': 9.0,
    '溯溪': 6.0, '漂流': 4.0,
    
    // ===== 冰雪运动 (MET 5.0-7.0) =====
    '滑雪': 7.0, '滑冰': 7.0, '轮滑': 7.0, '滑板': 5.0,
    
    // ===== 日常活动 (MET 1.5-4.0) =====
    '做家务': 2.5, '打扫卫生': 2.5, '拖地': 3.0,
    '擦窗户': 3.0, '洗衣服': 2.5, '做饭': 2.5,
    '洗碗': 2.0, '整理房间': 2.5,
    '搬东西': 4.0, '抱孩子': 3.0, '遛狗': 3.0,
    '园艺': 3.5, '种菜': 3.5, '洗车': 3.0,
    
    // ===== 产后/特殊 (MET 1.5-3.0) =====
    '产后恢复': 3.0, '盆底肌训练': 2.0, '凯格尔运动': 2.0,
    '腹直肌修复': 2.5, '办公室运动': 2.5,
    '椅子瑜伽': 2.0, '坐姿运动': 2.0, '床上运动': 2.0,
    '碎片化运动': 2.5, '微运动': 2.5, '办公室微运动': 2.0,
    
    // ===== 帕梅拉 (MET 6.0-8.0) =====
    '帕梅拉': 6.0, '帕梅拉燃脂': 7.0, '帕梅拉HIIT': 8.0,
    '帕梅拉腹肌': 5.5, '帕梅拉臀腿': 6.0, '帕梅拉有氧': 7.0,
    '帕梅拉拉伸': 2.5, '帕梅拉舞蹈': 6.0,
    '帕梅拉初学者': 4.5, '帕梅拉10分钟': 6.0,
    '帕梅拉15分钟': 6.0, '帕梅拉20分钟': 6.0,
    
    // ===== 周六野 (MET 5.0-6.5) =====
    '周六野': 5.0, '周六野燃脂': 6.0, '周六野拉伸': 2.5,
    '周六野改善体态': 3.0, '周六野瘦小腿': 3.5,
    '周六野瘦腰': 4.0, '周六野马甲线': 4.5,
    '周六野全身燃脂': 6.0,
    
    // ===== 欧阳春晓 (MET 4.0-5.0) =====
    '欧阳春晓': 4.5, '欧阳春晓沙漏腰': 4.0,
    '欧阳春晓直角肩': 3.0, '欧阳春晓少女背': 3.0,
    '欧阳春晓拉伸': 2.5,
    
    // ===== 韩小四 (MET 3.5-5.5) =====
    '韩小四': 4.0, '韩小四瘦手臂': 3.5,
    '韩小四瘦小腿': 3.5, '韩小四瘦大腿': 4.0,
    '韩小四全身燃脂': 5.0,
    
    // ===== 刘畊宏 (MET 6.0-8.0) =====
    '刘畊宏': 6.0, '刘畊宏毽子操': 6.0,
    '刘畊宏本草纲目': 7.0, '刘畊宏龙拳': 8.0,
    '刘畊宏牛仔很忙': 6.0,
    '毽子操': 6.0, '本草纲目': 7.0, '龙拳': 8.0, '牛仔很忙': 6.0,
    
    // ===== 郑多燕 (MET 4.5-5.0) =====
    '郑多燕': 4.5, '郑多燕小红帽': 5.0, '郑多燕小灰帽': 4.5,
    
    // ===== 海外博主 (MET 5.0-8.0) =====
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
    
    // ===== 健身APP (MET 4.5-7.0) =====
    'Keep': 5.5, 'Keep燃脂跑': 7.0, 'Keep马甲线': 4.5,
    'Keep腹肌撕裂者': 5.0, 'Keep哑铃': 4.5,
    'Keep瑜伽': 2.5, 'Keep拉伸': 2.0,
    'KeepHIIT': 8.0, 'Keep跳绳': 9.0,
    'Keep单车': 5.5, 'Keep操课': 5.0,
    '薄荷健康': 5.0, '薄荷HIIT': 7.0, '薄荷瑜伽': 2.5,
    '乐刻': 5.5, '乐刻团课': 6.0,
    '超级猩猩': 7.0, '超级猩猩战绳': 8.0,
    '超级猩猩单车': 7.0, '超级猩猩搏击': 8.0,
    
    // ===== 瘦手臂/局部 (MET 3.0-4.5) =====
    '瘦手臂操': 3.0, '瘦腿操': 3.5, '瘦腰操': 4.0,
    '全身燃脂操': 6.0
};

/**
 * 从运动库（exercise_db）查找最匹配的运动
 * 优先最长名称匹配
 */
function getExerciseFromDb(name) {
  if (!name) return null;
  const input = String(name).toLowerCase();
  try {
    const rows = db.prepare(`SELECT exercise_name, met_value, calorie_per_hour, intensity_desc, unit_name, calorie_per_unit FROM exercise_db`).all();
    let best = null;
    let bestScore = 0;
    for (const row of rows) {
      const dbName = String(row.exercise_name || '').toLowerCase();
      if (!dbName) continue;
      const matched = input.includes(dbName) || dbName.includes(input);
      if (matched && dbName.length > bestScore) {
        bestScore = dbName.length;
        best = row;
      }
    }
    return best;
  } catch (e) {
    console.error('[getExerciseFromDb] 查询运动库失败:', e.message);
    return null;
  }
}

/**
 * 常见"非时长单位"运动的本地估算表（60kg 基准，联网学习前的兜底）
 * perUnit=每单位千卡；minutesPerUnit=每单位约合分钟；met 用于估算自洽对账
 * 估算值会在后台联网核实后回写修正，并把精确单位数据沉淀进运动库
 */
const UNIT_FALLBACK_ESTIMATES = [
  { keys: ['爬楼梯', '爬楼', '楼梯'], unit: '层', perUnit: 6.0, minutesPerUnit: 1.0, met: 6.0 },
  { keys: ['俯卧撑'], unit: '个', perUnit: 0.4, minutesPerUnit: 0.05, met: 8.0 },
  { keys: ['深蹲'], unit: '个', perUnit: 0.32, minutesPerUnit: 0.045, met: 7.0 },
  { keys: ['仰卧起坐'], unit: '个', perUnit: 0.3, minutesPerUnit: 0.04, met: 7.5 },
  { keys: ['卷腹'], unit: '个', perUnit: 0.25, minutesPerUnit: 0.04, met: 6.5 },
  { keys: ['开合跳'], unit: '个', perUnit: 0.07, minutesPerUnit: 0.008, met: 8.0 },
  { keys: ['波比跳'], unit: '个', perUnit: 0.5, minutesPerUnit: 0.05, met: 10.0 },
  { keys: ['引体向上'], unit: '个', perUnit: 0.8, minutesPerUnit: 0.1, met: 8.0 },
  { keys: ['臀桥'], unit: '个', perUnit: 0.25, minutesPerUnit: 0.05, met: 5.0 },
  { keys: ['跳绳'], unit: '个', perUnit: 0.11, minutesPerUnit: 0.01, met: 11.0 }
];

/**
 * 按非时长单位（层/个/下）估算运动热量与换算时长
 * 优先运动库已学到的单位数据（unit_name/calorie_per_unit），否则查本地估算表，
 * 都没有时按 MET 5.0 × 每单位1分钟 保守估算
 * @param {string} exerciseName 运动名
 * @param {number} count 数量
 * @param {string} unit 单位（层/个/下/次）
 * @param {number} weight 用户体重kg
 * @returns {{calorie:number, duration:number, perUnit:number, minutesPerUnit:number}}
 */
function estimateUnitExercise(exerciseName, count, unit, weight = 60) {
  const name = String(exerciseName || '').toLowerCase();

  // 1) 运动库已学到的同单位数据（web_learned 回流）优先；时长用本地估算表近似
  const dbExercise = getExerciseFromDb(exerciseName);
  if (dbExercise && dbExercise.unit_name === unit && Number(dbExercise.calorie_per_unit) > 0) {
    const perUnit = Number(dbExercise.calorie_per_unit);
    const estHit = UNIT_FALLBACK_ESTIMATES.find(est => est.keys.some(k => name.includes(k.toLowerCase()) || k.includes(name)));
    const minutesPerUnit = estHit ? estHit.minutesPerUnit : 0;
    return {
      calorie: Math.round(perUnit * count),
      duration: minutesPerUnit > 0 ? Math.max(Math.round(minutesPerUnit * count), 1) : 0,
      perUnit,
      minutesPerUnit
    };
  }

  // 2) 本地估算表
  const hit = UNIT_FALLBACK_ESTIMATES.find(est => est.keys.some(k => name.includes(k.toLowerCase()) || k.includes(name)));
  if (hit) {
    // 体重修正：默认按 60kg 基准线性缩放
    const perUnit = Math.round(hit.perUnit * (weight / 60) * 100) / 100;
    return {
      calorie: Math.max(Math.round(perUnit * count), 1),
      duration: Math.max(Math.round(hit.minutesPerUnit * count), 1),
      perUnit,
      minutesPerUnit: hit.minutesPerUnit
    };
  }

  // 3) 未知运动兜底：按 MET 5.0、每单位约 1 分钟保守估算
  const perUnit = Math.round(5.0 * weight * (1 / 60) * 1.05 * 100) / 100;
  return { calorie: Math.max(Math.round(perUnit * count), 1), duration: Math.max(Math.round(count), 1), perUnit, minutesPerUnit: 1 };
}

/**
 * 后台联网核实运动单位换算并回写修正记录（"先估算后修正"模式）
 * 流程：searchAndLearnExercise 联网学习（校验通过自动回流运动库）→ 用学到的
 * 每单位热量重算 → 记录热量未被用户改动的前提下回写 exercise_records 与
 * precipitation_records.extracted_data，保证记录最终与运动库同源
 * @param {number} userId 用户ID
 * {number} precipitationId 沉淀记录ID（定位对应运动记录行）
 * @param {string} recordDate 记录日期
 * @param {Array<{name:string,count:number,unit:string,estCalorie:number}>} jobs 待学习任务
 */
function learnUnitExercisesInBackground(userId, precipitationId, recordDate, jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) return;

  // 惰性 require 放入异步任务内：学习失败不能影响沉淀保存主链路
  (async () => {
    let searchAndLearnExercise;
    try {
      ({ searchAndLearnExercise } = require('../webSearchService'));
    } catch (e) {
      console.warn('[沉淀] 运动单位学习模块加载失败（保留估算值）:', e.message);
      return;
    }
    for (const job of jobs) {
      try {
        // 传入 60kg 基准估算值交叉验证，拦截 LLM 知识兜底的离谱数据
        const learned = await searchAndLearnExercise(job.name, job.unit, job.estPerUnit60 || null);
        if (!learned || !(learned.perUnit > 0)) continue;
        // 库里已有同单位数据或学习成功 → 用每单位热量重算
        const calorie = Math.max(Math.round(learned.perUnit * job.count), 1);
        if (calorie === job.estCalorie) continue; // 与估算一致，无需回写

        // 读取当前运动记录行，找到匹配条目且热量仍为估算值（未被用户编辑过）才回写
        const rows = db.prepare(
          'SELECT id, exercises, total_calorie, total_duration FROM exercise_records WHERE user_id = ? AND precipitation_id = ? ORDER BY id ASC'
        ).all(userId, precipitationId);
        for (const row of rows) {
          let list;
          try { list = JSON.parse(row.exercises || '[]'); } catch (e) { continue; }
          if (!Array.isArray(list)) continue;
          let changed = false;
          let deltaCal = 0;
          let deltaDur = 0;
          for (const e of list) {
            const isTarget = (e.name || '').includes(job.name) || job.name.includes(e.name || '');
            if (isTarget && parseFloat(e.count) === job.count && e.unit === job.unit
                && Math.round(parseFloat(e.calorie) || 0) === job.estCalorie) {
              deltaCal = calorie - (parseFloat(e.calorie) || 0);
              deltaDur = (learned.minutesPerUnit > 0 ? Math.max(Math.round(learned.minutesPerUnit * job.count), 1) : 0) - (parseFloat(e.duration) || 0);
              e.calorie = calorie;
              if (learned.minutesPerUnit > 0) e.duration = Math.max(Math.round(learned.minutesPerUnit * job.count), 1);
              changed = true;
            }
          }
          if (!changed) continue;
          db.prepare('UPDATE exercise_records SET exercises = ?, total_calorie = ?, total_duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(JSON.stringify(list), Math.max((row.total_calorie || 0) + deltaCal, 0), Math.max((row.total_duration || 0) + deltaDur, 0), row.id);
          // 同步沉淀记录的 extracted_data，聊天弹层再次打开时显示修正后的值
          const pr = db.prepare('SELECT extracted_data FROM precipitation_records WHERE id = ?').get(precipitationId);
          if (pr && pr.extracted_data) {
            try {
              const exData = JSON.parse(pr.extracted_data);
              if (Array.isArray(exData.exercises)) {
                let prChanged = false;
                for (const e of exData.exercises) {
                  const isTarget = (e.name || '').includes(job.name) || job.name.includes(e.name || '');
                  if (isTarget && parseFloat(e.count) === job.count && e.unit === job.unit
                      && Math.round(parseFloat(e.calorie) || 0) === job.estCalorie) {
                    e.calorie = calorie;
                    if (learned.minutesPerUnit > 0) e.duration = Math.max(Math.round(learned.minutesPerUnit * job.count), 1);
                    prChanged = true;
                  }
                }
                if (prChanged) {
                  if (Array.isArray(exData.exercises)) {
                    exData.total_calorie = exData.exercises.reduce((s, e) => s + (parseFloat(e.calorie) || 0), 0);
                    exData.total_duration = exData.exercises.reduce((s, e) => s + (parseFloat(e.duration) || 0), 0);
                  }
                  db.prepare('UPDATE precipitation_records SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(JSON.stringify(exData), precipitationId);
                }
              }
            } catch (e) { /* extracted_data 解析失败忽略 */ }
          }
          console.log(`[沉淀] 运动单位换算已按联网核实数据修正：${job.name} ${job.count}${job.unit} → ${calorie}千卡（估算 ${job.estCalorie}）`);
        }
      } catch (e) {
        console.warn('[沉淀] 运动单位联网学习失败（保留估算值）:', job.name, e.message);
      }
    }
  })();
}

function calculateExerciseCalorie(exerciseName, duration, intensity = 'moderate', weight = 60) {
  const name = (exerciseName || '').toLowerCase();

  // 优先查询运动库
  const dbExercise = getExerciseFromDb(exerciseName);
  if (dbExercise && dbExercise.met_value) {
    const met = parseFloat(dbExercise.met_value);
    const durationHour = (duration || 0) / 60;
    return Math.max(Math.round(met * weight * durationHour * 1.05), 10);
  }

  // 查找匹配的运动MET值（优先最长匹配）
  let met = 0;
  let bestMatch = '';
  for (const [exercise, value] of Object.entries(EXERCISE_MET_VALUES)) {
    if (name.includes(exercise.toLowerCase()) && exercise.length > bestMatch.length) {
      met = value;
      bestMatch = exercise;
    }
  }
  
  // 如果没有匹配到，根据强度使用默认值
  if (met === 0) {
    const intensityMet = {
      'low': 3.0,
      'moderate': 5.0,
      'high': 8.0
    };
    met = intensityMet[intensity] || 5.0;
  }
  
  // 计算热量: MET × 体重(kg) × 时长(小时) × 1.05
  const durationHour = (duration || 0) / 60;
  const calorie = Math.round(met * weight * durationHour * 1.05);
  
  return Math.max(calorie, 10); // 最少10千卡
}

const VALID_MEAL_TIMES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_TIME_MAP = {
  '早餐': 'breakfast', '早饭': 'breakfast', '早上': 'breakfast',
  '午餐': 'lunch', '午饭': 'lunch', '中午': 'lunch',
  '晚餐': 'dinner', '晚饭': 'dinner', '晚上': 'dinner',
  '加餐': 'snack', '下午茶': 'snack', '下午': 'snack', '夜宵': 'snack'
};

// 餐别关键词：snack 的「下午茶/下午」必须先于 lunch 的「午」判断，
// 否则「下午茶」中的「午」字会被裸「午」正则误判为午餐
const MEAL_PATTERNS = [
  { meal: 'snack', re: /下午茶|加餐|夜宵|宵夜|下午|午后/ },
  { meal: 'breakfast', re: /早餐|早饭|早上|今早|早晨|清晨/ },
  { meal: 'lunch', re: /午餐|午饭|中午|正午|午间/ },
  { meal: 'dinner', re: /晚餐|晚饭|晚上|今晚|夜里|深夜/ }
];

function inferMealTimeByContent(content, foods = []) {
  if (!content) return null;

  // 优先按“食物名称前面的最近一个餐别词”判断，避免整句同时出现“中午”“晚上”时被错判
  const foodNames = (foods || []).map(f => f.name).filter(Boolean);
  for (const name of foodNames) {
    const idx = content.indexOf(name);
    if (idx < 0) continue;
    const before = content.slice(0, idx + name.length);
    const segments = before.split(/[，,。！？；~]/);
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      for (const { meal, re } of MEAL_PATTERNS) {
        if (re.test(seg)) return meal;
      }
    }
  }

  // fallback：按整句扫描，snack 词优先（「下午茶」含「午」字，不能让午餐规则抢先）
  for (const { meal, re } of MEAL_PATTERNS) {
    if (re.test(content)) return meal;
  }
  return null;
}

function inferMealTimeByHour() {
  const hour = getChinaHour();
  if (hour >= 6 && hour < 10.5) return 'breakfast';
  if (hour < 14.5) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}

function normalizeMealTime(mealTime, content, foods = [], existingMeals = [], isUserEdit = false) {
  // 用户手动修改餐别时，直接采用用户的选择，不再进行时间/内容推断覆盖
  if (isUserEdit && mealTime) {
    const mt = String(mealTime).trim();
    const mapped = VALID_MEAL_TIMES.includes(mt) ? mt : MEAL_TIME_MAP[mt];
    if (mapped) {
      
      return mapped;
    }
  }

  const contentMeal = inferMealTimeByContent(content, foods);
  const timeMeal = inferMealTimeByHour();

  // 用户原文有明确餐别/时间词，优先级最高
  if (contentMeal) return contentMeal;

  // 午饭时段（10:30-14:30）且用户今天已有午餐记录，则本次归为加餐
  if (timeMeal === 'lunch' && existingMeals.includes('lunch')) {
    
    return 'snack';
  }

  // LLM 返回了有效餐别：只有和当前时间推断一致时才采用，否则以当前时间推断为准
  // 避免中午无明确时间词时 LLM 错判成晚餐
  if (mealTime) {
    const mt = String(mealTime).trim();
    const mapped = VALID_MEAL_TIMES.includes(mt) ? mt : MEAL_TIME_MAP[mt];
    if (mapped) {
      if (mapped === timeMeal) return mapped;
      
    }
  }

  return timeMeal;
}

function normalizeBodySubType(subType) {
  const map = {
    '体重': 'weight',
    '体脂': 'body_fat',
    '体脂率': 'body_fat',
    '腰围': 'waist',
    '臀围': 'hip',
    '胸围': 'chest',
    '手臂围': 'arm',
    '臂围': 'arm',
    '大腿围': 'thigh',
    '腿围': 'thigh',
    '小腿围': 'calf'
  };
  return map[subType] || subType || 'weight';
}

/**
 * 判断两个食物名是否视为同一种食物（完全相等或互相包含）
 */
function foodNamesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 1 && b.includes(a)) return true;
  if (b.length > 1 && a.includes(b)) return true;
  return false;
}

/**
 * 把 newFood 的数量/重量/营养素累加到 existingFood
 */
function round1(v) {
  return Math.round((parseFloat(v) || 0) * 10) / 10;
}

function mergeFoodInto(existingFood, newFood) {
  existingFood.quantity = round1((parseFloat(existingFood.quantity) || 1) + (parseFloat(newFood.quantity) || 1));
  existingFood.weight = round1((parseFloat(existingFood.weight) || 0) + (parseFloat(newFood.weight) || 0));
  existingFood.calorie = round1((parseFloat(existingFood.calorie) || 0) + (parseFloat(newFood.calorie) || 0));
  existingFood.protein = round1((parseFloat(existingFood.protein) || 0) + (parseFloat(newFood.protein) || 0));
  existingFood.carb = round1((parseFloat(existingFood.carb) || 0) + (parseFloat(newFood.carb) || 0));
  existingFood.fat = round1((parseFloat(existingFood.fat) || 0) + (parseFloat(newFood.fat) || 0));
}

/**
 * 合并 foods 数组中的同名食物
 */
function mergeDuplicateFoodsInList(foods) {
  const map = new Map();
  for (const f of foods) {
    if (!f || !f.name) continue;
    const existing = map.get(f.name);
    if (existing) {
      mergeFoodInto(existing, f);
    } else {
      map.set(f.name, { ...f });
    }
  }
  return Array.from(map.values());
}

/**
 * 计算 foods 数组的总热量和三大营养素
 */
function calculateFoodTotals(foods) {
  return {
    calorie: foods.reduce((sum, f) => sum + (parseFloat(f.calorie) || 0), 0),
    protein: foods.reduce((sum, f) => sum + (parseFloat(f.protein) || 0), 0),
    carb: foods.reduce((sum, f) => sum + (parseFloat(f.carb) || 0), 0),
    fat: foods.reduce((sum, f) => sum + (parseFloat(f.fat) || 0), 0)
  };
}

/**
 * 同步 diet_records 的计算结果到 precipitation_records.extracted_data
 * 确保沉淀记录 UI、饮食记录列表、搭搭回复显示一致的热量值
 * @param {number} userId - 用户ID
 * @param {number} precipitationId - 沉淀记录ID
 * @param {string} mealTime - 餐别
 */
function syncDietExtractedDataToPrecipitation(userId, precipitationId, mealTime) {
  if (!precipitationId || !mealTime) return;
  
  try {
    // 查找关联的 diet_records
    const rows = db.prepare(`
      SELECT * FROM diet_records
      WHERE user_id = ? AND precipitation_id = ? AND status = 1
      ORDER BY id ASC
    `).all(userId, precipitationId);
    
    if (rows.length === 0) return;
    
    // 合并所有食物（同一 precipitation_id 可能有多条记录）
    const allFoods = [];
    let totalCalorie = 0;
    let totalProtein = 0;
    let totalCarb = 0;
    let totalFat = 0;
    
    for (const row of rows) {
      const foods = safeJsonParse(row.foods, []);
      allFoods.push(...foods);
      totalCalorie += row.total_calorie || 0;
      totalProtein += row.total_protein || 0;
      totalCarb += row.total_carb || 0;
      totalFat += row.total_fat || 0;
    }
    
    // 更新 precipitation_records.extracted_data
    const newExtractedData = {
      meal_time: mealTime,
      foods: allFoods,
      total_calorie: totalCalorie,
      total_protein: totalProtein,
      total_carb: totalCarb,
      total_fat: totalFat
    };
    
    db.prepare(`
      UPDATE precipitation_records
      SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(JSON.stringify(newExtractedData), precipitationId, userId);
    
    
  } catch (e) {
    console.error('[syncDietExtractedData] 同步失败:', e.message);
  }
}

/**
 * 批量沉淀处理完后的最终数据对账
 *
 * 核心背景：LLM 提取出 N 个饮食 item 时，每个 item 都会创建独立的 precipitation_record。
 * 但 syncToBusinessTable 在处理第 2~N 个 item 时，会把食物合并到第 1 个 item 对应的 diet_record 中。
 * 此时第 2~N 个 precipitation_record 的 extracted_data 仍是 LLM 原始值（如"冷面165千卡"），
 * 而第 1 个 precipitation_record 的 extracted_data 已被 syncDietExtractedDataToPrecipitation 修正为 diet_records 的正确值。
 * 前端根据 chat_message.precipitation_id 定位到某条 precipitation_record，就会出现数据不一致。
 *
 * 解决方案：收集本批次所有 precipitation_id，汇总所有关联的 diet_records，
 * 将合并后的完整数据写回每一条 precipitation_record，保证弹窗/记录列表/搭搭回复三处一致。
 *
 * @param {number} userId - 用户ID
 * @param {number} chatId - 聊天消息ID
 * @param {Array} processed - 已处理的 precipitation_record 数组
 * @param {string} recordDate - 记录日期 YYYY-MM-DD
 */
function finalReconcilePrecipitations(userId, chatId, processed, recordDate) {
  if (!processed || processed.length === 0) return;

  try {
    // 1. 收集本批次所有饮食类 precipitation_id
    const dietResults = processed.filter(r => r && r.type === 'diet_record' && r.precipitation_id);
    if (dietResults.length === 0) return;

    const precipitationIds = dietResults.map(r => r.precipitation_id);
    const idPlaceholders = precipitationIds.map(() => '?').join(',');

    // 2. 拉取所有关联的 diet_records（包含被合并过的）
    const today = recordDate || getChinaDateStr();
    const dietRows = db.prepare(`
      SELECT id, precipitation_id, meal_time, foods, total_calorie, total_protein, total_carb, total_fat
      FROM diet_records
      WHERE user_id = ? AND status = 1
      AND (precipitation_id IN (${idPlaceholders}) OR (record_date = ? AND meal_time IS NOT NULL))
      ORDER BY id ASC
    `).all(userId, ...precipitationIds, today);

    if (dietRows.length === 0) {
      
      return;
    }

    // 3. 合并所有 diet_records 的食物数据
    const allFoods = [];
    let totalCalorie = 0;
    let totalProtein = 0;
    let totalCarb = 0;
    let totalFat = 0;
    let mealTime = dietRows[0].meal_time;

    for (const row of dietRows) {
      const foods = safeJsonParse(row.foods) || [];
      // 只合并那些关联到本批次 precipitation_id 的记录，同餐其他记录不合并
      if (row.precipitation_id && precipitationIds.includes(row.precipitation_id)) {
        allFoods.push(...foods);
        totalCalorie += row.total_calorie || 0;
        totalProtein += row.total_protein || 0;
        totalCarb += row.total_carb || 0;
        totalFat += row.total_fat || 0;
        if (row.meal_time) mealTime = row.meal_time;
      }
    }

    if (allFoods.length === 0) {
      
      return;
    }

    // 4. 去重合并（同食物累加数量/重量）
    const mergedFoods = [];
    for (const food of allFoods) {
      const existing = mergedFoods.find(f => foodNamesMatch(f.name, food.name));
      if (existing) {
        existing.quantity = (existing.quantity || 1) + (food.quantity || 1);
        existing.weight = (existing.weight || 0) + (food.weight || 0);
        existing.calorie = (existing.calorie || 0) + (food.calorie || 0);
        existing.protein = (existing.protein || 0) + (food.protein || 0);
        existing.carb = (existing.carb || 0) + (food.carb || 0);
        existing.fat = (existing.fat || 0) + (food.fat || 0);
      } else {
        mergedFoods.push({ ...food });
      }
    }

    // 5. 用合并后的完整数据更新每一条 precipitation_record
    for (const precipId of precipitationIds) {
      const existing = db.prepare('SELECT extracted_data FROM precipitation_records WHERE id = ? AND user_id = ?').get(precipId, userId);
      if (!existing) continue;

      const baseData = safeJsonParse(existing.extracted_data) || {};
      const newExtractedData = {
        ...baseData,
        meal_time: mealTime || baseData.meal_time || 'lunch',
        foods: mergedFoods,
        total_calorie: totalCalorie,
        total_protein: totalProtein,
        total_carb: totalCarb,
        total_fat: totalFat
      };

      db.prepare(`
        UPDATE precipitation_records
        SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(JSON.stringify(newExtractedData), precipId, userId);

      
    }

    // 6. 确保 chat_message.precipitation_id 指向数据最完整的那条
    // 优先选择食物数最多的 precipitation_id
    if (chatId) {
      let bestId = precipitationIds[0];
      for (const pid of precipitationIds) {
        const rec = db.prepare('SELECT extracted_data FROM precipitation_records WHERE id = ?').get(pid);
        if (rec) {
          const ext = safeJsonParse(rec.extracted_data) || {};
          const foodsCount = (ext.foods || []).length;
          const bestRec = db.prepare('SELECT extracted_data FROM precipitation_records WHERE id = ?').get(bestId);
          const bestExt = safeJsonParse(bestRec?.extracted_data) || {};
          const bestFoodsCount = (bestExt.foods || []).length;
          if (foodsCount > bestFoodsCount) bestId = pid;
        }
      }
      db.prepare(`
        UPDATE chat_messages
        SET precipitation_id = ?, precipitation_status = 1
        WHERE id = ? AND user_id = ?
      `).run(bestId, chatId, userId);
      
    }

    
  } catch (e) {
    console.error('[最终对账] 失败（不影响主流程）:', e.message);
  }
}

/**
 * 同步沉淀数据到业务表
 * @param {boolean} isUserEdit - 是否为用户手动编辑场景
 */
function syncToBusinessTable(userId, type, content, data, recordDate, subType = null, precipitationId = null, chatMessageId = null, isUserEdit = false) {
  const today = recordDate || getChinaDateStr();
  
  // 检查是否重复记录（饮食记录按 precipitation_id  upsert，不走旧的食物级去重）
  const duplicateCheck = type === 'diet_record'
    ? { isDuplicate: false }
    : hasDuplicateRecord(userId, type, data, recordDate);
  
  if (duplicateCheck.isDuplicate) {
    
    
    // 对于习惯记录（喝水），累加数值
    // 对于饮食记录，如果有需要累加或更新的食物，执行相应操作
    if (type === 'diet_record' && duplicateCheck.hasMerge && duplicateCheck.foodsToMerge) {
      for (const merge of duplicateCheck.foodsToMerge) {
        const { newFood, recordId, existingFood } = merge;
        
        // 累加数量、重量和热量
        const updatedQuantity = (existingFood.quantity || 1) + (newFood.quantity || 1);
        const updatedWeight = (existingFood.weight || 0) + (newFood.weight || 0);
        const updatedCalorie = (existingFood.calorie || 0) + (newFood.calorie || 0);
        const updatedProtein = (existingFood.protein || 0) + (newFood.protein || 0);
        const updatedCarb = (existingFood.carb || 0) + (newFood.carb || 0);
        const updatedFat = (existingFood.fat || 0) + (newFood.fat || 0);
        
        // 更新记录
        const updatedFood = {
          ...existingFood,
          quantity: updatedQuantity,
          weight: updatedWeight,
          calorie: updatedCalorie,
          protein: updatedProtein,
          carb: updatedCarb,
          fat: updatedFat
        };
        
        db.prepare(`
          UPDATE diet_records 
          SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, precipitation_id = COALESCE(precipitation_id, ?), updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(JSON.stringify([updatedFood]), updatedCalorie, updatedProtein, updatedCarb, updatedFat, precipitationId, recordId);
        
        
      }
      
      // 处理全新的食物（如果有）
      if (duplicateCheck.newFoodsToAdd && duplicateCheck.newFoodsToAdd.length > 0) {
        const insertDiet = db.prepare(`
          INSERT INTO diet_records (user_id, precipitation_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);
        
        for (const food of duplicateCheck.newFoodsToAdd) {
          const correctedFood = computeFoodNutrition(food);
          const foodArray = [correctedFood];
          const info = insertDiet.run(userId, precipitationId, today, mealTime, JSON.stringify(foodArray),
            correctedFood.calorie || 0, correctedFood.protein || 0, correctedFood.carb || 0, correctedFood.fat || 0);
          // 后台异步兜底：0千卡食物 LLM 估算后回写，不阻塞保存链路
          scheduleZeroCalorieBackfill(userId, info.lastInsertRowid, foodArray);
        }
      }

      return { skipped: false, updated: true, recordId: duplicateCheck.foodsToMerge[0]?.recordId };
    }
    
    // 对于饮食记录的热量修正（更新而非累加）
    if (type === 'diet_record' && duplicateCheck.hasUpdate && duplicateCheck.foodsToUpdate) {
      for (const update of duplicateCheck.foodsToUpdate) {
        const { newFood, recordId, existingFood } = update;
        
        // 修正热量：保留原有重量和数量，只更新热量和营养
        const correctedFood = computeFoodNutrition({
          ...existingFood,
          calorie: newFood.calorie || existingFood.calorie,
          protein: newFood.protein || existingFood.protein,
          carb: newFood.carb || existingFood.carb,
          fat: newFood.fat || existingFood.fat
        });
        const correctedArray = [correctedFood];
        
        db.prepare(`
          UPDATE diet_records
          SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, precipitation_id = COALESCE(precipitation_id, ?), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(JSON.stringify(correctedArray), correctedFood.calorie, correctedFood.protein, correctedFood.carb, correctedFood.fat, precipitationId, recordId);
        // 后台异步兜底：0千卡食物 LLM 估算后回写，不阻塞保存链路
        scheduleZeroCalorieBackfill(userId, recordId, correctedArray);


      }

      // 处理全新的食物（如果有）
      if (duplicateCheck.newFoodsToAdd && duplicateCheck.newFoodsToAdd.length > 0) {
        const insertDiet = db.prepare(`
          INSERT INTO diet_records (user_id, precipitation_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        for (const food of duplicateCheck.newFoodsToAdd) {
          const correctedFood = computeFoodNutrition(food);
          const foodArray = [correctedFood];
          const info = insertDiet.run(userId, precipitationId, today, mealTime, JSON.stringify(foodArray),
            correctedFood.calorie || 0, correctedFood.protein || 0, correctedFood.carb || 0, correctedFood.fat || 0);
          // 后台异步兜底：0千卡食物 LLM 估算后回写，不阻塞保存链路
          scheduleZeroCalorieBackfill(userId, info.lastInsertRowid, foodArray);
        }
      }

      return { skipped: false, updated: true, recordId: duplicateCheck.foodsToUpdate[0]?.recordId };
    }
    
    // 身体数据有 precipitation_id 时，允许删除旧记录后重新插入（支持修改全部围度）
    if (type === 'body_data' && precipitationId) {
      db.prepare('DELETE FROM body_records WHERE user_id = ? AND precipitation_id = ?').run(userId, precipitationId);
      
    } else if (type === 'habit') {
      // 习惯记录（喝水）累加，其他子类型更新
      const habitData = data || {};
      const subType = habitData.sub_type || 'water';
      const addValue = parseInt(habitData.value) || 0;
      const existing = db.prepare('SELECT value, water_ml FROM habit_records WHERE id = ?').get(duplicateCheck.recordId);
      const newValue = subType === 'water' ? (parseInt(existing.value) || 0) + addValue : addValue;
      const newWaterMl = subType === 'water' ? (parseInt(existing.water_ml) || 0) + addValue : 0;
      db.prepare(`
        UPDATE habit_records
        SET value = ?, water_ml = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newValue, newWaterMl, duplicateCheck.recordId);
      return { skipped: false, updated: true, recordId: duplicateCheck.recordId };
    } else {
      // 对于其他类型，直接返回（不重复插入）
      return { skipped: true, reason: 'duplicate', recordId: duplicateCheck.recordId };
    }
  }

  switch (type) {
    case 'diet_record': {
      const dietData = data || {};
      const rawFoods = Array.isArray(dietData.foods) ? dietData.foods : [];

      // 查询用户今天已有的餐别，用于午饭时段判断是加餐还是午餐
      let existingMeals = [];
      if (userId) {
        try {
          existingMeals = db.prepare(`
            SELECT DISTINCT meal_time FROM diet_records
            WHERE user_id = ? AND record_date = ? AND status = 1
          `).pluck().all(userId, today);
        } catch (e) {
          console.error('[syncToBusinessTable] 查询已有餐别失败:', e.message);
        }
      }

      const mealTime = normalizeMealTime(dietData.meal_time || subType, content, rawFoods, existingMeals, isUserEdit);
      if (rawFoods.length === 0) {
        
        return { skipped: true, reason: 'no foods' };
      }

      // 同一消息内若出现同名食物，先合并数量/重量/营养素
      let foods = mergeDuplicateFoodsInList(rawFoods.map(f => computeFoodNutrition(f)));

      // 同一沉淀记录对应一条饮食记录：更新时合并旧的多条食物记录并删除多余行
      if (precipitationId) {
        const existingRows = db.prepare('SELECT id FROM diet_records WHERE user_id = ? AND precipitation_id = ? ORDER BY id ASC').all(userId, precipitationId);
        if (existingRows.length > 0) {
          const keepId = existingRows[0].id;
          const totals = calculateFoodTotals(foods);
          db.prepare(`
            UPDATE diet_records
            SET record_date = ?, meal_time = ?, foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, status = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(today, mealTime, JSON.stringify(foods), totals.calorie, totals.protein, totals.carb, totals.fat, keepId);
          // 后台异步兜底：0千卡食物 LLM 估算后回写，不阻塞保存链路
          scheduleZeroCalorieBackfill(userId, keepId, foods);

          for (let i = 1; i < existingRows.length; i++) {
            db.prepare('DELETE FROM diet_records WHERE id = ? AND user_id = ?').run(existingRows[i].id, userId);
          }

          
          // 同步更新 precipitation_records.extracted_data，确保所有显示路径一致
          syncDietExtractedDataToPrecipitation(userId, precipitationId, mealTime);
          return { skipped: false, updated: true, recordId: keepId };
        }

        // 无旧记录时直接 upsert，防止并发重复插入
        // 新增前先与同一餐其他记录（含手动记录）合并同名食物，避免同一餐重复计算热量
        const existingMealRows = db.prepare(`
          SELECT id, foods FROM diet_records
          WHERE user_id = ? AND record_date = ? AND meal_time = ? AND status = 1
          ORDER BY id ASC
        `).all(userId, today, mealTime);

        const unmergedFoods = [];
        for (const newFood of foods) {
          let merged = false;
          for (const row of existingMealRows) {
            const existingFoods = safeJsonParse(row.foods, []);
            const match = existingFoods.find(ef => ef && ef.name && foodNamesMatch(ef.name, newFood.name));
            if (match) {
              mergeFoodInto(match, newFood);
              const totals = calculateFoodTotals(existingFoods);
              db.prepare(`
                UPDATE diet_records
                SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
              `).run(JSON.stringify(existingFoods), totals.calorie, totals.protein, totals.carb, totals.fat, row.id, userId);
              
              merged = true;
              break;
            }
          }
          if (!merged) unmergedFoods.push(newFood);
        }

        if (unmergedFoods.length === 0) {
          
          // 同步更新 precipitation_records.extracted_data
          syncDietExtractedDataToPrecipitation(userId, precipitationId, mealTime);
          return { skipped: false, updated: true, recordId: existingMealRows[0]?.id };
        }

        const totals = calculateFoodTotals(unmergedFoods);
        const upsertDiet = db.prepare(`
          INSERT INTO diet_records (user_id, precipitation_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(user_id, precipitation_id) DO UPDATE SET
            record_date = excluded.record_date,
            meal_time = excluded.meal_time,
            foods = excluded.foods,
            total_calorie = excluded.total_calorie,
            total_protein = excluded.total_protein,
            total_carb = excluded.total_carb,
            total_fat = excluded.total_fat,
            status = 1,
            updated_at = CURRENT_TIMESTAMP
        `);
        const result = upsertDiet.run(userId, precipitationId, today, mealTime, JSON.stringify(unmergedFoods), totals.calorie, totals.protein, totals.carb, totals.fat);
        // 后台异步兜底：0千卡食物 LLM 估算后回写，不阻塞保存链路
        scheduleZeroCalorieBackfill(userId, result.lastInsertRowid, unmergedFoods);

        // 同步更新 precipitation_records.extracted_data
        syncDietExtractedDataToPrecipitation(userId, precipitationId, mealTime);
        return { skipped: false, updated: result.changes === 1, recordId: null };
      }

      // 合并到同一餐别的已有记录：同名食物累加数量/重量/营养素，避免同一餐出现两个卤鸭腿
      const existingMealRows = db.prepare(`
        SELECT id, foods FROM diet_records
        WHERE user_id = ? AND record_date = ? AND meal_time = ? AND status = 1
        ORDER BY id ASC
      `).all(userId, today, mealTime);

      const unmergedFoods = [];
      for (const newFood of foods) {
        let merged = false;
        for (const row of existingMealRows) {
          const existingFoods = safeJsonParse(row.foods, []);
          const match = existingFoods.find(ef => ef && ef.name && foodNamesMatch(ef.name, newFood.name));
          if (match) {
            mergeFoodInto(match, newFood);
            const totals = calculateFoodTotals(existingFoods);
            db.prepare(`
              UPDATE diet_records
              SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND user_id = ?
            `).run(JSON.stringify(existingFoods), totals.calorie, totals.protein, totals.carb, totals.fat, row.id, userId);
            
            merged = true;
            break;
          }
        }
        if (!merged) unmergedFoods.push(newFood);
      }

      if (unmergedFoods.length === 0) {
        
        // 同步更新 precipitation_records.extracted_data
        syncDietExtractedDataToPrecipitation(userId, precipitationId, mealTime);
        return { skipped: false, updated: true, recordId: existingMealRows[0]?.id };
      }

      const totals = calculateFoodTotals(unmergedFoods);
      const insertDiet = db.prepare(`
        INSERT INTO diet_records (user_id, precipitation_id, record_date, meal_time, foods, total_calorie, total_protein, total_carb, total_fat, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      const result = insertDiet.run(userId, precipitationId, today, mealTime, JSON.stringify(unmergedFoods), totals.calorie, totals.protein, totals.carb, totals.fat);
      // 后台异步兜底：0千卡食物 LLM 估算后回写，不阻塞保存链路
      scheduleZeroCalorieBackfill(userId, result.lastInsertRowid, unmergedFoods);

      // 同步更新 precipitation_records.extracted_data
      syncDietExtractedDataToPrecipitation(userId, precipitationId, mealTime);
      return { skipped: false, recordId: result.lastInsertRowid };
    }
    case 'exercise_record': {
      const exData = data || {};
      let exercises = exData.exercises || [];

      // 获取用户体重（默认60kg）
      let userWeight = 60;
      try {
        const userProfile = db.prepare('SELECT current_weight FROM user_profiles WHERE user_id = ?').get(userId);
        if (userProfile && userProfile.current_weight) {
          userWeight = parseFloat(userProfile.current_weight);
        }
      } catch (e) {
        // 使用默认体重
      }

  // 计算/校验每项运动的热量（优先按运动库/MET计算，不再使用LLM估算值，确保和搭子回复一致）
  const unitLearnJobs = []; // 需要联网核实单位换算的运动（后台学习后回写修正）
  exercises = exercises.map(e => {
    const duration = parseFloat(e.duration) || 0;
    const intensity = e.intensity || 'moderate';
    const count = parseFloat(e.count) || 0;
    const unit = e.unit || null;

    // 非时长单位条目（爬N层/做N个/跳绳N下）：按"库单位数据 → 本地估算"出热量与换算时长，
    // 不把 count 硬凑成 duration；联网核实由后台学习任务完成后回写修正
    if (count > 0 && unit) {
      // 用户同时给了独立有效时长（如"爬20层花了15分钟"，duration≠count）：
      // 时长是用户实测、最可靠，直接按时长精确计算，单位仅作展示标注
      const independentDuration = duration > 0 && Math.abs(duration - count) >= 0.001;
      if (independentDuration) {
        return {
          name: e.name,
          count,
          unit,
          duration,
          intensity,
          calorie: calculateExerciseCalorie(e.name, duration, intensity, userWeight)
        };
      }
      const est = estimateUnitExercise(e.name, count, unit, userWeight);
      // estPerUnit60：换回 60kg 基准的每单位热量，供网络学习结果交叉验证
      unitLearnJobs.push({ name: e.name, count, unit, estCalorie: est.calorie, estPerUnit60: userWeight > 0 ? Math.round((est.perUnit / (userWeight / 60)) * 100) / 100 : est.perUnit });
      return {
        name: e.name,
        count,
        unit,
        duration: est.duration,
        intensity,
        calorie: est.calorie
      };
    }

    const calorie = calculateExerciseCalorie(e.name, duration, intensity, userWeight);
    return {
      name: e.name,
      duration: duration,
      intensity: intensity,
      calorie: calorie,
      // 保留用户报告的距离（公里），不随白名单丢弃
      ...(e.distance ? { distance: parseFloat(e.distance) || 0 } : {})
    };
  });

  // 后台联网核实单位换算并回写修正（不阻塞沉淀保存；最多 2 个/条消息，防止延迟累积）
  if (unitLearnJobs.length > 0 && precipitationId && !isUserEdit) {
    learnUnitExercisesInBackground(userId, precipitationId, today, unitLearnJobs.slice(0, 2));
  }

      const totalDur = exercises.reduce((sum, e) => sum + (e.duration || 0), 0);
      const totalCal = exercises.reduce((sum, e) => sum + (e.calorie || 0), 0);
      // 从第一个运动项目获取类型，默认为 'other'
      const exerciseType = exercises.length > 0 ? (exercises[0].name || 'other') : 'other';

      // 把计算后的热量同步写回沉淀记录，避免下次从聊天打开时热量仍是旧值
      function syncExerciseExtractedData() {
        if (!precipitationId) return;
        const updatedExData = { ...exData, exercises, total_duration: totalDur, total_calorie: totalCal };
        db.prepare('UPDATE precipitation_records SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(JSON.stringify(updatedExData), precipitationId);
      }

      // 同一沉淀记录对应一条运动记录：有 precipitation_id 时更新而非插入，避免修改后产生重复
      if (precipitationId) {
        const existingRows = db.prepare('SELECT id FROM exercise_records WHERE user_id = ? AND precipitation_id = ? ORDER BY id ASC').all(userId, precipitationId);
        if (existingRows.length > 0) {
          const keepId = existingRows[0].id;
          db.prepare(`
            UPDATE exercise_records
            SET record_date = ?, exercise_type = ?, exercises = ?, total_duration = ?, total_calorie = ?, status = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(today, exerciseType, JSON.stringify(exercises), totalDur, totalCal, keepId);

          for (let i = 1; i < existingRows.length; i++) {
            db.prepare('DELETE FROM exercise_records WHERE id = ? AND user_id = ?').run(existingRows[i].id, userId);
          }

          syncExerciseExtractedData();
          
          return { skipped: false, updated: true, recordId: keepId };
        }

        // 无旧记录时直接 upsert，防止并发重复插入
        const upsertEx = db.prepare(`
          INSERT INTO exercise_records (user_id, precipitation_id, record_date, exercise_type, exercises, total_duration, total_calorie, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(user_id, precipitation_id) DO UPDATE SET
            record_date = excluded.record_date,
            exercise_type = excluded.exercise_type,
            exercises = excluded.exercises,
            total_duration = excluded.total_duration,
            total_calorie = excluded.total_calorie,
            status = 1,
            updated_at = CURRENT_TIMESTAMP
        `);
        const exResult = upsertEx.run(userId, precipitationId, today, exerciseType, JSON.stringify(exercises), totalDur, totalCal);
        syncExerciseExtractedData();
        
        return { skipped: false, updated: exResult.changes === 1, recordId: null };
      }

      // 无 precipitation_id：同日同名运动合并（时长/消耗累加），否则新增一行
      const mergeResult = exerciseMergeService.mergeOrInsertExercise(userId, today, exerciseType, exercises);
      syncExerciseExtractedData();
      
      return { skipped: false, recordId: mergeResult.recordId, merged: mergeResult.merged };
    }
    case 'body_data': {
      const bodyData = data || {};
      // 兼容：sub_type 可能在 extracted_data 中，也可能在 precipitation_records.sub_type 中
      const mainSubType = bodyData.sub_type || subType || 'weight';
      const upsertBody = db.prepare(`
        INSERT INTO body_records (user_id, precipitation_id, record_date, type, value, unit, status)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(user_id, record_date, type) DO UPDATE SET
          value = excluded.value,
          unit = excluded.unit,
          precipitation_id = COALESCE(excluded.precipitation_id, precipitation_id),
          status = 1,
          updated_at = CURRENT_TIMESTAMP
      `);

      const items = [];
      const addBodyItem = (subType, value, unit) => {
        if (value === undefined || value === null || value === '') return;
        let v = parseFloat(value) || 0;
        let u = unit || 'kg';
        if (u === '斤') { v = parseFloat((v / 2).toFixed(1)); u = 'kg'; }
        const type = normalizeBodySubType(subType);
        if (items.some(i => i.type === type)) return;
        items.push({ type, value: v, unit: u });
      };

      addBodyItem(mainSubType, bodyData.value, bodyData.unit);
      if (bodyData.body_items && Array.isArray(bodyData.body_items)) {
        for (const item of bodyData.body_items) {
          addBodyItem(item.sub_type, item.value, item.unit);
        }
      }

      if (items.length === 0) break;

      // 同一沉淀记录更新时先删除旧身体数据，避免修改后产生重复
      if (precipitationId) {
        db.prepare('DELETE FROM body_records WHERE user_id = ? AND precipitation_id = ?').run(userId, precipitationId);
      }

      for (const item of items) {
        upsertBody.run(userId, precipitationId, today, item.type, item.value, item.unit);
      }

      // 如果有体重，同步更新当前体重
      const weightItem = items.find(i => i.type === 'weight');
      if (weightItem) {
        db.prepare('UPDATE user_profiles SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
          .run(weightItem.value, userId);
      }

      // 返回记录 id，供调用方推进任务/奖励（体重等身体数据也计入任务）
      const bodyRow = db.prepare(`
        SELECT id FROM body_records WHERE user_id = ? AND record_date = ? AND type = ? AND status = 1
        ORDER BY id DESC LIMIT 1
      `).get(userId, today, items[0].type);
      return { recordId: bodyRow ? bodyRow.id : null };
    }
    case 'habit': {
      const habitData = data || {};
      const subType = habitData.sub_type || 'water';
      const value = parseInt(habitData.value) || 0;
      const waterMl = subType === 'water' ? value : 0;
      const upsertHabit = db.prepare(`
        INSERT INTO habit_records (user_id, precipitation_id, record_date, type, value, water_ml, status)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(user_id, record_date, type) DO UPDATE SET
          value = value + excluded.value,
          water_ml = water_ml + excluded.water_ml,
          precipitation_id = COALESCE(excluded.precipitation_id, precipitation_id),
          status = 1,
          updated_at = CURRENT_TIMESTAMP
      `);
      upsertHabit.run(userId, precipitationId, today, subType, value, waterMl);
      // 返回记录 id，供调用方推进任务/奖励（ habit 类记录也计入任务）
      const habitRow = db.prepare(`
        SELECT id FROM habit_records WHERE user_id = ? AND record_date = ? AND type = ? AND status = 1
      `).get(userId, today, subType);
      return { recordId: habitRow ? habitRow.id : null };
    }
    case 'quote':
    case 'insight':
    case 'recipe':
    case 'method':
    case 'pitfall': {
      // 食谱数据格式规范化：确保 ingredients 为 [{name, amount}] 数组
      if (type === 'recipe' && data) {
        data = normalizeRecipeData(data, content);
      }

      // 食谱沉淀统一归类到 precipitation_recipe，便于前端识别并原文展示
      const recipeSubType = 'precipitation_recipe';
      const recipeTitle = (type === 'recipe' && data?.title && data.title !== recipeSubType)
        ? data.title
        : (content || '').slice(0, 32);
      // 防止旧链路把类型字符串写进 extracted_data.title
      if (type === 'recipe' && data) {
        data.title = recipeTitle;
        // 食谱总克数/总热量（按食材经食物库估算）
        const totals = computeRecipeTotals(data.ingredients);
        data.total_weight = totals.totalWeight;
        data.total_calorie = totals.totalCalorie;
      }

      // 食谱在确认时支持更新已有的 museum_items（如搭子推荐时已创建 pending）
      if (type === 'recipe' && chatMessageId) {
        const existing = db.prepare(`
          SELECT id FROM museum_items
          WHERE user_id = ? AND type = 'recipe' AND chat_message_id = ?
          ORDER BY id DESC LIMIT 1
        `).get(userId, chatMessageId);
        if (existing) {
          db.prepare(`
            UPDATE museum_items
            SET title = ?, sub_type = ?, content = ?, extracted_data = ?, status = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(recipeTitle, recipeSubType, content, data ? JSON.stringify(data) : null, existing.id);
          
          break;
        }
      }

      const insertMuseum = db.prepare(`
        INSERT INTO museum_items (user_id, chat_message_id, type, sub_type, title, content, extracted_data, author, emotion, tags, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      // 感悟/金句作者为用户；食谱/方法等来自搭子的资产保留 data.author 或 partner
      const museumAuthor = (type === 'quote' || type === 'insight') ? 'user' : (data?.author || 'partner');
      insertMuseum.run(
        userId,
        chatMessageId || null,
        type,
        type === 'recipe' ? recipeSubType : subType,
        type === 'recipe' ? recipeTitle : (data?.title || null),
        content,
        data ? JSON.stringify(data) : null,
        museumAuthor,
        data?.emotion || null,
        null,
        type === 'recipe' ? 1 : 0
      );
      break;
    }
  }
}

/**
 * 本地意图闸门：疑问句 / 否定犹豫 / 未来计划，且不含用户自我报告标记时，
 * 跳过一切沉淀（LLM 提取与规则兜底都不执行），避免"我今晚不吃饭"这类
 * 感叹/表态被误记为饮食。与 callPrecipitationAgent 主流程、规则兜底共用同一口径。
 */
function shouldSkipByIntent(content) {
  if (isQuestionContent(content) && !hasSelfReportMarker(content)) return true;
  if (hasNegativeRecordIntent(content) && !hasSelfReportMarker(content)) return true;
  if (hasFutureOrIntentionIntent(content) && !hasSelfReportMarker(content)) return true;
  return false;
}

/**
 * 调用信息沉淀 Agent
 */
async function callPrecipitationAgent(content, userId, chatId = null, recordDate = null) {
  if (!content || !content.trim()) {
    return { extracted: false, reason: '内容为空' };
  }

  // 本地过滤：不包含沉淀关键词的消息直接跳过
  if (!shouldPrecipitate(content)) {
    return { extracted: false, reason: '不包含沉淀内容' };
  }

  // 疑问句/否定犹豫/未来计划且无自我报告标记，直接跳过
  // 避免把"黄瓜...可以吗？"、"我今晚不吃饭"、"明天再练"这类消息错误沉淀
  // 但混合句"今晚不吃饭了，吃了一个苹果"含肯定动作，不应整条跳过——
  // 交给 LLM 提取肯定部分（LLM 提示词已有规则只提取肯定部分）
  if (shouldSkipByIntent(content) && !hasAffirmativeActionMarker(content)) {
    return { extracted: false, reason: '疑问/否定/未来意图不沉淀' };
  }

  const today = recordDate || getChinaDateStr();
  const systemPrompt = promptService.getPrompt('precipitation_agent', {
    current_time: getChinaDateTimeStr()
  });

  let items = [];
  try {
    // 关键修复：Hy3 模型在 no_think/think_high 模式下配合 response_format: json_object 会返回空内容，
    // 导致饮食/运动沉淀全部失败。改为在 systemPrompt 中强制要求 JSON 输出，不传递 response_format。
    // 另外：沉淀是异步流程，若 LLM 长时间无响应（>15s），直接走规则兜底，避免用户等待几十秒仍无沉淀。
    const response = await Promise.race([
      enqueuePrecipitationLLM(() => callWithPrompt(
        'precipitation_agent',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        { temperature: 0.1, max_tokens: 2500 }
      )),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PRECIPITATION_TIMEOUT')), 15000))
    ]);

    const resultText = response.choices[0].message.content || '{}';
    let rawItems = [];

    try {
      const parsed = JSON.parse(resultText);
      // 支持数组格式（多个记录）和单个对象格式
      if (Array.isArray(parsed)) {
        rawItems = parsed.filter(item => item && item.extracted);
      } else if (parsed && parsed.extracted) {
        rawItems.push(parsed);
      }
    } catch (e) {
      // 尝试提取所有JSON对象
      const objects = extractJsonObjects(resultText);
      for (const objText of objects) {
        try {
          const obj = JSON.parse(objText);
          if (Array.isArray(obj)) {
            rawItems.push(...obj.filter(item => item && item.extracted));
          } else if (obj && obj.extracted) {
            rawItems.push(obj);
          }
        } catch (err) {}
      }
    }

    // 兜底：显式写出"XX热量"但LLM漏提取的食物，强制补回；修正"半个"等分数；清理食物名；校验食物重量
    for (const item of rawItems) {
      if (item.type === 'diet_record' && item.extracted_data) {
        item.extracted_data = recoverExplicitCalorieFoods(content, item.extracted_data);
        item.extracted_data = normalizeHalfQuantities(content, item.extracted_data);
        item.extracted_data = sanitizeFoodNames(content, item.extracted_data);
        item.extracted_data = sanitizeFoodWeights(content, item.extracted_data);
      }
    }

    // 后处理纠正：LLM 把运动误判为饮食记录（如"做了30个俯卧撑"→diet_record），
    // 检查食物名是否含运动关键词，是则转为 exercise_record，避免运动被当成食物记录
    rawItems = convertMisclassifiedExercises(content, rawItems);

    // 防御：LLM 把闲聊/情绪语句误判为饮食（如"心情不太好"→diet_record），
    // 食物名含情绪词或=整句时丢弃该食物条目
    rawItems = sanitizeSuspiciousFoodNames(content, rawItems);

    // 兜底：LLM 漏提取的运动（如"然后哑铃臀腿40分钟"），按已知运动关键词补回
    rawItems = recoverMissedExercises(content, rawItems);

    items = rawItems.filter(item => isValidPrecipitationItem(item));

    // 按正确顺序补全营养：清洗名称 → 查库 → 库未命中且热量<=0 的用 LLM 估算填充
    // 确保入库前每个食物都有热量（computeFoodNutrition 查库命中会用库值覆盖估算值）
    for (const item of items) {
      if (item.type === 'diet_record' && item.extracted_data) {
        await fillMissingNutritionFromLLM(item.extracted_data);
      }
    }

    // 兜底：LLM 把牛奶/咖啡/果汁等饮品误判为喝水习惯时，转成 diet_record
    for (const item of items) {
      if (item.type === 'habit') {
        convertBeverageHabitToDiet(item, content, userId, recordDate);
      }
    }

    // 仅保留喝水习惯；睡眠、排便、心情等暂不生成沉淀记录（后续用于日记生成）
    items = items.filter(item => {
      if (item.type === 'habit') {
        const subType = item.extracted_data?.sub_type || 'water';
        return subType === 'water' || subType === '喝水';
      }
      if (item.type === 'emotion') return false;
      // 食谱由 partnerAssetAgent 专属处理，通用沉淀 Agent 不再处理
      if (item.type === 'recipe') return false;
      return true;
    });
  } catch (error) {
    console.error('沉淀 Agent 调用失败:', error.message);
    // 超时/异常时继续走外层兜底逻辑
  }

  // 兜底：当 LLM 没有提取到有效内容或调用超时，但内容明显是饮食/运动陈述句时，
  // 使用规则化方法强制生成沉淀记录，避免简单记录消息漏掉
  // 疑问句/咨询句（"奶茶热量高吗"）、否定/犹豫/未来计划（"我今晚不吃饭"）不兜底，避免误记
  if (items.length === 0 && !shouldSkipByIntent(content) && shouldPrecipitate(content)) {
    console.log(`[沉淀兜底] LLM 未提取到有效内容，尝试规则化兜底提取`);
    const fallbackItem = await fallbackExtractDietRecord(content, userId, recordDate);
    if (fallbackItem) {
      // 对兜底生成的条目也跑后处理纠正：
      // 1. 运动误判为饮食时纠正（如"做了30个俯卧撑"→diet_record→exercise_record）
      // 2. 闲聊/情绪误判为饮食时丢弃（如"心情不太好"→diet_record→过滤）
      const corrected = convertMisclassifiedExercises(content, [fallbackItem]);
      sanitizeSuspiciousFoodNames(content, corrected);
      const validCorrected = corrected.filter(item => isValidPrecipitationItem(item));
      if (validCorrected.length) {
        items.push(...validCorrected);
      }
    }
    // 运动规则兜底：LLM 超时/失败时饮食兜底不覆盖运动，
    // 复用 recoverMissedExercises（含"爬了N层"楼层兜底）从原文规则化提取运动
    if (!items.some(i => i.type === 'exercise_record')) {
      const exerciseItems = [];
      recoverMissedExercises(content, exerciseItems);
      const validExercises = exerciseItems.filter(item => isValidPrecipitationItem(item));
      if (validExercises.length) {
        console.log(`[沉淀兜底] 规则化提取到运动记录 ${validExercises.length} 条`);
        items.push(...validExercises);
      }
    }
  }

  if (items.length === 0) {
    return { extracted: false, reason: '未提取到有效内容' };
  }

  // 疑问句额外守卫：个人资产类沉淀必须置信度高且有实质内容
  if (isQuestionContent(content)) {
    const before = items.length;
    items = items.filter(item => {
      if (!ASSET_TYPES.includes(item.type)) return true;
      const confidence = parseFloat(item.confidence) || 0;
      if (confidence < 0.85) {
        
        return false;
      }
      if (!hasAssetContent(item.extracted_data)) {
        
        return false;
      }
      return true;
    });
    if (items.length < before) {
      console.log(`[沉淀] 疑问句守卫过滤：${before} → ${items.length} 条`);
    }
  }

  // 同一条消息内运动记录去重（防止 LLM 输出泛称+具体动作等重复项）
  const originalCount = items.length;
  items = deduplicateExercisesInBatch(items);
  if (items.length < originalCount) {
    console.log(`[沉淀] 同消息运动去重：${originalCount} → ${items.length} 条`);
  }

  console.log(`[沉淀] 提取到 ${items.length} 条记录`);

  const processed = [];
  const processedCount = 0;
  for (const item of items) {
    try {
      const result = withTransaction(() => {
        const r = processSinglePrecipitation(userId, chatId, content, item, recordDate);
        if (!r) return null;
        if (r.status === 1) {
          const syncResult = syncToBusinessTable(userId, r.type, content, r.extracted_data, recordDate, r.sub_type, r.precipitation_id, chatId);
          if (syncResult && syncResult.skipped) {
            
          } else if (syncResult && syncResult.updated) {
            
          }

          if (syncResult && !syncResult.skipped) {
            const relatedId = syncResult.recordId || r.precipitation_id;
            rewardService.rewardForPrecipitationRecord(userId, r.type, r.sub_type, r.extracted_data, relatedId);
          }
        }
        return r;
      });
      if (result) {
        processed.push(result);
      }
    } catch (err) {
      console.error('[沉淀] 单条记录事务失败:', err.message);
    }
  }

  // 关键修复：批量处理完后进行最终数据对账
  // 问题根源：多个 food item 被分别合并到同一条 diet_record 时，
  // 只有第一个 precipitation_id 能正确同步，其余 precipitation_record 保持 LLM 原始值。
  // 解决：收集本批次所有 precipitation_id，拉取所有关联的 diet_records，合并后写回每一个。
  finalReconcilePrecipitations(userId, chatId, processed, recordDate);

  console.log(`[沉淀] 成功处理 ${processed.length}/${items.length} 条记录`);
  return processed.length > 0 ? processed[processed.length - 1] : { extracted: false, reason: '处理失败' };
}

/**
 * 食谱数据格式规范化
 * 确保 ingredients 为 [{name, amount}] 数组，steps/tip 为字符串
 * @param {object} data 原始数据
 * @param {string} content 食谱原文（用于兜底解析）
 * @returns {object} 规范化后的数据
 */
function normalizeRecipeData(data, content) {
  if (!data || typeof data !== 'object') return data;

  // 规范化 ingredients
  if (data.ingredients) {
    if (Array.isArray(data.ingredients)) {
      data.ingredients = data.ingredients.map(item => {
        if (typeof item === 'string') {
          return parseIngredientStr(item);
        }
        if (item && typeof item === 'object' && item.name) {
          return { name: String(item.name), amount: item.amount ? String(item.amount) : '适量' };
        }
        return null;
      }).filter(Boolean);
    } else {
      data.ingredients = [];
    }
  } else {
    data.ingredients = [];
  }

  // 从 content 兜底解析食材
  if (data.ingredients.length === 0 && content) {
    const parsed = parseIngredientsFromContent(content);
    data.ingredients = parsed;
  }

  // 规范化 steps
  if (data.steps && !Array.isArray(data.steps) && typeof data.steps !== 'string') {
    data.steps = String(data.steps);
  }
  if (!data.steps && content) {
    const parsedSteps = parseStepsFromContent(content);
    if (parsedSteps) data.steps = parsedSteps;
  }

  // 规范化 tip
  if (data.tip && typeof data.tip !== 'string') {
    data.tip = String(data.tip);
  }

  return data;
}

/**
 * 解析单个食材字符串
 * @param {string} str 如 "鸡蛋 2个"
 * @returns {object} {name, amount}
 */
function parseIngredientStr(str) {
  if (!str || typeof str !== 'string') return { name: '食材', amount: '适量' };
  const s = str.trim();
  const match1 = s.match(/^(.+?)\s+(\d+[\u4e00-\u9fa5a-zA-Z]+)$/);
  if (match1) return { name: match1[1].trim(), amount: match1[2].trim() };
  const match2 = s.match(/^(.+?)(\d+[\u4e00-\u9fa5a-zA-Z]+)$/);
  if (match2) return { name: match2[1].trim(), amount: match2[2].trim() };
  return { name: s, amount: '适量' };
}

/**
 * 从 content 原文解析食材列表
 * @param {string} content
 * @returns {Array}
 */
function parseIngredientsFromContent(content) {
  if (!content) return [];
  const match = content.match(/食材[：:]\s*([\s\S]*?)(?=做法|步骤|小贴士|$)/i);
  if (!match) return [];
  const parts = match[1].split(/[、，,；;\n]/).map(s => s.trim()).filter(Boolean);
  return parts.map(parseIngredientStr);
}

/**
 * 从 content 原文解析做法步骤
 * @param {string} content
 * @returns {string|null}
 */
function parseStepsFromContent(content) {
  if (!content) return null;
  const match = content.match(/(?:做法|步骤)[：:]\s*([\s\S]*?)(?=小贴士|$)/i);
  if (match) return match[1].trim();
  return null;
}

/**
 * 按正确顺序补全营养：名称清洗（sanitizeFoodWeights）可能清零热量，
 * 此处用清洗后的干净名字先查食品库（中置信），库未命中且热量<=0 时
 * 调用 LLM 按经验估算填充。后续 computeFoodNutrition 查库命中会用库值
 * 覆盖（库更准），未命中则保留此估算值——确保沉淀入库即时有值不留 0
 * @param {Object} data 沉淀 extracted_data（foods 数组原地修改）
 * @returns {Promise<Object>} 补全后的 data
 */
async function fillMissingNutritionFromLLM(data) {
  if (!data || !Array.isArray(data.foods)) return data;
  const targets = data.foods.filter(f => f && f.name && !(parseFloat(f.calorie) > 0));
  await Promise.all(targets.map(async f => {
    // 先查库（中置信）：库有则交给 computeFoodNutrition 计算，无需估算
    let dbFood = null;
    try { dbFood = getFoodNutrition(f.name, f.category, { minConfidence: 'medium' }); } catch (e) { /* 库异常走 LLM */ }
    if (dbFood) return;
    // 库没有 → LLM 按经验估算（每个调用内置 15s 超时，并发执行）
    try {
      // 重量兜底为100g：负数/0/缺失一律按100g估算，防止负比例算出负热量
      const estWeight = parseFloat(f.weight) > 0 ? parseFloat(f.weight) : 100;
      const est = await estimateNutritionWithLLM(f.name, estWeight);
      if (est && parseFloat(est.calorie_per_100g) > 0) {
        const ratio = estWeight / 100;
        f.calorie = Math.round(est.calorie_per_100g * ratio);
        f.protein = Math.round((parseFloat(est.protein_per_100g) || 0) * ratio * 10) / 10;
        f.carb = Math.round((parseFloat(est.carb_per_100g) || 0) * ratio * 10) / 10;
        f.fat = Math.round((parseFloat(est.fat_per_100g) || 0) * ratio * 10) / 10;
        f.nutrition_source = 'llm_estimate';
        console.log(`[营养顺序补全] "${f.name}" 库未命中，LLM按每100g ${est.calorie_per_100g}千卡估算 → ${f.calorie}千卡`);
      }
    } catch (e) {
      console.warn(`[营养顺序补全] "${f.name}" LLM估算失败: ${e.message}`);
    }
  }));
  return data;
}

/**
 * 后台异步兜底：对刚入库饮食记录中热量为 0 的食物（名称清洗/重量修正清零后
 * 食物库未命中），调用 LLM 按名字重新估算营养并回写数据库。
 * 与运动学习的后台修正同模式，不阻塞保存链路（fillMissingNutritionFromLLM
 * 已在入库前按顺序补全，此函数仅作为遗漏路径的最后保险）
 * @param {number} userId 用户ID
 * @param {number} recordId diet_records 记录ID
 * @param {Array} foods 该记录的 foods 数组（原地修改后回写）
 */
function scheduleZeroCalorieBackfill(userId, recordId, foods) {
  if (!recordId || !Array.isArray(foods) || foods.length === 0) return;
  const zeroFoods = foods.filter(f => f && !(parseFloat(f.calorie) > 0));
  if (zeroFoods.length === 0) return;
  Promise.all(zeroFoods.map(async f => {
    try {
      // 重量兜底为100g：负数/0/缺失一律按100g估算，防止负比例算出负热量
      const estWeight = parseFloat(f.weight) > 0 ? parseFloat(f.weight) : 100;
      const est = await estimateNutritionWithLLM(f.name, estWeight);
      if (est && parseFloat(est.calorie_per_100g) > 0) {
        const ratio = estWeight / 100;
        f.calorie = Math.round(est.calorie_per_100g * ratio);
        f.protein = Math.round((parseFloat(est.protein_per_100g) || 0) * ratio * 10) / 10;
        f.carb = Math.round((parseFloat(est.carb_per_100g) || 0) * ratio * 10) / 10;
        f.fat = Math.round((parseFloat(est.fat_per_100g) || 0) * ratio * 10) / 10;
        console.log(`[营养兜底] "${f.name}" 热量为0，已用LLM按每100g ${est.calorie_per_100g}千卡回填 → ${f.calorie}千卡`);
        return f;
      }
    } catch (e) {
      console.warn(`[营养兜底] "${f.name}" LLM估算失败: ${e.message}`);
    }
    return null;
  })).then(filled => {
    if (!filled.filter(Boolean).length) return;
    // 重算总计并回写数据库
    const totals = calculateFoodTotals(foods);
    db.prepare(`
      UPDATE diet_records
      SET foods = ?, total_calorie = ?, total_protein = ?, total_carb = ?, total_fat = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(JSON.stringify(foods), totals.calorie, totals.protein, totals.carb, totals.fat, recordId, userId);
    // 同步更新沉淀记录的 extracted_data，保证各显示路径一致
    const precip = db.prepare('SELECT precipitation_id, meal_time FROM diet_records WHERE id = ?').get(recordId);
    if (precip && precip.precipitation_id) {
      try { syncDietExtractedDataToPrecipitation(userId, precip.precipitation_id, precip.meal_time); } catch (e) { /* 非阻塞 */ }
    }
    console.log(`[营养兜底] 记录#${recordId} 已回填 ${filled.filter(Boolean).length} 个0千卡食物，总计${totals.calorie}千卡`);
  }).catch(err => console.warn('[营养兜底] 回写失败:', err.message));
}

/**
 * 当食品库中找不到对应食物时，调用 LLM 进行真实营养估算。
 * 返回 { calorie_per_100g, protein_per_100g, carb_per_100g, fat_per_100g } 或 null。
 */
async function estimateNutritionWithLLM(foodName, weight = 100) {
  const prompt = `你是一名专业的营养师，请根据给出的食物名称估算每100克的热量（千卡）和主要营养素（克）。
请只返回一个 JSON 对象，不要返回任何解释、markdown 或多余文字。JSON 结构如下：
{
  "calorie_per_100g": 数字,
  "protein_per_100g": 数字,
  "carb_per_100g": 数字,
  "fat_per_100g": 数字
}
注意：
- 黑咖啡、美式咖啡等不加糖奶的纯咖啡，热量应接近0。
- 油炸、高糖、高脂食物热量应明显高于蒸煮类。
- 如果食物名称明显不是食物或无法判断，返回 {"calorie_per_100g":0,"protein_per_100g":0,"carb_per_100g":0,"fat_per_100g":0}。
食物名称：${foodName}
重量：${weight}克`;

  try {
    const response = await Promise.race([
      callWithPrompt(
        'precipitation_agent',
        [
          { role: 'system', content: 'You are a nutrition estimation assistant. Return only JSON.' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.2, max_tokens: 256 }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('NUTRITION_ESTIMATE_TIMEOUT')), 15000))
    ]);

    const text = (response.choices?.[0]?.message?.content || '').trim();
    const objects = extractJsonObjects(text);
    for (const objText of objects) {
      const parsed = safeJsonParse(objText, null);
      // 兼容 LLM 把数字输出成字符串（如 "180"）：统一 parseFloat 强转；
      // 并做合理性校验：每百克热量必须 >0 且 ≤1000（纯油脂约900，超过即为幻觉值），
      // 非食物名/负值/荒谬值一律返回 null 交由上层兜底处理
      const per100 = parseFloat(parsed && parsed.calorie_per_100g);
      if (Number.isFinite(per100) && per100 > 0 && per100 <= 1000) {
        return {
          calorie_per_100g: per100,
          protein_per_100g: parseFloat(parsed.protein_per_100g) || 0,
          carb_per_100g: parseFloat(parsed.carb_per_100g) || 0,
          fat_per_100g: parseFloat(parsed.fat_per_100g) || 0
        };
      }
    }
    console.warn(`[estimateNutritionWithLLM] 无法解析模型返回: ${text}`);
  } catch (err) {
    console.warn(`[estimateNutritionWithLLM] 调用失败: ${err.message}`);
  }
  return null;
}

/**
 * 规则化兜底提取一条饮食记录
 * 用于 LLM 未提取成功，但消息明显是饮食陈述句时
 */
/**
 * 按连接词拆分用户消息为多个食物段
 * 如"番茄炒蛋和一份米饭还有一小块红烧肉" → ["番茄炒蛋", "一份米饭", "一小块红烧肉"]
 * @param {string} text 原文
 * @returns {string[]} 拆分后的食物段数组
 */
function splitFoodSegments(text) {
  if (!text) return [];
  // 先去掉口语前缀（"我吃了""早上吃了""中午吃了"等）
  let cleaned = text.replace(/^[^，。、，]*?(?:我|今天)?(?:早上|中午|下午|晚上|夜宵|加餐|刚才|刚刚|刚|今天)?(?:吃了|喝了|吃|喝|加餐吃了?|来[了一]?个?|整[了一]?个?|搞[了一]?个?)\s*/,'');
  // 按连接词拆分：和/还有/加了/配/跟/加/以及/然后/接着/再来
  const segments = cleaned.split(/(?:和|还有|加了?|配|跟|加|以及|然后|接着|再来(?:一个)?|，|。)/);
  // 清理每段的首尾空白和残留前缀（"一小块""一份""两个""十颗""半斤"等量词前缀）
  // 量词覆盖：水果论颗/粒/瓣/串，饮品论杯/瓶/罐/盒，主食论碗/份/盘/碟，称重论斤/两/克
  const result = segments
    .map(s => s.trim())
    .map(s => s.replace(/^(?:[一二三四五六七八九十百两半几多大小]+(?:份|个|只|片|根|块|碗|杯|袋|包|斤|两|克|盘|碟|颗|粒|瓣|串|条|盒|瓶|罐|把|勺|卷|支|张|屉|枚|打)|半斤|几两)\s*/, '').trim())
    .filter(s => s.length > 0 && s.length <= 20);
  // 如果拆分后只有1段或0段，返回原文清理后的结果
  if (result.length <= 1) {
    return [cleaned.trim()].filter(s => s.length > 0);
  }
  return result;
}

/**
 * 兜底提取饮食记录：当 LLM 超时或失败时，用正则规则从原文提取食物
 * 支持多食物拆分（按"和/还有/加了/配"等连接词拆分）
 * @param {string} content 用户消息原文
 * @param {number} userId 用户ID
 * @param {string} recordDate 记录日期
 * @returns {Promise<Object|null>} diet_record 条目
 */
async function fallbackExtractDietRecord(content, userId, recordDate) {
  const text = String(content || '').trim();
  if (!text) return null;

  // 多食物拆分：按连接词把原文拆成多个食物段
  const segments = splitFoodSegments(text);
  console.log(`[沉淀兜底] 食物拆分: "${text.substring(0, 30)}" → ${segments.length} 段: ${JSON.stringify(segments)}`);

  const foods = [];
  // 运动关键词：fallback 拆分后如果某段是运动（如"跑了3公里"），不应当作食物
  const exerciseKw = ['跑', '走', '爬', '骑', '游', '跳', '瑜伽', '哑铃', '杠铃', '深蹲', '俯卧撑', '引体', '卷腹', '平板', '拉伸', '太极', '拳击', '篮球', '足球', '羽毛球', '乒乓球', '网球', 'HIIT', 'Tabata', '帕梅拉', '刘畊宏', '骑行', '骑车', '散步', '快走', '慢跑', '超慢跑'];

  for (const seg of segments) {
    // 检测该段是否为运动描述（如"跑了3公里""做了30个深蹲"），是则跳过不当作食物
    if (exerciseKw.some(kw => seg.includes(kw)) && /(跑了|走了|爬了|骑了|游了|跳了|做了|练了|打)/.test(seg)) {
      console.log(`[沉淀兜底] 跳过运动段（不应作为食物）: "${seg}"`);
      continue;
    }
    // 逐段提取食物名
    let foodName = cleanFoodName(seg);
    if (!foodName || isInvalidFoodName(foodName)) {
      const withoutQty = seg.replace(/\d+(?:\.\d+)?\s*(毫升|ml|克|g|杯|瓶|盒|罐|碗|个|份|片|根|只|块|勺)/gi, '');
      foodName = cleanFoodName(withoutQty);
      if (!foodName || isInvalidFoodName(foodName)) continue;
    }
    // 去掉开头残留的数量+单位
    const leadingQtyPattern = /^\d+(?:\.\d+)?\s*(毫升|ml|克|g|杯|瓶|盒|罐|碗|个|份|片|根|只|块|勺)/i;
    const strippedName = foodName.replace(leadingQtyPattern, '').trim();
    if (strippedName && !isInvalidFoodName(strippedName)) {
      foodName = cleanFoodName(strippedName);
    }

    // 查营养数据
    let caloriePer100g = 0, proteinPer100g = 0, carbPer100g = 0, fatPer100g = 0;
    let displayName = foodName;
    let nutrition = getFoodNutrition(foodName);
    if (nutrition) {
      caloriePer100g = Number(nutrition.calorie_per_100g) || 0;
      proteinPer100g = Number(nutrition.protein_per_100g) || 0;
      carbPer100g = Number(nutrition.carb_per_100g) || 0;
      fatPer100g = Number(nutrition.fat_per_100g) || 0;
      displayName = nutrition.food_name || foodName;
    } else {
      console.log(`[沉淀兜底] 食品库未命中「${foodName}」，请求 LLM 估算营养`);
      const estimated = await estimateNutritionWithLLM(foodName);
      if (estimated && estimated.calorie_per_100g > 0) {
        caloriePer100g = estimated.calorie_per_100g;
        proteinPer100g = estimated.protein_per_100g;
        carbPer100g = estimated.carb_per_100g;
        fatPer100g = estimated.fat_per_100g;
      } else {
        // LLM 估算失败时的保守规则兜底
        if (/发面饼|烙饼|煎饼|油饼|手抓饼|大饼|烧饼|馅饼/.test(foodName)) {
          caloriePer100g = 250;
        } else if (/面|粉|米线|拉面|板面|刀削面|炸酱面|拌面|炒面|热干面|螺蛳粉|酸辣粉|米粉|河粉|凉皮|面皮/.test(foodName)) {
          caloriePer100g = 140;
        } else if (/饭|炒饭|盖饭|拌饭|焖饭|焗饭|烩饭|煲仔饭|粥|稀饭|燕麦粥|小米粥/.test(foodName)) {
          caloriePer100g = /粥|稀饭/.test(foodName) ? 50 : 130;
        } else if (/包|馒头|花卷|饺子|馄饨|抄手|小笼包|生煎|锅贴|馅饼|包子|烧麦|春卷|油条|煎饼|烧饼|烙饼|面包|蛋糕|饼干|甜点|甜品/.test(foodName)) {
          caloriePer100g = /面包|蛋糕|饼干|甜点|甜品/.test(foodName) ? 300 : 200;
        } else if (/肉|鸡|牛|猪|羊|鱼|虾|蛋|豆腐|豆干|豆皮|腐竹|千张|素鸡/.test(foodName)) {
          caloriePer100g = 150;
        } else if (/水果|苹果|香蕉|橙子|葡萄|西瓜|草莓|蓝莓|猕猴桃|梨|桃|李子|樱桃|芒果|菠萝|柚子|橘子|柠檬|火龙果|哈密瓜|木瓜|百香果|杨梅|荔枝|龙眼|榴莲|山竹|椰子|甘蔗|柿子|枣|山楂|桑葚|无花果|牛油果|圣女果|黄瓜|西红柿|胡萝卜|生菜|菠菜|芹菜|西兰花|花菜|卷心菜|白菜|洋葱|大蒜|葱|姜|辣椒|茄子|豆角|豌豆|玉米|土豆|红薯|紫薯|南瓜|冬瓜|丝瓜|苦瓜|芦笋|竹笋|香菇|蘑菇|木耳|海带|紫菜/.test(foodName)) {
          caloriePer100g = 60;
        } else if (/奶|酸奶|牛奶|豆浆|奶茶|果汁|可乐|雪碧|饮料/.test(foodName)) {
          caloriePer100g = 50;
        } else if (/黑咖啡|美式咖啡|冰美式|热美式|清咖啡|纯咖啡/.test(foodName)) {
          caloriePer100g = 0;
        } else if (/拿铁|卡布奇诺|摩卡|玛奇朵|燕麦拿铁|生椰拿铁|澳白|flat white|咖啡/.test(foodName)) {
          caloriePer100g = 50;
        } else if (/茶|水/.test(foodName)) {
          caloriePer100g = 1;
        } else if (/油豆泡|油豆腐|炸豆腐|炸豆皮|油炸|炸鸡|炸猪|炸鱼|炸虾|薯条|油条|麻花|春卷|煎/.test(foodName)) {
          caloriePer100g = 280;
        } else {
          caloriePer100g = 100;
        }
      }
    }

    // 估算重量（从该段提取数量+单位）
    let weight = 100, quantity = 1, unit = 'g';
    const qtyMatch = seg.match(/(\d+(?:\.\d+)?|一|二|三|四|五|六|七|八|九|十|两|几|半)\s*(毫升|ml|克|g|杯|瓶|盒|罐|碗|个|份|片|根|只|块|勺)/i);
    if (qtyMatch) {
      const rawQty = qtyMatch[1];
      const chineseNums = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '几': 2, '半': 0.5 };
      quantity = chineseNums[rawQty] || parseFloat(rawQty) || 1;
      unit = qtyMatch[2].toLowerCase();
      if (['克', 'g'].includes(unit)) {
        weight = quantity;
      } else if (['毫升', 'ml'].includes(unit)) {
        weight = quantity;
      } else {
        const typical = getTypicalWeight(displayName, unit) || getTypicalWeight(foodName, unit);
        if (typical) {
          weight = quantity * typical;
        } else {
          const unitWeights = {
            '杯': 250, '瓶': 500, '盒': 200, '罐': 330, '碗': 400,
            '个': 80, '份': 300, '片': 30, '根': 100, '只': 50, '块': 50, '勺': 15
          };
          weight = quantity * (unitWeights[unit] || 100);
        }
      }
    } else if (/一碗|一大碗/.test(seg)) {
      weight = 400;
    } else if (/一大盘/.test(seg)) {
      weight = 350;
    } else if (/一杯/.test(seg)) {
      weight = 250;
    }

    // 宏量素自洽
    if (!(proteinPer100g > 0)) proteinPer100g = (caloriePer100g * 0.10) / 4;
    if (!(carbPer100g > 0)) carbPer100g = (caloriePer100g * 0.65) / 4;
    if (!(fatPer100g > 0)) fatPer100g = (caloriePer100g * 0.25) / 9;

    const ratio = weight / 100;
    foods.push({
      name: displayName,
      weight: Math.round(weight),
      quantity,
      unit,
      calorie: Math.round(caloriePer100g * ratio),
      protein: Math.round(proteinPer100g * ratio * 10) / 10,
      carb: Math.round(carbPer100g * ratio * 10) / 10,
      fat: Math.round(fatPer100g * ratio * 10) / 10
    });
  }

  if (foods.length === 0) return null;

  const totalCalorie = foods.reduce((s, f) => s + (f.calorie || 0), 0);
  const totalProtein = foods.reduce((s, f) => s + (f.protein || 0), 0);
  const totalCarb = foods.reduce((s, f) => s + (f.carb || 0), 0);
  const totalFat = foods.reduce((s, f) => s + (f.fat || 0), 0);

  return {
    type: 'diet_record',
    extracted_data: {
      foods,
      total_calorie: totalCalorie,
      total_protein: Math.round(totalProtein * 10) / 10,
      total_carb: Math.round(totalCarb * 10) / 10,
      total_fat: Math.round(totalFat * 10) / 10,
      meal_time: inferMealTimeByContent(text) || normalizeMealTime(null, text, [], [])
    },
    confidence: 0.9
  };
}

module.exports = { callPrecipitationAgent, syncToBusinessTable, isValidPrecipitationItem, shouldPrecipitate };
