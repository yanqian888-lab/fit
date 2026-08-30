/**
 * 营养计算服务
 * 统一根据食物数据库计算食物的卡路里与三大营养素。
 * 不依赖 LLM Agent 估算，计算/修改记录时由后端直接给出结果。
 */
const { db } = require('../db');

// 通用计数单位 → 克换算表
const UNIT_WEIGHTS = {
  'kg': 1000,
  '公斤': 1000,
  '个': 50,
  '只': 50,
  '片': 30,
  '块': 30,
  '杯': 250,
  '碗': 150,
  '勺': 15,
  '盒': 200,
  '瓶': 500,
  '根': 100,
  '条': 50,
  '袋': 50,
  '粒': 5,
  '颗': 5,
  '口': 20
};

// 常见食物单份典型重量（克），覆盖通用表中过于笼统的默认值
const FOOD_TYPICAL_WEIGHTS = {
  // 蔬菜（椒类）
  '彩椒': { '个': 120 },
  '黄椒': { '个': 120 },
  '红椒': { '个': 120 },
  '青椒': { '个': 120 },
  '尖椒': { '个': 60 },
  '辣椒': { '个': 15 },
  '小米辣': { '个': 5 },
  '朝天椒': { '个': 5 },

  // 蛋类：一个中等大小带壳约 55-70g，卤/茶叶蛋近似
  '鹅蛋': { '个': 130 },
  '鸭蛋': { '个': 70 },
  '鸡蛋': { '个': 55 },
  '茶叶蛋': { '个': 55 },
  '卤蛋': { '个': 55 },
  '鹌鹑蛋': { '个': 10 },

  // 主食类
  '馒头': { '个': 100 },
  '包子': { '个': 80 },
  '饺子': { '个': 12 },
  '水饺': { '个': 12 },
  '烧麦': { '个': 50 },
  '粽子': { '个': 150 },
  '玉米': { '根': 200, '个': 200 },
  '红薯': { '个': 150 },
  '地瓜': { '个': 150 },
  '紫薯': { '个': 150 },
  '土豆': { '个': 150 },
  '马铃薯': { '个': 150 },
  '山药': { '根': 150, '段': 100 },
  '芋头': { '个': 100 },
  '面包': { '片': 30 },
  '吐司': { '片': 30 },
  '米饭': { '碗': 150 },
  '面条': { '碗': 150 },
  '粥': { '碗': 250 },
  '油条': { '根': 50 },
  '煎饼': { '个': 150 },
  '手抓饼': { '个': 100 },
  '馅饼': { '个': 120 },
  '蛋挞': { '个': 25 },

  // 水果类（按常见可食部估算）
  '苹果': { '个': 150 },
  '香蕉': { '根': 100, '个': 100 },
  '橙子': { '个': 130 },
  '橘子': { '个': 100 },
  '梨': { '个': 150 },
  '桃子': { '个': 150 },
  '猕猴桃': { '个': 80 },
  '火龙果': { '个': 250 },
  '芒果': { '个': 200 },
  '西瓜': { '片': 300, '块': 300 },
  '哈密瓜': { '片': 200, '块': 200 },
  '草莓': { '个': 15 },
  '葡萄': { '颗': 8 },
  '荔枝': { '颗': 10 },
  '樱桃': { '颗': 10 },
  '龙眼': { '颗': 10 },
  '桂圆': { '颗': 10 },
  '蓝莓': { '颗': 2 },
  '杨梅': { '颗': 10 },
  '枇杷': { '个': 30 },
  '柿子': { '个': 120 },
  '柚子': { '瓣': 80 },
  '菠萝': { '片': 100 },
  '凤梨': { '片': 100 },

  // 肉蛋奶/海鲜类
  '鸡腿': { '个': 150, '只': 150 },
  '鸡翅': { '个': 40 },
  '鸡爪': { '个': 35 },
  '鸭腿': { '个': 150 },
  '鸭脖': { '根': 50 },
  '鸭掌': { '个': 30 },
  '猪蹄': { '只': 250, '个': 250 },
  '排骨': { '块': 30 },
  '牛排': { '块': 150, '片': 150 },
  '猪排': { '块': 120 },
  '虾': { '只': 10 },
  '虾仁': { '只': 8 },
  '龙虾': { '只': 300 },
  '生蚝': { '个': 50 },
  '扇贝': { '个': 25 },
  '花甲': { '个': 10 },
  '蛏子': { '个': 10 },
  '鱿鱼': { '条': 150 },
  '鱼': { '条': 300 },
  '香肠': { '根': 50 },
  '烤肠': { '根': 50 },
  '培根': { '片': 15 },

  // 豆制品
  '豆腐': { '块': 300 },
  '北豆腐': { '块': 300 },
  '南豆腐': { '块': 300 },
  '内酯豆腐': { '盒': 350 },
  '豆干': { '块': 50 },
  '香干': { '块': 50 },
  '素鸡': { '个': 100, '段': 80 },
  '腐竹': { '根': 20 },
  '千张': { '张': 100 },
  '豆腐皮': { '张': 100 },

  // 零食/甜点
  '饼干': { '片': 10, '块': 10 },
  '曲奇': { '块': 10 },
  '薯片': { '片': 2, '包': 35 },
  '巧克力': { '块': 10 },
  '冰淇淋': { '个': 65, '支': 65, '球': 50 },
  '雪糕': { '支': 65 },
  '冰棍': { '支': 60 },
  '蛋糕': { '块': 80 },
  '面包': { '个': 80 },
  '泡芙': { '个': 15 },
  '蛋挞': { '个': 25 },
  '糖果': { '颗': 5 },

  // 饮品
  '牛奶': { '盒': 250, '杯': 250 },
  '酸奶': { '盒': 100, '杯': 100 },
  '豆浆': { '杯': 250 },
  '咖啡': { '杯': 250 },
  '奶茶': { '杯': 500 },
  '可乐': { '罐': 330, '瓶': 500 },
  '啤酒': { '罐': 330, '瓶': 500 },
  '果汁': { '杯': 250, '瓶': 300 }
};

