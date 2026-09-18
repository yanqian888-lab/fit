/**
 * 饮食更正服务
 * 处理「我后来没吃烤杏鲍菇，吃了大概100克的哈密瓜」这类更正消息：
 * 1. 对「没吃/没喝 X」部分做受保护的自动删除（仅当日记录、唯一匹配才删，绝不误删）
 * 2. 对「吃了/喝了 Y」部分提取出肯定小句，交给沉淀 Agent 正常记录
 * 删除是敏感操作：0 个或多个匹配都不删，由搭子引导用户手动处理
 */
const { db } = require('../db');
const { safeJsonParse } = require('../utils/safeJson');

// 烹饪/做法前缀：删除匹配时双方归一化都要剥，剥后不足2字则回退防误伤（"炒饭"→不剥）
const COOK_PREFIX_RE = /^(?:空气炸锅|烤箱|微波炉|电饼铛|砂锅|烤盘|烤|炸|煎|炖|焖|蒸|煮|炒|卤|酱|爆|熘|焗|凉拌|白灼|干锅|铁板|香酥|椒盐|孜然|麻辣|蒜香|蜜汁|黑椒|红烧|清蒸|清炖|清炒|水煮|照烧|奥尔良)+/;
// 数量尾巴：100克 / 大概100克的 / 一个 等
const TRAILING_QTY_RE = /(?:大概|大约|约|差不多)?\s*\d+(?:\.\d+)?\s*(?:毫升|ml|mL|克|g|千克|公斤|kg|斤|两|个|只|杯|瓶|罐|碗|份|片|根|块|勺|包|袋|盒|颗|粒|瓣|串|条|支)\s*(?:的|了)?$/i;
const CN_TRAILING_QTY_RE = /[一二三四五六七八九十百两半几多]+(?:个|只|杯|瓶|罐|碗|份|片|根|块|勺|包|袋|盒|颗|粒|瓣|串|条|支|克|斤|两)$/;

/**
 * 归一化食物名用于删除匹配：去标点、去数量、去烹饪前缀、去指代词
 */
