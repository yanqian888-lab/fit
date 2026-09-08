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

  // 快餐汉堡类（含面包胚整份约200-250g）
  '巨无霸': { '个': 220 },
  '汉堡': { '个': 220 },
  '汉堡包': { '个': 220 },
  '堡': { '个': 200 },
  '三明治': { '个': 180, '份': 180 },
  '卷饼': { '个': 200 },
  '鸡肉卷': { '个': 200 },

  // 饭类便当（整份约400-450g）
  '鸡排饭': { '份': 450, '盒': 450 },
  '盒饭': { '份': 450, '盒': 450 },
  '肥牛饭': { '份': 400 },
  '牛肉饭': { '份': 400 },
  '卤肉饭': { '份': 400 },
  '叉烧饭': { '份': 450 },
  '烧腊饭': { '份': 450 },
  '盖浇饭': { '份': 400 },
  '轻食': { '份': 300 },
  '沙拉': { '份': 300, '碗': 300 },
  '寿司': { '份': 250 },

  // 方便食品（整包/整盒）
  '螺蛳粉': { '包': 300, '碗': 400 },
  '酸辣粉': { '包': 280, '碗': 380 },
  '泡面': { '包': 250, '碗': 350 },
  '方便面': { '包': 250, '碗': 350 },
  '自热火锅': { '盒': 400 },
  '自热米饭': { '盒': 380 },
  '自嗨锅': { '盒': 400 },

  // 奶茶果茶咖啡类（市售中/大杯约450-500ml）
  '多肉葡萄': { '杯': 500 },
  '芝芝': { '杯': 500 },
  '波波': { '杯': 500 },
  '酪酪': { '杯': 500 },
  '奶绿': { '杯': 500 },
  '奶盖': { '杯': 500 },
  '果茶': { '杯': 500 },
  '柠檬茶': { '杯': 500 },
  '轻乳茶': { '杯': 500 },
  '拿铁': { '杯': 450 },
  '美式': { '杯': 400 },

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
// 注：基础食材（米饭/牛奶/西红柿等）已由 food_db.aliases 数据层接管（如 米饭→米饭(蒸,粳米)），
// 此处不再硬编码，避免"米饭→生大米346kcal"这类熟/生混淆错误
const ALIAS_MAP = {
  '面条': ['熟制谷薯', '小麦', '面'],
  '馒头': ['熟制谷薯', '小麦'],
  '鸡蛋': ['水煮鸡蛋', '鸡蛋', '蛋白', '蛋黄'],
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
  '三分糖奶茶': ['奶茶（三分糖）', '奶茶'],
  '微糖奶茶': ['奶茶（三分糖）', '奶茶'],
  '少糖奶茶': ['奶茶（三分糖）', '奶茶'],
  // 连锁茶饮：品牌+品名（如"一点点四季奶青"）统一指向食品库标准条目
  '四季奶青': ['四季奶青'],
  '奶青': ['四季奶青'],
  // 奶茶小料：「珍珠」必须指向煮粉圆，严禁误配「珍珠白蘑」等菜肴
  '珍珠': ['煮珍珠', '粉圆'],
  '小珍珠': ['煮珍珠', '粉圆'],
  '大珍珠': ['煮珍珠', '粉圆'],
  '波霸': ['煮珍珠', '粉圆'],
  '粉圆': ['煮珍珠', '粉圆'],
  '黑糖珍珠': ['煮珍珠', '粉圆'],
  '粉稞': ['黑糖粉稞', '粉稞'],
  '粉粿': ['黑糖粉稞', '粉稞'],
  '黑糖粉粿': ['黑糖粉稞', '粉稞'],
  '椰果': ['椰果', '椰果粒'],
  '椰果粒': ['椰果', '椰果粒'],
  '芋圆': ['芋圆'],
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
  '沙拉', '塔可', '肉夹馍', '火烧', '灌饼', '蛋挞', '薯条', '鸡块',
  // 菜肴类后缀：防止短食材名误配同名菜肴（如「珍珠」误中「珍珠白蘑/珍珠里脊丝」）
  '蘑菇', '白蘑', '蘑', '里脊', '肉丝', '肉丁', '肉丸'
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
  // 括号内为规格/糖度备注（如"（大杯，全糖）""（三分糖）"），不属于品名主体：
  // 移除括号内容后再判断，避免"全糖"里的"糖"字误触发误导后缀规则
  const main = foodName.replace(/[（(][^）)]*[）)]/g, '');
  if (main.startsWith(keyword)) {
    const rest = main.slice(keyword.length);
    for (const suffix of MISLEADING_SUFFIXES) {
      if (rest.includes(suffix) && !keyword.includes(suffix)) return true;
    }
    return false;
  }
  if (!main.includes(keyword)) return false;
  for (const suffix of MISLEADING_SUFFIXES) {
    if (main.includes(suffix) && !keyword.includes(suffix)) return true;
  }
  return false;
}

