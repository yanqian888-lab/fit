<template>
  <AppPage>
    <AppHeader title="快速记录" />
    <view class="quick-page">
      <view class="quick-grid">
        <view
          v-for="item in items"
          :key="item.type"
          class="quick-card"
          :style="{ background: item.bg }"
          @click="goRecord(item)"
        >
          <text class="quick-icon">{{ item.icon }}</text>
          <text class="quick-label">{{ item.label }}</text>
        </view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';

const items = [
  { type: 'diet', label: '记录饮食', icon: '🍚', bg: '#E8F5FF', url: '/pages/record/add-food?meal=lunch' },
  { type: 'exercise', label: '记录运动', icon: '🏃', bg: '#E8F5FF', url: '/pages/record/add-exercise' },
  { type: 'weight', label: '记录体重', icon: '⚖️', bg: '#FFF0F3', url: '/pages/record/body-data' },
  { type: 'water', label: '记录喝水', icon: '💧', bg: '#FFFBE8', url: '/pages/record/body-data?tab=habit' }
];

function goRecord(item) {
  uni.navigateTo({ url: item.url });
}
</script>

<style lang="scss" scoped>
.quick-page {
  padding-top: $spacing-md;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
}

.quick-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg 0;
  border-radius: $radius-xl;
  box-shadow: $shadow-card;
}

.quick-icon {
  font-size: 72rpx;
  margin-bottom: $spacing-sm;
}

.quick-label {
  font-size: $text-base;
  color: $text-primary;
  font-weight: $font-medium;
}
</style>
