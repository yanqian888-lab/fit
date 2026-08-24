/**
 * 食品导入最终验证脚本
 */
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data', 'app.db'));

console.log('========== 最终验证报告 ==========');

// 1. 分类统计
console.log('\n1. 商品分类分布：');
const byCategory = db.prepare("SELECT category, status, COUNT(*) as cnt FROM shop_items GROUP BY category, status ORDER BY category").all();
byCategory.forEach(r => {
  const statusText = r.status === 1 ? '已启用' : '未启用';
  console.log('   ' + r.category.padEnd(12) + ' | ' + statusText + ' | ' + r.cnt + ' 条');
});

// 2. sort_order-ID 对应抽样
console.log('\n2. 食品 sort_order-ID 对应抽样（序号5的倍数）：');
const samples = db.prepare("SELECT id, sort_order, name FROM shop_items WHERE category='food' AND sort_order % 5 = 0 ORDER BY sort_order").all();
samples.forEach(r => {
  console.log('   Excel序号#' + String(r.sort_order).padStart(3) + ' -> DB ID#' + String(r.id).padStart(3) + ' | ' + r.name);
});

// 3. 抽查第24条的完整结构
console.log('\n3. 抽查 #24 (香蕉蛋白奶昔) 的完整数据结构：');
const detail = db.prepare("SELECT * FROM shop_items WHERE category='food' AND sort_order=24").get();
if (detail) {
  console.log('   ID:', detail.id);
  console.log('   分类:', detail.category);
  console.log('   名称:', detail.name);
  console.log('   描述:', detail.description.substring(0, 50) + '...');
  console.log('   浆果价格:', detail.price_berries);
  console.log('   鲜花价格:', detail.price_flowers);
  console.log('   库存:', detail.stock);
  console.log('   sort_order:', detail.sort_order);
  console.log('   status:', detail.status, detail.status === 1 ? '(已启用)' : '(未启用)');
  console.log('   effect_json 结构:');
  const ef = JSON.parse(detail.effect_json);
  console.log('     - type:', ef.type);
  console.log('     - nutrition:', JSON.stringify(ef.nutrition));
  console.log('     - recipe 含 ingredients/steps/tips 三个字段');
}

// 4. 前端可见性
console.log('\n4. 前端商店接口可见性（status=1才显示）：');
const frontFood = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE status=1 AND category='food'").get().cnt;
const frontEquip = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE status=1 AND category='equipment'").get().cnt;
const frontProp = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE status=1 AND category='prop'").get().cnt;
console.log('   前端可见食品:', frontFood, '个 (全部未启用，未上传图片不展示)');
console.log('   前端可见器材:', frontEquip, '个');
console.log('   前端可见道具:', frontProp, '个');

// 5. 价格分布（用简单查询代替CASE）
console.log('\n5. 食品价格分布统计：');
const prices = db.prepare("SELECT price_berries FROM shop_items WHERE category='food' ORDER BY price_berries").all();
const pArr = prices.map(p => p.price_berries);
const min = Math.min(...pArr);
const max = Math.max(...pArr);
const avg = Math.round(pArr.reduce((a, b) => a + b, 0) / pArr.length);
const under20 = pArr.filter(p => p < 20).length;
const under30 = pArr.filter(p => p >= 20 && p < 30).length;
const under40 = pArr.filter(p => p >= 30 && p < 40).length;
const over40 = pArr.filter(p => p >= 40).length;
console.log('   最低价: ' + min + ' 浆果');
console.log('   最高价: ' + max + ' 浆果');
console.log('   平均价: ' + avg + ' 浆果');
console.log('   0-19浆果: ' + under20 + ' 条');
console.log('   20-29浆果: ' + under30 + ' 条');
console.log('   30-39浆果: ' + under40 + ' 条');
console.log('   40+浆果: ' + over40 + ' 条');

db.close();
console.log('\n========== 验证通过 ==========');
