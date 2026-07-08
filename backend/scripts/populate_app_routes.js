/**
 * 根据 frontend/src/pages.json 批量补充 app_routes 站内路由字典
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const pagesJsonPath = path.join(__dirname, '../../frontend/src/pages.json');
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/app.db');

const nameMap = {
  'pages/splash/index': '启动页',
  'pages/onboarding/index': '新手引导',
  'pages/profile/setup': '个人资料设置',
  'pages/partner/select-mode': '选择搭子模式',
  'pages/partner/settings': '搭子设置',
  'pages/guide/feature': '功能介绍',
  'pages/index/index': '首页',
  'pages/chat/pending-list': '待办清单',
  'pages/chat/search': '搜索',
  'pages/record/index': '记录页',
  'pages/record/diet-detail': '饮食详情',
  'pages/record/add-food': '添加食物',
  'pages/record/create-food': '创建食物',
  'pages/record/food-detail': '食物详情',
  'pages/record/habit': '习惯记录',
  'pages/record/exercise-detail': '运动详情',
  'pages/record/add-exercise': '添加运动',
  'pages/record/body-data': '身体数据',
  'pages/museum/index': '博物馆首页',
  'pages/museum/diary': '减脂日记',
  'pages/museum/diary-generate': '生成日记',
  'pages/museum/milestones': '里程碑',
  'pages/museum/recipes': '食谱',
  'pages/museum/insights': '数据洞察',
  'pages/museum/item-edit': '项目编辑',
  'pages/museum/compare': '对比',
  'pages/museum/photo-upload': '照片上传',
  'pages/museum/recipe-detail': '食谱详情',
  'pages/museum/methods': '减肥方法',
  'pages/login/index': '登录',
  'pages/register/index': '注册',
  'pages/user/index': '我的',
  'pages/user/profile': '个人资料',
  'pages/user/about': '关于我们',
  'pages/user/privacy': '隐私政策',
  'pages/user/agreement': '用户协议',
  'pages/user/help': '帮助中心',
  'pages/user/help-detail': '帮助详情',
  'pages/user/feedback': '意见反馈',
  'pages/user/account-settings': '账号设置',
  'pages/user/delete-account-agreement': '注销账号协议',
  'pages/blank/index': '空白页',
  'pages/webview/index': 'H5 网页',
};

function fallbackName(routeKey) {
  const segments = routeKey.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || routeKey;
  return last;
}

function main() {
  if (!fs.existsSync(pagesJsonPath)) {
    console.error('pages.json 不存在:', pagesJsonPath);
    process.exit(1);
  }
  const pagesConfig = JSON.parse(fs.readFileSync(pagesJsonPath, 'utf8'));
  const routes = (pagesConfig.pages || []).map(p => {
    const key = p.path;
    return {
      route_key: key,
      route_name: nameMap[key] || fallbackName(key),
      path: '/' + key,
      params_schema: '{}',
      status: 'enabled'
    };
  });

  const db = new Database(dbPath);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO app_routes (route_key, route_name, path, params_schema, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  let existed = 0;
  for (const r of routes) {
    const info = insert.run(r.route_key, r.route_name, r.path, r.params_schema, r.status);
    if (info.changes > 0) {
      inserted++;
    } else {
      existed++;
    }
  }

  const total = db.prepare('SELECT COUNT(*) AS c FROM app_routes').get().c;
  console.log(`完成：新增 ${inserted} 条，已存在 ${existed} 条（状态保持不变），app_routes 共 ${total} 条`);
  db.close();
}

main();
