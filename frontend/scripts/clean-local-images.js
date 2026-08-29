/**
 * 删除 frontend/static 下已迁移到远程 CDN 的图片，仅保留小程序必需的小图标/SVG
 */
const fs = require('fs');
const path = require('path');

const ICON_DIR = path.join(__dirname, '../static/image/icon');
const SVG_DIR = path.join(__dirname, '../static/svg');

// 需要保留在本地的小图标/SVG（< 4KB 或 tabbar/菜单等高频小图）
const KEEP_FILES = new Set([
  'chehui@3x.png',
  'empty_dish.svg',
  'eye_close.svg',
  'eye_open.svg',
  'fangda.png',
  'loading01.svg',
  'loading02.svg',
  'menu_about.svg',
  'menu_account.svg',
  'menu_agreement.svg',
  'menu_feedback.svg',
  'menu_message.svg',
  'menu_partner.svg',
  'menu_privacy.svg',
  'qr_placeholder.png',
  'sousuo.svg',
  'tabbar_bowuguan.png',
  'tabbar_bowuguan_hover.png',
  'tabbar_dada.png',
  'tabbar_dada_hover.png',
  'tabbar_gongjvxiang.png',
  'tabbar_gongjvxiang_hover.png',
  'tabbar_liaoliao.png',
  'tabbar_liaoliao_hover.png',
  'tianjia.svg',
  'xiangshang.png',
  'xiangxia.png',
  'xiugai.png',
  'zhankai01.svg'
]);

function removeFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    console.error(`❌ 删除失败 ${filePath}: ${err.message}`);
    return false;
  }
}

function removeDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error(`❌ 删除目录失败 ${dirPath}: ${err.message}`);
    return false;
  }
}

function main() {
  let removedCount = 0;
  let removedSize = 0;

  const entries = fs.readdirSync(ICON_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const filePath = path.join(ICON_DIR, entry.name);
    if (KEEP_FILES.has(entry.name)) continue;

    const stat = fs.statSync(filePath);
    if (removeFile(filePath)) {
      removedCount++;
      removedSize += stat.size;
      console.log(`🗑️  ${entry.name} (${(stat.size / 1024).toFixed(1)}KB)`);
    }
  }

  // 删除未使用的 svg/dada 目录
  if (fs.existsSync(SVG_DIR)) {
    const svgStat = fs.statSync(SVG_DIR);
    if (removeDir(SVG_DIR)) {
      removedCount++;
      removedSize += svgStat.size;
      console.log(`🗑️  svg/dada 目录 (${(svgStat.size / 1024).toFixed(1)}KB)`);
    }
  }

  console.log(`\n共删除 ${removedCount} 项，释放 ${(removedSize / 1024).toFixed(1)}KB`);
}

main();
