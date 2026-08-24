/**
 * CMS 宠物陪伴配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');
const cmsDialogueController = require('./cmsDialogueController');
const { invalidateAppConfig } = require('../utils/configCache');

function getAppConfig(key) {
  const row = db.prepare('SELECT config_value FROM app_configs WHERE config_key = ?').get(key);
  if (!row) return {};
  try {
    return JSON.parse(row.config_value || '{}');
  } catch (e) {
    return {};
  }
}

function setAppConfig(key, value) {
  db.prepare(`
    INSERT INTO app_configs (config_key, config_value)
    VALUES (?, ?)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value));
  invalidateAppConfig(key);
}

// ==================== 全局配置 ====================
function getGlobal(req, res) {
  const config = getAppConfig('pet_global');
  return res.json(success(config));
}

function updateGlobal(req, res) {
  const updates = req.body || {};
  const current = getAppConfig('pet_global');
  const merged = { ...current, ...updates };
  setAppConfig('pet_global', merged);
  cmsLogService.log(req, 'pet_config:update', 'pet_global', '', { changed: Object.keys(updates) });
  return res.json(success(null, '保存成功'));
}

// ==================== 时段与限制配置（三餐/运动/逛逛/喂食上限/运动上限） ====================
const SCHEDULE_KEYS = ['pet_meal_times', 'pet_exercise_time', 'pet_explore_times', 'pet_feed_limits', 'pet_exercise_limits'];

function getSchedules(req, res) {
  const config = {};
  for (const key of SCHEDULE_KEYS) {
    config[key] = getAppConfig(key);
  }
  return res.json(success(config));
}

function updateSchedules(req, res) {
  const updates = req.body || {};
  const changed = [];
  for (const key of SCHEDULE_KEYS) {
    if (updates[key] === undefined) continue;
    const current = getAppConfig(key);
    const merged = (updates[key] && typeof updates[key] === 'object' && !Array.isArray(updates[key]))
      ? { ...current, ...updates[key] }
      : updates[key];
    setAppConfig(key, merged);
    changed.push(key);
  }
  if (changed.length === 0) {
    return res.status(400).json(error('没有可更新的配置项', 400));
  }
  cmsLogService.log(req, 'pet_config:update', 'pet_schedule', '', { changed });
  return res.json(success(null, '保存成功'));
}

// ==================== 形象配置（坐标/序列帧/播放速率） ====================
function getSprite(req, res) {
  const config = getAppConfig('pet_sprite');
  return res.json(success(config));
}

function updateSprite(req, res) {
  const updates = req.body || {};
  const current = getAppConfig('pet_sprite');
  const merged = { ...current, ...updates };
  // 序列帧必须是数组，按配置顺序播放
  if (merged.frames !== undefined && !Array.isArray(merged.frames)) {
    return res.status(400).json(error('frames 必须是图片 URL 数组', 400));
  }
  setAppConfig('pet_sprite', merged);
  cmsLogService.log(req, 'pet_config:update', 'pet_sprite', '', { changed: Object.keys(updates) });
  return res.json(success(null, '保存成功'));
}

// ==================== 场景配置（名称/时段背景图/比例） ====================
function getScenes(req, res) {
  const config = getAppConfig('pet_scenes');
  return res.json(success(config));
}

function updateScenes(req, res) {
  const updates = req.body || {};
  const current = getAppConfig('pet_scenes');
  const merged = { ...current, ...updates };
  if (merged.list !== undefined && !Array.isArray(merged.list)) {
    return res.status(400).json(error('list 必须是场景数组', 400));
  }
  if (Array.isArray(merged.list)) {
    for (const scene of merged.list) {
      if (!scene || !scene.key || !scene.name) {
        return res.status(400).json(error('每个场景必须包含 key 和 name', 400));
      }
    }
  }
  setAppConfig('pet_scenes', merged);
  cmsLogService.log(req, 'pet_config:update', 'pet_scenes', '', { changed: Object.keys(updates) });
  return res.json(success(null, '保存成功'));
}

// ==================== 皮肤 ====================
function listSkins(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { keyword } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (keyword) {
    where += ' AND (name LIKE ? OR skin_id LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const list = db.prepare(`SELECT * FROM pet_skins ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`).all(...params, size, offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM pet_skins ${where}`).get(...params).count;
  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

function createSkin(req, res) {
  const { skin_id, species = 'red_panda', name, icon_url, lottie_url, gif_url, static_url, unlock_condition, sort_order = 0, is_enabled = 1 } = req.body;

  if (!skin_id || !String(skin_id).trim()) {
    return res.status(400).json(error('皮肤 ID 不能为空', 400));
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json(error('皮肤名称不能为空', 400));
  }

  const existing = db.prepare('SELECT id FROM pet_skins WHERE skin_id = ?').get(skin_id);
  if (existing) {
    return res.status(400).json(error('皮肤 ID 已存在', 400));
  }

  const id = db.prepare(`
    INSERT INTO pet_skins (skin_id, species, name, icon_url, lottie_url, gif_url, static_url, unlock_condition, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(skin_id, species, name, icon_url || null, lottie_url || null, gif_url || null, static_url || null, unlock_condition || null, sort_order, is_enabled ? 1 : 0).lastInsertRowid;

  cmsLogService.log(req, 'pet_config:create', 'pet_skin', String(id), { skin_id, name });
  return res.json(success({ id }, '创建成功'));
}

function updateSkin(req, res) {
  const { id } = req.params;
  const { skin_id, species, name, icon_url, lottie_url, gif_url, static_url, unlock_condition, sort_order, is_enabled } = req.body;

  const item = db.prepare('SELECT id FROM pet_skins WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('皮肤不存在', 404));
  }

  if (skin_id !== undefined) {
    const existing = db.prepare('SELECT id FROM pet_skins WHERE skin_id = ? AND id != ?').get(skin_id, id);
    if (existing) {
      return res.status(400).json(error('皮肤 ID 已存在', 400));
    }
  }

  db.prepare(`
    UPDATE pet_skins
    SET skin_id = COALESCE(?, skin_id),
        species = COALESCE(?, species),
        name = COALESCE(?, name),
        icon_url = COALESCE(?, icon_url),
        lottie_url = COALESCE(?, lottie_url),
        gif_url = COALESCE(?, gif_url),
        static_url = COALESCE(?, static_url),
        unlock_condition = COALESCE(?, unlock_condition),
        sort_order = COALESCE(?, sort_order),
        is_enabled = COALESCE(?, is_enabled)
    WHERE id = ?
  `).run(
    skin_id !== undefined ? skin_id : null,
    species !== undefined ? species : null,
    name !== undefined ? name : null,
    icon_url !== undefined ? icon_url : null,
    lottie_url !== undefined ? lottie_url : null,
    gif_url !== undefined ? gif_url : null,
    static_url !== undefined ? static_url : null,
    unlock_condition !== undefined ? unlock_condition : null,
    sort_order !== undefined ? sort_order : null,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    id
  );

  cmsLogService.log(req, 'pet_config:update', 'pet_skin', String(id), { skin_id, name });
  return res.json(success(null, '更新成功'));
}

function removeSkin(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM pet_skins WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('皮肤不存在', 404));
  }

  db.prepare('DELETE FROM pet_skins WHERE id = ?').run(id);
  cmsLogService.log(req, 'pet_config:delete', 'pet_skin', String(id), {});
  return res.json(success(null, '删除成功'));
}

// ==================== 状态库 ====================
function serializeJsonField(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : null;
  if (typeof value === 'string') return value.trim() || null;
  return JSON.stringify(value);
}

function parseStateRow(row) {
  if (!row) return row;
  const parse = (key) => {
    const v = row[key];
    if (v === undefined || v === null || v === '') return undefined;
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  };
  return {
    ...row,
    time_ranges: parse('time_ranges'),
    mood_range: parse('mood_range'),
    frames_json: parse('frames_json')
  };
}

function listStates(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { keyword } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (keyword) {
    where += ' AND (name LIKE ? OR state_key LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const rows = db.prepare(`SELECT * FROM pet_states_lib ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`).all(...params, size, offset);
  const list = rows.map(parseStateRow);
  const total = db.prepare(`SELECT COUNT(*) as count FROM pet_states_lib ${where}`).get(...params).count;
  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

function createState(req, res) {
  const {
    state_key, name, lottie_url, gif_url, static_url,
    frames_json, frame_rate, pos_x, pos_y, width, height, scene_key,
    time_ranges, mood_range, duration_minutes, sort_order = 0, is_enabled = 1
  } = req.body;

  if (!state_key || !String(state_key).trim()) {
    return res.status(400).json(error('状态 key 不能为空', 400));
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json(error('状态名称不能为空', 400));
  }

  const existing = db.prepare('SELECT id FROM pet_states_lib WHERE state_key = ?').get(state_key);
  if (existing) {
    return res.status(400).json(error('状态 key 已存在', 400));
  }

  const id = db.prepare(`
    INSERT INTO pet_states_lib (
      state_key, name, lottie_url, gif_url, static_url,
      frames_json, frame_rate, pos_x, pos_y, width, height, scene_key,
      time_ranges, mood_range, duration_minutes, sort_order, is_enabled
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state_key, name, lottie_url || null, gif_url || null, static_url || null,
    serializeJsonField(frames_json),
    frame_rate !== undefined ? frame_rate : 2,
    pos_x !== undefined ? pos_x : null,
    pos_y !== undefined ? pos_y : null,
    width !== undefined ? width : null,
    height !== undefined ? height : null,
    scene_key || null,
    serializeJsonField(time_ranges),
    serializeJsonField(mood_range),
    duration_minutes !== undefined ? duration_minutes : 30,
    sort_order,
    is_enabled ? 1 : 0
  ).lastInsertRowid;

  cmsLogService.log(req, 'pet_config:create', 'pet_state', String(id), { state_key, name });
  return res.json(success({ id }, '创建成功'));
}

function updateState(req, res) {
  const { id } = req.params;
  const {
    state_key, name, lottie_url, gif_url, static_url,
    frames_json, frame_rate, pos_x, pos_y, width, height, scene_key,
    time_ranges, mood_range, duration_minutes, sort_order, is_enabled
  } = req.body;

  const item = db.prepare('SELECT id FROM pet_states_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('状态不存在', 404));
  }

  if (state_key !== undefined) {
    const existing = db.prepare('SELECT id FROM pet_states_lib WHERE state_key = ? AND id != ?').get(state_key, id);
    if (existing) {
      return res.status(400).json(error('状态 key 已存在', 400));
    }
  }

  db.prepare(`
    UPDATE pet_states_lib
    SET state_key = COALESCE(?, state_key),
        name = COALESCE(?, name),
        lottie_url = COALESCE(?, lottie_url),
        gif_url = COALESCE(?, gif_url),
        static_url = COALESCE(?, static_url),
        frames_json = COALESCE(?, frames_json),
        frame_rate = COALESCE(?, frame_rate),
        pos_x = COALESCE(?, pos_x),
        pos_y = COALESCE(?, pos_y),
        width = COALESCE(?, width),
        height = COALESCE(?, height),
        scene_key = COALESCE(?, scene_key),
        time_ranges = COALESCE(?, time_ranges),
        mood_range = COALESCE(?, mood_range),
        duration_minutes = COALESCE(?, duration_minutes),
        sort_order = COALESCE(?, sort_order),
        is_enabled = COALESCE(?, is_enabled)
    WHERE id = ?
  `).run(
    state_key !== undefined ? state_key : null,
    name !== undefined ? name : null,
    lottie_url !== undefined ? lottie_url : null,
    gif_url !== undefined ? gif_url : null,
    static_url !== undefined ? static_url : null,
    frames_json !== undefined ? serializeJsonField(frames_json) : null,
    frame_rate !== undefined ? frame_rate : null,
    pos_x !== undefined ? pos_x : null,
    pos_y !== undefined ? pos_y : null,
    width !== undefined ? width : null,
    height !== undefined ? height : null,
    scene_key !== undefined ? (scene_key || null) : null,
    time_ranges !== undefined ? serializeJsonField(time_ranges) : null,
    mood_range !== undefined ? serializeJsonField(mood_range) : null,
    duration_minutes !== undefined ? duration_minutes : null,
    sort_order !== undefined ? sort_order : null,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    id
  );

  cmsLogService.log(req, 'pet_config:update', 'pet_state', String(id), { state_key, name });
  return res.json(success(null, '更新成功'));
}

function removeState(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM pet_states_lib WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('状态不存在', 404));
  }

  db.prepare('DELETE FROM pet_states_lib WHERE id = ?').run(id);
  cmsLogService.log(req, 'pet_config:delete', 'pet_state', String(id), {});
  return res.json(success(null, '删除成功'));
}

// ==================== 运动库（pet_exercise_lib：非器械/器械运动，可关联跟练课程） ====================
function listExercises(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { keyword } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (keyword) {
    where += ' AND (e.name LIKE ? OR e.exercise_key LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const list = db.prepare(`
    SELECT e.*, s.name AS equipment_name, w.name AS workout_name
    FROM pet_exercise_lib e
    LEFT JOIN shop_items s ON s.id = e.equipment_item_id
    LEFT JOIN workout_lib w ON w.workout_key = e.workout_key
    ${where}
    ORDER BY e.sort_order ASC, e.id ASC LIMIT ? OFFSET ?
  `).all(...params, size, offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM pet_exercise_lib e ${where}`).get(...params).count;
  return res.json(success({ list, pagination: { page, size, total, has_more: total > page * size } }));
}

function validateExercise(body) {
  const { exercise_key, name, use_equipment, equipment_item_id, has_workout, workout_key } = body;
  if (!exercise_key || !String(exercise_key).trim()) return '运动 key 不能为空';
  if (!name || !String(name).trim()) return '运动名称不能为空';
  if (use_equipment) {
    if (!equipment_item_id) return '选择使用器械时必须选择器械';
    const item = db.prepare("SELECT id FROM shop_items WHERE id = ? AND category = 'equipment'").get(equipment_item_id);
    if (!item) return '所选器械不存在或不是器材类商品';
  }
  if (has_workout) {
    if (!workout_key) return '选择跟练时必须选择跟练课程';
    const workout = db.prepare('SELECT id FROM workout_lib WHERE workout_key = ?').get(workout_key);
    if (!workout) return '所选跟练课程不存在';
  }
  return null;
}

function createExercise(req, res) {
  const body = req.body || {};
  const err = validateExercise(body);
  if (err) return res.status(400).json(error(err, 400));

  const existing = db.prepare('SELECT id FROM pet_exercise_lib WHERE exercise_key = ?').get(body.exercise_key);
  if (existing) return res.status(400).json(error('运动 key 已存在', 400));

  const id = db.prepare(`
    INSERT INTO pet_exercise_lib (exercise_key, name, use_equipment, equipment_item_id, anim_url, has_workout, workout_key, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(body.exercise_key).trim(),
    String(body.name).trim(),
    body.use_equipment ? 1 : 0,
    body.use_equipment ? body.equipment_item_id : null,
    body.anim_url || null,
    body.has_workout ? 1 : 0,
    body.has_workout ? body.workout_key : null,
    body.sort_order || 0,
    body.is_enabled === undefined ? 1 : (body.is_enabled ? 1 : 0)
  ).lastInsertRowid;

  cmsLogService.log(req, 'pet_config:create', 'pet_exercise', String(id), { exercise_key: body.exercise_key, name: body.name });
  return res.json(success({ id }, '创建成功'));
}

function updateExercise(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const item = db.prepare('SELECT * FROM pet_exercise_lib WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('运动不存在', 404));

  if (body.exercise_key !== undefined) {
    const existing = db.prepare('SELECT id FROM pet_exercise_lib WHERE exercise_key = ? AND id != ?').get(body.exercise_key, id);
    if (existing) return res.status(400).json(error('运动 key 已存在', 400));
  }

  const merged = { ...item, ...body };
  const err = validateExercise(merged);
  if (err) return res.status(400).json(error(err, 400));

  db.prepare(`
    UPDATE pet_exercise_lib
    SET exercise_key = ?, name = ?, use_equipment = ?, equipment_item_id = ?,
        anim_url = ?, has_workout = ?, workout_key = ?, sort_order = ?, is_enabled = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    String(merged.exercise_key).trim(),
    String(merged.name).trim(),
    merged.use_equipment ? 1 : 0,
    merged.use_equipment ? merged.equipment_item_id : null,
    merged.anim_url || null,
    merged.has_workout ? 1 : 0,
    merged.has_workout ? merged.workout_key : null,
    merged.sort_order || 0,
    merged.is_enabled ? 1 : 0,
    id
  );

  cmsLogService.log(req, 'pet_config:update', 'pet_exercise', String(id), { exercise_key: merged.exercise_key, name: merged.name });
  return res.json(success(null, '更新成功'));
}

function removeExercise(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM pet_exercise_lib WHERE id = ?').get(id);
  if (!item) return res.status(404).json(error('运动不存在', 404));

  db.prepare('DELETE FROM pet_exercise_lib WHERE id = ?').run(id);
  cmsLogService.log(req, 'pet_config:delete', 'pet_exercise', String(id), {});
  return res.json(success(null, '删除成功'));
}

// ==================== 对话（复用 cmsDialogueController）====================
const dialogues = {
  list: cmsDialogueController.list,
  getById: cmsDialogueController.getById,
  create: cmsDialogueController.create,
  update: cmsDialogueController.update,
  remove: cmsDialogueController.remove
};

module.exports = {
  getGlobal,
  updateGlobal,
  getSchedules,
  updateSchedules,
  getSprite,
  updateSprite,
  getScenes,
  updateScenes,
  listSkins,
  createSkin,
  updateSkin,
  removeSkin,
  listStates,
  createState,
  updateState,
  removeState,
  listExercises,
  createExercise,
  updateExercise,
  removeExercise,
  dialogues
};
