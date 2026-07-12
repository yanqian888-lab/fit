/**
 * 将 promptDefaults.js 中的默认提示词同步到 ai_prompts 表
 * 用法：NODE_ENV=test node scripts/sync-prompts.js
 */
const path = require('path');
const { db } = require('../src/db');
const promptDefaults = require('../src/config/promptDefaults');

const prompts = promptDefaults.default || promptDefaults;
if (!prompts || typeof prompts !== 'object') {
  console.error('无法读取 promptDefaults');
  process.exit(1);
}

const insertVersion = db.prepare(`
  INSERT INTO ai_prompts (prompt_key, version, content, is_enabled, is_latest)
  VALUES (?, ?, ?, 1, 1)
`);

const updateLatest = db.prepare(`
  UPDATE ai_prompts SET is_latest = 0 WHERE prompt_key = ?
`);

for (const [key, content] of Object.entries(prompts)) {
  const latest = db.prepare(`
    SELECT version FROM ai_prompts WHERE prompt_key = ? AND is_latest = 1
  `).get(key);

  const nextVersion = latest ? latest.version + 1 : 1;

  // 将旧版本标记为非最新
  updateLatest.run(key);

  // 插入新版本
  insertVersion.run(key, nextVersion, content);
  console.log(`已同步 prompt: ${key} -> version ${nextVersion}`);
}

console.log('提示词同步完成');
