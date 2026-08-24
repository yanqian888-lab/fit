/**
 * 沉淀记录控制器
 */
const { db, withTransaction } = require('../db');
const { success, error } = require('../utils/response');
const { syncToBusinessTable } = require('../services/agents/precipitationAgent');

function safeParseJson(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn('[沉淀] extracted_data/tags 解析失败，已降级为 null:', String(value).slice(0, 200));
    return null;
  }
}

const ASSET_TYPES = ['recipe', 'method', 'pitfall', 'insight', 'quote'];
const RECORD_TYPES = ['diet_record', 'exercise_record', 'body_data', 'habit'];
const ALLOWED_TYPES = [...ASSET_TYPES, ...RECORD_TYPES];
const VALID_STATUS = [0, 1, 2, 3];

function isQuestionContent(content) {
  if (!content) return false;
  const text = content.trim();
  if (/[?？]$/.test(text)) return true;
  return /(吗|呢|行不行|可不可以|可以吗|怎么办|为什么|怎么|如何|是否|是不是|能不能|多久|多少|什么样|哪些|哪个)\s*[?？]?/.test(text);
}

function hasAssetContent(data) {
  if (!data || typeof data !== 'object') return false;
  return !!(
    (data.title && String(data.title).trim()) ||
    (data.name && String(data.name).trim()) ||
    (data.content && String(data.content).trim()) ||
    (Array.isArray(data.steps) && data.steps.length > 0) ||
    (Array.isArray(data.ingredients) && data.ingredients.length > 0)
  );
}

function cleanupBadAssetRecord(record) {
  if (!ASSET_TYPES.includes(record.type)) return false;
  if (!isQuestionContent(record.content)) return false;
  const data = safeParseJson(record.extracted_data);
  if (hasAssetContent(data)) return false;

  console.log(`[沉淀清理] 将疑问句错误沉淀标记为已忽略: id=${record.id}, type=${record.type}`);
  db.prepare('UPDATE precipitation_records SET status = 3, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(record.id);
  if (record.chat_id) {
    db.prepare('UPDATE chat_messages SET precipitation_status = 3 WHERE id = ?').run(record.chat_id);
  }
  return true;
}

/**
 * 创建沉淀记录（用于把聊天消息的 preliminary 标签转为正式待确认记录）
 */
function createPrecipitation(req, res) {
  const userId = req.userId;
  const { chat_id, content, type, sub_type, extracted_data } = req.body;

  if (!content || typeof content !== 'string' || content.length > 2000) {
    return res.status(400).json(error('内容不能为空且不能超过 2000 字', 400));
  }
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return res.status(400).json(error('沉淀类型不合法', 400));
  }
  if (chat_id !== undefined && chat_id !== null && (isNaN(parseInt(chat_id)) || parseInt(chat_id) <= 0)) {
    return res.status(400).json(error('chat_id 不合法', 400));
  }

  const record = withTransaction(() => {
    const insert = db.prepare(`
      INSERT INTO precipitation_records (user_id, chat_id, type, sub_type, content, extracted_data, status, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const extractedJson = extracted_data ? JSON.stringify(extracted_data) : null;
    const precipitationId = insert.run(userId, chat_id || null, type, sub_type || null, content, extractedJson).lastInsertRowid;

    // 关联聊天消息状态
    if (chat_id) {
      db.prepare(`
        UPDATE chat_messages
        SET precipitation_id = ?, precipitation_status = 2, precipitation_type = ?
        WHERE id = ? AND user_id = ?
      `).run(precipitationId, type, chat_id, userId);
    }

    return db.prepare('SELECT * FROM precipitation_records WHERE id = ?').get(precipitationId);
  });

  return res.json(success({
    ...record,
    extracted_data: safeParseJson(record.extracted_data),
    tags: safeParseJson(record.tags)
  }, '创建成功'));
}

/**
 * 获取沉淀记录列表
 */
function getPrecipitations(req, res) {
  const userId = req.userId;
  const status = req.query.status !== undefined ? parseInt(req.query.status) : null;
  const type = req.query.type || null;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;

  let sql = `
    SELECT id, chat_id, type, sub_type, content, extracted_data, confidence, status, source, tags, remark, created_at
    FROM precipitation_records
    WHERE user_id = ?
  `;
  const params = [userId];

  if (status !== null) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  const countSql = sql.replace('SELECT id, chat_id, type, sub_type, content, extracted_data, confidence, status, source, tags, remark, created_at', 'SELECT COUNT(*) as count');
  const total = db.prepare(countSql).all(...params)[0].count;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);

  let list = db.prepare(sql).all(...params);

  // 清理历史遗留的“疑问句被错误沉淀为个人资产”的记录
  list = list.filter(item => !cleanupBadAssetRecord(item));

  // 关键修复：饮食类沉淀记录优先以关联的 diet_records 为准，
  // 确保沉淀弹窗、搭搭回复、饮食记录列表三者完全一致。
  for (const item of list) {
    if (item.type === 'diet_record' && item.id) {
      try {
        // 先按 precipitation_id 直接关联查找
        let rows = db.prepare(`
          SELECT meal_time, foods, total_calorie, total_protein, total_carb, total_fat
          FROM diet_records
          WHERE user_id = ? AND precipitation_id = ? AND status = 1
          ORDER BY id ASC
        `).all(userId, item.id);

        // 如果直接关联找不到（可能被合并到同批次其他 precipitation_id），
        // 则通过 chat_id 查找同批次的所有 precipitation_id，再汇总所有 diet_records
        if (rows.length === 0 && item.chat_id) {
          const relatedPrecipIds = db.prepare(`
            SELECT id FROM precipitation_records
            WHERE user_id = ? AND chat_id = ? AND type = 'diet_record' AND status = 1
          `).pluck().all(userId, item.chat_id);

          if (relatedPrecipIds.length > 0) {
            const ph = relatedPrecipIds.map(() => '?').join(',');
            rows = db.prepare(`
              SELECT meal_time, foods, total_calorie, total_protein, total_carb, total_fat
              FROM diet_records
              WHERE user_id = ? AND status = 1 AND precipitation_id IN (${ph})
              ORDER BY id ASC
            `).all(userId, ...relatedPrecipIds);
          }
        }

        if (rows.length > 0) {
          const allFoods = [];
          let totalCalorie = 0;
          let totalProtein = 0;
          let totalCarb = 0;
          let totalFat = 0;
          let mealTime = rows[0].meal_time;

          for (const row of rows) {
            const foods = safeParseJson(row.foods) || [];
            allFoods.push(...foods);
            totalCalorie += row.total_calorie || 0;
            totalProtein += row.total_protein || 0;
            totalCarb += row.total_carb || 0;
            totalFat += row.total_fat || 0;
            if (row.meal_time) mealTime = row.meal_time;
          }

          const baseExtracted = safeParseJson(item.extracted_data) || {};
          item.extracted_data = {
            ...baseExtracted,
            meal_time: mealTime || baseExtracted.meal_time || 'lunch',
            foods: allFoods,
            total_calorie: totalCalorie,
            total_protein: totalProtein,
            total_carb: totalCarb,
            total_fat: totalFat
          };

          // 同时把最新值写回 precipitation_records，便于后端下次快速读取
          db.prepare(`
            UPDATE precipitation_records
            SET extracted_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).run(JSON.stringify(item.extracted_data), item.id, userId);
        }
      } catch (e) {
        console.error('[沉淀列表] 饮食数据同步失败，降级使用 extracted_data 原值:', e.message);
      }
    }
  }

  return res.json(success({
    list: list.map(item => ({
      ...item,
      extracted_data: typeof item.extracted_data === 'object' ? item.extracted_data : safeParseJson(item.extracted_data),
      tags: safeParseJson(item.tags)
    })),
    pagination: {
      page,
      size,
      total,
      has_more: total > page * size
    }
  }));
}

