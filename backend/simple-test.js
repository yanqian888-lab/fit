#!/usr/bin/env node

/**
 * 简单测试验证脚本
 * 验证核心功能是否正常
 */

const { db, initTables, migrateTables, initSeedData } = require('./src/db');
const { getChinaDateStr } = require('./src/utils/chinaTime');

console.log('\n🧪 开始核心功能验证\n');

// 初始化数据库
initTables();
migrateTables();
initSeedData();

const DATE = getChinaDateStr();
let passCount = 0;
let failCount = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
    passCount++;
  } else {
    console.log(`❌ ${name}`);
    failCount++;
  }
}

// 测试1: 数据库连接
try {
  const result = db.prepare('SELECT 1 as value').get();
  test('数据库连接正常', result.value === 1);
} catch (e) {
  test('数据库连接正常', false);
}

// 测试2: 用户表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  test('用户表存在', count >= 0);
} catch (e) {
  test('用户表存在', false);
}

// 测试3: 创建测试用户
try {
  const phone = '13800138000';
  db.prepare('DELETE FROM users WHERE phone = ?').run(phone);
  const result = db.prepare('INSERT INTO users (phone, nickname, status, source) VALUES (?, ?, 1, \'test\')').run(phone, '验证用户');
  test('创建用户成功', result.lastInsertRowid > 0);
  
  // 清理
  db.prepare('DELETE FROM users WHERE phone = ?').run(phone);
} catch (e) {
  test('创建用户成功', false);
}

// 测试4: 饮食记录表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM diet_records').get().c;
  test('饮食记录表存在', count >= 0);
} catch (e) {
  test('饮食记录表存在', false);
}

// 测试5: 运动记录表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM exercise_records').get().c;
  test('运动记录表存在', count >= 0);
} catch (e) {
  test('运动记录表存在', false);
}

// 测试6: 博物馆表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM museum_items').get().c;
  test('博物馆表存在', count >= 0);
} catch (e) {
  test('博物馆表存在', false);
}

// 测试7: 商城商品表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM shop_items').get().c;
  test('商城商品表存在', count >= 0);
} catch (e) {
  test('商城商品表存在', false);
}

// 测试8: 宠物状态表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM pet_states').get().c;
  test('宠物状态表存在', count >= 0);
} catch (e) {
  test('宠物状态表存在', false);
}

// 测试9: 试用权限表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM trial_user_count').get().c;
  test('试用权限表存在', count >= 0);
} catch (e) {
  test('试用权限表存在', false);
}

// 测试10: 弹窗配置表
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM popups').get().c;
  test('弹窗配置表存在', count >= 0);
} catch (e) {
  test('弹窗配置表存在', false);
}

console.log('\n' + '='.repeat(50));
console.log(`🏁 验证完成: 通过 ${passCount} 项, 失败 ${failCount} 项`);
console.log('='.repeat(50) + '\n');

if (failCount > 0) {
  process.exit(1);
}