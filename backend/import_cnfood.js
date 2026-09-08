/**
 * 《中国食物成分表第6版》公开库导入 food_db（对比合并）
 * 规则：重叠 → 营养数据取公开库（source=cnfood6）；不重叠 → 新增；原有数据保留（source=legacy）
 * 别名：学名条目写入口语别名 JSON（如 牛乳→["牛奶","全脂牛奶"]），供查询链命中
 * 用法: NODE_ENV=production node import_cnfood.js [--dry]
 */
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('data/app_production.db');

const DRY = process.argv.includes('--dry');

/* ---------- 名称规范化：全角转半角、去空格 ---------- */
function normalizeName(s) {
  return (s || '')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\s+/g, '')
    .trim();
}

/* ---------- 学名 → 口语别名映射（学名保持为 food_name，口语进 aliases）---------- */
const LEARNED_TO_COLLOQUIAL = {
  '牛乳': ['牛奶', '全脂牛奶', '纯牛奶', '鲜牛奶'],
  '乳饼': ['奶饼'],
  '鸡胸脯肉': ['鸡胸肉', '鸡脯肉'],
  '鸡(整只)': ['整鸡', '全鸡', '鸡肉'],
  '马铃薯': ['土豆', '洋芋', '薯仔'],
  '甘薯(红心)': ['红薯', '地瓜', '山芋', '红苕'],
  '番茄': ['西红柿'],
  '卷心菜': ['包菜', '圆白菜', '结球甘蓝', '椰菜'],
  '菜花': ['花椰菜', '花菜'],
  '绿菜花': ['西兰花', '青花菜'],
  '大白菜': ['白菜'],
  '小白菜': ['青菜', '小青菜'],
  '辣椒(青)': ['青椒', '青柿子椒'],
  '粳米(标一)': ['大米', '粳米', '珍珠米'],
  '籼米(标一)': ['籼米', '南方大米'],
  '玉米(鲜)': ['甜玉米', '鲜玉米', '玉米棒'],
  '小米': ['粟米'],
  '燕麦片': ['燕麦', '麦片'],
  '荞麦': ['荞麦仁'],
  '黄豆(大豆)': ['大豆', '黄豆'],
  '花生仁(生)': ['花生米', '生花生', '花生仁'],
  '核桃(鲜)': ['核桃', '胡桃'],
  '橙': ['橙子', '甜橙', '脐橙'],
  '柑': ['橘子', '桔子', '柑橘'],
  '猕猴桃': ['奇异果'],
  '菠萝': ['凤梨'],
  '草莓': ['士多啤梨'],
  '樱桃': ['车厘子'],
  '葡萄': ['提子'],
  '苹果': ['苹果'],
  '猪肉(肥瘦)': ['猪肉', '肥瘦猪肉'],
  '猪肉(里脊)': ['里脊肉', '猪里脊'],
  '猪肉(瘦)': ['瘦肉', '猪里脊肉', '瘦猪肉'],
  '牛肉(瘦)': ['瘦牛肉', '牛肉'],
  '羊肉(瘦)': ['瘦羊肉', '羊肉'],
  '鸭胸脯肉': ['鸭胸肉'],
  '鹅': ['鹅肉'],
  '带鱼': ['刀鱼'],
  '黄花鱼': ['黄鱼'],
  '鲫鱼': ['喜头鱼'],
  '鲤鱼': ['鲤拐子'],
  '虾皮': ['虾米皮'],
  '对虾': ['大虾', '明虾'],
  '海虾': ['基围虾', '明虾'],
  '豆腐(北)': ['北豆腐', '老豆腐', '硬豆腐'],
  '豆腐(南)': ['南豆腐', '嫩豆腐'],
  '豆腐(内酯豆腐)': ['内酯豆腐'],
  '豆腐干': ['豆干', '白干'],
  '腐竹': ['腐皮', '豆筋'],
  '豆浆': ['豆奶'],
  '酸奶': ['酸牛奶'],
  '奶酪': ['芝士', '干酪', '起司'],
  '奶油': ['黄油', '牛油'],
  '小麦粉(标准粉)': ['面粉', '标准面粉'],
  '小麦粉(富强粉)': ['富强粉', '精面粉'],
  '挂面(标准粉)': ['挂面'],
  '馒头': ['白馒头', '蒸馍'],
  '油条': ['油炸烩'],
  '扁豆': ['芸豆', '四季豆', '菜豆'],
  '豇豆(长)': ['长豆角', '豆角'],
  '黄瓜(胡瓜)': ['青瓜', '胡瓜'],
  '冬瓜': ['东瓜'],
  '南瓜': ['倭瓜'],
  '丝瓜': ['胜瓜'],
  '苦瓜': ['凉瓜'],
  '茄子': ['茄瓜'],
  '胡萝卜(黄)': ['红萝卜', '黄萝卜'],
  '白萝卜': ['萝卜', '莱菔'],
  '莲藕': ['藕'],
  '蒜苗': ['青蒜'],
  '韭黄': ['韭菜黄'],
  '香菇(鲜)': ['冬菇', '鲜香菇'],
  '金针菇(鲜)': ['金菇'],
  '木耳(干)': ['黑木耳', '云耳'],
  '海带(鲜)': ['昆布'],
  '紫菜(干)': ['海苔'],
  '枸杞菜': ['枸杞叶'],
  '芒果': ['杧果'],
  '柿子': ['红柿'],
  '柚': ['柚子', '文旦'],
  '椰子': ['椰果'],
  '枣(鲜)': ['鲜枣', '青枣'],
  '枣(干)': ['红枣', '大枣', '干枣'],
  '葵花子(生)': ['葵花籽', '瓜子'],
  '西瓜子(炒)': ['西瓜子'],
  '白芝麻': ['芝麻', '白芝麻仁'],
  '鸡蛋(白皮)': ['鸡蛋', '白皮鸡蛋', '鸡卵'],
  '鸭蛋': ['鸭卵'],
  '鹌鹑蛋': ['鹌鹑卵'],
  '皮蛋': ['松花蛋', '变蛋'],
  '火腿肠': ['火腿'],
  '香肠': ['腊肠'],
  '腊肉': ['腌腊肉'],
  '方便面': ['泡面', '速食面', '公仔面'],
  '饼干': ['曲奇', '小饼干'],
  '蛋糕': ['西式蛋糕'],
  '面包': ['吐司', '白面包'],
  '巧克力': ['朱古力'],
  '冰激凌': ['冰淇淋', '雪糕'],
  '可乐': ['可口可乐', '百事可乐'],
  '啤酒': ['扎啤'],
  '白酒': ['烧酒'],
  '葡萄酒': ['红酒']
};

