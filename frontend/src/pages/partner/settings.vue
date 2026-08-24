<template>
  <AppPage>
    <view class="header-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">搭子设置</text>
      <view class="header-right"></view>
    </view>
    <view class="partner-settings">
      <view class="partner-card">
        <image class="partner-avatar" :src="partnerAvatarUrl" mode="aspectFill" />
        <view class="partner-info">
          <view class="name-edit-row">
            <!-- 搭子名字固定为「搭搭」，不提供修改入口 -->
            <text class="partner-name-text">搭搭</text>
          </view>
          <text class="partner-mode">当前模式：{{ modeLabel }}</text>
        </view>
      </view>

      <view class="mode-card">
        <text class="card-title">切换搭子模式</text>
        <view class="mode-list">
          <view
            v-for="mode in modes"
            :key="mode.value"
            class="mode-item"
            :class="{ active: currentMode === mode.value }"
            @click="selectMode(mode.value)"
          >
            <image class="mode-icon" :src="mode.avatar" mode="aspectFill" />
            <view class="mode-text">
              <text class="mode-name">{{ mode.label }}</text>
              <text class="mode-desc">{{ mode.desc }}</text>
            </view>
            <text v-if="currentMode === mode.value" class="check">✓</text>
          </view>
        </view>
      </view>


    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { partnerApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import { goBack } from '../../utils/navigate';

const statusBarHeight = ref(44);
try {
  statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 44;
} catch (e) {}

const partner = ref({});
const currentMode = ref('gentle');

const modes = [
  { value: 'gentle', label: '温柔模式', icon: '🌸', avatar: '/static/image/icon/rou.png', desc: '像朋友一样鼓励你，适合需要陪伴感' },
  { value: 'strict', label: '严格模式', icon: '💪', avatar: '/static/image/icon/zhuan.png', desc: '目标导向，监督打卡不手软' },
  { value: 'tease', label: '毒舌模式', icon: '😏', avatar: '/static/image/icon/sun.png', desc: '直接犀利不留情面，扎心但有效' }
];

const partnerAvatarUrl = computed(() => {
  const map = {
    gentle: '/static/image/icon/rou.png',
    strict: '/static/image/icon/zhuan.png',
    tease: '/static/image/icon/sun.png'
  };
  return map[currentMode.value] || '/static/image/icon/rou.png';
});

const modeLabel = computed(() => {
  const m = modes.find(item => item.value === currentMode.value);
  return m ? m.label : currentMode.value;
});

onMounted(async () => {
  try {
    const res = await partnerApi.getPartner();
    partner.value = res.data || {};
    currentMode.value = partner.value.mode || 'gentle';
  } catch (err) {
    console.error(err);
  }
});

async function selectMode(mode) {
  if (mode === currentMode.value) return;
  try {
    await partnerApi.switchMode(mode);
    currentMode.value = mode;
    uni.showToast({ title: '切换成功', icon: 'success' });
  } catch (err) {
    uni.showToast({ title: '切换失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.partner-settings {
  position: relative;
  z-index: 1;
  padding-top: $spacing-md;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 360rpx;
  background: linear-gradient(180deg, #DDF2D2 0%, #F7FbF4 100%);
  z-index: 0;
}

.status-bar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx 24rpx;
  flex-shrink: 0;
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

.partner-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  display: flex;
  align-items: center;
  margin: 0 $spacing-md $spacing-md;
  box-shadow: $shadow-card;
  color: $text-primary;
}

.partner-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: $spacing-md;
  background: $mint-light;
}

.name-edit-row {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.partner-name-text {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
}

.partner-mode {
  font-size: $text-sm;
  color: $text-secondary;
  font-weight: $font-light;
}

.mode-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin: 0 $spacing-md $spacing-md;
  box-shadow: $shadow-card;
}

.card-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.mode-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.mode-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-radius: $radius-lg;
  background: $gray-50;
  border: 2rpx solid transparent;
}

.mode-item.active {
  background: $mint-light;
  border-color: $mint;
}

.mode-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: $gray-100;
  margin-right: $spacing-md;
  flex-shrink: 0;
}

.mode-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mode-name {
  font-size: $text-base;
  font-weight: $font-semibold;
  color: $text-primary;
  margin-bottom: 6rpx;
}

.mode-desc {
  font-size: $text-xs;
  color: $text-secondary;
}

.check {
  color: $mint-dark;
  font-size: $text-lg;
  font-weight: $font-bold;
}


</style>
