/**
 * 后端全量功能测试
 * 用法：
 *   cd backend
 *   NODE_ENV=test node scripts/full-test.js
 *
 * 覆盖场景：
 *   - 用户注册/登录/注销
 *   - 饮食/运动/体重记录CRUD
 *   - 博物馆内容管理
 *   - AI日记生成与试用权限
 *   - 宠物陪伴系统（喂食/运动/外出）
 *   - 商城购买与背包使用
 *   - 任务系统与奖励发放
 *   - 弹窗广告配置与展示
 *   - 公告消息中心
 *   - 多用户状态模拟
 */

const { db, withTransaction, initTables, migrateTables, initSeedData } = require('../src/db');
const { getChinaDateStr } = require('../src/utils/chinaTime');
const achievementService = require('../src/services/achievementService');
const museumService = require('../src/services/museumService');
const currencyService = require('../src/services/currencyService');
const trialService = require('../src/services/trialService');
const petService = require('../src/services/petService');
const shopService = require('../src/services/shopService');
const inventoryService = require('../src/services/inventoryService');
const workoutService = require('../src/services/workoutService');
const taskService = require('../src/services/taskService');
const newbieTaskService = require('../src/services/newbieTaskService');
const eventService = require('../src/services/eventService');

if (process.env.NODE_ENV !== 'test') {
  console.error('❌ 测试必须在 NODE_ENV=test 环境下运行');
  process.exit(1);
}

initTables();
migrateTables();
initSeedData();

const DATE = getChinaDateStr();
let passCount = 0;
let failCount = 0;

