import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import popupManager from './utils/popupManager';

// =====================================================================
// 【全局 Promise 异常兜底】防止 Uncaught Promise Rejection 导致渲染层报错
// 原因：微信基础库 3.17.1 中，未捕获的 Promise rejection 会直接上报到渲染层，
//       引发 "Cannot read property 'addListener' of undefined" 等级联错误
// 方案：全局监听 unhandledrejection，静默捕获已知业务错误，仅打印日志
// =====================================================================
// #ifdef MP-WEIXIN
if (typeof uni.onUnhandledRejection === 'function') {
  uni.onUnhandledRejection((res) => {
    const reason = res?.reason || res?.err || {};
    const msg = typeof reason === 'string' ? reason : (reason?.message || '');
    // 已知无害错误静默处理
    if (msg.includes('addListener') || msg.includes('fail') || msg.includes('网络错误')) {
      console.warn('[Promise] 已捕获的预期异常', msg);
    } else {
      console.error('[Promise] 未捕获的异常', reason);
    }
  });
}
// #endif

// =====================================================================
// 【全局跳转安全兜底 2026-08-25】并行跳转被打断时 fail:noop 防 SDK3.17.1 灰度崩溃
// 根因：微信基础库 3.17.1 灰度中，当两个跳转（navigateTo/redirectTo/switchTab/reLaunch/navigateBack）
//       在 50ms 内连续发起时，第一个跳转的 fail 回调被调用但传参为 undefined，
//       uni-app 默认 fail 处理器内部会直接访问 err.errMsg → TypeError: Cannot read 'errMsg' of undefined
//       （堆栈 WAServiceMainContext.js H 函数，不在业务代码里，肉眼 grep 不出来）
// 方案：小程序端全局 monkey patch 所有跳转 API，强制补 noop fail 兜底，
//       永远不让 SDK 3.17.1 默认 fail 处理器直接接管 undefined err；
//       对业务代码传的 success/fail/complete 回调按原顺序透传，无任何副作用，兼容所有页面。
// 注意：此处仅在 uni 层加 noop fail，不拦截正常错误上报（业务仍可自定义 fail 回调）
// =====================================================================
// #ifdef MP-WEIXIN
(function patchAllNavigateFailNoop() {
  const NAV_METHODS = ['navigateTo', 'redirectTo', 'switchTab', 'reLaunch', 'navigateBack'];
  NAV_METHODS.forEach(methodName => {
    const raw = uni[methodName]?.bind(uni);
    if (!raw) return;
    uni[methodName] = function (opts = {}) {
      const originalFail = opts.fail;
      // 强制补 noop fail 兜底：无论用户传没传 fail，SDK 默认 handler 都拿不到执行权
      const safeOpts = {
        ...opts,
        fail(err) {
          // 业务自定义 fail 优先执行，传 undefined 也正常，业务代码里早已 err?.errMsg 判空
          if (typeof originalFail === 'function') {
            try { originalFail(err); } catch (e) { console.error(`[${methodName}] fail 回调异常`, e); }
          }
          // noop 兜底，最后吸收 undefined 场景的 SDK 默认 handler
        }
      };
      return raw(safeOpts);
    };
  });
})();
// #endif

// =====================================================================
// 【已停用 2026-08-25】全局 wx.switchTab patch（作用域过宽导致 4 次 routeDone not found）
// 原因：uni-app 内部路由状态机通过自己封装的 uni.switchTab 管理 webviewId，
//       全局 monkey patch 底层 wx.switchTab 会让 webviewId 与原生回调不同步 →
//       login/初始化并行跳转时连续报 [Page route 错误] routeDone with webviewId not found
//
// 替代方案：fallback 链缩窄到 CustomTabBar 点击函数内部（custom-tab-bar/index.vue L77-L100）
//   因为微信 custom tabBar switchTab 基础库 bug 仅发生在"用户点底部tab图标"场景，
//   其他 login/authRedirect/内部跳转 uni.switchTab 走原生即可，无此 bug。
// =====================================================================
/*
// #ifdef MP-WEIXIN
(function patchSwitchTabForTabBarWhiteList() {
  const TAB_BAR_WHITELIST = new Set([
    'pages/index/index',
    'pages/pet/index',
    'pages/record/index',
    'pages/museum/index'
  ]);
  const TAB_BUG_ERR = 'can not switch to no-tabBar page';
  const rawSwitchTab = wx.switchTab.bind(wx);
  const rawRedirectTo = wx.redirectTo.bind(wx);
  function deSlashForCompare(u) { return (u || '').replace(/^\//, ''); }

  wx.switchTab = function (opts = {}) {
    const rawUrl = opts.url || '';
    const targetForCompare = deSlashForCompare(rawUrl);
    if (!TAB_BAR_WHITELIST.has(targetForCompare)) return rawSwitchTab(opts);
    const originalFail = opts.fail;
    return rawSwitchTab({
      ...opts,
      fail(err) {
        const hitTabBug = !!(err && err.errMsg && err.errMsg.includes(TAB_BUG_ERR));
        if (!hitTabBug) {
          if (originalFail) originalFail(err);
          return;
        }
        console.log('[switchTab patch] 命中基础库 bug，直接走 blank 桥接中转（切死循环）');
        rawRedirectTo({
          url: `/pages/blank/index?tabTarget=${encodeURIComponent(targetForCompare)}`,
          success() {},
          fail() {
            console.log('[switchTab patch] blank 桥接 redirectTo 失败，最后兜底 reLaunch');
            wx.reLaunch({
              url: rawUrl,
              success: opts.success,
              fail: originalFail,
              complete: opts.complete
            });
          }
        });
      }
    });
  };
})();
// #endif
*/

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // 全局页面生命周期：触发弹窗检测、清理定时器、拦截返回键关闭弹窗
  // 【优化】所有 popupManager 调用都添加 .catch() 防止 Uncaught Promise Rejection
  app.mixin({
    onShow() {
      try {
        const pages = getCurrentPages();
        const route = pages[pages.length - 1]?.route || '';
        // 使用 setTimeout 延迟执行，避免阻塞页面首帧渲染
        setTimeout(() => {
          popupManager.checkShow({ route, trigger: 'immediate' }).catch(() => {});
          popupManager.checkShow({ route, trigger: 'duration' }).catch(() => {});
        }, 100);
      } catch (e) {
        console.warn('[popup] onShow 钩子异常已捕获', e);
      }
    },
    onHide() {
      try {
        popupManager.clearPending();
        // 页面切换/隐藏时自动收起当前弹窗，避免带入其他页面
        popupManager.closeCurrent('page_switch');
      } catch (e) {
        console.warn('[popup] onHide 钩子异常已捕获', e);
      }
    },
    onUnload() {
      try {
        popupManager.clearPending();
        popupManager.closeCurrent('page_switch');
        // 页面返回时尝试触发 back 时机弹窗
        const pages = getCurrentPages();
        const route = pages[pages.length - 1]?.route || '';
        popupManager.checkShow({ route, trigger: 'back' }).catch(() => {});
      } catch (e) {
        console.warn('[popup] onUnload 钩子异常已捕获', e);
      }
    },
    onBackPress() {
      try {
        if (popupManager.isVisible()) {
          popupManager.closeCurrent('back');
          return true;
        }
      } catch (e) {
        console.warn('[popup] onBackPress 钩子异常已捕获', e);
      }
      return false;
    }
  });

  return {
    app
  };
}
