/**
 * AI 配置管理 & 基于 Prompt Key 的调用链
 */
const OpenAI = require('openai');
const { db } = require('../db');

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
    data.provider || 'doubao',
    data.base_url || 'https://ark.cn-beijing.volces.com/api/v3',
    data.api_key,
    data.endpoint_id,
    data.temperature ?? 0.7,
    data.max_tokens ?? 500,
    data.timeout_ms ?? 30000,
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
    try {
      const response = await client.chat.completions.create(requestOptions);
      console.log(`[callWithPrompt:${promptKey}] 使用配置 ${cfg.name} 调用成功`);
      return response;
    } catch (err) {
      console.warn(`[callWithPrompt:${promptKey}] 配置 ${cfg.name} 调用失败: ${err.message}`);
      errors.push(`${cfg.name}: ${err.message}`);
    }
  }

  throw new Error(`所有 AI 配置均调用失败: ${errors.join('; ')}`);
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
