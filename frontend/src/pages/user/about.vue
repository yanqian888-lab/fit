<template>
  <AppPage :showHeader="true" title="关于我们">
    <view class="about-page">
      <view class="about-card">
        <block v-if="aboutContent">
          <text v-for="(paragraph, index) in paragraphs" :key="index" class="about-text">{{ paragraph }}</text>
        </block>
        <text v-else class="about-text">暂无内容</text>
      </view>

    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import { get } from '../../utils/request';

const aboutContent = ref('');

const paragraphs = computed(() => {
  return aboutContent.value.split(/\n+/).filter(p => p.trim());
});

onMounted(async () => {
  try {
    const res = await get('/app-config');
    aboutContent.value = res.data?.about_us_content || '';
  } catch (e) {
    console.error('获取关于我们配置失败', e);
  }
});
</script>

<style lang="scss" scoped>
.about-page {
  position: relative;
  z-index: 1;
  padding-top: $spacing-md;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.about-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}

.about-text {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.8;
  display: block;
  margin-bottom: $spacing-md;
}

.about-text:last-child {
  margin-bottom: 0;
}
</style>
