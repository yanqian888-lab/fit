/**
 * 验证新豆包Helper接入点连通性（chat/completions 协议）
 * 用法: node test_new_helper_endpoint.js（本地直接跑，无需服务器环境）
 */
const API_KEY = process.env.DOUBAO_HELPER_API_KEY || '请设置 DOUBAO_HELPER_API_KEY 环境变量';
const ENDPOINT = process.env.DOUBAO_HELPER_ENDPOINT || 'ep-20260619104417-xzhp9';
const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

/** 测试 chat/completions 协议连通性（thinking 可开关） */
async function testChat(disableThinking) {
  const t0 = Date.now();
  const body = {
    model: ENDPOINT,
    messages: [
      { role: 'system', content: '你是专业的减脂营养顾问，回答要引用权威指南。' },
      { role: 'user', content: '减脂期每天应该摄入多少蛋白质？' }
    ],
    temperature: 0.5,
    max_tokens: 500
  };
  // 豆包 seed-2.0 系列关闭深度思考的参数
  if (disableThinking) body.thinking = { type: 'disabled' };

  const resp = await fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (data.error) {
    console.log('❌ 接口错误: ' + JSON.stringify(data.error).slice(0, 300));
    return;
  }
  const msg = data.choices?.[0]?.message || {};
  console.log((disableThinking ? '🚫 关闭思考' : '🧠 默认模式') + ' → 模型: ' + data.model + ' | ⏱️ ' + elapsed + 's | reasoning长度: ' + (msg.reasoning_content || '').length + ' | 回答字数: ' + (msg.content || '').length);
  console.log('   📄 回答: ' + (msg.content || '').slice(0, 120));
  console.log('');
}

(async () => {
  await testChat(false);   // 默认（可能带深度思考）
  await testChat(true);    // 关闭深度思考
})();
