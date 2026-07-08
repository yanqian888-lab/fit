/**
 * 前端构建时环境配置
 * 通过 .env.{mode} 文件中的 VITE_SERVER_URL 指定后端地址
 * mode 由 package.json 中的 build 脚本传入：development / test / production
 */
export const BUILD_ENV = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';

export const ENV_CONFIG = {
  development: {
    serverUrl: import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
  },
  test: {
    serverUrl: import.meta.env.VITE_SERVER_URL || 'https://test-api.fitapp.com'
  },
  production: {
    serverUrl: import.meta.env.VITE_SERVER_URL || 'https://api.fitapp.com'
  }
};

const config = ENV_CONFIG[BUILD_ENV] || ENV_CONFIG.development;

export const DEFAULT_SERVER_URL = config.serverUrl;
export const DEFAULT_BASE_URL = `${DEFAULT_SERVER_URL}/api`;