// 常见别名映射
const ALIAS_MAP = {
  '米饭': ['熟制谷薯', '大米', '饭'],
  '面条': ['熟制谷薯', '小麦', '面'],
  '馒头': ['熟制谷薯', '小麦'],
  '鸡蛋': ['水煮鸡蛋', '鸡蛋', '蛋白', '蛋黄'],
  '牛奶': ['奶', '乳'],
  '希腊酸奶': ['零糖零脂希腊酸奶', '希腊酸奶', '无糖希腊酸奶', '酸奶'],
  '酸奶': ['全脂酸奶', '脱脂酸奶', '希腊酸奶', '风味酸奶', '酸奶', '酸乳'],
  '豆浆': ['豆浆', '豆奶'],
  '卤牛肉': ['酱牛肉', '卤牛肉', '牛肉'],
  '酱牛肉': ['酱牛肉', '卤牛肉'],
  '卤煮': ['卤煮', '北京卤煮', '卤煮火烧'],
  '牛肉': ['水煮瘦牛肉', '酱牛肉', '牛肉', '牛'],
  '猪肉': ['猪肉', '猪'],
  '鸡肉': ['鸡肉', '鸡'],
  '鱼肉': ['鱼'],
  '虾': ['虾'],
  '豆腐': ['豆腐', '豆制品'],
  '苹果': ['苹果'],
  '香蕉': ['香蕉'],
  '橙子': ['橙', '柑'],
  '西瓜': ['西瓜'],
  '葡萄': ['葡萄'],
  '西红柿': ['西红柿', '番茄'],
  '黄瓜': ['黄瓜'],
  '白菜': ['白菜'],
  '菠菜': ['菠菜'],
  '胡萝卜': ['胡萝卜'],
  '土豆': ['蒸土豆', '土豆', '马铃薯'],
  '红薯': ['蒸红薯', '红薯', '地瓜', '甘薯'],
  '玉米': ['煮糯玉米（粘玉米）', '玉米'],
  '糯玉米': ['煮糯玉米（粘玉米）', '糯玉米', '粘玉米'],
  '甜玉米': ['煮甜玉米（水果玉米）', '甜玉米', '水果玉米'],
  '山药': ['蒸山药', '山药'],
  '紫薯': ['蒸紫薯', '紫薯'],
  '芋头': ['蒸芋头', '芋头'],
  '花生': ['花生'],
  '核桃': ['核桃'],
  '瓜子': ['瓜子', '葵花籽'],
  '巧克力': ['巧克力'],
  '饼干': ['饼干'],
  '蛋糕': ['蛋糕'],
  '面包': ['面包'],
  '南瓜发糕': ['南瓜发糕', '发糕'],
  '汉堡': ['汉堡'],
  '披萨': ['披萨', '比萨'],
  '可乐': ['可乐', '碳酸饮料'],
  '奶茶': ['奶茶'],
  '咖啡': ['咖啡'],
  '茶': ['茶'],
  '啤酒': ['啤酒'],
  '白酒': ['白酒', '酒'],
  '红酒': ['红酒', '葡萄酒']
};

