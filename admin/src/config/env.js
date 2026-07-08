/**
 * 管理后台环境配置
 * 通过 .env.{mode} 文件中的 VITE_API_BASE_URL 指定后端 API 地址
 * mode 由 package.json 中的 build 脚本传入：development / test / production
 */
const env = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';

const configs = {
  development: {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api'
  },
  test: {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://test-api.fitapp.com/api'
  },
  production: {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.fitapp.com/api'
  }
};

const config = configs[env] || configs.development;

export default config;
export const API_BASE_URL = config.apiBaseUrl;
