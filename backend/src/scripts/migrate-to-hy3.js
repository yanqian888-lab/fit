/**
 * 一键迁移脚本：把现有的豆包 AI 配置升级为腾讯云 TokenHub Hy3
 *
 * 用法（在 backend/ 目录下执行）：
 *   方式一：通过环境变量传入 Key（推荐，避免写入 shell 历史）
 *     TENCENT_LLM_API_KEY=sk-xxxx node src/scripts/migrate-to-hy3.js
 *
 *   方式二：先在 .env 文件中配置好 TENCENT_LLM_API_KEY=...，然后直接运行
 *     node src/scripts/migrate-to-hy3.js
 *
 *   指定数据库路径（可选，默认从 .env 读取 DB_PATH）：
 *     DB_PATH=./data/app_production.db TENCENT_LLM_API_KEY=sk-xxxx node src/scripts/migrate-to-hy3.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });

const { db, initDb } = require('../db');

/**
 * 配置迁移映射：旧名字 → 新名字 + Hy3 参数
 * 对应关系说明：
 *   豆包-Helper      → Hy3-Helper(think_high)     深度推理，专业计算
 *   豆包-主Agent     → Hy3-主Agent(no_think)      极速响应聊天
 *   豆包-沉淀        → Hy3-沉淀(no_think)         快速结构化提取
 *   备用模型         → 备用模型(Hy3)              兜底
 */
const MIGRATION_RULES = [
  {
    legacyNamePattern: '%Helper%',
    newName: 'Hy3-Helper（think_high）',
    provider: 'hunyuan',
    endpoint_id: 'hy3',
    base_url: 'https://tokenhub.tencentmaas.com/v1',
    temperature: 0.5,
    max_tokens: 2000,
    timeout_ms: 120000,
    role: 'primary'
  },
  {
    legacyNamePattern: '%主Agent%',
    newName: 'Hy3-主Agent（no_think）',
    provider: 'hunyuan',
    endpoint_id: 'hy3',
    base_url: 'https://tokenhub.tencentmaas.com/v1',
    temperature: 0.7,
    max_tokens: 1000,
    timeout_ms: 55000,
    role: 'primary'
  },
  {
    legacyNamePattern: '%沉淀%',
    newName: 'Hy3-沉淀（no_think）',
    provider: 'hunyuan',
    endpoint_id: 'hy3',
    base_url: 'https://tokenhub.tencentmaas.com/v1',
    temperature: 0.1,
    max_tokens: 1200,
    timeout_ms: 60000,
    role: 'primary'
  },
  {
    legacyNamePattern: '%备用%',
    newName: '备用模型（Hy3）',
    provider: 'hunyuan',
    endpoint_id: 'hy3',
    base_url: 'https://tokenhub.tencentmaas.com/v1',
    temperature: 0.7,
    max_tokens: 1000,
    timeout_ms: 60000,
    role: 'backup'
  }
];

/**
 * 执行单条配置迁移
 */
function migrateOneRule(apiKey, rule) {
  const rows = db.prepare(`SELECT id, name FROM ai_configs WHERE name LIKE ?`).all(rule.legacyNamePattern);
  if (rows.length === 0) {
    console.log(`  ⏭️  未匹配到名称 LIKE "${rule.legacyNamePattern}" 的配置，跳过`);
    return 0;
  }

  const updateStmt = db.prepare(`
    UPDATE ai_configs SET
      name        = ?,
      provider    = ?,
      base_url    = ?,
      api_key     = ?,
      endpoint_id = ?,
      temperature = ?,
      max_tokens  = ?,
      timeout_ms  = ?,
      role        = ?,
      updated_at  = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let count = 0;
  for (const row of rows) {
    updateStmt.run(
      rule.newName,
      rule.provider,
      rule.base_url,
      apiKey,
      rule.endpoint_id,
      rule.temperature,
      rule.max_tokens,
      rule.timeout_ms,
      rule.role,
      row.id
    );
    console.log(`  ✅ [${row.id}] ${row.name} → ${rule.newName}`);
    count++;
  }
  return count;
}

/**
 * 主入口
 */
function main() {
  // 1. 获取 API Key
  const apiKey = process.env.TENCENT_LLM_API_KEY || process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    console.error('❌ 未找到 API Key。请通过环境变量 TENCENT_LLM_API_KEY 传入，或在 .env 文件中配置。');
    console.error('   示例：TENCENT_LLM_API_KEY=sk-xxxx node src/scripts/migrate-to-hy3.js');
    process.exit(1);
  }
  const maskedKey = apiKey.length > 12
    ? apiKey.slice(0, 6) + '****' + apiKey.slice(-4)
    : '****';
  console.log(`🔑 使用 API Key：${maskedKey}`);

  // 2. 初始化数据库（自动加载 .env 里的 DB_PATH）
  initDb();
  const dbPath = process.env.DB_PATH || './data/app.db';
  console.log(`🗄️  目标数据库：${dbPath}`);

  // 3. 打印迁移前配置
  console.log('\n📋 迁移前 AI 配置：');
  const before = db.prepare('SELECT id, name, provider, endpoint_id, role, is_enabled FROM ai_configs ORDER BY id ASC').all();
  if (before.length === 0) {
    console.log('   （空表，下次启动服务时会自动以 Hy3 参数初始化）');
  } else {
    for (const row of before) {
      console.log(`   [${row.id}] name=${row.name} | provider=${row.provider} | endpoint=${row.endpoint_id} | role=${row.role} | enabled=${row.is_enabled}`);
    }
  }

  // 4. 执行迁移
  console.log('\n🚀 开始迁移...');
  let totalUpdated = 0;
  for (const rule of MIGRATION_RULES) {
    console.log(`\n📌 规则：匹配 ${rule.legacyNamePattern} → ${rule.newName}`);
    totalUpdated += migrateOneRule(apiKey, rule);
  }

  // 5. 打印迁移后结果
  console.log('\n\n✅ 迁移完成！');
  console.log(`📊 共更新 ${totalUpdated} 条配置\n`);
  console.log('📋 迁移后 AI 配置：');
  const after = db.prepare(`
    SELECT id, name, provider, base_url, endpoint_id, temperature, max_tokens, timeout_ms, role, is_enabled
    FROM ai_configs ORDER BY id ASC
  `).all();
  for (const row of after) {
    const shortBase = row.base_url.replace(/^https?:\/\//, '').slice(0, 30);
    console.log(
      `   [${row.id}] ${row.name}` +
      `\n      provider=${row.provider} | endpoint=${row.endpoint_id} | base=${shortBase}...` +
      `\n      temp=${row.temperature} | max_tokens=${row.max_tokens} | timeout=${row.timeout_ms}ms | role=${row.role} | enabled=${row.is_enabled}`
    );
  }

  console.log('\n💡 提示：');
  console.log('   1. 现在可以重启后端服务使配置生效');
  console.log('   2. 也可登录 CMS → AI配置 页面，可视化核对/微调每条配置');
  console.log('   3. 调用时会根据 promptKey 自动注入 thinking_mode（main→no_think / helper→think_high / 沉淀→no_think）');
}

main();
