/**
 * 安全跳转到 tabBar 页面的统一工具函数（partner 子包私有副本）。
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
      console.log('[safeSwitchTab] 命中基础库 bug，retry 一次...');
      setTimeout(() => {
        uni.switchTab({
          url: normalizedUrl,
          success: extraOpts.success,
          complete: extraOpts.complete,
          fail(err2) {
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