function normalizeCategory(category) {
  if (!category) return null;
  if (Object.values(CATEGORY_MAP).includes(category)) return category;
  return CATEGORY_MAP[category] || null;
}

/**
 * 判定单行食品库记录与关键词的匹配等级
 * exact_name   ：food_name 完全相等（最高可信）
 * exact_alias  ：aliases JSON 数组中存在与关键词完全相等的别名
 * prefix_name  ：food_name 以关键词开头（如"奶茶"→"奶茶（三分糖）"）
 * contains_name：food_name 包含关键词（已通过误导后缀过滤）
 * char_fallback：第二阶段逐字符 AND 模糊匹配（词序/字形硬凑，最低可信）
 * @param {string} keyword 用户食物关键词
 * @param {object} row food_db 行（含 food_name / aliases）
 * @returns {string} 匹配等级
 */
function getMatchLevel(keyword, row) {
  if (!keyword || !row) return 'char_fallback';
  const name = row.food_name || '';
  if (name === keyword) return 'exact_name';
  try {
    const aliasArr = JSON.parse(row.aliases || '[]');
    if (Array.isArray(aliasArr) && aliasArr.some(a => String(a) === keyword)) return 'exact_alias';
  } catch (e) { /* aliases 非 JSON 时忽略 */ }
  if (name.startsWith(keyword)) return 'prefix_name';
  if (name.includes(keyword)) return 'contains_name';
  return 'char_fallback';
}

/**
 * 匹配等级 → 置信度
 * high：名称/别名精确命中，可直接作为权威数据源
 * medium：前缀/包含命中（已过滤误导后缀），可用但允许网络数据竞争
 * low：逐字符硬凑匹配，视为"强行匹配"，调用方应舍弃改走网络核实
 */
function confidenceOfLevel(level) {
  if (level === 'exact_name' || level === 'exact_alias') return 'high';
  if (level === 'prefix_name' || level === 'contains_name') return 'medium';
  return 'low';
}

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1, none: 0 };

