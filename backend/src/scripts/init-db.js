/**
 * 数据库初始化脚本
 * 运行：npm run init-db
 */
const { db, initTables, initSeedData } = require('../db');
const milestoneTemplateService = require('../services/milestoneTemplateService');

console.log('开始初始化数据库...');
initTables();
console.log('数据表创建完成');
initSeedData();
console.log('基础数据插入完成');

// 校准里程碑文案模板（支持按 value 区分）
try {
  milestoneTemplateService.seedDefaults();
  console.log('里程碑文案模板校准完成');
} catch (err) {
  console.error('里程碑文案模板校准失败:', err);
}

console.log('数据库初始化完成');
db.close();
