/**
 * 页面数据缓存 Store
 * 用于优化 tab 切换时的白屏问题
 * 
 * 核心策略：
 * 1. 每个 tab 页的数据缓存到 Pinia + Storage
 * 2. 页面初始化时先渲染缓存数据，再后台刷新
 * 3. 缓存有效期 5 分钟，过期后自动刷新
 * 4. 避免每次 onShow 都触发数据加载
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

// 缓存有效期（毫秒）：5 分钟
const CACHE_TTL = 5 * 60 * 1000;

// Storage key 前缀
const STORAGE_PREFIX = 'page_cache_';

export const usePageCacheStore = defineStore('pageCache', () => {
  /**
   * 缓存数据结构：
   * {
   *   'museum_overview': { data: {...}, timestamp: 1234567890 },
   *   'record_today': { data: {...}, timestamp: 1234567890 },
   *   ...
   * }
   */
  const cacheMap = ref({});

  /**
   * 获取缓存数据（优先内存，其次 Storage）
   * @param {string} key - 缓存键，如 'museum_overview'
   * @returns {object|null} 缓存的数据，不存在返回 null
   */
  function getCache(key) {
    // 1. 先查内存
    if (cacheMap.value[key] && cacheMap.value[key].data) {
      return cacheMap.value[key].data;
    }
    
    // 2. 再查 Storage
    try {
      const stored = uni.getStorageSync(STORAGE_PREFIX + key);
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        if (parsed && parsed.data) {
          // 恢复到内存
          cacheMap.value[key] = parsed;
          return parsed.data;
        }
      }
    } catch (e) {}
    
    return null;
  }

  /**
   * 设置缓存数据（内存 + Storage）
   * @param {string} key - 缓存键
   * @param {any} data - 要缓存的数据
   */
  function setCache(key, data) {
    const entry = {
      data,
      timestamp: Date.now()
    };
    // 存内存
    cacheMap.value[key] = entry;
    // 存 Storage（异步不阻塞）
    try {
      uni.setStorageSync(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch (e) {}
  }

  /**
   * 检查缓存是否过期
   * @param {string} key - 缓存键
   * @returns {boolean} true 表示已过期或不存在
   */
  function isExpired(key) {
    let entry = cacheMap.value[key];
    
    // 内存没有，查 Storage
    if (!entry) {
      try {
        const stored = uni.getStorageSync(STORAGE_PREFIX + key);
        if (stored) {
          entry = typeof stored === 'string' ? JSON.parse(stored) : stored;
          if (entry) cacheMap.value[key] = entry;
        }
      } catch (e) {}
    }
    
    // 不存在或过期
    if (!entry || !entry.timestamp) return true;
    return Date.now() - entry.timestamp > CACHE_TTL;
  }

  /**
   * 删除指定缓存
   * @param {string} key - 缓存键
   */
  function removeCache(key) {
    delete cacheMap.value[key];
    try {
      uni.removeStorageSync(STORAGE_PREFIX + key);
    } catch (e) {}
  }

  /**
   * 清除所有缓存
   */
  function clearAll() {
    cacheMap.value = {};
    try {
      const keys = uni.getStorageInfoSync().keys || [];
      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX)) {
          uni.removeStorageSync(key);
        }
      }
    } catch (e) {}
  }

  /**
   * 强制刷新标记（下次进入 tab 时强制刷新）
   * 使用场景：保存数据后需要刷新展示
   */
  const forceRefreshMap = ref({});

  /**
   * 标记缓存需要强制刷新
   * @param {string} key - 缓存键
   */
  function markForceRefresh(key) {
    forceRefreshMap.value[key] = true;
  }

  /**
   * 检查并清除强制刷新标记
   * @param {string} key - 缓存键
   * @returns {boolean} true 表示需要强制刷新
   */
  function consumeForceRefresh(key) {
    const needRefresh = !!forceRefreshMap.value[key];
    if (needRefresh) {
      delete forceRefreshMap.value[key];
    }
    return needRefresh;
  }

  return {
    cacheMap,
    getCache,
    setCache,
    isExpired,
    removeCache,
    clearAll,
    markForceRefresh,
    consumeForceRefresh
  };
});

// 预设的缓存键常量
export const CACHE_KEYS = {
  MUSEUM_OVERVIEW: 'museum_overview',
  RECORD_TODAY: 'record_today',
  RECORD_FASTING: 'record_fasting',
  RECORD_WATER: 'record_water',
  RECORD_WORKOUTS: 'record_workouts',
  PET_INFO: 'pet_info',
  PET_CURRENCY: 'pet_currency',
  PET_CHECKIN: 'pet_checkin'
};
