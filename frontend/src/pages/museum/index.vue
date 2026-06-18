<template>
  <view class="museum-page">
    <!-- 总览卡片 -->
    <view class="overview-card">
      <view class="progress-section">
        <view class="progress-info">
          <text class="progress-title">已减 {{ overview.lost_weight }} kg</text>
          <text class="progress-sub">目标 {{ overview.target_weight }} kg</text>
        </view>
        <view class="progress-ring">
          <text class="progress-percent">{{ overview.completion_rate }}%</text>
        </view>
      </view>
      <view class="stats-row">
        <view class="stats-item">
          <text class="stats-value">{{ overview.used_days }}</text>
          <text class="stats-label">坚持天数</text>
        </view>
        <view class="stats-item">
          <text class="stats-value">{{ overview.total_checkin_days }}</text>
          <text class="stats-label">打卡天数</text>
        </view>
        <view class="stats-item">
          <text class="stats-value">{{ overview.total_exercise_minutes }}</text>
          <text class="stats-label">运动分钟</text>
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-entries">
      <view class="entry-item" @click="activeTab = 'timeline'">
        <text class="entry-icon">📅</text>
        <text>时间轴</text>
      </view>
      <view class="entry-item" @click="activeTab = 'quote'">
        <text class="entry-icon">💬</text>
        <text>金句墙</text>
      </view>
      <view class="entry-item" @click="activeTab = 'recipe'">
        <text class="entry-icon">🍳</text>
        <text>食谱库</text>
      </view>
      <view class="entry-item" @click="activeTab = 'insight'">
        <text class="entry-icon">📝</text>
        <text>感悟集</text>
      </view>
    </view>

    <!-- 内容区 -->
    <view class="content-area">
      <!-- 时间轴 -->
      <view v-if="activeTab === 'timeline'" class="timeline-list">
        <view
          v-for="item in timelineList"
          :key="item.id"
          class="timeline-item"
        >
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="timeline-title">{{ item.title }}</text>
            <text class="timeline-text">{{ item.content }}</text>
            <text class="timeline-date">{{ item.event_date }}</text>
          </view>
        </view>
        <view v-if="timelineList.length === 0" class="empty-tip">暂无时间轴事件</view>
      </view>

      <!-- 博物馆分类内容 -->
      <view v-else class="museum-list">
        <view
          v-for="item in museumList"
          :key="item.id"
          class="museum-item"
        >
          <view class="museum-content">
            <text class="museum-text">{{ item.content }}</text>
            <text v-if="item.author" class="museum-author">{{ item.author === 'user' ? '我的' : '搭子的' }}</text>
          </view>
          <text class="museum-date">{{ formatDate(item.created_at) }}</text>
        </view>
        <view v-if="museumList.length === 0" class="empty-tip">暂无内容，快去和搭子聊天吧</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { museumApi } from '../../api';

const activeTab = ref('timeline');
const overview = ref({
  lost_weight: 0,
  used_days: 0,
  target_weight: null,
  completion_rate: 0,
  total_checkin_days: 0,
  total_exercise_minutes: 0
});
const timelineList = ref([]);
const museumList = ref([]);

onMounted(() => {
  loadOverview();
  loadTimeline();
});

watch(activeTab, (val) => {
  if (val === 'timeline') {
    loadTimeline();
  } else {
    loadMuseumItems(val);
  }
});

async function loadOverview() {
  try {
    const res = await museumApi.getOverview();
    overview.value = res.data;
  } catch (err) {
    console.error('加载博物馆总览失败:', err);
  }
}

async function loadTimeline() {
  try {
    const res = await museumApi.getTimeline({ filter: 'all' });
    timelineList.value = res.data.list || [];
  } catch (err) {
    console.error('加载时间轴失败:', err);
  }
}

async function loadMuseumItems(type) {
  try {
    const res = await museumApi.getItems({ type, page: 1, size: 50 });
    museumList.value = res.data.list || [];
  } catch (err) {
    console.error('加载博物馆内容失败:', err);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}
</script>

<style lang="scss" scoped>
.museum-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.overview-card {
  background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 20rpx;
  color: #fff;
}

.progress-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.progress-title {
  font-size: 40rpx;
  font-weight: 600;
  display: block;
}

.progress-sub {
  font-size: 26rpx;
  opacity: 0.9;
  margin-top: 8rpx;
  display: block;
}

.progress-ring {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 8rpx solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-percent {
  font-size: 32rpx;
  font-weight: 600;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.2);
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-value {
  font-size: 36rpx;
  font-weight: 600;
}

.stats-label {
  font-size: 22rpx;
  opacity: 0.9;
  margin-top: 4rpx;
}

.quick-entries {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.entry-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 24rpx;
  color: #666;
}

.entry-icon {
  font-size: 44rpx;
  margin-bottom: 8rpx;
}

.content-area {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  min-height: 400rpx;
}

.timeline-list {
  padding-left: 20rpx;
  border-left: 2rpx solid #E8F5E9;
}

.timeline-item {
  position: relative;
  padding-left: 32rpx;
  padding-bottom: 32rpx;
}

.timeline-dot {
  position: absolute;
  left: -30rpx;
  top: 6rpx;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #4CAF50;
}

.timeline-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 6rpx;
}

.timeline-text {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 6rpx;
}

.timeline-date {
  font-size: 22rpx;
  color: #999;
}

.museum-list {
  padding-top: 8rpx;
}

.museum-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f6fa;
}

.museum-item:last-child {
  border-bottom: none;
}

.museum-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8rpx;
}

.museum-text {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
  margin-right: 16rpx;
}

.museum-author {
  font-size: 20rpx;
  color: #4CAF50;
  background: #E8F5E9;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.museum-date {
  font-size: 22rpx;
  color: #999;
}

.empty-tip {
  text-align: center;
  padding: 80rpx 0;
  font-size: 26rpx;
  color: #999;
}
</style>
