<template>
  <!--
    padCapsuleTop=true  ：给 custom 导航页（4个TabBar首页）预留胶囊+状态栏的顶部 padding，
                         避免内容与右上角胶囊重叠。
    padCapsuleTop=false ：给原生导航的二三级页使用（默认），页面顶部直接紧贴原生导航栏底部。
    showHeader=true     ：风格A（带顶部绿渐变的功能二级页）使用——内置自绘 status-bar +
                          返回键 + 居中标题行，保证渐变从状态栏后开始、不再出现双重导航/下移。
  -->
  <view
    class="app-page"
    :class="{
      fixed,
      'pad-capsule-top': !showHeader && padCapsuleTop,
      'pad-status-bar': !showHeader && padStatusBar
    }"
    :style="[navAlignStyle, pageStyle]"
  >
    <!-- 自绘导航区：仅风格A二级页 showHeader=true 时渲染 -->
    <template v-if="showHeader">
      <!--
        status-bar：标杆样式与 record/index TabBar 完全一致
        - 双行 height 兜底：先 44px 硬基准，再 var(--status-bar-height) 覆盖；
          解决 navigateTo 转场前几帧 var 未注入 → 塌陷 → 内容整体下坠。
        - 浅绿 #F7FbF4 bg：与系统 navigationBarBackgroundColor 一致，避免顶部两层色差。
        - 左右 -32rpx 负 margin：抵消 app-page 子容器的 32rpx 左右 padding，
          让亮绿背景铺满屏幕两侧，解决"透底露出浅色"。
      -->
      <view class="status-bar"></view>
      <!--
        page-header：吸顶标题行，flex 三列布局（back-btn / 居中 title / 右侧占位）
        - back-btn 内置 goBack 函数，双端通用（navigateBack 失败时 fallback 到首页）
      -->
      <view class="page-header">
        <view class="back-btn" @click="goBack" aria-label="返回">
          <text class="back-icon">‹</text>
        </view>
        <text class="page-title">{{ title }}</text>
        <view class="header-right"></view>
      </view>
    </template>
    <slot></slot>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  fixed: { type: Boolean, default: false },
  /**
   * 是否为 TabBar 首页预留胶囊顶部 padding。
   * 注意：当 showHeader=true（风格A二级页自绘导航）时，此选项自动忽略，
   * 因为 status-bar + page-header 已完成顶部占位。
   */
  padCapsuleTop: { type: Boolean, default: false },
  /**
   * 独立引导页专用（setup / select-mode / login / onboarding 等自绘大标题页）：
   * 不渲染自绘返回键 + 标题行，但仍需让出状态栏 + 胶囊区域，
   * 避免内容从屏幕 y=0 开始、顶到右上角胶囊按钮 / 刘海 / 时间状态栏。
   * 使用标杆双行兜底 padding-top，与 showHeader=true 的占位高度严格对齐。
   */
  padStatusBar: { type: Boolean, default: false },
  /** 是否渲染自绘 status-bar + 返回键 + 标题行（风格A二级页使用） */
  showHeader: { type: Boolean, default: false },
  /** showHeader=true 时居中显示的页面标题 */
  title: { type: String, default: '' }
});

// 小程序端 custom 导航时，微信胶囊按钮悬浮在状态栏下方，TabBar 首页内容需要让出胶囊区域
const capsulePadTop = ref(0);
// #ifdef MP-WEIXIN
try {
  const rect = uni.getMenuButtonBoundingClientRect();
  if (rect && rect.bottom) capsulePadTop.value = rect.bottom + 8;
} catch (e) {}
// #endif

/**
 * 自绘导航（showHeader=true）与胶囊按钮上下居中对齐：
 * - status-bar 精确高度 = 胶囊 top（状态栏 + 胶囊上间隙）
 * - page-header 行高 = 胶囊高度，行内 align-items:center 让返回键/标题中心线与胶囊中心线重合
 * - 通过 CSS 变量注入（--nav-status-h / --nav-header-h），非微信端或获取失败时回落 CSS 兜底值
 */
const navAlignStyle = ref('');
// #ifdef MP-WEIXIN
try {
  const menu = uni.getMenuButtonBoundingClientRect ? uni.getMenuButtonBoundingClientRect() : null;
  if (menu && menu.height && menu.top) {
    navAlignStyle.value = `--nav-status-h:${menu.top}px;--nav-header-h:${menu.height}px;`;
  }
} catch (e) {}
// #endif

/**
 * 顶部 padding 计算（仅负责需要 runtime 动态计算的场景，公式写死的走 CSS class 支持标杆双行兜底）：
 * - showHeader=true：自绘导航已占位（status-bar + page-header），不再额外加，避免重复空白下坠
 * - padCapsuleTop=true：TabBar 首页 custom 导航，加 getMenuButtonBoundingClientRect().bottom 胶囊让位 padding（runtime 动态计算，只能 inline style）
 * - padStatusBar=true：独立引导页，CSS 类 .pad-status-bar 已写标杆双行兜底，pageStyle 不再重复处理
 * - 其他（如 AppPage 仅作为纯容器）：不加
 */