/* ---------- 成分表原始分类 → 现有8大类自动归类（按 foodmate 21类名关键词）---------- */
function guessCategory(name) {
  const n = normalizeName(name);
  // 肉蛋奶类：乳/奶/酪/蛋/畜肉/禽肉/水产
  if (/[乳奶酪]|牛奶|酸奶|奶油|黄油/.test(n)) return ['肉蛋奶类', '乳制品'];
  if (/蛋(?!白)|鸡蛋|鸭蛋|鹅蛋|鹌鹑|皮蛋/.test(n) && !/鸡蛋果|蛋羹/.test(n)) return ['肉蛋奶类', '蛋类'];
  if (/猪|牛(肉|排|尾|舌|肚|心|肝|腰|筋|蹄|鞭)|羊(肉|排|蝎)|驴|马肉|狗肉|兔|鹿|火腿|腊肉|香肠|叉烧/.test(n)) return ['肉蛋奶类', '畜肉'];
  if (/鸡(?!蛋|冠|精)|鸭(?!蛋)|鹅|鸽|火鸡|鹌鹑(?!蛋)/.test(n)) return ['肉蛋奶类', '禽肉'];
  if (/鱼|虾|蟹|贝|鲍|参(海参)|鱿|章鱼|螺|蛤|蛏|海蜇|鳗|鳝/.test(n)) return ['肉蛋奶类', '水产'];
  // 主食类：谷/米/面/粥/饭/馒头/面包/饼/粉条/薯
  if (/米(?!粉)|饭|粥|粉(丝|条)|面(条|包|粉|筋)|馒头|花卷|包子|饺子|馄饨|烙饼|烧饼|油条|麻花|面包|饼干|蛋糕|方便面|麦|高粱|大麦|莜麦|青稞|薏米|芡实/.test(n)) return ['主食类', '谷薯面点'];
  if (/薯|山药|芋|荸荠|菱角|藕(粉)?|葛粉|淀粉|粉丝/.test(n)) return ['主食类', '谷薯面点'];
  // 豆类坚果类
  if (/豆(腐|干|浆|芽|鼓|瓣酱)|黄豆|黑豆|绿豆|红豆|赤豆|蚕豆|豌豆|扁豆|豇豆|芸豆|鹰嘴豆|腐竹|腐乳|豆沙|纳豆|毛豆/.test(n)) return ['豆类坚果类', '豆制品'];
  if (/花生|核桃|杏仁|松子|腰果|开心果|榛子|栗|莲子|芝麻|瓜子|夏威夷果|碧根果|巴旦木|白果/.test(n)) return ['豆类坚果类', '坚果种子'];
  // 蔬菜水果类
  if (/菜|瓜(?!子)|茄|椒|葱|蒜|韭|姜|芹|菠|蒿|莴|笋|藕|茭|蕹|苋|荠|蕨|薇菜|萝卜|参(胡萝卜)|百合|金针|木瓜|香菇|蘑菇|菇|耳|海藻|海带|紫菜|发菜|蕨菜/.test(n)) return ['蔬菜水果类', '蔬菜菌藻'];
  if (/苹果|梨|桃|李|杏|枣|樱桃|葡萄|柿|石榴|无花果|猕猴桃|草莓|橙|柑|橘|柚|柠檬|荔枝|龙眼|桂圆|芒果|菠萝|香蕉|芭蕉|椰|菠萝蜜|番石榴|杨梅|杨桃|桑葚|火龙果|哈密瓜|西瓜|甜瓜|香瓜|木瓜|枇杷|山楂|橄榄|余甘|沙棘|刺梨|酸角/.test(n)) return ['蔬菜水果类', '鲜果'];
  // 零食饮料类
  if (/饮料|汽水|可乐|雪碧|果汁|奶茶|咖啡|可可|茶(叶)?(?!油)|汽酒|冰激凌|雪糕|冰棍|巧克力|糖果|蜜饯|果脯|果冻|膨化|虾条|薯片|锅巴|话梅|罐头|果酱|冰淇淋/.test(n)) return ['零食饮料类', '饮料零食'];
  if (/酒(精)?(?!酿)/.test(n)) return ['零食饮料类', '酒精饮料'];
  // 调味油脂类
  if (/油(?!条)|酱(油)?|醋|味精|鸡精|盐|糖(?!果)|蜂蜜|花椒|胡椒|八角|桂皮|大料|咖喱|芥末|辣酱|腐乳酱|蚝油|鱼露|豆瓣酱|甜面酱|沙拉酱|番茄酱|调味/.test(n)) return ['调味油脂类', '调味品'];
  // 婴儿食品/特殊食品
  if (/婴儿|宝宝|幼儿|配方/.test(n)) return ['代餐特殊食品', '婴幼儿食品'];
  // 兜底：菜肴/其他 → 中西菜肴类
  return ['中西菜肴类', '其他'];
}

