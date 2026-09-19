/**
 * 网络检索服务（饮品/食品热量）
 * 1. 优先使用火山方舟 Responses API 内置 web_search 工具进行联网检索
 * 2. 如果账号未开通 web_search 或网络检索失败，则 fallback 到 LLM 基于公开营养知识估算
 * 返回的文本会明确区分普通/有糖/无糖版本，并标注为估算/参考值
 */
const https = require('https');
const { URL } = require('url');
const aiConfigService = require('./aiConfigService');
const { callWithPrompt } = require('./aiClient');
const nutritionService = require('./nutritionService');
const { db } = require('../db');

const WEB_SEARCH_TIMEOUT_MS = 30000;
const ESTIMATE_TIMEOUT_MS = 20000;

function getHelperConfig() {
  // 优先取 helper_agent prompt 绑定的配置，否则取默认主配置
  const cfg = aiConfigService.getPromptConfig('helper_agent') || aiConfigService.getDefaultPrimaryConfig();
  if (!cfg) return null;
  return {
    apiKey: cfg.api_key,
    baseUrl: (cfg.base_url || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, ''),
    endpoint: cfg.endpoint_id || 'doubao-seed-2-1-pro-260628'
  };
}

function postJson(urlStr, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
        },
        timeout: timeoutMs
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ statusCode: res.statusCode, body: json });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

function extractResponsesText(data) {
  if (!data || !Array.isArray(data.output)) return '';
  for (const item of data.output) {
    if (item.type === 'message' && item.role === 'assistant' && Array.isArray(item.content)) {
      const texts = item.content
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text);
      if (texts.length > 0) return texts.join('\n').trim();
    }
  }
  return '';
}

/**
 * 从 LLM 输出文本中提取全部可解析的顶层 JSON 对象
 * 平衡截取：逐字符扫描，跟踪字符串字面量与转义，按大括号深度配对截取候选片段，
 * 每个片段独立 JSON.parse，容错 JSON 前后的污染文本（尾随说明、markdown 包裹、多对象输出）
 * @param {string} text LLM 原始输出文本
 * @returns {object[]} 解析成功的对象数组（按出现顺序，嵌套对象会产生外层+内层两条）
 */
function extractJsonObjects(text) {
  if (!text || typeof text !== 'string') return [];
  const results = [];
  for (let i = text.indexOf('{'); i !== -1; i = text.indexOf('{', i + 1)) {
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) continue;
    try {
      const obj = JSON.parse(text.slice(i, end + 1));
      if (obj && typeof obj === 'object') results.push(obj);
    } catch (_) { /* 该起点截取片段非法，跳过继续找下一个 { */ }
  }
  return results;
}

function isWebSearchDisabledError(body) {
  if (typeof body !== 'object' || !body.error) return false;
  const code = body.error.code || '';
  const msg = body.error.message || '';
  return code === 'ToolNotOpen' || /not activated|未激活|未开通|web search/i.test(msg);
}

async function tryWebSearch(query, cfg) {
  const url = `${cfg.baseUrl}/responses`;
  const body = {
    model: cfg.endpoint,
    input: [
      { role: 'user', content: query }
    ],
    instructions: `你是一位专业的注册营养师，擅长查询各类市售食品、菜肴、包装食品和饮品的营养成分。
当用户询问某种食物或饮品时，请使用联网搜索获取其热量信息，并区分：
- 普通版/有糖版
- 无糖版/低糖版/纯版（如适用）
请给出每100g、每100ml或每份的估算千卡数，标注数据来源，回答简洁、分点列出。`,
    tools: [
      { type: 'web_search', max_keyword: 1 }
    ],
    max_output_tokens: 800,
    temperature: 0.3
  };

  const res = await postJson(
    url,
    { Authorization: `Bearer ${cfg.apiKey}` },
    body,
    WEB_SEARCH_TIMEOUT_MS
  );

  if (res.statusCode >= 400) {
    if (typeof res.body === 'object' && res.body.error) {
      if (isWebSearchDisabledError(res.body)) {
        throw new Error('WEB_SEARCH_NOT_OPEN');
      }
      throw new Error(`web_search API error: ${res.body.error.message || JSON.stringify(res.body.error)}`);
    }
    throw new Error(`web_search HTTP ${res.statusCode}`);
  }

  const text = extractResponsesText(res.body);
  if (!text) {
    throw new Error('WEB_SEARCH_EMPTY');
  }
  return text;
}