function findBestFoodMatch(keyword, categoryFilter = null) {
  if (!keyword) return null;
  try {
    // 第一阶段: 标准精确+模糊匹配
    let sql = `
      SELECT calories_per_100g as calorie_per_100g,
             protein_per_100g, carb_per_100g, fat_per_100g,
             category, sub_category, food_name, common_unit, aliases
      FROM food_db
      WHERE (food_name = ?
         OR aliases LIKE ? ESCAPE '\\'
         OR food_name LIKE ? ESCAPE '\\'
         OR food_name LIKE ? ESCAPE '\\')
    `;
    // 别名按 JSON 数组元素精确匹配（%"关键词"%），避免子串误命中
    const params = [keyword, `%"${escapeLike(keyword)}"%`, `${escapeLike(keyword)}%`, `%${escapeLike(keyword)}%`];

    if (categoryFilter) {
      sql += ' AND category = ?';
      params.push(categoryFilter);
    }

    sql += `
      ORDER BY
        CASE
          WHEN food_name = ? THEN 0
          WHEN aliases LIKE ? ESCAPE '\\' THEN 1
          WHEN food_name LIKE ? ESCAPE '\\' THEN 2
          WHEN food_name LIKE ? ESCAPE '\\' THEN 3
          ELSE 4
        END,
        CASE WHEN protein_per_100g > 0 OR carb_per_100g > 0 OR fat_per_100g > 0 THEN 0 ELSE 1 END,
        LENGTH(food_name) ASC
      LIMIT 5
    `;
    params.push(keyword, `%"${escapeLike(keyword)}"%`, `${escapeLike(keyword)}%`, `%${escapeLike(keyword)}%`);

    let rows = db.prepare(sql).all(...params);

    let firstStageHit = false;
    for (const row of rows) {
      row.match_level = getMatchLevel(keyword, row);
      // 名称/别名精确相等是数据层显式声明的等价名（含网络学习入库的别名），
      // 不存在"子串误撞不同品类"问题，豁免误导后缀过滤；
      // 误导过滤仅作用于前缀/包含等模糊匹配（如"奶茶"误中"奶茶糖"）
      if (row.match_level !== 'exact_name' && row.match_level !== 'exact_alias'
          && isMisleadingMatch(keyword, row.food_name)) continue;
      firstStageHit = true;
      return row;
    }
    // 第一阶段命中行全部被误导后缀过滤：视为无有效命中，落入第二阶段低置信匹配
    if (!firstStageHit) rows = [];

    // 第二阶段: 逐字符 AND 匹配（覆盖词序颠倒场景："特仑苏牛奶" → "牛奶特仑苏"）
    // 注意：此阶段为字符硬凑，匹配等级一律标记为 char_fallback（低置信），
    // 调用方可按置信度舍弃，避免"强行匹配"到不相关食物
    if (keyword.length >= 3 && rows.length === 0) {
      const chars = [...keyword].filter(c => c.trim());
      if (chars.length >= 3) {
        const charConditions = chars.map(() => '(food_name LIKE ? ESCAPE \'\\\' OR aliases LIKE ? ESCAPE \'\\\')').join(' AND ');
        let fallbackSql = `
          SELECT calories_per_100g as calorie_per_100g,
                 protein_per_100g, carb_per_100g, fat_per_100g,
                 category, sub_category, food_name, common_unit, aliases
          FROM food_db
          WHERE (${charConditions})
        `;
        const charParams = [];
        for (const ch of chars) {
          charParams.push(`%${escapeLike(ch)}%`, `%"%${escapeLike(ch)}"%`);
        }
        if (categoryFilter) {
          fallbackSql += ' AND category = ?';
          charParams.push(categoryFilter);
        }
        // 按"与关键词的字符重合度"排序（重合越多越靠前）
        fallbackSql += `
          ORDER BY
            (LENGTH(food_name) - LENGTH(REPLACE(food_name, ?, ''))) +
            (LENGTH(COALESCE(aliases, '')) - LENGTH(REPLACE(COALESCE(aliases, ''), ?, ''))) DESC,
            LENGTH(food_name) ASC
          LIMIT 5
        `;
        charParams.push(keyword, keyword);
        const fallbackRows = db.prepare(fallbackSql).all(...charParams);
        for (const row of fallbackRows) {
          if (isMisleadingMatch(keyword, row.food_name)) continue;
          row.match_level = 'char_fallback';
          return row;
        }
      }
    }

    return null;
  } catch (e) {
    console.error('[nutritionService] 查询食物数据库失败:', e.message);
    return null;
  }
}

/**
 * 查询食物营养信息（含匹配置信度）
 * @param {string} foodName 食物名称
 * @param {string|null} preferredCategory 首选分类
 * @param {object} [options]
 * @param {'high'|'medium'|'low'} [options.minConfidence='low'] 最低可接受置信度；
 *        low=兼容旧行为（含逐字符硬匹配）；medium=舍弃 char_fallback 强行匹配；
 *        high=仅接受名称/别名精确命中（供"是否值得作为权威库数据"判断）
 * @returns {object|null} 营养信息对象，附带 match_level / match_confidence；无达标匹配返回 null
 */
