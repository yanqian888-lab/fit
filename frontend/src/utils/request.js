import { getServerUrl, getBaseUrl } from './environment.js';

/**
 * 统一请求封装
 */
export function request(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');

    uni.request({
      url: `${getBaseUrl()}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: 65000, // 65秒超时，覆盖后端完整AI调用链（mainAgent 60s + helperAgent 50s）
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
          // 清除页面栈并回到登录页，防止未登录状态下继续查看旧数据
          uni.reLaunch({ url: '/pages/login/index' });
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

/**
 * 文件上传封装
 */
export function uploadFile(url, filePath, name = 'file', formData = {}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');

    uni.uploadFile({
      url: `${getBaseUrl()}${url}`,
      filePath,
      name,
      formData,
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: (res) => {
        let data;
        try {
          data = JSON.parse(res.data);
        } catch (e) {
          data = res.data;
        }
        if (res.statusCode === 200 && data.code === 0) {
          resolve(data);
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.showToast({ title: '登录已过期', icon: 'none' });
          uni.reLaunch({ url: '/pages/login/index' });
          reject(data);
        } else {
          uni.showToast({ title: data.message || '上传失败', icon: 'none' });
          reject(data);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '上传失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

export { getServerUrl, getBaseUrl };
