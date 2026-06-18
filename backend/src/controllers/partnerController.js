/**
 * 搭子控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

const STATUSES = [
  { status: 'awake', text: '刚刚起床' },
  { status: 'eating', text: '正在吃饭' },
  { status: 'working', text: '在上班' },
  { status: 'studying', text: '在学习' },
  { status: 'exercising', text: '在运动' },
  { status: 'sleeping', text: '已经睡了' }
];

/**
 * 获取搭子设置
 */
function getPartner(req, res) {
  const userId = req.userId;
  const partner = db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId);

  if (!partner) {
    return res.status(404).json(error('搭子不存在', 404));
  }

  return res.json(success({
    name: partner.name,
    gender: partner.gender,
    mode: partner.mode,
    voice_speed: partner.voice_speed,
    strictness: partner.strictness,
    humor: partner.humor,
    status: partner.status,
    status_text: partner.status_text
  }));
}

/**
 * 更新搭子设置
 */
function updatePartner(req, res) {
  const userId = req.userId;
  const { name, gender, mode, voice_speed, strictness, humor } = req.body;

  db.prepare(`
    UPDATE partners
    SET name = COALESCE(?, name),
        gender = COALESCE(?, gender),
        mode = COALESCE(?, mode),
        voice_speed = COALESCE(?, voice_speed),
        strictness = COALESCE(?, strictness),
        humor = COALESCE(?, humor),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(name, gender, mode, voice_speed, strictness, humor, userId);

  return res.json(success(null, '搭子设置更新成功'));
}

/**
 * 切换搭子模式
 */
function switchMode(req, res) {
  const userId = req.userId;
  const { mode } = req.body;

  if (!['gentle', 'strict', 'tease'].includes(mode)) {
    return res.status(400).json(error('无效的模式', 400));
  }

  db.prepare('UPDATE partners SET mode = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
    .run(mode, userId);

  return res.json(success({ mode }, '模式切换成功'));
}

/**
 * 获取搭子状态
 */
function getStatus(req, res) {
  const userId = req.userId;
  const partner = db.prepare('SELECT status, status_text, status_updated_at FROM partners WHERE user_id = ?').get(userId);

  if (!partner) {
    return res.status(404).json(error('搭子不存在', 404));
  }

  return res.json(success({
    status: partner.status,
    status_text: partner.status_text,
    updated_at: partner.status_updated_at
  }));
}

/**
 * 更新搭子状态（定时任务调用）
 */
function updatePartnerStatus() {
  const now = new Date();
  const hour = now.getHours();

  let index = 0;
  if (hour >= 6 && hour < 8) index = 0;
  else if (hour >= 8 && hour < 12) index = 2;
  else if (hour >= 12 && hour < 14) index = 1;
  else if (hour >= 14 && hour < 18) index = 2;
  else if (hour >= 18 && hour < 20) index = 1;
  else if (hour >= 20 && hour < 22) index = 4;
  else index = 5;

  const statusInfo = STATUSES[index];

  db.prepare(`
    UPDATE partners
    SET status = ?, status_text = ?, status_updated_at = CURRENT_TIMESTAMP
    WHERE status_updated_at < datetime('now', '-2 hours')
  `).run(statusInfo.status, statusInfo.text);
}

module.exports = {
  getPartner,
  updatePartner,
  switchMode,
  getStatus,
  updatePartnerStatus
};
