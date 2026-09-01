/**
 * 博物馆服务（心情日记、每日分析历史）
 */
const { db } = require('../db');
const { getChinaDateStr } = require('../utils/chinaTime');

function saveMood(userId, { record_date, emotion, content = '', tags = [] }) {
  const date = record_date || getChinaDateStr();
  const title = `今日心情：${emotion}`;
  const tagList = ['mood', date, ...(Array.isArray(tags) ? tags : [])];
  const safeContent = String(content || '').trim();

  const existing = db.prepare(`
    SELECT id FROM museum_items
    WHERE user_id = ? AND sub_type = 'mood' AND record_date = ? AND status = 1
  `).get(userId, date);

  if (existing) {
    db.prepare(`
      UPDATE museum_items
      SET title = ?, content = ?, emotion = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, safeContent, emotion, JSON.stringify(tagList), existing.id);
    return { id: existing.id, updated: true };
  }

  const insert = db.prepare(`
    INSERT INTO museum_items (user_id, type, sub_type, title, content, author, emotion, tags, status, record_date)
    VALUES (?, 'insight', 'mood', ?, ?, 'user', ?, ?, 1, ?)
  `);
  const id = insert.run(userId, title, safeContent, emotion, JSON.stringify(tagList), date).lastInsertRowid;
  return { id, updated: false };
}

function getMoods(userId, month, page = 1, size = 20) {
  const targetMonth = month || new Date().toISOString().split('T')[0].slice(0, 7);
  size = Math.min(100, Math.max(1, parseInt(size) || 20));
  page = Math.max(1, parseInt(page) || 1);
  const offset = (page - 1) * size;
  const list = db.prepare(`
    SELECT id, title, content, emotion, tags, is_favorite, record_date, created_at
    FROM museum_items
    WHERE user_id = ? AND sub_type = 'mood' AND record_date LIKE ? AND status = 1
    ORDER BY record_date DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, `${targetMonth}%`, size, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM museum_items
    WHERE user_id = ? AND sub_type = 'mood' AND record_date LIKE ? AND status = 1
  `).get(userId, `${targetMonth}%`).count;

  return { list, pagination: { page, size, total, has_more: total > page * size } };
}

const EMOTION_SCORES = {
  great: 5,
  good: 4,
  normal: 3,
  bad: 2,
  terrible: 1
};

function getMoodStats(userId, month) {
  const targetMonth = month || new Date().toISOString().split('T')[0].slice(0, 7);
  const rows = db.prepare(`
    SELECT record_date, emotion, COUNT(*) as count
    FROM museum_items
    WHERE user_id = ? AND sub_type = 'mood' AND record_date LIKE ? AND status = 1
    GROUP BY record_date, emotion
    ORDER BY record_date ASC
  `).all(userId, `${targetMonth}%`);

  const distribution = { great: 0, good: 0, normal: 0, bad: 0, terrible: 0 };
  const trendMap = new Map();
  let totalScore = 0;
  let totalCount = 0;

  for (const row of rows) {
    const score = EMOTION_SCORES[row.emotion] || 3;
    distribution[row.emotion] = (distribution[row.emotion] || 0) + row.count;
    totalScore += score * row.count;
    totalCount += row.count;

    const prev = trendMap.get(row.record_date) || { scoreSum: 0, count: 0 };
    trendMap.set(row.record_date, { scoreSum: prev.scoreSum + score * row.count, count: prev.count + row.count });
  }

  const trend = [];
  for (const [date, item] of trendMap) {
    trend.push({ date, score: Math.round((item.scoreSum / item.count) * 10) / 10 });
  }

  return {
    month: targetMonth,
    total_days: totalCount,
    average_score: totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 0,
    distribution,
    trend
  };
}

function getDiaryHistory(userId, month, page = 1, size = 20) {
  const targetMonth = month || new Date().toISOString().split('T')[0].slice(0, 7);
  size = Math.min(100, Math.max(1, parseInt(size) || 20));
  page = Math.max(1, parseInt(page) || 1);
  const offset = (page - 1) * size;
  const rows = db.prepare(`
    SELECT id, content, tags, is_favorite, record_date, created_at
    FROM museum_items
    WHERE user_id = ? AND sub_type = 'daily_diary' AND record_date LIKE ? AND status = 1
    ORDER BY record_date DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, `${targetMonth}%`, size, offset);

  const list = rows.map(row => {
    let tags = [];
    try { tags = JSON.parse(row.tags || '[]'); } catch (e) {}
    const summary = (row.content || '').slice(0, 120);
    const title = tags.find(t => /^第.*天|今日|减肥|坚持/.test(t)) || `${row.record_date} 每日分析`;
    return {
      id: row.id,
      date: row.record_date,
      title,
      summary,
      content: row.content || '',
      is_favorite: row.is_favorite,
      created_at: row.created_at
    };
  });

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM museum_items
    WHERE user_id = ? AND sub_type = 'daily_diary' AND record_date LIKE ? AND status = 1
  `).get(userId, `${targetMonth}%`).count;

  return { list, pagination: { page, size, total, has_more: total > page * size } };
}

function getDiaryDetail(userId, id) {
  return db.prepare(`
    SELECT id, type, sub_type, title, content, emotion, tags, is_favorite, record_date, created_at
    FROM museum_items
    WHERE id = ? AND user_id = ? AND status = 1
  `).get(id, userId);
}

function deleteDiary(userId, id) {
  const item = db.prepare('SELECT id FROM museum_items WHERE id = ? AND user_id = ? AND status = 1').get(id, userId);
  if (!item) return { error: '记录不存在' };
  db.prepare('DELETE FROM museum_items WHERE id = ? AND user_id = ?').run(id, userId);
  // 级联删除关联时间轴，避免产生孤儿记录
  db.prepare(`
    DELETE FROM timelines WHERE related_id = ? AND related_type = 'museum_items'
  `).run(id);
  return { success: true };
}

function toggleFavorite(userId, id) {
  const item = db.prepare('SELECT is_favorite FROM museum_items WHERE id = ? AND user_id = ? AND status = 1').get(id, userId);
  if (!item) return { error: '记录不存在' };
  const newValue = item.is_favorite ? 0 : 1;
  db.prepare('UPDATE museum_items SET is_favorite = ? WHERE id = ? AND user_id = ?').run(newValue, id, userId);
  return { is_favorite: newValue };
}

module.exports = {
  saveMood,
  getMoods,
  getMoodStats,
  getDiaryHistory,
  getDiaryDetail,
  deleteDiary,
  toggleFavorite
};
