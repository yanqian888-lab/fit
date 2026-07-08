import { createSSRApp, createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import AppPopup from './components/AppPopup.vue';
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
    },
    onUnload() {
      popupManager.clearPending();
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

  // H5 环境下把弹窗组件挂到 body，避免 App.vue 全局组件在 H5 下不渲染导致弹窗出不来
  try {
    const info = uni.getSystemInfoSync();
    if (info.platform === 'web' && typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.id = 'app-popup-container';
      document.body.appendChild(container);
      const popupApp = createApp(AppPopup);
      popupApp.mount(container);
    }
  } catch (e) {
    console.error('[popup] H5 挂载弹窗组件失败', e);
  }

  return {
    app
  };
}
