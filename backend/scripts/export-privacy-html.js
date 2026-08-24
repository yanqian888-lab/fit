/**
 * 导出用户协议/隐私政策为静态 HTML（供 App 启动期原生隐私弹窗离线展示）
 * 数据源：app_configs 表（后台「协议配置」维护的内容）
 * 输出：frontend/static/privacy/user_agreement.html / privacy_policy.html
 * 用法：cd backend && node scripts/export-privacy-html.js   （协议内容变更后重跑，并重新打包）
 */
const fs = require('fs');
const path = require('path');
const { db } = require('../src/db');

const OUT_DIR = path.join(__dirname, '../../frontend/static/privacy');

const PAGE = (title, body) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif; margin: 0; padding: 20px 16px; background: #FAFAF5; color: #333; }
  .content { white-space: pre-wrap; font-size: 15px; line-height: 1.8; }
</style>
</head>
<body>
<div class="content">${body}</div>
</body>
</html>
`;

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function exportOne(configKey, title, filename) {
  const row = db.prepare('SELECT config_value FROM app_configs WHERE config_key = ?').get(configKey);
  if (!row || !row.config_value) {
    console.error(`[跳过] ${configKey}: 无内容`);
    return false;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, filename), PAGE(title, esc(row.config_value)), 'utf-8');
  console.log(`[导出] ${filename} (${row.config_value.length} 字符)`);
  return true;
}

exportOne('user_agreement', '用户协议', 'user_agreement.html');
exportOne('privacy_policy', '隐私政策', 'privacy_policy.html');
console.log('完成。androidPrivacy.json 中的链接即指向这两个文件。');
