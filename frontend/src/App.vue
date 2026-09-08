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

<script>
// =====================================================================
// 【友盟+ U-Mini 小程序统计埋点】文档：https://developer.umeng.com/docs/147615/detail/147619
// SDK 原理：import 时即 hook 全局 App() 构造器，从 App() 参数对象上读取 umengConfig 完成初始化。
// 因此 umengConfig 必须写在普通 <script> 的 export default 对象上（<script setup> 的顶层
// 变量不会进入 App() 参数），随 App.vue 编译进产物 app.js，满足"app.js 顶部引入"的官方要求。
//
// 【uni-app Vue3 兼容补丁】uni-app 的 App 构造器 Mc(e) 内部会调用 gc(e) 转换配置对象，
// gc() 只保留 uni-app 认识的属性（globalData/onLaunch 等），会丢弃 umengConfig；
// 导致 SDK 的 App hook 第二次进入时拿到的是 gc(c)，ae.init(undefined) 报错
// "请正确设置相关信息"。因此在 onLaunch 里手动调用 wx.uma.init(UMENG_CONFIG) 兜底，
// SDK 自动 init 失败后 _inited 仍为 false，手动 init 可正常执行。
// =====================================================================
// 友盟统计配置（模块级常量，必须在 import 之前定义，供 import 后立即初始化使用）
const UMENG_CONFIG = {
  appKey: '6a9c080bd5481f0b42ee2c4c', // 友盟+分配的 AppKey
  // 采用官方「方案3」：useOpenid 开启用户标识，但关闭友盟自动获取（autoGetOpenid:false），
  // 由业务后端 code2session 拿到 openid 后，前端在登录/启动同步用户信息时
  // 调用 wx.uma.setOpenid(openid) 上报（见 utils/umeng.js + store/index.js），
  // 不依赖友盟后台 AppSecret 配置，链路更可控
  useOpenid: true,
  autoGetOpenid: false,
  debug: process.env.NODE_ENV !== 'production', // 开发调试开启日志，生产构建自动关闭
  uploadUserInfo: false // 不自动上报头像昵称，避免触发用户授权弹窗
};

// #ifdef MP-WEIXIN
import 'umtrack-wx';
// import 完成后 SDK 已把 ae 挂到全局 wx.uma，立即用正确配置初始化，
// 让 SDK 内部 _inited 提前置 true；后续 uni-app gc() 触发的 App hook
// 再调 ae.init(undefined) 时会被 _inited 拦截，避免"请正确设置相关信息"报错。
try {
  const __wx = (typeof globalThis !== 'undefined' && globalThis['wx']) || null;
  const __uma = __wx && __wx.uma;
  if (__uma && typeof __uma.init === 'function' && !__uma._inited) {
    __uma.init(UMENG_CONFIG);
  }
} catch (e) {
  console.warn('[umeng] import 阶段初始化失败，将在 onLaunch 重试', e);
}
// #endif

export default {
  // #ifdef MP-WEIXIN
  umengConfig: UMENG_CONFIG
  // #endif
};
</script>

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
import { getWindowInfoSafe } from './utils/systemInfo';

const userStore = useUserStore();
const noticeStore = useNoticeStore();

onLaunch(async () => {
  // #ifdef MP-WEIXIN
  // 【友盟兜底初始化】uni-app gc() 会丢弃 umengConfig，SDK 自动 init 可能失败，
  // 此处手动传入正确配置；SDK 内部 _inited 标记会防止重复初始化。
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : null;
    const nativeWx = g ? g['wx'] : null;
    const uma = nativeWx && nativeWx.uma;
    if (uma && typeof uma.init === 'function' && !uma._inited) {
      uma.init(UMENG_CONFIG);
    }
  } catch (e) {
    console.warn('[umeng] 手动初始化失败', e);
  }

  // 隐藏原生 tabBar（只留自绘的 CustomTabBar 圆形凸起组件）
  // 临时注释 hideTabBar 验证：它会破坏原生 tabBar 状态机导致 switchTab 失败
  // uni.hideTabBar({ animation: false });

  // 开启右上角菜单"转发给朋友"和"分享到朋友圈"入口
  // 具体分享内容由 main.js 全局 mixin 的 onShareAppMessage / onShareTimeline 提供
  try {
    if (typeof wx !== 'undefined' && wx.showShareMenu) {
      wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    }
  } catch (e) {}
  // #endif
  try {
    const sysInfo = getWindowInfoSafe();
    const statusBarHeight = sysInfo.statusBarHeight || 0;
    // #ifdef H5
    document.documentElement.style.setProperty('--status-bar-height', statusBarHeight + 'px');
    // #endif
    // #ifndef H5
    // 小程序端 uni-app 自动注入 --status-bar-height，无需手动设置
    // #endif
  } catch (e) {}

  userStore.init();
  
  // 【优化】popupManager.init() 改为登录后才初始化，避免在未登录态请求登录态接口
  // 原因：popupApi.getConfigList() 已改为需要登录态，未登录时无需拉取弹窗配置
  if (userStore.isLoggedIn) {
    setTimeout(async () => {
      try {
        await popupManager.init();
      } catch (e) {
        // 静默捕获，不影响主流程
        console.warn('[popupManager] 初始化失败，将使用本地缓存配置', e?.message || e);
      }
    }, 500);
  }
  
  // 登录后拉取未读消息与首页公告
  if (userStore.isLoggedIn) {
    noticeStore.fetchUnreadCount().catch(() => {});
    noticeStore.fetchAnnouncements('home').catch(() => {});
  }
});

onShow(() => {
  // 切前台时不再重复调用 popupManager.init()，避免并发请求导致的渲染层错误
  // popupManager.init() 已在 onLaunch 中调用一次即可
  if (userStore.isLoggedIn) {
    setTimeout(() => {
      noticeStore.fetchUnreadCount().catch(() => {});
      noticeStore.fetchAnnouncements('home').catch(() => {});
    }, 500);
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

/* 安全区 */
.safe-area-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 页面容器 */
.app-page {
  min-height: 100vh;
  background: $bg-page;
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