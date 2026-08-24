import { BUILD_ENV, ENV_CONFIG } from '../config/env.js';

const ENV_STORAGE_KEY = 'app_env_override';

/**
 * 获取当前生效的环境标识
 * 优先级：本地手动切换缓存 > 构建时默认环境
 */
export function getCurrentEnv() {
  try {
    const stored = uni.getStorageSync(ENV_STORAGE_KEY);
    if (stored && ENV_CONFIG[stored]) {
      return stored;
    }
  } catch (e) {
    console.error('读取环境缓存失败', e);
  }
  return BUILD_ENV;
}

/**
 * 获取当前环境对应的后端服务地址
 */
export function getServerUrl() {
  const env = getCurrentEnv();
  return ENV_CONFIG[env]?.serverUrl || ENV_CONFIG[BUILD_ENV]?.serverUrl || ENV_CONFIG.development.serverUrl;
}

/**
 * 获取当前环境对应的 API 基础地址
 */
export function getBaseUrl() {
  return `${getServerUrl()}/api`;
}

/**
 * 手动切换环境（会持久化到本地缓存）
 * @param {'development' | 'test' | 'production'} env
 */
export function setCurrentEnv(env) {
  if (!ENV_CONFIG[env]) {
    console.warn('不支持的环境类型：', env);
    return false;
  }
  try {
    uni.setStorageSync(ENV_STORAGE_KEY, env);
    return true;
  } catch (e) {
    console.error('保存环境缓存失败', e);
    return false;
  }
}

/**
 * 清除手动切换的环境，恢复为构建默认
 */
export function clearEnvOverride() {
  try {
    uni.removeStorageSync(ENV_STORAGE_KEY);
  } catch (e) {
    console.error('清除环境缓存失败', e);
  }
}

/**
 * 获取环境友好名称
 */
export function getEnvLabel(env) {
  const labels = {
    development: '开发环境',
    test: '测试环境',
    production: '正式环境'
  };
  return labels[env] || env;
}

/**
 * 解析静态资源URL为完整可访问地址
 * 后端存储的是相对路径（如 /static/uploads/xxx.jpg），
 * 需要在前端拼上后端服务地址才能正常加载
 * @param {string} url - 原始URL（可能是相对路径或完整URL）
 * @returns {string} 完整可访问的URL
 */
export function resolveStaticUrl(url) {
  if (!url) return '';
  // 已经是完整URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // 以 // 开头的协议相对URL
  if (url.startsWith('//')) return url;
  // 相对路径，拼接服务器地址
  const serverUrl = getServerUrl().replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${serverUrl}${path}`;
}
