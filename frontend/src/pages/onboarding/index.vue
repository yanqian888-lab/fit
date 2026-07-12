<template>
  <view class="onboarding-page">
    <swiper class="swiper" :current="current" @change="onChange">
      <swiper-item v-for="(page, index) in pages" :key="index">
        <view class="page-content">
          <text class="page-icon">{{ page.icon }}</text>
          <text class="page-title">{{ page.title }}</text>
          <text class="page-desc">{{ page.desc }}</text>
        </view>
      </swiper-item>
    </swiper>

    <view class="dots">
      <view v-for="(_, index) in pages" :key="index" class="dot" :class="{ active: current === index }"></view>
    </view>

    <view class="actions">
      <AppButton v-if="current < pages.length - 1" type="ghost" block @click="next">下一步</AppButton>
      <AppButton v-else block @click="finish">开始体验</AppButton>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import AppButton from '../../components/AppButton.vue';

const current = ref(0);
const pages = [
  { icon: '🤖', title: 'AI 减肥搭子', desc: '不是冰冷教练，而是真实有情绪的减肥伙伴，陪你一起瘦下来' },
  { icon: '💬', title: '聊天即记录', desc: '只要和搭子聊天，饮食、运动、体重数据自动沉淀到今日记录' },
  { icon: '🏛️', title: '博物馆', desc: '自动整理你的金句、食谱、感悟，生成专属减肥纪念墙' }
];

function onChange(e) {
  current.value = e.detail.current;
}

function next() {
  current.value++;
}

function finish() {
  const settings = uni.getStorageSync('settings') || {};
  settings.guide_completed = true;
  uni.setStorageSync('settings', settings);
  uni.redirectTo({ url: '/pages/profile/setup' });
}
</script>

<style lang="scss" scoped>
.onboarding-page {
  height: 100vh;
  background: linear-gradient(180deg, $mint-light 0%, $bg-page 60%, $bg-page 100%);
  display: flex;
  flex-direction: column;
}

.swiper {
  flex: 1;
}

.page-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
}

.page-icon {
  font-size: 140rpx;
  margin-bottom: $spacing-lg;
}

.page-title {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

.page-desc {
  font-size: $text-base;
  color: $text-secondary;
  text-align: center;
  line-height: 1.6;
  font-weight: $font-light;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  margin-bottom: $spacing-md;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $gray-300;
  transition: all 0.2s ease;
}

.dot.active {
  width: 40rpx;
  border-radius: $radius-pill;
  background: $green;
}

.actions {
  padding: 0 $spacing-md;
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.skip {
  display: block;
  text-align: center;
  margin-top: $spacing-md;
  font-size: $text-sm;
  color: $text-tertiary;
}
</style>
