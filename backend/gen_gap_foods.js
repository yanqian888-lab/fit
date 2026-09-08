/**
 * 豆包生成缺口食物营养数据 → 守恒校验入库（source='ai-est'）
 * 用法: NODE_ENV=production node gen_gap_foods.js [--dry]
 */
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');
db.pragma('journal_mode = WAL');
const DRY = process.argv.includes('--dry');

/* ---------- 缺口词表（覆盖度测试未命中 + 高频补充） ---------- */
const GAP_WORDS = [
  // 日料韩料西餐
  '寿司', '刺身', '三文鱼刺身', '天妇罗', '章鱼小丸子', '韩式炸鸡', '石锅拌饭', '部队火锅', '日式拉面', '鳗鱼饭', '咖喱饭', '猪排饭', '牛排', '意大利面', '披萨', '汉堡', '薯条', '炸鸡', '三明治', '沙拉',
  // 火锅烧烤
  '肥牛卷', '羊肉卷', '虾滑', '鱼豆腐', '午餐肉', '毛肚', '鸭肠', '鸭脖', '卤味', '羊肉串', '烤鱼', '烤串', '烤鸡翅', '锡纸花甲粉', '小龙虾',
  // 家常菜补充
  '水煮鱼', '酸菜鱼', '剁椒鱼头', '梅菜扣肉', '叉烧', '白切鸡', '烤鸭', '盐水鸭', '辣子鸡', '大盘鸡', '锅包肉', '地三鲜', '干煸豆角', '鱼香茄子', '清蒸鲈鱼', '糖醋排骨', '可乐鸡翅',
  // 外卖小吃
  '麻辣烫', '兰州拉面', '黄焖鸡米饭', '重庆小面', '热干面', '肠粉', '云吞面', '烧腊饭', '隆江猪脚饭', '扬州炒饭', '盖浇饭', '咖喱牛肉饭', '烤冷面', '铁板鱿鱼',
  // 包装零食
  '奥利奥', '士力架', '旺旺雪饼', '辣条', '薯片', '牛肉干', '猪肉脯', '芒果干', '话梅', '山楂片', '海苔', '果冻', '每日坚果', '夹心饼干', '苏打饼干', '威化饼干', '蛋黄派', '小面包',
  // 方便速食
  '方便面', '自热火锅', '自热米饭', '速冻水饺', '速冻汤圆', '袋装螺蛳粉', '袋装酸辣粉',
  // 烘焙甜品
  '月饼', '粽子', '蛋挞', '泡芙', '慕斯蛋糕', '提拉米苏', '戚风蛋糕', '肉松小贝', '麻薯', '雪媚娘', '牛角包', '青团', '双皮奶', '杨枝甘露', '烧仙草', '龟苓膏', '冰糖葫芦',
  // 连锁品牌
  '华莱士汉堡', '塔斯汀汉堡', '正新鸡排', '绝味鸭脖', '周黑鸭', '海底捞火锅',
  // 饮品
  '元气森林', '六个核桃', '椰汁', '王老吉', '冰红茶', '柠檬茶', '乳酸菌饮料', '养乐多', '蜂蜜水', '椰子水',
  // 早餐其他
  '烧麦', '糍粑', '凉面', '凉皮', '煎饼', '手抓饼'
];

const CATEGORIES = ['主食类', '肉蛋奶类', '蔬菜水果类', '豆类坚果类', '零食饮料类', '调味油脂类', '中西菜肴类', '代餐特殊食品'];

/* ---------- 读豆包配置 ---------- */
const cfg = db.prepare("SELECT * FROM ai_configs WHERE id = 6").get();
const API_URL = `${cfg.base_url.replace(/\/$/, '')}/chat/completions`;

