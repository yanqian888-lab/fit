<template>
  <!-- H5 端：App.vue 作为根组件，用 slot 承载页面层，并挂载全局 Loading / 弹窗容器 -->
  <!-- #ifdef H5 -->
  <view class="app-root">
    <slot />
    <GlobalLoading />
    <AppPopup />
  </view>
  <!-- #endif -->

  <!-- 小程序端：App.vue 的 <template> 不会被渲染（小程序每个 Page 独立渲染）
       若保留 <slot /> 会导致 Vue3 编译器在 slot children 解构时生成 children.e0 访问，
       小程序没有 slot，children 为 undefined，抛出 "Cannot read property 'e0' of undefined"
       全局弹窗 / Loading 在各页面内独立引用，这里不需要挂载 -->
  <!-- #ifdef MP-WEIXIN -->
  <view />
  <!-- #endif -->
</template>

<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useUserStore } from './store';
import { useNoticeStore } from './store/notice';
// 全局组件仅在 H5 端 App.vue template 挂载时需要
// #ifdef H5
import GlobalLoading from './components/GlobalLoading.vue';
import AppPopup from './components/AppPopup.vue';
// #endif
import popupManager from './utils/popupManager';

const userStore = useUserStore();
const noticeStore = useNoticeStore();

onLaunch(async () => {
  try {
    const sysInfo = uni.getSystemInfoSync();
    const statusBarHeight = sysInfo.statusBarHeight || 0;
    // #ifdef H5
    document.documentElement.style.setProperty('--status-bar-height', statusBarHeight + 'px');
    // #endif
    // #ifndef H5
    // 小程序端 uni-app 自动注入 --status-bar-height，无需手动设置
    // #endif
  } catch (e) {}

  userStore.init();
  await popupManager.init();
  // 登录后拉取未读消息与首页公告
  if (userStore.isLoggedIn) {
    noticeStore.fetchUnreadCount().catch(() => {});
    noticeStore.fetchAnnouncements('home').catch(() => {});
  }
});

onShow(() => {
  // 切前台刷新弹窗配置
  popupManager.init();
  // 切前台刷新未读数
  if (userStore.isLoggedIn) {
    noticeStore.fetchUnreadCount().catch(() => {});
    noticeStore.fetchAnnouncements('home').catch(() => {});
  }
});
</script>

<style lang="scss">
.app-root {
  min-height: 100vh;
}

/* 全局样式 - 治愈系 pastel 风格 */
/* #ifdef H5 */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}
/* #endif */

/* #ifdef MP-WEIXIN */
/* 小程序不支持 * / html / body 选择器，用内置组件枚举替代（避免 WXSS 编译报错 unexpected token '*'） */
page, view, text, input, textarea, button, image, scroll-view, swiper, picker, video, canvas, cover-view, form, label {
  box-sizing: border-box;
}
/* #endif */

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
/* #ifdef H5 */
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
/* #endif */

/* #ifdef MP-WEIXIN */
/* 小程序原生 scroll-view 高度（无 uni-scroll-view 组件） */
scroll-view {
  height: 100%;
}
/* #endif */

/* toast 默认过窄，长文案（如运动结束提示）换行难看，整体加宽 40px */
.uni-sample-toast {
  width: auto !important;
  min-width: 255px !important;
  max-width: 86% !important;
}
</style>