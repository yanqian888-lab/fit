<template>
  <AppPage fixed>
    <view class="page-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">隐私政策</text>
      <view class="header-right"></view>
    </view>
    <scroll-view class="content-scroll" scroll-y>
      <view class="content-wrapper">
        <view class="content-card">
          <text v-for="(paragraph, index) in paragraphs" :key="index" class="paragraph">
            {{ paragraph }}
          </text>
        </view>
      </view>
    </scroll-view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import { configApi } from '../../api';
import { goBack } from '../../utils/navigate';

const statusBarHeight = ref(44);
try {
  statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 44;
  // #ifdef MP-WEIXIN
  statusBarHeight.value += 44; // 小程序胶囊高度
  // #endif
} catch (e) {}

const privacyPolicy = ref('');

const paragraphs = computed(() => {
  return privacyPolicy.value
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
});

onMounted(async () => {
  try {
    const res = await configApi.getAppConfig();
    privacyPolicy.value = res.data?.privacy_policy || '';
  } catch (err) {
    console.error('获取隐私政策失败:', err);
  }
});
</script>

<style lang="scss" scoped>
.page-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #DDF2D2 0%, #F7FbF4 360rpx, #F7FbF4 100%);
  z-index: 0;
}

.status-bar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.page-header {
  /* #ifdef MP-WEIXIN */
  margin-top: -88rpx; /* 标题/返回按钮上移到胶囊所在顶部栏 */
  /* #endif */
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx 24rpx;
  flex-shrink: 0;
}

.content-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  padding: $spacing-md $spacing-md calc(140rpx + env(safe-area-inset-bottom));
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 48rpx;
  color: #27282D;
  font-weight: 700;
  line-height: 1;
  margin-left: -4rpx;
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 40rpx;
}

.content-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}

.paragraph {
  display: block;
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.8;
  margin-bottom: $spacing-md;
}

.paragraph:last-child {
  margin-bottom: 0;
}
</style>
