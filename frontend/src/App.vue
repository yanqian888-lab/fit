<template>
  <view class="app-root">
    <slot />
    <GlobalLoading />
    <AppPopup />
  </view>
</template>

<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useUserStore } from './store';
import GlobalLoading from './components/GlobalLoading.vue';
import AppPopup from './components/AppPopup.vue';
import popupManager from './utils/popupManager';

const userStore = useUserStore();

onLaunch(async () => {
  userStore.init();
  await popupManager.init();
});

onShow(() => {
  // 切前台刷新弹窗配置
  popupManager.init();
});
</script>

<style lang="scss">
.app-root {
  min-height: 100vh;
}

/* 全局样式 - 治愈系 pastel 风格 */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

page {
  margin: 0;
  padding: 0;
  background-color: $bg-page;
  font-family: $font-family;
  color: $text-primary;
  -webkit-font-smoothing: antialiased;
  width: 100%;
  max-width: 100vw;
}

/* 移除默认按钮样式 */
button::after {
  border: none;
}

button {
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: inherit;
}

/* 容器 */
.container {
  padding: $spacing-md;
}

/* 通用卡片 */
.card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  box-shadow: $shadow-card;
}

/* 大标题 */
.page-title {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $text-primary;
  letter-spacing: -0.5rpx;
}

/* 小标题 */
.section-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
}

/* 正文 */
.body-text {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.6;
}

/* 辅助文字 */
.caption {
  font-size: $text-sm;
  color: $text-tertiary;
  font-weight: $font-light;
}

/* 胶囊按钮 */
.btn-capsule {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 40rpx;
  border-radius: $radius-pill;
  font-size: $text-base;
  font-weight: $font-medium;
  background: #7BC8A0;
  color: $white;
  box-shadow: 0 4rpx 20rpx rgba(123, 200, 160, 0.25);
  transition: transform 0.2s ease;
}

.btn-capsule:active {
  transform: scale(0.98);
}

.btn-capsule.secondary {
  background: #98D8C8;
}

.btn-capsule.cream {
  background: $cream;
  color: $text-primary;
}

/* 状态标签 */
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 20rpx;
  border-radius: $radius-pill;
  font-size: $text-sm;
  font-weight: $font-medium;
}

.status-pill.success {
  background: $success-bg;
  color: #5AA8D8;
}

.status-pill.warning {
  background: $warning-bg;
  color: #E8A65C;
}

.status-pill.danger {
  background: $danger-bg;
  color: #E57373;
}

/* 渐变背景 */
.gradient-header {
  background: linear-gradient(180deg, $mint-light 0%, $bg-page 100%);
}

/* 安全区 */
.safe-area-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 页面容器 */
.app-page {
  min-height: 100vh;
  background: linear-gradient(180deg, $mint-light 0%, $bg-page 25%, $bg-page 100%);
  padding: 0 $spacing-md $spacing-md;
  padding-bottom: calc($spacing-md + env(safe-area-inset-bottom));
}

/* 页面头部区 */
.app-page-header {
  padding-top: 100rpx;
  padding-bottom: $spacing-md;
}

.app-page-title {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $text-primary;
}

.app-page-subtitle {
  font-size: $text-sm;
  color: $text-tertiary;
  margin-top: 8rpx;
  font-weight: $font-light;
}

/* 分节标题 */
.app-section-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

/* 空状态 */
.app-empty {
  text-align: center;
  padding: 80rpx 0;
  font-size: $text-base;
  color: $text-tertiary;
}

/* 通用列表 */
.app-list {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: 0 $spacing-md;
  box-shadow: $shadow-card;
}

/* 表单 */
.app-form-group {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  box-shadow: $shadow-card;
}

/* 强制隐藏 uni-app H5 系统 tabbar 占位，避免底部出现黑线/残留 */
.uni-tabbar,
.uni-tabbar-bottom {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  min-height: 0 !important;
}

/* 修复 uni-app H5 中 scroll-view 高度问题 */
scroll-view,
uni-scroll-view {
  height: 100%;
}

uni-scroll-view > .uni-scroll-view {
  height: 100% !important;
}
</style>
