/**
 * 一次性脚本：重新处理已沉淀到方法库的历史数据
 * - 删除纯科普/非方法/食谱类记录
 * - 为真正的方法生成明确标题并精简正文
 * 运行：cd backend && node src/scripts/reprocess-methods.js
 */
const { db } = require('../db');
const { extractPartnerMethod, extractPartnerRecipes } = require('../services/agents/partnerAssetAgent');

async function reprocess() {
  const items = db.prepare("SELECT id, content, sub_type FROM museum_items WHERE type = 'method'").all();
  console.log(`发现 ${items.length} 条方法库记录，开始重新处理...`);

  for (const item of items) {
    try {
      // 如果是食谱类内容，直接从方法库删除
      const recipes = await extractPartnerRecipes(item.content);
      if (recipes && recipes.length > 0) {
        db.prepare('DELETE FROM museum_items WHERE id = ?').run(item.id);
        console.log(`[删除] id=${item.id} 属于食谱，已删除`);
        continue;
      }

      // 尝试提取可执行方法
      const method = await extractPartnerMethod(item.content);
      if (!method) {
        db.prepare('DELETE FROM museum_items WHERE id = ?').run(item.id);
        console.log(`[删除] id=${item.id} 无有效方法，已删除`);
        continue;
      }

      // 更新为更清晰的标题和正文
      db.prepare(`
        UPDATE museum_items
        SET sub_type = ?, content = ?, extracted_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        method.title,
        method.content,
        JSON.stringify({ title: method.title, content: method.content }),
        item.id
      );
      console.log(`[更新] id=${item.id} title=${method.title}`);
    } catch (err) {
      console.error(`[错误] id=${item.id}:`, err.message);
    }
  }

  console.log('方法库重新处理完成');
  db.close();
}

reprocess();
