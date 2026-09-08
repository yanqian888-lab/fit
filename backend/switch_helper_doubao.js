/**
 * 切换 helper_agent 绑定到豆包接入点（config_id=5）
 * 用法: NODE_ENV=production node switch_helper_doubao.js
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');

// 执行绑定切换：helper_agent → 豆包-主Agent接入点
const info = db.prepare(
  "UPDATE ai_prompts SET ai_config_id = 5, updated_at = datetime('now') WHERE prompt_key = 'helper_agent' AND is_latest = 1"
).run();
console.log('更新行数: ' + info.changes);

// 回显三大 agent 的最终绑定关系
console.log('\n=== 最终绑定 ===');
db.prepare(
  "SELECT prompt_key, ai_config_id FROM ai_prompts WHERE is_latest = 1 AND prompt_key IN ('helper_agent','main_agent','precipitation_agent')"
).all().forEach(r => {
  console.log(r.prompt_key + ' -> config_id=' + r.ai_config_id);
});
