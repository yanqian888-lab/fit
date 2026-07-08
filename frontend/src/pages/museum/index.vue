<template>
  <view class="museum-page">
    <view class="status-bar"></view>

    <view class="page-header">
      <text class="header-date">{{ todayDate }}</text>
      <text class="header-title">博物馆</text>
    </view>

    <!-- 减重总进度 -->
    <view class="progress-card">
      <view class="progress-header">
        <text class="progress-title">减重总进度</text>
        <view class="progress-edit" @click="openTargetPanel">
          <text class="progress-edit-text">修改目标</text>
          <image class="progress-edit-icon" src="/static/image/icon/xiugai.png" mode="aspectFit" />
        </view>
      </view>

      <view class="gauge-wrap">
        <svg viewBox="0 0 300 170" class="gauge-arc">
          <!-- 刻度圈 -->
          <path d="M 55 145 A 95 95 0 0 1 245 145" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-dasharray="4 8" stroke-linecap="round" />
          <!-- 白色轨道 -->
          <path d="M 40 145 A 110 110 0 0 1 260 145" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" />
          <!-- 绿色进度 -->
          <path d="M 40 145 A 110 110 0 0 1 260 145" fill="none" stroke="#8DBB77" stroke-width="18" stroke-linecap="round" :stroke-dasharray="arcLength" :stroke-dashoffset="arcOffset" />
        </svg>
        <view class="gauge-info gauge-info-left">
          <text class="gauge-label">初始体重</text>
          <text class="gauge-value">{{ formatWeight(overview.initial_weight) }}kg</text>
        </view>
        <view class="gauge-info gauge-info-right">
          <text class="gauge-label">目标体重</text>
          <text class="gauge-value">{{ formatWeight(overview.target_weight) }}kg</text>
        </view>
        <view class="gauge-info gauge-info-center">
          <text class="gauge-label">当前完成</text>
          <text class="gauge-value">{{ Math.max(0, Math.min(100, overview.completion_rate || 0)).toFixed(2) }}%</text>
        </view>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-card">
      <view class="stat-item" v-for="s in statsList" :key="s.label">
        <text class="stat-value">{{ s.value }}</text>
        <text class="stat-label">{{ s.label }}</text>
      </view>
    </view>

    <!-- 入口网格 -->
    <view class="entries-grid">
      <view class="entry-card" v-for="entry in visibleEntries" :key="entry.key" @click="goTo(entry.url)">
        <image class="entry-icon" :src="entry.icon" mode="aspectFit" />
        <text class="entry-name">{{ entry.name }}</text>
        <text class="entry-arrow">›</text>
      </view>
    </view>

    <!-- 修改目标面板 -->
    <view class="panel-overlay" :class="{ show: showTargetPanel }" @click="closeTargetPanel"></view>
    <view class="target-panel" :class="{ show: showTargetPanel }">
      <view class="panel-header">
        <text class="panel-title">修改体重目标</text>
        <text class="panel-close" @click="closeTargetPanel">✕</text>
      </view>
      <view class="form-item">
        <text class="form-label">初始体重（kg）</text>
        <input v-model="initialWeightInput" class="form-input" type="digit" placeholder="请输入初始体重" />
      </view>
      <view class="form-item">
        <text class="form-label">目标体重（kg）</text>
        <input v-model="targetWeightInput" class="form-input" type="digit" placeholder="请输入目标体重" />
      </view>
      <view class="panel-actions">
        <view class="btn-cancel" @click="closeTargetPanel">取消</view>
        <view class="btn-save" @click="saveTargetWeight">保存</view>
      </view>
    </view>

    <CustomTabBar />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { museumApi, userApi } from '../../api';
import { useUserStore } from '../../store';
import CustomTabBar from '../../custom-tab-bar/index.vue';

const userStore = useUserStore();
const overview = ref({});
const showTargetPanel = ref(false);
const initialWeightInput = ref('');
const targetWeightInput = ref('');

