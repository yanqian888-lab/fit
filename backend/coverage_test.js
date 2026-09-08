/**
 * 食品库覆盖度测试：按用户真实场景分组测命中率
 * 用法: NODE_ENV=production node coverage_test.js
 */
const ns = require('./src/services/nutritionService');

const scenes = {
  '中式家常菜': ['宫保鸡丁', '鱼香肉丝', '红烧肉', '麻婆豆腐', '糖醋里脊', '番茄炒蛋', '青椒肉丝', '回锅肉', '水煮鱼', '可乐鸡翅'],
  '外卖小吃': ['螺蛳粉', '酸辣粉', '麻辣烫', '黄焖鸡米饭', '兰州拉面', '煎饼果子', '烤冷面', '手抓饼', '肉夹馍', '凉皮'],
  '火锅烧烤': ['火锅', '肥牛卷', '虾滑', '羊肉串', '烤鱼', '小龙虾', '鸭脖', '卤味'],
  '连锁快餐': ['汉堡', '披萨', '炸鸡', '薯条', '三明治', '热狗', '华莱士', '塔斯汀'],
  '包装零食': ['薯片', '辣条', '奥利奥', '士力架', '旺旺雪饼', '果冻', '牛肉干', '猪肉脯', '海苔', '话梅'],
  '方便速食': ['泡面', '自热火锅', '速冻水饺', '汤圆', '螺蛳粉方便装', '酸辣粉方便装'],
  '烘焙甜品': ['月饼', '粽子', '蛋挞', '泡芙', '慕斯蛋糕', '冰淇淋', '曲奇', '麻薯'],
  '日料韩料': ['寿司', '刺身', '章鱼小丸子', '韩式炸鸡', '石锅拌饭', '部队火锅', '拉面(日式)'],
  '早餐场景': ['包子', '豆浆', '油条', '茶叶蛋', '玉米', '八宝粥', '烧麦', '粢饭团'],
  '主食碳水': ['炒饭', '炒面', '盖浇饭', '牛肉面', '小笼包', '生煎', '馄饨', '凉面'],
  '饮品冲调': ['可乐', '元气森林', '柠檬茶', '冰红茶', '王老吉', '椰汁', '六个核桃', '蜂蜜水'],
  '水果坚果': ['苹果', '车厘子', '榴莲', '山竹', '百香果', '椰子水', '碧根果', '夏威夷果'],
};

let totalHit = 0, totalAll = 0;
const gaps = {};
for (const [scene, words] of Object.entries(scenes)) {
  const misses = [];
  for (const w of words) {
    const r = ns.getFoodNutrition(w);
    totalAll++;
    if (r && (r.calorie_per_100g > 0 || r.protein_per_100g > 0 || r.carb_per_100g > 0)) totalHit++;
    else misses.push(w + (r ? '(数据为0)' : '(未命中)'));
  }
  const hit = words.length - misses.length;
  console.log(`${scene}: ${hit}/${words.length} 命中${misses.length ? '  ❌ ' + misses.join(', ') : '  ✅'}`);
  if (misses.length) gaps[scene] = misses.length;
}
console.log(`\n===== 总命中率: ${totalHit}/${totalAll} = ${(totalHit * 100 / totalAll).toFixed(1)}% =====`);
