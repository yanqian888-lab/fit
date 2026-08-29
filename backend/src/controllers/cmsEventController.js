/**
 * CMS 宠物事件库配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

// 优先掉落日期校验：YYYY-MM-DD，起止可单填一个（另一个视为相同），起不能晚于止
function validatePriorityDates(start, end) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const s = start || null;
  const e = end || null;
  if (s && !re.test(s)) return '优先掉落开始日期格式应为 YYYY-MM-DD';
  if (e && !re.test(e)) return '优先掉落结束日期格式应为 YYYY-MM-DD';
  if (s && e && s > e) return '优先掉落开始日期不能晚于结束日期';
  return null;
}

// ==================== 事件集 CRUD（event_collections 表，App 相册 tab 同源） ====================
function getCollections(req, res) {
  const list = db.prepare('SELECT * FROM event_collections ORDER BY sort_order ASC, id ASC').all();
  return res.json(success({ list }));
}

function createCollection(req, res) {
  const { coll_key, name, sort_order = 0 } = req.body || {};
  if (!coll_key || !String(coll_key).trim()) return res.status(400).json(error('事件集标识不能为空', 400));
  if (!name || !String(name).trim()) return res.status(400).json(error('事件集名称不能为空', 400));
  const existing = db.prepare('SELECT id FROM event_collections WHERE coll_key = ?').get(coll_key);
  if (existing) return res.status(400).json(error('事件集标识已存在', 400));
  const id = db.prepare(`
    INSERT INTO event_collections (coll_key, name, sort_order, is_enabled) VALUES (?, ?, ?, 1)
  `).run(String(coll_key).trim(), String(name).trim(), sort_order).lastInsertRowid;
  cmsLogService.log(req, 'event_config:create', 'event_collection', String(id), { coll_key, name });
  return res.json(success({ id }, '创建成功'));
}

function updateCollection(req, res) {
  const { id } = req.params;
  const { coll_key, name, sort_order, is_enabled } = req.body || {};
  const item = db.prepare('SELECT id FROM event_collections WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('事件集不存在', 404));
  if (coll_key !== undefined) {
    const existing = db.prepare('SELECT id FROM event_collections WHERE coll_key = ? AND id != ?').get(coll_key, id);
    if (existing) return res.status(400).json(error('事件集标识已存在', 400));
  }
  db.prepare(`
    UPDATE event_collections
    SET coll_key = COALESCE(?, coll_key),
        name = COALESCE(?, name),
        sort_order = COALESCE(?, sort_order),
        is_enabled = COALESCE(?, is_enabled),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    coll_key !== undefined ? String(coll_key).trim() : null,
    name !== undefined ? String(name).trim() : null,
    sort_order !== undefined ? sort_order : null,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    id
  );
  cmsLogService.log(req, 'event_config:update', 'event_collection', String(id), { coll_key, name });
  return res.json(success(null, '更新成功'));
}

function removeCollection(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM event_collections WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('事件集不存在', 404));
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM pet_events_lib WHERE type = ?').get(item.coll_key).count;
  if (eventCount > 0) {
    return res.status(400).json(error(`该事件集下还有 ${eventCount} 个事件，请先删除或移走事件`, 400));
  }
  db.prepare('DELETE FROM event_collections WHERE id = ?').run(id);
  cmsLogService.log(req, 'event_config:delete', 'event_collection', String(id), { coll_key: item.coll_key });
  return res.json(success(null, '删除成功'));
}

function getTypes() {
  const rows = db.prepare('SELECT coll_key FROM event_collections WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC').all();
  return rows.map(r => r.coll_key);
}

function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { type, location, keyword, is_enabled } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (type) {
    where += ' AND e.type = ?';
    params.push(type);
  }

  if (location && ['home', 'explore'].includes(location)) {
    where += ' AND e.location = ?';
    params.push(location);
  }

  if (is_enabled !== undefined && is_enabled !== '') {
    where += ' AND e.is_enabled = ?';
    params.push(is_enabled);
  }

  if (keyword) {
    where += ' AND (e.event_key LIKE ? OR e.title LIKE ? OR e.content LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM pet_events_lib e ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT e.*, c.name AS collection_name, s.name AS required_item_name,
      (SELECT p.photo_url FROM pet_event_photos p WHERE p.event_id = e.id AND p.is_enabled = 1 ORDER BY p.sort_order ASC, p.id ASC LIMIT 1) AS first_photo
    FROM pet_events_lib e
    LEFT JOIN event_collections c ON c.coll_key = e.type
    LEFT JOIN shop_items s ON s.id = e.required_item_id
    ${where}
    ORDER BY e.id ASC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    types: getTypes(),
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM pet_events_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('事件不存在', 404));
  }
  const photos = db.prepare(`
    SELECT id, photo_url, sort_order, is_enabled
    FROM pet_event_photos
    WHERE event_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(id);
  item.photos = photos || [];
  return res.json(success(item));
}

function create(req, res) {
  const {
    event_key, type, title, content, image_url,
    weight = 1, required_item_id = null, location = 'explore', explore_minutes,
    priority_start_date = null, priority_end_date = null,
    reward_json, sort_order = 0, is_enabled = 1, photos
  } = req.body;

  if (!event_key || !String(event_key).trim()) {
    return res.status(400).json(error('事件 key 不能为空', 400));
  }
  if (!type || !String(type).trim()) {
    return res.status(400).json(error('事件集不能为空', 400));
  }
  const coll = db.prepare('SELECT id FROM event_collections WHERE coll_key = ?').get(type);
  if (!coll) {
    return res.status(400).json(error('事件集不存在，请先创建事件集', 400));
  }
  const weightNum = parseInt(weight, 10);
  if (isNaN(weightNum) || weightNum < 0 || weightNum > 10) {
    return res.status(400).json(error('概率权重必须是 0-10 的整数', 400));
  }
  if (!['home', 'explore'].includes(location)) {
    return res.status(400).json(error('发生地点必须是 home（居家）或 explore（外出）', 400));
  }
  // 外出事件必须配置外出时长（分钟）
  let exploreMinutesNum = null;
  if (location === 'explore') {
    exploreMinutesNum = parseInt(explore_minutes, 10);
    if (isNaN(exploreMinutesNum) || exploreMinutesNum <= 0 || exploreMinutesNum > 1440) {
      return res.status(400).json(error('外出事件必须配置外出时长（1-1440 分钟）', 400));
    }
  }
  if (required_item_id) {
    const item = db.prepare('SELECT id FROM shop_items WHERE id = ?').get(required_item_id);
    if (!item) return res.status(400).json(error('必要条件所选商品不存在', 400));
  }
  const priorityErr = validatePriorityDates(priority_start_date, priority_end_date);
  if (priorityErr) return res.status(400).json(error(priorityErr, 400));

  const existing = db.prepare('SELECT id FROM pet_events_lib WHERE event_key = ?').get(event_key);
  if (existing) {
    return res.status(400).json(error('事件 key 已存在', 400));
  }

  const id = db.prepare(`
    INSERT INTO pet_events_lib (event_key, type, title, content, image_url, rarity, drop_rate, reward_json, sort_order, is_enabled, weight, required_item_id, location, explore_minutes, priority_start_date, priority_end_date)
    VALUES (?, ?, ?, ?, ?, 'common', 0.1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(event_key).trim(),
    type,
    title || null,
    content || null,
    image_url || null,
    reward_json ? JSON.stringify(reward_json) : '{}',
    sort_order,
    is_enabled ? 1 : 0,
    weightNum,
    required_item_id || null,
    location,
    exploreMinutesNum,
    priority_start_date || null,
    priority_end_date || null
  ).lastInsertRowid;

  cmsLogService.log(req, 'event_config:create', 'pet_event', String(id), { event_key, type });
  syncEventPhotos(id, photos, req);
  return res.json(success({ id }, '创建成功'));
}

function update(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const item = db.prepare('SELECT * FROM pet_events_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('事件不存在', 404));
  }

  const {
    event_key, type, title, content, image_url,
    weight, required_item_id, location, explore_minutes,
    priority_start_date, priority_end_date,
    reward_json, sort_order, is_enabled, photos
  } = body;

  if (type !== undefined) {
    if (!String(type).trim()) return res.status(400).json(error('事件集不能为空', 400));
    const coll = db.prepare('SELECT id FROM event_collections WHERE coll_key = ?').get(type);
    if (!coll) return res.status(400).json(error('事件集不存在，请先创建事件集', 400));
  }
  if (weight !== undefined) {
    const weightNum = parseInt(weight, 10);
    if (isNaN(weightNum) || weightNum < 0 || weightNum > 10) {
      return res.status(400).json(error('概率权重必须是 0-10 的整数', 400));
    }
  }
  if (location !== undefined && !['home', 'explore'].includes(location)) {
    return res.status(400).json(error('发生地点必须是 home（居家）或 explore（外出）', 400));
  }
  // 外出事件必须配置外出时长（分钟）；切到居家时清空
  const mergedLocation = location !== undefined ? location : item.location;
  let exploreMinutesVal = item.explore_minutes;
  if (explore_minutes !== undefined) {
    const n = parseInt(explore_minutes, 10);
    if (isNaN(n) || n <= 0 || n > 1440) {
      return res.status(400).json(error('外出时长必须是 1-1440 分钟的整数', 400));
    }
    exploreMinutesVal = n;
  }
  if (mergedLocation === 'explore' && !exploreMinutesVal) {
    return res.status(400).json(error('外出事件必须配置外出时长（1-1440 分钟）', 400));
  }
  if (mergedLocation === 'home') {
    exploreMinutesVal = null;
  }
  if (required_item_id !== undefined && required_item_id !== null) {
    const shopItem = db.prepare('SELECT id FROM shop_items WHERE id = ?').get(required_item_id);
    if (!shopItem) return res.status(400).json(error('必要条件所选商品不存在', 400));
  }
  if (priority_start_date !== undefined || priority_end_date !== undefined) {
    const mergedStart = priority_start_date !== undefined ? (priority_start_date || null) : item.priority_start_date;
    const mergedEnd = priority_end_date !== undefined ? (priority_end_date || null) : item.priority_end_date;
    const priorityErr = validatePriorityDates(mergedStart, mergedEnd);
    if (priorityErr) return res.status(400).json(error(priorityErr, 400));
  }

  if (event_key !== undefined) {
    const existing = db.prepare('SELECT id FROM pet_events_lib WHERE event_key = ? AND id != ?').get(event_key, id);
    if (existing) {
      return res.status(400).json(error('事件 key 已存在', 400));
    }
  }

  db.prepare(`
    UPDATE pet_events_lib
    SET event_key = COALESCE(?, event_key),
        type = COALESCE(?, type),
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        image_url = COALESCE(?, image_url),
        reward_json = COALESCE(?, reward_json),
        sort_order = COALESCE(?, sort_order),
        is_enabled = COALESCE(?, is_enabled),
        weight = COALESCE(?, weight),
        required_item_id = ?,
        location = COALESCE(?, location),
        explore_minutes = ?,
        priority_start_date = ?,
        priority_end_date = ?
    WHERE id = ?
  `).run(
    event_key !== undefined ? String(event_key).trim() : null,
    type !== undefined ? type : null,
    title !== undefined ? title : null,
    content !== undefined ? content : null,
    image_url !== undefined ? image_url : null,
    reward_json !== undefined ? JSON.stringify(reward_json) : null,
    sort_order !== undefined ? sort_order : null,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    weight !== undefined ? parseInt(weight, 10) : null,
    required_item_id !== undefined ? (required_item_id || null) : item.required_item_id,
    location !== undefined ? location : null,
    exploreMinutesVal,
    priority_start_date !== undefined ? (priority_start_date || null) : item.priority_start_date,
    priority_end_date !== undefined ? (priority_end_date || null) : item.priority_end_date,
    id
  );

  cmsLogService.log(req, 'event_config:update', 'pet_event', String(id), { event_key, type });
  syncEventPhotos(id, photos, req);
  return res.json(success(null, '更新成功'));
}

function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM pet_events_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('事件不存在', 404));
  }

  db.prepare('DELETE FROM pet_events_lib WHERE id = ?').run(id);
  cmsLogService.log(req, 'event_config:delete', 'pet_event', String(id), {});
  return res.json(success(null, '删除成功'));
}

// 事件照片 URL 校验：接受完整 http(s) URL 或 /static/uploads/ 相对路径
// 与 photoController.URL_REGEX 保持一致，防止脏数据进库后前端无法展示
const EVENT_PHOTO_URL_REGEX = /^(https?:\/\/.+|\/static\/uploads\/.+)/;

/**
 * 同步事件照片：与前端提交的照片数组保持一致
 * - 已存在且仍在前端列表中的 id，更新 url/sort/enabled
 * - 新增的（无 id 或 id 不在本事件），插入
 * - 前端列表中已删除的，从数据库移除
 * - 仅保留合法 URL（http(s) 完整地址或 /static/uploads/ 相对路径），其余过滤丢弃
 */
