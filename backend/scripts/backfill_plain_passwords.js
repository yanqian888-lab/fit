/**
 * 为历史用户补一个默认明文密码（仅内部测试/管理使用）
 * 运行后会将所有 plain_password 为空的用户密码设置为 123456，并同步更新 password_hash。
 */
const { db } = require('../src/db');
const bcrypt = require('bcryptjs');

const DEFAULT_PASSWORD = '123456';
const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

const users = db.prepare("SELECT id FROM users WHERE plain_password IS NULL OR plain_password = ''").all();
const update = db.prepare('UPDATE users SET password_hash = ?, plain_password = ? WHERE id = ?');

const transaction = db.transaction((items) => {
  for (const user of items) {
    update.run(passwordHash, DEFAULT_PASSWORD, user.id);
  }
});

transaction(users);
console.log(`已补录 ${users.length} 个用户的默认密码为 ${DEFAULT_PASSWORD}`);