/**
 * 从 reasoning_content（Hy3 思考过程）中宽松提取营养结论文本
 * 思考过程里通常以"每100ml约XX千卡/一份约XX千卡"收尾，提取含热量单位的结论行
 * @param {string} reasoning 模型思考过程文本
 * @returns {string} 提取到的结论文本；无则空串
 */
function extractNutritionFromReasoning(reasoning) {
  if (!reasoning || typeof reasoning !== 'string') return '';
  const lines = reasoning
    .split(/\n+/)
    .map(s => s.trim())
    .filter(s => /(千卡|kcal|大卡|卡路里)/.test(s) && !/^(我|首先|其次|然后|接下来|让我|需要|应该|如果|假设|计算|查)/.test(s));
  if (lines.length === 0) return '';
  // 取最后 3 行结论（通常包含有糖/无糖两个版本的最终数值）
  return lines.slice(-3).join('\n');
}

async function estimateWithLlm(query) {
  const response = await callWithPrompt(
    'helper_agent',
    [
      {
        role: 'system',
        content: `你是一位注册营养师，熟悉市售饮品、常见食品和中西菜肴的营养成分。
请根据公开营养资料，对用户询问的饮品/食品/菜肴给出热量估算，区分普通版/有糖版和无糖版/纯版（如适用）。
给出每100g、每100ml或每份的估算千卡数及简要依据。如果信息有限，给出合理范围并明确说明"此为估算值"。
不要回答"不知道""无法提供"或"不在记录中"。`
      },
      { role: 'user', content: query }
    ],
    // 营养估算无需深度推理，low 输出更稳定；Hy3 low 空 content 时 aiClient 会自动 high 重试
    // max_tokens 给足，避免 high 重试时思考过程挤占结论文本
    { temperature: 0.3, max_tokens: 1200, timeout: ESTIMATE_TIMEOUT_MS, reasoning_effort: 'low' }
  );

  const message = response?.choices?.[0]?.message || {};
  const content = (message.content || '').trim();
  if (content) return content;
  // think_high 重试后仍只有 reasoning_content：从思考过程宽松提取营养结论
  const fromReasoning = extractNutritionFromReasoning(message.reasoning_content);
  if (fromReasoning) {
    console.log('[webSearchService] 营养估算结果从 reasoning_content 兜底提取');
    return fromReasoning;
  }
  return '';
}

/**
 * 检索/估算指定饮品/食品的热量
 * @param {string} query 用户原始问题或构造的查询
 * @returns {Promise<string|null>} 检索/估算结果文本，失败返回 null
 */
async function searchNutrition(query) {
  if (!query) return null;
  const cfg = getHelperConfig();
  if (!cfg || !cfg.apiKey) {
    console.warn('[webSearchService] 未找到可用的 AI 配置，跳过网络检索');
    return null;
  }

  try {
    const result = await tryWebSearch(query, cfg);
    console.log('[webSearchService] 联网检索成功');
    return result;
  } catch (err) {
    const msg = err.message || '';
    if (msg === 'WEB_SEARCH_NOT_OPEN') {
      console.warn('[webSearchService] 账号未开通 web_search，使用 LLM 知识兜底估算');
    } else if (msg === 'WEB_SEARCH_EMPTY') {
      console.warn('[webSearchService] 联网检索结果为空，使用 LLM 知识兜底估算');
    } else {
      console.warn('[webSearchService] 联网检索失败，使用 LLM 知识兜底估算:', msg);
    }

    try {
      const estimate = await estimateWithLlm(query);
      if (estimate) {
        return `【网络检索未返回有效结果，以下为基于公开营养资料的估算】\n${estimate}`;
      }
    } catch (estErr) {
      console.error('[webSearchService] LLM 估算也失败:', estErr.message);
    }
    return null;
  }
}

/**
 * 把网络检索文本结构化为标准营养条目（LLM 提取 + 营养素补全）
 * @param {string} foodName 用户询问的食物名
 * @param {string} webText searchNutrition 返回的网络检索/估算文本
 * @returns {Promise<object|null>} 结构化营养对象；解析失败返回 null
 */
