/**
 * 数据准确性校验圈：
 * 1. 权威值抽样对照 —— 20个有公认营养值的食物，对比生成值偏差
 * 2. 两轮独立生成对比 —— temperature 0.3 重新生成，对比 round1 一致性
 * 用法: NODE_ENV=production node verify_accuracy.js
 */
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db', { readonly: true });
const cfg = db.prepare("SELECT * FROM ai_configs WHERE id = 6").get();
const API_URL = `${cfg.base_url.replace(/\/$/, '')}/chat/completions`;

/* ---------- 1. 权威值对照（营养学公认值，来源：中国食物成分表/品牌官方标注） ---------- */
const GOLDEN = [
  { name: '披萨', cal: 266, p: 11, c: 33, f: 10 },        // 芝士披萨均值
  { name: '汉堡', cal: 295, p: 17, c: 24, f: 14 },        // 通用牛肉汉堡
  { name: '薯条', cal: 312, p: 3.4, c: 41, f: 15 },       // 炸薯条
  { name: '寿司', cal: 143, p: 6, c: 26, f: 1.5 },        // 寿司卷均值
  { name: '月饼', cal: 416, p: 7, c: 55, f: 18 },         // 广式月饼
  { name: '粽子', cal: 195, p: 5, c: 35, f: 4 },          // 鲜肉粽
  { name: '方便面', cal: 472, p: 9.5, c: 60, f: 21 },     // 油炸方便面面饼
  { name: '辣条', cal: 350, p: 8, c: 55, f: 10 },         // 调味面制品
  { name: '奥利奥', cal: 480, p: 5, c: 71, f: 20 },       // 夹心饼干
  { name: '士力架', cal: 484, p: 8, c: 61, f: 24 },       // 花生夹心巧克力
  { name: '羊肉串', cal: 215, p: 18, c: 1, f: 15 },       // 烤羊肉串
  { name: '小龙虾', cal: 93, p: 14.8, c: 0, f: 3.8 },     // 麻辣小龙虾肉
  { name: '肥牛卷', cal: 265, p: 16, c: 1, f: 22 },       // 肥牛肉
  { name: '蛋挞', cal: 320, p: 6, c: 30, f: 19 },         // 葡式蛋挞
  { name: '石锅拌饭', cal: 160, p: 6, c: 22, f: 5 },      // 韩式拌饭均值
  { name: '韩式炸鸡', cal: 260, p: 15, c: 14, f: 16 },    // 甜辣炸鸡
  { name: '麻辣烫', cal: 120, p: 6, c: 10, f: 6 },        // 麻辣烫(混合)
  { name: '牛排', cal: 271, p: 22, c: 0, f: 20 },         // 煎牛排
  { name: '酸奶饮品', cal: 70, p: 2.5, c: 12, f: 1.3 },   // 乳酸菌饮料
  { name: '王老吉', cal: 43, p: 0, c: 11, f: 0 }          // 凉茶
];

async function callGen(names, temp) {
  const body = {
    model: cfg.endpoint_id,
    messages: [
      { role: 'system', content: '你是中国食品营养数据库专家。对每个食物给出每100克的：热量kcal、蛋白质g、碳水g、脂肪g。只输出JSON数组：[{"name":"原名","calorie":数字,"protein":数字,"carb":数字,"fat":数字}]，无其他文字。' },
      { role: 'user', content: names.join('\n') }
    ],
    temperature: temp, max_tokens: 2000
  };
  const res = await fetch(API_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.api_key}` },
    body: JSON.stringify(body)
  });
  const text = (await res.json()).choices[0].message.content.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

async function main() {
  /* ===== 圈1: 权威值对照 ===== */
  console.log('===== 校验圈1: 权威值抽样对照（20个公认值） =====');
  const r1 = await callGen(GOLDEN.map(g => g.name), 0.1);
  let goldPass = 0;
  const goldReport = [];
  for (const g of GOLDEN) {
    const got = r1.find(x => x.name === g.name || g.name.includes(x.name) || x.name.includes(g.name));
    if (!got) { goldReport.push(`⚠️ ${g.name}: 未生成`); continue; }
    const calDev = Math.abs(got.calorie - g.cal) / g.cal * 100;
    const pDev = g.p > 0 ? Math.abs(got.protein - g.p) / g.p * 100 : 0;
    const pass = calDev <= 30 && pDev <= 50;
    if (pass) goldPass++;
    goldReport.push(`${pass ? '✅' : '❌'} ${g.name}: 生成${got.calorie} vs 权威${g.cal}kcal (偏差${calDev.toFixed(0)}%) P:${got.protein}/${g.p}`);
  }
  goldReport.forEach(r => console.log(r));
  console.log(`圈1 结果: ${goldPass}/${GOLDEN.length} 通过 (阈值: 热量偏差≤30%, 蛋白偏差≤50%)`);

  /* ===== 圈2: 两轮独立生成一致性（分批防截断） ===== */
  console.log('\n===== 校验圈2: 两轮独立生成对比（temperature 0.1 vs 0.3） =====');
  const round1 = JSON.parse(fs.readFileSync('gen_round1.json', 'utf-8'));
  const names = round1.map(x => x.name);
  const r2 = [];
  const SUB = 30;
  for (let i = 0; i < names.length; i += SUB) {
    const slice = names.slice(i, i + SUB);
    r2.push(...await callGen(slice, 0.3));
  }
  let consistent = 0, checked = 0;
  const inconsistent = [];
  for (const a of round1) {
    const b = r2.find(x => x.name === a.name);
    if (!b) continue;
    checked++;
    const dev = Math.abs(b.calorie - a.calorie) / Math.max(a.calorie, 1) * 100;
    if (dev <= 20) consistent++;
    else inconsistent.push(`⚠️ ${a.name}: 轮1=${a.calorie} 轮2=${b.calorie} (差${dev.toFixed(0)}%)`);
  }
  console.log(`两轮一致(热量差≤20%): ${consistent}/${checked}`);
  inconsistent.forEach(r => console.log(r));

  console.log('\n===== 校验总结 =====');
  console.log(`权威对照: ${goldPass}/${GOLDEN.length}`);
  console.log(`两轮一致: ${consistent}/${checked}`);
}
main();