/* ---------- 解析 CSV ---------- */
function parseCsv() {
  // Node 不支持 utf-8-sig，手动剥离 BOM
  let raw = fs.readFileSync('cn_food.csv', 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  // 自解析：支持引号内换行的 CSV
  const rows = [];
  let cur = [], field = '', inQuote = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuote) {
      if (c === '"') {
        if (raw[i + 1] === '"') { field += '"'; i++; }
        else inQuote = false;
      } else field += c;
    } else if (c === '"') inQuote = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some(f => f.trim() !== '')) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

/* ---------- 主流程 ---------- */
const rows = parseCsv();
const header = rows[0].map(h => normalizeName(h));
console.log('CSV 表头:', header.join(' | '));
const dataRows = rows.slice(1);
console.log('公开库数据条数:', dataRows.length);

// 现有库规范化索引（规范化名 → row）
const existing = db.prepare('SELECT id, food_name, calories_per_100g, protein_per_100g, carb_per_100g, fat_per_100g, source FROM food_db').all();
const normIndex = new Map();
for (const e of existing) normIndex.set(normalizeName(e.food_name), e);

const updStmt = db.prepare(`UPDATE food_db SET calories_per_100g=?, protein_per_100g=?, carb_per_100g=?, fat_per_100g=?, source='cnfood6', aliases=? WHERE id=?`);
const insStmt = db.prepare(`INSERT INTO food_db (food_id, category, sub_category, food_name, calories_per_100g, common_unit, edible_rate, protein_per_100g, carb_per_100g, fat_per_100g, source, aliases, created_at)
  VALUES ((SELECT COALESCE(MAX(food_id),0)+1 FROM food_db), ?, ?, ?, ?, '', 1, ?, ?, ?, 'cnfood6', ?, datetime('now'))`);

