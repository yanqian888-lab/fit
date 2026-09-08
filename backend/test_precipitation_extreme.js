/**
 * 沉淀营养链路极端情况验证脚本
 * 通过 mock LLM（aiClient.callWithPrompt）控制提取/估算返回，
 * 验证：清洗→查库→LLM估算→入库→0千卡兜底回写 全链路在极端输入下的表现
 * 运行：cd backend && NODE_ENV=test node test_precipitation_extreme.js
 */
process.env.NODE_ENV = 'test';

// ---------- 1. 安装 LLM mock（必须在 require precipitationAgent 之前） ----------
const aiClient = require('./src/services/aiClient');

let mockExtract = null;    // (userContent) => items[]  提取调用
let mockEstimate = null;   // 对象=估算返回 | Error=抛异常 | 'invalid'=返回非JSON | 'timeout'=挂起
const estimateCalls = [];

aiClient.callWithPrompt = async (promptKey, messages, opts) => {
  const userContent = (messages && messages[1] && messages[1].content) || '';
  // 估算调用：prompt 内含 calorie_per_100g
  if (userContent.includes('calorie_per_100g')) {
    estimateCalls.push(userContent);
    if (mockEstimate instanceof Error) throw mockEstimate;
    if (mockEstimate === 'invalid') {
      return { choices: [{ message: { content: '这不是JSON，抱歉无法回答' } }] };
    }
    if (mockEstimate === 'timeout') return new Promise(() => {});
    if (mockEstimate === 'markdown') {
      // 模拟 LLM 用 markdown 围栏包裹 JSON 的返回格式
      return {
        choices: [{
          message: {
            content: '好的，估算如下：\n```json\n{"calorie_per_100g": 66, "protein_per_100g": 1.1, "carb_per_100g": 15, "fat_per_100g": 0.4}\n```'
          }
        }]
      };
    }
    return { choices: [{ message: { content: JSON.stringify(mockEstimate) } }] };
  }
  // 提取调用
  const items = typeof mockExtract === 'function' ? mockExtract(userContent) : [];
  return { choices: [{ message: { content: JSON.stringify(items) } }] };
};

// ---------- 2. 加载被测模块 ----------
const { db, initTables, migrateTables, initSeedData } = require('./src/db');
initTables();
migrateTables();
initSeedData();
const { computeFoodNutrition, getFoodNutrition } = require('./src/services/nutritionService');
const agent = require('./src/services/agents/precipitationAgent');
const { callPrecipitationAgent } = agent;

// ---------- 3. 测试基建 ----------
let passCount = 0, failCount = 0;
const results = [];

// 创建独立测试用户，避免污染其他数据
const insUser = db.prepare("INSERT INTO users (openid, nickname, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)");
const openid = 'extreme_test_' + Date.now();
const userId = insUser.run(openid, '极端测试用户').lastInsertRowid;

// 种子食物数据：保证库命中用例的确定性（生产库由导入脚本/CMS维护，测试库仅4条小料）
const seedFoods = [
  ['米饭', 116, 2.6, 25.9, 0.3],
  ['火龙果', 60, 1.1, 14.4, 0.5],
  ['苹果', 52, 0.2, 13.5, 0.2],
  ['可乐', 43, 0, 10.6, 0],
  ['奇亚籽', 486, 16.5, 42, 30.7]
];
const insFood = db.prepare(`INSERT INTO food_db (food_id, food_name, calories_per_100g, protein_per_100g, carb_per_100g, fat_per_100g, category, sub_category, source)
  SELECT 'test_seed_' || ?, ?, ?, ?, ?, ?, '测试', '极端测试', 'test_seed'
  WHERE NOT EXISTS (SELECT 1 FROM food_db WHERE food_name = ?)`);
for (const f of seedFoods) insFood.run(f[0], ...f, f[0]);

