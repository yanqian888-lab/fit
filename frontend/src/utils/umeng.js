/**
 * 友盟+ U-Mini 小程序统计 —— 用户标识上报工具（仅微信小程序端生效）
 *
 * 采用官方「方案3：业务自己拿到 openid 后手动传给友盟」：
 * 后端登录/用户信息接口已返回 openid（微信 code2session 换取），
 * 前端在登录成功、启动同步用户信息后调用 wx.uma.setOpenid(openid) 上报，
 * 不依赖友盟后台配置 AppSecret 自动获取，链路更可控。
 * 文档：https://developer.umeng.com/docs/147615/detail/147619
 */

/**
 * 获取全局原生 wx 上挂载的友盟 uma 对象
 * 注意：uni-app 编译器会替换裸 wx 标识符，必须用字符串索引 globalThis['wx']
 * @returns {object|null} 友盟 uma 对象，非小程序端或 SDK 未就绪时返回 null
 */
function getUma() {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : null;
    const nativeWx = g ? g['wx'] : null;
    return (nativeWx && nativeWx.uma) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 上报用户 openid 给友盟（用于按 openid 精确统计用户、打通登录前后行为）
 * 可重复调用，SDK 以最后一次为准；openid 为空或 SDK 未就绪时静默跳过。
 * @param {string} [openid] - 微信用户 openid（由后端登录 / getMe 接口返回）
 * @returns {boolean} 是否成功调用 SDK
 */
export function setUmengOpenid(openid) {
  if (!openid) return false;
  try {
    const uma = getUma();
    if (uma && typeof uma.setOpenid === 'function') {
      uma.setOpenid(String(openid));
      return true;
    }
  } catch (e) {
    console.warn('[umeng] setOpenid 失败', e);
  }
  return false;
}
