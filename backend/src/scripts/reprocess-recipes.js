/**
 * 一次性脚本：重新处理食谱库历史数据
 * - 删除不符合完整食谱定义的饮食小技巧/科普/搭配原则
 * - 若内容属于可执行方法/技巧，则迁移到方法库
 * 运行：cd backend && node src/scripts/reprocess-recipes.js
 */
const { db } = require('../db');
const { extractPartnerRecipes, extractPartnerMethod } = require('../services/agents/partnerAssetAgent');

async function reprocess() {
  const items = db.prepare("SELECT id, content, sub_type FROM museum_items WHERE type = 'recipe'").all();
  console.log(`发现 ${items.length} 条食谱库记录，开始重新处理...`);

  for (const item of items) {
    try {
      // 用新规则判断是否为完整食谱
      const recipes = await extractPartnerRecipes(item.content);
      if (recipes && recipes.length > 0) {
        console.log(`[保留] id=${item.id} 是完整食谱: ${recipes[0].title || item.sub_type}`);
        continue;
      }

      // 不是食谱：尝试转为方法
      const method = await extractPartnerMethod(item.content);
      if (method && method.title && method.content) {
        const methodId = db.prepare(`
          INSERT INTO museum_items (user_id, type, sub_type, content, extracted_data, author, effectiveness, status)
          SELECT user_id, 'method', ?, ?, ?, 'partner', 1, 1
          FROM museum_items WHERE id = ?
        `).run(
          method.title,
          method.content,
          JSON.stringify({ title: method.title, content: method.content }),
          item.id
        ).lastInsertRowid;

        // 迁移时间轴记录类型
        db.prepare(`
          UPDATE timelines SET event_type = 'method', title = ?, related_id = ?
          WHERE related_id = ? AND related_type = 'museum_items'
        `).run(method.title, methodId, item.id);

        // 删除原食谱
        db.prepare('DELETE FROM museum_items WHERE id = ?').run(item.id);
        console.log(`[迁移到方法库] id=${item.id} → methodId=${methodId} title=${method.title}`);
        continue;
      }

      // 既不是食谱也不是方法：删除
      db.prepare("DELETE FROM timelines WHERE related_id = ? AND related_type = 'museum_items'").run(item.id);
      db.prepare('DELETE FROM museum_items WHERE id = ?').run(item.id);
      console.log(`[删除] id=${item.id} 不属于食谱/方法: ${item.sub_type}`);
    } catch (err) {
      console.error(`[错误] id=${item.id}:`, err.message);
    }
  }

  console.log('食谱库重新处理完成');
  db.close();
}

reprocess();
