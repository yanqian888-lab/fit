/**
 * App 配置缓存
 * 降低 app_configs 高频查询对数据库的压力，同时保证 CMS 修改后快速生效。
 */
const { db } = require('../db');
const { safeJsonParse } = require('./safeJson');

const CACHE_TTL_MS = 3000; // 3 秒 TTL，兼顾性能与实时性
const cache = new Map();

function getCacheKey(key) {
  return `app_config:${key}`;
}

function getAppConfig(key) {
  const cacheKey = getCacheKey(key);
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const row = db.prepare('SELECT config_value FROM app_configs WHERE config_key = ?').get(key);
  let value = {};
  if (row) {
    try {
      value = safeJsonParse(row.config_value, {});
    } catch (e) {
      value = {};
    }
  }

  cache.set(cacheKey, { value, timestamp: now });
  return value;
}

function invalidateAppConfig(key) {
  if (key) {
    cache.delete(getCacheKey(key));
  } else {
    cache.clear();
  }
}

// 定期清理过期缓存，避免内存膨胀
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS * 2) {
      cache.delete(key);
    }
  }
}, CACHE_TTL_MS * 2).unref();

module.exports = {
  getAppConfig,
  invalidateAppConfig
};
