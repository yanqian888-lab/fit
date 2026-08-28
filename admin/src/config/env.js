/**
 * 管理后台环境配置
 * 通过 .env.{mode} 文件中的 VITE_API_BASE_URL 指定后端 API 地址
 * mode 由 package.json 中的 build 脚本传入：development / test / production
 *
 * 注意：production 模式下强制最终校验 API 地址必须是 HTTPS + 正式域名
 *       （防止出现 baseURL 是 http://服务器公网IP/api 导致 HTTPS 页面发 HTTP 请求被拦截的 Mixed Content 错误）
 */
const env = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development';

const configs = {
  development: {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api'
  },
  test: {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.test.fit.mianyan.xin/api'
  },
  production: {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.fit.mianyan.xin/api'
  }
};

let config = configs[env] || configs.development;

/**
 * 生产环境最终兜底：强制替换非法 baseURL
 * 非法情况：① 使用服务器公网 IP（如 39.96.67.113）② HTTP 协议 ③ 不是正式域名 api.fit.mianyan.xin
 * 兜底结果：一律替换为 https://api.fit.mianyan.xin/api，彻底解决 Mixed Content 问题
 */
const IP_REGEX = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;
if (env === 'production') {
  const url = config.apiBaseUrl;
  const isHttp = url.startsWith('http:');
  const containsIp = IP_REGEX.test(url);
  const notOfficialDomain = !url.includes('api.fit.mianyan.xin');

  if (isHttp || containsIp || notOfficialDomain) {
    config = { ...config, apiBaseUrl: 'https://api.fit.mianyan.xin/api' };
  }
}

export default config;
export const API_BASE_URL = config.apiBaseUrl;

/**
 * 根据 API_BASE_URL 推导服务器根域名（去除 /api 路径）
 * 用于拼接静态资源（图片、文件）的完整访问地址
 * @returns {string} 服务器根域名，如 https://api.fit.mianyan.xin
 */
export function getServerRoot() {
  const base = config.apiBaseUrl || '';
  return base.replace(/\/api\/?$/, '');
}

/**
 * 将相对路径转换为完整 URL
 * 前端返回的静态资源路径（如 /static/uploads/xxx.jpg）需要拼接服务器域名
 * @param {string} path - 相对路径，如 /static/uploads/xxx.jpg
 * @returns {string} 完整 URL，如 https://api.fit.mianyan.xin/static/uploads/xxx.jpg
 */
export function getFullUrl(path) {
  if (!path) return '';
  // 已经是完整 URL 的直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // 相对路径以 / 开头，拼接服务器根域名
  if (path.startsWith('/')) {
    return getServerRoot() + path;
  }
  // 其他情况，直接拼接
  return getServerRoot() + '/' + path;
}
