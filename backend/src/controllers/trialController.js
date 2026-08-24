/**
 * 试用权限 C 端接口
 */
const trialService = require('../services/trialService');
const configVersionService = require('../services/configVersionService');
const configMonitor = require('../services/configMonitorService');
const { CONFIG_KEYS, POPUP_KEYS, FEATURE_TYPES } = require('../constants/configKeys');
const { success, error } = require('../utils/response');

/**
 * 功能权限校验
 * POST /api/trial/check-permission
 */
function checkPermission(req, res) {
  const userId = req.userId || null;
  const { device_id, feature_type, app_version } = req.body;
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '';

  if (!device_id && !userId) {
    return res.status(400).json(error('缺少设备标识或用户标识', 400));
  }
  if (!feature_type || !trialService.VALID_FEATURES.includes(feature_type)) {
    return res.status(400).json(error('缺少或无效的功能类型', 400));
  }

  const result = trialService.checkPermission({
    userId,
    deviceId: device_id,
    featureType: feature_type,
    appVersion: app_version,
    ip
  });

  return res.json(success(result));
}

/**
 * 试用次数上报
 * POST /api/trial/report-count
 */
function reportCount(req, res) {
  const userId = req.userId || null;
  const { device_id, feature_type } = req.body;
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '';

  if (!device_id && !userId) {
    return res.status(400).json(error('缺少设备标识或用户标识', 400));
  }
  if (!feature_type || !trialService.VALID_FEATURES.includes(feature_type)) {
    return res.status(400).json(error('缺少或无效的功能类型', 400));
  }

  const result = trialService.reportCount({
    userId,
    deviceId: device_id,
    featureType: feature_type,
    ip
  });

  return res.json(success(result));
}

/**
 * 全局配置同步
 * GET /api/trial/get-config
 * 修复：使用配置键常量，优化弹窗配置
 */
function getConfig(req, res) {
  try {
    const userId = req.userId;
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
    const clientVersion = req.query.version;
    
    configMonitor.recordAccess(userId, ['trial_config'], ip);
    
    const config = trialService.getConfig();
    
    const features = {
      [FEATURE_TYPES.AI_CHAT]: {
        enabled: config[CONFIG_KEYS.AI_CHAT.ENABLED] === '1',
        threshold: parseInt(config[CONFIG_KEYS.AI_CHAT.THRESHOLD] || '0', 10)
      },
      [FEATURE_TYPES.DIARY]: {
        enabled: config[CONFIG_KEYS.DIARY.ENABLED] === '1',
        threshold: parseInt(config[CONFIG_KEYS.DIARY.THRESHOLD] || '0', 10)
      }
    };
    
    const popup = {};
    for (const key of POPUP_KEYS) {
      popup[key] = config[key];
    }

    const responseData = {
      global_enabled: config[CONFIG_KEYS.GLOBAL.ENABLED] === '1',
      grayscale_percent: parseInt(config[CONFIG_KEYS.GLOBAL.GRAYSCALE_PERCENT] || '0', 10),
      features,
      popup
    };
    
    let serverVersion = configVersionService.getConfigVersion();
    if (!serverVersion) {
      serverVersion = configVersionService.updateConfigVersion(responseData);
    }
    
    if (clientVersion && clientVersion === serverVersion) {
      return res.json(success({
        ...responseData,
        _version: serverVersion,
        _unchanged: true
      }));
    }

    return res.json(success({
      ...responseData,
      _version: serverVersion
    }));
  } catch (e) {
    configMonitor.recordError(e, { action: 'getConfig', userId, ip });
    console.error('[Config] 获取配置失败:', e);
    return res.status(500).json(error('获取配置失败，请稍后重试', 500, { 
      error: e.message,
      timestamp: new Date().toISOString()
    }));
  }
}

module.exports = {
  checkPermission,
  reportCount,
  getConfig
};