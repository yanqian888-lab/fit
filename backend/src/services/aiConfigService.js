/**
 * AI 配置管理 & 基于 Prompt Key 的调用链
 * 支持腾讯云 TokenHub Hy3/Hy4 reasoning_effort 映射
 */
const OpenAI = require('openai');
const { db } = require('../db');

/**
 * PromptKey → Hy3 reasoning_effort 映射表
 * 主Agent: low（极速响应），content 偶发为空时自动 fallback 到 high 重试
 * Helper: high（深度推理专业计算）
 * 沉淀: low（快速结构化提取）
 */
const PROMPT_REASONING_EFFORT_MAP = {
  main_agent: 'low',
  helper_agent: 'high',
  precipitation_agent: 'low'
};

function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 12) return '****';
  return key.slice(0, 6) + '****' + key.slice(-4);
}

function rowToConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    base_url: row.base_url,
    api_key: row.api_key,
    endpoint_id: row.endpoint_id,
    temperature: row.temperature,
    max_tokens: row.max_tokens,
    timeout_ms: row.timeout_ms,
    role: row.role,
    sort_order: row.sort_order,
    is_enabled: row.is_enabled,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function list() {
  const rows = db.prepare(`
    SELECT id, name, provider, base_url, api_key, endpoint_id, temperature, max_tokens, timeout_ms, role, sort_order, is_enabled, created_at, updated_at
    FROM ai_configs
    ORDER BY role ASC, sort_order ASC, id ASC
  `).all();
  return rows.map(rowToConfig);
}

function listForSelect() {
  const rows = db.prepare(`SELECT id, name, role FROM ai_configs WHERE is_enabled = 1 ORDER BY role ASC, sort_order ASC, id ASC`).all();
  return rows;
}

function detail(id) {
  const row = db.prepare(`
    SELECT id, name, provider, base_url, api_key, endpoint_id, temperature, max_tokens, timeout_ms, role, sort_order, is_enabled, created_at, updated_at
    FROM ai_configs WHERE id = ?
  `).get(id);
  return rowToConfig(row);
}

function create(data) {
  const result = db.prepare(`
    INSERT INTO ai_configs (name, provider, base_url, api_key, endpoint_id, temperature, max_tokens, timeout_ms, role, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.provider || 'hunyuan',
    data.base_url || 'https://tokenhub.tencentmaas.com/v1',
    data.api_key,
    data.endpoint_id,
    data.temperature ?? 0.7,
    data.max_tokens ?? 1000,
    data.timeout_ms ?? 60000,
    data.role || 'primary',
    data.sort_order ?? 0,
    data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1
  );
  return detail(result.lastInsertRowid);
}

function update(id, data) {
  const existing = detail(id);
  if (!existing) return null;
  db.prepare(`
    UPDATE ai_configs SET
      name = COALESCE(?, name),
      provider = COALESCE(?, provider),
      base_url = COALESCE(?, base_url),
      api_key = COALESCE(?, api_key),
      endpoint_id = COALESCE(?, endpoint_id),
      temperature = COALESCE(?, temperature),
      max_tokens = COALESCE(?, max_tokens),
      timeout_ms = COALESCE(?, timeout_ms),
      role = COALESCE(?, role),
      sort_order = COALESCE(?, sort_order),
      is_enabled = COALESCE(?, is_enabled),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.provider ?? null,
    data.base_url ?? null,
    data.api_key ?? null,
    data.endpoint_id ?? null,
    data.temperature ?? null,
    data.max_tokens ?? null,
    data.timeout_ms ?? null,
    data.role ?? null,
    data.sort_order ?? null,
    data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : null,
    id
  );
  return detail(id);
}

function remove(id) {
  const used = db.prepare(`SELECT COUNT(*) as count FROM ai_prompts WHERE ai_config_id = ?`).get(id).count;
  if (used > 0) {
    throw new Error('该 AI 配置仍被 Prompt 使用，无法删除');
  }
  const result = db.prepare(`DELETE FROM ai_configs WHERE id = ?`).run(id);
  return result.changes > 0;
}

function getDefaultPrimaryConfig() {
  return db.prepare(`
    SELECT * FROM ai_configs WHERE is_enabled = 1 AND role = 'primary'
    ORDER BY sort_order ASC, id ASC LIMIT 1
  `).get();
}

function getPromptConfig(promptKey) {
  const row = db.prepare(`
    SELECT c.* FROM ai_prompts p
    JOIN ai_configs c ON c.id = p.ai_config_id
    WHERE p.prompt_key = ? AND p.is_latest = 1 AND p.is_enabled = 1 AND c.is_enabled = 1
    LIMIT 1
  `).get(promptKey);
  if (row) return row;
  return getDefaultPrimaryConfig();
}

