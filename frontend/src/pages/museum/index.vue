<template>
  <view class="museum-page">
    <view class="status-bar"></view>

    <view class="page-header">
      <text class="header-date">{{ todayDate }}</text>
      <text class="header-title">博物馆</text>
    </view>

    <!-- 加载中占位（首次进入且无缓存时显示） -->
    <view v-if="showLoading" class="loading-placeholder">
      <view class="placeholder-card"></view>
      <view class="placeholder-card"></view>
      <view class="placeholder-card"></view>
    </view>

    <!-- 减重总进度 -->
    <view v-if="!showLoading" class="progress-card">
      <view class="progress-header">
        <text class="progress-title">减重总进度</text>
        <view class="progress-edit" @click="openTargetPanel">
          <text class="progress-edit-text">修改目标</text>
          <image class="progress-edit-icon" src="/static/image/icon/xiugai.png" mode="aspectFit" />
        </view>
      </view>

      <view class="gauge-wrap">
        <view class="gauge-arc">
          <!-- 白色轨道（半圆，下半部分被容器截断） -->
          <view class="gauge-track"></view>
          <!-- 绿色进度弧（conic-gradient 上半圆） -->
          <view
            class="gauge-progress"
            :style="{ background: `conic-gradient(from 270deg, #8DBB77 ${gaugeProgressDeg}deg, rgba(255,255,255,0) ${gaugeProgressDeg}deg 180deg, rgba(255,255,255,0) 180deg 360deg)` }"
          ></view>
          <!-- 内圆把实心圆裁成环形（与卡片底色一致） -->
          <view class="gauge-inner"></view>
        </view>
        <view class="gauge-info gauge-info-left">
          <text class="gauge-label">初始体重</text>
          <view class="gauge-value-wrap">
            <text class="gauge-value">{{ formatWeight(overview.initial_weight) }}</text>
            <text class="gauge-unit">kg</text>
          </view>
        </view>
        <view class="gauge-info gauge-info-right">
          <text class="gauge-label">目标体重</text>
          <view class="gauge-value-wrap">
            <text class="gauge-value">{{ formatWeight(overview.target_weight) }}</text>
            <text class="gauge-unit">kg</text>
          </view>
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

  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { museumApi, userApi } from '../../api';
import { useUserStore } from '../../store';
import { usePageCacheStore, CACHE_KEYS } from '../../store/page-cache';
const userStore = useUserStore();
const pageCache = usePageCacheStore();
const overview = ref({});
const showTargetPanel = ref(false);
const initialWeightInput = ref('');
const targetWeightInput = ref('');

/**
 * 加载状态：
 * - showLoading 为 true 时显示骨架屏占位
 * - 初始值取决于是否有缓存数据（避免首帧白屏）
 */
const hasCachedData = ref(false);
const loading = ref(false);

/**
 * 是否显示加载中占位
 * 条件：正在加载 且 没有缓存数据可显示
 */
const showLoading = computed(() => loading.value && !hasCachedData.value);

