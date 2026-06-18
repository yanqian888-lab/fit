// 请求基础配置
// 开发环境（HBuilderX / H5 本地预览）用 localhost
// 生产环境（Android / iOS / 小程序真机）用服务器 IP 或域名
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

const BASE_URL = isDev
  ? 'http://localhost:3000/api'
  : 'http://39.96.67.113/api';

// 生产环境请改为你的 HTTPS 域名
// const BASE_URL = 'https://your-domain.com/api';

/**
 * 统一请求封装
 */
export function request(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');

    uni.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {})
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.showToast({ title: '登录已过期', icon: 'none' });
          reject(res.data);
        } else {
          uni.showToast({ title: res.data.message || '请求失败', icon: 'none' });
          reject(res.data);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      }
    });
  });
}

export const get = (url, params = {}) => request({ url, method: 'GET', data: params });
export const post = (url, data = {}) => request({ url, method: 'POST', data });
export const put = (url, data = {}) => request({ url, method: 'PUT', data });
export const del = (url) => request({ url, method: 'DELETE' });
