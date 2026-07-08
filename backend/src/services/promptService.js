/**
 * AI Prompt 管理服务
 * - 所有 AI 调用相关的 system/user prompt 都通过这里读取
 * - 支持版本管理：每个 prompt_key 保留最新版 + 最多 MAX_HISTORY 个历史版本
 * - 历史版本可启用/停用；运行时取最新启用的版本，未找到则取最新版本，最后兜底默认文案
 */
const { db } = require('../db');
const defaults = require('../config/promptDefaults');

const MAX_HISTORY = 3;

function render(content, variables = {}) {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

/**
 * 获取渲染后的 Prompt 内容
 */
function getPrompt(promptKey, variables = {}) {
  let row = db.prepare(`
    SELECT content FROM ai_prompts
    WHERE prompt_key = ? AND is_enabled = 1
    ORDER BY version DESC LIMIT 1
  `).get(promptKey);

  if (!row) {
    row = db.prepare(`
      SELECT content FROM ai_prompts
      WHERE prompt_key = ?
      ORDER BY version DESC LIMIT 1
    `).get(promptKey);
  }

  const content = row ? row.content : (defaults[promptKey] || '');
  return render(content, variables);
}

/**
 * 获取某个 key 的元数据与所有版本
 */
function getPromptMeta(promptKey) {
  const latest = db.prepare(`
    SELECT p.*, c.name as ai_config_name
    FROM ai_prompts p
    LEFT JOIN ai_configs c ON c.id = p.ai_config_id
    WHERE p.prompt_key = ? AND p.is_latest = 1
  `).get(promptKey);

  const versions = db.prepare(`
    SELECT id, prompt_key, version, content, is_enabled, is_latest, created_at, updated_at
    FROM ai_prompts
    WHERE prompt_key = ?
    ORDER BY version DESC
  `).all(promptKey);

  return { latest, versions };
}

/**
 * 列出所有 prompt key
 */
function listPrompts() {
  const rows = db.prepare(`
    SELECT
      p.prompt_key,
      MAX(p.version) as latest_version,
      SUM(CASE WHEN p.is_latest = 1 AND p.is_enabled = 1 THEN 1 ELSE 0 END) as latest_enabled,
      COUNT(*) as version_count,
      p.ai_config_id,
      c.name as ai_config_name
    FROM ai_prompts p
    LEFT JOIN ai_configs c ON c.id = p.ai_config_id
    GROUP BY p.prompt_key
    ORDER BY p.prompt_key
  `).all();

  return rows.map(r => ({
    prompt_key: r.prompt_key,
    latest_version: r.latest_version,
    is_enabled: r.latest_enabled > 0,
    version_count: r.version_count,
    ai_config_id: r.ai_config_id,
    ai_config_name: r.ai_config_name || null
  }));
}

/**
 * 发布新版本（编辑最新版后保存）
 * - 插入新版本并标记为 latest
 * - 旧版本自动变为历史
 * - 若历史版本超过 MAX_HISTORY，删除最早的一个
 */
function publishVersion(promptKey, content, aiConfigId) {
  const maxRow = db.prepare(`SELECT MAX(version) as v FROM ai_prompts WHERE prompt_key = ?`).get(promptKey);
  const nextVersion = (maxRow?.v || 0) + 1;

  // 发布新版本时，旧版本全部变为历史并默认停用
  db.prepare(`UPDATE ai_prompts SET is_latest = 0, is_enabled = 0 WHERE prompt_key = ?`).run(promptKey);

  // 若未指定配置，继承旧版本配置
  let resolvedConfigId = aiConfigId;
  if (resolvedConfigId === undefined || resolvedConfigId === null) {
    const prev = db.prepare(`SELECT ai_config_id FROM ai_prompts WHERE prompt_key = ? ORDER BY version DESC LIMIT 1`).get(promptKey);
    resolvedConfigId = prev?.ai_config_id || null;
  }

  const insert = db.prepare(`
    INSERT INTO ai_prompts (prompt_key, version, content, ai_config_id, is_enabled, is_latest)
    VALUES (?, ?, ?, ?, 1, 1)
  `);
  insert.run(promptKey, nextVersion, content, resolvedConfigId);

  // 只保留最多 MAX_HISTORY 个历史版本（保留较新的历史，删除最早的）
  const overflow = db.prepare(`
    SELECT id FROM ai_prompts
    WHERE prompt_key = ? AND is_latest = 0
    ORDER BY version DESC
    LIMIT -1 OFFSET ?
  `).all(promptKey, MAX_HISTORY);

  for (const r of overflow) {
    db.prepare(`DELETE FROM ai_prompts WHERE id = ?`).run(r.id);
  }

  return nextVersion;
}

/**
 * 启用/停用某个版本
 */
function setVersionEnabled(promptKey, version, isEnabled) {
  db.prepare(`
    UPDATE ai_prompts
    SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE prompt_key = ? AND version = ?
  `).run(isEnabled ? 1 : 0, promptKey, version);
}

/**
 * 设置 Prompt 最新版本使用的 AI 配置
 */
function setPromptAiConfig(promptKey, aiConfigId) {
  db.prepare(`
    UPDATE ai_prompts
    SET ai_config_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE prompt_key = ? AND is_latest = 1
  `).run(aiConfigId, promptKey);
}

/**
 * 初始化默认 Prompt（首次启动）
 */
function initPrompts() {
  const existingKeys = new Set(
    db.prepare(`SELECT DISTINCT prompt_key FROM ai_prompts`).all().map(r => r.prompt_key)
  );

  for (const [key, content] of Object.entries(defaults)) {
    if (existingKeys.has(key)) continue;
    db.prepare(`
      INSERT INTO ai_prompts (prompt_key, version, content, is_enabled, is_latest)
      VALUES (?, 1, ?, 1, 1)
    `).run(key, content);
  }
}

module.exports = {
  getPrompt,
  getPromptMeta,
  listPrompts,
  publishVersion,
  setVersionEnabled,
  setPromptAiConfig,
  initPrompts,
  MAX_HISTORY
};
