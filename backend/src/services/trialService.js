/**
 * 试用权限与授权引导服务
 * 命名合规：仅使用 trial / permission / auth / feature_config 等字段
 */
const crypto = require('crypto');
const { db } = require('../db');
const LRUCache = require('../utils/lruCache');
const { CONFIG_KEYS, POPUP_KEYS, FEATURE_TYPES, DEFAULT_CONFIG_VALUES } = require('../constants/configKeys');

const CONFIG_CACHE_TTL_MS = 60 * 1000;
const configLRUCache = new LRUCache(50, CONFIG_CACHE_TTL_MS);
let configCacheLock = false;
let configCachePromise = null;

const VALID_FEATURES = Object.values(FEATURE_TYPES);

function getNow() {
  return new Date().toISOString();
}

function isExpired(expireAt) {
  if (!expireAt) return false;
  return new Date(expireAt).getTime() < Date.now();
}

/**
 * 获取全量后台配置（带1分钟内存缓存）
 * 修复：使用LRU缓存优化性能，改进缓存锁机制
 */
function getConfig() {
  const cachedConfig = configLRUCache.get('trial_config');
  if (cachedConfig) {
    return cachedConfig;
  }
  
  if (configCacheLock && configCachePromise) {
    return DEFAULT_CONFIG_VALUES;
  }
  
  configCacheLock = true;
  
  try {
    const rows = db.prepare('SELECT config_key, config_value FROM trial_system_config').all();
    const config = { ...DEFAULT_CONFIG_VALUES };
    rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    
    configLRUCache.set('trial_config', config);
    
    
    
    return config;
  } catch (e) {
    console.error('[Config] 加载配置失败:', e);
    return DEFAULT_CONFIG_VALUES;
  } finally {
    configCacheLock = false;
  }
}

/**
 * 刷新配置缓存（后台修改后调用）
 * 修复：使用LRU缓存失效机制
 */
function invalidateConfigCache() {
  const stats = configLRUCache.getStats();
  configLRUCache.clear();
  
  
}

/**
 * 更新/插入配置项
 */
function setConfig(key, value) {
  const existing = db.prepare('SELECT id FROM trial_system_config WHERE config_key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE trial_system_config SET config_value = ?, updated_at = ? WHERE config_key = ?')
      .run(String(value), getNow(), key);
  } else {
    db.prepare('INSERT INTO trial_system_config (config_key, config_value, updated_at) VALUES (?, ?, ?)')
      .run(key, String(value), getNow());
  }
  invalidateConfigCache();
}

/**
 * 批量更新配置
 * 修复：添加变更日志记录
 */
function setConfigs(configs) {
  const oldConfig = getConfig();
  const changes = [];
  
  const insert = db.prepare('INSERT OR REPLACE INTO trial_system_config (config_key, config_value, updated_at) VALUES (?, ?, ?)');
  const transaction = db.transaction((items) => {
    const now = getNow();
    for (const [key, value] of Object.entries(items)) {
      const oldValue = oldConfig[key];
      if (oldValue !== String(value)) {
        changes.push({ key, oldValue, newValue: String(value) });
      }
      insert.run(key, String(value), now);
    }
  });
  transaction(configs);
  
  if (changes.length > 0) {
    
  }
  
  invalidateConfigCache();
}

/**
 * 获取某个 feature 的弹窗配置
 * 修复：使用配置键常量，添加优先级
 */
function getPopupConfig(featureType, globalConfig) {
  const prefix = featureType === FEATURE_TYPES.AI_CHAT ? 'POPUP_AI' : 'POPUP_DIARY';
  const keys = CONFIG_KEYS[prefix];
  
  return {
    title: globalConfig[keys.TITLE] || DEFAULT_CONFIG_VALUES[keys.TITLE],
    content: globalConfig[keys.CONTENT] || DEFAULT_CONFIG_VALUES[keys.CONTENT],
    primary_btn: globalConfig[keys.PRIMARY_BTN] || DEFAULT_CONFIG_VALUES[keys.PRIMARY_BTN],
    secondary_btn: globalConfig[keys.SECONDARY_BTN] || DEFAULT_CONFIG_VALUES[keys.SECONDARY_BTN],
    contact: globalConfig[keys.CONTACT] || DEFAULT_CONFIG_VALUES[keys.CONTACT],
    priority: featureType === FEATURE_TYPES.AI_CHAT ? 1 : 2
  };
}

/**
 * 校验白名单
 * type: user 时 value 支持 user_id、username、phone、openid；device/version/ip 直接匹配
 */
