const db = require('/opt/jianfeidazi/backend/src/db').db;

console.log('=== Step 1: 切 AI 配置启用状态 ===\n');
db.prepare("UPDATE ai_configs SET is_enabled=1 WHERE id IN (4, 5)").run();
db.prepare("UPDATE ai_configs SET is_enabled=0 WHERE id IN (2, 3)").run();
console.log('✅ 豆包(id=4,5) 启用, Hy3 主Agent+沉淀(id=2,3) 禁用, Hy3-Helper(id=1) 保持');

console.log('\n=== Step 2: 改 prompt 绑定 ===\n');
db.prepare("UPDATE ai_prompts SET ai_config_id=5 WHERE prompt_key='main_agent' AND is_latest=1").run();
db.prepare("UPDATE ai_prompts SET ai_config_id=4 WHERE prompt_key='precipitation_agent' AND is_latest=1").run();
console.log('✅ main_agent -> cfg_id=5 (豆包-主Agent)');
console.log('✅ precipitation_agent -> cfg_id=4 (豆包-沉淀)');

console.log('\n=== Step 3: 清理 main_agent 历史版本 ===\n');
const allV = db.prepare("SELECT id, version FROM ai_prompts WHERE prompt_key='main_agent' ORDER BY version DESC").all();
const keep = allV.slice(0, 2);
const del = allV.slice(2);
del.forEach(r => db.prepare('DELETE FROM ai_prompts WHERE id=?').run(r.id));
console.log('✅ main_agent 保留 v' + keep[0].version + '+v' + (keep[1] ? keep[1].version : '-') + ', 删除 ' + del.length + ' 条');

console.log('\n========== 最终验证 ==========\n');
console.log('--- AI 配置表 ---');
db.prepare('SELECT id, name, endpoint_id, is_enabled FROM ai_configs ORDER BY id').all().forEach(c => {
  const st = c.is_enabled ? '启用' : '禁用';
  console.log('  id=' + c.id + '  ' + c.name.padEnd(22) + '  endpoint=' + c.endpoint_id.padEnd(30) + '  ' + st);
});

console.log('\n--- Prompt 绑定 ---');
const psql = [
  "SELECT p.prompt_key, p.ai_config_id, c.name as cfg_name, p.version",
  "FROM ai_prompts p LEFT JOIN ai_configs c ON c.id = p.ai_config_id",
  "WHERE p.is_latest = 1 ORDER BY p.prompt_key"
].join('\n');
db.prepare(psql).all().forEach(p => {
  const cfg = p.cfg_name || '-';
  console.log('  ' + p.prompt_key.padEnd(25) + ' v' + p.version + ' -> cfg_id=' + p.ai_config_id + ' (' + cfg + ')');
});
