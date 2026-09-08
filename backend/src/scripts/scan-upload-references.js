/**
 * 扫描数据库中残留的上传文件引用
 * 功能：遍历 SQLite 所有表，查找包含 img_1_ 或 /static/uploads/ 的文本字段，
 *       输出表名、字段名及匹配的片段，用于定位被删除文件仍被引用的地方。
 * 运行：cd backend && node src/scripts/scan-upload-references.js [db_path]
 */
const Database = require('better-sqlite3');
const path = require('path');

// 默认使用开发数据库；可通过命令行参数指定生产库路径
const defaultDbPath = path.join(__dirname, '../../data/app.db');
const dbPath = process.argv[2] || defaultDbPath;

// 需要扫描的引用特征
const PATTERNS = ['img_1_', '/static/uploads/'];

/**
 * 判断字段类型是否为可能存储 URL/JSON 的文本类型
 * @param {string} type PRAGMA table_info 返回的字段类型
 * @returns {boolean}
 */
function isTextLike(type) {
  if (!type) return true;
  const t = String(type).toUpperCase();
  return t.includes('TEXT') || t.includes('CHAR') || t.includes('CLOB') || t.includes('BLOB') || t.includes('JSON');
}

/**
 * 扫描单张表中的文本字段，输出匹配 PATTERNS 的记录
 * @param {Database} db 数据库实例
 * @param {string} table 表名
 */
function scanTable(db, table) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const textCols = cols.filter(c => isTextLike(c.type)).map(c => c.name);
  if (textCols.length === 0) return;

  for (const pattern of PATTERNS) {
    const conditions = textCols
      .map(c => `COALESCE(${c}, '') LIKE '%${pattern}%'`)
      .join(' OR ');
    let rows = [];
    try {
      rows = db.prepare(`SELECT * FROM ${table} WHERE ${conditions}`).all();
    } catch (err) {
      // 某些表可能不支持通配查询，跳过报错
      continue;
    }
    if (rows.length === 0) continue;

    console.log(`\n[表] ${table}  匹配特征: "${pattern}"  记录数: ${rows.length}`);
    for (const row of rows.slice(0, 10)) {
      for (const col of textCols) {
        const val = row[col];
        if (val == null) continue;
        const str = String(val);
        if (!str.includes(pattern)) continue;
        // 只打印包含匹配片段的上下文，避免 JSON 过长刷屏
        const idx = str.indexOf(pattern);
        const start = Math.max(0, idx - 60);
        const end = Math.min(str.length, idx + 120);
        const snippet = str.slice(start, end).replace(/\s+/g, ' ');
        console.log(`  字段 ${col}: ...${snippet}...`);
      }
    }
  }
}

function main() {
  console.log(`扫描数据库: ${dbPath}`);
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  let foundAny = false;

  for (const { name: table } of tables) {
    const before = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
    scanTable(db, table);
    // 通过检查输出是否有 [表] 标记来判断是否发现？这里简化为只扫描
  }

  db.close();
  console.log('\n扫描完成。');
}

main();
