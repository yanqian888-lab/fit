<template>
  <view class="load-more">
    <text v-if="loading">加载中...</text>
    <text v-else-if="hasMore">上拉加载更多</text>
    <text v-else-if="showNoMore" class="no-more">没有更多了</text>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  hasMore: { type: Boolean, default: true },
  showNoMore: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
});
</script>

<style lang="scss" scoped>
.load-more {
  text-align: center;
  padding: $spacing-md 0;
  font-size: $text-sm;
  color: $text-tertiary;
  font-weight: $font-light;
}

.no-more {
  color: $text-tertiary;
}
</style>
