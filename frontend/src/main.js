import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import popupManager from './utils/popupManager';

// #ifdef MP-WEIXIN
// 规避基础库 3.16.2 的 bug：tabBar 第 1 项 switchTab 报 "can not switch to no-tabBar page"
//（已实测：任何页面放到 tabBar 第 1 位都切不过去，其余位置正常）
// 注意：uni-app 编译后 uni.* 实为 wx.*，需直接补丁 wx.switchTab；
// 仅拦截目标为首个 tab（/pages/index/index）的调用改用 reLaunch，其余保持原生语义
(function patchSwitchTabForFirstTab() {
  const FIRST_TAB = 'pages/index/index';
  const rawSwitchTab = wx.switchTab.bind(wx);
  wx.switchTab = function (opts = {}) {
    const target = (opts.url || '').replace(/^\//, '');
    if (target === FIRST_TAB) {
      return wx.reLaunch({
        url: opts.url,
        success: opts.success,
        fail: opts.fail,
        complete: opts.complete
      });
    }
    return rawSwitchTab(opts);
  };
})();
// #endif

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // 全局页面生命周期：触发弹窗检测、清理定时器、拦截返回键关闭弹窗
  app.mixin({
    onShow() {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route || '';
      popupManager.checkShow({ route, trigger: 'immediate' });
      // duration 类型弹窗按配置的延迟自动触发
      popupManager.checkShow({ route, trigger: 'duration' });
    },
    onHide() {
      popupManager.clearPending();
      // 页面切换/隐藏时自动收起当前弹窗，避免带入其他页面
      popupManager.closeCurrent('page_switch');
    },
    onUnload() {
      popupManager.clearPending();
      popupManager.closeCurrent('page_switch');
      // 页面返回时尝试触发 back 时机弹窗
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route || '';
      popupManager.checkShow({ route, trigger: 'back' });
    },
    onBackPress() {
      if (popupManager.isVisible()) {
        popupManager.closeCurrent('back');
        return true;
      }
      return false;
    }
  });

  return {
    app
  };
}
