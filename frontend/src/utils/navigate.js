/**
 * 安全返回：优先 navigateBack，无上一层级时回退到指定首页
 */
export function goBack(fallbackUrl = '/pages/index/index') {
  // #ifdef H5
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  // #endif

  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 });
    return;
  }

  // 没有可返回页面时，按 fallbackUrl 类型处理
  if (fallbackUrl) {
    const tabPages = ['/pages/index/index', '/pages/pet/index', '/pages/record/index', '/pages/museum/index'];
    if (tabPages.includes(fallbackUrl)) {
      uni.switchTab({ url: fallbackUrl });
    } else {
      uni.redirectTo({ url: fallbackUrl });
    }
  }
}
