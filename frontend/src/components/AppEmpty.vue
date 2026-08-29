<template>
  <view class="app-empty" :class="{ full }">
    <image v-if="imageUrl" class="empty-image" :src="imageUrl" mode="aspectFit" />
    <text v-else class="empty-icon">{{ icon }}</text>
    <text v-if="title" class="empty-title">{{ title }}</text>
    <text v-if="subtitle" class="empty-subtitle">{{ subtitle }}</text>
    <text v-else-if="text" class="empty-text">{{ text }}</text>
    <slot />
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { resolveStaticUrl } from '../utils/environment.js';

const props = defineProps({
  text: { type: String, default: '暂无内容' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '📭' },
  image: { type: String, default: '' },
  full: { type: Boolean, default: false }
});

/** 空状态图片：支持相对路径自动解析为远程 CDN 地址 */
const imageUrl = computed(() => resolveStaticUrl(props.image));
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
