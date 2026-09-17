/**
 * 回归测试：鲜芋仙仙草4号「碗装份重」沉淀与 helper 回复一致性
 *
 * 背景：用户说"一碗仙草4号"，LLM 沉淀自估 weight=200 算出170千卡，
 * 而食品库 common_unit 标注"一份500g约425千卡"，helper 回复正确(~425千卡)。
 * 修复后沉淀应采用库标准份重 500g。
 *
 * 运行：NODE_ENV=test node test_xiancao_serving.js
 */

// ---------- 1. 安装 LLM mock（必须在 require precipitationAgent 之前） ----------
const aiClient = require('./src/services/aiClient');
let mockExtract = null;
let mockEstimate = null;
const estimateCalls = [];
aiClient.callWithPrompt = async (promptKey, messages, opts) => {
  const userContent = (messages.find(m => m.role === 'user') || {}).content || '';
  if (promptKey === 'precipitation_agent') {
    const items = typeof mockExtract === 'function' ? mockExtract(userContent) : [];
    return { choices: [{ message: { content: JSON.stringify(items) } }] };
  }
  // 营养估算调用（本用例库命中不应触发）
  estimateCalls.push(userContent.slice(0, 30));
  return { choices: [{ message: { content: JSON.stringify(mockEstimate || { calorie_per_100g: 85 }) } }] };
};

// ---------- 2. 加载模块并种子数据 ----------
const { db, initTables, migrateTables, initSeedData } = require('./src/db');
initTables();
migrateTables();
initSeedData();
const agent = require('./src/services/agents/precipitationAgent');

const userId = db.prepare("INSERT INTO users (openid, nickname, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
  .run('xiancao_test_' + Date.now(), '仙草测试').lastInsertRowid;

// 与生产 food_id=9219 完全一致的记录
db.prepare(`INSERT INTO food_db (food_id, food_name, aliases, calories_per_100g, protein_per_100g, carb_per_100g, fat_per_100g, category, sub_category, common_unit, source)
  SELECT 999219, '仙草4号', '["仙草4号"]', 85, 0, 0, 0, '零食', '甜品',
  '一份500g约425千卡；三分糖/少糖版每份（500g）总热量约370~400千卡，碳水含量较全糖版降低20%左右',
  'web_learned'
  WHERE NOT EXISTS (SELECT 1 FROM food_db WHERE food_id = 999219)`).run();

function clean() {
  db.prepare('DELETE FROM diet_records WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM precipitation_records WHERE user_id = ?').run(userId);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅', name, detail ? '—— ' + detail : ''); }
  else { fail++; console.log('  ❌', name, detail ? '—— ' + detail : ''); }
}

async function runCase(name, content, foods, assertions) {
  console.log('\n■ ' + name);
  clean();
  estimateCalls.length = 0;
  mockExtract = () => [{ extracted: true, type: 'diet_record', confidence: 0.95,
    extracted_data: { meal_time: '加餐', foods, total_calorie: 0 } }];
  mockEstimate = { calorie_per_100g: 85 };
  try {
    await agent.callPrecipitationAgent(content, userId, null, '2026-09-17');
  } catch (e) { console.log('  [异常]', e.message); }
  await sleep(600);
  const rows = db.prepare('SELECT foods, total_calorie FROM diet_records WHERE user_id = ? AND record_date = ?').all(userId, '2026-09-17');
  const list = [];
  for (const row of rows) {
    try { const arr = JSON.parse(row.foods || '[]'); for (const f of arr) list.push(f); } catch (e) {}
  }
  assertions(list);
}

(async () => {
  // 场景1：一碗仙草4号，LLM 错估 200g → 应修正为库标准份重 500g / 425千卡
  await runCase('一碗仙草4号（LLM估200g）',
    '喝了一碗仙草4号',
    [{ name: '仙草4号', weight: 200, quantity: 1, unit: '碗', calorie: 0 }],
    (rows) => {
      const r = rows.find(x => (x.name||'').includes('仙草'));
      assert('记录存在', !!r);
      if (r) {
        assert('重量修正为500g（库标准份重）', r.weight === 500, `weight=${r.weight}`);
        assert('热量≈425千卡', Math.abs(r.calorie - 425) < 2, `calorie=${r.calorie}`);
      }
      assert('未触发LLM营养估算（库命中）', estimateCalls.length === 0, `calls=${estimateCalls.length}`);
    });

  // 场景2：半碗 → 250g / ~212.5千卡
  await runCase('半碗仙草4号',
    '喝了半碗仙草4号',
    [{ name: '仙草4号', weight: 100, quantity: 0.5, unit: '碗', calorie: 0 }],
    (rows) => {
      const r = rows.find(x => (x.name||'').includes('仙草'));
      if (r) {
        assert('半碗重量=250g', r.weight === 250, `weight=${r.weight}`);
        assert('半碗热量≈212.5千卡', Math.abs(r.calorie - 212.5) < 2, `calorie=${r.calorie}`);
      } else assert('记录存在', false);
    });

  // 场景3：用户显式说200g → 必须尊重用户克重，不被库500g覆盖（200g/170千卡）
  await runCase('200g仙草4号（用户显式克重）',
    '吃了200克仙草4号',
    [{ name: '仙草4号', weight: 200, quantity: 1, unit: 'g', calorie: 0 }],
    (rows) => {
      const r = rows.find(x => (x.name||'').includes('仙草'));
      if (r) {
        assert('尊重用户显式200g', r.weight === 200, `weight=${r.weight}`);
        assert('热量=170千卡', Math.abs(r.calorie - 170) < 2, `calorie=${r.calorie}`);
      } else assert('记录存在', false);
    });

  // 清理
  clean();
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.prepare('DELETE FROM food_db WHERE food_id = 999219').run();

  console.log(`\n通过 ${pass} / ${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
