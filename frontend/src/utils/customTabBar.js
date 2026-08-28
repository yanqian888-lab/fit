/**
 * 微信小程序自定义 tabBar 更新选中状态工具
 * 在每个 tabBar 页面的 onShow 里调用
 * uni-app Vue3 script setup 没有 this，需要用 getCurrentPages() 获取原生 Page 实例
 * @param {number} index - tab 索引 (0=聊聊, 1=搭搭, 2=记录, 3=博物馆)
 */
export function updateCustomTabBarSelected(index) {
  // #ifdef MP-WEIXIN
  try {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && typeof currentPage.getTabBar === 'function') {
      const tabBar = currentPage.getTabBar();
      if (tabBar && tabBar.setData) {
        tabBar.setData({ selected: index });
        console.log('[CustomTabBar] 更新 selected:', index);
      }
    }
  } catch (e) {
    console.warn('[CustomTabBar] 更新失败:', e);
  }
  // #endif
}
