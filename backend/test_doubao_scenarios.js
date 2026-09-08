/**
 * 豆包全场景对比测试：主Agent单独聊天 vs Helper协作 vs 混合场景
 * 模拟 chatController 真实链路（不走数据库），输出对比报告
 * 用法: NODE_ENV=production node test_doubao_scenarios.js
 */
const mainAgent = require('./src/services/agents/mainAgent');
const helperAgent = require('./src/services/agents/helperAgent');

// 模拟测试用户信息（模仿 chatController 传入的结构）
const testUser = {
  id: 6,
  nickname: '测试用户',
  gender: '女',
  age: 28,
  height: 162,
  current_weight: 65.5,
  target_weight: 55,
  dietary_taboos: '不吃香菜',
  preferences: '喜欢清淡口味'
};
const testPartner = { mode: 'gentle' };

// ============ 测试场景定义 ============
const SCENARIOS = [
  // A组：纯聊天（期望：不触发Helper，主Agent秒回）
  { group: 'A-纯聊天', msg: '早啊搭搭，今天天气真好', expect: '不触发Helper' },
  { group: 'A-纯聊天', msg: '今天上班好累啊，什么都不想干', expect: '不触发Helper' },
  { group: 'A-纯聊天', msg: '今早称了58.2，比昨天轻了0.3，嘻嘻', expect: '不触发Helper' },
  // B组：专业问题（期望：触发Helper协作，双消息回复）
  { group: 'B-Helper协作', msg: '一杯全糖珍珠奶茶大概多少千卡呀？', expect: '触发Helper' },
  { group: 'B-Helper协作', msg: '帮我制定一份一周的减脂食谱计划', expect: '触发Helper' },
  { group: 'B-Helper协作', msg: '平台期怎么突破？我都两周没掉秤了', expect: '触发Helper' },
  { group: 'B-Helper协作', msg: '我这种体重适合什么运动？跑步伤膝盖吗', expect: '触发Helper' },
  // C组：混合场景（期望：主Agent共情 + Helper专业补充）
  { group: 'C-混合', msg: '中午吃了一碗牛肉面，感觉有点罪恶，这样会胖吗', expect: '共情+Helper计算' },
  { group: 'C-混合', msg: '晚上和朋友吃了火锅，明天怎么补救？', expect: '共情+Helper方案' }
];

/**
 * 单场景测试：主Agent → 解析工具调用 → Helper协作
 */
async function runScenario(sc, index) {
  console.log('\n' + '═'.repeat(64));
  console.log(`📌 [${index + 1}/${SCENARIOS.length}] ${sc.group} | 期望: ${sc.expect}`);
  console.log(`👤 用户: ${sc.msg}`);
  console.log('─'.repeat(64));

  const t0 = Date.now();

  // ===== 第一轮：主Agent =====
  let mainMs = 0, helperMs = 0;
  let agentResult;
  try {
    agentResult = await mainAgent.callMainAgent(sc.msg, [], testUser, testPartner);
    mainMs = Date.now() - t0;
  } catch (e) {
    console.log('❌ 主Agent调用失败: ' + e.message);
    return { group: sc.group, msg: sc.msg, mainMs: '-', helperMs: '-', tool: 'ERR', reply: '调用失败' };
  }

  const { reply, toolCalls } = agentResult;
  console.log(`🐼 主Agent(${(mainMs / 1000).toFixed(1)}s): ${reply.slice(0, 120)}${reply.length > 120 ? '...' : ''}`);

  // ===== 第二轮：Helper协作（如果有工具调用）=====
  let finalReply = reply;
  let helperAnswer = null;
  if (toolCalls && toolCalls.length > 0) {
    const th = Date.now();
    const toolResults = await mainAgent.executeToolCalls(toolCalls, testUser.id, sc.msg, testUser, testPartner);
    helperMs = Date.now() - th;
    for (const r of toolResults) {
      if (r.answer) {
        helperAnswer = r.answer;
        finalReply = finalReply ? `${finalReply}\n\n${r.answer}` : r.answer;
      }
    }
    if (helperAnswer) {
      console.log(`🧑‍⚕️ Helper(${(helperMs / 1000).toFixed(1)}s): ${helperAnswer.slice(0, 150)}${helperAnswer.length > 150 ? '...' : ''}`);
    } else {
      console.log(`🧑‍⚕️ Helper: (无有效回答) toolResults=${JSON.stringify(toolResults).slice(0, 150)}`);
    }
  } else {
    console.log('🚫 未触发工具调用（主Agent独立回复）');
  }

  const totalMs = Date.now() - t0;
  console.log(`⏱️ 总耗时: ${(totalMs / 1000).toFixed(1)}s (主${(mainMs / 1000).toFixed(1)}s${helperMs ? ' + Helper ' + (helperMs / 1000).toFixed(1) + 's' : ''}) | 最终回复字数: ${finalReply.length}`);

  return {
    group: sc.group,
    msg: sc.msg,
    tool: (toolCalls && toolCalls.length > 0) ? '✅触发' : '—',
    mainMs: (mainMs / 1000).toFixed(1) + 's',
    helperMs: helperMs ? (helperMs / 1000).toFixed(1) + 's' : '—',
    totalMs: (totalMs / 1000).toFixed(1) + 's',
    replyLen: finalReply.length,
    reply: finalReply
  };
}

(async () => {
  console.log('🧪 豆包全场景对比测试开始（主Agent聊天 vs Helper协作）');
  console.log(`测试用户: ${testUser.nickname} 女/${testUser.age}岁 ${testUser.height}cm ${testUser.current_weight}kg→目标${testUser.target_weight}kg`);

  const results = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const r = await runScenario(SCENARIOS[i], i);
    results.push(r);
  }

  // ===== 汇总对比表 =====
  console.log('\n\n' + '═'.repeat(64));
  console.log('📊 汇总对比表');
  console.log('═'.repeat(64));
  console.log('场景            | 工具调用 | 主Agent | Helper | 总耗时 | 回复字数');
  console.log('-'.repeat(64));
  for (const r of results) {
    const group = (r.group || '').padEnd(14);
    const tool = (r.tool || '').padEnd(6);
    console.log(`${group} | ${tool} | ${String(r.mainMs).padEnd(7)} | ${String(r.helperMs).padEnd(6)} | ${String(r.totalMs).padEnd(6)} | ${r.replyLen || '-'}`);
  }

  // 关键质量检查
  console.log('\n📋 关键质量检查:');
  const bResults = results.filter(r => r.group && r.group.startsWith('B'));
  const bTriggered = bResults.filter(r => r.tool && r.tool.includes('✅')).length;
  console.log(`  B组Helper触发率: ${bTriggered}/${bResults.length}`);
  const aResults = results.filter(r => r.group && r.group.startsWith('A'));
  const aNotTriggered = aResults.filter(r => !r.tool || !r.tool.includes('✅')).length;
  console.log(`  A组纯聊天误触发率: ${aResults.length - aNotTriggered}/${aResults.length}（越低越好）`);

  process.exit(0);
})();