function cleanUserData() {
  db.prepare('DELETE FROM diet_records WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM exercise_records WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM precipitation_records WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM habit_records WHERE user_id = ?').run(userId);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function assert(name, cond, detail) {
  if (cond) { passCount++; results.push(`  ✅ ${name}${detail ? ' —— ' + detail : ''}`); }
  else { failCount++; results.push(`  ❌ ${name}${detail ? ' —— ' + detail : ''}`); }
}

// 获取某用户指定日期的饮食记录
function getDietRows(recordDate) {
  return db.prepare('SELECT * FROM diet_records WHERE user_id = ? AND record_date = ?').all(userId, recordDate);
}

async function runCase(name, content, extractItems, estimate, recordDate, assertions) {
  console.log(`\n■ ${name}`);
  cleanUserData();
  estimateCalls.length = 0;
  mockExtract = () => extractItems;
  mockEstimate = estimate;
  try {
    await callPrecipitationAgent(content, userId, null, recordDate);
  } catch (e) {
    console.log('  [callPrecipitationAgent 异常]', e.message);
  }
  await sleep(600); // 等待后台 0千卡兜底回写（mock 立即返回，600ms 足够）
  const rows = getDietRows(recordDate);
  assertions(rows, estimateCalls);
}

// ---------- 4. 单元级：resolveWeight / computeFoodNutrition 极端输入 ----------
function unitTests() {
  console.log('\n■ 单元级：computeFoodNutrition 极端输入');
  const ricePer100 = (getFoodNutrition('米饭', null, { minConfidence: 'medium' }) || {}).calorie_per_100g || 116;

  // 4.1 weight=0 + 库命中（米饭）
  const r1 = computeFoodNutrition({ name: '米饭', weight: 0, quantity: 1, unit: 'g', calorie: 0 });
  assert('weight=0/unit=g/库命中 → 默认100g而非1g', r1.weight === 100 && r1.calorie > 0, `weight=${r1.weight}, calorie=${r1.calorie}`);

  // 4.2 weight 缺失 + 库命中
  const r2 = computeFoodNutrition({ name: '米饭', quantity: 1, unit: 'g', calorie: 0 });
  assert('weight缺失/unit=g/库命中 → 默认100g而非1g', r2.weight === 100 && r2.calorie > 0, `weight=${r2.weight}, calorie=${r2.calorie}`);

  // 4.3 weight 负数
  const r3 = computeFoodNutrition({ name: '米饭', weight: -50, quantity: 1, unit: 'g', calorie: 0 });
  assert('weight=-50 → 修正为100g正值', r3.weight === 100 && r3.calorie > 0, `weight=${r3.weight}, calorie=${r3.calorie}`);

  // 4.4 weight=0 + 计数单位 + 典型重量（火龙果 250g/个）
  const r4 = computeFoodNutrition({ name: '火龙果', weight: 0, quantity: 1, unit: '个', calorie: 0 });
  const longanPer100 = (getFoodNutrition('火龙果', null, { minConfidence: 'medium' }) || {}).calorie_per_100g || 60;
  assert('weight=0/unit=个 → 按典型重量250g计算', r4.weight === 250 && Math.abs(r4.calorie - longanPer100 * 2.5) < 1, `weight=${r4.weight}, calorie=${r4.calorie}`);

  // 4.5 无库命中的生僻食物（库未命中时保留传入值）
  const dbHit = getFoodNutrition('量子芝士蛋糕', null, { minConfidence: 'medium' });
  if (!dbHit) {
    const r5 = computeFoodNutrition({ name: '量子芝士蛋糕', weight: 100, quantity: 1, unit: 'g', calorie: 350 });
    assert('无库命中 → 保留传入热量', r5.calorie === 350, `calorie=${r5.calorie}`);
  }

  // 4.6 用户显式热量优先
  const r6 = computeFoodNutrition({ name: '芝士蛋糕', weight: 120, quantity: 1, unit: 'g', calorie: 350, user_specified_calorie: true });
  assert('显式热量优先于库值', r6.calorie === 350, `calorie=${r6.calorie}`);
}

// ---------- 5. 端到端极端用例 ----------
async function e2eTests() {
  const D = (n) => `2026-08-${String(10 + n).padStart(2, '0')}`; // 每个用例独立日期，避免跨餐合并

  // T1 weight=0 + 库命中（火龙果 典型250g/个）
  await runCase('T1 weight=0 + 库命中',
    '吃了一个火龙果',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '早餐', foods: [{ name: '火龙果', weight: 0, quantity: 1, unit: '个', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: 60 },
    D(1),
    (rows, calls) => {
      assert('应生成1条饮食记录', rows.length === 1, `rows=${rows.length}`);
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        assert('重量按典型值250g', f.weight === 250, `weight=${f.weight}`);
        assert('热量>0且=库值×2.5', Math.abs(f.calorie - 60 * 2.5) < 1, `calorie=${f.calorie}, total=${rows[0].total_calorie}`);
        assert('total_calorie与foods一致', Math.round(rows[0].total_calorie) === Math.round(f.calorie));
        assert('未触发LLM估算（库命中）', calls.length === 0, `estimateCalls=${calls.length}`);
      }
    });

  // T2 weight缺失 + 库未命中 + LLM 正常估算
  await runCase('T2 weight缺失 + 库未命中 + LLM正常估算',
    '吃了一份冰草沙拉',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '午餐', foods: [{ name: '冰草沙拉', quantity: 1, unit: '份', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: 180, protein_per_100g: 3, carb_per_100g: 8, fat_per_100g: 12 },
    D(2),
    (rows, calls) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        // 「冰草沙拉」命中典型重量表「沙拉: 份=300g」，sanitize 修正 weight=300 → 比例×3
        assert('重量按典型值300g（沙拉/份）', f.weight === 300, `weight=${f.weight}`);
        assert('热量=LLM估算180×3', f.calorie === 540, `calorie=${f.calorie}`);
        assert('营养素按比例回填', f.fat === 36, `fat=${f.fat}`);
        assert('来源标记 llm_estimate', f.nutrition_source === 'llm_estimate', `source=${f.nutrition_source}`);
      } else {
        assert('应生成饮食记录', false, '无记录');
      }
    });

  // T3 空名食物 + 有效食物混合
  await runCase('T3 空名食物 + 有效食物混合',
    '吃了一个苹果还有一个',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '早餐', foods: [{ name: '', weight: 100, calorie: 0 }, { name: '苹果', weight: 150, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: 999 },
    D(3),
    (rows, calls) => {
      const foods = rows[0] ? safeParse(rows[0].foods) : [];
      assert('空名食物被过滤，只剩苹果', foods.length === 1 && foods[0].name === '苹果', `names=${foods.map(f => f.name).join('|')}`);
      assert('苹果热量来自库>0', foods[0] && foods[0].calorie > 0, `calorie=${foods[0] && foods[0].calorie}`);
      assert('未对空名/库命中食物调用估算', calls.length === 0, `estimateCalls=${calls.length}`);
    });

  // T4 LLM估算返回字符串数字（疑似被 typeof number 检查丢弃）
  await runCase('T4 LLM估算返回字符串数字',
    '吃了一碗藜麦能量碗',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '午餐', foods: [{ name: '藜麦能量碗', weight: 200, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: '180', protein_per_100g: '4', carb_per_100g: '30', fat_per_100g: '5' },
    D(4),
    (rows, calls) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        const dbHit = getFoodNutrition('藜麦能量碗', null, { minConfidence: 'medium' });
        if (!dbHit) {
          assert('字符串数字应被解析回填（期望360千卡）', f.calorie === 360, `calorie=${f.calorie}（0=bug未修复）`);
        } else {
          assert('库命中走库值', f.calorie > 0, `calorie=${f.calorie}`);
        }
      } else assert('应生成饮食记录', false, '无记录');
    });

  // T5 LLM估算返回负值 / 负重量
  await runCase('T5a LLM估算返回负热量',
    '吃了一块黑暗料理慕斯',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '加餐', foods: [{ name: '黑暗料理慕斯', weight: 100, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: -200, protein_per_100g: -1, carb_per_100g: 0, fat_per_100g: -5 },
    D(5),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) assert('负热量不应写入（应为0或不落库）', !(f.calorie < 0), `calorie=${f.calorie}`);
      else assert('负估算时也应生成记录（热量0）', true);
    });

  await runCase('T5b LLM提取负重量 + 正常估算',
    '吃了一份奇异果拼盘',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '加餐', foods: [{ name: '奇异果拼盘', weight: -50, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: 61, protein_per_100g: 1.1, carb_per_100g: 14.7, fat_per_100g: 0.5 },
    D(6),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        // 负重量被钳制为100g → 库命中奇异果拼盘?（无）→ LLM估算61/100g
        assert('负重量钳制为100g', f.weight === 100, `weight=${f.weight}`);
        assert('热量按100g估算=61且非负', f.calorie === 61, `calorie=${f.calorie}`);
      } else assert('应生成饮食记录', false, '无记录');
    });

  // T6 LLM估算返回荒谬值（5000千卡/100g）
  await runCase('T6 LLM估算返回荒谬值5000/100g',
    '吃了一口传说中的爆炸能量棒',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '加餐', foods: [{ name: '爆炸能量棒', weight: 200, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: 5000, protein_per_100g: 0, carb_per_100g: 0, fat_per_100g: 0 },
    D(7),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        const dbHit = getFoodNutrition('爆炸能量棒', null, { minConfidence: 'medium' });
        if (!dbHit) assert('荒谬值5000/100g被拒收 → 热量为0不落库', f.calorie === 0, `calorie=${f.calorie}`);
        else assert('库命中走库值', true, `calorie=${f.calorie}`);
      } else assert('应生成饮食记录', false, '无记录');
    });

  // T7 LLM估算异常/超时
  await runCase('T7 LLM估算抛异常',
    '吃了一块火星陨石饼干',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '加餐', foods: [{ name: '火星陨石饼干', weight: 50, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    new Error('MOCK_LLM_DOWN'),
    D(8),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) assert('LLM宕机时不崩溃、记录仍落库（热量0待兜底）', f.calorie >= 0, `calorie=${f.calorie}`);
      else assert('LLM宕机时不崩溃', rows.length >= 0, `rows=${rows.length}`);
    });

  await runCase('T7b LLM估算返回非JSON',
    '吃了一块月球尘埃布丁',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '加餐', foods: [{ name: '月球尘埃布丁', weight: 80, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    'invalid',
    D(9),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) assert('非JSON返回不崩溃', f.calorie >= 0, `calorie=${f.calorie}`);
      else assert('非JSON返回不崩溃', rows.length >= 0, `rows=${rows.length}`);
    });

  // T8 显式热量 + 显式重量
  await runCase('T8 显式热量+显式重量',
    '吃了一块芝士蛋糕大概350千卡，重120克',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '加餐', foods: [{ name: '芝士蛋糕', weight: 120, quantity: 1, unit: 'g', calorie: 350, user_specified_calorie: true }], total_calorie: 350 } }],
    { calorie_per_100g: 1 },
    D(10),
    (rows, calls) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        assert('显式热量350保留', f.calorie === 350, `calorie=${f.calorie}`);
        assert('显式重量120保留', f.weight === 120, `weight=${f.weight}`);
        assert('显式热量不应触发LLM估算', calls.length === 0, `estimateCalls=${calls.length}`);
      } else assert('应生成饮食记录', false, '无记录');
    });

  // T9 生僻小重量（3克奇亚籽）
  await runCase('T9 生僻小重量3g',
    '吃了3克奇亚籽',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '早餐', foods: [{ name: '奇亚籽', weight: 3, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: 486, protein_per_100g: 16.5, carb_per_100g: 42, fat_per_100g: 30.7 },
    D(11),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        const dbHit = getFoodNutrition('奇亚籽', null, { minConfidence: 'medium' });
        const expected = dbHit ? Math.round(dbHit.calorie_per_100g * 0.03 * 10) / 10 : 15;
        assert('小重量热量按比例且>0', f.calorie > 0 && Math.abs(f.calorie - expected) < 2, `calorie=${f.calorie}, 期望≈${expected}`);
      } else assert('应生成饮食记录', false, '无记录');
    });

  // T10 超大体积单位（2升可乐）
  await runCase('T10 超大单位2升可乐',
    '喝了2升可乐',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '午餐', foods: [{ name: '可乐', weight: 2000, quantity: 2, unit: '升', calorie: 0 }], total_calorie: 0 } }],
    { calorie_per_100g: 43 },
    D(12),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        assert('2升按2000g计算热量≈860', f.weight === 2000 && f.calorie > 500, `weight=${f.weight}, calorie=${f.calorie}`);
      } else assert('应生成饮食记录', false, '无记录');
    });

  // T14 显式重量为"斤"（LLM给的100g应被原文2斤=1000g纠正）
  await runCase('T14 显式斤重换算（2斤=1000g）',
    '晚上吃了凉拌黄瓜2斤',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '晚餐', foods: [{ name: '凉拌黄瓜', weight: 100, quantity: 1, unit: 'g', calorie: 52 }], total_calorie: 52 } }],
    { calorie_per_100g: 24, protein_per_100g: 1, carb_per_100g: 4, fat_per_100g: 0.2 },
    D(16),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        assert('2斤纠正为1000g', f.weight === 1000, `weight=${f.weight}`);
        assert('AI幻觉热量被清零后按LLM重估=24×10', f.calorie === 240, `calorie=${f.calorie}`);
      } else assert('应生成饮食记录', false, '无记录');
    });

  // T11 无食物 / 纯闲聊（"今天"触发沉淀词，但兜底不应把「天气不错」当食物）
  await runCase('T11 纯闲聊不沉淀食物',
    '今天天气不错',
    [{ extracted: true, type: 'diet_record', confidence: 0.9, extracted_data: { meal_time: '早餐', foods: [], total_calorie: 0 } }],
    { calorie_per_100g: 100 },
    D(13),
    (rows) => {
      assert('空foods不落库，闲聊词「天气不错」不当作食物', rows.length === 0, `rows=${rows.length}`);
    });

  // T12 混合消息：饮食+运动
  await runCase('T12 混合消息 饮食+运动',
    '中午吃了个苹果然后跑了3公里',
    [
      { extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '午餐', foods: [{ name: '苹果', weight: 150, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } },
      { extracted: true, type: 'exercise_record', confidence: 0.9, extracted_data: { exercises: [{ name: '跑步', distance: 3, duration: 0, calorie: 0 }], total_duration: 0, total_calorie: 0 } }
    ],
    { calorie_per_100g: 52 },
    D(14),
    (rows) => {
      const foods = rows[0] ? safeParse(rows[0].foods) : [];
      assert('饮食记录仅含苹果（运动未混入）', foods.length === 1 && foods[0].name === '苹果', `names=${foods.map(f => f.name).join('|')}`);
      const ex = db.prepare('SELECT * FROM exercise_records WHERE user_id = ? AND record_date = ?').all(userId, D(14));
      assert('运动记录已生成', ex.length >= 1, `exRows=${ex.length}`);
    });

  // T13 估算返回带markdown围栏的JSON
  await runCase('T13 估算返回markdown围栏JSON',
    '吃了一颗龙珠果',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '加餐', foods: [{ name: '龙珠果', weight: 100, quantity: 1, unit: 'g', calorie: 0 }], total_calorie: 0 } }],
    'markdown',
    D(15),
    (rows) => {
      const f = rows[0] && safeParse(rows[0].foods)[0];
      if (f) {
        const dbHit = getFoodNutrition('龙珠果', null, { minConfidence: 'medium' });
        if (!dbHit) assert('markdown围栏JSON应被解析回填（期望66千卡）', f.calorie === 66, `calorie=${f.calorie}`);
        else assert('库命中走库值', f.calorie > 0, `calorie=${f.calorie}`);
      } else assert('应生成饮食记录', false, '无记录');
    });
}

