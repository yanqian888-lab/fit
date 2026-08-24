<template>
  <view class="app-page" :class="{ fixed }" :style="pageStyle">
    <slot></slot>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

defineProps({
  fixed: { type: Boolean, default: false }
});

// 小程序端自定义导航时，微信胶囊按钮悬浮在状态栏下方，内容需要让出胶囊区域
const capsulePadTop = ref(0);
// #ifdef MP-WEIXIN
try {
  const rect = uni.getMenuButtonBoundingClientRect();
  if (rect && rect.bottom) capsulePadTop.value = rect.bottom + 8;
} catch (e) {}
// #endif

const pageStyle = computed(() => capsulePadTop.value ? { paddingTop: capsulePadTop.value + 'px' } : {});
</script>

<style lang="scss" scoped>
.app-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(156rpx + env(safe-area-inset-bottom));
  background: $bg-page;
  box-sizing: border-box;
}

.app-page.fixed {
  height: 100vh;
  min-height: auto;
  padding-bottom: 0;
  overflow: hidden;
}
</style>
