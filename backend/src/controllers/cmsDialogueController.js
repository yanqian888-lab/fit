/**
 * CMS 宠物对话配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const SCENES = ['feed', 'play', 'hug', 'explore_return', 'reward', 'greet', 'pet_tap', 'task_reward', 'checkin_reward', 'achievement_reward', 'milestone_reward', 'newbie_task_reward', 'joy_event', 'weight_goal_reached'];

function list(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { scene, keyword } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (scene) {
    where += ' AND scene = ?';
    params.push(scene);
  }

  if (keyword) {
    where += ' AND text LIKE ?';
    params.push(`%${keyword}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM pet_dialogues ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT * FROM pet_dialogues
    ${where}
    ORDER BY scene ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    scenes: SCENES,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

function getById(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM pet_dialogues WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('对话不存在', 404));
  }
  return res.json(success(item));
}

function create(req, res) {
  const { scene, text, weight = 1, probability = 1, is_enabled = 1 } = req.body;

  if (!scene || !String(scene).trim()) {
    return res.status(400).json(error('场景不能为空', 400));
  }
  if (!text || !String(text).trim()) {
    return res.status(400).json(error('对话内容不能为空', 400));
  }

  const id = db.prepare(`
    INSERT INTO pet_dialogues (scene, text, weight, probability, is_enabled)
    VALUES (?, ?, ?, ?, ?)
  `).run(scene, String(text).trim(), weight, probability, is_enabled ? 1 : 0).lastInsertRowid;

  cmsLogService.log(req, 'dialogue_config:create', 'pet_dialogue', String(id), { scene });
  return res.json(success({ id }, '创建成功'));
}

function update(req, res) {
  const { id } = req.params;
  const { scene, text, weight, probability, is_enabled } = req.body;

  const item = db.prepare('SELECT id FROM pet_dialogues WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('对话不存在', 404));
  }

  db.prepare(`
    UPDATE pet_dialogues
    SET scene = COALESCE(?, scene),
        text = COALESCE(?, text),
        weight = COALESCE(?, weight),
        probability = COALESCE(?, probability),
        is_enabled = COALESCE(?, is_enabled)
    WHERE id = ?
  `).run(
    scene !== undefined ? scene : null,
    text !== undefined ? String(text).trim() : null,
    weight !== undefined ? weight : null,
    probability !== undefined ? probability : null,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
    id
  );

  cmsLogService.log(req, 'dialogue_config:update', 'pet_dialogue', String(id), { scene });
  return res.json(success(null, '更新成功'));
}

function remove(req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT id FROM pet_dialogues WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json(error('对话不存在', 404));
  }

  db.prepare('DELETE FROM pet_dialogues WHERE id = ?').run(id);
  cmsLogService.log(req, 'dialogue_config:delete', 'pet_dialogue', String(id), {});
  return res.json(success(null, '删除成功'));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};
