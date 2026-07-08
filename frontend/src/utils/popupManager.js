/**
 * 弹窗广告管理器
 * 负责配置拉取、缓存、规则校验、展示调度、埋点上报
 */
import { popupApi } from '@/api/index';
import { getDeviceId, getAppVersion } from './trial.js';

const CONFIG_CACHE_KEY = 'popup_config_cache';
const CONFIG_CACHE_AT_KEY = 'popup_config_cache_at';
const CONFIG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 分钟

let configData = null;
let configCacheAt = 0;
let shownSet = new Set(); // 本次启动防重
let pendingTimers = [];
let eventQueue = [];
let flushTimer = null;
let currentVisible = false;
let closeCurrentFn = null;
let initPromise = null;

function getNow() {
  return new Date().toISOString();
}

function getOsType() {
  try {
    const info = uni.getSystemInfoSync();
    const platform = (info.platform || info.uniPlatform || '').toLowerCase();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
    if (platform === 'web' || platform.includes('h5')) return 'h5';
    if (platform.includes('mp-weixin') || platform.includes('weixin')) return 'mp-weixin';
    return 'h5';
  } catch (e) {
    return 'h5';
  }
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str || JSON.stringify(fallback));
  } catch (e) {
    return fallback;
  }
}

function getStorage(key) {
  try {
    return uni.getStorageSync(key);
  } catch (e) {
    return '';
  }
}

function setStorage(key, value) {
  try {
    uni.setStorageSync(key, value);
  } catch (e) {}
}