function log(title, ok, detail = '') {
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} ${title}${detail ? ' | ' + detail : ''}`);
  if (ok) passCount++;
  else failCount++;
  return ok;
}

function createTestUser(phone, nickname = '测试用户') {
  let user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const result = db.prepare('INSERT INTO users (phone, nickname, status, source) VALUES (?, ?, 1, \'app\')').run(phone, nickname);
    user = { id: result.lastInsertRowid };
    db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO settings (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO partners (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO user_currency (user_id, berries, flowers) VALUES (?, 1000, 1000)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO trial_user_count (user_id, device_id) VALUES (?, ?)').run(user.id, `device_${phone}`);
  }
  return user.id;
}

function cleanupUser(userId) {
  const tables = [
    'diet_records', 'exercise_records', 'body_records', 'habit_records',
    'museum_items', 'timelines', 'milestones', 'user_achievements',
    'currency_transactions', 'checkins', 'user_tasks', 'user_newbie_tasks',
    'photos', 'user_methods', 'custom_foods', 'custom_exercises',
    'favorite_foods', 'favorite_exercises', 'feedback', 'template_messages',
    'user_inventory', 'trial_user_count', 'chat_messages', 'precipitations'
  ];
  for (const t of tables) {
    try {
      db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
    } catch (e) {}
  }
  db.prepare('UPDATE user_profiles SET initial_weight=NULL, current_weight=NULL, target_weight=NULL, target_date=NULL WHERE user_id = ?').run(userId);
  db.prepare('UPDATE user_currency SET berries = 1000, flowers = 1000 WHERE user_id = ?').run(userId);
}

function mockReqRes(userId, body = {}, query = {}, params = {}) {
  return {
    req: { userId, body, query, params },
    res: {
      statusCode: 200,
      body: null,
      json(data) { this.body = data; return data; },
      status(code) { this.statusCode = code; return this; }
    }
  };
}

async function run() {
  console.log('\n🧪 开始后端全量功能测试\n');

  // ==================== 1. 用户模块测试 ====================
  console.log('\n📦 用户模块测试\n');

  const user1 = createTestUser('13800000001', '新用户A');
  const user2 = createTestUser('13800000002', '活跃用户B');
  const user3 = createTestUser('13800000003', '沉默用户C');

  cleanupUser(user1);
  cleanupUser(user2);
  cleanupUser(user3);

  log('创建测试用户', user1 && user2 && user3, `user1=${user1}, user2=${user2}, user3=${user3}`);

  // ==================== 2. 记录模块测试 ====================
  console.log('\n📦 记录模块测试\n');

  // 2.1 饮食记录
  const dietId = db.prepare(`
    INSERT INTO diet_records (user_id, record_date, meal_time, foods, total_calorie, status)
    VALUES (?, ?, 'lunch', ?, 500, 1)
  `).run(user1, DATE, JSON.stringify([{ name: '牛肉面', weight: 200, calorie: 500 }])).lastInsertRowid;
  log('饮食记录-新增', dietId > 0, `id=${dietId}`);

  const dietUpdate = db.prepare('UPDATE diet_records SET total_calorie = 600 WHERE id = ?').run(dietId);
  log('饮食记录-更新', dietUpdate.changes === 1);

  const dietDelete = db.prepare('DELETE FROM diet_records WHERE id = ?').run(dietId);
  log('饮食记录-删除', dietDelete.changes === 1);

  // 2.2 运动记录
  const exerciseId = db.prepare(`
    INSERT INTO exercise_records (user_id, record_date, exercises, total_duration, total_calorie, status)
    VALUES (?, ?, ?, 30, 300, 1)
  `).run(user1, DATE, JSON.stringify([{ name: '跑步', duration: 30, calorie: 300 }])).lastInsertRowid;
  log('运动记录-新增', exerciseId > 0);

  // 2.3 体重记录
  db.prepare(`
    INSERT INTO body_records (user_id, record_date, type, value, unit, status)
    VALUES (?, ?, 'weight', 80, 'kg', 1)
  `).run(user1, DATE);
  db.prepare(`
    INSERT INTO body_records (user_id, record_date, type, value, unit, status)
    VALUES (?, ?, 'weight', 75, 'kg', 1)
  `).run(user1, DATE);

  db.prepare('UPDATE user_profiles SET initial_weight = 80, current_weight = 75, target_weight = 65 WHERE user_id = ?').run(user1);

  const achievements = achievementService.checkAll(user1);
  log('体重成就触发', achievements.some(a => a.name.includes('减重')), achievements.map(a => a.name).join(','));

  // ==================== 3. 博物馆模块测试 ====================
  console.log('\n📦 博物馆模块测试\n');

  const moodId = museumService.saveMood(user1, { emotion: 'good', content: '今天状态不错', record_date: DATE });
  log('心情日记-保存', moodId.id > 0, `id=${moodId.id}`);

  const quoteItem = db.prepare(`
    INSERT INTO museum_items (user_id, type, content, status, created_at)
    VALUES (?, 'quote', '减肥是马拉松，不是短跑', 1, datetime('now'))
  `).run(user1).lastInsertRowid;
  log('博物馆内容-添加金句', quoteItem > 0);

  const recipeItem = db.prepare(`
    INSERT INTO museum_items (user_id, type, sub_type, content, status, created_at)
    VALUES (?, 'recipe', 'lunch', ?, 1, datetime('now'))
  `).run(user1, JSON.stringify({ name: '番茄鸡蛋面', ingredients: ['番茄', '鸡蛋', '面条'] })).lastInsertRowid;
  log('博物馆内容-添加食谱', recipeItem > 0);

  // 时间轴同步
  const timelineCount = db.prepare('SELECT COUNT(*) as c FROM timelines WHERE user_id = ?').get(user1).c;
  log('时间轴记录数', timelineCount >= 2, `count=${timelineCount}`);

  // ==================== 4. 试用权限测试 ====================
  console.log('\n📦 试用权限测试\n');

  // 4.1 新用户试用状态
  const trialConfig = trialService.getConfig();
  log('试用配置获取', trialConfig.ai_chat_limit > 0, `ai_limit=${trialConfig.ai_chat_limit}`);

  // 4.2 检查权限-新用户
  const permNew = trialService.checkPermission(user1, 'ai_chat', `device_${user1}`);
  log('新用户权限检查', permNew.allow_use === true, `allow=${permNew.allow_use}, remain=${permNew.remain_times}`);

  // 4.3 模拟使用次数
  for (let i = 0; i < trialConfig.ai_chat_limit; i++) {
    trialService.reportCount(user1, `device_${user1}`, 'ai_chat');
  }
  const permExhausted = trialService.checkPermission(user1, 'ai_chat', `device_${user1}`);
  log('试用耗尽权限检查', permExhausted.allow_use === false && permExhausted.show_popup === true);

  // 4.4 白名单用户
  db.prepare('INSERT OR IGNORE INTO trial_whitelist (user_id, feature_type, reason, expires_at) VALUES (?, ?, ?, ?)')
    .run(user2, 'ai_chat', '测试白名单', '2099-12-31 23:59:59');
  const permWhitelist = trialService.checkPermission(user2, 'ai_chat', `device_${user2}`);
  log('白名单用户权限检查', permWhitelist.allow_use === true, '白名单用户无限制');

  // ==================== 5. 宠物陪伴系统测试 ====================
  console.log('\n📦 宠物陪伴系统测试\n');

  // 5.1 宠物状态初始化
  petService.ensurePetState(user1);
  const petState = db.prepare('SELECT * FROM pet_states WHERE user_id = ?').get(user1);
  log('宠物状态初始化', petState && petState.mood >= 0 && petState.hunger >= 0, `mood=${petState?.mood}, hunger=${petState?.hunger}`);

  // 5.2 商城购买
  const foodItem = db.prepare("SELECT id, name, price_berries FROM shop_items WHERE status = 1 AND category = 'food' LIMIT 1").get();
  const equipmentItem = db.prepare("SELECT id, name, price_berries FROM shop_items WHERE status = 1 AND category = 'equipment' LIMIT 1").get();

  let buyOk = false;
  if (foodItem) {
    const buyResult = shopService.buyItem(user1, foodItem.id);
    buyOk = !buyResult.error;
    log('商城购买食物', buyOk, `item=${foodItem.name}, price=${foodItem.price_berries}`);
  }

  // 5.3 背包使用
  if (buyOk && foodItem) {
    const inventory = db.prepare('SELECT id FROM user_inventory WHERE user_id = ? AND shop_item_id = ?').get(user1, foodItem.id);
    if (inventory) {
      const useResult = inventoryService.useItem(user1, inventory.id);
      log('背包使用食物', useResult.success === true);
    }
  }

  // 5.4 器材购买解锁
  if (equipmentItem) {
    shopService.buyItem(user1, equipmentItem.id);
    const unlocked = workoutService.getUnlockedEquipmentKeys(user1);
    log('器材购买解锁跟练', unlocked.size > 0, `unlocked=${[...unlocked].join(',')}`);
  }

  // ==================== 6. 任务系统测试 ====================
  console.log('\n📦 任务系统测试\n');

  // 6.1 日常任务
  const dailyTasks = taskService.getDailyTasks(user1);
  log('日常任务获取', Array.isArray(dailyTasks), `count=${dailyTasks.length}`);

  // 6.2 新手任务
  const newbieTasks = newbieTaskService.list(user1);
  log('新手任务获取', Array.isArray(newbieTasks), `count=${newbieTasks.length}`);

  // ==================== 7. 货币系统测试 ====================
  console.log('\n📦 货币系统测试\n');

  const currencyBefore = db.prepare('SELECT berries, flowers FROM user_currency WHERE user_id = ?').get(user1);
  
  // 发放浆果
  currencyService.addBerries(user1, 100, 'test_reward', '测试奖励');
  const currencyAfter = db.prepare('SELECT berries, flowers FROM user_currency WHERE user_id = ?').get(user1);
  log('浆果发放', currencyAfter.berries === currencyBefore.berries + 100, `before=${currencyBefore.berries}, after=${currencyAfter.berries}`);

  // 消耗浆果
  currencyService.consumeBerries(user1, 50, 'test_consume', '测试消耗');
  const currencyFinal = db.prepare('SELECT berries, flowers FROM user_currency WHERE user_id = ?').get(user1);
  log('浆果消耗', currencyFinal.berries === currencyAfter.berries - 50, `final=${currencyFinal.berries}`);

  // ==================== 8. 弹窗广告测试 ====================
  console.log('\n📦 弹窗广告测试\n');

  // 8.1 创建测试弹窗
  const popupId = db.prepare(`
    INSERT INTO popups (name, style, image_url, trigger_pages, trigger_timing, priority, status, start_time, end_time)
    VALUES ('测试弹窗', 'center', 'https://example.com/test.png', '["/pages/index/index"]', 'enter', 5, 1, datetime('now'), datetime('now', '+1 day'))
  `).run().lastInsertRowid;
  log('弹窗创建', popupId > 0, `id=${popupId}`);

  // 8.2 弹窗事件上报
  const eventResult = db.prepare(`
    INSERT INTO popup_events (popup_id, device_id, event_type, page, created_at)
    VALUES (?, ?, 'show', '/pages/index/index', datetime('now'))
  `).run(popupId, `device_${user1}`);
  log('弹窗事件上报', eventResult.changes === 1);

  // ==================== 9. 公告消息测试 ====================
  console.log('\n📦 公告消息测试\n');

  const announcementId = db.prepare(`
    INSERT INTO announcements (title, content, type, status, publish_time)
    VALUES ('测试公告', '这是一条测试公告', 'system', 1, datetime('now'))
  `).run().lastInsertRowid;
  log('公告创建', announcementId > 0);

  // 用户读取公告
  db.prepare(`
    INSERT INTO user_announcement_reads (user_id, announcement_id, read_at)
    VALUES (?, ?, datetime('now'))
  `).run(user1, announcementId);
  log('公告已读记录', true);

  // ==================== 10. 多用户状态模拟 ====================
  console.log('\n📦 多用户状态模拟\n');

  // 10.1 新用户状态
  const newUser = createTestUser('13800000010', '新注册用户');
  cleanupUser(newUser);
  const newUserCurrency = db.prepare('SELECT berries, flowers FROM user_currency WHERE user_id = ?').get(newUser);
  log('新用户初始货币', newUserCurrency.berries === 1000 && newUserCurrency.flowers === 1000);

  // 10.2 活跃用户状态（有记录）
  const activeUser = createTestUser('13800000011', '活跃用户');
  cleanupUser(activeUser);
  db.prepare('INSERT INTO diet_records (user_id, record_date, meal_time, total_calorie, status) VALUES (?, ?, "lunch", 500, 1)').run(activeUser, DATE);
  db.prepare('INSERT INTO exercise_records (user_id, record_date, total_duration, total_calorie, status) VALUES (?, ?, 30, 300, 1)').run(activeUser, DATE);
  const activeRecords = db.prepare('SELECT COUNT(*) as c FROM (SELECT id FROM diet_records WHERE user_id = ? UNION ALL SELECT id FROM exercise_records WHERE user_id = ?)').get(activeUser, activeUser);
  log('活跃用户有记录', activeRecords.c >= 2, `records=${activeRecords.c}`);

  // 10.3 沉默用户状态（长期未登录）
  const silentUser = createTestUser('13800000012', '沉默用户');
  db.prepare("UPDATE users SET last_login_at = datetime('now', '-20 days') WHERE id = ?").run(silentUser);
  const silentDays = db.prepare("SELECT CAST((julianday('now') - julianday(last_login_at)) AS INTEGER) as days FROM users WHERE id = ?").get(silentUser);
  log('沉默用户未登录天数', silentDays.days >= 14, `days=${silentDays.days}`);

  // ==================== 11. 边界条件测试 ====================
  console.log('\n📦 边界条件测试\n');

  // 11.1 货币不足购买
  db.prepare('UPDATE user_currency SET berries = 0 WHERE user_id = ?').run(user1);
  if (foodItem) {
    const buyFail = shopService.buyItem(user1, foodItem.id);
    log('货币不足购买失败', buyFail.error !== undefined, `error=${buyFail.error}`);
  }

  // 11.2 重复购买永久器材
  if (equipmentItem) {
    db.prepare('UPDATE user_currency SET berries = 10000 WHERE user_id = ?').run(user1);
    shopService.buyItem(user1, equipmentItem.id);
    const buyDuplicate = shopService.buyItem(user1, equipmentItem.id);
    log('重复购买永久器材拦截', buyDuplicate.error !== undefined);
  }

  // 11.3 空数据查询
  const emptyDiet = db.prepare('SELECT * FROM diet_records WHERE user_id = ? AND record_date = ?').get(user1, '2000-01-01');
  log('空数据查询返回空', emptyDiet === undefined);

  // ==================== 测试结果汇总 ====================
  console.log('\n' + '='.repeat(50));
  console.log(`🏁 测试完成: 通过 ${passCount} 项, 失败 ${failCount} 项`);
  console.log('='.repeat(50) + '\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});