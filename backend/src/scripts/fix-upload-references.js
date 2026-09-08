/**
 * 修复数据库中残留的上传文件引用
 * 功能：
 *   1. 扫描 app_configs（pet_sprite / pet_scenes 等）和 popups 等表中包含 img_1_ 或 /static/uploads/ 的文本字段；
 *   2. 将 localhost / 127.0.0.1 的绝对 URL 统一改为相对路径 /static/uploads/xxx，避免域名切换后失效；
 *   3. 检查引用的文件在 backend/public/uploads 中是否存在，输出缺失清单；
 *   4. 默认只打印，加 --apply 参数才执行 UPDATE。
 * 运行：cd backend && node src/scripts/fix-upload-references.js [--apply]
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const defaultDbPath = path.join(__dirname, '../../data/app.db');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dbArg = args.find(a => a !== '--apply' && a.startsWith('/'));
const dbPath = dbArg || defaultDbPath;
const uploadsDir = path.join(__dirname, '../../public/uploads');

const PATTERNS = ['img_1_', '/static/uploads/'];

/**
 * 把任意静态资源 URL 规范化为相对路径 /static/uploads/{filename}
 * - 相对路径保持不变
 * - localhost / 127.0.0.1 / 生产域名的完整 URL，统一提取路径部分
 * @param {string} url 原始 URL
 * @returns {string} 规范化后的相对路径
 */
function normalizeToRelative(url) {
  if (!url) return url;
  // 已是相对路径
  if (url.startsWith('/static/uploads/')) return url;
  // 去掉协议和域名
  const m = url.match(/^(https?:)?\/\/[^/]+(\/static\/uploads\/[^?#]+)/i);
  if (m) return m[2];
  return url;
}

/**
 * 检查相对路径对应的物理文件是否存在
 * @param {string} url 相对或绝对 URL
 * @returns {boolean}
 */
function fileExists(url) {
  if (!url) return false;
  const m = url.match(/\/static\/uploads\/([^?#]+)/);
  if (!m) return false;
  return fs.existsSync(path.join(uploadsDir, m[1]));
}

/**
 * 递归处理 JSON 对象/数组中的 URL 字符串
 * @param {*} value 任意值
 * @param {string} mode 'normalize' | 'check'
 * @param {Array} missing 收集缺失文件
 * @returns {*} 处理后的值（mode=normalize 时返回新对象，不修改原值）
 */
function processValue(value, mode, missing) {
  if (typeof value === 'string') {
    const containsRef = PATTERNS.some(p => value.includes(p));
    if (!containsRef) return value;
    if (mode === 'check' && !fileExists(value)) {
      missing.push(value);
    }
    if (mode === 'normalize') {
      return normalizeToRelative(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => processValue(v, mode, missing));
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = processValue(v, mode, missing);
    }
    return next;
  }
  return value;
}

/**
 * 扫描单张表，收集需要更新的记录
 * @param {Database} db 数据库实例
 * @param {string} table 表名
 * @returns {Array<{table, pk, field, oldValue, newValue, missingFiles}>}
 */
function scanTable(db, table) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const textCols = cols.filter(c => {
    const t = String(c.type || '').toUpperCase();
    return t.includes('TEXT') || t.includes('CHAR') || t.includes('JSON') || t.includes('BLOB') || !t;
  });
  if (textCols.length === 0) return [];

  const pkCol = cols.find(c => c.pk === 1)?.name || 'id';
  const conditions = textCols.map(c => `COALESCE(${c.name}, '') LIKE '%${PATTERNS[0]}%' OR COALESCE(${c.name}, '') LIKE '%${PATTERNS[1]}%'`).join(' OR ');
  let rows = [];
  try {
    rows = db.prepare(`SELECT * FROM ${table} WHERE ${conditions}`).all();
  } catch (err) {
    return [];
  }

  const updates = [];
  for (const row of rows) {
    for (const col of textCols) {
      const raw = row[col.name];
      if (raw == null) continue;
      const str = String(raw);
      if (!PATTERNS.some(p => str.includes(p))) continue;

      let parsed = null;
      let isJson = false;
      try {
        parsed = JSON.parse(str);
        isJson = true;
      } catch (e) {
        parsed = str;
      }

      const missing = [];
      processValue(parsed, 'check', missing);
      const normalized = processValue(parsed, 'normalize', []);
      const newValue = isJson ? JSON.stringify(normalized) : normalized;

      if (newValue !== str || missing.length > 0) {
        updates.push({
          table,
          pk: row[pkCol],
          pkCol,
          field: col.name,
          oldValue: str,
          newValue,
          missingFiles: missing
        });
      }
    }
  }
  return updates;
}

function main() {
  console.log(`数据库: ${dbPath}`);
  console.log(`运行模式: ${apply ? '应用修复' : '仅预览（加 --apply 才写入）'}`);

  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  let total = 0;

  for (const { name: table } of tables) {
    const updates = scanTable(db, table);
    if (updates.length === 0) continue;
    total += updates.length;
    console.log(`\n[表] ${table}  需处理记录: ${updates.length}`);
    for (const u of updates) {
      console.log(`  主键 ${u.pkCol}=${u.pk}, 字段 ${u.field}`);
      if (u.oldValue !== u.newValue) {
        console.log(`    旧值: ${u.oldValue.slice(0, 120)}...`);
        console.log(`    新值: ${u.newValue.slice(0, 120)}...`);
      }
      if (u.missingFiles.length) {
        console.log(`    ⚠️ 缺失文件: ${u.missingFiles.join(', ')}`);
      }
      if (apply) {
        db.prepare(`UPDATE ${table} SET ${u.field} = ? WHERE ${u.pkCol} = ?`).run(u.newValue, u.pk);
      }
    }
  }

  db.close();
  console.log(`\n共发现 ${total} 处需要处理。`);
  if (apply) console.log('已写入数据库。');
  else console.log('未写入，请加 --apply 参数执行修复。');
}

main();
