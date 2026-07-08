<template>
  <view class="app-header" :style="{ background: headerBg }">
    <view class="header-left">
      <view v-if="showBack" class="back-btn" @click="onBack">
        <text class="back-icon">‹</text>
      </view>
    </view>
    <text class="header-title">{{ title }}</text>
    <view class="header-right">
      <slot name="right"></slot>
    </view>
  </view>
</template>

<script setup>
import { goBack } from '../utils/navigate';

const props = defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: true },
  headerBg: { type: String, default: '#FFFFFF' }
});

const emit = defineEmits(['back']);

function onBack() {
  emit('back');
  if (props.showBack) {
    goBack('/pages/index/index');
  }
}
</script>

<style lang="scss" scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 100rpx $spacing-md 24rpx;
  background: $white;
}

.header-left,
.header-right {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.header-right {
  justify-content: flex-end;
}

.back-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-card;
}

.back-icon {
  font-size: 40rpx;
  color: $text-primary;
  font-weight: $font-bold;
  line-height: 1;
  margin-left: -4rpx;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
}
</style>
