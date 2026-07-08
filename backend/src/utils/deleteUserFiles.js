/**
 * 用户本地文件清理工具
 * 删除用户上传的头像、反馈配图等本地静态文件
 */
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const publicDir = path.join(__dirname, '../../public');

/**
 * 安全删除本地文件（仅允许删除 public 目录下的文件）
 */
function safeDeleteLocalFile(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return;
  if (!urlPath.startsWith('/static/')) return;

  const relative = urlPath.replace(/^\/static\//, '');
  const filePath = path.join(publicDir, relative);

  // 防止路径穿越
  const resolved = path.resolve(filePath);
  const resolvedPublic = path.resolve(publicDir);
  if (!resolved.startsWith(resolvedPublic + path.sep)) return;

  try {
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      console.log(`[deleteUserFiles] 已删除文件: ${resolved}`);
    }
  } catch (err) {
    console.error(`[deleteUserFiles] 删除文件失败 ${resolved}:`, err.message);
  }
}

/**
 * 收集并删除用户上传的本地文件
 */
function deleteUserLocalFiles(userId) {
  // 头像
  const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);
  if (user?.avatar_url) {
    safeDeleteLocalFile(user.avatar_url);
  }

  // 反馈配图
  const feedbackRows = db.prepare('SELECT images FROM feedback WHERE user_id = ?').all(userId);
  for (const row of feedbackRows) {
    if (!row.images) continue;
    try {
      const images = JSON.parse(row.images);
      if (Array.isArray(images)) {
        images.forEach(safeDeleteLocalFile);
      }
    } catch (e) {
      // ignore
    }
  }
}

module.exports = {
  safeDeleteLocalFile,
  deleteUserLocalFiles
};
