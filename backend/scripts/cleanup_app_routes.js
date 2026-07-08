/**
 * 清理 CMS 站内路由：删除未使用的后台页面，禁用当前未启用的业务页面
 */
const { db } = require('../src/db');

// 完全没用到的后台/占位页面，直接删除
const toDelete = [
  'pages/admin/feedback',
  'pages/admin/privacy'
];

// 页面文件存在、业务上有用，但当前 App 里没有任何入口跳转过去，先禁用
const toDisable = [
  'pages/onboarding/tasks',
  'pages/chat/quick-record',
  'pages/chat/pending-list',
  'pages/chat/search',
  'pages/chat/settings',
  'pages/chat/precipitation',
  'pages/museum/timeline',
  'pages/museum/event-detail',
  'pages/user/data-manage',
  'pages/user/achievement',
  'pages/user/notifications',
  'pages/user/help',
  'pages/user/help-detail'
];

function main() {
  let deleted = 0;
  for (const key of toDelete) {
    const info = db.prepare('DELETE FROM app_routes WHERE route_key = ?').run(key);
    deleted += info.changes;
  }

  let disabled = 0;
  for (const key of toDisable) {
    const info = db.prepare("UPDATE app_routes SET status = 'disabled' WHERE route_key = ?").run(key);
    disabled += info.changes;
  }

  const total = db.prepare('SELECT COUNT(*) AS c FROM app_routes').get().c;
  console.log(`完成：删除 ${deleted} 条，禁用 ${disabled} 条，剩余 ${total} 条`);
}

main();