function getToday() {
  return getNow().slice(0, 10);
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function getFreqKey(popup) {
  if (popup.one_time) {
    return `popup_once_${popup.id}`;
  }
  const base = `popup_freq_${popup.id}`;
  if (popup.frequency_period === 'day') return `${base}_day_${getToday()}`;
  if (popup.frequency_period === 'week') return `${base}_week_${getWeekStart()}`;
  return `${base}_forever`;
}

function getDailyCountKey() {
  return `popup_daily_count_${getToday()}`;
}

function getConfig() {
  if (configData && configCacheAt + CONFIG_CACHE_TTL_MS > Date.now()) {
    return configData;
  }
  try {
    const cached = getStorage(CONFIG_CACHE_KEY);
    const at = parseInt(getStorage(CONFIG_CACHE_AT_KEY) || '0', 10);
    if (cached && at + CONFIG_CACHE_TTL_MS > Date.now()) {
      configData = safeJsonParse(cached, { global: { enabled: false, daily_limit: 3, block_pages: [] }, popups: [], whitelist: [] });
      configCacheAt = at;
      console.log('[popup] 使用缓存配置', configData.popups?.length || 0, '个弹窗');
      return configData;
    }
  } catch (e) {}
  console.log('[popup] 无有效配置，使用默认空配置');
  return { global: { enabled: false, daily_limit: 3, block_pages: [] }, popups: [], whitelist: [] };
}

function setConfig(config) {
  configData = config;
  configCacheAt = Date.now();
  setStorage(CONFIG_CACHE_KEY, JSON.stringify(config));
  setStorage(CONFIG_CACHE_AT_KEY, String(configCacheAt));
}

function domainMatch(domain, pattern) {
  if (!domain || !pattern) return false;
  const d = domain.toLowerCase();
  const p = pattern.toLowerCase();
  if (p === d) return true;
  if (p.startsWith('*.')) {
    const suffix = p.slice(2);
    if (d === suffix) return true;
    if (d.endsWith('.' + suffix)) return true;
  }
  return false;
}

function extractDomain(url) {
  try {
    if (typeof URL !== 'undefined') {
      return new URL(url).hostname;
    }
    const match = url.match(/^https?:\/\/([^\/\?:#]+)/);
    return match ? match[1] : '';
  } catch (e) {
    return '';
  }
}

async function flushEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (eventQueue.length === 0) return;
  const events = eventQueue.splice(0);
  try {
    await popupApi.report({
      device_id: getDeviceId(),
      app_version: getAppVersion(),
      os_type: getOsType(),
      events
    });
  } catch (e) {
    // 失败不回退，避免队列无限增长；弱网允许丢部分埋点
    console.error('[popup] 埋点上报失败', e);
  }
}

function queueEvent(event) {
  eventQueue.push(event);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushEvents, 1000);
}

function isWifi() {
  return new Promise((resolve) => {
    try {
      uni.getNetworkType({
        success: (res) => resolve(res.networkType === 'wifi'),
        fail: () => resolve(false)
      });
    } catch (e) {
      resolve(false);
    }
  });
}

function parseRoute(route) {
  // 去掉开头斜杠，统一格式
  return String(route || '').replace(/^\//, '');
}

function isBlockedPage(route, config) {
  const blockPages = config.global.block_pages || [];
  return blockPages.includes(route);
}

async function findShowablePopup(route, trigger) {
  const config = getConfig();
  console.log('[popup] findShowablePopup config', { globalEnabled: config.global.enabled, popupsCount: (config.popups || []).length, route, trigger });
  if (!config.global.enabled) {
    console.log('[popup] 全局弹窗未启用');
    return null;
  }

  const page = parseRoute(route);
  if (!page || isBlockedPage(page, config)) {
    console.log('[popup] 页面被拦截', page);
    return null;
  }

  const popups = config.popups || [];
  if (popups.length === 0) return null;

  const candidates = [];
  for (const popup of popups) {
    if (popup.trigger_type !== trigger) continue;

    // 触发时机为 duration 时，delay 必须大于 0
    if (trigger === 'duration' && (!popup.trigger_delay_seconds || popup.trigger_delay_seconds <= 0)) continue;

    // 页面范围
    const scopePages = Array.isArray(popup.scope_pages) ? popup.scope_pages : [];
    const excludedPages = Array.isArray(popup.excluded_pages) ? popup.excluded_pages : [];
    if (excludedPages.includes(page)) continue;
    if (popup.scope_type === 'specific' && !scopePages.includes(page)) continue;

    // 启动防重
    const key = `${popup.id}:${page}`;
    if (shownSet.has(key)) continue;

    // 周期频次 / 一次性
    const freqKey = getFreqKey(popup);
    if (popup.one_time) {
      if (getStorage(freqKey)) continue;
    } else {
      const count = parseInt(getStorage(freqKey) || '0', 10);
      if (count >= popup.frequency_max) continue;
    }

    // WiFi
    if (popup.wifi_only) {
      const wifi = await isWifi();
      if (!wifi) continue;
    }

    candidates.push(popup);
  }

  if (candidates.length === 0) return null;

  // 日弹窗上限全局拦截（只对 show 类触发生效）
  const dailyKey = getDailyCountKey();
  const dailyCount = parseInt(getStorage(dailyKey) || '0', 10);
  const dailyLimit = config.global.daily_limit || 3;
  if (dailyCount >= dailyLimit) return null;

  candidates.sort((a, b) => b.priority - a.priority);
  console.log('[popup] 候选弹窗', candidates.map(c => ({ id: c.id, name: c.name, priority: c.priority })));
  return candidates[0];
}

function emitShow(popup, page, trigger) {
  currentVisible = true;
  uni.$emit('popup:show', { popup, page, trigger });
}

// 标记弹窗真正展示到 UI 上，才进行频次/日上限/启动防重计数
function markShown(popup, page, trigger) {
  const key = `${popup.id}:${page}`;
  if (shownSet.has(key)) return;
  shownSet.add(key);

  // 频次计数
  const freqKey = getFreqKey(popup);
  if (popup.one_time) {
    setStorage(freqKey, '1');
  } else {
    const count = parseInt(getStorage(freqKey) || '0', 10);
    setStorage(freqKey, String(count + 1));
  }

  // 日弹窗上限计数
  const dailyKey = getDailyCountKey();
  const dailyCount = parseInt(getStorage(dailyKey) || '0', 10);
  setStorage(dailyKey, String(dailyCount + 1));

  queueEvent({
    popup_id: popup.id,
    page,
    event_type: 'show',
    trigger,
    close_way: '',
    event_time: getNow()
  });
}

function emitHide() {
  currentVisible = false;
  uni.$emit('popup:hide');
}

async function checkShow({ route, trigger = 'immediate' } = {}) {
  let page = route;
  if (!page) {
    const pages = getCurrentPages();
    page = pages[pages.length - 1]?.route || '';
  }
  page = parseRoute(page);

  // 清除同页面的旧定时器
  clearPending();

  console.log('[popup] checkShow', { page, trigger });
  const popup = await findShowablePopup(page, trigger);
  if (!popup) {
    console.log('[popup] 当前无可用弹窗', { page, trigger });
    return;
  }
  console.log('[popup] 命中弹窗', popup.id, popup.name, popup.style, { page, trigger });

  if (trigger === 'duration') {
    const timer = setTimeout(() => {
      removePending(timer);
      doShow(popup, page, trigger);
    }, popup.trigger_delay_seconds * 1000);
    pendingTimers.push(timer);
    return;
  }

  doShow(popup, page, trigger);
}

function doShow(popup, page, trigger) {
  const key = `${popup.id}:${page}`;
  if (shownSet.has(key)) return;

  // 记录关闭回调
  closeCurrentFn = (way) => {
    currentVisible = false;
    queueEvent({
      popup_id: popup.id,
      page,
      event_type: 'close',
      trigger,
      close_way: way || 'close_btn',
      event_time: getNow()
    });
    closeCurrentFn = null;
  };

  emitShow(popup, page, trigger);
}

function clearPending() {
  pendingTimers.forEach(t => clearTimeout(t));
  pendingTimers = [];
}

function onClose(way) {
  if (closeCurrentFn) closeCurrentFn(way);
  emitHide();
}

export { markShown };

function onClick(popup, page, trigger) {
  queueEvent({
    popup_id: popup.id,
    page,
    event_type: 'click',
    trigger,
    close_way: '',
    event_time: getNow()
  });
}

function navigate(popup) {
  if (popup.jump_type === 'internal') {
    const path = popup.jump_route_path || popup.jump_route_key || '';
    const params = popup.jump_params || {};
    if (!path) return;
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const url = qs ? `${path}?${qs}` : path;
    uni.navigateTo({ url, fail: () => {} });
  } else if (popup.jump_type === 'h5') {
    const url = popup.jump_url || '';
    if (!url) return;
    const config = getConfig();
    const whitelist = config.whitelist || [];
    const domain = extractDomain(url);
    const matched = whitelist.some(p => domainMatch(domain, p));
    if (!matched) {
      console.warn('[popup] H5 域名未在白名单', domain);
      return;
    }
    uni.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` });
  }
}

async function doInit() {
  try {
    const res = await popupApi.getConfigList({
      app_version: getAppVersion(),
      os_type: getOsType(),
      device_id: getDeviceId()
    });
    setConfig(res.data);
    console.log('[popup] 配置拉取成功', res.data.popups?.length || 0, '个弹窗');
    // 配置到手后，立刻检查当前页面是否有可展示弹窗（解决 init 与页面 onShow 竞态）
    await checkShow({ trigger: 'immediate' });
    await checkShow({ trigger: 'duration' });
  } catch (e) {
    console.error('[popup] 拉取配置失败', e);
  }
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = doInit();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

function isVisible() {
  return currentVisible;
}

function closeCurrent(way = 'back') {
  if (!currentVisible) return false;
  onClose(way);
  return true;
}

function clearCache() {
  configData = null;
  configCacheAt = 0;
  try {
    // 清空弹窗相关所有本地缓存（配置 + 频次 + 日计数），方便退出后重新测试
    const keys = uni.getStorageInfoSync().keys || [];
    for (const key of keys) {
      if (key.startsWith('popup_')) {
        uni.removeStorageSync(key);
      }
    }
  } catch (e) {}
}

export default {
  init,
  checkShow,
  clearPending,
  onClose,
  onClick,
  navigate,
  isVisible,
  closeCurrent,
  getConfig,
  clearCache,
  markShown
};
