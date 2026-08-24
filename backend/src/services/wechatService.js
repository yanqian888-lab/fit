/**
 * 微信小程序后端服务封装
 * - code2session：用前端 wx.login() 拿到的 code 换 openid + session_key + unionid
 * - getPhoneNumber：用 button open-type="getPhoneNumber" 回调的 code 换手机号
 *
 * 参考文档：
 *   https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
 *   https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/phonenumber/phonenumber.getPhoneNumber.html
 *
 * 注意：access_token 需全局缓存（微信侧限流），此处做简单内存缓存，多进程部署需换 Redis 等共享存储。
 */
const config = require('../config');

const BASE_HOST = 'https://api.weixin.qq.com';

let cachedAccessToken = null;
let cachedAccessTokenExpireAt = 0;

/**
 * 读取微信小程序 AppID / Secret，缺失时抛错便于部署期发现
 */
function getCredentials() {
  const appId = config.wechat && config.wechat.appId;
  const secret = config.wechat && config.wechat.secret;
  if (!appId || !secret) {
    const err = new Error('未配置 WECHAT_APPID / WECHAT_SECRET，无法调用微信 API');
    err.code = 'WECHAT_CREDENTIAL_MISSING';
    throw err;
  }
  return { appId, secret };
}

/**
 * 调用微信 api 获取 openid + session_key
 * @param {string} code wx.login() 返回的 code
 * @returns {Promise<{openid: string, session_key: string, unionid?: string}>}
 */
async function code2session(code) {
  if (!code || typeof code !== 'string' || code.length < 10 || code.length > 100) {
    const err = new Error('微信登录 code 格式不正确');
    err.code = 'WECHAT_CODE_INVALID';
    throw err;
  }

  const { appId, secret } = getCredentials();
  const url = `${BASE_HOST}/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

  const res = await fetch(url, { method: 'GET' });
  const data = await res.json();

  if (!res.ok || data.errcode) {
    const err = new Error(`微信 code2session 失败: ${data.errcode} ${data.errmsg || res.statusText}`);
    err.code = 'WECHAT_API_ERROR';
    err.detail = data;
    throw err;
  }

  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid || null
  };
}

/**
 * 获取全局接口调用凭据 access_token，带本地缓存
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessTokenExpireAt) {
    return cachedAccessToken;
  }

  const { appId, secret } = getCredentials();
  const url = `${BASE_HOST}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`;

  const res = await fetch(url, { method: 'GET' });
  const data = await res.json();

  if (!res.ok || data.errcode) {
    const err = new Error(`获取 access_token 失败: ${data.errcode} ${data.errmsg || res.statusText}`);
    err.code = 'WECHAT_API_ERROR';
    err.detail = data;
    throw err;
  }

  cachedAccessToken = data.access_token;
  // 微信返回 expires_in 单位为秒
  cachedAccessTokenExpireAt = now + Math.max(60, (data.expires_in || 7200) - 300) * 1000;
  return cachedAccessToken;
}

/**
 * 用 button open-type="getPhoneNumber" 回调里的 code 换手机号
 * @param {string} code getPhoneNumber 回调返回的 code
 * @returns {Promise<{phoneNumber: string, purePhoneNumber: string, countryCode: string}>}
 */
async function getPhoneNumber(code) {
  if (!code || typeof code !== 'string' || code.length < 5 || code.length > 100) {
    const err = new Error('微信手机号 code 格式不正确');
    err.code = 'WECHAT_PHONE_CODE_INVALID';
    throw err;
  }

  const accessToken = await getAccessToken();
  const url = `${BASE_HOST}/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const data = await res.json();

  if (!res.ok || data.errcode) {
    const err = new Error(`获取微信手机号失败: ${data.errcode} ${data.errmsg || res.statusText}`);
    err.code = 'WECHAT_API_ERROR';
    err.detail = data;
    throw err;
  }

  const info = data.phone_info || {};
  return {
    phoneNumber: info.phoneNumber,
    purePhoneNumber: info.purePhoneNumber,
    countryCode: info.countryCode
  };
}

/**
 * 清除 access_token 缓存（测试或手动刷新用）
 */
function clearAccessTokenCache() {
  cachedAccessToken = null;
  cachedAccessTokenExpireAt = 0;
}

module.exports = {
  code2session,
  getAccessToken,
  getPhoneNumber,
  clearAccessTokenCache
};
