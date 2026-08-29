/**
 * 修复重复的 resolveStaticUrl import
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');

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

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const importLines = [];
  const importSet = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/import\s+\{\s*resolveStaticUrl\s*\}\s+from\s+['"]([^'"]+)['"];?/);
    if (match) {
      importLines.push({ index: i, line, path: match[1] });
    }
  }

  if (importLines.length <= 1) return false;

  // 保留第一个，删除后面的
  const toRemove = importLines.slice(1).map((item) => item.index);
  const newLines = lines.filter((_, idx) => !toRemove.includes(idx));

  // 规范化第一个 import 路径为 ../utils/environment.js（避免 .js 后缀不一致）
  const firstImport = importLines[0];
  const normalizedPath = firstImport.path.replace(/\/environment(\.js)?$/, '/environment.js');
  newLines[firstImport.index] = firstImport.line.replace(
    /from\s+['"][^'"]+['"];?/,
    `from '${normalizedPath}';`
  );

  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  return true;
}

function main() {
  const files = walk(SRC_DIR);
  let count = 0;
  for (const file of files) {
    try {
      if (fixFile(file)) {
        console.log(`✅ ${path.relative(SRC_DIR, file)}`);
        count++;
      }
    } catch (err) {
      console.error(`❌ ${path.relative(SRC_DIR, file)}: ${err.message}`);
    }
  }
  console.log(`\n共修复 ${count} 个文件的重复 import`);
}

main();
