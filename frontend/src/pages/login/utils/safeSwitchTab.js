/**
 * 安全跳转到 tabBar 页面的统一工具函数。
 * 用于规避微信小程序基础库 3.16.2+ 的 custom tabBar bug：
 *   switchTab 跳 tabBar 时误报 "can not switch to no-tabBar page" 跳转失败。
 *
 * fallback 顺序（从上到下，任何一步成功即终止）：
 *   1. uni.switchTab 原生跳转（95% 场景直接成功）
 *   2. 命中 TAB_BUG_ERR → retry 一次（30ms 延迟，可能是瞬时状态问题）
 *   3. retry 也失败 → uni.reLaunch 兜底（最后一道防线）
 *
 * 【已移除 blank 桥接方案】：实测基础库 bug 是全局性的，
 * 在 blank 页上再调 switchTab 一样中招，每次都导致 reLaunch → 白屏。
 *
 * @param {string} url - tabBar 页路径，支持有/无前导斜杠
 * @param {Object} [extraOpts] - 可选，额外透传给 switchTab/reLaunch 的回调
 */
export function safeSwitchTab(url, extraOpts = {}) {
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  const TAB_BUG_ERR = 'can not switch to no-tabBar page';

  uni.switchTab({
    url: normalizedUrl,
    success: extraOpts.success,
    complete: extraOpts.complete,
    fail(err) {
      const hitTabBug = !!(err && err.errMsg && err.errMsg.includes(TAB_BUG_ERR));
      if (!hitTabBug) {
        console.error('[safeSwitchTab] switchTab 失败（非基础库 bug）：', err?.errMsg || err);
        if (extraOpts.fail) extraOpts.fail(err);
        return;
      }
      // 命中基础库 bug → retry 一次
      console.log('[safeSwitchTab] 命中基础库 bug，retry 一次...');
      setTimeout(() => {
        uni.switchTab({
          url: normalizedUrl,
          success: extraOpts.success,
          complete: extraOpts.complete,
          fail(err2) {
            // retry 也失败 → 最后兜底 reLaunch
            console.warn('[safeSwitchTab] retry 仍失败，兜底 reLaunch：', err2?.errMsg || err2);
            uni.reLaunch({
              url: normalizedUrl,
              success: extraOpts.success,
              fail: extraOpts.fail,
              complete: extraOpts.complete
            });
          }
        });
      }, 30);
    }
  });
}
