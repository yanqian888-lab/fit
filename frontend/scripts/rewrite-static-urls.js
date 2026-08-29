/**
 * 批量将模板中的静态图片 src 改为 resolveStaticUrl 远程加载
 * 仅处理 <image src="/static/image/icon/xxx"> 和 :src="'/static/image/icon/xxx'" 两种形式
 * 处理完成后会检查并补充 import { resolveStaticUrl } from '../utils/environment.js'（按文件深度自适应）
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');

// 本次要远程化的图片文件名列表
const TARGET_IMAGES = new Set([
  'liaoliao01@3x.png',
  'gongjvxiang01@3x.png',
  'quesheng01.png',
  'sun.png',
  'zhuan.png',
  'rou.png',
  'xianhua@3x.png',
  'jiangguo@3x.png',
  'tanhao@3x.png',
  'ganwuji.png',
  'jiyundong.png',
  'beibao@3x.png',
  'lichengbei.png',
  'setting@3x.png',
  'zuoguilian@3x.png',
  'sayhi@3x.png',
  'baobao@3x.png',
  'shijian@3x.png',
  'renwu@3x.png',
  'rijiji.png',
  'send@3x.png',
  'jitizhong@3x.png',
  'shipuku.png',
  'jiyinshi.png',
  'jitizhong.png',
  'jiheshui.png',
  'fangfaku.png',
  'shangdian@3x.png',
  'shangdianicon@3x.png'
]);

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getImportPath(fileDir) {
  const rel = path.relative(fileDir, path.join(SRC_DIR, 'utils'));
  const prefix = rel ? `${rel}/` : './';
  return `${prefix}environment.js`;
}

function rewriteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  const fileDir = path.dirname(filePath);

  for (const img of TARGET_IMAGES) {
    const escaped = escapeRegExp(img);

    // 1. <image src="/static/image/icon/xxx" ...> -> <image :src="resolveStaticUrl('/static/image/icon/xxx')" ...>
    const staticSrcRegex = new RegExp(
      `(<image\\s+[^>]*?)src="/static/image/icon/${escaped}"`,
      'g'
    );
    content = content.replace(staticSrcRegex, `$1:src="resolveStaticUrl('/static/image/icon/${img}')"`);

    // 2. :src="'/static/image/icon/xxx'" -> :src="resolveStaticUrl('/static/image/icon/xxx')"
    const boundSrcRegex = new RegExp(
      `:src="'/static/image/icon/${escaped}'"`,
      'g'
    );
    content = content.replace(boundSrcRegex, `:src="resolveStaticUrl('/static/image/icon/${img}')"`);

    // 3. 组件 prop 形式如 bubble-icon="/static/image/icon/xxx" -> :bubble-icon="resolveStaticUrl('/static/image/icon/xxx')"
    const propRegex = new RegExp(
      `([a-z-]+)="/static/image/icon/${escaped}"`,
      'g'
    );
    content = content.replace(propRegex, `:$1="resolveStaticUrl('/static/image/icon/${img}')"`);
  }

  if (content === original) return false;

  // 补充 import
  const importPath = getImportPath(fileDir);
  const importStatement = `import { resolveStaticUrl } from '${importPath}';`;
  if (!content.includes('resolveStaticUrl')) {
    // 没有使用到 resolveStaticUrl，不处理
    return false;
  }
  if (content.includes(importStatement)) {
    // 已导入
  } else if (content.includes('resolveStaticUrl')) {
    // 在 <script setup> 第一行后插入
    content = content.replace(/(<script setup>\n)/, `$1${importStatement}\n`);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.vue') || entry.name.endsWith('.js'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  const files = walk(SRC_DIR);
  let changedCount = 0;
  for (const file of files) {
    try {
      const changed = rewriteFile(file);
      if (changed) {
        console.log(`✅ ${path.relative(SRC_DIR, file)}`);
        changedCount++;
      }
    } catch (err) {
      console.error(`❌ ${path.relative(SRC_DIR, file)}: ${err.message}`);
    }
  }
  console.log(`\n共修改 ${changedCount} 个文件`);
}

main();