async function structureFoodNutrition(foodName, webText) {
  const prompt = `你是营养数据结构化专家。请根据下方网络检索资料，提取「${foodName}」的标准化营养数据。
直接输出 JSON 对象，禁止输出思考过程、解释、markdown 或代码块标记：
{
  "standard_name": "标准食物名（品牌+品名+规格，如 一点点四季奶青（中杯，三分糖）；无品牌就用品名）",
  "category": "必须是以下之一：零食饮料类、主食类、蔬菜水果类、肉蛋奶类、豆类坚果类、中西菜肴类、调味油脂类、代餐特殊食品",
  "sub_category": "细分类别，如 连锁饮品、奶茶小料、快餐",
  "is_drink": true或false,
  "calorie_per_100g": 每100g（饮品按每100ml≈100g）千卡数值,
  "protein_per_100g": 每100g蛋白质克数,
  "carb_per_100g": 每100g碳水克数,
  "fat_per_100g": 每100g脂肪克数,
  "common_serving": "常见份量描述，如 中杯500ml、一份30g",
  "serving_grams": 常见份量克数或毫升数（数字）,
  "serving_calorie": 常见份量的千卡数（数字）,
  "variant_note": "糖度/规格差异说明，如 三分糖约260千卡/杯，全糖约320千卡/杯",
  "confidence": "high、medium 或 low"
}
要求：
1. 数值优先采用检索资料；检索未给出的营养素（蛋白质/碳水/脂肪）按该品类公开营养常识合理补全，饮品蛋白质通常0.5-2g/100ml。
2. 每100g热量与每份热量必须自洽：serving_calorie ≈ calorie_per_100g × serving_grams ÷ 100。
3. 资料自相矛盾、明显无法确定或与常识严重冲突时，confidence 填 "low"。
4. 数字字段必须是数字类型，不要带单位或文字。

网络检索资料：
${webText}`;

  try {
    const response = await callWithPrompt(
      // 结构化提取复用沉淀配置链（low 推理、专为 JSON 提取设计），避免 think_high 思考过长挤占输出
      'precipitation_agent',
      [
        { role: 'system', content: '你是营养数据结构化引擎，直接输出 JSON 对象，禁止输出任何解释或思考过程。' },
        { role: 'user', content: prompt }
      ],
      // max_tokens 给足：Hy3 low 偶发空 content 会自动 high 重试，思考+JSON 都需要空间
      { temperature: 0.2, max_tokens: 2000, timeout: ESTIMATE_TIMEOUT_MS }
    );
    const message = response?.choices?.[0]?.message || {};
    // 平衡截取解析：容错 JSON 前后的污染文本（尾随说明、markdown 包裹、多对象输出）
    let objs = extractJsonObjects(message.content || '');
    if (objs.length === 0 && message.reasoning_content) {
      // Hy3 偶发 content 为空、内容落在 reasoning_content：取最后一个 JSON 对象（结论通常在思考末尾）
      objs = extractJsonObjects(message.reasoning_content);
      if (objs.length) console.log('[webSearchService] 结构化结果从 reasoning_content 兜底提取');
    }
    // 取最后一个可解析对象：多对象输出时结论通常在末尾
    const data = objs.length ? objs[objs.length - 1] : null;
    if (!data || !(Number(data.calorie_per_100g) > 0)) return null;
    return data;
  } catch (e) {
    console.warn('[webSearchService] 网络营养数据结构化失败:', e.message);
    return null;
  }
}

/**
 * 校验结构化营养数据的合理性
 * 规则：品类热量范围 / 宏量素供能交叉校验 / 每份量与每100g自洽 / LLM 自评置信度
 * @param {object} data structureFoodNutrition 返回的结构化对象
 * @returns {{valid:boolean, reasons:string[]}} 校验结果与不通过原因
 */
