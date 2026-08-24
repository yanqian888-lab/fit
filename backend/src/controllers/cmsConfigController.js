/**
 * CMS 应用全局配置
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');
const { invalidateAppConfig } = require('../utils/configCache');

const CONFIG_KEYS = [
  'user_agreement',
  'user_agreement_url',
  'privacy_policy',
  'privacy_policy_url',
  'privacy_version',
  'force_privacy_update',
  'about_us_content',
  'delete_account_agreement'
];

/**
 * 获取所有应用配置
 */
function getAppConfig(req, res) {
  const rows = db.prepare('SELECT config_key, config_value, updated_at FROM app_configs').all();
  const config = {};
  for (const row of rows) {
    config[row.config_key] = row.config_value;
  }

  for (const key of CONFIG_KEYS) {
    if (!(key in config)) {
      config[key] = '';
    }
  }

  config.force_privacy_update = config.force_privacy_update === '1' || config.force_privacy_update === 'true';

  return res.json(success(config));
}

/**
 * 更新应用配置
 */
function updateAppConfig(req, res) {
  const updates = req.body || {};
  const stmt = db.prepare(`
    INSERT INTO app_configs (config_key, config_value)
    VALUES (?, ?)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_at = CURRENT_TIMESTAMP
  `);

  const changed = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!CONFIG_KEYS.includes(key)) continue;

    let val = value;
    if (key === 'force_privacy_update') {
      val = value ? '1' : '0';
    }

    stmt.run(key, String(val ?? ''));
    changed.push(key);
  }

  cmsLogService.log(req, 'app_config:update', 'app_config', '', { changed });
  changed.forEach(key => invalidateAppConfig(key));
  return res.json(success(null, '保存成功'));
}

module.exports = {
  getAppConfig,
  updateAppConfig
};