function checkWhitelist({ userId, userCode, deviceId, username, phone, openid, appVersion, ip }) {
  const rows = db.prepare('SELECT type, value, expire_at FROM trial_whitelist').all();
  for (const row of rows) {
    if (isExpired(row.expire_at)) continue;
    let hit = false;
    if (row.type === 'user') {
      const val = String(row.value);
      if (userId && val === String(userId)) hit = true;
      if (userCode && val === String(userCode)) hit = true;
      if (username && val === username) hit = true;
      // 也支持用手机号或 openid 做白名单值
      if (phone && val === String(phone)) hit = true;
      if (openid && val === String(openid)) hit = true;
    } else if (row.type === 'device') {
      if (deviceId && String(row.value) === String(deviceId)) hit = true;
    } else if (row.type === 'version') {
      if (appVersion && String(row.value) === String(appVersion)) hit = true;
    } else if (row.type === 'ip') {
      if (ip && String(row.value) === ip) hit = true;
    }
    if (hit) return { hit: true, type: row.type, value: row.value };
  }
  return { hit: false };
}

/**
 * 对 user_id / device_id 做稳定哈希，返回 1-100
 */
function hashToPercent(identifier) {
  if (!identifier) return 100;
  const hash = crypto.createHash('md5').update(String(identifier)).digest('hex');
  const num = parseInt(hash.substring(0, 8), 16);
  return (num % 100) + 1;
}

/**
 * 合并游客设备计数到登录用户（仅在首次登录/注册时调用一次）
 */
