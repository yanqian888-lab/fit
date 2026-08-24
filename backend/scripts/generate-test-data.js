/**
 * 测试数据生成脚本
 * 用法：
 *   cd backend
 *   NODE_ENV=test node scripts/generate-test-data.js
 *
 * 功能：
 *   - 生成多用户测试数据
 *   - 模拟不同用户状态（新用户、活跃用户、沉默用户）
 *   - 生成历史记录数据
 *   - 生成博物馆内容
 */

const { db, initTables, migrateTables, initSeedData } = require('../src/db');
const { getChinaDateStr } = require('../src/utils/chinaTime');

if (process.env.NODE_ENV !== 'test') {
  console.error('❌ 必须在 NODE_ENV=test 环境下运行');
  process.exit(1);
}

initTables();
migrateTables();
initSeedData();

const DATE = getChinaDateStr();
const FOODS = [
  { name: '牛肉面', weight: 200, calorie: 500 },
  { name: '米饭', weight: 150, calorie: 180 },
  { name: '番茄炒蛋', weight: 120, calorie: 150 },
  { name: '清炒西兰花', weight: 100, calorie: 50 },
  { name: '红烧肉', weight: 100, calorie: 350 },
  { name: '蒸蛋', weight: 80, calorie: 80 },
  { name: '紫菜蛋花汤', weight: 200, calorie: 60 },
  { name: '炒青菜', weight: 100, calorie: 40 }
];

const EXERCISES = [
  { name: '跑步', duration: 30, calorie: 300 },
  { name: '快走', duration: 45, calorie: 200 },
  { name: '游泳', duration: 40, calorie: 400 },
  { name: '瑜伽', duration: 60, calorie: 150 },
  { name: '力量训练', duration: 45, calorie: 250 },
  { name: '跳绳', duration: 20, calorie: 200 },
  { name: '骑行', duration: 60, calorie: 350 }
];

const QUOTES = [
  '减肥是马拉松，不是短跑',
  '每一次坚持，都是对自己的承诺',
  '今天的汗水，是明天的收获',
  '自律给我自由',
  '改变从现在开始',
  '坚持就是胜利',
  '健康是最重要的财富',
  '每一步都算数'
];

const MOODS = ['good', 'normal', 'bad'];
const EMOTIONS = ['happy', 'calm', 'anxious', 'sad', 'angry'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  return date.toISOString().split('T')[0];
}

function createUser(phone, nickname, status = 1) {
  let user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const result = db.prepare('INSERT INTO users (phone, nickname, status, source, created_at) VALUES (?, ?, ?, \'app\', datetime(\'now\'))').run(phone, nickname, status);
    user = { id: result.lastInsertRowid };
    db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO settings (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO partners (user_id) VALUES (?)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO user_currency (user_id, berries, flowers) VALUES (?, 1000, 1000)').run(user.id);
    db.prepare('INSERT OR IGNORE INTO trial_user_count (user_id, device_id) VALUES (?, ?)').run(user.id, `device_${phone}`);
  }
  return user.id;
}

function generateDietRecords(userId, days) {
  const mealTimes = ['breakfast', 'lunch', 'dinner', 'snack'];
  
  for (let i = 0; i < days; i++) {
    const date = randomDate(days);
    const mealCount = randomInt(2, 4);
    
    for (let j = 0; j < mealCount; j++) {
      const foodCount = randomInt(1, 3);
      const foods = [];
      let totalCalorie = 0;
      
      for (let k = 0; k < foodCount; k++) {
        const food = randomChoice(FOODS);
        foods.push(food);
        totalCalorie += food.calorie;
      }
      
      db.prepare(`
        INSERT INTO diet_records (user_id, record_date, meal_time, foods, total_calorie, status, created_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
      `).run(userId, date, randomChoice(mealTimes), JSON.stringify(foods), totalCalorie);
    }
  }
}

