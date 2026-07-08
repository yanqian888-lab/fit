/**
 * CMS 博物馆入口配置
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');

const DEFAULT_MODULES = {
  recipe: true,
  insight: true,
  photo: true,
  method: true,
  diary: true,
  milestone: true
};

function getModulesConfig() {
  const row = db.prepare("SELECT config_value FROM app_configs WHERE config_key = 'museum_modules'").get();
  if (!row || !row.config_value) return { ...DEFAULT_MODULES };
  try {
    const parsed = JSON.parse(row.config_value);
    return { ...DEFAULT_MODULES, ...parsed };
  } catch (e) {
    return { ...DEFAULT_MODULES };
  }
}

function get(req, res) {
  try {
    return res.json(success(getModulesConfig()));
  } catch (err) {
    console.error('[cmsMuseumConfigController.get] error:', err);
    return res.status(500).json(error('获取失败'));
  }
}

function update(req, res) {
  try {
    const data = req.body || {};
    const current = getModulesConfig();
    const next = { ...current };
    for (const key of Object.keys(DEFAULT_MODULES)) {
      if (typeof data[key] === 'boolean') {
        next[key] = data[key];
      }
    }
    db.prepare(`
      INSERT INTO app_configs (config_key, config_value)
      VALUES ('museum_modules', ?)
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        updated_at = CURRENT_TIMESTAMP
    `).run(JSON.stringify(next));

    cmsLogService.log(req, 'app_config:update', 'museum_config', '', { modules: next });
    return res.json(success(next, '保存成功'));
  } catch (err) {
    console.error('[cmsMuseumConfigController.update] error:', err);
    return res.status(500).json(error('保存失败'));
  }
}

module.exports = {
  get,
  update,
  getModulesConfig
};
