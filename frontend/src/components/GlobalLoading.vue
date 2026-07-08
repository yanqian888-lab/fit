<template>
  <view v-if="visible" class="global-loading-mask">
    <view class="global-loading-box">
      <image class="global-loading-icon" src="/static/image/icon/loading02.svg" mode="aspectFit" />
      <text v-if="text" class="global-loading-text">{{ text }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const visible = ref(false);
const text = ref('');
let timer = null;

function show(options = {}) {
  if (timer) clearTimeout(timer);
  text.value = options.text || '';
  // 超过 2 秒仍未隐藏才显示
  timer = setTimeout(() => {
    visible.value = true;
  }, options.delay || 2000);
}

function hide() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  visible.value = false;
}

onMounted(() => {
  uni.$on('global-loading-show', show);
  uni.$on('global-loading-hide', hide);
});

onUnmounted(() => {
  uni.$off('global-loading-show', show);
  uni.$off('global-loading-hide', hide);
});
</script>

<style lang="scss" scoped>
.global-loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.global-loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}

.global-loading-icon {
  width: 80rpx;
  height: 80rpx;
  animation: global-spin 1s linear infinite;
}

.global-loading-text {
  font-size: 28rpx;
  color: $text-secondary;
}

@keyframes global-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