const pageStyle = computed(() => {
  if (props.showHeader) return {};
  if (props.padCapsuleTop && capsulePadTop.value) {
    return { paddingTop: capsulePadTop.value + 'px' };
  }
  return {};
});

/**
 * 通用返回函数：双端（小程序 + H5）安全 navigateBack。
 * - 优先走 uni.navigateBack（栈内返回）
 * - 失败（如直接落地当前页无 history）时 fallback 到 TabBar 首页，避免白屏卡死
 */
function goBack() {
  const pages = getCurrentPages();
  if (pages && pages.length > 1) {
    uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/index/index' }) });
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
}
// 暴露给外部（如有需要），但 99% 场景用默认即可
defineExpose({ goBack });
</script>

<style lang="scss" scoped>
.app-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 32rpx;
  padding-bottom: calc(156rpx + env(safe-area-inset-bottom));
  background: $bg-page;
  box-sizing: border-box;
}

/**
 * 独立引导页（padStatusBar=true）标杆双行兜底：
 * - 与 .status-bar height 保持完全同公式，保证所有 custom 页顶部占位严格对齐
 * - 第一行：44px 硬码兜底（旧 iOS/旧基础库 --status-bar-height 未注入时防下坠）
 * - 第二行：var(--status-bar-height,44px) + 88rpx 覆盖第一行，保证各机型真实状态栏高度适配
 */
.app-page.pad-status-bar {
  padding-top: calc(44px + 88rpx);
  padding-top: calc(var(--status-bar-height, 44px) + 88rpx);
}

.app-page.fixed {
  height: 100vh;
  min-height: auto;
  padding: 0 32rpx;
  padding-bottom: 0;
  /* overflow: hidden 已移除：避免裁剪 status-bar/page-header 的负 margin，
     flex 列布局 + height:100vh 已防止页面整体滚动 */
}

/* ================= 风格A二级页自绘导航 ================= */

/**
 * status-bar：标杆样式（来源：pages/record/index.vue .status-bar）
 * - 双行 height 兜底是关键，保证 navigateTo 转场不抖动下坠
 * - 微信端由 navAlignStyle 注入 --nav-status-h（= 胶囊 top，精确到胶囊上沿），与胶囊行无缝衔接
 * - 亮绿 bg 保证渐变起点从 y=0 无缝衔接
 * - 左右负 margin 抵消父级 32rpx padding，拉满不透底
 */
.status-bar {
  height: calc(44px + 88rpx);
  height: var(--nav-status-h, calc(var(--status-bar-height, 44px) + 44rpx));
  background: #F7FbF4;
  margin-left: -32rpx;
  margin-right: -32rpx;
  flex-shrink: 0;
}

/**
 * page-header：吸顶标题行
 * - 与 record/index 的 page-header 保持同色系亮绿背景（通过内部 header-bg 绝对定位）
 * - margin 0 -32rpx 同样抵消父级 padding，横向拉满
 * - 行高微信端 = 胶囊高度（--nav-header-h），返回键/标题 align-items:center 与胶囊上下居中
 * - flex 三列：左返回键（56rpx 定宽）、中标题（flex:1 居中）、右占位（56rpx 定宽平衡居中）
 */
.page-header {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 -32rpx 28rpx;
  height: 88rpx;
  height: var(--nav-header-h, 88rpx);
  padding: 0 32rpx;
  overflow: hidden;
  z-index: 50;
}

/* 亮绿底色绝对定位铺满，与 status-bar 颜色衔接，渐变从 y=0 开始就连续 */
.page-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #F7FbF4;
  z-index: 0;
}

/**
 * 返回按钮：圆形白底 56rpx + 轻投影 + ‹ 40rpx 字
 * - 设计风格与 user/profile 原 profile-back 浮动返回键一致
 */
.back-btn {
  position: relative;
  z-index: 1;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.back-icon {
  font-size: 40rpx;
  line-height: 1;
  color: #563E22;
  font-weight: 600;
  /* ‹ 字符视觉偏右，-2rpx 微调让视觉居中 */
  margin-left: -2rpx;
}

/**
 * 页面标题：flex:1 占中间列，居中显示
 * - 字号 36rpx / 字重 700 / 深棕 #563E22，与聊聊页头部标题风格保持一致
 * - relative z-index:1 确保文字在 ::before 底色之上
 */
.page-title {
  position: relative;
  z-index: 1;
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #563E22;
  /* 防止超长标题换行破坏布局 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/**
 * 右侧占位：与左侧 back-btn 等宽 56rpx，
 * 保证中间 title 在视觉上严格居中（否则左重右轻，标题会偏右 28rpx）
 */
.header-right {
  width: 56rpx;
  height: 56rpx;
  flex-shrink: 0;
}
</style>
