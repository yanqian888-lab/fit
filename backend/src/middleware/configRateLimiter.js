/**
 * 配置访问频率限制中间件
 */

const rateLimit = require('express-rate-limit');

const configRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    code: 429,
    message: '配置请求过于频繁，请稍后再试',
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || 'unknown';
  }
});

const strictConfigRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    code: 429,
    message: '配置更新请求过于频繁，请稍后再试',
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || 'unknown';
  }
});

module.exports = {
  configRateLimiter,
  strictConfigRateLimiter
};