function generateExerciseRecords(userId, days) {
  for (let i = 0; i < days; i++) {
    const date = randomDate(days);
    const exerciseCount = randomInt(0, 2);
    
    if (exerciseCount === 0) continue;
    
    const exercises = [];
    let totalDuration = 0;
    let totalCalorie = 0;
    
    for (let j = 0; j < exerciseCount; j++) {
      const exercise = randomChoice(EXERCISES);
      exercises.push(exercise);
      totalDuration += exercise.duration;
      totalCalorie += exercise.calorie;
    }
    
    db.prepare(`
      INSERT INTO exercise_records (user_id, record_date, exercises, total_duration, total_calorie, status, created_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(userId, date, JSON.stringify(exercises), totalDuration, totalCalorie);
  }
}

function generateBodyRecords(userId, days) {
  const initialWeight = randomInt(60, 100);
  let currentWeight = initialWeight;
  
  db.prepare('UPDATE user_profiles SET initial_weight = ?, current_weight = ?, target_weight = ? WHERE user_id = ?')
    .run(initialWeight, currentWeight, initialWeight - randomInt(5, 15), userId);
  
  for (let i = 0; i < days; i += randomInt(3, 7)) {
    const date = randomDate(days);
    currentWeight = Math.max(50, currentWeight - randomInt(-1, 2));
    
    db.prepare(`
      INSERT INTO body_records (user_id, record_date, type, value, unit, status, created_at)
      VALUES (?, ?, 'weight', ?, 'kg', 1, datetime('now'))
    `).run(userId, date, currentWeight);
  }
}

function generateMuseumItems(userId, days) {
  // 添加金句
  for (let i = 0; i < randomInt(3, 8); i++) {
    db.prepare(`
      INSERT INTO museum_items (user_id, type, content, status, created_at)
      VALUES (?, 'quote', ?, 1, datetime('now'))
    `).run(userId, randomChoice(QUOTES));
  }
  
  // 添加食谱
  for (let i = 0; i < randomInt(2, 5); i++) {
    const recipe = {
      name: randomChoice(FOODS).name + '做法',
      ingredients: ['食材1', '食材2'],
      steps: ['步骤1', '步骤2']
    };
    db.prepare(`
      INSERT INTO museum_items (user_id, type, sub_type, content, status, created_at)
      VALUES (?, 'recipe', 'lunch', ?, 1, datetime('now'))
    `).run(userId, JSON.stringify(recipe));
  }
  
  // 添加心情日记
  for (let i = 0; i < randomInt(5, 15); i++) {
    const date = randomDate(days);
    db.prepare(`
      INSERT INTO museum_items (user_id, type, content, status, created_at)
      VALUES (?, 'mood', ?, 1, datetime('now'))
    `).run(userId, JSON.stringify({
      emotion: randomChoice(EMOTIONS),
      content: '今天心情' + randomChoice(['不错', '一般', '不太好']),
      record_date: date
    }));
  }
}

function generateCheckins(userId, days) {
  for (let i = 0; i < days; i++) {
    if (Math.random() > 0.7) continue;
    
    const date = randomDate(days);
    try {
      db.prepare(`
        INSERT INTO checkins (user_id, checkin_date, reward_berries, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(userId, date, randomInt(5, 20));
    } catch (e) {
      // 忽略重复日期
    }
  }
}

function generateTasks(userId) {
  // 完成部分新手任务
  const newbieTasks = db.prepare('SELECT id FROM newbie_tasks WHERE status = 1 LIMIT 3').all();
  for (const task of newbieTasks) {
    if (Math.random() > 0.5) {
      try {
        db.prepare(`
          INSERT INTO user_newbie_tasks (user_id, task_id, status, completed_at, created_at)
          VALUES (?, ?, 1, datetime('now'), datetime('now'))
        `).run(userId, task.id);
      } catch (e) {}
    }
  }
}

function main() {
  console.log('\n🔨 开始生成测试数据\n');

  // 1. 新用户（注册但未活跃）
  console.log('创建新用户...');
  for (let i = 1; i <= 10; i++) {
    const phone = `1390000000${i}`;
    const userId = createUser(phone, `新用户${i}`);
    console.log(`  ✓ ${phone} (userId: ${userId})`);
  }

  // 2. 活跃用户（有大量记录）
  console.log('\n创建活跃用户...');
  for (let i = 1; i <= 20; i++) {
    const phone = `1390001000${i}`;
    const userId = createUser(phone, `活跃用户${i}`);
    
    generateDietRecords(userId, 30);
    generateExerciseRecords(userId, 30);
    generateBodyRecords(userId, 30);
    generateMuseumItems(userId, 30);
    generateCheckins(userId, 30);
    generateTasks(userId);
    
    console.log(`  ✓ ${phone} (userId: ${userId}) - 30天数据`);
  }

  // 3. 沉默用户（长期未登录）
  console.log('\n创建沉默用户...');
  for (let i = 1; i <= 5; i++) {
    const phone = `1390002000${i}`;
    const userId = createUser(phone, `沉默用户${i}`);
    
    // 设置最后登录时间为 20 天前
    db.prepare("UPDATE users SET last_login_at = datetime('now', '-20 days') WHERE id = ?").run(userId);
    
    // 有少量历史记录
    generateDietRecords(userId, 7);
    generateExerciseRecords(userId, 7);
    
    console.log(`  ✓ ${phone} (userId: ${userId}) - 沉默20天+`);
  }

  // 4. VIP 用户（白名单）
  console.log('\n创建VIP用户...');
  for (let i = 1; i <= 3; i++) {
    const phone = `1390003000${i}`;
    const userId = createUser(phone, `VIP用户${i}`);
    
    // 添加白名单
    db.prepare(`
      INSERT OR IGNORE INTO trial_whitelist (user_id, feature_type, reason, expires_at)
      VALUES (?, 'ai_chat', 'VIP用户', '2099-12-31 23:59:59')
    `).run(userId);
    
    generateDietRecords(userId, 60);
    generateExerciseRecords(userId, 60);
    generateBodyRecords(userId, 60);
    generateMuseumItems(userId, 60);
    
    console.log(`  ✓ ${phone} (userId: ${userId}) - VIP白名单`);
  }

  // 统计
  console.log('\n📊 测试数据统计\n');
  
  const stats = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    diet_records: db.prepare('SELECT COUNT(*) as c FROM diet_records').get().c,
    exercise_records: db.prepare('SELECT COUNT(*) as c FROM exercise_records').get().c,
    body_records: db.prepare('SELECT COUNT(*) as c FROM body_records').get().c,
    museum_items: db.prepare('SELECT COUNT(*) as c FROM museum_items').get().c,
    checkins: db.prepare('SELECT COUNT(*) as c FROM checkins').get().c
  };

  console.log(`  用户数: ${stats.users}`);
  console.log(`  饮食记录: ${stats.diet_records}`);
  console.log(`  运动记录: ${stats.exercise_records}`);
  console.log(`  体重记录: ${stats.body_records}`);
  console.log(`  博物馆内容: ${stats.museum_items}`);
  console.log(`  签到记录: ${stats.checkins}`);

  console.log('\n✅ 测试数据生成完成\n');
}

main();