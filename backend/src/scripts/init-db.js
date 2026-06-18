/**
 * 数据库初始化脚本
 * 运行：npm run init-db
 */
const { db, initTables, initSeedData } = require('../db');

console.log('开始初始化数据库...');
initTables();
console.log('数据表创建完成');
initSeedData();
console.log('基础数据插入完成');
console.log('数据库初始化完成');

db.close();