function normalizeFoodName(name) {
  let n = String(name || '').trim();
  n = n.replace(/[，。！？；：、,.;:!?"'""''（）()\[\]【】\s]/g, '');
  n = n.replace(/^(?:那个|那个的|那个一份|那份|这份|这|那)/, '');
  n = n.replace(TRAILING_QTY_RE, '').trim();
  n = n.replace(CN_TRAILING_QTY_RE, '').trim();
  n = n.replace(/(的|了)$/, '').trim();
  // 循环剥烹饪前缀，剩余不足2字则停止（保护"炒饭""烤鸭"等）
  while (n.length > 2 && COOK_PREFIX_RE.test(n)) {
    const next = n.replace(COOK_PREFIX_RE, '');
    if (next === n || next.length < 2) break;
    n = next;
  }
  return n;
}

/**
 * 从消息中解析「否定」食物（没吃X / 没喝X / 没再吃X / 不吃X 等）
 * 按标点截取否定动词后的片段，再按连接词拆分
 * @returns {string[]} 原始食物名片段（未归一化）
 */
function extractNegativeFoods(content) {
  const text = String(content || '');
  const results = [];
  const negRe = /(?:没(?:有)?|不|没再|不再|别再)(?:吃|喝)(?:了|过|再)?\s*([^，。；！？,;!?]{1,25})/g;
  let m;
  while ((m = negRe.exec(text)) !== null) {
    const clause = m[1].trim();
    // 否定片段再按连接词拆分："没吃米饭和红烧肉" → 米饭 / 红烧肉
    for (const part of clause.split(/(?:和|跟|与|还有|以及|、)/)) {
      const p = part.trim();
      if (p && p.length >= 2 && p.length <= 15) results.push(p);
    }
  }
  return results;
}

/**
 * 提取消息中的「肯定」小句（吃了/喝了…），供沉淀 Agent 正常记录
 * 否定小句（含 不/没/别 的吃/喝动作句）整句剔除，避免把"没吃X"再沉淀一遍
 * @returns {string} 用逗号连接的肯定小句；无则返回空串
 */
function extractAffirmativeText(content) {
  const text = String(content || '');
  const clauses = text.split(/[，,。；;！!？?]/).map(s => s.trim()).filter(Boolean);
  const kept = [];
  for (const clause of clauses) {
    const verbMatch = clause.match(/[吃喝][了过]/);
    if (!verbMatch) continue;
    // 动词之前紧邻否定词 → 否定小句，剔除（"我后来没吃烤杏鲍菇"）
    const beforeVerb = clause.slice(Math.max(0, verbMatch.index - 3), verbMatch.index);
    if (/[不没别未勿莫]$/.test(beforeVerb)) continue;
    if (/[不没别未勿莫][^，,。；;！!？?\s]{0,3}$/.test(beforeVerb)) continue;
    kept.push(clause);
  }
  return kept.join('，');
}

/**
 * 检测并执行饮食更正。
 * 触发条件：消息含「没吃/没喝 X」且 X 能模糊匹配到用户当日至少一条饮食记录。
 * 不匹配任何记录的消息（如"我今晚不吃了"）返回 null，走正常流程。
 *
 * @returns {null|{removed: Array, notFound: Array, ambiguous: Array, affirmativeText: string}}
 *   removed: 成功删除的食物 [{name, calorie, mealTime, recordId}]
 *   notFound: 未能匹配到记录、未删除的否定食物
 *   ambiguous: 匹配到多条、为避免误删未自动删除的否定食物
 *   affirmativeText: 消息中"吃了/喝了"的肯定小句（可能为空串）
 */
function detectAndApplyDietCorrection(userId, content, recordDate) {
  const negatives = extractNegativeFoods(content);
  if (!negatives.length) return null;

  let rows;
  try {
    rows = db.prepare(`
      SELECT id, meal_time, foods FROM diet_records
      WHERE user_id = ? AND record_date = ? AND status = 1
      ORDER BY updated_at DESC
    `).all(userId, recordDate);
  } catch (e) {
    console.error('[dietCorrection] 查询当日饮食记录失败:', e.message);
    return null;
  }

  const removed = [];
  const notFound = [];
  const ambiguous = [];

  for (const negRaw of negatives) {
    const norm = normalizeFoodName(negRaw);
    if (norm.length < 2) continue;

    // 在当日所有记录的所有食物里找匹配（双方归一化后双向 contains）
    const matches = [];
    for (const row of rows) {
      const foods = safeJsonParse(row.foods, []);
      if (!Array.isArray(foods)) continue;
      foods.forEach((f, idx) => {
        const fn = normalizeFoodName(f.name);
        if (fn.length < 2) return;
        if (fn.includes(norm) || norm.includes(fn)) {
          matches.push({ row, idx, food: f });
        }
      });
    }

    if (matches.length === 0) {
      notFound.push(negRaw);
      continue;
    }
    if (matches.length > 1) {
      // 删除是敏感操作：多条匹配宁可不删，交给用户手动处理
      ambiguous.push(negRaw);
      continue;
    }

    // 唯一匹配：从该记录的 foods 数组中移除该食物，重算合计；删空则软删整行
    const { row, idx, food } = matches[0];
    try {
      const foods = safeJsonParse(row.foods, []);
      foods.splice(idx, 1);
      if (foods.length === 0) {
        db.prepare('UPDATE diet_records SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
          .run(row.id, userId);
      } else {
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
      }
      removed.push({
        name: food.name,
        calorie: Math.round(parseFloat(food.calorie) || 0),
        mealTime: row.meal_time,
        recordId: row.id
      });
      // 同步内存快照，避免同一记录被后续否定项重复命中
      row.foods = JSON.stringify(foods);
    } catch (e) {
      console.error(`[dietCorrection] 删除「${negRaw}」失败:`, e.message);
      notFound.push(negRaw);
    }
  }

  // 没有任何否定项匹配到记录 → 这不是对已有记录的更正，走正常流程
  if (removed.length === 0 && ambiguous.length === 0) return null;

  return { removed, notFound, ambiguous, affirmativeText: extractAffirmativeText(content) };
}

module.exports = {
  detectAndApplyDietCorrection,
  normalizeFoodName,
  extractNegativeFoods,
  extractAffirmativeText
};
