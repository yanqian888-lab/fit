/**
 * 后端核心场景冒烟测试
 * 用法：
 *   cd backend
 *   NODE_ENV=test node scripts/smoke-test.js
 *
 * 覆盖场景：
 *   - 用户资料初始化
 *   - 体重/围度/肌肉成就触发
 *   - 情绪保存
 *   - 博物馆内容添加、编辑、删除及时间轴同步
 *   - AI 日记生成与幂等
 *   - 数据导出范围与敏感字段脱敏
 *   - 沉默召回可调用
 */
const { db, withTransaction, initTables, migrateTables, initSeedData } = require('../src/db');
const { getChinaDateStr } = require('../src/utils/chinaTime');
const achievementService = require('../src/services/achievementService');
const museumService = require('../src/services/museumService');
const currencyService = require('../src/services/currencyService');
const aiController = require('../src/controllers/aiController');
const userController = require('../src/controllers/userController');
const museumController = require('../src/controllers/museumController');
const templateMessageService = require('../src/services/templateMessageService');
const shopService = require('../src/services/shopService');
const inventoryService = require('../src/services/inventoryService');
const workoutService = require('../src/services/workoutService');
const petService = require('../src/services/petService');

if (process.env.NODE_ENV !== 'test') {
  console.error('❌ 冒烟测试必须在 NODE_ENV=test 环境下运行');
  process.exit(1);
}

// 初始化数据库表与测试环境种子数据，确保配置（如 analysis_cost）按 test 环境重置
initTables();
migrateTables();
initSeedData();

const PHONE = '13800138888';
const DATE = getChinaDateStr();