const todayDate = computed(() => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${year}年${month}月${date}日 · ${weekdays[d.getDay()]}`;
});

// 仪表盘进度角（半圆 = 180°，小程序用 conic-gradient 模拟）
const gaugeProgressDeg = computed(() => {
  const p = Math.max(0, Math.min(100, overview.value.completion_rate || 0));
  return 180 * p / 100;
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
  if (!userStore.requireAuth()) return;
  uni.navigateTo({ url });
}

/**
 * 加载博物馆概览数据
 * 支持缓存策略：先显示缓存，再后台刷新
 */
async function load() {
  try {
    const res = await museumApi.getOverview();
    overview.value = res.data || {};
    // 更新缓存
    pageCache.setCache(CACHE_KEYS.MUSEUM_OVERVIEW, overview.value);
  } catch (err) {
    console.error(err);
  }
}

/**
 * 初始化：从缓存恢复数据
 * @returns {boolean} 是否有缓存数据
 */
function initFromCache() {
  const cached = pageCache.getCache(CACHE_KEYS.MUSEUM_OVERVIEW);
  if (cached) {
    // 有缓存，直接渲染缓存数据（避免白屏）
    overview.value = cached;
    hasCachedData.value = true;
    return true;
  }
  return false;
}

/**
 * 根据缓存状态决定是否需要刷新
 * @returns {boolean} true 表示需要刷新
 */
function needRefresh() {
  // 需要强制刷新（如保存数据后）
  if (pageCache.consumeForceRefresh(CACHE_KEYS.MUSEUM_OVERVIEW)) {
    return true;
  }
  // 首次进入且无缓存
  if (!hasCachedData.value) {
    return true;
  }
  // 缓存过期（超过 5 分钟）
  if (pageCache.isExpired(CACHE_KEYS.MUSEUM_OVERVIEW)) {
    return true;
  }
  return false;
}

function openTargetPanel() {
  if (!userStore.requireAuth()) return;
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

onMounted(() => {
  // 1. 先从缓存恢复数据（避免白屏）
  const hasCache = initFromCache();
  // 2. 后台异步刷新
  if (userStore.isLoggedIn) {
    // 没有缓存时显示 loading，有缓存时直接显示缓存数据
    if (!hasCache) {
      loading.value = true;
    }
    // 使用 nextTick 让缓存数据先渲染，再刷新
    nextTick(() => {
      load().finally(() => {
        loading.value = false;
        hasCachedData.value = true;
      });
    });
  }
});

onShow(() => {
  // 根据缓存状态决定是否需要刷新
  if (userStore.isLoggedIn && needRefresh()) {
    // 没有缓存数据时显示 loading
    if (!hasCachedData.value) {
      loading.value = true;
    }
    // 异步刷新，不阻塞 UI
    nextTick(() => {
      load().finally(() => {
        loading.value = false;
        hasCachedData.value = true;
      });
    });
  }
});
</script>

<style lang="scss" scoped>
.museum-page {
  background: #F7FbF4;
  min-height: 100vh;
  padding: 0 32rpx calc(180rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* 加载中占位符样式 */
.loading-placeholder {
  padding: 24rpx 0;
}

.placeholder-card {
  height: 200rpx;
  background: linear-gradient(90deg, #E8F5E8 25%, #F5FAF5 50%, #E8F5E8 75%);
  background-size: 200% 100%;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  animation: placeholder-shimmer 1.5s infinite;
}

.placeholder-card:nth-child(2) {
  height: 300rpx;
}

.placeholder-card:nth-child(3) {
  height: 150rpx;
}

@keyframes placeholder-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.status-bar {
  /* 标杆第一行硬码兜底：44px + 88rpx，--status-bar-height 未注入前几帧不塌缩 */
  height: calc(44px + 88rpx);
  /* 标杆第二行：兼容所有端 var 注入真实高度，覆盖第一行 */
  height: calc(var(--status-bar-height, 44px) + 88rpx);
  /* 与系统 navigationBarBackgroundColor 一致，避免顶部两层色差 */
  background: #F7FbF4;
  /* 左右负 margin 抵消 museum-page 的 32rpx padding，让背景铺满屏幕两侧 */
  margin-left: -32rpx;
  margin-right: -32rpx;
  flex-shrink: 0;
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
  /* aspect-ratio 小程序不支持，改用显式尺寸（300:170 比例） */
  width: 420rpx;
  height: 238rpx;
  z-index: 1;
  overflow: hidden;
}

/* 半圆轨道：圆心贴容器底部中心（bottom 为负的半径），上半圆可见 */
.gauge-track,
.gauge-progress {
  position: absolute;
  left: 50%;
  bottom: -210rpx;
  /* aspect-ratio 小程序不支持，显式正方形 */
  width: 420rpx;
  height: 420rpx;
  border-radius: 50%;
  transform: translateX(-50%);
}

.gauge-track {
  background: #FFFFFF;
}

/* 内圆裁出环形：与轨道同心（圆心同样在容器底部中点），颜色取卡片底色 */
.gauge-inner {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 372rpx;
  height: 372rpx;
  border-radius: 50%;
  bottom: -186rpx;
  background: #DDF2D2;
  z-index: 1;
}

/* .gauge-progress 由内联 style 注入 conic-gradient 进度，from 270deg 让 0° 起点在 9 点钟方向 */

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
}

/* 数值 + 单位容器：垂直排列，水平居中 */
.gauge-value-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 6rpx;
}

/* 单位文字：与数值保持一致的字号、字重、字色 */
.gauge-unit {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 1.2;
  margin-top: 6rpx;
}

/* gauge-info 内的 gauge-value：根据是否在 gauge-value-wrap 内调整外边距 */
.gauge-info-left .gauge-value,
.gauge-info-right .gauge-value {
  margin-top: 0;
}

/* 独立使用 gauge-value（如中间百分比）保留原 margin-top 和字号 */
.gauge-info-center .gauge-value {
  margin-top: 6rpx;
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
