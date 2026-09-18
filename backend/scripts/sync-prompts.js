/**
 * 将 promptDefaults.js 的默认提示词同步发布到 ai_prompts 表
 *
 * 用法：node scripts/sync-prompts.js [--dry-run]
 *
 * 规则：
 * - 只处理 DB 中已存在的 prompt_key（initPrompts 负责首次写入，这里不新建 key）
 * - 若「最新启用版本」内容与代码默认版逐字一致 → 跳过
 * - 否则调用 publishVersion 发布新版本（继承原 ai_config_id）
 *
 * 每次修改 promptDefaults.js 后运行本脚本，即等价于在 CMS Prompts 页逐条发布。
 */
const path = require('path');
process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/app.db');

const { db } = require('../src/db');
const promptService = require('../src/services/promptService');
const defaults = require('../src/config/promptDefaults');

const dryRun = process.argv.includes('--dry-run');

function main() {
  const keys = Object.keys(defaults);
  let synced = 0;
  let skipped = 0;

  for (const key of keys) {
    const latest = db.prepare(`
      SELECT content FROM ai_prompts
      WHERE prompt_key = ? AND is_enabled = 1
      ORDER BY version DESC LIMIT 1
    `).get(key);

    if (latest && latest.content === defaults[key]) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${key}: 将发布新版本（当前 ${latest ? 'DB 有旧版' : 'DB 无启用版'}）`);
      synced++;
      continue;
    }

    const version = promptService.publishVersion(key, defaults[key]);
    console.log(`✅ ${key}: 已发布 v${version}`);
    synced++;
  }

  console.log(`\n完成：同步 ${synced} 条，跳过（已一致）${skipped} 条${dryRun ? '（dry-run 未写入）' : ''}`);
}

main();
