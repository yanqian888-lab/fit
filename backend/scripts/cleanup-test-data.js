/**
 * 测试数据清理脚本
 * 用法：
 *   cd backend
 *   NODE_ENV=test node scripts/cleanup-test-data.js
 *
 * 功能：
 *   - 清理所有测试用户数据
 *   - 重置数据库到初始状态
 *   - 保留种子数据
 */

const { db, initTables, migrateTables, initSeedData } = require('../src/db');

if (process.env.NODE_ENV !== 'test') {
  console.error('❌ 必须在 NODE_ENV=test 环境下运行');
  process.exit(1);
}

function cleanup() {
  console.log('\n🧹 开始清理测试数据\n');

  // 清理用户相关数据
  const userTables = [
    'diet_records',
    'exercise_records',
    'body_records',
    'habit_records',
    'museum_items',
    'timelines',
    'milestones',
    'user_achievements',
    'currency_transactions',
    'checkins',
    'user_tasks',
    'user_newbie_tasks',
    'photos',
    'user_methods',
    'custom_foods',
    'custom_exercises',
    'favorite_foods',
    'favorite_exercises',
    'feedback',
    'template_messages',
    'user_inventory',
    'trial_user_count',
    'chat_messages',
    'precipitations',
    'user_announcement_reads',
    'popup_events'
  ];

  console.log('清理用户数据表...');
  for (const table of userTables) {
    try {
      const result = db.prepare(`DELETE FROM ${table}`).run();
      console.log(`  ✓ ${table}: 删除 ${result.changes} 条记录`);
    } catch (e) {
      console.log(`  ⚠ ${table}: ${e.message}`);
    }
  }

  // 清理测试用户（手机号以 139 开头）
  console.log('\n清理测试用户...');
  const testUsers = db.prepare("SELECT id, phone FROM users WHERE phone LIKE '139%'").all();
  for (const user of testUsers) {
    db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM settings WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM partners WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM user_currency WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM trial_whitelist WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM pet_states WHERE user_id = ?').run(user.id);
  }
  const deleteUserResult = db.prepare("DELETE FROM users WHERE phone LIKE '139%'").run();
  console.log(`  ✓ 删除 ${deleteUserResult.changes} 个测试用户`);

  // 清理测试弹窗
  console.log('\n清理测试弹窗...');
  const deletePopups = db.prepare("DELETE FROM popups WHERE name LIKE '测试%'").run();
  console.log(`  ✓ 删除 ${deletePopups.changes} 个测试弹窗`);

  // 清理测试公告
  console.log('\n清理测试公告...');
  const deleteAnnouncements = db.prepare("DELETE FROM announcements WHERE title LIKE '测试%'").run();
  console.log(`  ✓ 删除 ${deleteAnnouncements.changes} 个测试公告`);

  // 重置自增 ID（可选）
  // 注意：SQLite 的 AUTOINCREMENT 在删除后会继续递增，这是正常行为

  console.log('\n✅ 测试数据清理完成\n');

  // 显示剩余数据统计
  console.log('📊 剩余数据统计\n');
  const stats = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    shop_items: db.prepare('SELECT COUNT(*) as c FROM shop_items').get().c,
    newbie_tasks: db.prepare('SELECT COUNT(*) as c FROM newbie_tasks').get().c,
    popups: db.prepare('SELECT COUNT(*) as c FROM popups').get().c,
    announcements: db.prepare('SELECT COUNT(*) as c FROM announcements').get().c
  };

  console.log(`  用户数: ${stats.users}`);
  console.log(`  商城商品: ${stats.shop_items}`);
  console.log(`  新手任务: ${stats.newbie_tasks}`);
  console.log(`  弹窗配置: ${stats.popups}`);
  console.log(`  公告: ${stats.announcements}`);
  console.log('');
}

cleanup();