/**
 * 聊天记录标签匹配器（非 Agent）
 * 根据食物库、运动库、身体指标、习惯等关键词/列表，
 * 直接给聊天消息打上「已记录 / 待确认」标签类型。
 */

const { db } = require('../db');
const { isQuestionContent, hasNegativeRecordIntent } = require('../utils/intent');

const DIET_MARKERS = ['吃', '喝', '早餐', '午餐', '晚餐', '饭', '菜', '肉', '蛋', '奶', '水果', '零食', '卡路里', '千卡', '热量', '碳水', '蛋白质', '脂肪', '糖', '油', '咖啡', '饮料', '果汁', '奶茶', '豆浆', '牛奶', '酸奶', '豆奶', '奶昔', '茶', '啤酒', '红酒', '白酒', '葡萄酒', '鸡尾酒', '椰汁', '核桃露', '杏仁露', '燕麦奶', '养乐多', '优酸乳', '气泡水', '苏打水', '碳酸饮料', '可乐', '雪碧', '汽水'];
const EXERCISE_ACTIONS = [
  '运动', '健身', '跑步', '跑了', '慢跑', '快跑', '超慢跑', '变速跑', '间歇跑', '长跑', '短跑', '冲刺跑', '夜跑', '晨跑',
  '走路', '走了', '快走', '慢走', '散步', '健走', '徒步', '逛街', '爬楼梯', '爬山', '登山',
  '游泳', '游了', '蛙泳', '自由泳', '仰泳', '蝶泳', '潜水', '浮潜',
  '骑车', '骑了', '骑行', '自行车', '动感单车', '椭圆机', '划船机',
  '篮球', '足球', '排球', '羽毛球', '乒乓球', '网球', '台球', '保龄球', '高尔夫',
  '瑜伽', '普拉提', '拉伸', '太极', '气功', '冥想',
  '深蹲', '俯卧撑', '平板支撑', '仰卧起坐', '卷腹', '引体向上', '举重', '哑铃', '杠铃', '器械训练',
  '跳绳', '跳了', '跳舞', '广场舞', '健身操', '搏击操', '有氧操', '尊巴',
  'HIIT', 'Tabata', '拳击', '打拳', '跆拳道', '空手道', '柔道', '轮滑', '滑板', '攀岩', '滑雪', '滑冰',
  '有氧', '无氧', '力量', '训练', '练了'
];
const BODY_KEYWORDS = ['体重', '体脂', 'BMI', '腰围', '腿围', '臀围', '胸围', '肌肉'];
const BODY_UNITS = ['斤', '公斤', 'kg', '厘米', 'cm'];
const HABIT_KEYWORDS = ['喝水'];
const NUMBER_PATTERN = /\d+(?:\.\d+)?/;

function escapeLike(str) {
  return str.replace(/[\\%_]/g, '\\$&');
}

// 常见句首前缀：时间、主语、连接词等（用于初步剥离非食物部分）
const SENTENCE_PREFIXES = [
  '我今天早上', '我今天中午', '我今天下午', '我今天晚上', '我今天', '我早上', '我中午',
  '我下午', '我晚上', '我昨晚', '我刚', '我刚才', '我刚刚', '我吃了', '我喝了', '我吃',
  '我喝', '刚', '早上', '中午', '下午', '晚上', '昨晚', '刚才', '刚刚', '今天', '昨天', '明天'
];

function extractKeywords(text) {
  const cleaned = text
    .replace(/[,，、。！？!?；;：:…~～\s]+/g, ' ')
    .trim();

  const rawParts = cleaned.split(/\s+/).filter(p => p && p.length >= 2);
  const result = [];
  for (const part of rawParts) {
    let sub = part;

    // 去掉句首常见前缀，避免"我今天早上一个..."整体进入匹配
    for (const prefix of SENTENCE_PREFIXES) {
      if (sub.startsWith(prefix)) {
        sub = sub.slice(prefix.length);
        break;
      }
    }

    sub = sub
      // 去掉句首吃/喝动词（如"吃了一袋方便面"→"方便面"）
      .replace(/^(吃了|喝过|喝了|吃|喝)/, '')
      // 去掉常见量词/修饰词（不再锚定开头，可在片段任意位置出现）
      .replace(/(?:一份|一个|一只|一片|一块|一杯|一碗|一勺|一根|一条|一袋|一盒|一瓶|一盘|一碟|一点|一些|少量|适量|多|少|大|小|中|新|旧|生|熟|干|湿|个|两)/g, '')
      // 去掉结构助词"的"
      .replace(/的/g, '')
      // 去掉常见烹饪方式前缀/后缀
      .replace(/(?:炒|煮|蒸|炸|烤|煎|炖|焖|烧|拌|腌|卤|熏|爆|熘|烩|涮|焗|煨|熬|煲|凉拌|红烧|清蒸|油炸|干煸|水煮|蒜蓉|麻辣|香辣|酸甜|糖醋|椒盐|孜然|咖喱|番茄|芝士|奶油|黄油|酱油|醋|盐|糖|油|料酒|姜|葱|蒜|辣椒|花椒|八角|桂皮|香叶|胡椒)/g, '');
    if (sub && sub.length >= 2 && !/^\d+$/.test(sub)) {
      result.push(sub);
    }
  }
  return result.sort((a, b) => b.length - a.length);
}

