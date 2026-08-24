/**
 * 货币服务（浆果 + 鲜花）
 */
const { db, withTransaction } = require('../db');
const { getChinaDateStr } = require('../utils/chinaTime');
const { getAppConfig } = require('../utils/configCache');

function getCurrency(userId) {
  let currency = db.prepare('SELECT berries, flowers, updated_at FROM user_currency WHERE user_id = ?').get(userId);
  if (!currency) {
    const rules = getAppConfig('currency_rules');
    const berries = rules.initial?.berries || 100;
    const flowers = rules.initial?.flowers || 0;
    // INSERT OR IGNORE 避免并发首次开户时唯一约束冲突
    db.prepare('INSERT OR IGNORE INTO user_currency (user_id, berries, flowers) VALUES (?, ?, ?)').run(userId, berries, flowers);
    currency = db.prepare('SELECT berries, flowers, updated_at FROM user_currency WHERE user_id = ?').get(userId);
  }
  return currency;
}

function getTodayEarned(userId, currencyType, source) {
  const today = getChinaDateStr();
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM currency_transactions
    WHERE user_id = ? AND currency_type = ? AND type = 'reward' AND source = ? AND date(created_at, '+8 hours') = ?
  `).get(userId, currencyType, source, today);
  return row.total;
}

function canRewardTx(userId, currencyType, amount) {
  if (currencyType !== 'berries') return { ok: true }; // 鲜花不走每日上限
  const rules = getAppConfig('currency_rules');
  const dailyMax = rules.berries?.daily_max || 500;
  const todayTotal = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM currency_transactions
    WHERE user_id = ? AND currency_type = 'berries' AND type = 'reward' AND date(created_at, '+8 hours') = ?
  `).get(userId, getChinaDateStr()).total;

  if (todayTotal + amount > dailyMax) {
    return { ok: false, reason: '每日浆果获取已达上限', remaining: Math.max(0, dailyMax - todayTotal) };
  }
  return { ok: true };
}

// 兼容旧调用（已弃用，建议统一使用 addCurrency 做事务内校验）
function canReward(userId, currencyType, amount) {
  return canRewardTx(userId, currencyType, amount);
}

