/**
 * 健康食谱表批量导入脚本
 * 功能：
 * 1. 删除 shop_items 表中所有 category='food' 的现有食品记录
 * 2. 解析 word/健康食谱表.xlsx（共192条）
 * 3. 将食谱数据以 category='food' 灌入 shop_items 表：
 *    - sort_order 严格对应 Excel 中的序号（方便后续图片命名）
 *    - status=0（未启用），等待后续上传图片后手动启用
 *    - effect_json 结构化存储：总重量、总热量、食材、做法步骤、小贴士
 *    - price_berries 按总热量/10 计算，最低15浆果
 */
const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

/**
 * Excel 文件路径和数据库路径
 */
const EXCEL_PATH = path.join(__dirname, '..', '..', 'word', '健康食谱表.xlsx');
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

/**
 * 归一化价格：总热量/10，最低15浆果
 * @param {number} calories - 总热量
 * @returns {number} 浆果价格
 */
function calcPrice(calories) {
  const c = Number(calories) || 0;
  const price = Math.round(c / 10);
  return Math.max(price, 15);
}

/**
 * 主函数：删除旧食品并导入新食谱
 */
function main() {
  // 1. 读取 Excel
  console.log('📖 正在读取 Excel 文件...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  console.log(`✅ Excel 读取完成，共 ${rows.length} 条食谱数据`);
  console.log(`   表头: ${Object.keys(rows[0] || {}).join(', ')}`);

  // 2. 连接数据库
  console.log('\n🔗 正在连接数据库...');
  const db = new Database(DB_PATH);

  // 3. 开启事务，删除现有食品
  console.log('\n🗑️  正在删除现有食品数据 (category=food)...');
  const deleteTx = db.transaction(() => {
    const beforeCount = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE category = 'food'").get().cnt;
    console.log(`   删除前食品数量: ${beforeCount}`);

    const info = db.prepare("DELETE FROM shop_items WHERE category = 'food'").run();
    console.log(`   已删除 ${info.changes} 条食品记录`);

    const afterCount = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE category = 'food'").get().cnt;
    console.log(`   删除后食品数量: ${afterCount}`);
  });
  deleteTx();

  // 4. 检查非食品数据是否保留
  const otherStats = db.prepare(
    "SELECT category, COUNT(*) as cnt FROM shop_items WHERE category != 'food' GROUP BY category"
  ).all();
  console.log('\n📦 非食品商品保留情况:');
  otherStats.forEach(s => console.log(`   ${s.category}: ${s.cnt} 条`));

  // 5. 导入新食谱（事务保证原子性）
  console.log('\n📥 正在导入新食谱数据...');
  const insertStmt = db.prepare(`
    INSERT INTO shop_items (
      category, name, description, icon_url,
      price_berries, price_flowers, stock,
      item_type, effect_json, unlock_condition,
      duration_seconds, sort_order, status
    ) VALUES (
      'food', ?, ?, NULL,
      ?, 0, -1,
      NULL, ?, NULL,
      NULL, ?, 0
    )
  `);

  const importTx = db.transaction(() => {
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // 读取 Excel 字段
      const seq = Number(row['序号']) || (i + 1);
      const name = String(row['食谱标题'] || '').trim();
      const ingredients = String(row['食材'] || '').trim();
      const steps = String(row['做法步骤'] || '').trim();
      const tips = String(row['小贴士'] || '').trim();
      const totalWeight = String(row['总重量(g)'] || '').trim();
      const totalCalories = String(row['总热量(kcal/份)'] || '').trim();

      // 名称为空则跳过
      if (!name) {
        console.log(`   ⚠️  第 ${i + 1} 行缺少名称，已跳过`);
        skipCount++;
        continue;
      }

      // 价格计算
      const priceBerries = calcPrice(Number(totalCalories) || 0);

      // 组装 description（简介，优先用小贴士）
      let description = tips;
      if (!description) {
        description = `热量${totalCalories || '?'}kcal · 总重${totalWeight || '?'}g`;
      }

      // 组装 effect_json（结构化存储完整食谱信息）
      const effectJson = JSON.stringify({
        type: 'food',
        nutrition: {
          calories: totalCalories,
          weight: totalWeight
        },
        recipe: {
          ingredients: ingredients,
          steps: steps,
          tips: tips
        }
      });

      // 执行插入
      const info = insertStmt.run(
        name,           // name
        description,    // description
        priceBerries,   // price_berries
        effectJson,     // effect_json
        seq             // sort_order = Excel序号
      );

      successCount++;

      // 前5条和后5条打印详细日志，中间只打印进度
      if (successCount <= 5 || successCount > rows.length - 5) {
        console.log(`   ✅ #${seq} ${name} | ${priceBerries}浆果 | ${totalCalories}kcal | sort_order=${seq}`);
      } else if (successCount % 20 === 0) {
        console.log(`   ⏳ 已导入 ${successCount}/${rows.length} 条...`);
      }
    }

    console.log(`\n📊 导入统计：`);
    console.log(`   成功: ${successCount} 条`);
    console.log(`   跳过: ${skipCount} 条`);
    console.log(`   总计: ${rows.length} 条`);
  });

  importTx();

  // 6. 验证导入结果
  console.log('\n🔍 验证导入结果...');
  const finalFoodCount = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE category = 'food'").get().cnt;
  const enabledCount = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE category = 'food' AND status = 1").get().cnt;
  const disabledCount = db.prepare("SELECT COUNT(*) as cnt FROM shop_items WHERE category = 'food' AND status = 0").get().cnt;
  const minSort = db.prepare("SELECT MIN(sort_order) as min FROM shop_items WHERE category = 'food'").get().min;
  const maxSort = db.prepare("SELECT MAX(sort_order) as max FROM shop_items WHERE category = 'food'").get().max;

  console.log(`   食品总数: ${finalFoodCount}`);
  console.log(`   已启用(status=1): ${enabledCount}`);
  console.log(`   未启用(status=0): ${disabledCount}`);
  console.log(`   sort_order 范围: ${minSort} ~ ${maxSort}`);

  // 抽样检查前3条和后3条
  const sampleRows = db.prepare(`
    SELECT id, sort_order, name, price_berries, status, effect_json
    FROM shop_items WHERE category = 'food'
    ORDER BY sort_order ASC
  `).all();

  console.log('\n📋 前3条抽样:');
  sampleRows.slice(0, 3).forEach(r => {
    const ef = JSON.parse(r.effect_json || '{}');
    console.log(`   ID${r.id} | sort=${r.sort_order} | ${r.name} | ${r.price_berries}浆果 | status=${r.status} | 热量=${ef.nutrition?.calories || '?'}`);
  });
  console.log('\n📋 后3条抽样:');
  sampleRows.slice(-3).forEach(r => {
    const ef = JSON.parse(r.effect_json || '{}');
    console.log(`   ID${r.id} | sort=${r.sort_order} | ${r.name} | ${r.price_berries}浆果 | status=${r.status} | 热量=${ef.nutrition?.calories || '?'}`);
  });

  // 检查是否有空洞（sort_order 不连续）
  const sortOrders = sampleRows.map(r => r.sort_order).sort((a, b) => a - b);
  const expectedTotal = sortOrders.length;
  const expectedMax = Math.max(...sortOrders);
  const expectedMin = Math.min(...sortOrders);
  if (expectedMax - expectedMin + 1 === expectedTotal) {
    console.log(`\n✅ sort_order 连续性检查通过: ${expectedMin}~${expectedMax} 无空洞`);
  } else {
    console.log(`\n⚠️  sort_order 存在空洞，请检查`);
  }

  db.close();
  console.log('\n🎉 健康食谱导入完成！');
  console.log(`   所有食品 status=0（未启用），上传图片后可在管理后台手动启用`);
  console.log(`   sort_order 与 Excel 序号一一对应，方便图片按序号命名`);
}

main();
