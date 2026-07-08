<template>
  <AppPage>
    <view class="guide-page">
      <text class="guide-title">功能引导</text>
      <view class="guide-list">
        <view v-for="(item, index) in guides" :key="index" class="guide-card">
          <text class="guide-icon">{{ item.icon }}</text>
          <view class="guide-info">
            <text class="guide-name">{{ item.name }}</text>
            <text class="guide-desc">{{ item.desc }}</text>
          </view>
        </view>
      </view>
      <AppButton block size="lg" @click="finish">我知道了</AppButton>
    </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import AppButton from '../../components/AppButton.vue';
import { systemApi } from '../../api';

const guides = [
  { icon: '💬', name: '和搭子聊天', desc: '像朋友一样聊天，饮食运动自动记录' },
  { icon: '📊', name: '查看记录', desc: '今日摄入、消耗、体重一目了然' },
  { icon: '🏛️', name: '博物馆', desc: '金句、食谱、感悟自动沉淀成专属纪念' },
  { icon: '⚙️', name: '个人设置', desc: '修改资料、搭子性格、隐私和数据管理' }
];

async function finish() {
  try {
    await systemApi.updateSettings({ guide_completed: 1 });
    uni.setStorageSync('settings', { guide_completed: 1 });
  } catch (err) {
    console.error(err);
  }
  uni.switchTab({ url: '/pages/index/index' });
}
</script>

<style lang="scss" scoped>
.guide-page {
  padding-top: 100rpx;
}

.guide-title {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-lg;
}

.guide-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin-bottom: $spacing-lg;
}

.guide-card {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;
}

.guide-icon {
  font-size: 56rpx;
  margin-right: $spacing-md;
}

.guide-info {
  flex: 1;
}

.guide-name {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: 6rpx;
}

.guide-desc {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
}
</style>
