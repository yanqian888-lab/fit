<template>
  <!-- 外层：固定 100vh，作为 absolute 的定位参照 -->
  <view class="onboarding-page">
    <view class="slide-wrap">
      <!-- 引导内容：纯文本+表情，不加载大图，控制包体 -->
      <view class="slide-emoji">{{ pages[current].emoji }}</view>
      <text class="slide-title">{{ pages[current].title }}</text>
      <text class="slide-subtitle">{{ pages[current].subtitle }}</text>
      <image class="slide-mascot" src="/static/image/icon/dada02@3x.png" mode="aspectFit" />
    </view>

    <!-- 指示器：fixed 相对于视口，永远可见不消失，容器透明 -->
    <view class="dots-overlay">
      <view
        v-for="(_, index) in pages"
        :key="index"
        class="dot"
        :class="{ active: current === index }"
      ></view>
    </view>

    <!-- 按钮：fixed 相对于视口，永远可见不消失，容器透明 -->
    <view class="actions-overlay">
      <AppButton v-if="current < pages.length - 1" type="ghost" block @click="next">下一步</AppButton>
      <AppButton v-else block @click="finish">开始体验</AppButton>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import AppButton from '../../components/AppButton.vue';

const current = ref(0);
// 引导内容（与原引导图一致，改为轻量文本版，删除大图控制包体）
const pages = [
  { emoji: '🎯', title: '虚拟伙伴“搭搭”', subtitle: '陪你健康减脂，追赶目标' },
  { emoji: '🍳', title: '游戏化激励闭环', subtitle: '喂食、互动、事件，让坚持上瘾' },
  { emoji: '💬', title: '对话即记录', subtitle: 'AI 智能沉淀，零负担记录' }
];

/**
 * 下一步：切换到下一张引导
 */
function next() {
  if (current.value < pages.length - 1) {
    current.value++;
  }
}

/**
 * 完成：标记引导已完成并跳转到资料设置页
 */
function finish() {
  const settings = uni.getStorageSync('settings') || {};
  settings.guide_completed = true;
  uni.setStorageSync('settings', settings);
  uni.redirectTo({ url: '/pages/profile/setup' });
}
</script>

<style lang="scss" scoped>
.onboarding-page {
  position: relative;
  height: 100vh;
  width: 100%;
  background: linear-gradient(180deg, #DFF2D8 0%, #FFFFF2 70%);
}

.slide-wrap {
  position: absolute;
  top: 18vh;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 60rpx;
}

.slide-emoji {
  font-size: 110rpx;
  margin-bottom: 48rpx;
}

.slide-title {
  font-size: 52rpx;
  font-weight: 700;
  color: #2E4A24;
  text-align: center;
  line-height: 1.4;
}

.slide-subtitle {
  margin-top: 20rpx;
  font-size: 30rpx;
  color: #5A7250;
  text-align: center;
}

.slide-mascot {
  margin-top: 60rpx;
  width: 320rpx;
  height: 320rpx;
}

/* 指示器 */
.dots-overlay {
  position: fixed;
  bottom: 220rpx;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 16rpx;
  pointer-events: none;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: rgba(90, 114, 80, 0.25);
  transition: all 0.3s;
}

.dot.active {
  width: 40rpx;
  border-radius: 8rpx;
  background: #8DBB77;
}

/* 按钮 */
.actions-overlay {
  position: fixed;
  bottom: 90rpx;
  left: 60rpx;
  right: 60rpx;
}
</style>
