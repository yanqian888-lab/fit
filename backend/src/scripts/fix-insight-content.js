/**
 * 一次性脚本：修复历史 insight 记录的 title/content 规范
 * 规则：
 * - content 必须是用户原话
 * - extracted_data.content 同步为原话
 * - 原话不超过100字时，不生成标题（title 清空）
 * - 原话超过100字时，保留已有 title；没有则留空
 */
require('dotenv').config();
const { db } = require('../db');

function safeParseJson(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (e) {
    return {};
  }
}

function fixInsights() {
  const items = db.prepare(`
    SELECT id, content, extracted_data
    FROM museum_items
    WHERE type = 'insight' AND status = 1
  `).all();

  const updateMuseum = db.prepare(`
    UPDATE museum_items
    SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const updatePrecipitation = db.prepare(`
    UPDATE precipitation_records
    SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM precipitation_records
      WHERE type = 'insight' AND content = ?
      ORDER BY id DESC LIMIT 1
    )
  `);

  let fixedCount = 0;

  for (const item of items) {
    const content = (item.content || '').trim();
    if (!content) continue;

    const data = safeParseJson(item.extracted_data);
    const isShort = content.length <= 100;

    // content 必须是原话；不超过100字时不保留标题
    data.content = content;
    if (isShort) {
      data.title = '';
    }

    const newExtractedData = JSON.stringify(data);

    updateMuseum.run(newExtractedData, item.id);

    // 尝试同步更新 precipitation_records
    try {
      updatePrecipitation.run(newExtractedData, content);
    } catch (e) {
      console.log(`[fix-insight] 未找到对应 precipitation_records: #${item.id}`);
    }

    fixedCount++;
    console.log(`[fix-insight] 记录 #${item.id} 已修复, 字数:${content.length}, 标题:${data.title || '(空)'}`);
  }

  console.log(`\n[fix-insight] 共修复 ${fixedCount} 条 insight 记录`);
}

fixInsights();
