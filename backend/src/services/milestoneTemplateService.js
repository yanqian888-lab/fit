/**
 * 里程碑文案模板管理
 */
const { db } = require('../db');

const DEFAULT_TEMPLATES = {
  weight_loss: [
    { value: 2.5, content: '太棒了！累计减重{value}kg，你的努力正在开花结果，继续加油！' },
    { value: 5, content: '恭喜达成减重{value}kg里程碑！每一步都算数，你比昨天更优秀！' },
    { value: 10, content: '减重{value}kg达成！坚持就是胜利，你正在变成更好的自己！' },
    { value: 15, content: '哇！{value}kg的目标达成！你的自律和坚持让人佩服！' },
    { value: 20, content: '里程碑达成！{value}kg的蜕变，证明你的努力没有白费！' },
    { value: 30, content: '不可思议！累计减重{value}kg，你已经完成了了不起的蜕变！' }
  ],
  duration: [
    { value: 7, content: '坚持减肥第{value}天！你的毅力让人佩服，继续冲！' },
    { value: 30, content: '第{value}天打卡！日复一日的坚持，正在悄悄改变你！' },
    { value: 60, content: '{value}天的坚持，你已经超越了大多数人，继续保持！' },
    { value: 100, content: '恭喜坚持{value}天！习惯的力量正在带你走向更好的自己！' },
    { value: 180, content: '{value}天不是终点，而是新起点，你真的很棒！' },
    { value: 365, content: '整整{value}天！你已经是自律生活的主角，未来可期！' }
  ],
  checkin: [
    { value: 7, content: '累计打卡{value}天！你的自律正在开花结果，太厉害了！' },
    { value: 30, content: '{value}天打卡达成！每一次记录都是对自己的承诺！' },
    { value: 60, content: '恭喜打卡{value}天！坚持记录的人，运气都不会太差！' },
    { value: 100, content: '{value}天的打卡记录，见证了你每一天的努力！' }
  ]
};

function list() {
  return db.prepare(`
    SELECT id, type, value, content, sort_order, is_enabled, created_at, updated_at
    FROM milestone_templates
    ORDER BY type ASC, sort_order ASC, id ASC
  `).all();
}

function listEnabledByType(type, value = null) {
  // 优先匹配该 value 专用的文案
  const exact = db.prepare(`
    SELECT content FROM milestone_templates
    WHERE type = ? AND is_enabled = 1 AND value = ?
    ORDER BY sort_order ASC, id ASC
  `).all(type, value).map(r => r.content);
  if (exact.length > 0) return exact;

  // 没有专用文案时，回退到通用文案（value 为空）
  return db.prepare(`
    SELECT content FROM milestone_templates
    WHERE type = ? AND is_enabled = 1 AND value IS NULL
    ORDER BY sort_order ASC, id ASC
  `).all(type).map(r => r.content);
}

function detail(id) {
  return db.prepare(`
    SELECT id, type, value, content, sort_order, is_enabled, created_at, updated_at
    FROM milestone_templates WHERE id = ?
  `).get(id);
}

function create(data) {
  const result = db.prepare(`
    INSERT INTO milestone_templates (type, value, content, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.type,
    data.value !== undefined && data.value !== '' && data.value !== null ? Number(data.value) : null,
    data.content,
    data.sort_order ?? 0,
    data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1
  );
  return detail(result.lastInsertRowid);
}

function update(id, data) {
  const existing = detail(id);
  if (!existing) return null;
  db.prepare(`
    UPDATE milestone_templates SET
      type = COALESCE(?, type),
      value = COALESCE(?, value),
      content = COALESCE(?, content),
      sort_order = COALESCE(?, sort_order),
      is_enabled = COALESCE(?, is_enabled),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.type ?? null,
    data.value !== undefined ? (data.value !== '' && data.value !== null ? Number(data.value) : null) : null,
    data.content ?? null,
    data.sort_order ?? null,
    data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : null,
    id
  );
  return detail(id);
}

function remove(id) {
  const result = db.prepare(`DELETE FROM milestone_templates WHERE id = ?`).run(id);
  return result.changes > 0;
}

function seedDefaults() {
  let sortIndex = 0;
  for (const [type, items] of Object.entries(DEFAULT_TEMPLATES)) {
    items.forEach((item) => {
      const existing = db.prepare(`SELECT id FROM milestone_templates WHERE type = ? AND content = ?`).get(type, item.content);
      if (existing) {
        db.prepare(`
          UPDATE milestone_templates
          SET value = ?, sort_order = ?, is_enabled = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(item.value, sortIndex, existing.id);
      } else {
        db.prepare(`
          INSERT INTO milestone_templates (type, value, content, sort_order, is_enabled)
          VALUES (?, ?, ?, ?, 1)
        `).run(type, item.value, item.content, sortIndex);
      }
      sortIndex++;
    });
  }
}

function getRandomTemplate(type, value) {
  let templates = listEnabledByType(type, value);
  if (templates.length === 0) {
    const defaults = DEFAULT_TEMPLATES[type] || [{ content: '恭喜达成 {value} 里程碑！' }];
    templates = defaults.map(item => item.content || item);
  }
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace(/\{value\}/g, value);
}

module.exports = {
  list,
  listEnabledByType,
  detail,
  create,
  update,
  remove,
  seedDefaults,
  getRandomTemplate
};
