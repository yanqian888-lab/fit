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
    instructions: `你是一位专业的注册营养师，擅长查询市售饮品和包装食品的营养成分。
当用户询问某种食物或饮品时，请使用联网搜索获取其热量信息，并区分：
- 普通版/有糖版
- 无糖版/低糖版/纯版（如适用）
请给出每100ml或每份的估算千卡数，标注数据来源，回答简洁、分点列出。`,
    tools: [
      { type: 'web_search', max_keyword: 2 }
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

async function estimateWithLlm(query) {
  const response = await callWithPrompt(
    'helper_agent',
    [
      {
        role: 'system',
        content: `你是一位注册营养师，熟悉市售饮品和常见食品的营养成分。
请根据公开营养资料，对用户询问的饮品/食品给出热量估算，必须区分普通版/有糖版和无糖版/纯版（如适用）。
给出每100ml或每份的估算千卡数及简要依据。如果信息有限，给出合理范围并明确说明“此为估算值”。
不要回答“不知道”“无法提供”或“不在记录中”。`
      },
      { role: 'user', content: query }
    ],
    { temperature: 0.3, max_tokens: 600, timeout: ESTIMATE_TIMEOUT_MS }
  );

  const content = response?.choices?.[0]?.message?.content;
  return (content || '').trim();
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

module.exports = {
  searchNutrition
};