const todayDate = computed(() => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${year}年${month}月${date}日 · ${weekdays[d.getDay()]}`;
});

const arcLength = 345.575; // π * 110（半圆弧长）
const arcOffset = computed(() => {
  const p = Math.max(0, Math.min(100, overview.value.completion_rate || 0));
  return arcLength * (1 - p / 100);
});

const statsList = computed(() => [
  { label: '减重天数', value: overview.value.used_days || 0 },
  { label: '打卡天数', value: overview.value.total_checkin_days || 0 },
  { label: '运动天数', value: overview.value.total_exercise_days || 0 },
  { label: '运动分钟', value: overview.value.total_exercise_minutes || 0 }
]);

const allEntries = [
  { key: 'recipe', name: '食谱库', icon: '/static/image/icon/shipuku.png', url: '/pages/museum/recipes' },
  { key: 'insight', name: '感悟与心情', icon: '/static/image/icon/ganwuji.png', url: '/pages/museum/insights' },
  { key: 'photo', name: '照片墙', icon: '/static/image/icon/zhaopianqiang.png', url: '/pages/museum/compare' },
  { key: 'method', name: '方法库', icon: '/static/image/icon/fangfaku.png', url: '/pages/museum/methods' },
  { key: 'diary', name: '日记与分析', icon: '/static/image/icon/rijiji.png', url: '/pages/museum/diary' },
  { key: 'milestone', name: '里程碑', icon: '/static/image/icon/lichengbei.png', url: '/pages/museum/milestones' }
];

const visibleEntries = computed(() => {
  const modules = overview.value.modules || {};
  return allEntries.filter(entry => modules[entry.key] !== false);
});

function formatWeight(w) {
  return w ? parseFloat(w).toFixed(2) : '--';
}

function goTo(url) {
  uni.navigateTo({ url });
}

async function load() {
  try {
    const res = await museumApi.getOverview();
    overview.value = res.data || {};
  } catch (err) {
    console.error(err);
  }
}

function openTargetPanel() {
  const profile = overview.value.initial_weight !== undefined
    ? overview.value
    : userStore.userInfo?.profile || {};
  initialWeightInput.value = profile.initial_weight ? String(profile.initial_weight) : '';
  targetWeightInput.value = profile.target_weight ? String(profile.target_weight) : '';
  showTargetPanel.value = true;
}

function closeTargetPanel() {
  showTargetPanel.value = false;
}

async function saveTargetWeight() {
  const initialW = parseFloat(initialWeightInput.value);
  const targetW = parseFloat(targetWeightInput.value);
  if (!initialW || initialW <= 0 || !targetW || targetW <= 0) {
    uni.showToast({ title: '请输入有效体重', icon: 'none' });
    return;
  }
  try {
    await userApi.updateProfile({ initial_weight: initialW, target_weight: targetW });
    // 同步到全局用户资料
    if (userStore.userInfo?.profile) {
      userStore.userInfo.profile.initial_weight = initialW;
      userStore.userInfo.profile.target_weight = targetW;
    }
    uni.showToast({ title: '保存成功', icon: 'success' });
    closeTargetPanel();
    load();
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}

onMounted(load);
onShow(() => {
  load();
  uni.$emit('tabbar-select', 2);
  uni.hideTabBar({ animation: false }).catch(() => {});
});
</script>

<style lang="scss" scoped>
.museum-page {
  background: #F7FbF4;
  min-height: 100vh;
  padding: 0 32rpx calc(180rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.status-bar {
  height: var(--status-bar-height);
}

.page-header {
  padding-top: 24rpx;
  margin-bottom: 32rpx;
}

.header-date {
  font-size: 28rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
}

.header-title {
  font-size: 60rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 1.1;
}

/* 减重总进度卡片 */
.progress-card {
  background: #DDF2D2;
  border-radius: 32rpx;
  padding: 32rpx 32rpx 8rpx 32rpx;
  margin-bottom: 32rpx;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.progress-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #27282D;
}

.progress-edit {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 8rpx 16rpx;
  display: flex;
  align-items: center;
}

.progress-edit-text {
  font-size: 24rpx;
  color: #666666;
  margin-right: 6rpx;
}

.progress-edit-icon {
  width: 24rpx;
  height: 24rpx;
}

.gauge-wrap {
  position: relative;
  width: 100%;
  height: 232rpx;
  transform: translateY(-32rpx);
}

.gauge-arc {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 70%;
  height: auto;
  z-index: 1;
}

.gauge-info {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}

.gauge-info-left {
  left: 5%;
  top: 52%;
  transform: translate(-20rpx, -32rpx);
}

.gauge-info-right {
  right: 5%;
  top: 52%;
  transform: translate(20rpx, -32rpx);
}

.gauge-info-center {
  left: 50%;
  transform: translate(-50%, -32rpx);
  top: 62%;
}

.gauge-label {
  font-size: 24rpx;
  color: #999999;
  line-height: 1.2;
}

.gauge-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 1.2;
  margin-top: 6rpx;
}

.gauge-info-center .gauge-value {
  font-size: 56rpx;
  font-weight: 700;
  line-height: 1.1;
}

/* 统计卡片 */
.stats-card {
  background: #E9F5FF;
  border-radius: 32rpx;
  padding: 24rpx;
  margin-bottom: 32rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.stat-item {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 20rpx 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
  margin-bottom: 8rpx;
}

.stat-label {
  font-size: 22rpx;
  color: #999999;
}

/* 入口网格 */
.entries-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.entry-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.entry-icon {
  width: 72rpx;
  height: 72rpx;
  margin-right: 16rpx;
}

.entry-name {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #27282D;
}

.entry-arrow {
  font-size: 40rpx;
  color: #C0C0C0;
}

/* 修改目标面板 */
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  z-index: 1000;
}

.panel-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.target-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  z-index: 1001;
  transform: translateY(100%);
  transition: transform 0.3s;
}

.target-panel.show {
  transform: translateY(0);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
}

.panel-close {
  font-size: 36rpx;
  color: #9CA3AF;
  padding: 8rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 28rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: #F3F4F6;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #27282D;
  box-sizing: border-box;
}

.panel-actions {
  display: flex;
  gap: 20rpx;
}

.btn-cancel,
.btn-save {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}

.btn-cancel {
  background: #F3F4F6;
  color: #666666;
}

.btn-save {
  background: #1F2937;
  color: #FFFFFF;
}
</style>