const QUANTIFIERS = /^(一份|一个|一只|一片|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一盘|一碟|一点|一些|少量|适量|多|少|大|小|中|新|旧|生|熟|干|湿)/g;
const QUANTIFIERS_SUFFIX = /(一份|一个|一只|一片|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一盘|一碟)$/g;

function extractFoodKeywords(foodName) {
  // 只去掉量词，保留烹饪/口味修饰词等完整信息
  // 若完整形态在食品库中无匹配，不再强行 fallback 到去掉烹饪词的基础食材，
  // 而是返回 null，由上层（搭子/LLM）脱离公共食谱库查找热量信息。
  const cleaned = foodName
    .replace(QUANTIFIERS, '')
    .replace(QUANTIFIERS_SUFFIX, '');
  const parts = cleaned.split(/[,，、\s]+/).filter(p => p.length >= 2);
  return parts.sort((a, b) => b.length - a.length);
}

const MISLEADING_SUFFIXES = [
  '粉', '酱', '油', '干', '片', '糕', '饼', '糖', '饮料', '冲调', '调料', '香精', '精', '奶茶', '脆',
  // 复合/套餐类食品标记：简单食材不应命中这些加工/组合食品
  '堡', '汉堡', '饭', '盒饭', '便当', '套餐', '三明治', '卷', '披萨', '比萨', '意面',
  '沙拉', '塔可', '肉夹馍', '火烧', '灌饼', '蛋挞', '薯条', '鸡块'
];

// 前端分类 key -> 数据库 category 名称
const CATEGORY_MAP = {
  'staple': '主食类',
  'vegetable': '蔬菜水果类',
  'meat': '肉蛋奶类',
  'bean': '豆类坚果类',
  'snack': '零食饮料类',
  'dish': '中西菜肴类',
  'seasoning': '调味油脂类',
  'meal_replacement': '代餐特殊食品'
};

/**
 * 常见宽泛/笼统食物名的兜底营养值（避免匹配到不相关的加工食品）
 * 包含常见液体饮品的通用营养值，用于食物库无匹配时的兜底
 */
