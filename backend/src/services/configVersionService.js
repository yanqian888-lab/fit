/**
 * 配置版本管理服务
 * 实现配置版本号和增量更新
 */

const crypto = require('crypto');

let configVersion = null;

/**
 * 计算配置版本号（MD5哈希）
 */
function calculateConfigVersion(config) {
  const configString = JSON.stringify(config);
  return crypto.createHash('md5').update(configString).digest('hex');
}

/**
 * 获取配置版本号
 */
function getConfigVersion() {
  return configVersion;
}

/**
 * 更新配置版本号
 */
function updateConfigVersion(config) {
  configVersion = calculateConfigVersion(config);
  return configVersion;
}

/**
 * 检查配置是否需要更新
 */
function needsUpdate(clientVersion) {
  if (!configVersion || !clientVersion) {
    return true;
  }
  return configVersion !== clientVersion;
}

/**
 * 获取配置差异
 */
function getConfigDiff(oldConfig, newConfig) {
  const diff = {
    added: {},
    modified: {},
    deleted: []
  };

  // 检查新增和修改
  for (const [key, value] of Object.entries(newConfig)) {
    if (!(key in oldConfig)) {
      diff.added[key] = value;
    } else if (oldConfig[key] !== value) {
      diff.modified[key] = { old: oldConfig[key], new: value };
    }
  }

  // 检查删除
  for (const key of Object.keys(oldConfig)) {
    if (!(key in newConfig)) {
      diff.deleted.push(key);
    }
  }

  return diff;
}

module.exports = {
  calculateConfigVersion,
  getConfigVersion,
  updateConfigVersion,
  needsUpdate,
  getConfigDiff
};