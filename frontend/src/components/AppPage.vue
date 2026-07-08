<template>
  <view class="app-page" :class="{ fixed }">
    <slot></slot>
  </view>
</template>

<script setup>
defineProps({
  fixed: { type: Boolean, default: false }
});
</script>

<style lang="scss" scoped>
.app-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
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