function mergeDeviceCountToUser(userId, deviceId) {
  if (!userId || !deviceId) return;
  const transaction = db.transaction(() => {
    for (const feature of VALID_FEATURES) {
      const deviceRow = db.prepare('SELECT used_count FROM trial_user_count WHERE device_id = ? AND feature_type = ?').get(deviceId, feature);
      if (!deviceRow) continue;
      const userRow = db.prepare('SELECT id, used_count FROM trial_user_count WHERE user_id = ? AND feature_type = ?').get(userId, feature);
      if (userRow) {
        db.prepare('UPDATE trial_user_count SET used_count = ?, updated_at = ? WHERE id = ?')
          .run(Math.max(userRow.used_count, deviceRow.used_count), getNow(), userRow.id);
      } else {
        db.prepare('INSERT INTO trial_user_count (user_id, feature_type, used_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(userId, feature, deviceRow.used_count, getNow(), getNow());
      }
      db.prepare('DELETE FROM trial_user_count WHERE device_id = ? AND feature_type = ?').run(deviceId, feature);
    }
  });
  transaction();
}

/**
 * 获取或初始化用户使用次数
 */
function getOrCreateCount(userId, deviceId, featureType) {
  let row;
  if (userId) {
    row = db.prepare('SELECT id, used_count FROM trial_user_count WHERE user_id = ? AND feature_type = ?').get(userId, featureType);
    if (!row) {
      const result = db.prepare('INSERT INTO trial_user_count (user_id, feature_type, used_count, created_at, updated_at) VALUES (?, ?, 0, ?, ?)')
        .run(userId, featureType, getNow(), getNow());
      row = { id: result.lastInsertRowid, used_count: 0 };
    }
  } else if (deviceId) {
    row = db.prepare('SELECT id, used_count FROM trial_user_count WHERE device_id = ? AND feature_type = ?').get(deviceId, featureType);
    if (!row) {
      const result = db.prepare('INSERT INTO trial_user_count (device_id, feature_type, used_count, created_at, updated_at) VALUES (?, ?, 0, ?, ?)')
        .run(deviceId, featureType, getNow(), getNow());
      row = { id: result.lastInsertRowid, used_count: 0 };
    }
  }
  return row || { id: null, used_count: 0 };
}

/**
 * 记录审计日志
 */
function addLog({ userId, deviceId, featureType, action, reason, ip }) {
  try {
    db.prepare(`
      INSERT INTO trial_logs (user_id, device_id, feature_type, action, reason, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId || null,
      deviceId || null,
      featureType || null,
      action,
      reason || null,
      ip || null,
      getNow()
    );
  } catch (e) {
    console.error('[trialService] 日志写入失败:', e.message);
  }
}

/**
 * 核心权限校验
 * @param {Object} params
 * @returns {Object} { allow_use, show_popup, remain_times, popup_config, reason }
 */
function checkPermission({ userId, deviceId, featureType, appVersion, ip, username }) {
  if (!VALID_FEATURES.includes(featureType)) {
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null, reason: '未知功能类型，默认放行' };
  }

  const config = getConfig();

  // 查询用户 user_id/手机号/openid，用于白名单匹配
  let userCode = null;
  let phone = null;
  let openid = null;
  if (userId) {
    const user = db.prepare('SELECT user_id, phone, openid FROM users WHERE id = ?').get(userId);
    if (user) {
      userCode = user.user_id || null;
      phone = user.phone || null;
      openid = user.openid || null;
    }
  }

  // 1. 白名单校验（最高优先级，永久豁免）
  const wl = checkWhitelist({ userId, userCode, deviceId, username, phone, openid, appVersion, ip });
  if (wl.hit) {
    addLog({ userId, deviceId, featureType, action: 'whitelist', reason: `命中${wl.type}白名单:${wl.value}`, ip });
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null, reason: '白名单放行' };
  }

  // 2. 全局总开关
  const globalEnabled = config.global_enabled === '1';
  if (!globalEnabled) {
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null, reason: '全局总开关关闭' };
  }

  // 3. 灰度放量：grayscale_percent% 的用户进入限制逻辑，其余放行
  const identifier = userId || deviceId || ip || 'unknown';
  const grayscalePercent = parseInt(config.grayscale_percent || '0', 10) || 0;
  if (grayscalePercent <= 0) {
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null, reason: '灰度比例为0，全量放行' };
  }
  if (hashToPercent(identifier) > grayscalePercent) {
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null, reason: '未命中灰度放量' };
  }

  // 4. 分项功能开关
  const featureEnabled = config[`${featureType}_enabled`] === '1';
  if (!featureEnabled) {
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null, reason: '分项功能开关关闭' };
  }

  // 5. 次数阈值校验
  const threshold = parseInt(config[`${featureType}_threshold`] || '0', 10);
  if (!threshold || threshold <= 0) {
    return { allow_use: true, show_popup: false, remain_times: -1, popup_config: null, reason: '阈值未配置' };
  }

  const countRow = getOrCreateCount(userId, deviceId, featureType);
  const remain = Math.max(0, threshold - countRow.used_count);

  if (countRow.used_count >= threshold) {
    addLog({ userId, deviceId, featureType, action: 'block', reason: `次数已达阈值:${countRow.used_count}/${threshold}`, ip });
    return {
      allow_use: false,
      show_popup: true,
      remain_times: 0,
      popup_config: getPopupConfig(featureType, config),
      reason: '试用次数已用尽'
    };
  }

  return {
    allow_use: true,
    show_popup: false,
    remain_times: remain,
    popup_config: null,
    reason: '校验通过'
  };
}

/**
 * 上报一次成功使用（数据库原子自增）
 */
function reportCount({ userId, deviceId, featureType, ip }) {
  if (!VALID_FEATURES.includes(featureType)) return { success: false };

  const identifierCol = userId ? 'user_id' : 'device_id';
  const identifierVal = userId || deviceId;
  if (!identifierVal) return { success: false };

  const transaction = db.transaction(() => {
    const existing = db.prepare(`SELECT id FROM trial_user_count WHERE ${identifierCol} = ? AND feature_type = ?`).get(identifierVal, featureType);
    if (existing) {
      db.prepare(`UPDATE trial_user_count SET used_count = used_count + 1, updated_at = ? WHERE ${identifierCol} = ? AND feature_type = ?`)
        .run(getNow(), identifierVal, featureType);
    } else {
      db.prepare('INSERT INTO trial_user_count (user_id, device_id, feature_type, used_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId || null, deviceId || null, featureType, 1, getNow(), getNow());
    }
  });
  transaction();

  addLog({ userId, deviceId, featureType, action: 'report', reason: '业务成功上报次数', ip });
  return { success: true };
}

/**
 * 获取当日统计数据（后台看板）
 */
function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const blockCount = db.prepare("SELECT COUNT(*) as count FROM trial_logs WHERE action = 'block' AND created_at >= ?").get(`${today}T00:00:00`).count;
  const whitelistCount = db.prepare("SELECT COUNT(*) as count FROM trial_logs WHERE action = 'whitelist' AND created_at >= ?").get(`${today}T00:00:00`).count;
  const copyCount = db.prepare("SELECT COUNT(*) as count FROM trial_logs WHERE action = 'copy_contact' AND created_at >= ?").get(`${today}T00:00:00`).count;
  const restrictedUsers = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM trial_logs
    WHERE action = 'block' AND created_at >= ?
  `).get(`${today}T00:00:00`).count;

  return {
    block_count: blockCount,
    whitelist_count: whitelistCount,
    copy_count: copyCount,
    restricted_user_count: restrictedUsers
  };
}

module.exports = {
  getConfig,
  setConfig,
  setConfigs,
  invalidateConfigCache,
  checkPermission,
  reportCount,
  mergeDeviceCountToUser,
  getDashboardStats,
  addLog,
  VALID_FEATURES
};