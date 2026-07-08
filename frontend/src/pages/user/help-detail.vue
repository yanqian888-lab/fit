<template>
  <AppPage>
    <AppHeader title="问题详情" />
    <view class="help-detail-page">
      <view class="detail-card">
        <text class="detail-title">{{ title }}</text>
        <text class="detail-content">{{ content }}</text>
      </view>
      <view class="related-card">
        <text class="card-title">还没解决？</text>
        <AppButton block type="primary" @click="goFeedback">提交意见反馈</AppButton>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const title = ref('');
const content = ref('');

onMounted(() => {
  const pages = getCurrentPages();
  const query = pages[pages.length - 1].$page?.options || {};
  title.value = decodeURIComponent(query.title || '');
  content.value = decodeURIComponent(query.content || '');
});

function goFeedback() {
  uni.navigateTo({ url: '/pages/user/feedback' });
}
</script>

<style lang="scss" scoped>
.help-detail-page {
  padding-top: $spacing-md;
}

.detail-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.detail-title {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.detail-content {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.8;
}

.related-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;
}

.card-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}
</style>
