<template>
  <view class="app-list-item" :class="{ clickable }" @click="onClick">
    <view class="item-left">
      <view v-if="icon" class="item-icon" :style="{ background: iconBg }">
        <text>{{ icon }}</text>
      </view>
      <view class="item-info">
        <text class="item-title">{{ title }}</text>
        <text v-if="subtitle" class="item-subtitle">{{ subtitle }}</text>
      </view>
    </view>
    <view class="item-right">
      <text v-if="extra" class="item-extra">{{ extra }}</text>
      <text v-if="arrow" class="item-arrow">›</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  iconBg: { type: String, default: '$mint-light' },
  extra: { type: String, default: '' },
  arrow: { type: Boolean, default: true },
  clickable: { type: Boolean, default: true }
});

const emit = defineEmits(['click']);

function onClick() {
  if (props.clickable) emit('click');
}
</script>

<style lang="scss" scoped>
.app-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
}

.app-list-item:last-child {
  border-bottom: none;
}

.app-list-item.clickable:active {
  opacity: 0.7;
}

.item-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.item-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-sm;
  font-size: 36rpx;
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-title {
  font-size: $text-base;
  color: $text-primary;
  font-weight: $font-medium;
}

.item-subtitle {
  font-size: $text-sm;
  color: $text-tertiary;
  margin-top: 4rpx;
}

.item-right {
  display: flex;
  align-items: center;
}

.item-extra {
  font-size: $text-sm;
  color: $text-tertiary;
  margin-right: 8rpx;
}

.item-arrow {
  font-size: 36rpx;
  color: $gray-300;
  font-weight: $font-light;
}
</style>
