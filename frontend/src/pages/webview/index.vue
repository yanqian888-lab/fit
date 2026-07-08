<template>
  <view class="webview-page">
    <web-view v-if="url" :src="url" />
    <view v-else class="empty-tip">链接无效</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const url = ref('');

onLoad((options) => {
  const raw = options?.url || '';
  url.value = decodeURIComponent(raw);
});
</script>

<style scoped>
.webview-page {
  width: 100vw;
  height: 100vh;
}
.empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #999;
}
</style>
