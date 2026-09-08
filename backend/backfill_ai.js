/**
 * 豆包批量回填 legacy 条目缺失的营养素（蛋白/碳水/脂肪）
 * 条件: source='legacy' AND calories>0 AND 三大营养素全0（真0卡食物已排除）
 * 校验: AI 值范围 0-100 且 热量守恒偏差≤50% 才写入；remark 标注"营养素由AI估算回填"
 * 用法: NODE_ENV=production node backfill_ai.js [--limit N] [--dry]
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');
db.pragma('journal_mode = WAL');
const DRY = process.argv.includes('--dry');
const LIMIT = parseInt(process.argv[process.argv.indexOf('--limit') + 1]) || 9999;

/* 读豆包配置（id=6 豆包-Helper） */
const cfg = db.prepare("SELECT * FROM ai_configs WHERE id = 6").get();
if (!cfg) { console.error('❌ 找不到 id=6 AI 配置'); process.exit(1); }
const API_URL = `${cfg.base_url.replace(/\/$/, '')}/chat/completions`;
console.log(`模型: ${cfg.name} @ ${cfg.endpoint_id}`);

/* 待回填条目 */
const targets = db.prepare(`
  SELECT id, food_name, category, calories_per_100g as cal
  FROM food_db
  WHERE source = 'legacy' AND calories_per_100g > 0
    AND protein_per_100g = 0 AND carb_per_100g = 0 AND fat_per_100g = 0
  LIMIT ?
`).all(LIMIT);
console.log(`待回填: ${targets.length} 条`);
if (!targets.length) process.exit(0);

/* 热量守恒校验：蛋白×4 + 碳水×4 + 脂肪×9 与标称热量偏差 ≤ 50% */
function valid(p, c, f, cal) {
  if (!Number.isFinite(p) || !Number.isFinite(c) || !Number.isFinite(f)) return false;
  if (p < 0 || p > 100 || c < 0 || c > 100 || f < 0 || f > 100) return false;
  if (p === 0 && c === 0 && f === 0) return false; // AI 还是返回全0 → 无效
  const derived = p * 4 + c * 4 + f * 9;
  if (derived < 1) return false;
  return Math.abs(derived - cal) / Math.max(cal, derived) <= 0.5;
}

async function callBatch(batch, retry = 0) {
  const list = batch.map(t => `${t.id}|${t.food_name}|${t.cal}kcal`).join('\n');
  const body = {
    model: cfg.endpoint_id,
    messages: [
      { role: 'system', content: '你是营养数据库专家。根据食物名称和中国食物营养成分，输出每100克该食物的蛋白质/碳水化合物/脂肪克数。只输出JSON数组，格式: [{"id":数字,"protein":数字,"carb":数字,"fat":数字}]，不要任何其他文字。数值基于通用营养学常识（参考中国食物成分表），熟制菜品按常见做法估算。' },
      { role: 'user', content: `请给出以下食物每100克的营养素（id|名称|标称热量）:\n${list}` }
    ],
    temperature: 0.1,
    max_tokens: 2000
  };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
  const arr = JSON.parse(text);
  return arr;
}

async function main() {
  const BATCH = 20, CONCURRENCY = 4;
  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));

  const upd = db.prepare(`UPDATE food_db SET protein_per_100g=?, carb_per_100g=?, fat_per_100g=?,
    remark = CASE WHEN remark IS NULL OR remark = '' THEN '营养素由AI估算回填' ELSE remark || ' | 营养素由AI估算回填' END
    WHERE id=?`);

  let done = 0, ok = 0, fail = 0;
  const failList = [];
  const idx = { v: 0 };

  async function worker() {
    while (idx.v < batches.length) {
      const bi = idx.v++;
      const batch = batches[bi];
      try {
        const arr = await callBatch(batch);
        for (const item of arr) {
          const t = targets.find(x => x.id === item.id);
          if (!t) continue;
          if (valid(item.protein, item.carb, item.fat, t.cal)) {
            if (!DRY) upd.run(item.protein, item.carb, item.fat, t.id);
            ok++;
          } else {
            fail++; failList.push(`${t.food_name}(守恒校验失败)`);
          }
        }
      } catch (e) {
        if (retry < 2) { idx.v = bi; await new Promise(r => setTimeout(r, 2000)); return worker(); }
        fail += batch.length; failList.push(`批次${bi}: ${e.message.slice(0, 60)}`);
      }
      done += batch.length;
      console.log(`进度 ${done}/${targets.length} | 成功 ${ok} | 失败 ${fail}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n===== 回填完成${DRY ? '(DRY)' : ''} =====`);
  console.log(`成功: ${ok} | 失败: ${fail}`);
  if (failList.length) failList.slice(0, 10).forEach(f => console.log('  ❌', f));
}

main();
