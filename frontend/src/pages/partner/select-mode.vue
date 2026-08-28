<template>
  <!-- 独立引导页：不要自绘返回键居中标题，但要让出状态栏+胶囊 → padStatusBar=true（标杆双行兜底） -->
  <AppPage :padStatusBar="true">
    <view class="select-mode-page">
      <view class="page-header">
        <text class="page-title">选择搭子模式</text>
        <text class="page-subtitle">三种性格，随时切换，找到最适合你的陪伴方式</text>
      </view>

      <view class="mode-list">
        <view
          v-for="mode in modes"
          :key="mode.value"
          class="mode-card"
          :class="{ active: selected === mode.value }"
          :style="{ borderColor: selected === mode.value ? mode.color : 'transparent' }"
          @click="selected = mode.value"
        >
          <view class="mode-icon" :style="{ background: mode.color + '20' }">
            <image class="mode-avatar" :src="mode.avatar" mode="aspectFit" />
          </view>
          <view class="mode-info">
            <text class="mode-name">{{ mode.label }}</text>
            <text class="mode-desc">{{ mode.desc }}</text>
          </view>
          <view v-if="selected === mode.value" class="check" :style="{ background: mode.color }">
            <text>✓</text>
          </view>
        </view>
      </view>

      <view class="preview-card">
        <text class="preview-label">对话预览</text>
        <text class="preview-text">{{ preview }}</text>
      </view>

      <AppButton block size="lg" :loading="loading" @click="submit">开启减肥之旅</AppButton>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useUserStore } from '../../store';
import { partnerApi, systemApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppButton from '../../components/AppButton.vue';
import { safeSwitchTab } from '../../utils/safeSwitchTab';

const userStore = useUserStore();
const selected = ref('gentle');
const loading = ref(false);

const modes = [
  { value: 'gentle', label: '温柔鼓励型', desc: '永远先安慰，再鼓励，绝不批评', emoji: '🌸', color: '#B5E2FF', avatar: '/static/image/icon/rou.png' },
  { value: 'strict', label: '严格监督型', desc: '坚定直接，该严格时绝不心软', emoji: '💪', color: '#B5E2FF', avatar: '/static/image/icon/zhuan.png' },
  { value: 'tease', label: '毒舌模式', desc: '直接犀利不留情面，扎心但有效', emoji: '😏', color: '#FFD6E0', avatar: '/static/image/icon/sun.png' }
];

const previews = {
  gentle: '“没关系的，偶尔放纵一下很正常呀，明天稍微控制一下就好啦～”',
  strict: '“又偷吃？你忘了你的目标吗？现在立刻去喝一杯水！”',
  tease: '“一口奶茶≈跑步半小时，你这一口跑得真贵。”'
};

const preview = computed(() => previews[selected.value]);

async function submit() {
  loading.value = true;
  try {
    await partnerApi.switchMode(selected.value);
    await systemApi.updateSettings({ guide_completed: 1 });
    await userStore.fetchUserInfo();
    uni.setStorageSync('settings', { guide_completed: 1 });
    safeSwitchTab('/pages/index/index');
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '设置失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.select-mode-page {
  /* 自绘导航删除后，顶部已由 AppPage 贴原生导航栏底部，不再需要额外 top padding */
}

.page-header {
  margin-bottom: $spacing-lg;
}

.page-title {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
}

.page-subtitle {
  font-size: $text-sm;
  color: $text-tertiary;
  margin-top: 8rpx;
  display: block;
  font-weight: $font-light;
}

.mode-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.mode-card {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;
  border: 2rpx solid transparent;
  position: relative;
}

.mode-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-right: $spacing-md;
  overflow: hidden;
}

.mode-avatar {
  width: 84rpx;
  height: 84rpx;
}

.mode-info {
  flex: 1;
}

.mode-name {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: 6rpx;
}

.mode-desc {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
}

.check {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $white;
  font-size: $text-sm;
}

.preview-card {
  background: $cream-light;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-lg;
}

.preview-label {
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;
}

.preview-text {
  font-size: $text-base;
  color: $text-primary;
  line-height: 1.6;
}
</style>
