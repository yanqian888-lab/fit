/**
 * 豆包完整链路测试：LLM提取 → sanitize → 热量重算 → 最终入库值
 * 用法: NODE_ENV=production node test_doubao_full.js
 */
const nutritionService = require('./src/services/nutritionService');

/**
 * 测试热量重算链：模拟豆包提取结果经过 computeFoodNutrition 后的最终值
 */
async function testNutrition() {
  console.log('=== 测试1: 热量重算链（食物名干净时能否正确修正）===\n');

  // 豆包实际提取的原始值（来自 test_doubao_quality.js 运行结果）
  const cases = [
    { name: '低脂牛奶', weight: 180, unit: 'ml', quantity: 1, calorie: 108 },
    { name: '米饭', weight: 150, unit: '碗', quantity: 1, calorie: 174 },
    { name: '宫保鸡丁', weight: 150, unit: '份', quantity: 1, calorie: 255 },
    { name: '水煮蛋', weight: 100, unit: '个', quantity: 2, calorie: 278 }
  ];

  for (const c of cases) {
    const result = nutritionService.computeFoodNutrition({ ...c });
    console.log('🍚 ' + c.name + ' ' + c.weight + c.unit + ' (LLM原始热量: ' + c.calorie + ')');
    console.log('   → 最终热量: ' + (result.calorie || '?') + ' 千卡 | 重量: ' + result.weight + result.unit + ' | 蛋白: ' + (result.protein || 0) + ' | 碳水: ' + (result.carb || 0) + ' | 脂肪: ' + (result.fat || 0));
    console.log('');
  }
}

/**
 * 测试主Agent聊天质量
 */
async function testMainAgent() {
  console.log('\n=== 测试2: 豆包主Agent聊天质量 ===\n');

  const { callWithPrompt } = require('./src/services/aiClient');
  const promptService = require('./src/services/promptService');

  const systemPrompt = promptService.getPrompt('main_agent', {
    partner_mode: '温柔鼓励型',
    pet_persona: '健康状态，心情愉快',
    current_time: '2026-09-04 12:30:00'
  });

  const messages = [
    '早上好呀，我喝了一杯低脂牛奶，180ml',
    '感觉最近体重不掉了好焦虑'
  ];

  for (const msg of messages) {
    const start = Date.now();
    try {
      const resp = await Promise.race([
        callWithPrompt('main_agent', [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: msg }
        ], { temperature: 0.7, max_tokens: 2000 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT 30s')), 30000))
      ]);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const content = resp.choices[0].message.content || '(空)';
      console.log('👤 用户: ' + msg);
      console.log('🐼 搭搭: ' + content.slice(0, 400) + (content.length > 400 ? '...' : ''));
      console.log('⏱️ 耗时: ' + elapsed + 's | 字数: ' + content.length);
      console.log('');
    } catch (e) {
      console.log('❌ 失败: ' + e.message);
    }
  }
}

(async () => {
  await testNutrition();
  await testMainAgent();
  console.log('🏁 完整链路测试结束');
  process.exit(0);
})();
