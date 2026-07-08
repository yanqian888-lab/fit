/**
 * 搭子消息资产提取 Agent
 * 当搭子（partner）在回复中提供食谱、方法等内容时，自动提取并写入博物馆/食谱库
 */
const { callWithPrompt } = require('../aiClient');
const promptService = require('../promptService');

function looksLikeRecipeContent(content) {
  if (!content || content.trim().length < 30) return false;
  const text = content.toLowerCase();
  // 必须同时出现“做法/步骤/食材/烹饪动词”等与具体制作相关的词，才可能是食谱
  const cookingKeywords = ['食谱', '做法', '食材', '步骤', '煮', '炒', '蒸', '烤', '拌', '煎', '炖', '腌制', '调味', '复热', '微波', '焖泡'];
  const hasCooking = cookingKeywords.some(k => text.includes(k));
  if (!hasCooking) return false;

  const weakKeywords = [
    '推荐', '选项', '搭配', '克', 'g', '千卡', '热量', '分钟', '小时'
  ];
  return weakKeywords.some(k => text.includes(k)) || cookingKeywords.length > 0;
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

function extractJsonObjects(text) {
  const results = [];
  const regex = /\{[\s\S]*?\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[0]);
  }
  return results;
}

/**
 * 从搭子回复中提取食谱
 * @param {string} content 搭子回复文本
 * @returns {Promise<Array>} 食谱对象数组
 */
async function extractPartnerRecipes(content) {
  if (!looksLikeRecipeContent(content)) {
    return [];
  }

  try {
    const response = await callWithPrompt(
      'recipe_extraction',
      [
        { role: 'system', content: promptService.getPrompt('recipe_extraction') },
        { role: 'user', content: content }
      ],
      { temperature: 0.1, max_tokens: 2000, response_format: { type: 'json_object' } }
    );

    const resultText = response.choices[0].message.content || '{}';
    let parsed = safeParseJson(resultText);

    if (!parsed) {
      // 尝试从文本中提取 JSON 对象
      const objects = extractJsonObjects(resultText);
      for (const objText of objects) {
        parsed = safeParseJson(objText);
        if (parsed) break;
      }
    }

    if (!parsed || !Array.isArray(parsed.recipes)) {
      return [];
    }

    return parsed.recipes.filter(r => r && r.title && (r.ingredients || r.steps || r.content));
  } catch (err) {
    console.error('[搭子食谱提取] 失败:', err.message);
    return [];
  }
}



/**
 * 从搭子回复中提取可沉淀为方法的内容
 * @param {string} content 搭子回复文本
 * @returns {Promise<{title:string, content:string}|null>}
 */
async function extractPartnerMethod(content) {
  if (!content || content.trim().length < 20) return null;

  try {
    const response = await callWithPrompt(
      'method_extraction',
      [
        { role: 'system', content: promptService.getPrompt('method_extraction') },
        { role: 'user', content: content }
      ],
      { temperature: 0.1, max_tokens: 2000, response_format: { type: 'json_object' } }
    );

    const resultText = response.choices[0].message.content || '{}';
    let parsed = safeParseJson(resultText);

    if (!parsed) {
      const objects = extractJsonObjects(resultText);
      for (const objText of objects) {
        parsed = safeParseJson(objText);
        if (parsed) break;
      }
    }

    if (Array.isArray(parsed) && parsed.length === 0) return null;
    if (!parsed || !parsed.title || !parsed.content) return null;

    return {
      title: String(parsed.title).trim(),
      content: String(parsed.content).trim()
    };
  } catch (err) {
    console.error('[搭子方法提取] 失败:', err.message);
    return null;
  }
}

module.exports = {
  extractPartnerRecipes,
  extractPartnerMethod
};