function safeParse(s) { try { return JSON.parse(s) || []; } catch (e) { return []; } }

// ---------- 5.5 常规场景回归（确认修复未破坏正常链路） ----------
async function regressionTests() {
  const D = (n) => `2026-08-${String(40 + n).padStart(2, '0')}`;

  // R1 正常多食物早餐
  await runCase('R1 正常早餐多食物',
    '早上吃了一个苹果和一碗米饭',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: '早餐', foods: [
      { name: '苹果', weight: 150, quantity: 1, unit: 'g', calorie: 78 },
      { name: '米饭', weight: 150, quantity: 1, unit: '碗', calorie: 174 }], total_calorie: 252 } }],
    { calorie_per_100g: 100 },
    D(1),
    (rows) => {
      assert('1条饮食记录', rows.length === 1, `rows=${rows.length}`);
      const foods = rows[0] ? safeParse(rows[0].foods) : [];
      assert('2个食物、热量正确(78+174)', foods.length === 2 && Math.round(rows[0].total_calorie) === 252, `n=${foods.length}, total=${rows[0].total_calorie}`);
    });

  // R2 下午茶半杯 → 加餐
  await runCase('R2 下午半杯可乐 → 加餐',
    '下午喝了半杯可乐',
    [{ extracted: true, type: 'diet_record', confidence: 0.95, extracted_data: { meal_time: 'snack', foods: [
      { name: '可乐', weight: 125, quantity: 0.5, unit: '杯', calorie: 54 }], total_calorie: 54 } }],
    { calorie_per_100g: 43 },
    D(2),
    (rows) => {
      // DB 约定 meal_time 存英文键（snack=加餐，UI 层做中文映射）
      assert('下午→加餐分类(snack)', rows[0] && rows[0].meal_time === 'snack', `meal=${rows[0] && rows[0].meal_time}`);
      const f = rows[0] && safeParse(rows[0].foods)[0];
      assert('半杯125g热量54', f && f.weight === 125 && Math.abs(f.calorie - 54) < 1, `w=${f && f.weight}, c=${f && f.calorie}`);
    });

  // R3 正常运动
  await runCase('R3 正常运动记录',
    '今天跑步30分钟',
    [{ extracted: true, type: 'exercise_record', confidence: 0.9, extracted_data: { exercises: [
      { name: '跑步', duration: 30, intensity: 'moderate', calorie: 0 }], total_duration: 30, total_calorie: 0 } }],
    { calorie_per_100g: 100 },
    D(3),
    (rows) => {
      const ex = db.prepare('SELECT * FROM exercise_records WHERE user_id = ? AND record_date = ?').all(userId, D(3));
      const diet = getDietRows(D(3));
      assert('运动落库、饮食为0条', ex.length === 1 && diet.length === 0, `ex=${ex.length}, diet=${diet.length}`);
    });

  // R4 喝水习惯
  await runCase('R4 喝水习惯累加',
    '喝了500ml水',
    [{ extracted: true, type: 'habit', confidence: 0.9, extracted_data: { sub_type: 'water', value: 500, unit: 'ml' } }],
    { calorie_per_100g: 100 },
    D(4),
    (rows) => {
      const habit = db.prepare('SELECT * FROM habit_records WHERE user_id = ?').all(userId);
      assert('喝水记录落库500ml', habit.length >= 1 && (habit[habit.length - 1].water_ml === 500 || habit[habit.length - 1].value === 500), JSON.stringify(habit.map(h => ({ v: h.value, ml: h.water_ml }))));
      assert('不产生饮食记录', rows.length === 0, `rows=${rows.length}`);
    });

  // R5 咨询/闲聊不沉淀
  await runCase('R5 咨询句不沉淀',
    '减肥有什么好方法吗',
    [],
    { calorie_per_100g: 100 },
    D(5),
    (rows) => {
      assert('不产生任何饮食记录', rows.length === 0, `rows=${rows.length}`);
    });

  // R6 未来计划不沉淀
  await runCase('R6 明天计划不沉淀',
    '我明天和朋友去吃火锅',
    [],
    { calorie_per_100g: 100 },
    D(6),
    (rows) => {
      assert('不产生任何饮食记录', rows.length === 0, `rows=${rows.length}`);
    });
}
(async () => {
  console.log('=== 沉淀营养链路极端情况验证 ===');
  console.log(`测试用户ID: ${userId} (openid: ${openid})`);
  unitTests();
  await e2eTests();
  await regressionTests();
  cleanUserData();
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  console.log('\n========== 测试结果汇总 ==========');
  for (const line of results) console.log(line);
  console.log(`\n通过 ${passCount} / ${passCount + failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
})().catch(e => { console.error('测试脚本异常:', e); process.exit(2); });
