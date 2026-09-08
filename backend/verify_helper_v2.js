/**
 * 端到端验证豆包-Helper 全链路（走真实 callWithPrompt，验证 extra_params 注入）
 * 用法: NODE_ENV=production node verify_helper_v2.js
 */
const { callWithPrompt } = require('./src/services/aiClient');

/**
 * 单场景验证：走生产 callWithPrompt 链路
 */
async function verify(promptKey, question) {
  const t0 = Date.now();
  try {
    const resp = await callWithPrompt(promptKey, [
      { role: 'system', content: '你是专业的减脂营养顾问，回答要引用权威指南。' },
      { role: 'user', content: question }
    ]);
    const msg = resp.choices[0].message;
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const reasoningLen = (msg.reasoning_content || '').length;
    const content = msg.content || '';
    console.log('📌 [' + promptKey + '] "' + question + '"');
    console.log('   ⏱️ ' + elapsed + 's | 思考链长度: ' + reasoningLen + (reasoningLen === 0 ? ' ✅(已关闭)' : ' ⚠️(思考开着)') + ' | 回答字数: ' + content.length);
    console.log('   📄 ' + content.slice(0, 150).replace(/\n/g, ' '));
  } catch (e) {
    console.log('❌ [' + promptKey + '] 失败: ' + e.message);
  }
  console.log('');
}

(async () => {
  // Helper 聊天内协作场景
  await verify('helper_agent', '平台期怎么突破？我都两周没掉秤了');
  // 全能助手异步场景（平台期分析报告）
  await verify('plateau_analysis', '用户连续14天体重无变化，日均摄入1600kcal，每周运动3次，请给出分析');
  process.exit(0);
})();
