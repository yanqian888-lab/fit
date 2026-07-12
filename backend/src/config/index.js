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

module.exports = {
  port: process.env.PORT || 3000,
  env,
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  doubao: {
    apiKey: process.env.DOUBAO_API_KEY,
    baseURL: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    endpoints: {
      main: {
        id: process.env.DOUBAO_MAIN_AGENT_ENDPOINT,
        apiKey: process.env.DOUBAO_MAIN_AGENT_API_KEY || process.env.DOUBAO_API_KEY
      },
      precipitation: {
        id: process.env.DOUBAO_PRECIPITATION_ENDPOINT,
        apiKey: process.env.DOUBAO_PRECIPITATION_API_KEY || process.env.DOUBAO_API_KEY
      },
      helper: {
        id: process.env.DOUBAO_HELPER_ENDPOINT,
        apiKey: process.env.DOUBAO_HELPER_API_KEY || process.env.DOUBAO_API_KEY
      }
    }
  },
  // 备用大模型配置（所有密钥均从环境变量读取，禁止在源码中写死）
  backup: {
    apiKey: process.env.BACKUP_API_KEY,
    baseURL: process.env.BACKUP_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    endpoint: {
      id: process.env.BACKUP_ENDPOINT
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
