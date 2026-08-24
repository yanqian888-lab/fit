/**
 * 一键重置超级管理员 admin888 的密码
 * 适用场景：忘记密码、首次部署随机密码丢失
 * 用法：
 *   1. 将此文件放到 backend/ 目录下，确保能加载到 .env 环境变量
 *   2. 执行：node scripts/reset-cms-admin-password.js
 *   3. 用 admin888 + 控制台输出的密码登录后台
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');
const { db } = require('../src/db');

/**
 * 密码复杂度校验（复用前端 / CMS 登录页的规则：6-12 位字母+数字组合）
 * @param {string} pwd
 * @returns {boolean}
 */
function validatePassword(pwd) {
  if (!pwd || pwd.length < 6 || pwd.length > 12) return false;
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  return hasLetter && hasNumber;
}

// 你也可以把密码通过命令行参数传进来：node scripts/reset-cms-admin-password.js 你的新密码
// 不传则默认用 admin@123（注意：@! 等符号可以用，但后端 CMS 登录页校验只允许字母+数字组合）
const NEW_PASSWORD = process.argv[2] || 'admin123';

if (!validatePassword(NEW_PASSWORD)) {
  console.error('❌ 密码校验失败：必须 6-12 位，且同时包含字母和数字（纯字母/纯数字/含特殊字符都不通过）');
  console.error('   示例可用：admin123 / Abc12345 / fit88888');
  process.exit(1);
}

try {
  const user = db.prepare('SELECT id, username FROM cms_users WHERE username = ?').get('admin888');
  if (!user) {
    console.error('❌ 数据库里没有 admin888 这个超级管理员，请先执行 seedCms 初始化（或调用 init-db 脚本）');
    process.exit(1);
  }

  const passwordHash = bcrypt.hashSync(NEW_PASSWORD, 10);

  // 容错：先判断 cms_users 表是否存在 plain_password 列
  // （旧库有 plain_password 用于兼容，新库已去掉，只更新 password_hash 即可）
  const columns = db.prepare("PRAGMA table_info(cms_users)").all();
  const hasPlainPassword = columns.some(c => c.name === 'plain_password');

  if (hasPlainPassword) {
    db.prepare(`
      UPDATE cms_users
      SET password_hash = ?,
          plain_password = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, NEW_PASSWORD, user.id);
  } else {
    db.prepare(`
      UPDATE cms_users
      SET password_hash = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, user.id);
  }

  console.log('✅ 超级管理员密码重置成功！');
  console.log('   用户名  : admin888');
  console.log('   新密码  :', NEW_PASSWORD);
  console.log('   登录地址: http://fit.mianyan.xin/admin/');
  console.log('   提示    : 登录后请立即到「CMS 管理员」→ 选中 admin888 → 修改密码为你自己的强密码');
} catch (err) {
  console.error('❌ 重置密码出错:', err.message);
  process.exit(1);
}
