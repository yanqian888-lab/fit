/**
 * 搭子控制器
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');

// 工作日状态
const WORKDAY_STATUSES = {
  work: [
    { status: 'awake', text: '刚刚起床' },
    { status: 'eating', text: '正在吃饭' },
    { status: 'working', text: '在上班' },
    { status: 'working', text: '在上班' },
    { status: 'exercising', text: '在运动' },
    { status: 'sleeping', text: '已经睡了' }
  ],
  student: [
    { status: 'awake', text: '刚刚起床' },
    { status: 'eating', text: '正在吃饭' },
    { status: 'studying', text: '在上课' },
    { status: 'studying', text: '在学习' },
    { status: 'exercising', text: '在运动' },
    { status: 'sleeping', text: '已经睡了' }
  ]
};

// 周末/节假日状态（学生）
const WEEKEND_STUDENT_STATUSES = [
  { status: 'awake', text: '刚刚起床' },
  { status: 'eating', text: '正在吃饭' },
  { status: 'studying', text: '在写作业' },
  { status: 'gaming', text: '在打游戏' },
  { status: 'exercising', text: '在运动' },
  { status: 'sleeping', text: '已经睡了' },
  { status: 'shopping', text: '在逛街' },
  { status: 'partying', text: '在聚会' },
  { status: 'entertaining', text: '在娱乐' },
  { status: 'relaxing', text: '在躺平' }
];

// 周末/节假日状态（上班族）
const WEEKEND_WORK_STATUSES = [
  { status: 'awake', text: '刚刚起床' },
  { status: 'eating', text: '正在吃饭' },
  { status: 'working', text: '在加班' },
  { status: 'gaming', text: '在打游戏' },
  { status: 'exercising', text: '在运动' },
  { status: 'sleeping', text: '已经睡了' },
  { status: 'shopping', text: '在逛街' },
  { status: 'partying', text: '在聚会' },
  { status: 'entertaining', text: '在娱乐' },
  { status: 'relaxing', text: '在发呆' },
  { status: 'sleeping', text: '在补觉' }
];

// 中国法定节假日（简化版，2024-2026年）
const HOLIDAYS = [
  '01-01', // 元旦
  '02-10', '02-11', '02-12', '02-13', '02-14', '02-15', '02-16', '02-17', // 2024春节
  '04-04', '04-05', '04-06', // 清明
  '05-01', '05-02', '05-03', '05-04', '05-05', // 劳动节
  '06-10', // 端午
  '09-15', '09-16', '09-17', // 中秋
  '10-01', '10-02', '10-03', '10-04', '10-05', '10-06', '10-07', // 国庆
];

/**
 * 判断是否是周末或节假日
 */
function isWeekendOrHoliday(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return true; // 周六或周日
  
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  const dateStr = `${month}-${dayOfMonth}`;
  return HOLIDAYS.includes(dateStr);
}

/**
 * 获取随机周末状态
 */
function getRandomWeekendStatus(statusList, hour) {
  // 根据时间段筛选合适的状态
  let available = [];
  
  if (hour >= 6 && hour < 8) {
    available = statusList.filter(s => s.text === '刚刚起床');
  } else if (hour >= 8 && hour < 11) {
    available = statusList.filter(s => 
      ['在写作业', '在打游戏', '在逛街', '在娱乐', '在发呆', '在补觉'].includes(s.text)
    );
  } else if (hour >= 11 && hour < 13) {
    available = statusList.filter(s => s.text === '正在吃饭');
  } else if (hour >= 13 && hour < 17) {
    available = statusList.filter(s => 
      ['在写作业', '在打游戏', '在逛街', '在娱乐', '在发呆', '在补觉', '在聚会'].includes(s.text)
    );
  } else if (hour >= 17 && hour < 19) {
    available = statusList.filter(s => s.text === '正在吃饭');
  } else if (hour >= 19 && hour < 22) {
    available = statusList.filter(s => 
      ['在运动', '在打游戏', '在娱乐', '在聚会'].includes(s.text)
    );
  } else {
    available = statusList.filter(s => s.text === '已经睡了');
  }
  
  if (available.length === 0) {
    available = statusList;
  }
  
  return available[Math.floor(Math.random() * available.length)];
}

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

  if (mode && !['gentle', 'strict', 'tease'].includes(mode)) {
    return res.status(400).json(error('搭子模式不合法', 400));
  }
  if (gender !== undefined && gender !== null && ![0, 1, 2].includes(parseInt(gender))) {
    return res.status(400).json(error('性别参数不合法', 400));
  }
  for (const field of [voice_speed, strictness, humor]) {
    if (field !== undefined && field !== null) {
      const val = parseInt(field);
      if (isNaN(val) || val < 1 || val > 10) {
        return res.status(400).json(error('语速/严格度/幽默度必须在 1-10 之间', 400));
      }
    }
  }
  if (name && name.length > 20) {
    return res.status(400).json(error('搭子昵称不能超过 20 字', 400));
  }

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
 * 根据用户年龄区分：22岁及以下显示"在上课/在学习"，23岁及以上显示"在上班"
 * 周末/节假日显示休闲状态
 */
function updatePartnerStatus(force = false) {
  const now = new Date();
  const hour = now.getHours();
  const isWeekend = isWeekendOrHoliday(now);

  // 获取所有用户及其年龄
  const users = db.prepare(`
    SELECT p.user_id, u.age 
    FROM partners p 
    JOIN users u ON p.user_id = u.id
  `).all();

  for (const user of users) {
    const isStudent = (user.age && user.age <= 22);
    let statusInfo;

    if (isWeekend) {
      // 周末/节假日：随机休闲状态
      const statusList = isStudent ? WEEKEND_STUDENT_STATUSES : WEEKEND_WORK_STATUSES;
      statusInfo = getRandomWeekendStatus(statusList, hour);
    } else {
      // 工作日：按时间段固定状态
      const statusList = isStudent ? WORKDAY_STATUSES.student : WORKDAY_STATUSES.work;
      
      let index = 0;
      if (hour >= 6 && hour < 8) index = 0;      // 6-8点：刚刚起床
      else if (hour >= 8 && hour < 11) index = 2;  // 8-11点：在上课/在上班
      else if (hour >= 11 && hour < 13) index = 1; // 11-13点：正在吃饭（午饭时间）
      else if (hour >= 13 && hour < 17) index = 3;  // 13-17点：在学习/在上班
      else if (hour >= 17 && hour < 19) index = 1; // 17-19点：正在吃饭（晚饭时间）
      else if (hour >= 19 && hour < 22) index = 4; // 19-22点：在运动
      else if (hour >= 22 || hour < 6) index = 5;  // 22-6点：已经睡了

      statusInfo = statusList[index];
    }

    let updateSql = `
      UPDATE partners
      SET status = ?, status_text = ?, status_updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    if (!force) {
      updateSql += ` AND status_updated_at < datetime('now', '-30 minutes')`;
    }
    db.prepare(updateSql).run(statusInfo.status, statusInfo.text, user.user_id);
  }
}

module.exports = {
  getPartner,
  updatePartner,
  switchMode,
  getStatus,
  updatePartnerStatus
};
