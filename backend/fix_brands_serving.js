/**
 * 修复 cn-brands + legacy "每份热量" 误存为 "每100g热量" 的问题
 * 1. 规格含克重（ml/g）→ 程序换算 per-100g；营养素残缺的进豆包补全队列
 * 2. 无克重 → 豆包生成每100g四元组（输入含每份热量参考）
 * 3. 守恒校验（酒类放宽）→ 事务入库
 * 用法: NODE_ENV=production node fix_brands_serving.js [--dry]
 */
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');
db.pragma('journal_mode = WAL');
const DRY = process.argv.includes('--dry');

/* ---------- 待修复条目：全部 cn-brands + legacy 每份语义条目 ---------- */
const LEGACY_IDS = [338, 340, 342, 343, 345, 347, 348, 428, 429, 430, 431, 432, 437, 438, 439, 154];
const items = db.prepare(`SELECT id, food_name, common_unit, calories_per_100g cal,
  protein_per_100g p, carb_per_100g c, fat_per_100g f FROM food_db WHERE source = 'cn-brands'`).all();
for (const id of LEGACY_IDS) {
  const r = db.prepare('SELECT id, food_name, common_unit, calories_per_100g cal, protein_per_100g p, carb_per_100g c, fat_per_100g f FROM food_db WHERE id = ?').get(id);
  if (r) items.push(r);
}
console.log(`待处理: ${items.length} 条`);

const isAlcohol = (n, spec) => /酒|啤酒|白啤|预调酒/.test(n) || /度\)|%/.test(spec || '');

/* ---------- 解析规格中的克重 ---------- */
function parseServingGram(spec) {
  const m = String(spec || '').match(/(\d+(?:\.\d+)?)\s*(ml|毫升|g|克)/i);
  return m ? parseFloat(m[1]) : null;
}

/* ---------- 守恒校验（酒类放宽） ---------- */
function valid(item, alcohol) {
  const { calorie, protein, carb, fat } = item;
  if (![calorie, protein, carb, fat].every(Number.isFinite)) return false;
  if (calorie < 0 || calorie > 900 || protein < 0 || protein > 100 || carb < 0 || carb > 100 || fat < 0 || fat > 100) return false;
  if (alcohol) return true; // 酒类热量主要来自酒精，不适用 P4C4F9 模型
  const derived = protein * 4 + carb * 4 + fat * 9;
  if (calorie > 5 && derived < 1) return false;
  if (calorie > 5 && Math.abs(derived - calorie) / Math.max(calorie, derived) > 0.35) return false;
  return true;
}

/* ---------- 读豆包配置 ---------- */
const cfg = db.prepare('SELECT * FROM ai_configs WHERE id = 6').get();
const API_URL = `${cfg.base_url.replace(/\/$/, '')}/chat/completions`;

async function callGen(batch) {
  const body = {
    model: cfg.endpoint_id,
    messages: [
      { role: 'system', content: '你是中国食品营养数据库专家。输入是"名称|每份热量kcal|规格"。请把每份热量按规格换算成每100克（液体每100毫升）的热量，并补全蛋白质、碳水、脂肪（每100g）。规格无量词时按市售常见单份规格估算。无糖茶/无糖饮料热量可接近0但碳水不为0时以实际为准。酒类正常给出（热量来自酒精，三大营养素可低）。只输出JSON数组：[{"name":"原名","calorie":数字,"protein":数字,"carb":数字,"fat":数字}]，无其他文字。' },
      { role: 'user', content: batch.map(b => `${b.name}|每份${b.ref_cal}kcal|${b.spec || '市售常见规格'}`).join('\n') }
    ],
    temperature: 0.1, max_tokens: 3000
  };
  const res = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = (await res.json()).choices[0].message.content.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

async function main() {
  /* ---------- 步骤A: 有克重的程序换算 ---------- */
  const aiQueue = [];   // 豆包补全队列
  const directFix = []; // 程序换算+已有营养素即可
  for (const it of items) {
    const alcohol = isAlcohol(it.food_name, it.common_unit);
    const g = parseServingGram(it.common_unit);
    if (g && g >= 20) {
      const ratio = 100 / g;
      const conv = {
        id: it.id, name: it.food_name, alcohol,
        calorie: Math.round(it.cal * ratio * 10) / 10,
        protein: Math.round(it.p * ratio * 10) / 10,
        carb: Math.round(it.c * ratio * 10) / 10,
        fat: Math.round(it.f * ratio * 10) / 10,
        ref_cal: it.cal, spec: it.common_unit
      };
      if (valid(conv, alcohol) && (conv.protein > 0 || conv.carb > 0 || conv.fat > 0)) {
        directFix.push(conv);
      } else {
        aiQueue.push({ ...conv, hint_cal: conv.calorie }); // 换算后仍残缺/不守恒 → AI补
      }
    } else {
      aiQueue.push({ id: it.id, name: it.food_name, alcohol, ref_cal: it.cal, spec: it.common_unit });
    }
  }
  console.log(`程序换算可修复: ${directFix.length} | 需AI补全: ${aiQueue.length}`);

  /* ---------- 步骤B: 豆包批量补全 ---------- */
  const BATCH = 30, aiFixed = [], aiFail = [];
  for (let i = 0; i < aiQueue.length; i += BATCH) {
    const slice = aiQueue.slice(i, i + BATCH);
    try {
      const arr = await callGen(slice);
      for (const b of slice) {
        const got = arr.find(x => x.name === b.name || b.name.includes(x.name) || x.name.includes(b.name));
        if (!got) { aiFail.push(b.name + '(未生成)'); continue; }
        const item = { id: b.id, name: b.name, calorie: got.calorie, protein: got.protein, carb: got.carb, fat: got.fat, alcohol: b.alcohol };
        if (valid(item, b.alcohol)) aiFixed.push(item);
        else aiFail.push(b.name + `(守恒失败: ${JSON.stringify(item)})`);
      }
      console.log(`AI进度 ${Math.min(i + BATCH, aiQueue.length)}/${aiQueue.length}`);
    } catch (e) {
      console.error('批次失败重试:', e.message);
      i -= BATCH; await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log(`AI补全成功: ${aiFixed.length} | 失败: ${aiFail.length}`);
  aiFail.forEach(f => console.log('  ❌', f));

  /* ---------- 步骤C: 入库 ---------- */
  const all = [...directFix, ...aiFixed];
  if (!DRY && all.length) {
    const upd = db.prepare(`UPDATE food_db SET calories_per_100g = ?, protein_per_100g = ?, carb_per_100g = ?, fat_per_100g = ?,
      remark = remark || ? WHERE id = ?`);
    const tx = db.transaction((list) => {
      for (const it of list) upd.run(it.calorie, it.protein, it.carb, it.fat, ` | 每份→每100g换算修正(${it.spec || ''})`, it.id);
    });
    tx(all);
    console.log(`✅ 已修正 ${all.length} 条`);
  }
  fs.writeFileSync('brands_fix_result.json', JSON.stringify(all, null, 1));
  console.log('结果已存 brands_fix_result.json');
}
main();
