<template>
  <AppPage fixed>
    <view class="page-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">消息中心</text>
      <view class="header-right"></view>
    </view>

    <scroll-view
      class="content-scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <view class="content-wrapper">
        <view v-if="noticeStore.messages.length === 0 && !noticeStore.loading" class="empty-state">
          <text class="empty-text">暂无消息</text>
        </view>

        <view v-if="noticeStore.messages.length > 0" class="message-card">
          <view
            v-for="(item, index) in noticeStore.messages"
            :key="item.id"
            class="message-item"
            :class="{ unread: item.user_status === 'unread', last: index === noticeStore.messages.length - 1 }"
            @click="onClick(item)"
          >
            <view class="message-main">
              <view class="message-title-row">
                <text class="message-title">{{ item.title }}</text>
                <view class="message-title-right">
                  <text v-if="item.user_status === 'unread'" class="unread-dot"></text>
                  <text class="message-time">{{ formatTime(item.start_time || item.created_at) }}</text>
                </view>
              </view>
              <text class="message-content">{{ item.content }}</text>
            </view>
            <text v-if="item.jump_type && item.jump_type !== 'none'" class="message-arrow">›</text>
          </view>
        </view>

        <view v-if="noticeStore.loading" class="loading-tip">
          <text>加载中...</text>
        </view>
      </view>
    </scroll-view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import AppPage from '../../components/AppPage.vue';
import { useNoticeStore } from '../../store/notice';
import { normalizeToInternalRoute, isWebViewAllowed } from '../../utils/h5ToInternalRoute';

const noticeStore = useNoticeStore();
const refreshing = ref(false);
const page = ref(1);
const hasMore = ref(true);

const statusBarHeight = ref(44);
try {
  statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 44;
} catch (e) {}

function formatTime(str) {
  if (!str) return '';
  const d = new Date(str);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadMessages(reset = false) {
  if (reset) page.value = 1;
  const pagination = await noticeStore.fetchMessages(page.value);
  hasMore.value = pagination?.has_more || false;
}

async function onRefresh() {
  refreshing.value = true;
  await loadMessages(true);
  await noticeStore.fetchUnreadCount();
  refreshing.value = false;
}

async function onLoadMore() {
  if (!hasMore.value || noticeStore.loading) return;
  page.value += 1;
  await loadMessages();
}

/**
 * 消息中心点击跳转：
 * - 小程序端严格优先走内部路由（原生页）；h5 链接会先尝试映射为 /pages/xxx 内部路径
 * - 仅映射失败且非核心业务的外链才允许走 web-view 兜底（提审合规性）
 */
function onClick(item) {
  noticeStore.markRead(item.id);
  if (item.jump_type === 'internal' && item.jump_url) {
    const params = item.jump_params || {};
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const url = qs ? `${item.jump_url}?${qs}` : item.jump_url;
    uni.navigateTo({ url, fail: () => {} });
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

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 });
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
}

onMounted(() => loadMessages(true));

onShow(() => {
  noticeStore.fetchUnreadCount();
});
</script>

<style lang="scss" scoped>
.page-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #DDF2D2 0%, #F7FbF4 360rpx, #F7FbF4 100%);
  z-index: 0;
}

.status-bar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx 24rpx;
  flex-shrink: 0;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 48rpx;
  color: #27282D;
  font-weight: 700;
  line-height: 1;
  margin-left: -4rpx;
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 40rpx;
}

.header-right {
  width: 60rpx;
}

.content-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  padding: $spacing-md $spacing-md calc(140rpx + env(safe-area-inset-bottom));
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $text-secondary;
}

.message-card {
  background: $bg-card;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  box-shadow: $shadow-card;
}

.message-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
}

.message-item.last {
  border-bottom: none;
}

.message-main {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
}

.message-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.message-title {
  flex: 1;
  font-size: $text-base;
  color: $text-primary;
  font-weight: $font-medium;
  margin-right: 16rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-title-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}

.unread-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #FF6B6B;
}

.message-time {
  font-size: 24rpx;
  color: $text-secondary;
}

.message-content {
  display: block;
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.message-arrow {
  font-size: 40rpx;
  color: $gray-300;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.loading-tip {
  text-align: center;
  padding: 24rpx 0;
  font-size: 24rpx;
  color: $text-secondary;
}
</style>
