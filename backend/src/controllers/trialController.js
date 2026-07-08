/**
 * 试用权限 C 端接口
 */
const trialService = require('../services/trialService');
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
 */
function getConfig(req, res) {
  const config = trialService.getConfig();
  const popupKeys = [
    'popup_ai_title', 'popup_ai_content', 'popup_ai_primary_btn', 'popup_ai_secondary_btn', 'popup_ai_contact',
    'popup_diary_title', 'popup_diary_content', 'popup_diary_primary_btn', 'popup_diary_secondary_btn', 'popup_diary_contact'
  ];
  const features = {
    ai_chat: {
      enabled: config.ai_chat_enabled === '1',
      threshold: parseInt(config.ai_chat_threshold || '0', 10)
    },
    diary: {
      enabled: config.diary_enabled === '1',
      threshold: parseInt(config.diary_threshold || '0', 10)
    }
  };
  const popup = {};
  for (const key of popupKeys) {
    popup[key] = config[key];
  }

  return res.json(success({
    global_enabled: config.global_enabled === '1',
    grayscale_percent: parseInt(config.grayscale_percent || '0', 10),
    features,
    popup
  }));
}

module.exports = {
  checkPermission,
  reportCount,
  getConfig
};
