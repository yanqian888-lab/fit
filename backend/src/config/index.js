/**
 * 全局配置
 */
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  doubao: {
    apiKey: process.env.DOUBAO_API_KEY,
    baseURL: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    endpoints: {
      main: process.env.DOUBAO_MAIN_AGENT_ENDPOINT,
      precipitation: process.env.DOUBAO_PRECIPITATION_ENDPOINT,
      helper: process.env.DOUBAO_HELPER_ENDPOINT
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