function syncEventPhotos(eventId, photos, req) {
  if (!Array.isArray(photos)) return;

  const valid = photos
    .filter(p => p && p.photo_url && EVENT_PHOTO_URL_REGEX.test(String(p.photo_url).trim()))
    .map(p => ({
      id: p.id ? parseInt(p.id, 10) : null,
      photo_url: String(p.photo_url).trim(),
      sort_order: p.sort_order !== undefined ? (parseInt(p.sort_order, 10) || 0) : 0,
      is_enabled: p.is_enabled !== undefined ? (p.is_enabled ? 1 : 0) : 1
    }));

  const existingRows = db.prepare('SELECT id FROM pet_event_photos WHERE event_id = ?').all(eventId);
  const existingIds = existingRows.map(r => r.id);
  const keepIds = new Set(valid.filter(p => p.id && existingIds.includes(p.id)).map(p => p.id));
  const deleteIds = existingIds.filter(id => !keepIds.has(id));

  const doSync = db.transaction(() => {
    for (const id of deleteIds) {
      db.prepare('DELETE FROM pet_event_photos WHERE id = ? AND event_id = ?').run(id, eventId);
    }

    const updateStmt = db.prepare(`
      UPDATE pet_event_photos
      SET photo_url = ?, sort_order = ?, is_enabled = ?
      WHERE id = ? AND event_id = ?
    `);
    const insertStmt = db.prepare(`
      INSERT INTO pet_event_photos (event_id, photo_url, sort_order, is_enabled)
      VALUES (?, ?, ?, ?)
    `);

    for (const p of valid) {
      if (p.id && keepIds.has(p.id)) {
        updateStmt.run(p.photo_url, p.sort_order, p.is_enabled, p.id, eventId);
      } else {
        const photoId = insertStmt.run(eventId, p.photo_url, p.sort_order, p.is_enabled).lastInsertRowid;
        if (req) {
          cmsLogService.log(req, 'event_config:photo_create', 'pet_event_photo', String(photoId), {
            event_id: Number(eventId),
            photo_url: p.photo_url
          });
        }
      }
    }
  });

  doSync();
}

