/**
 * CMS 里程碑文案模板管理
 */
const { success, error } = require('../utils/response');
const milestoneTemplateService = require('../services/milestoneTemplateService');
const cmsLogService = require('../services/cmsLogService');

const ALLOWED_VALUES = {
  weight_loss: [2.5, 5, 10, 15, 20, 30],
  duration: [7, 30, 60, 100, 180, 365],
  checkin: [7, 30, 60, 100]
};

function normalizeValue(data) {
  if (data.value === undefined || data.value === null || data.value === '') {
    return null;
  }
  const num = Number(data.value);
  return Number.isNaN(num) ? null : num;
}

function validateValue(type, value) {
  if (value === null || value === undefined) return true;
  const allowed = ALLOWED_VALUES[type] || [];
  return allowed.includes(value);
}

function list(req, res) {
  try {
    const data = milestoneTemplateService.list();
    return res.json(success(data));
  } catch (err) {
    console.error('[cmsMilestoneController.list] error:', err);
    return res.status(500).json(error('获取失败'));
  }
}

function create(req, res) {
  try {
    const data = req.body || {};
    if (!data.type || !data.content) {
      return res.status(400).json(error('类型和文案不能为空', 400));
    }
    const value = normalizeValue(data);
    if (!validateValue(data.type, value)) {
      return res.status(400).json(error('适用值不在该类型允许的里程碑数值中', 400));
    }
    const item = milestoneTemplateService.create({ ...data, value });
    cmsLogService.log(req, 'milestone:write', 'milestone_template', item.id, { type: item.type, value: item.value });
    return res.json(success(item, '创建成功'));
  } catch (err) {
    console.error('[cmsMilestoneController.create] error:', err);
    return res.status(500).json(error('创建失败'));
  }
}

function update(req, res) {
  try {
    const id = parseInt(req.params.id);
    const data = req.body || {};
    const value = normalizeValue(data);
    if (!validateValue(data.type, value)) {
      return res.status(400).json(error('适用值不在该类型允许的里程碑数值中', 400));
    }
    const item = milestoneTemplateService.update(id, { ...data, value });
    if (!item) {
      return res.status(404).json(error('记录不存在', 404));
    }
    cmsLogService.log(req, 'milestone:write', 'milestone_template', id, { type: item.type, value: item.value });
    return res.json(success(item, '更新成功'));
  } catch (err) {
    console.error('[cmsMilestoneController.update] error:', err);
    return res.status(500).json(error('更新失败'));
  }
}

function remove(req, res) {
  try {
    const id = parseInt(req.params.id);
    const ok = milestoneTemplateService.remove(id);
    if (!ok) {
      return res.status(404).json(error('记录不存在', 404));
    }
    cmsLogService.log(req, 'milestone:write', 'milestone_template', id, { action: 'delete' });
    return res.json(success(null, '删除成功'));
  } catch (err) {
    console.error('[cmsMilestoneController.remove] error:', err);
    return res.status(500).json(error('删除失败'));
  }
}

function seed(req, res) {
  try {
    milestoneTemplateService.seedDefaults();
    cmsLogService.log(req, 'milestone:write', 'milestone_template', 0, { action: 'seed' });
    return res.json(success(null, '已重置默认文案'));
  } catch (err) {
    console.error('[cmsMilestoneController.seed] error:', err);
    return res.status(500).json(error('重置失败'));
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  seed
};
