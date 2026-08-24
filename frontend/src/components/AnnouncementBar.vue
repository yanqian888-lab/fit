<template>
  <view v-if="visibleList.length > 0" class="announcement-bar">
    <view
      v-for="item in visibleList"
      :key="item.id"
      class="announcement-item"
      :style="itemStyle(item)"
      @click="onClick(item)"
    >
      <image v-if="item.image_url" class="ann-image" :src="resolveStaticUrl(item.image_url)" mode="aspectFill" />
      <view class="ann-body">
        <text class="ann-title">{{ item.title }}</text>
        <text v-if="item.content" class="ann-content">{{ item.content }}</text>
      </view>
      <view v-if="item.dismissible" class="ann-close" @click.stop="onClose(item)">
        <text class="ann-close-text">✕</text>
      </view>
      <view v-if="item.user_status === 'unread'" class="ann-dot"></view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useNoticeStore } from '../store/notice';
import { resolveStaticUrl } from '../utils/environment';
import { normalizeToInternalRoute, isWebViewAllowed } from '../utils/h5ToInternalRoute';

const noticeStore = useNoticeStore();
const props = defineProps({
  position: { type: String, default: 'home' },
  max: { type: Number, default: 3 }
});

const closedKey = 'announcement_closed_ids';

function getClosedIds() {
  try {
    return JSON.parse(uni.getStorageSync(closedKey) || '[]');
  } catch (e) {
    return [];
  }
}

function setClosedIds(ids) {
  uni.setStorageSync(closedKey, JSON.stringify(ids));
}

const visibleList = computed(() => {
  const closedIds = getClosedIds();
  const list = noticeStore.announcements
    .filter(a => a.position === props.position && !closedIds.includes(a.id))
    .slice(0, props.max);
  return list;
});

function itemStyle(item) {
  const style = {};
  if (item.background_color) style.backgroundColor = item.background_color;
  if (item.text_color) style.color = item.text_color;
  return style;
}

/**
 * 公告条点击跳转：
 * - 小程序端严格优先走内部路由（原生页）；h5 链接会先尝试映射为 /pages/xxx 内部路径
 * - 仅映射失败且非核心业务的外链才允许走 web-view 兜底（提审合规性）
 */
function onClick(item) {
  noticeStore.recordShow(item.id);
  noticeStore.markRead(item.id);
  if (item.jump_type === 'internal') {
    const params = item.jump_params || {};
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const url = qs ? `${item.jump_url}?${qs}` : item.jump_url;
    if (url) uni.navigateTo({ url, fail: () => {} });
  } else if (item.jump_type === 'h5' && item.jump_url) {
    const internal = normalizeToInternalRoute(item.jump_url);
    if (internal) {
      uni.navigateTo({ url: internal.url, fail: () => {} });
      return;
    }
    // #ifdef MP-WEIXIN
    if (!isWebViewAllowed(item.jump_url)) {
      uni.showToast({ title: '请在小程序内访问对应功能', icon: 'none' });
      return;
    }
    // #endif
    uni.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(item.jump_url)}` });
  }
}

async function onClose(item) {
  const ids = getClosedIds();
  if (!ids.includes(item.id)) {
    ids.push(item.id);
    setClosedIds(ids);
  }
  // 同步服务端为已读，避免消息中心红点不消失
  await noticeStore.markRead(item.id);
}
</script>

<style lang="scss" scoped>
.announcement-bar {
  margin: 16rpx 32rpx 0;
}
.announcement-item {
  position: relative;
  display: flex;
  align-items: center;
  background: #FFF9E6;
  border-radius: 24rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 12rpx;
  overflow: hidden;
}
.ann-image {
  width: 72rpx;
  height: 72rpx;
  border-radius: 12rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
  background: #eee;
}
.ann-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ann-title {
  font-size: 26rpx;
  font-weight: 600;
  color: inherit;
  line-height: 1.4;
}
.ann-content {
  font-size: 22rpx;
  color: inherit;
  opacity: 0.85;
  margin-top: 4rpx;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ann-close {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12rpx;
  flex-shrink: 0;
}
.ann-close-text {
  font-size: 22rpx;
  color: inherit;
  opacity: 0.6;
}
.ann-dot {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #FF6B6B;
}
</style>