function getBackupConfigs() {
  return db.prepare(`
    SELECT * FROM ai_configs
    WHERE is_enabled = 1 AND role = 'backup'
    ORDER BY sort_order ASC, id ASC
  `).all();
}

function getCallChain(promptKey) {
  const primary = getPromptConfig(promptKey);
  const backups = getBackupConfigs();
  const chain = [];
  if (primary) chain.push(rowToConfig(primary));
  for (const b of backups) {
    if (primary && b.id === primary.id) continue;
    chain.push(rowToConfig(b));
  }
  return chain;
}

/**
 * 判断当前配置是否为腾讯云 Hy3 模型
 * 依据：provider 含 hunyuan/tencent 或 endpoint_id 为 hy3/Hy3
 */
function isHy3Config(cfg) {
  const provider = String(cfg.provider || '').toLowerCase();
  const endpoint = String(cfg.endpoint_id || '').toLowerCase();
  return provider.includes('hunyuan') ||
         provider.includes('tencent') ||
         provider.includes('hy3') ||
         endpoint === 'hy3';
}

async function callWithPrompt(promptKey, messages, options = {}) {
  const chain = getCallChain(promptKey);
  if (chain.length === 0) {
    throw new Error('没有可用的 AI 配置');
  }

  const errors = [];
  for (const cfg of chain) {
    const client = new OpenAI({
      apiKey: cfg.api_key,
      baseURL: cfg.base_url
    });
    const requestOptions = {
      model: cfg.endpoint_id,
      messages,
      temperature: options.temperature ?? cfg.temperature,
      max_tokens: options.max_tokens ?? cfg.max_tokens,
      timeout: options.timeout ?? cfg.timeout_ms
    };
    if (options.response_format) {
      requestOptions.response_format = options.response_format;
    }

    // 腾讯云 Hy3/Hy4：根据 promptKey 自动注入 reasoning_effort
    // 调用方也可以通过 options.reasoning_effort 显式覆盖
    if (isHy3Config(cfg)) {
      const reasoningEffort = options.reasoning_effort || PROMPT_REASONING_EFFORT_MAP[promptKey];
      if (reasoningEffort) {
        requestOptions.reasoning_effort = reasoningEffort;
        console.log(`[callWithPrompt:${promptKey}] Hy3 使用推理深度: ${reasoningEffort}`);
      }
    }

    try {
      let response = await client.chat.completions.create(requestOptions);

      // 混元 Hy3 low 推理深度偶发返回空 content（只输出 reasoning_content）。
      // 此时用 high 重试一次，确保拿到干净的最终回复。
      const firstContent = response.choices[0].message.content || '';
      if (!firstContent.trim() && isHy3Config(cfg) && requestOptions.reasoning_effort === 'low') {
        console.warn(`[callWithPrompt:${promptKey}] low 推理深度返回空 content，尝试 high 重试`);
        const retryOptions = { ...requestOptions, reasoning_effort: 'high' };
        response = await client.chat.completions.create(retryOptions);
      }

      // 最终兜底：如果 content 仍然为空但 reasoning_content 非空，尝试提取最终回复。
      normalizeHy3Content(response);

      console.log(`[callWithPrompt:${promptKey}] 使用配置 ${cfg.name} 调用成功`);
      return response;
    } catch (err) {
      console.warn(`[callWithPrompt:${promptKey}] 配置 ${cfg.name} 调用失败: ${err.message}`);
      errors.push(`${cfg.name}: ${err.message}`);
    }
  }

  throw new Error(`所有 AI 配置均调用失败: ${errors.join('; ')}`);
}

/**
 * 混元 Hy3 兼容：防止把 reasoning_content（思考过程）直接暴露给用户。
 * 当 content 为空但 reasoning_content 非空时，只记录警告，不把思考内容回填到 content。
 * 业务层应当在 content 为空时返回安全的兜底回复。
 */
function normalizeHy3Content(response) {
  const choice = response?.choices?.[0];
  const message = choice?.message;
  if (!message) return;

  const content = message.content || '';
  const reasoning = message.reasoning_content || '';
  if (content.trim() || !reasoning.trim()) return;

  console.warn('[callWithPrompt] 模型返回空 content，reasoning_content 非空；不直接提取思考过程，由业务层兜底');
}

module.exports = {
  list,
  listForSelect,
  detail,
  create,
  update,
  remove,
  getPromptConfig,
  getDefaultPrimaryConfig,
  getCallChain,
  callWithPrompt,
  maskApiKey
};
