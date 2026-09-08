/**
 * 测试 Helper 场景切换豆包的可行性：两个现有接入点对比 Hy3
 * 用法: NODE_ENV=production node test_helper_doubao.js
 */
const { callWithPrompt } = require('./src/services/aiClient');
const promptService = require('./src/services/promptService');
const Database = require('better-sqlite3');

// 拿到两个豆包接入点的配置
const db = new Database('data/app_production.db', { readonly: true });
const doubaoConfigs = db.prepare("SELECT id, name, endpoint_id, api_key, base_url FROM ai_configs WHERE provider='doubao'").all();

const testUser = { id: 6, nickname: '测试用户', gender: '女', age: 28, height: 162, current_weight: 65.5, target_weight: 55 };

/**
 * 直接用指定接入点测 helper prompt 的回答质量和速度
 */
async function testConfig(cfg, question) {
  const systemPrompt = promptService.getPrompt('helper_agent', {});
  const t0 = Date.now();
  const resp = await fetch(cfg.base_url.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key },
    body: JSON.stringify({
      model: cfg.endpoint_id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.5, max_tokens: 2000
    })
  });
  const data = await resp.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const content = data.choices?.[0]?.message?.content || '(空)';
  return { model: data.model, elapsed, content };
}

(async () => {
  const question = '平台期怎么突破？我都两周没掉秤了，帮帮我';
  console.log('📌 测试问题: ' + question + '\n');

  for (const cfg of doubaoConfigs) {
    console.log('═'.repeat(60));
    console.log('🔌 ' + cfg.name + ' (endpoint=' + cfg.endpoint_id + ')');
    try {
      const r = await testConfig(cfg, question);
      console.log('   实际模型: ' + r.model);
      console.log('   ⏱️ 耗时: ' + r.elapsed + 's | 字数: ' + r.content.length);
      console.log('   📄 回答预览: ' + r.content.slice(0, 300).replace(/\n/g, ' ') + '...');
    } catch (e) {
      console.log('   ❌ 失败: ' + e.message);
    }
    console.log('');
  }
  process.exit(0);
})();