const GENERIC_FOOD_FALLBACKS = {
  '蔬菜': { calorie_per_100g: 25, protein_per_100g: 1.5, carb_per_100g: 4, fat_per_100g: 0.3, category: '蔬菜水果类', sub_category: '熟制蔬菜' },
  '青菜': { calorie_per_100g: 25, protein_per_100g: 1.5, carb_per_100g: 4, fat_per_100g: 0.3, category: '蔬菜水果类', sub_category: '熟制蔬菜' },
  '水果': { calorie_per_100g: 50, protein_per_100g: 0.5, carb_per_100g: 12, fat_per_100g: 0.2, category: '蔬菜水果类', sub_category: '鲜果类' },
  '牛奶': { calorie_per_100g: 54, protein_per_100g: 3, carb_per_100g: 3.4, fat_per_100g: 3.2, category: '肉蛋奶类', sub_category: '乳制品' },
  '低脂牛奶': { calorie_per_100g: 47, protein_per_100g: 3.4, carb_per_100g: 5, fat_per_100g: 1.4, category: '肉蛋奶类', sub_category: '乳制品' },
  '脱脂牛奶': { calorie_per_100g: 35, protein_per_100g: 3.4, carb_per_100g: 4.8, fat_per_100g: 0.4, category: '肉蛋奶类', sub_category: '乳制品' },
  '酸奶': { calorie_per_100g: 72, protein_per_100g: 2.5, carb_per_100g: 9.4, fat_per_100g: 2.7, category: '肉蛋奶类', sub_category: '乳制品' },
  '豆浆': { calorie_per_100g: 16, protein_per_100g: 1.8, carb_per_100g: 1.1, fat_per_100g: 0.7, category: '豆类坚果类', sub_category: '豆制品' },
  '果汁': { calorie_per_100g: 45, protein_per_100g: 0.7, carb_per_100g: 10.4, fat_per_100g: 0.2, category: '零食饮料类', sub_category: '果汁' },
  '咖啡': { calorie_per_100g: 2, protein_per_100g: 0.3, carb_per_100g: 0, fat_per_100g: 0, category: '零食饮料类', sub_category: '咖啡' },
  '茶': { calorie_per_100g: 1, protein_per_100g: 0.1, carb_per_100g: 0, fat_per_100g: 0, category: '零食饮料类', sub_category: '茶饮' }
};

function isMisleadingMatch(keyword, foodName) {
  if (!keyword || !foodName) return false;
  if (foodName === keyword) return false;
  if (foodName.startsWith(keyword)) {
    const rest = foodName.slice(keyword.length);
    for (const suffix of MISLEADING_SUFFIXES) {
      if (rest.includes(suffix) && !keyword.includes(suffix)) return true;
    }
    return false;
  }
  if (!foodName.includes(keyword)) return false;
  for (const suffix of MISLEADING_SUFFIXES) {
    if (foodName.includes(suffix) && !keyword.includes(suffix)) return true;
  }
  return false;
}

function normalizeCategory(category) {
  if (!category) return null;
  if (Object.values(CATEGORY_MAP).includes(category)) return category;
  return CATEGORY_MAP[category] || null;
}

function findBestFoodMatch(keyword, categoryFilter = null) {
  if (!keyword) return null;
  try {
    let sql = `
      SELECT calories_per_100g as calorie_per_100g,
             protein_per_100g, carb_per_100g, fat_per_100g,
             category, sub_category, food_name
      FROM food_db
      WHERE (food_name = ?
         OR food_name LIKE ? ESCAPE '\\'
         OR food_name LIKE ? ESCAPE '\\')
    `;
    const params = [keyword, `${escapeLike(keyword)}%`, `%${escapeLike(keyword)}%`];

    if (categoryFilter) {
      sql += ' AND category = ?';
      params.push(categoryFilter);
    }

    sql += `
      ORDER BY
        CASE
          WHEN food_name = ? THEN 0
          WHEN food_name LIKE ? ESCAPE '\\' THEN 1
          WHEN food_name LIKE ? ESCAPE '\\' THEN 2
          ELSE 3
        END,
        LENGTH(food_name) ASC
      LIMIT 5
    `;
    params.push(keyword, `${escapeLike(keyword)}%`, `%${escapeLike(keyword)}%`);

    const rows = db.prepare(sql).all(...params);

    for (const row of rows) {
      if (!isMisleadingMatch(keyword, row.food_name)) return row;
    }
    return rows[0] || null;
  } catch (e) {
    console.error('[nutritionService] 查询食物数据库失败:', e.message);
    return null;
  }
}

