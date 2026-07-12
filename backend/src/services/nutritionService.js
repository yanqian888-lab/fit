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
  '彩椒': { '个': 120 },
  '黄椒': { '个': 120 },
  '红椒': { '个': 120 },
  '青椒': { '个': 120 },
  '尖椒': { '个': 60 },
  '辣椒': { '个': 15 },
  '小米辣': { '个': 5 },
  '朝天椒': { '个': 5 }
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

function extractFoodKeywords(foodName) {
  let cleaned = foodName
    .replace(/^(一份|一个|一只|一片|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一盘|一碟|一点|一些|少量|适量|多|少|大|小|中|新|旧|生|熟|干|湿)/g, '')
    .replace(/(一份|一个|一只|一片|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一盘|一碟)$/g, '')
    .replace(/(炒|煮|蒸|炸|烤|煎|炖|焖|烧|拌|腌|卤|熏|爆|熘|烩|涮|焗|煨|熬|煲|凉拌|红烧|清蒸|油炸|干煸|水煮|蒜蓉|麻辣|香辣|酸甜|糖醋|椒盐|孜然|咖喱|番茄|芝士|奶油|黄油|酱油|醋|盐|糖|油|料酒|姜|葱|蒜|辣椒|花椒|八角|桂皮|香叶|胡椒)/g, '');

  const parts = cleaned.split(/[,，、\s]+/).filter(p => p.length >= 2);
  return parts.sort((a, b) => b.length - a.length);
}

const MISLEADING_SUFFIXES = ['粉', '酱', '油', '干', '片', '糕', '饼', '糖', '饮料', '冲调', '调料', '香精', '精', '奶茶', '脆'];

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

// 常见宽泛/笼统食物名的兜底营养值（避免匹配到不相关的加工食品）
const GENERIC_FOOD_FALLBACKS = {
  '蔬菜': { calorie_per_100g: 25, protein_per_100g: 1.5, carb_per_100g: 4, fat_per_100g: 0.3, category: '蔬菜水果类', sub_category: '熟制蔬菜' },
  '青菜': { calorie_per_100g: 25, protein_per_100g: 1.5, carb_per_100g: 4, fat_per_100g: 0.3, category: '蔬菜水果类', sub_category: '熟制蔬菜' },
  '水果': { calorie_per_100g: 50, protein_per_100g: 0.5, carb_per_100g: 12, fat_per_100g: 0.2, category: '蔬菜水果类', sub_category: '鲜果类' }
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
 * @param {Object} food - { name, weight, quantity, unit, calorie, protein, carb, fat }
 * @returns {Object} - 补齐/修正后的食物对象
 */
function computeFoodNutrition(food) {
  const dbFood = getFoodNutrition(food.name, food.category);
  const { weight, quantity, unit } = resolveWeight(food);
  const ratio = weight / 100;

  if (!dbFood) {
    // 数据库无匹配，保留传入值，但补齐重量字段
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

  // 如果用户已经选择了分类，且数据库匹配到的分类不一致，保留用户选择的分类
  // 避免"蔬菜"被错误覆盖成"零食饮料类"
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

module.exports = {
  getFoodNutrition,
  computeFoodNutrition,
  getTypicalWeight,
  extractFoodKeywords
};