/* ---------- 过滤库中已有的 ---------- */
const all = db.prepare('SELECT food_name, aliases FROM food_db').all();
const nameSet = new Set(), aliasSet = new Set();
for (const f of all) {
  nameSet.add(f.food_name.replace(/\s/g, ''));
  if (f.aliases) { try { JSON.parse(f.aliases).forEach(a => aliasSet.add(a.replace(/\s/g, ''))); } catch (e) {} }
}
const toGen = GAP_WORDS.filter(w => !nameSet.has(w) && !aliasSet.has(w));
console.log(`词表 ${GAP_WORDS.length} 个，库中已有跳过 ${GAP_WORDS.length - toGen.length}，待生成 ${toGen.length}`);

/* ---------- 守恒/范围校验 ---------- */
function valid(item) {
  const { calorie, protein, carb, fat } = item;
  if (![calorie, protein, carb, fat].every(Number.isFinite)) return false;
  if (calorie < 0 || calorie > 900 || protein < 0 || protein > 100 || carb < 0 || carb > 100 || fat < 0 || fat > 100) return false;
  const derived = protein * 4 + carb * 4 + fat * 9;
  if (calorie > 5 && derived < 1) return false; // 0卡除外
  if (calorie > 5 && Math.abs(derived - calorie) / Math.max(calorie, derived) > 0.35) return false;
  return true;
}

async function callGen(batch, temp) {
  const body = {
    model: cfg.endpoint_id,
    messages: [
      { role: 'system', content: `你是中国食品营养数据库专家。对每个食物给出每100克（液体每100毫升）的：热量kcal、蛋白质g、碳水g、脂肪g，以及从[${CATEGORIES.join('/')}]中选一个最合适分类。熟制菜品按常见做法、品牌食品按官方标注的通用值。只输出JSON数组：[{"name":"原名","calorie":数字,"protein":数字,"carb":数字,"fat":数字,"category":"分类"}]，无其他文字。` },
      { role: 'user', content: batch.join('\n') }
    ],
    temperature: temp, max_tokens: 3000
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
  const BATCH = 20, CONC = 4;
  const batches = [];
  for (let i = 0; i < toGen.length; i += BATCH) batches.push(toGen.slice(i, i + BATCH));
  const idx = { v: 0 };
  const okItems = [], failItems = [];

  async function worker() {
    while (idx.v < batches.length) {
      const batch = batches[idx.v++];
      try {
        const arr = await callGen(batch, 0.1);
        for (const it of arr) {
          const orig = batch.find(w => w === it.name || it.name.includes(w) || w.includes(it.name));
          if (!orig) continue;
          it.name = orig;
          if (valid(it)) okItems.push(it);
          else failItems.push(orig + '(守恒失败:' + JSON.stringify(it).slice(0, 60) + ')');
        }
      } catch (e) {
        idx.v--; await new Promise(r => setTimeout(r, 2000)); return worker(); // 重试该批
      }
      console.log(`生成进度 ${okItems.length + failItems.length}/${toGen.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  console.log(`\n生成完成: 有效 ${okItems.length} | 校验拒绝 ${failItems.length}`);
  failItems.forEach(f => console.log('  ❌', f));

  /* ---------- 入库 ---------- */
  if (!DRY && okItems.length) {
    const ins = db.prepare(`INSERT INTO food_db (food_id, category, sub_category, food_name, calories_per_100g, common_unit, edible_rate, remark,
      protein_per_100g, carb_per_100g, fat_per_100g, source, aliases, created_at)
      VALUES ((SELECT COALESCE(MAX(food_id),0)+1 FROM food_db), ?, '', ?, ?, '100g', 1, 'AI估算生成', ?, ?, ?, 'ai-est', ?, datetime('now'))`);
    const tx = db.transaction((items) => {
      for (const it of items) ins.run(it.category, it.name, it.calorie, it.protein, it.carb, it.fat, JSON.stringify([it.name]));
    });
    tx(okItems);
    console.log(`✅ 已入库 ${okItems.length} 条 (source=ai-est)`);
  }
  /* 保存第一轮结果供交叉校验 */
  fs.writeFileSync('gen_round1.json', JSON.stringify(okItems, null, 1));
  console.log('第一轮结果已存 gen_round1.json');
}
const fs = require('fs');
main();