function getFoodNutrition(foodName, preferredCategory = null) {
  try {
    const name = (foodName || '').trim();
    if (!name) return null;

    const dbCategory = normalizeCategory(preferredCategory);

    // 1. 如果食物名是宽泛词，直接用兜底营养值，避免匹配到不相关的加工食品
    const genericFallback = GENERIC_FOOD_FALLBACKS[name];
    if (genericFallback) {
      // 若用户传了分类，优先使用用户传入的分类；否则用兜底分类
      if (dbCategory && dbCategory !== genericFallback.category) {
        return { ...genericFallback, category: dbCategory, sub_category: '' };
      }
      return genericFallback;
    }

    // 2. 优先在首选分类中匹配
    if (dbCategory) {
      // 直接匹配
      let food = findBestFoodMatch(name, dbCategory);
      if (food) return food;

      // 精确别名匹配
      const directAlias = ALIAS_MAP[name];
      if (directAlias) {
        for (const pattern of directAlias) {
          const aliasFood = findBestFoodMatch(pattern, dbCategory);
          if (aliasFood) return aliasFood;
        }
      }

      // 关键词匹配
      const keywords = extractFoodKeywords(name);
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        const kwFood = findBestFoodMatch(kw, dbCategory);
        if (kwFood) return kwFood;
      }
    }

    // 3. 精确别名优先匹配（如"鸡蛋"应优先对应"水煮鸡蛋"而非"鸡蛋清"）
    const directAlias = ALIAS_MAP[name];
    if (directAlias) {
      for (const pattern of directAlias) {
        const aliasFood = findBestFoodMatch(pattern);
        if (aliasFood) return aliasFood;
      }
    }

    // 4. 全局匹配（原有逻辑）
    const food = findBestFoodMatch(name);
    if (food) return food;

    // 5. 关键词匹配（优先走别名映射，避免"土豆"命中"土豆炖牛肉"等菜品）
    const keywords = extractFoodKeywords(name);
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      // 关键词本身有明确别名时，先按别名目标匹配（如"土豆"→"蒸土豆"）
      const kwAlias = ALIAS_MAP[kw];
      if (kwAlias) {
        for (const pattern of kwAlias) {
          const aliasFood = findBestFoodMatch(pattern);
          if (aliasFood) return aliasFood;
        }
      }
      const kwFood = findBestFoodMatch(kw);
      if (kwFood) return kwFood;
    }

    // 6. 泛化别名匹配
    for (const [alias, patterns] of Object.entries(ALIAS_MAP)) {
      if (name.includes(alias)) {
        for (const pattern of patterns) {
          const aliasFood = findBestFoodMatch(pattern);
          if (aliasFood) return aliasFood;
        }
      }
    }

    return null;
  } catch (e) {
    console.error('[nutritionService] 查询食物数据库失败:', e.message);
    return null;
  }
}

function escapeLike(str) {
  return str.replace(/[\\%_]/g, '\\$&');
}

function getTypicalWeight(foodName, unit) {
  if (!unit) return null;
  const names = Object.keys(FOOD_TYPICAL_WEIGHTS).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (foodName.includes(name)) {
      const w = FOOD_TYPICAL_WEIGHTS[name][unit];
      if (w) return w;
    }
  }
  return UNIT_WEIGHTS[unit] || null;
}

function extractWeightFromName(name) {
  if (!name) return { name, weight: null };
  const match = name.match(/^(\d+(?:\.\d+)?)\s*(g|克|kg|公斤|mg|毫克)\s*/);
  if (match) {
    let weight = parseFloat(match[1]);
    const unit = match[2];
    if (unit === 'kg' || unit === '公斤') weight *= 1000;
    if (unit === 'mg' || unit === '毫克') weight /= 1000;
    return { name: name.replace(match[0], '').trim(), weight };
  }
  return { name, weight: null };
}

