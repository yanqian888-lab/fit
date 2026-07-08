/**
 * CMS AI 配置管理
 */
const { success, error } = require('../utils/response');
const aiConfigService = require('../services/aiConfigService');
const cmsLogService = require('../services/cmsLogService');

function list(req, res) {
  try {
    const configs = aiConfigService.list().map(c => ({
      ...c,
      api_key: aiConfigService.maskApiKey(c.api_key)
    }));
    return res.json(success(configs));
  } catch (err) {
    console.error('[cmsAiConfigController.list] error:', err);
    return res.status(500).json(error('获取失败'));
  }
}

function simple(req, res) {
  try {
    const configs = aiConfigService.listForSelect();
    return res.json(success(configs));
  } catch (err) {
    console.error('[cmsAiConfigController.simple] error:', err);
    return res.status(500).json(error('获取失败'));
  }
}

function detail(req, res) {
  try {
    const id = parseInt(req.params.id);
    const config = aiConfigService.detail(id);
    if (!config) {
      return res.status(404).json(error('配置不存在', 404));
    }
    config.api_key = aiConfigService.maskApiKey(config.api_key);
    return res.json(success(config));
  } catch (err) {
    console.error('[cmsAiConfigController.detail] error:', err);
    return res.status(500).json(error('获取失败'));
  }
}

function create(req, res) {
  try {
    const data = req.body || {};
    if (!data.name || !data.endpoint_id) {
      return res.status(400).json(error('名称和 Endpoint 不能为空', 400));
    }
    const config = aiConfigService.create(data);
    cmsLogService.log(req, 'ai_config:write', 'ai_config', config.id, { name: config.name });
    return res.json(success(config, '创建成功'));
  } catch (err) {
    console.error('[cmsAiConfigController.create] error:', err);
    return res.status(500).json(error('创建失败'));
  }
}

function update(req, res) {
  try {
    const id = parseInt(req.params.id);
    const data = req.body || {};
    // api_key 为空字符串表示不修改
    if (data.api_key === '') {
      delete data.api_key;
    }
    const config = aiConfigService.update(id, data);
    if (!config) {
      return res.status(404).json(error('配置不存在', 404));
    }
    cmsLogService.log(req, 'ai_config:write', 'ai_config', id, { name: config.name });
    return res.json(success(config, '更新成功'));
  } catch (err) {
    console.error('[cmsAiConfigController.update] error:', err);
    return res.status(500).json(error('更新失败'));
  }
}

function remove(req, res) {
  try {
    const id = parseInt(req.params.id);
    const ok = aiConfigService.remove(id);
    if (!ok) {
      return res.status(404).json(error('配置不存在', 404));
    }
    cmsLogService.log(req, 'ai_config:write', 'ai_config', id, { action: 'delete' });
    return res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('[cmsAiConfigController.remove] error:', err);
    return res.status(500).json(error(err.message || '删除失败'));
  }
}

module.exports = {
  list,
  simple,
  detail,
  create,
  update,
  remove
};