function getFoodNutrition(foodName, preferredCategory = null, options = {}) {
  try {
    const name = (foodName || '').trim();
    if (!name) return null;

    const minRank = CONFIDENCE_RANK[options.minConfidence || 'low'] || 1;
    // 置信度达标才采纳；低置信（逐字符硬凑的"强行匹配"）返回 null，由上层改走网络核实
    const take = (food) => {
      if (!food) return null;
      const level = food.match_level || 'char_fallback';
      if (CONFIDENCE_RANK[confidenceOfLevel(level)] < minRank) return null;
      return { ...food, match_level: level, match_confidence: confidenceOfLevel(level) };
    };

    const dbCategory = normalizeCategory(preferredCategory);

    // 1. 如果食物名是宽泛词，直接用人工兜底营养值（视为高置信），避免匹配到不相关的加工食品
    const genericFallback = GENERIC_FOOD_FALLBACKS[name];
    if (genericFallback) {
      // 若用户传了分类，优先使用用户传入的分类；否则用兜底分类
      if (dbCategory && dbCategory !== genericFallback.category) {
        return { ...genericFallback, category: dbCategory, sub_category: '', match_level: 'generic_fallback', match_confidence: 'high' };
      }
      return { ...genericFallback, match_level: 'generic_fallback', match_confidence: 'high' };
    }

    // 2. 优先在首选分类中匹配
    if (dbCategory) {
      // 直接匹配
      let hit = take(findBestFoodMatch(name, dbCategory));
      if (hit) return hit;

      // 精确别名匹配
      const directAlias = ALIAS_MAP[name];
      if (directAlias) {
        for (const pattern of directAlias) {
          hit = take(findBestFoodMatch(pattern, dbCategory));
          if (hit) return hit;
        }
      }

      // 关键词匹配
      const keywords = extractFoodKeywords(name);
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        hit = take(findBestFoodMatch(kw, dbCategory));
        if (hit) return hit;
      }
    }

    // 3. 精确别名优先匹配（如"鸡蛋"应优先对应"水煮鸡蛋"而非"鸡蛋清"）
    const directAlias = ALIAS_MAP[name];
    if (directAlias) {
      for (const pattern of directAlias) {
        const hit = take(findBestFoodMatch(pattern));
        if (hit) return hit;
      }
    }

    // 4. 全局匹配（原有逻辑）
    const globalHit = take(findBestFoodMatch(name));
    if (globalHit) return globalHit;

    // 5. 关键词匹配（优先走别名映射，避免"土豆"命中"土豆炖牛肉"等菜品）
    const keywords = extractFoodKeywords(name);
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      // 关键词本身有明确别名时，先按别名目标匹配（如"土豆"→"蒸土豆"）
      const kwAlias = ALIAS_MAP[kw];
      if (kwAlias) {
        for (const pattern of kwAlias) {
          const hit = take(findBestFoodMatch(pattern));
          if (hit) return hit;
        }
      }
      const hit = take(findBestFoodMatch(kw));
      if (hit) return hit;
    }

    // 6. 不再做泛化别名匹配：避免"卤鸡蛋"被改成"水煮鸡蛋"、"炸鸡腿"被改成其他鸡腿食品。
    // 用户输入的完整食物名若库中无达标匹配，应返回 null，由上层走网络核实/LLM 估算，而不是强行改名硬配。

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
    // weight 缺失时：quantity>1 视为克数（LLM 偶尔把克数放进 quantity），否则默认 100g
    // （quantity 已在上方兜底为 ≥1，原 `quantity || 100` 的 100 分支是不可达死代码）
    return { weight: quantity > 1 ? quantity : 100, quantity: quantity || 1, unit };
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
    // 仅采纳中置信以上的库匹配：逐字符硬凑的低置信结果不用于补营养素
    const dbFood = getFoodNutrition(food.name, food.category, { minConfidence: 'medium' });
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
  // 仅采纳中置信以上匹配：低置信（逐字符硬凑的"强行匹配"）视为无库命中，
  // 保留 LLM 对该食物的估算热量，避免被不相关库条目的数值错误覆盖
  const dbFood = getFoodNutrition(food.name, food.category, { minConfidence: 'medium' });

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
