/**
 * 奖励回执服务
 * 当用户完成任务、签到、成就、里程碑、新手任务、小确幸或达到目标体重时，
 * 由搭搭/管家自动发送一条恭喜消息到聊天列表。
 */
const { db } = require('../db');

const FALLBACKS = {
  task_reward: '任务完成！获得 {berries} 浆果 {flowers} 鲜花，搭搭为你点赞～',
  checkin_reward: '连续签到 {continuousDays} 天，获得 {berries} 浆果 {flowers} 鲜花，继续加油！',
  achievement_reward: '解锁成就「{name}」！{description} 获得 {flowers} 鲜花，太棒了～',
  milestone_reward: '达成里程碑：{title}！{description}',
  newbie_task_reward: '新手任务「{name}」完成！获得 {berries} 浆果，继续前进～',
  joy_event: '小确幸：{title}！{description} 奖励已到账～',
  weight_goal_reached: '太厉害了！你达到了目标体重 {targetWeight}kg，搭搭真替你骄傲～'
};

function getPartnerMode(userId) {
  const row = db.prepare('SELECT mode FROM partners WHERE user_id = ?').get(userId);
  return row?.mode || 'gentle';
}

function getDialogue(scene) {
  const list = db.prepare('SELECT * FROM pet_dialogues WHERE scene = ? AND is_enabled = 1').all(scene);
  if (list.length === 0) return null;
  const enabled = list.filter(d => Math.random() <= (d.probability || 1));
  if (enabled.length === 0) return null;
  const totalWeight = enabled.reduce((sum, d) => sum + (d.weight || 1), 0);
  let rand = Math.random() * totalWeight;
  for (const d of enabled) {
    rand -= (d.weight || 1);
    if (rand <= 0) return d.text;
  }
  return enabled[0].text;
}

function render(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

function insertMessage(userId, content) {
  const mode = getPartnerMode(userId);
  const insert = db.prepare(`
    INSERT INTO chat_messages (user_id, role, content, content_type, mode)
    VALUES (?, 'partner', ?, 'text', ?)
  `);
  return insert.run(userId, content, mode).lastInsertRowid;
}

function buildVars(source, payload) {
  const safe = (v) => v === undefined || v === null ? '' : v;
  return {
    name: safe(payload.name),
    title: safe(payload.title || payload.name),
    description: safe(payload.description),
    berries: safe(payload.berries || 0),
    flowers: safe(payload.flowers || 0),
    continuousDays: safe(payload.continuousDays || 1),
    targetWeight: safe(payload.targetWeight),
    unit: safe(payload.unit)
  };
}

/**
 * 生成奖励回执内容（不写入聊天消息，由接口返回给前端 toast 展示）
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.source task_reward | checkin_reward | achievement_reward | milestone_reward | newbie_task_reward | joy_event | weight_goal_reached
 * @param {object} params.payload 替换占位符的变量
 * @returns {{messageId: number|null, content: string}}
 */
function send({ userId, source, payload = {} }) {
  if (!userId || !source) return { messageId: null, content: '' };

  const scene = source;
  const vars = buildVars(source, payload);
  const template = getDialogue(scene) || FALLBACKS[source] || '奖励已到账，搭搭为你开心～';
  const content = render(template, vars);

  console.log(`[奖励回执] ${source} -> user ${userId}: ${content}`);
  return { messageId: null, content };
}

/**
 * 检查体重是否达到目标，若达到且 30 天内未恭喜过，则发送庆祝消息
 * @param {number} userId
 * @param {number} currentWeight
 */
function checkWeightGoalReached(userId, currentWeight) {
  if (!userId || currentWeight === undefined || currentWeight === null) return null;
  const profile = db.prepare('SELECT initial_weight, target_weight FROM user_profiles WHERE user_id = ?').get(userId);
  if (!profile || !profile.target_weight) return null;
  const target = parseFloat(profile.target_weight);
  const initial = profile.initial_weight ? parseFloat(profile.initial_weight) : null;
  if (!target || currentWeight > target) return null;
  if (initial !== null && initial <= target) return null; // 目标不低于初始体重，避免无意义触发

  // 30 天内是否已经恭喜过
  const recent = db.prepare(`
    SELECT COUNT(*) as count FROM chat_messages
    WHERE user_id = ? AND role = 'partner' AND content LIKE '%目标体重%'
      AND created_at >= datetime('now', '-30 days')
  `).get(userId).count;
  if (recent > 0) return null;

  return send({ userId, source: 'weight_goal_reached', payload: { targetWeight: target, unit: 'kg' } });
}

module.exports = {
  send,
  checkWeightGoalReached
};