/**
 * 更新沉淀记录
 */
function updatePrecipitation(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  const { content, extracted_data, tags, remark, status } = req.body;

  const precipitationId = parseInt(id);
  if (isNaN(precipitationId) || precipitationId <= 0) {
    return res.status(400).json(error('沉淀 ID 不合法', 400));
  }
  if (content !== undefined && content !== null && (typeof content !== 'string' || content.length > 2000)) {
    return res.status(400).json(error('内容不能超过 2000 字', 400));
  }
  if (status !== undefined && status !== null && !VALID_STATUS.includes(parseInt(status))) {
    return res.status(400).json(error('沉淀状态不合法', 400));
  }

  withTransaction(() => {
    db.prepare(`
      UPDATE precipitation_records
      SET content = COALESCE(?, content),
          extracted_data = COALESCE(?, extracted_data),
          tags = COALESCE(?, tags),
          remark = COALESCE(?, remark),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(content, extracted_data ? JSON.stringify(extracted_data) : null, tags ? JSON.stringify(tags) : null, remark, status, id, userId);

    // 如果修改了结构化数据，同步更新关联的业务表
    if (extracted_data) {
      const record = db.prepare('SELECT type FROM precipitation_records WHERE id = ? AND user_id = ?').get(id, userId);
      const type = req.body.type || (record ? record.type : null);
      const subType = req.body.sub_type || null;

      if (type) {
        // 食谱在 museum_items 中按 chat_message_id 做 upsert，需要把 chat_id 传下去
        let chatId = null;
        if (type === 'recipe') {
          const rec = db.prepare('SELECT chat_id FROM precipitation_records WHERE id = ? AND user_id = ?').get(id, userId);
          chatId = rec?.chat_id || null;
        }
        syncToBusinessTable(userId, type, content, extracted_data, null, subType, parseInt(id) || null, chatId, true);
      }
    }

    // 同步聊天消息状态，避免刷新后标签仍显示“待确认”
    if (status !== undefined && status !== null) {
      const record = db.prepare('SELECT chat_id FROM precipitation_records WHERE id = ? AND user_id = ?').get(id, userId);
      if (record && record.chat_id) {
        // 沉淀 1=已确认；2=已忽略；聊天消息 1=已记录，3=已忽略；0/2 均视为“待确认”
        let chatStatus = 2;
        if (status === 1) chatStatus = 1;
        else if (status === 2 || status === 3) chatStatus = 3;
        db.prepare('UPDATE chat_messages SET precipitation_status = ? WHERE id = ?').run(chatStatus, record.chat_id);
      }
    }
  });

  return res.json(success(null, '更新成功'));
}

/**
 * 删除沉淀记录
 */
function deletePrecipitation(req, res) {
  const userId = req.userId;
  const { id } = req.params;
  db.prepare('DELETE FROM precipitation_records WHERE id = ? AND user_id = ?').run(id, userId);
  return res.json(success(null, '删除成功'));
}

module.exports = {
  getPrecipitations,
  createPrecipitation,
  updatePrecipitation,
  deletePrecipitation
};