function validateLearnedFood(data) {
  const reasons = [];
  if (!data) return { valid: false, reasons: ['结构化数据为空'] };

  const cal = Number(data.calorie_per_100g);
  if (!(cal > 0)) {
    reasons.push('每100g热量缺失或非正数');
    return { valid: false, reasons };
  }

  // 品类热量合理范围（饮品按 100ml≈100g）
  const isDrink = !!data.is_drink || /饮|茶|奶|咖啡|汁|水|可乐|汽水|酒|奶茶/.test(String(data.standard_name || ''));
  const [minCal, maxCal] = isDrink ? [5, 150] : [20, 750];
  if (cal < minCal || cal > maxCal) {
    reasons.push(`每100g热量${cal}超出${isDrink ? '饮品' : '食物'}合理范围[${minCal},${maxCal}]`);
  }

  // 宏量素供能交叉校验：蛋白/碳水 4kcal/g、脂肪 9kcal/g，偏差超 50% 视为数据矛盾
  const p = Number(data.protein_per_100g) || 0;
  const c = Number(data.carb_per_100g) || 0;
  const f = Number(data.fat_per_100g) || 0;
  if (p < 0 || c < 0 || f < 0) {
    reasons.push('宏量营养素存在负数');
  } else {
    const macroCal = p * 4 + c * 4 + f * 9;
    if (macroCal > 0) {
      const dev = Math.abs(macroCal - cal) / cal;
      if (dev > 0.5) reasons.push(`宏量素供能(${macroCal.toFixed(0)}kcal)与标注热量(${cal}kcal)偏差${(dev * 100).toFixed(0)}%`);
    }
  }

  // 份量自洽：每份热量 ≈ 每100g热量 × 份量/100，偏差超 35% 视为矛盾
  const servingGrams = Number(data.serving_grams);
  const servingCalorie = Number(data.serving_calorie);
  if (servingGrams > 0 && servingCalorie > 0) {
    const expect = cal * servingGrams / 100;
    const dev = Math.abs(servingCalorie - expect) / Math.max(servingCalorie, 1);
    if (dev > 0.35) reasons.push(`份量热量不自洽：每份${servingCalorie}kcal vs 折算${expect.toFixed(0)}kcal`);
  }

  if (data.confidence === 'low') reasons.push('LLM 自评低置信');

  return { valid: reasons.length === 0, reasons };
}

/**
 * 将校验通过的网络营养数据回流入库 food_db（source=web_learned），形成自学习闭环
 * 幂等：food_name 或别名已存在时不重复插入
 * @param {string} queryName 用户原始食物名（写入别名）
 * @param {object} data 校验通过的结构化营养对象
 * @returns {{duplicated:boolean, food_name:string, food_id?:number}} 入库结果
 */