let matched = 0, inserted = 0, skipped = 0, updatedList = [];
for (const r of dataRows) {
  // CSV 列：0食物名 1能量(kcal) 2蛋白质 3糖类(碳水) 4脂肪 ...
  const rawName = (r[0] || '').replace(/\s+/g, '').trim();
  if (!rawName) { skipped++; continue; }
  const calories = parseFloat(r[1]) || 0;
  const protein = parseFloat(r[2]) || 0;
  const carb = parseFloat(r[3]) || 0;
  const fat = parseFloat(r[4]) || 0;
  // 全 0 营养且无名称价值 → 跳过
  if (!calories && !protein && !carb && !fat) { skipped++; continue; }

  const aliases = LEARNED_TO_COLLOQUIAL[rawName] || [];
  const aliasJson = aliases.length ? JSON.stringify(aliases) : null;
  const norm = normalizeName(rawName);

  // 匹配现有库：规范化名精确相等，或现有条目的规范名包含成分表名（如现库"鸡蛋" vs 表"鸡蛋(白皮)"不互相包含，保守只精确匹配）
  let target = normIndex.get(norm);
  // 二次尝试：别名与现有条目名互配（如现库"牛奶" vs 表"牛乳"别名"牛奶"）
  if (!target && aliases.length) {
    for (const a of aliases) {
      target = normIndex.get(normalizeName(a));
      if (target) break;
    }
  }

  if (target && target.source === 'legacy') {
    // 重叠 → 营养数据取公开库，写入别名
    if (!DRY) updStmt.run(calories, protein, carb, fat, aliasJson, target.id);
    matched++;
    updatedList.push(target.food_name + ' ← ' + rawName);
  } else if (!target) {
    // 不重叠 → 新增
    if (!DRY) {
      const [cat, sub] = guessCategory(rawName);
      insStmt.run(cat, sub, rawName, calories, protein, carb, fat, aliasJson);
    }
    inserted++;
  } else {
    // 已是 cnfood6（重复运行）→ 跳过
    skipped++;
  }
}

console.log(`\n===== 导入结果${DRY ? '（DRY RUN 预演）' : ''} =====`);
console.log('匹配更新(取公开库值):', matched);
console.log('新增:', inserted);
console.log('跳过/重复:', skipped);
console.log('\n===== 更新样例(前20) =====');
updatedList.slice(0, 20).forEach(s => console.log('  ' + s));
console.log('\n===== 导入后统计 =====');
db.prepare("SELECT source, COUNT(*) as c FROM food_db GROUP BY source").all().forEach(r => console.log(r.source + ': ' + r.c + '条'));