// 纯字母/数字且长度过短的词不参与模糊匹配（避免 "hi" 命中 "HIIT" 这类误判）
function isWeakKeyword(kw) {
  return /^[a-zA-Z0-9]+$/.test(kw) && kw.length < 4;
}

function matchFoodInDb(text) {
  const keywords = extractKeywords(text);
  for (const kw of keywords) {
    if (isWeakKeyword(kw)) continue;
    const row = db.prepare(`
      SELECT food_name, category FROM food_db
      WHERE food_name = ? OR food_name LIKE ? ESCAPE '\\' OR food_name LIKE ? ESCAPE '\\'
      ORDER BY
        CASE WHEN food_name = ? THEN 0 WHEN food_name LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END,
        LENGTH(food_name) ASC
      LIMIT 1
    `).get(kw, `${escapeLike(kw)}%`, `%${escapeLike(kw)}%`, kw, `${escapeLike(kw)}%`);
    if (row) return row;
  }
  return null;
}

function matchExerciseInDb(text) {
  // 优先用常见动作关键词查询运动库
  for (const action of EXERCISE_ACTIONS) {
    if (text.includes(action)) {
      const row = db.prepare(`
        SELECT exercise_name FROM exercise_db
        WHERE exercise_name LIKE ? ESCAPE '\\'
        ORDER BY LENGTH(exercise_name) ASC
        LIMIT 1
      `).get(`%${escapeLike(action)}%`);
      if (row) return row;
    }
  }
  // 再用内容关键词兜底
  const keywords = extractKeywords(text);
  for (const kw of keywords) {
    if (isWeakKeyword(kw)) continue;
    const row = db.prepare(`
      SELECT exercise_name FROM exercise_db
      WHERE exercise_name LIKE ? ESCAPE '\\'
      ORDER BY LENGTH(exercise_name) ASC
      LIMIT 1
    `).get(`%${escapeLike(kw)}%`);
    if (row) return row;
  }
  return null;
}

function hasDietMarker(text) {
  return DIET_MARKERS.some(k => text.includes(k));
}

function hasExerciseAction(text) {
  return EXERCISE_ACTIONS.some(k => text.includes(k));
}

function hasBodyData(text) {
  const hasKeyword = BODY_KEYWORDS.some(k => text.includes(k));
  const hasNumber = NUMBER_PATTERN.test(text);
  const hasUnit = BODY_UNITS.some(u => text.toLowerCase().includes(u));
  // 提到身体指标关键词，且带有具体数值/单位，才认为是可记录的身体数据
  // 仅讨论趋势/情况（如"体重徘徊不动"）不标记
  return (hasKeyword && (hasNumber || hasUnit)) || (hasNumber && hasUnit);
}

function hasHabit(text) {
  return HABIT_KEYWORDS.some(k => text.includes(k));
}

function isPlanOrRoutineDescription(text) {
  const routineMarkers = ['计划', '安排', '主要是', '一般是', '通常是', '打算', '平时', '一周', '一个月'];
  return routineMarkers.some(m => text.includes(m));
}

/**
 * 返回 { type, status, sub_type? } 或 null
 * status: 1=已记录，2=待确认；目前统一先给 2（待确认），由沉淀 Agent 确认后再更新为 1
 */
function matchMessageTags(content) {
  const text = (content || '').trim();
  if (text.length < 5) return null;
  const textLower = text.toLowerCase();

  // 否定/犹豫/未发生意图（如"不想吃了/没吃/不吃了"）不做同步标签沉淀
  if (hasNegativeRecordIntent(text)) {
    return null;
  }

  // 问句、训练/饮食计划、安排类描述不做同步标签沉淀，交给 Agent 语义判断
  if (isQuestionContent(text) || isPlanOrRoutineDescription(text)) {
    return null;
  }

  // 1. 身体数据（ strongest signal ）
  if (hasBodyData(text)) {
    return { type: 'body_data', status: 2 };
  }

  // 2. 习惯（仅喝水做前端记录提示；睡眠/排便/心情暂用于日记生成，不沉淀）
  if (hasHabit(text)) {
    return { type: 'habit', sub_type: 'water', status: 2 };
  }

  // 3. 运动：有明显动作关键词或运动库匹配
  if (hasExerciseAction(text) || matchExerciseInDb(text)) {
    return { type: 'exercise_record', status: 2 };
  }

  // 4. 饮食：必须匹配到食物库中的具体食物，避免“我吃不下了”这类只含“吃”的句子误标
  if (matchFoodInDb(text)) {
    return { type: 'diet_record', status: 2 };
  }

  return null;
}

module.exports = {
  matchMessageTags,
  extractKeywords,
  matchFoodInDb,
  matchExerciseInDb
};
