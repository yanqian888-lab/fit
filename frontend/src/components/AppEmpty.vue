<template>
  <view class="app-empty" :class="{ full }">
    <image v-if="image" class="empty-image" :src="image" mode="aspectFit" />
    <text v-else class="empty-icon">{{ icon }}</text>
    <text v-if="title" class="empty-title">{{ title }}</text>
    <text v-if="subtitle" class="empty-subtitle">{{ subtitle }}</text>
    <text v-else-if="text" class="empty-text">{{ text }}</text>
    <slot />
  </view>
</template>

<script setup>
defineProps({
  text: { type: String, default: '暂无内容' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '📭' },
  image: { type: String, default: '' },
  full: { type: Boolean, default: false }
});
</script>

<style lang="scss" scoped>
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.app-empty.full {
  flex: 1;
  padding: 96rpx 0 120rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: $spacing-sm;
  opacity: 0.6;
}

.empty-image {
  width: 320rpx;
  height: 320rpx;
  margin-bottom: $spacing-md;
}

.empty-title {
  font-size: $text-lg;
  font-weight: $font-medium;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.empty-subtitle {
  font-size: $text-sm;
  color: $text-tertiary;
  font-weight: $font-light;
}

.empty-text {
  font-size: $text-base;
  color: $text-tertiary;
  font-weight: $font-light;
}
</style>