function addCurrencyCore(userId, currencyType, amount, type, source, relatedId) {
  const berriesDelta = currencyType === 'berries' ? amount : 0;
  const flowersDelta = currencyType === 'flowers' ? amount : 0;
  
  // 修复：在原子更新中检查每日上限，避免并发竞态条件
  if (currencyType === 'berries' && type === 'reward') {
    const rules = getAppConfig('currency_rules');
    const dailyMax = rules.berries?.daily_max || 500;
    const today = getChinaDateStr();

    // 每个来源的每日获奖次数限制（currency_rules.berries.daily_limits[source]，0/缺省为不限）
    const sourceLimit = source ? parseInt(rules.berries?.daily_limits?.[source] || 0, 10) : 0;
    if (sourceLimit > 0) {
      const todayCount = db.prepare(`
        SELECT COUNT(*) as count FROM currency_transactions
        WHERE user_id = ? AND currency_type = 'berries' AND type = 'reward' AND source = ? AND date(created_at, '+8 hours') = ?
      `).get(userId, source, today).count;
      if (todayCount >= sourceLimit) {
        // 已达该来源今日获奖次数：不再发奖励，但不算错误（动作本身仍计入任务进度）
        const current = getCurrency(userId);
        return { added: 0, limited: true, source, source_limit: sourceLimit, berries: current.berries, flowers: current.flowers };
      }
    }

    // 使用原子UPDATE + 子查询检查每日上限
    const result = db.prepare(`
      UPDATE user_currency 
      SET berries = berries + ?, 
          flowers = flowers + ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? 
        AND (
          SELECT COALESCE(SUM(amount), 0) 
          FROM currency_transactions 
          WHERE user_id = ? 
            AND currency_type = 'berries' 
            AND type = 'reward' 
            AND date(created_at, '+8 hours') = ?
        ) + ? <= ?
    `).run(berriesDelta, flowersDelta, userId, userId, today, amount, dailyMax);

    if (result.changes === 0) {
      return { error: '每日浆果获取已达上限', remaining: 0 };
    }
  } else {
    // 非浆果奖励或非奖励类型，直接更新
    const result = db.prepare(`
      UPDATE user_currency 
      SET berries = berries + ?, 
          flowers = flowers + ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).run(berriesDelta, flowersDelta, userId);

    if (result.changes === 0) {
      return { error: '更新余额失败' };
    }
  }

  const newCurrency = getCurrency(userId);
  const newBerries = newCurrency.berries;
  const newFlowers = newCurrency.flowers;

  db.prepare(`
    INSERT INTO currency_transactions (user_id, currency_type, amount, type, source, related_id, balance_after)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, currencyType, amount, type, source, relatedId, currencyType === 'berries' ? newBerries : newFlowers);

  return { berries: newBerries, flowers: newFlowers, added: amount };
}

function addCurrency(userId, currencyType, amount, type = 'reward', source = null, relatedId = null) {
  if (amount <= 0) return { error: '奖励数量必须大于0' };
  return withTransaction(() => addCurrencyCore(userId, currencyType, amount, type, source, relatedId));
}

function deductCurrencyCore(userId, currencyType, amount, type, source, relatedId) {
  const currency = getCurrency(userId);
  const current = currencyType === 'berries' ? (currency.berries || 0) : (currency.flowers || 0);
  
  if (current < amount) return { error: '余额不足' };

  // 使用原子更新避免并发竞态条件
  const berriesDelta = currencyType === 'berries' ? -amount : 0;
  const flowersDelta = currencyType === 'flowers' ? -amount : 0;
  
  const result = db.prepare(`
    UPDATE user_currency 
    SET berries = berries + ?, 
        flowers = flowers + ?, 
        updated_at = CURRENT_TIMESTAMP 
    WHERE user_id = ? AND (berries >= ? OR ? = 0) AND (flowers >= ? OR ? = 0)
  `).run(berriesDelta, flowersDelta, userId, amount, berriesDelta, amount, flowersDelta);

  if (result.changes === 0) {
    return { error: '扣除失败，余额不足或并发冲突' };
  }

  const newCurrency = getCurrency(userId);
  const newBerries = newCurrency.berries;
  const newFlowers = newCurrency.flowers;

  db.prepare(`
    INSERT INTO currency_transactions (user_id, currency_type, amount, type, source, related_id, balance_after)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, currencyType, -amount, type, source, relatedId, currencyType === 'berries' ? newBerries : newFlowers);

  return { berries: newBerries, flowers: newFlowers, deducted: amount };
}

function deductCurrency(userId, currencyType, amount, type = 'consume', source = null, relatedId = null) {
  if (amount <= 0) return { error: '扣除数量必须大于0' };
  return withTransaction(() => deductCurrencyCore(userId, currencyType, amount, type, source, relatedId));
}

function getTransactions(userId, page = 1, size = 20) {
  const offset = (page - 1) * size;
  const list = db.prepare(`
    SELECT * FROM currency_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(userId, size, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM currency_transactions WHERE user_id = ?').get(userId).count;
  return { list, pagination: { page, size, total, has_more: total > page * size } };
}

function adjustCurrencyCore(userId, currencyType, amount, reason) {
  const currency = getCurrency(userId);
  const current = currencyType === 'berries' ? (currency.berries || 0) : (currency.flowers || 0);
  const newBalance = current + amount;

  if (newBalance < 0) {
    return { error: '调整后余额不能为负数' };
  }

  db.prepare('UPDATE user_currency SET berries = ?, flowers = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
    .run(
      currencyType === 'berries' ? newBalance : currency.berries,
      currencyType === 'flowers' ? newBalance : currency.flowers,
      userId
    );

  db.prepare(`
    INSERT INTO currency_transactions (user_id, currency_type, amount, type, source, related_id, balance_after)
    VALUES (?, ?, ?, 'admin_adjust', ?, NULL, ?)
  `).run(userId, currencyType, amount, reason || 'manual_adjust', newBalance);

  return { currency_type: currencyType, amount, balance_after: newBalance };
}

function adjustCurrency(userId, currencyType, amount, reason) {
  if (!['berries', 'flowers'].includes(currencyType)) {
    return { error: '货币类型错误' };
  }
  if (amount === 0) {
    return { error: '调整金额不能为0' };
  }
  return withTransaction(() => adjustCurrencyCore(userId, currencyType, amount, reason));
}

module.exports = {
  getCurrency,
  addCurrency,
  addCurrencyCore,
  deductCurrency,
  deductCurrencyCore,
  getTransactions,
  canReward,
  getAppConfig,
  adjustCurrency
};