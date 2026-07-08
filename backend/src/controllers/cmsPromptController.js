/**
 * CMS AI Prompt 管理
 */
const { success, error } = require('../utils/response');
const promptService = require('../services/promptService');
const cmsLogService = require('../services/cmsLogService');

function list(req, res) {
  try {
    const data = promptService.listPrompts();
    return res.json(success(data));
  } catch (err) {
    console.error('[cmsPromptController.list] error:', err);
    return res.status(500).json(error('获取失败'));
  }
}

function detail(req, res) {
  try {
    const { key } = req.params;
    const meta = promptService.getPromptMeta(key);
    if (!meta.latest) {
      return res.status(404).json(error('Prompt 不存在', 404));
    }
    return res.json(success(meta));
  } catch (err) {
    console.error('[cmsPromptController.detail] error:', err);
    return res.status(500).json(error('获取失败'));
  }
}

function publish(req, res) {
  try {
    const { key } = req.params;
    const { content, ai_config_id } = req.body || {};
    if (content === undefined) {
      return res.status(400).json(error('content 不能为空', 400));
    }
    const configId = ai_config_id !== undefined && ai_config_id !== '' ? parseInt(ai_config_id) : null;
    const version = promptService.publishVersion(key, content, configId);
    cmsLogService.log(req, 'prompt:write', 'ai_prompt', key, { version, ai_config_id: configId });
    return res.json(success({ version }, '已发布新版本'));
  } catch (err) {
    console.error('[cmsPromptController.publish] error:', err);
    return res.status(500).json(error('发布失败'));
  }
}

function setAiConfig(req, res) {
  try {
    const { key } = req.params;
    const { ai_config_id } = req.body || {};
    const configId = ai_config_id !== undefined && ai_config_id !== '' ? parseInt(ai_config_id) : null;
    promptService.setPromptAiConfig(key, configId);
    cmsLogService.log(req, 'prompt:write', 'ai_prompt', key, { ai_config_id: configId });
    return res.json(success(null, 'AI 配置已更新'));
  } catch (err) {
    console.error('[cmsPromptController.setAiConfig] error:', err);
    return res.status(500).json(error('更新失败'));
  }
}

function setEnabled(req, res) {
  try {
    const { key, version } = req.params;
    const { is_enabled } = req.body || {};
    if (is_enabled !== true && is_enabled !== false && is_enabled !== 1 && is_enabled !== 0) {
      return res.status(400).json(error('is_enabled 必须是布尔值', 400));
    }
    const enabled = is_enabled === true || is_enabled === 1 ? 1 : 0;
    promptService.setVersionEnabled(key, parseInt(version), enabled);
    cmsLogService.log(req, 'prompt:write', 'ai_prompt', `${key}#${version}`, { is_enabled: enabled });
    return res.json(success(null, '状态已更新'));
  } catch (err) {
    console.error('[cmsPromptController.setEnabled] error:', err);
    return res.status(500).json(error('更新失败'));
  }
}

module.exports = {
  list,
  detail,
  publish,
  setEnabled,
  setAiConfig
};
