/**
 * 全局配置
 * 支持多环境：development / test / production
 * 加载优先级：.env（默认） < .env.${NODE_ENV}（环境覆盖，跳过占位符） < 系统环境变量
 */
const fs = require('fs');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const projectRoot = path.resolve(__dirname, '..', '..');
const defaultEnvFile = path.join(projectRoot, '.env');
const envFile = path.join(projectRoot, `.env.${env}`);

const PLACEHOLDER_RE = /^(your-[a-z0-9-]*|ep-xxxxxx|your-super-secret-jwt-key-change-in-production|your-test-jwt-secret|your-production-jwt-secret)$/i;
const PLACEHOLDER_SUB_RE = /xxxxxx|change-in-production|change-me/i;

function isPlaceholder(value) {
  if (!value) return true;
  return PLACEHOLDER_RE.test(value) || PLACEHOLDER_SUB_RE.test(value);
}

function loadEnvFile(filePath, { override = false, skipPlaceholder = false } = {}) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = require('dotenv').parse(content);
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || value === '') continue;
    if (skipPlaceholder && isPlaceholder(value)) continue;
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

// 1. 加载默认 .env（如果存在），不覆盖已存在的系统环境变量，并跳过占位符
loadEnvFile(defaultEnvFile, { override: false, skipPlaceholder: true });

// 2. 加载环境专属 .env.${NODE_ENV}（如果存在），覆盖默认值；
// 但跳过形如 your-* / xxxxx / change-in-production 的占位符，防止覆盖真实密钥
loadEnvFile(envFile, { override: true, skipPlaceholder: true });

/**
 * 获取/生成一个跨进程共享且持久化的 JWT 密钥。
 * - 优先使用显式配置的环境变量 JWT_SECRET
 * - 若未配置（或为占位符），则尝试读取 projectRoot/.jwt-secret.txt
 * - 若文件也不存在，则生成一个安全随机密钥并写入该文件
 * 这样即使 PM2 多 worker 并发启动，也能共享同一个 secret，
 * 避免 A 进程签发的 token 到 B 进程 verify 失败（导致随机401"登录已过期"）。
 */
function resolveJwtSecret(env, projectRoot, isPlaceholderFn) {
  const explicit = process.env.JWT_SECRET;
  if (explicit && !isPlaceholderFn(explicit)) return explicit;

  if (env === 'production' && (!explicit || isPlaceholderFn(explicit))) {
    // 生产环境仍然强制显式配置，避免误部署
    throw new Error('[FATAL] 生产环境必须在 .env 或系统环境变量中显式配置 JWT_SECRET，且不能使用占位符值');
  }

  const secretFile = path.join(projectRoot, '.jwt-secret.txt');
  try {
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf8').trim();
      if (saved && saved.length >= 16) return saved;
    }
    // 生成一个安全的随机密钥并持久化
    const crypto = require('crypto');
    const newSecret = crypto.randomBytes(48).toString('base64url');
    try { fs.mkdirSync(path.dirname(secretFile), { recursive: true }); } catch (_) {}
    try { fs.writeFileSync(secretFile, newSecret, { mode: 0o600 }); } catch (_) {}
    // 顺便同步到 .env（如果 .env 文件存在且里面没有 JWT_SECRET 行）
    try {
      if (fs.existsSync(defaultEnvFile)) {
        const dotenvContent = fs.readFileSync(defaultEnvFile, 'utf8');
        if (!/^\s*JWT_SECRET\s*=/m.test(dotenvContent)) {
          fs.appendFileSync(defaultEnvFile, `\n# 自动生成的 JWT 持久化密钥（PM2多worker共享）\nJWT_SECRET=${newSecret}\n`);
        }
      }
    } catch (_) {}
    console.warn(`[INFO] ${env} 环境未显式配置 JWT_SECRET，已生成持久化密钥并保存到 ${secretFile}（多进程共享）`);
    return newSecret;
  } catch (e) {
    // 极端兜底：如果文件也写不了（只读文件系统）就崩溃退出，避免 Math.random 型 bug
    throw new Error(`[FATAL] 无法解析 JWT 密钥且无法生成持久化密钥: ${e.message}`);
  }
}

// JWT 密钥：生产环境必须显式配置；开发/测试环境若缺失则生成持久化共享密钥（防止多 worker 不一致）
const jwtSecret = resolveJwtSecret(env, projectRoot, isPlaceholder);

module.exports = {
  port: process.env.PORT || 3000,
  env,
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  // LLM 统一配置
  // 兼容两种环境变量命名：DOUBAO_*（.env.test/.env.production 当前使用）优先，
  // 回退到 TENCENT_LLM_*（历史配置及 .env.development 当前使用）。
  llm: {
    apiKey: process.env.DOUBAO_MAIN_AGENT_API_KEY || process.env.TENCENT_LLM_API_KEY,
    baseURL: process.env.DOUBAO_BASE_URL || process.env.TENCENT_LLM_BASE_URL || 'https://tokenhub.tencentmaas.com/v1',
    model: process.env.DOUBAO_MAIN_AGENT_ENDPOINT || process.env.TENCENT_LLM_MODEL || 'hy3',
    endpoints: {
      main: {
        id: process.env.DOUBAO_MAIN_AGENT_ENDPOINT || process.env.TENCENT_MAIN_AGENT_MODEL || 'hy3',
        apiKey: process.env.DOUBAO_MAIN_AGENT_API_KEY || process.env.TENCENT_MAIN_AGENT_API_KEY || process.env.DOUBAO_MAIN_AGENT_API_KEY || process.env.TENCENT_LLM_API_KEY
      },
      precipitation: {
        id: process.env.DOUBAO_PRECIPITATION_ENDPOINT || process.env.TENCENT_PRECIPITATION_MODEL || 'hy3',
        apiKey: process.env.DOUBAO_PRECIPITATION_API_KEY || process.env.TENCENT_PRECIPITATION_API_KEY || process.env.DOUBAO_MAIN_AGENT_API_KEY || process.env.TENCENT_LLM_API_KEY
      },
      helper: {
        id: process.env.DOUBAO_HELPER_ENDPOINT || process.env.TENCENT_HELPER_MODEL || 'hy3',
        apiKey: process.env.DOUBAO_HELPER_API_KEY || process.env.TENCENT_HELPER_API_KEY || process.env.DOUBAO_MAIN_AGENT_API_KEY || process.env.TENCENT_LLM_API_KEY
      }
    }
  },
  // 备用大模型配置（所有密钥均从环境变量读取，禁止在源码中写死）
  backup: {
    apiKey: process.env.BACKUP_API_KEY,
    baseURL: process.env.BACKUP_BASE_URL || 'https://tokenhub.tencentmaas.com/v1',
    endpoint: {
      id: process.env.BACKUP_ENDPOINT || 'hy3'
    }
  },
  wechat: {
    appId: process.env.WECHAT_APPID,
    secret: process.env.WECHAT_SECRET
  },
  cos: {
    secretId: process.env.COS_SECRET_ID,
    secretKey: process.env.COS_SECRET_KEY,
    bucket: process.env.COS_BUCKET,
    region: process.env.COS_REGION,
    domain: process.env.COS_DOMAIN
  },
  db: {
    path: process.env.DB_PATH || './data/app.db'
  }
};