// ==================== 事件照片管理 ====================
const photos = {
  // 某事件下的照片列表
  list(req, res) {
    const { id } = req.params;
    const event = db.prepare('SELECT id, event_key, title FROM pet_events_lib WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json(error('事件不存在', 404));
    }

    const list = db.prepare(`
      SELECT * FROM pet_event_photos
      WHERE event_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(id);

    return res.json(success({ event, list }));
  },

  create(req, res) {
    const { id } = req.params;
    const event = db.prepare('SELECT id FROM pet_events_lib WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json(error('事件不存在', 404));
    }

    const { photo_url, sort_order = 0, is_enabled = 1 } = req.body || {};
    if (!photo_url || !String(photo_url).trim()) {
      return res.status(400).json(error('照片地址不能为空', 400));
    }

    const photoId = db.prepare(`
      INSERT INTO pet_event_photos (event_id, photo_url, sort_order, is_enabled)
      VALUES (?, ?, ?, ?)
    `).run(id, String(photo_url).trim(), sort_order, is_enabled ? 1 : 0).lastInsertRowid;

    cmsLogService.log(req, 'event_config:photo_create', 'pet_event_photo', String(photoId), { event_id: Number(id), photo_url });
    return res.json(success({ id: photoId }, '创建成功'));
  },

  update(req, res) {
    const { id } = req.params;
    const body = req.body || {};

    const item = db.prepare('SELECT id FROM pet_event_photos WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json(error('照片不存在', 404));
    }

    const { photo_url, sort_order, is_enabled } = body;
    if (photo_url !== undefined && !String(photo_url).trim()) {
      return res.status(400).json(error('照片地址不能为空', 400));
    }

    db.prepare(`
      UPDATE pet_event_photos
      SET photo_url = COALESCE(?, photo_url),
          sort_order = COALESCE(?, sort_order),
          is_enabled = COALESCE(?, is_enabled)
      WHERE id = ?
    `).run(
      photo_url !== undefined ? String(photo_url).trim() : null,
      sort_order !== undefined ? sort_order : null,
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
      id
    );

    cmsLogService.log(req, 'event_config:photo_update', 'pet_event_photo', String(id), { photo_url, sort_order, is_enabled });
    return res.json(success(null, '更新成功'));
  },

  // 上下架
  toggleStatus(req, res) {
    const { id } = req.params;
    const item = db.prepare('SELECT id, is_enabled FROM pet_event_photos WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json(error('照片不存在', 404));
    }

    const next = item.is_enabled ? 0 : 1;
    db.prepare('UPDATE pet_event_photos SET is_enabled = ? WHERE id = ?').run(next, id);

    cmsLogService.log(req, 'event_config:photo_toggle', 'pet_event_photo', String(id), { is_enabled: next });
    return res.json(success({ is_enabled: next }, next ? '已上架' : '已下架'));
  },

  remove(req, res) {
    const { id } = req.params;
    const item = db.prepare('SELECT id FROM pet_event_photos WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json(error('照片不存在', 404));
    }

    db.prepare('DELETE FROM pet_event_photos WHERE id = ?').run(id);
    cmsLogService.log(req, 'event_config:photo_delete', 'pet_event_photo', String(id), {});
    return res.json(success(null, '删除成功'));
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  photos,
  getCollections,
  createCollection,
  updateCollection,
  removeCollection
};
