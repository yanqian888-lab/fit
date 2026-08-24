/**
 * CMS 货币经济配置管理
 */
const { db } = require('../db');
const { success, error } = require('../utils/response');
const cmsLogService = require('../services/cmsLogService');
const currencyService = require('../services/currencyService');
const { invalidateAppConfig } = require('../utils/configCache');

function getAppConfig(key) {
  const row = db.prepare('SELECT config_value FROM app_configs WHERE config_key = ?').get(key);
  if (!row) return {};
  try {
    return JSON.parse(row.config_value || '{}');
  } catch (e) {
    return {};
  }
}

function setAppConfig(key, value) {
  db.prepare(`
    INSERT INTO app_configs (config_key, config_value)
    VALUES (?, ?)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value));
  invalidateAppConfig(key);
}

// ==================== 规则配置 ====================
function getRules(req, res) {
  const rules = getAppConfig('currency_rules');
  return res.json(success(rules));
}

function updateRules(req, res) {
  const updates = req.body || {};
  const current = getAppConfig('currency_rules');
  const merged = { ...current, ...updates };
  setAppConfig('currency_rules', merged);
  cmsLogService.log(req, 'currency_config:update', 'currency_rules', '', { changed: Object.keys(updates) });
  return res.json(success(null, '保存成功'));
}

// ==================== 交易流水 ====================
function listTransactions(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
  const offset = (page - 1) * size;
  const { user_id, currency_type, type, source } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (user_id) {
    where += ' AND user_id = ?';
    params.push(user_id);
  }

  if (currency_type) {
    where += ' AND currency_type = ?';
    params.push(currency_type);
  }

  if (type) {
    where += ' AND type = ?';
    params.push(type);
  }

  if (source) {
    where += ' AND source LIKE ?';
    params.push(`%${source}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM currency_transactions ${where}`).get(...params).count;

  const list = db.prepare(`
    SELECT * FROM currency_transactions
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, size, offset);

  return res.json(success({
    list,
    pagination: { page, size, total, has_more: total > page * size }
  }));
}

// ==================== 手动调整 ====================
function adjust(req, res) {
  const { user_id, currency_type, amount, reason } = req.body;

  if (!user_id) {
    return res.status(400).json(error('缺少用户 ID', 400));
  }
  if (!['berries', 'flowers'].includes(currency_type)) {
    return res.status(400).json(error('货币类型错误', 400));
  }
  if (amount === undefined || amount === 0) {
    return res.status(400).json(error('调整金额不能为空或0', 400));
  }

  const result = currencyService.adjustCurrency(user_id, currency_type, amount, reason || 'manual_adjust');
  if (result.error) {
    return res.status(400).json(error(result.error, 400));
  }

  cmsLogService.log(req, 'currency_config:adjust', 'user_currency', String(user_id), { currency_type, amount, reason });
  return res.json(success(result, '调整成功'));
}

// ==================== 今日分析消耗配置 ====================
function getAnalysisCost(req, res) {
  const cost = getAppConfig('analysis_cost');
  return res.json(success(cost));
}

function updateAnalysisCost(req, res) {
  const { berries, flowers } = req.body || {};

  const toInt = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : NaN;
  };

  const berriesVal = toInt(berries);
  const flowersVal = toInt(flowers);
  if (Number.isNaN(berriesVal) || Number.isNaN(flowersVal)) {
    return res.status(400).json(error('消耗数量必须为不小于 0 的数字', 400));
  }

  const current = getAppConfig('analysis_cost');
  const merged = {
    berries: berriesVal !== null ? berriesVal : (current.berries || 0),
    flowers: flowersVal !== null ? flowersVal : (current.flowers || 0)
  };
  setAppConfig('analysis_cost', merged);

  cmsLogService.log(req, 'currency_config:analysis_cost', 'analysis_cost', '', merged);
  return res.json(success(merged, '保存成功'));
}

module.exports = {
  getRules,
  updateRules,
  listTransactions,
  adjust,
  getAnalysisCost,
  updateAnalysisCost
};
