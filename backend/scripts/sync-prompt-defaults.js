/**
 * 同步 ai_prompts 最新版本与 src/config/promptDefaults.js
 * - 仅当数据库最新版内容与代码默认值不一致时才发布新版本
 * - 保留版本历史，符合 Prompt 版本管理语义
 * 用法：node scripts/sync-prompt-defaults.js [prompt_key]
 *   示例：node scripts/sync-prompt-defaults.js main_agent
 *   不传参数则检查并同步所有 key
 */
const path = require('path');
const promptDefaults = require('../src/config/promptDefaults');
const promptService = require('../src/services/promptService');

function normalize(str) {
  return (str || '').replace(/\r\n/g, '\n').trim();
}

function syncOne(key) {
  const defaultContent = promptDefaults[key];
  if (defaultContent === undefined) {
    console.log(`[跳过] ${key}: promptDefaults.js 中不存在`);
    return false;
  }

  const meta = promptService.getPromptMeta(key);
  const latest = meta.latest;
  if (!latest) {
    console.log(`[跳过] ${key}: 数据库中不存在，下次启动时会由 initPrompts 自动插入`);
    return false;
  }

  if (normalize(latest.content) === normalize(defaultContent)) {
    console.log(`[一致] ${key}: 数据库最新版 v${latest.version} 已与代码默认值一致`);
    return false;
  }

  const newVersion = promptService.publishVersion(key, defaultContent, latest.ai_config_id);
  console.log(`[更新] ${key}: 已发布新版本 v${newVersion}，内容已同步为 promptDefaults.js 默认值`);
  return true;
}

function main() {
  const targetKey = process.argv[2];
  const keys = targetKey ? [targetKey] : Object.keys(promptDefaults);

  console.log('开始同步 AI Prompt 默认值...');
  let updatedCount = 0;
  for (const key of keys) {
    try {
      if (syncOne(key)) updatedCount++;
    } catch (err) {
      console.error(`[失败] ${key}:`, err.message);
    }
  }
  console.log(`\n同步完成：共更新 ${updatedCount} 个 Prompt`);
}

main();
