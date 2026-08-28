<template>
  <AppPage fixed :showHeader="true" title="隐私政策">
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