function resolveWeight(food) {
  let weight = parseFloat(food.weight) || 0;
  let quantity = parseFloat(food.quantity);
  if (isNaN(quantity) || quantity <= 0) quantity = 1;
  const unit = food.unit || 'g';

  // 如果食物名本身包含重量（如"100克玉米"），优先从名称中提取
  const { weight: nameWeight } = extractWeightFromName(food.name || '');
  if (nameWeight > 0 && weight <= 0) {
    return { weight: nameWeight, quantity, unit: 'g' };
  }

  if (weight > 0) return { weight, quantity, unit };

  if (unit === 'g' || unit === '克') {
    return { weight: quantity || 100, quantity: quantity || 1, unit };
  }

  const typical = getTypicalWeight(food.name || '', unit);
  if (typical) {
    return { weight: quantity * typical, quantity, unit };
  }

  return { weight: 100, quantity, unit };
}

/**
 * 根据食物数据库计算单个食物的营养数据
 * 热量优先级：用户指定热量 > 食物库查询 > 通用兜底值
 * @param {Object} food - { name, weight, quantity, unit, calorie, protein, carb, fat, user_specified_calorie }
 * @returns {Object} - 补齐/修正后的食物对象
 */
function computeFoodNutrition(food) {
  const { weight, quantity, unit } = resolveWeight(food);
  const ratio = weight / 100;

  // 1. 如果用户指定了热量，保留用户指定值，从食物库/兜底值补充营养素
  if (food.user_specified_calorie && parseFloat(food.calorie) > 0) {
    const dbFood = getFoodNutrition(food.name, food.category);
    const fallbackFood = GENERIC_FOOD_FALLBACKS[food.name] || null;
    const nutrientSource = dbFood || fallbackFood;

    if (nutrientSource) {
      // 使用用户指定的热量，补充营养素
      return {
        ...food,
        weight,
        quantity,
        unit,
        calorie: parseFloat(food.calorie),
        protein: parseFloat(food.protein) || Math.round((nutrientSource.protein_per_100g || 0) * ratio * 10) / 10,
        carb: parseFloat(food.carb) || Math.round((nutrientSource.carb_per_100g || 0) * ratio * 10) / 10,
        fat: parseFloat(food.fat) || Math.round((nutrientSource.fat_per_100g || 0) * ratio * 10) / 10,
        category: food.category || nutrientSource.category || '',
        sub_category: food.sub_category || nutrientSource.sub_category || ''
      };
    } else {
      // 食物库和兜底值都没有，保留用户指定的热量和营养素
      return {
        ...food,
        weight,
        quantity,
        unit,
        calorie: parseFloat(food.calorie),
        protein: parseFloat(food.protein) || 0,
        carb: parseFloat(food.carb) || 0,
        fat: parseFloat(food.fat) || 0
      };
    }
  }

  // 2. 用户未指定热量，从食物库查询
  const dbFood = getFoodNutrition(food.name, food.category);

  if (dbFood) {
    // 如果用户已经选择了分类，且数据库匹配到的分类不一致，保留用户选择的分类
    const incomingCategory = normalizeCategory(food.category);
    const dbCategory = normalizeCategory(dbFood.category);
    const shouldKeepIncomingCategory = incomingCategory && dbCategory && incomingCategory !== dbCategory;

    return {
      ...food,
      weight,
      quantity,
      unit,
      category: shouldKeepIncomingCategory ? food.category : (dbFood.category || food.category || ''),
      sub_category: shouldKeepIncomingCategory ? food.sub_category : (dbFood.sub_category || food.sub_category || ''),
      calorie: Math.round((dbFood.calorie_per_100g || 0) * ratio * 10) / 10,
      protein: Math.round((dbFood.protein_per_100g || 0) * ratio * 10) / 10,
      carb: Math.round((dbFood.carb_per_100g || 0) * ratio * 10) / 10,
      fat: Math.round((dbFood.fat_per_100g || 0) * ratio * 10) / 10
    };
  }

  // 3. 食物库无匹配，使用通用兜底值
  const fallbackFood = GENERIC_FOOD_FALLBACKS[food.name];
  if (fallbackFood) {
    return {
      ...food,
      weight,
      quantity,
      unit,
      category: food.category || fallbackFood.category || '',
      sub_category: food.sub_category || fallbackFood.sub_category || '',
      calorie: Math.round((fallbackFood.calorie_per_100g || 0) * ratio * 10) / 10,
      protein: Math.round((fallbackFood.protein_per_100g || 0) * ratio * 10) / 10,
      carb: Math.round((fallbackFood.carb_per_100g || 0) * ratio * 10) / 10,
      fat: Math.round((fallbackFood.fat_per_100g || 0) * ratio * 10) / 10
    };
  }

  // 4. 连兜底值都没有，保留传入值
  return {
    ...food,
    weight,
    quantity,
    unit,
    calorie: parseFloat(food.calorie) || 0,
    protein: parseFloat(food.protein) || 0,
    carb: parseFloat(food.carb) || 0,
    fat: parseFloat(food.fat) || 0
  };
}

