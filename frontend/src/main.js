import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import popupManager from './utils/popupManager';

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
