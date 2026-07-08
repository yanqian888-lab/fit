/**
 * 试用权限与授权引导前端服务
 * 命名合规：仅使用 trial / permission / auth / feature_config
 */
import { post, get } from './request.js';

const DEVICE_ID_KEY = 'trial_device_id';
const CONFIG_CACHE_KEY = 'trial_config_cache';
const CONFIG_CACHE_AT_KEY = 'trial_config_cache_at';
const CONFIG_CACHE_TTL_MS = 60 * 60 * 1000; // 1小时

const VALID_FEATURES = ['ai_chat', 'diary'];

/**
 * 生成 UUID（简易版）
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 获取稳定的设备标识
 */
export function getDeviceId() {
  let deviceId = '';
  try {
    const info = uni.getSystemInfoSync();
    deviceId = info.deviceId || info.device_id || '';
  } catch (e) {
    console.error('[trial] 获取设备信息失败', e);
  }

  if (!deviceId) {
    deviceId = uni.getStorageSync(DEVICE_ID_KEY);
  }
  if (!deviceId) {
    deviceId = generateUUID();
    uni.setStorageSync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * 获取 App 版本号
 */
export function getAppVersion() {
  try {
    const info = uni.getAppBaseInfo ? uni.getAppBaseInfo() : uni.getSystemInfoSync();
    return info.appVersion || info.appVersionCode || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

/**
 * 清除本地配置缓存
 */
export function clearConfigCache() {
  uni.removeStorageSync(CONFIG_CACHE_KEY);
  uni.removeStorageSync(CONFIG_CACHE_AT_KEY);
}

/**
 * 从后端拉取全量配置并缓存
 */
export async function fetchConfig() {
  try {
    const res = await get('/trial/get-config');
    const config = res.data || {};
    uni.setStorageSync(CONFIG_CACHE_KEY, JSON.stringify(config));
    uni.setStorageSync(CONFIG_CACHE_AT_KEY, Date.now().toString());
    return config;
  } catch (e) {
    console.error('[trial] 拉取配置失败', e);
    // 异常时读取旧缓存兜底
    return getCachedConfig();
  }
}

/**
 * 获取本地缓存配置
 */
export function getCachedConfig() {
  try {
    const cachedAt = parseInt(uni.getStorageSync(CONFIG_CACHE_AT_KEY) || '0', 10);
    if (Date.now() - cachedAt > CONFIG_CACHE_TTL_MS) {
      return null;
    }
    const raw = uni.getStorageSync(CONFIG_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取配置（优先缓存，不存在则拉取）
 */
export async function getConfig() {
  const cached = getCachedConfig();
  if (cached) return cached;
  return fetchConfig();
}

/**
 * 权限校验
 * @param {'ai_chat' | 'diary'} featureType
 * @returns {Promise<{allow_use: boolean, show_popup: boolean, remain_times: number, popup_config: object|null}>}
 */
export async function checkPermission(featureType) {
  if (!VALID_FEATURES.includes(featureType)) {
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null };
  }
  try {
    const res = await post('/trial/check-permission', {
      device_id: getDeviceId(),
      feature_type: featureType,
      app_version: getAppVersion()
    });
    return res.data || { allow_use: true, show_popup: false, remain_times: -1, popup_config: null };
  } catch (e) {
    // 异常兜底：直接放行，不弹窗
    console.error('[trial] 权限校验失败，默认放行', e);
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null };
  }
}

/**
 * 上报一次成功使用
 * @param {'ai_chat' | 'diary'} featureType
 */
export async function reportCount(featureType) {
  if (!VALID_FEATURES.includes(featureType)) return;
  try {
    await post('/trial/report-count', {
      device_id: getDeviceId(),
      feature_type: featureType
    });
  } catch (e) {
    console.error('[trial] 上报次数失败', e);
  }
}

/**
 * 复制客服联系方式到剪贴板
 */
export function copyContact(contact) {
  if (!contact) return;
  uni.setClipboardData({
    data: contact,
    success: () => {
      uni.showToast({ title: '客服微信号已复制，可前往微信添加', icon: 'none' });
    },
    fail: () => {
      uni.showToast({ title: '复制失败，请手动添加', icon: 'none' });
    }
  });
}