/**
 * 把食材用量字符串解析为 computeFoodNutrition 入参
 * 支持 "150g"/"150克"/"1kg"/"2片"/"1勺" 等；"适量/少许"/空 返回 null（无法估算，不计入）
 */
function parseAmountToFood(name, amount) {
  let a = String(amount || '').trim();
  if (!a || a === '适量' || a === '少许') {
    // 用量缺失时，尝试从名称里提取（如 "全麦面包 2 片"）
    const m = String(name || '').match(/(\d+(?:\.\d+)?)\s*([\u4e00-\u9fa5a-zA-Z]+)\s*$/);
    if (m) return { name, quantity: parseFloat(m[1]), unit: m[2] };
    return null;
  }
  let m = a.match(/^(\d+(?:\.\d+)?)\s*(g|克)$/i);
  if (m) return { name, weight: parseFloat(m[1]) };
  m = a.match(/^(\d+(?:\.\d+)?)\s*(kg|千克)$/i);
  if (m) return { name, weight: parseFloat(m[1]) * 1000 };
  m = a.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (m) return { name, quantity: parseFloat(m[1]), unit: m[2].trim() };
  return null;
}

/**
 * 计算食谱的总克数与总热量（按食材逐项经食物库估算）
 * @param {Array} ingredients [{name, amount}] 或 ["鸡胸肉 150g"] 字符串数组
 * @returns {{ totalWeight: number, totalCalorie: number }} 克/千卡（整数估算）
 */
function computeRecipeTotals(ingredients) {
  let totalWeight = 0;
  let totalCalorie = 0;
  for (const raw of ingredients || []) {
    let name = '';
    let amount = '';
    if (typeof raw === 'string') {
      // "鸡胸肉 150g" / "鸡胸肉150g" → 名称 + 用量
      const m = raw.trim().match(/^(.+?)[\s　]*(\d+(?:\.\d+)?\s*[\u4e00-\u9fa5a-zA-Z]+.*)$/);
      if (m) { name = m[1].trim(); amount = m[2].trim(); } else { name = raw.trim(); }
    } else if (raw && raw.name) {
      name = raw.name;
      amount = raw.amount;
    }
    if (!name) continue;
    const food = parseAmountToFood(name, amount);
    if (!food) continue;
    try {
      const n = computeFoodNutrition(food);
      totalWeight += n.weight || 0;
      totalCalorie += n.calorie || 0;
    } catch (e) { /* 单项失败不影响整体 */ }
  }
  return { totalWeight: Math.round(totalWeight), totalCalorie: Math.round(totalCalorie) };
}

module.exports = {
  getFoodNutrition,
  computeFoodNutrition,
  computeRecipeTotals,
  getTypicalWeight,
  extractFoodKeywords
};
