/**
 * 新增豆包-Helper 配置（seed-2.0-lite，关闭深度思考）并切换全能助手系 prompt 绑定
 * 用法: NODE_ENV=production node setup_helper_v2.js
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');

// 1. 加 extra_params 列（已存在则跳过）
const cols = db.prepare('PRAGMA table_info(ai_configs)').all().map(c => c.name);
if (!cols.includes('extra_params')) {
  db.prepare('ALTER TABLE ai_configs ADD COLUMN extra_params TEXT').run();
  console.log('✅ 已添加 extra_params 列');
} else {
  console.log('ℹ️ extra_params 列已存在');
}

// 2. 插入豆包-Helper 配置（thinking disabled 写入 extra_params）
const info = db.prepare(`
  INSERT INTO ai_configs (name, provider, base_url, api_key, endpoint_id, temperature, max_tokens, timeout_ms, role, sort_order, is_enabled, extra_params)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  '豆包-Helper（seed-2.0-lite，no_think）',
  'doubao',
  'https://ark.cn-beijing.volces.com/api/v3',
  process.env.DOUBAO_HELPER_API_KEY || '请设置 DOUBAO_HELPER_API_KEY 环境变量',
  'ep-20260619104417-xzhp9',
  0.5,      // temperature：专业分析场景适中
  2000,     // max_tokens：专业长文
  60000,    // 超时60s
  'primary',
  2,        // 排序
  1,        // 启用
  '{"thinking":{"type":"disabled"}}'
);
const newId = info.lastInsertRowid;
console.log('✅ 新配置插入成功 id=' + newId);

// 3. 切换全能助手系 prompt 到新配置（helper + 7个异步分析场景）
const targetKeys = [
  'helper_agent', 'method_extraction', 'diary_system', 'monthly_diary',
  'plateau_analysis', 'weight_loss_advice', 'diary_user', 'recipe_extraction'
];
const upd = db.prepare(`
  UPDATE ai_prompts SET ai_config_id = ?, updated_at = datetime('now')
  WHERE prompt_key = ? AND is_latest = 1
`);
for (const key of targetKeys) {
  const r = upd.run(newId, key);
  console.log((r.changes > 0 ? '✅' : '⚠️ 未找到') + ' ' + key + ' -> config_id=' + newId);
}

// 4. 回显最终全景
console.log('\n=== 最终 ai_configs ===');
db.prepare('SELECT id, name, provider, endpoint_id, is_enabled, extra_params FROM ai_configs ORDER BY id').all().forEach(r => {
  console.log('id=' + r.id + ' | ' + r.name + ' | ' + r.endpoint_id + ' | enabled=' + r.is_enabled + (r.extra_params ? ' | extra=' + r.extra_params : ''));
});
console.log('\n=== 最终 prompt 绑定 ===');
db.prepare('SELECT prompt_key, ai_config_id FROM ai_prompts WHERE is_latest = 1 ORDER BY prompt_key').all().forEach(r => {
  console.log(r.prompt_key + ' -> config_id=' + r.ai_config_id);
});
