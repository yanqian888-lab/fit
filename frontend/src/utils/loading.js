/**
 * 全局页面加载 loading
 * 超过 2s 仍未完成时显示旋转 loading
 */
export function showGlobalLoading(options = {}) {
  uni.$emit('global-loading-show', options);
}

export function hideGlobalLoading() {
  uni.$emit('global-loading-hide');
}
