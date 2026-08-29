import { getServerUrl, getBaseUrl } from './environment.js';

let isRedirecting401 = false;

/**
 * 统一请求封装
 * @param {Object} options 请求配置
 * @param {string} options.url 请求地址
 * @param {string} options.method 请求方法
 * @param {Object} options.data 请求参数
 * @param {Object} options.header 请求头
 * @param {boolean|string} options.loading 是否显示 loading，true 显示默认文案，字符串显示自定义文案
 * @param {boolean} options.loadingMask 是否显示透明蒙层，防止触摸穿透，默认 true
 * @param {boolean} options.skip401Redirect 是否跳过 401 重定向（登录后获取用户信息时使用）
 */
export function request(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');
    const showLoading = options.loading !== false && options.loading !== undefined;
    const loadingTitle = typeof options.loading === 'string' ? options.loading : '加载中...';

    if (showLoading) {
      uni.showLoading({ title: loadingTitle, mask: options.loadingMask !== false });
    }

    try {
      uni.request({
        url: `${getBaseUrl()}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        timeout: 65000,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.header || {})
        },
        success: (res) => {
          try {
            if (showLoading) uni.hideLoading();
            const data = res.data || {};
            if (res.statusCode === 200 && data.code === 0) {
              resolve(data);
            } else if (res.statusCode === 401) {
              uni.removeStorageSync('token');
              // 同步清除 store 中的 token ref，避免 isLoggedIn 仍为 true 反复触发 401
              uni.$emit('auth:expired');
              // 后置登录：401 只清除登录态，不跳转登录页
              // 用户可以继续浏览 4 个 tab，执行操作时 requireAuth() 会引导登录
              if (!options.skip401Redirect && !isRedirecting401) {
                isRedirecting401 = true;
                uni.showToast({ title: '登录已过期', icon: 'none' });
                setTimeout(() => {
                  isRedirecting401 = false;
                }, 300);
              }
              reject(data);
            } else {
              if (!options.silent) {
                uni.showToast({ title: data.message || `请求失败(${res.statusCode})`, icon: 'none' });
              }
              reject(data);
            }
          } catch (err) {
            console.error('[request] success 回调异常', err);
            reject(err);
          }
        },
        fail: (err) => {
          try {
            if (showLoading) uni.hideLoading();
            uni.showToast({ title: '网络错误', icon: 'none' });
          } catch (e) {
            // 忽略 hideLoading/showToast 异常
          }
          reject(err);
        }
      });
    } catch (syncErr) {
      // 捕获 uni.request 同步抛出的异常（如渲染层未就绪导致的 addListener 错误）
      console.warn('[request] uni.request 同步异常', syncErr?.message || syncErr);
      if (showLoading) {
        try { uni.hideLoading(); } catch (e) {}
      }
      reject(syncErr);
    }
  });
}

export const get = (url, options = {}) => {
  const { skip401Redirect, ...params } = options;
  return request({ url, method: 'GET', data: params, skip401Redirect });
};
export const post = (url, data = {}, options = {}) => request({ url, method: 'POST', data, ...options });
export const put = (url, data = {}, options = {}) => request({ url, method: 'PUT', data, ...options });
export const del = (url, options = {}) => request({ url, method: 'DELETE', ...options });

/**
 * 文件上传封装
 * @param {string} url 上传地址
 * @param {string} filePath 文件路径
 * @param {string} name 文件字段名
 * @param {Object} formData 附加表单数据
 * @param {boolean|string} loading 是否显示 loading，默认 true
 */
export function uploadFile(url, filePath, name = 'file', formData = {}, loading = true) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');
    const showLoading = loading !== false;
    const loadingTitle = typeof loading === 'string' ? loading : '上传中...';

    if (showLoading) {
      uni.showLoading({ title: loadingTitle, mask: true });
    }

    uni.uploadFile({
      url: `${getBaseUrl()}${url}`,
      filePath,
      name,
      formData,
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: (res) => {
        if (showLoading) uni.hideLoading();
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
          uni.$emit('auth:expired');
          uni.showToast({ title: '登录已过期', icon: 'none' });
          reject(data);
        } else {
          uni.showToast({ title: data.message || '上传失败', icon: 'none' });
          reject(data);
        }
      },
      fail: (err) => {
        if (showLoading) uni.hideLoading();
        uni.showToast({ title: '上传失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

export { getServerUrl, getBaseUrl };