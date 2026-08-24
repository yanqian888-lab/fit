/**
 * 奖励消息 toast 展示
 * 后端接口返回 reward_messages 后，前端统一调用展示
 */
export function showRewardToast(rewardMessages, defaultTitle = '记录成功') {
  if (!Array.isArray(rewardMessages) || rewardMessages.length === 0) {
    uni.showToast({ title: defaultTitle, icon: 'success' });
    return;
  }

  // 合并多条奖励为一条 toast
  const parts = rewardMessages.map(item => {
    if (item.message) return item.message;
    return item.name ? `完成「${item.name}」` : '';
  }).filter(Boolean);

  if (parts.length === 0) {
    uni.showToast({ title: defaultTitle, icon: 'success' });
    return;
  }

  // 多条奖励时只展示第一条，避免 toast 过长
  uni.showToast({
    title: parts[0],
    icon: 'none',
    duration: 2500
  });

  // 如果有多条，延迟展示剩余条数提示
  if (parts.length > 1) {
    setTimeout(() => {
      uni.showToast({
        title: `还有 ${parts.length - 1} 条奖励已到账`,
        icon: 'none',
        duration: 1500
      });
    }, 2600);
  }
}