function saveLearnedFood(queryName, data) {
  try {
    const cols = db.prepare('PRAGMA table_info(food_db)').all().map(c => c.name);
    const standardName = String(data.standard_name || queryName).slice(0, 128);

    // 别名补全：从标准名提取去括号主干与剥品类词短名，
    // 确保口语短名（如"大冰桶"）也能命中库（标准名常为"大冰桶雪糕（天冰纯奶基底500ml家庭装）"这类长名）
    const trunk = standardName.replace(/[（(].*?[)）]/g, '').trim();
    const shortName = trunk
      .replace(/(雪糕|冰淇淋|冰激凌|冰棍|棒冰|冰棒|甜筒|圣代|雪泥|饮料|汽水|奶茶|咖啡|酸奶|果汁|面包|饼干|薯片|辣条|糖果|巧克力|瓜子|坚果|蛋卷|威化|麻花|桃酥|雪花酥|牛轧糖|甜甜圈|麻薯|麻糬)$/g, '')
      .trim();
    // 防重：标准名/主干/短名/用户问名 已存在于 food_name 或 aliases 中则不重复入库
    const candidateNames = [...new Set([standardName, trunk, shortName, queryName].filter(n => n && n.length >= 2))];
    for (const n of candidateNames) {
      const escaped = n.replace(/[\\%_]/g, '\\$&');
      const dup = db.prepare(`SELECT id, food_name FROM food_db WHERE food_name = ? OR aliases LIKE ? ESCAPE '\\'`)
        .get(n, `%"${escaped}"%`);
      if (dup) return { duplicated: true, food_name: dup.food_name };
    }

    const maxId = db.prepare('SELECT MAX(food_id) AS m FROM food_db').get().m || 0;
    const foodId = Math.max(maxId + 1, 9200); // web 学习条目从 9200 段起，避免与基础库/迁移条目冲突

    const columns = ['food_id', 'category', 'sub_category', 'food_name', 'calories_per_100g',
      'common_unit', 'edible_rate', 'protein_per_100g', 'carb_per_100g', 'fat_per_100g'];
    const servingTip = data.common_serving && data.serving_calorie
      ? `${data.common_serving}约${data.serving_calorie}千卡` : '';
    const commonUnit = [servingTip, data.variant_note].filter(Boolean).join('；');
    const values = [
      foodId,
      data.category || '零食饮料类',
      data.sub_category || '',
      standardName,
      Math.round(Number(data.calorie_per_100g) * 10) / 10,
      commonUnit,
      1.0,
      Math.round(Number(data.protein_per_100g || 0) * 10) / 10,
      Math.round(Number(data.carb_per_100g || 0) * 10) / 10,
      Math.round(Number(data.fat_per_100g || 0) * 10) / 10
    ];
    if (cols.includes('aliases')) {
      columns.push('aliases');
      values.push(JSON.stringify(candidateNames));
    }
    if (cols.includes('source')) {
      columns.push('source');
      values.push('web_learned');
    }
    db.prepare(`INSERT INTO food_db (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...values);
    console.log(`[webSearchService] 网络学习条目已入库：${standardName}（food_id=${foodId}）`);
    return { duplicated: false, food_name: standardName, food_id: foodId };
  } catch (e) {
    console.error('[webSearchService] 网络学习条目入库失败:', e.message);
    return { duplicated: false, food_name: data.standard_name || queryName, error: e.message };
  }
}

/**
 * 食物营养"网络核实 + 学习入库"闭环编排
 * 流程：库中已有中高置信条目 → 直接用；否则联网检索 → LLM 结构化 → 合理性校验 → 校验通过回流入库
 * @param {string} foodName 用户询问的食物名（已做量词清洗）
 * @param {string} [userQuestion] 用户原始问题（辅助构造检索词）
 * @returns {Promise<object>} {
 *   source: 'food_db'|'web_learned'|'web_unvalidated'|'none',
 *   info: 库条目/入库条目（含 calorie_per_100g 等）,
 *   webText: 网络检索原文（供 LLM 参考）,
 *   validated: 是否通过校验, learned: 是否新入库, reasons: 未通过原因
 * }
 */
async function searchAndLearnFood(foodName, userQuestion = '') {
  if (!foodName) return { source: 'none', validated: false, learned: false };

  // 1. 库中已有中置信以上匹配（精确/别名/前缀/包含）→ 直接作为权威数据，不联网
  const existing = nutritionService.getFoodNutrition(foodName, null, { minConfidence: 'medium' });
  if (existing && existing.calorie_per_100g > 0) {
    return { source: 'food_db', info: existing, validated: true, learned: false, webText: null };
  }

  // 2. 联网检索（web_search 优先，失败 LLM 知识兜底）
  const searchQuery = `${userQuestion || foodName}（${foodName} 热量 每100g 每份 营养成分 蛋白质 碳水 脂肪）`;
  const webText = await searchNutrition(searchQuery);
  if (!webText) return { source: 'none', validated: false, learned: false, webText: null };

  // 3. LLM 结构化 + 营养素补全
  const structured = await structureFoodNutrition(foodName, webText);
  if (!structured) {
    return { source: 'web_unvalidated', validated: false, learned: false, webText, reasons: ['网络结果无法结构化'] };
  }

  // 4. 合理性校验（热量范围/宏量素交叉/份量自洽）
  const validation = validateLearnedFood(structured);
  if (!validation.valid) {
    console.warn(`[webSearchService] 网络营养数据校验未通过（${foodName}）：${validation.reasons.join('；')}`);
    return { source: 'web_unvalidated', validated: false, learned: false, webText, reasons: validation.reasons, structured };
  }

  // 5. 校验通过 → 回流食品库（幂等），后续消息直接高置信命中
  const saved = saveLearnedFood(foodName, structured);
  const info = {
    food_name: saved.food_name,
    calorie_per_100g: Number(structured.calorie_per_100g),
    protein_per_100g: Number(structured.protein_per_100g || 0),
    carb_per_100g: Number(structured.carb_per_100g || 0),
    fat_per_100g: Number(structured.fat_per_100g || 0),
    common_unit: [structured.common_serving ? `${structured.common_serving}约${structured.serving_calorie}千卡` : '', structured.variant_note].filter(Boolean).join('；'),
    category: structured.category,
    sub_category: structured.sub_category,
    match_level: 'web_learned',
    match_confidence: 'high'
  };
  return {
    source: saved.duplicated ? 'food_db' : 'web_learned',
    info,
    webText,
    validated: true,
    learned: !saved.duplicated && !saved.error,
    reasons: saved.error ? [saved.error] : []
  };
}

/**
 * 把网络检索文本结构化为运动单位换算数据（LLM 提取 + 校验辅助值补全）
 * @param {string} exerciseName 运动名（如 爬楼梯）
 * @param {string} unit 用户描述的计量单位（层/个/组/公里/次）
 * @param {string} webText searchNutrition 返回的网络检索/估算文本
 * @returns {Promise<object|null>} 结构化对象 {standard_name, unit_name, calorie_per_unit, minutes_per_unit, met_value, confidence}；解析失败返回 null
 */
async function structureExerciseData(exerciseName, unit, webText) {
  const prompt = `你是运动数据结构化专家。请根据下方网络检索资料，给出「${exerciseName}」按「每1${unit}」计的热量换算数据。
直接输出 JSON 对象，禁止输出思考过程、解释、markdown 或代码块标记：
{
  "standard_name": "标准运动名（如 爬楼梯/俯卧撑/骑自行车）",
  "unit_name": "计量单位，固定填：${unit}",
  "calorie_per_unit": 每1${unit}消耗的千卡数（以60kg成年人为基准）（数字）,
  "minutes_per_unit": 每1${unit}大约耗时可换算为多少分钟（如爬楼梯每层约1分钟，骑车每公里约3分钟；个数类极短可填小数）（数字）,
  "met_value": 该运动的通用MET强度值（如 爬楼梯6.0、俯卧撑3.8-8.0取中位）（数字）,
  "confidence": "high、medium 或 low"
}
要求：
1. 数值优先采用检索资料；检索未给出时按该运动公开运动科学常识合理补全（60kg基准：千卡 ≈ MET × 60 × 分钟 ÷ 60）。
2. calorie_per_unit 与 minutes_per_unit、met_value 必须自洽：calorie_per_unit ≈ met_value × 60kg × minutes_per_unit ÷ 60，偏差过大 confidence 填 "low"。
3. 数字字段必须是数字类型，不要带单位或文字。

网络检索资料：
${webText}`;

  try {
    const response = await callWithPrompt(
      // 复用沉淀配置链（low 推理、结构化 JSON 提取稳定，见食品结构化同款处理）
      'precipitation_agent',
      [
        { role: 'system', content: '你是运动数据结构化引擎，直接输出 JSON 对象，禁止输出任何解释或思考过程。' },
        { role: 'user', content: prompt }
      ],
      { temperature: 0.2, max_tokens: 1200, timeout: ESTIMATE_TIMEOUT_MS }
    );
    const message = response?.choices?.[0]?.message || {};
    // 平衡截取解析（同食品结构化）：容错 JSON 前后的污染文本
    let objs = extractJsonObjects(message.content || '');
    if (objs.length === 0 && message.reasoning_content) {
      // Hy3 偶发 content 为空、内容落在 reasoning_content：取最后一个 JSON 对象兜底
      objs = extractJsonObjects(message.reasoning_content);
      if (objs.length) console.log('[webSearchService] 运动结构化结果从 reasoning_content 兜底提取');
    }
    const data = objs.length ? objs[objs.length - 1] : null;
    if (!data || !(Number(data.calorie_per_unit) > 0)) return null;
    return data;
  } catch (e) {
    console.warn('[webSearchService] 运动数据结构化失败:', e.message);
    return null;
  }
}

/**
 * 校验结构化运动换算数据的合理性
 * 规则：MET 范围 / 每单位千卡与 MET×分钟 自洽 / 每单位耗时合理 / LLM 自评置信度
 *       / 与本地估算交叉验证（偏差超 3 倍视为不可信，防止 LLM 知识兜底给出离谱值）
 * @param {object} data 结构化运动数据
 * @param {number|null} [expectedPerUnit] 本地估算的每单位千卡（60kg 基准，可选）
 * @returns {{valid:boolean, reasons:string[]}} 校验结果
 */
function validateLearnedExercise(data, expectedPerUnit = null) {
  const reasons = [];
  const met = Number(data.met_value) || 0;
  const perUnit = Number(data.calorie_per_unit) || 0;
  const minPerUnit = Number(data.minutes_per_unit) || 0;

  if (met <= 0 || met > 25) {
    reasons.push(`MET值${met}超出合理范围[1,25]`);
  }
  if (!(perUnit > 0)) {
    reasons.push('每单位热量缺失或非正数');
  }
  // 自洽对账：calorie_per_unit ≈ met × 60kg × minutes_per_unit ÷ 60
  if (met > 0 && met <= 25 && minPerUnit > 0 && perUnit > 0) {
    const derived = (met * 60 * minPerUnit) / 60;
    if (Math.abs(perUnit - derived) / derived > 0.4) {
      reasons.push(`每单位千卡(${perUnit})与MET换算(${derived.toFixed(1)})偏差超40%`);
    }
  }
  if (!(minPerUnit > 0) || minPerUnit > 10) {
    reasons.push(`每单位耗时${minPerUnit}分钟不合理`);
  }
  // 交叉验证：与本地估算基准偏差超 3 倍（或低于 1/3）判定不可信
  if (expectedPerUnit > 0 && perUnit > 0) {
    const ratio = perUnit / expectedPerUnit;
    if (ratio > 3 || ratio < 1 / 3) {
      reasons.push(`每单位千卡(${perUnit})与本地估算(${expectedPerUnit})偏差超3倍`);
    }
  }
  if (String(data.confidence || '').toLowerCase() === 'low') {
    reasons.push('LLM 自评低置信');
  }
  return { valid: reasons.length === 0, reasons };
}

/**
 * 将校验通过的运动单位换算数据回流入库 exercise_db（unit_source='web_learned'），形成自学习闭环
 * 幂等：已有名称匹配条目则更新其单位字段，否则插入新条目
 * @param {string} exerciseName 用户描述的运动名
 * @param {object} data 校验通过的结构化运动数据
 * @returns {{updated:boolean, inserted:boolean, exercise_name:string}} 入库结果
 */
function saveLearnedExercise(exerciseName, data) {
  try {
    const unitName = String(data.unit_name || '').slice(0, 16);
    const perUnit = Math.round(Number(data.calorie_per_unit) * 100) / 100;
    const met = Math.round((Number(data.met_value) || 0) * 100) / 100;
    const minPerUnit = Number(data.minutes_per_unit) || 0;
    const standardName = String(data.standard_name || exerciseName).slice(0, 64);
    const remarkTip = `每1${unitName}约${perUnit}千卡（约合${minPerUnit}分钟，60kg基准）；${exerciseName}与${standardName}同源`;

    // 查找已有条目：精确同名优先，其次最短名（最接近通用条目，避免"爬楼梯"挂到
    // "爬楼梯（快速/爬楼机）"这类特化条目上），同级再取最长包含匹配
    const rows = db.prepare('SELECT id, exercise_name, intensity_desc FROM exercise_db').all();
    const inputs = [standardName, exerciseName].map(s => String(s || '').toLowerCase()).filter(Boolean);
    let candidates = [];
    for (const row of rows) {
      const dbName = String(row.exercise_name || '').toLowerCase();
      if (!dbName) continue;
      for (const input of inputs) {
        if (input.includes(dbName) || dbName.includes(input)) {
          candidates.push({ row, dbName });
          break;
        }
      }
    }
    // 排序：精确同名(0) > 名称最短(通用) > 名称最长（信息更具体）
    candidates.sort((a, b) => {
      if (a.dbName === b.dbName) return 0;
      const aExact = inputs.includes(a.dbName) ? 0 : 1;
      const bExact = inputs.includes(b.dbName) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      if (a.dbName.length !== b.dbName.length) return a.dbName.length - b.dbName.length;
      return b.dbName.length - a.dbName.length;
    });
    const existing = candidates.length > 0 ? candidates[0].row : null;
    if (existing && existing.id) {
      db.prepare(`UPDATE exercise_db
        SET unit_name = ?, calorie_per_unit = ?, unit_source = 'web_learned',
            met_value = CASE WHEN met_value IS NULL OR met_value <= 0 THEN ? ELSE met_value END,
            remark = ?
        WHERE id = ?`)
        .run(unitName, perUnit, met, remarkTip, existing.id);
      console.log(`[webSearchService] 运动库条目已更新单位数据：${existing.exercise_name}（每1${unitName}=${perUnit}千卡）`);
      return { updated: true, inserted: false, exercise_name: existing.exercise_name };
    }

    // 无匹配条目：插入新条目（calorie_per_hour 由 MET 推导，60kg 基准）
    const caloriePerHour = met > 0 ? Math.round(met * 60 * 1.05) : Math.round(perUnit / Math.max(minPerUnit, 0.1) * 60);
    db.prepare(`INSERT INTO exercise_db (exercise_name, category, sub_category, intensity_desc, met_value, calorie_per_hour, remark, unit_name, calorie_per_unit, unit_source)
      VALUES (?, '运动', '', 'moderate', ?, ?, ?, ?, ?, 'web_learned')`)
      .run(standardName, met || 0, caloriePerHour, remarkTip, unitName, perUnit);
    console.log(`[webSearchService] 运动库新增联网学习条目：${standardName}（每1${unitName}=${perUnit}千卡）`);
    return { updated: false, inserted: true, exercise_name: standardName };
  } catch (e) {
    console.error('[webSearchService] 运动学习条目入库失败:', e.message);
    return { updated: false, inserted: false, exercise_name: data.standard_name || exerciseName, error: e.message };
  }
}

/**
 * 运动单位换算"网络核实 + 学习入库"闭环编排
 * 场景：用户按"层/个/公里"等非时长单位描述运动，库条目只有 MET/每小时热量时调用
 * 流程：联网检索 → LLM 结构化 → 合理性校验（含与本地估算交叉验证）→ 校验通过回流入库
 * @param {string} exerciseName 运动名（如 爬楼梯）
 * @param {string} unit 计量单位（层/个/组/公里/次）
 * @param {number|null} [expectedPerUnit] 本地估算的每单位千卡（60kg 基准，用于交叉验证）
 * @returns {Promise<object>} { source: 'exercise_db'|'web_learned'|'web_unvalidated'|'none', perUnit?, minutesPerUnit?, met?, webText?, reasons? }
 */
async function searchAndLearnExercise(exerciseName, unit, expectedPerUnit = null) {
  if (!exerciseName || !unit) return { source: 'none' };

  // 1. 库中已有同单位数据 → 直接返回
  try {
    const rows = db.prepare(`SELECT exercise_name, unit_name, calorie_per_unit, met_value FROM exercise_db`).all();
    const input = String(exerciseName).toLowerCase();
    const hit = rows
      .filter(r => r.unit_name === unit && Number(r.calorie_per_unit) > 0)
      .map(r => ({ row: r, score: String(r.exercise_name || '').length }))
      .filter(({ row }) => {
        const dbName = String(row.exercise_name || '').toLowerCase();
        return dbName && (input.includes(dbName) || dbName.includes(input));
      })
      .sort((a, b) => b.score - a.score)[0];
    if (hit) {
      return {
        source: 'exercise_db',
        perUnit: Number(hit.row.calorie_per_unit),
        minutesPerUnit: null,
        met: Number(hit.row.met_value) || null
      };
    }
  } catch (e) {
    console.warn('[webSearchService] 运动库单位数据查询失败:', e.message);
  }

  // 2. 联网检索（web_search 优先，失败 LLM 知识兜底）
  const searchQuery = `${exerciseName} 每1${unit}消耗多少千卡（60kg基准），一次${unit}大约多少分钟，MET强度值`;
  const webText = await searchNutrition(searchQuery);
  if (!webText) return { source: 'none', webText: null };

  // 3. LLM 结构化
  const structured = await structureExerciseData(exerciseName, unit, webText);
  if (!structured) {
    return { source: 'web_unvalidated', webText, reasons: ['网络结果无法结构化'] };
  }

  // 4. 合理性校验（含本地估算交叉验证）
  const validation = validateLearnedExercise(structured, expectedPerUnit);
  if (!validation.valid) {
    console.warn(`[webSearchService] 运动数据校验未通过（${exerciseName}/每${unit}）：${validation.reasons.join('；')}`);
    return { source: 'web_unvalidated', webText, reasons: validation.reasons };
  }

  // 5. 校验通过 → 回流运动库
  const saved = saveLearnedExercise(exerciseName, structured);
  return {
    source: saved.error ? 'web_unvalidated' : 'web_learned',
    perUnit: Number(structured.calorie_per_unit),
    minutesPerUnit: Number(structured.minutes_per_unit) || null,
    met: Number(structured.met_value) || null,
    webText,
    saved
  };
}

module.exports = {
  searchNutrition,
  searchAndLearnFood,
  structureFoodNutrition,
  validateLearnedFood,
  searchAndLearnExercise,
  structureExerciseData,
  validateLearnedExercise
};