function ensureTestUser() {
  let user = db.prepare('SELECT id FROM users WHERE phone = ?').get(PHONE);
  if (!user) {
    const result = db.prepare("INSERT INTO users (phone, nickname, status, source) VALUES (?, '冒烟用户', 1, 'app')").run(PHONE);
    user = { id: result.lastInsertRowid };
    db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO settings (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO partners (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO user_currency (user_id, berries, flowers) VALUES (?, 100, 1000)').run(user.id);
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  }
  return user.id;
}

function cleanupUserData(userId) {
  const tables = [
    'diet_records', 'exercise_records', 'body_records', 'habit_records',
    'museum_items', 'timelines', 'milestones', 'user_achievements',
    'currency_transactions', 'checkins', 'user_tasks', 'user_newbie_tasks',
    'photos', 'user_methods', 'custom_foods', 'custom_exercises',
    'favorite_foods', 'favorite_exercises', 'feedback', 'template_messages',
    'user_inventory'
  ];
  for (const t of tables) {
    db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
  }
  db.prepare('UPDATE user_profiles SET initial_weight=NULL, current_weight=NULL, target_weight=NULL, target_date=NULL WHERE user_id = ?').run(userId);
  db.prepare('UPDATE user_currency SET berries = 1000, flowers = 1000 WHERE user_id = ?').run(userId);
}

function log(title, ok, detail = '') {
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} ${title}${detail ? ' | ' + detail : ''}`);
  return ok;
}

function mockReqRes(body = {}, query = {}, params = {}) {
  return {
    req: {
      userId: body.userId,
      body,
      query,
      params
    },
    res: {
      statusCode: 200,
      body: null,
      json(data) {
        this.body = data;
        return data;
      },
      status(code) {
        this.statusCode = code;
        return this;
      }
    }
  };
}

async function run() {
  const userId = ensureTestUser();
  console.log(`\n🧪 开始后端冒烟测试，用户 ID: ${userId}\n`);
  cleanupUserData(userId);

  // 1. 初始化资料
  db.prepare(`
    UPDATE user_profiles
    SET initial_weight = 80, current_weight = 75, target_weight = 65, target_date = ?
    WHERE user_id = ?
  `).run('2026-12-31', userId);
  db.prepare('UPDATE users SET age = 28, gender = 2, height = 165 WHERE id = ?').run(userId);
  log('初始化用户资料', true);

  // 2. 记录体重 + 围度（触发减重、围度逆袭、肌肉增长成就）
  const d0 = DATE;
  db.prepare(`
    INSERT INTO body_records (user_id, record_date, type, value, unit, status)
    VALUES
      (?, ?, 'weight', 80, 'kg', 1),
      (?, ?, 'waist', 80, 'cm', 1),
      (?, ?, 'thigh', 60, 'cm', 1),
      (?, ?, 'hip', 100, 'cm', 1),
      (?, ?, 'arm', 30, 'cm', 1),
      (?, ?, 'chest', 90, 'cm', 1)
  `).run(userId, d0, userId, d0, userId, d0, userId, d0, userId, d0, userId, d0);

  const d1 = new Date();
  d1.setDate(d1.getDate() + 1);
  const d1Str = d1.toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO body_records (user_id, record_date, type, value, unit, status)
    VALUES
      (?, ?, 'weight', 74, 'kg', 1),
      (?, ?, 'waist', 74, 'cm', 1),
      (?, ?, 'thigh', 57, 'cm', 1),
      (?, ?, 'hip', 97, 'cm', 1),
      (?, ?, 'arm', 31.5, 'cm', 1),
      (?, ?, 'chest', 91.5, 'cm', 1)
  `).run(userId, d1Str, userId, d1Str, userId, d1Str, userId, d1Str, userId, d1Str, userId, d1Str);

  const bodyAchievements = achievementService.checkAll(userId);
  const unlockedNames = bodyAchievements.map(a => a.name);
  log('成就解锁',
    unlockedNames.includes('减重 5kg') && unlockedNames.includes('腰围减少 5cm') && unlockedNames.includes('臂围增加 1cm'),
    unlockedNames.join(', ')
  );

  // 3. 情绪记录
  const savedMood = museumService.saveMood(userId, { emotion: 'good', content: '今天状态不错', record_date: DATE });
  log('情绪保存', savedMood.id > 0, `id=${savedMood.id}`);

  // 4. 博物馆添加 + 时间轴
  const { req: addReq, res: addRes } = mockReqRes({ userId }, {}, {});
  addReq.body = { type: 'quote', content: '减肥是马拉松，不是短跑', sub_type: '运动', author: 'user' };
  museumController.addItem(addReq, addRes);
  log('添加博物馆内容', addRes.body?.code === 0, `id=${addRes.body?.data?.id}`);

  // 5. AI 日记生成（测试环境免费）
  const { req: diaryReq, res: diaryRes } = mockReqRes({ userId }, { date: DATE }, {});
  await aiController.generateDiary(diaryReq, diaryRes);
  const firstOk = diaryRes.body?.code === 0;
  log('AI 日记首次生成', firstOk, `item_id=${diaryRes.body?.data?.item_id}`);

  // 幂等：再次生成应返回已有记录
  const { req: diaryReq2, res: diaryRes2 } = mockReqRes({ userId }, { date: DATE }, {});
  await aiController.generateDiary(diaryReq2, diaryRes2);
  const secondIdempotent = diaryRes2.body?.code === 0 && diaryRes2.body?.data?.item_id === diaryRes.body?.data?.item_id;
  log('AI 日记幂等生成', secondIdempotent, `same_item_id=${secondIdempotent}`);

  // 货币未扣（测试环境免费）
  const consumeCount = db.prepare("SELECT COUNT(*) as c FROM currency_transactions WHERE user_id = ? AND source = ? AND type = ?")
    .get(userId, 'generate_analysis', 'consume').c;
  log('AI 日记未扣费', consumeCount === 0, `generate_analysis_consume=${consumeCount}`);

  // 6. 时间轴同步检查
  const tlCount = db.prepare(`
    SELECT COUNT(*) as c FROM timelines WHERE user_id = ? AND event_date = ? AND related_type = 'museum_items'
  `).get(userId, DATE).c;
  log('时间轴关联记录', tlCount >= 2, `count=${tlCount}`);

  // 7. 数据导出
  const { req: exportReq, res: exportRes } = mockReqRes({ userId }, {}, {});
  userController.exportData(exportReq, exportRes);
  const exportData = exportRes.body?.data?.data;
  const hasTables = exportData && exportData.users && exportData.photos !== undefined && exportData.pets !== undefined;
  const noOpenid = exportData?.users?.[0] && !exportData.users[0].openid;
  log('数据导出范围', hasTables && noOpenid, `tables=${Object.keys(exportData || {}).length}, no_openid=${noOpenid}`);

  // 8. 沉默召回手动触发
  const recalls = templateMessageService.checkAndSendRecalls();
  log('沉默召回可调用', Array.isArray(recalls), `sent=${recalls.length}`);

  // 9. 商城/背包闭环
  petService.ensurePetState(userId);
  const foodItem = db.prepare("SELECT id, name FROM shop_items WHERE status = 1 AND category = 'food' ORDER BY id LIMIT 1").get();
  const equipmentItem = db.prepare("SELECT id, name, effect_json FROM shop_items WHERE status = 1 AND category = 'equipment' ORDER BY id LIMIT 1").get();
  const propItem = db.prepare("SELECT id, name, effect_json FROM shop_items WHERE status = 1 AND category = 'prop' AND price_berries > 0 ORDER BY id LIMIT 1").get();

  let shopOk = false;
  let equipmentDuplicateOk = false;
  let useItemOk = false;
  let equipmentUnlocked = false;
  let foodInventoryId = null;

  if (foodItem && equipmentItem && propItem) {
    const buyFood = shopService.buyItem(userId, foodItem.id);
    const buyFood2 = shopService.buyItem(userId, foodItem.id);
    const buyEquipment = shopService.buyItem(userId, equipmentItem.id);
    const buyEquipment2 = shopService.buyItem(userId, equipmentItem.id);
    const buyProp = shopService.buyItem(userId, propItem.id);

    shopOk = !buyFood.error && !buyFood2.error && !buyEquipment.error && !buyProp.error;
    equipmentDuplicateOk = !!buyEquipment2.error;

    const foodInv = db.prepare("SELECT id, quantity FROM user_inventory WHERE user_id = ? AND shop_item_id = ?").get(userId, foodItem.id);
    foodInventoryId = foodInv?.id;

    const useFood = foodInventoryId ? inventoryService.useItem(userId, foodInventoryId) : { error: 'no food' };
    useItemOk = useFood.success === true;

    const unlockedKeys = workoutService.getUnlockedEquipmentKeys(userId);
    const effect = JSON.parse(equipmentItem.effect_json || '{}');
    equipmentUnlocked = effect.unlock_workout ? unlockedKeys.has(effect.unlock_workout) : true;
  }

  log('商城购买与库存扣减', shopOk && equipmentDuplicateOk,
    `food=${foodItem?.name || '-'}, equip=${equipmentItem?.name || '-'}, duplicate_blocked=${equipmentDuplicateOk}`);
  log('背包食物使用', useItemOk, `inventory_id=${foodInventoryId}`);
  log('器材购买解锁跟练', equipmentUnlocked, `key=${JSON.parse(equipmentItem?.effect_json || '{}').unlock_workout || '-'}`);

  // 10. 博物馆编辑/删除同步时间轴
  const museumItem = db.prepare("SELECT id FROM museum_items WHERE user_id = ? AND type = 'quote' AND status = 1").get(userId);
  if (museumItem) {
    const { req: updReq, res: updRes } = mockReqRes({ userId, content: '已更新的金句内容' }, {}, { id: museumItem.id });
    museumController.updateItem(updReq, updRes);
    const tlContent = db.prepare("SELECT content FROM timelines WHERE related_id = ? AND related_type = 'museum_items'").get(museumItem.id)?.content;
    log('博物馆编辑同步时间轴', tlContent === '已更新的金句内容', `timeline_content=${tlContent}`);

    const { req: delReq, res: delRes } = mockReqRes({ userId }, {}, { id: museumItem.id });
    museumController.deleteItem(delReq, delRes);
    const tlAfterDel = db.prepare("SELECT COUNT(*) as c FROM timelines WHERE related_id = ? AND related_type = 'museum_items'").get(museumItem.id).c;
    log('博物馆删除同步时间轴', tlAfterDel === 0, `remaining_timelines=${tlAfterDel}`);
  }

  console.log('\n🏁 冒烟测试完成\n');
}

run().catch(err => {
  console.error('冒烟测试失败:', err);
  process.exit(1);
});
