/**
 * 豆包沉淀 Agent 质量测试脚本（只测 LLM 提取，不写数据库）
 * 用法: NODE_ENV=production node test_doubao_quality.js
 */
const { callWithPrompt } = require('./src/services/aiClient');
const promptService = require('./src/services/promptService');

// 测试用例：覆盖之前 Hy3 出错的重点场景
const TEST_CASES = [
  {
    name: '经典案例：低脂牛奶+ml重量（之前Hy3错成375千卡/250g）',
    content: '好，我喝了一杯低脂牛奶，180ml'
  },
  {
    name: '多食物提取（不能只提取第一个）',
    content: '中午吃了一碗米饭，还有一份宫保鸡丁'
  },
  {
    name: '饮食+运动混合（必须分别输出两个记录）',
    content: '早上跑了5公里，回来吃了两个水煮蛋'
  },
  {
    name: '疑问句（不应沉淀）',
    content: '奶茶热量高吗？我想喝'
  }
];

/**
 * 单个用例测试：调用 LLM 并输出原始提取 JSON
 */
async function runCase(tc) {
  console.log('\n' + '='.repeat(60));
  console.log('📌 ' + tc.name);
  console.log('用户消息: "' + tc.content + '"');
  console.log('-'.repeat(60));

  const systemPrompt = promptService.getPrompt('precipitation_agent', {
    current_time: '2026-09-04 12:30:00'
  });

  const start = Date.now();
  try {
    const response = await Promise.race([
      callWithPrompt(
        'precipitation_agent',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: tc.content }
        ],
        { temperature: 0.1, max_tokens: 2500 }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT 15s')), 15000))
    ]);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const raw = response.choices[0].message.content || '(空)';

    // 格式化输出提取结果
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      if (items.length === 0 || !items[0].extracted) {
        console.log('✅ 判定: 不沉淀（正确/预期行为）');
        console.log('原始输出: ' + raw.slice(0, 200));
      } else {
        for (const item of items) {
          console.log('→ 类型: ' + item.type + ' | extracted: ' + item.extracted);
          if (item.type === 'diet_record' && item.extracted_data) {
            const foods = item.extracted_data.foods || [];
            console.log('   餐别: ' + (item.extracted_data.meal_type || '-'));
            for (const f of foods) {
              console.log('   🍚 食物名: "' + f.name + '" | 重量: ' + f.weight + f.unit + ' | 数量: ' + (f.quantity || '-') + ' | 热量: ' + f.calorie + ' 千卡');
            }
            const total = item.extracted_data.total_calorie || foods.reduce((s, f) => s + (f.calorie || 0), 0);
            console.log('   总热量: ' + total + ' 千卡');
          } else if (item.type === 'exercise_record' && item.extracted_data) {
            console.log('   🏃 运动: ' + (item.extracted_data.exercise_name || item.extracted_data.name || '-') + ' | 时长: ' + (item.extracted_data.duration_minutes || '-') + '分钟 | 热量: ' + (item.extracted_data.calorie || item.extracted_data.calories_burned || '-') + ' 千卡');
          } else {
            console.log('   数据: ' + JSON.stringify(item.extracted_data).slice(0, 200));
          }
        }
      }
    } catch (e) {
      console.log('⚠️ JSON 解析失败！原始输出:');
      console.log(raw.slice(0, 500));
    }
    console.log('⏱️ 耗时: ' + elapsed + 's');
  } catch (e) {
    console.log('❌ 调用失败: ' + e.message);
  }
}

(async () => {
  console.log('🧪 豆包沉淀 Agent 质量测试开始（生产配置）');
  for (const tc of TEST_CASES) {
    await runCase(tc);
  }
  console.log('\n🏁 测试完成');
  process.exit(0);
})();
