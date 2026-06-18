<template>
  <view class="record-page">
    <!-- 今日概览卡片 -->
    <view class="overview-card">
      <view class="overview-header">
        <text class="date">{{ today }}</text>
        <text class="status" :class="todayStats.status">{{ statusText }}</text>
      </view>
      <view class="overview-body">
        <view class="overview-item">
          <text class="value">{{ todayStats.intake }}</text>
          <text class="label">摄入 kcal</text>
        </view>
        <view class="overview-item">
          <text class="value">{{ todayStats.burned }}</text>
          <text class="label">消耗 kcal</text>
        </view>
        <view class="overview-item">
          <text class="value">{{ todayStats.remaining }}</text>
          <text class="label">剩余 kcal</text>
        </view>
      </view>
      <view class="macro-bar">
        <view class="macro-item">
          <text class="macro-dot protein"></text>
          <text>蛋白质 {{ todayStats.protein_ratio }}%</text>
        </view>
        <view class="macro-item">
          <text class="macro-dot carb"></text>
          <text>碳水 {{ todayStats.carb_ratio }}%</text>
        </view>
        <view class="macro-item">
          <text class="macro-dot fat"></text>
          <text>脂肪 {{ todayStats.fat_ratio }}%</text>
        </view>
      </view>
    </view>

    <!-- 标签页 -->
    <view class="tabs">
      <text
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >{{ tab.label }}</text>
    </view>

    <!-- 饮食记录 -->
    <view v-if="activeTab === 'diet'" class="tab-content">
      <view class="section" v-for="meal in mealList" :key="meal.key">
        <view class="section-header">
          <text class="section-title">{{ meal.label }}</text>
          <text class="section-calorie">{{ getMealCalorie(meal.key) }} kcal</text>
        </view>
        <view
          v-for="item in dietData.meals[meal.key]"
          :key="item.id"
          class="record-item"
        >
          <view class="record-info">
            <text class="record-name">{{ getFoodNames(item.foods) }}</text>
            <text class="record-calorie">{{ item.total_calorie }} kcal</text>
          </view>
          <text v-if="item.status === 0" class="pending-badge">待确认</text>
        </view>
        <view v-if="dietData.meals[meal.key].length === 0" class="empty-tip">
          还没有记录
        </view>
      </view>
    </view>

    <!-- 运动记录 -->
    <view v-else-if="activeTab === 'exercise'" class="tab-content">
      <view class="summary-card">
        <text>今日运动 {{ exerciseData.total_duration }} 分钟，消耗 {{ exerciseData.total_calorie }} kcal</text>
      </view>
      <view
        v-for="item in allExercises"
        :key="item.id"
        class="record-item"
      >
        <view class="record-info">
          <text class="record-name">{{ getExerciseNames(item.exercises) }}</text>
          <text class="record-calorie">{{ item.total_calorie }} kcal · {{ item.total_duration }} 分钟</text>
        </view>
      </view>
      <view v-if="allExercises.length === 0" class="empty-tip">
        还没有运动记录
      </view>
    </view>

    <!-- 身体数据 -->
    <view v-else-if="activeTab === 'body'" class="tab-content">
      <view class="summary-card">
        <text>当前体重 {{ bodyData.list[0]?.value || '-' }} {{ bodyData.unit }}</text>
        <text v-if="bodyData.list[0]?.change !== 0" class="change" :class="bodyData.list[0]?.change > 0 ? 'up' : 'down'">
          {{ bodyData.list[0]?.change > 0 ? '+' : '' }}{{ bodyData.list[0]?.change }}
        </text>
      </view>
      <view class="weight-list">
        <view
          v-for="item in bodyData.list"
          :key="item.date"
          class="weight-item"
        >
          <text class="weight-date">{{ item.date }}</text>
          <text class="weight-value">{{ item.value }} {{ bodyData.unit }}</text>
          <text class="weight-change" :class="item.change > 0 ? 'up' : 'down'">
            {{ item.change > 0 ? '+' : '' }}{{ item.change }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { recordApi } from '../../api';

const today = new Date().toISOString().split('T')[0];
const activeTab = ref('diet');
const todayStats = ref({
  intake: 0,
  burned: 0,
  remaining: 0,
  status: 'green',
  protein_ratio: 0,
  carb_ratio: 0,
  fat_ratio: 0
});
const dietData = ref({ meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, total_calorie: 0 });
const exerciseData = ref({ total_calorie: 0, total_duration: 0, types: {} });
const bodyData = ref({ list: [], unit: 'kg', target: null });

const tabs = [
  { label: '饮食', value: 'diet' },
  { label: '运动', value: 'exercise' },
  { label: '身体', value: 'body' }
];

const mealList = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' }
];

const statusText = computed(() => {
  const map = { green: '健康', yellow: '预警', red: '超标' };
  return map[todayStats.value.status] || '健康';
});

const allExercises = computed(() => {
  const list = [];
  Object.values(exerciseData.value.types || {}).forEach(arr => list.push(...arr));
  return list;
});

onMounted(() => {
  loadTodayStats();
  loadTabData();
});

watch(activeTab, () => {
  loadTabData();
});

async function loadTodayStats() {
  try {
    const res = await recordApi.getToday();
    todayStats.value = res.data;
  } catch (err) {
    console.error('加载今日概览失败:', err);
  }
}

async function loadTabData() {
  try {
    if (activeTab.value === 'diet') {
      const res = await recordApi.getDiet(today);
      dietData.value = res.data;
    } else if (activeTab.value === 'exercise') {
      const res = await recordApi.getExercise(today);
      exerciseData.value = res.data;
    } else if (activeTab.value === 'body') {
      const res = await recordApi.getBody({ type: 'weight', days: 7 });
      bodyData.value = res.data;
    }
  } catch (err) {
    console.error('加载记录失败:', err);
  }
}

function getMealCalorie(mealTime) {
  const items = dietData.value.meals[mealTime] || [];
  return items.reduce((sum, item) => sum + (item.total_calorie || 0), 0);
}

function getFoodNames(foods) {
  if (!foods || foods.length === 0) return '未知食物';
  return foods.map(f => f.name).join('、');
}

function getExerciseNames(exercises) {
  if (!exercises || exercises.length === 0) return '未知运动';
  return exercises.map(e => e.name).join('、');
}
</script>

<style lang="scss" scoped>
.record-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.overview-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.date {
  font-size: 28rpx;
  color: #666;
}

.status {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 12rpx;
}

.status.green { color: #4CAF50; background: #E8F5E9; }
.status.yellow { color: #FF9800; background: #FFF3E0; }
.status.red { color: #F44336; background: #FFEBEE; }

.overview-body {
  display: flex;
  justify-content: space-around;
  margin-bottom: 24rpx;
}

.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.overview-item .value {
  font-size: 44rpx;
  font-weight: 600;
  color: #333;
}

.overview-item .label {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}

.macro-bar {
  display: flex;
  justify-content: center;
  gap: 32rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f5f6fa;
}

.macro-item {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #666;
}

.macro-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 8rpx;
}

.macro-dot.protein { background: #FF7043; }
.macro-dot.carb { background: #FFCA28; }
.macro-dot.fat { background: #66BB6A; }

.tabs {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 28rpx;
  color: #666;
  border-radius: 12rpx;
}

.tab-item.active {
  background: #E8F5E9;
  color: #4CAF50;
  font-weight: 600;
}

.tab-content {
  padding-bottom: 40rpx;
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.section-calorie {
  font-size: 26rpx;
  color: #999;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f6fa;
}

.record-info {
  display: flex;
  flex-direction: column;
}

.record-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.record-calorie {
  font-size: 24rpx;
  color: #999;
}

.pending-badge {
  font-size: 20rpx;
  color: #FF9800;
  background: #FFF3E0;
  padding: 4rpx 12rpx;
  border-radius: 10rpx;
}

.empty-tip {
  text-align: center;
  padding: 40rpx 0;
  font-size: 26rpx;
  color: #999;
}

.summary-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 28rpx;
  color: #333;
}

.change {
  font-size: 32rpx;
  font-weight: 600;
}

.change.up { color: #F44336; }
.change.down { color: #4CAF50; }

.weight-list {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
}

.weight-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f6fa;
}

.weight-item:last-child {
  border-bottom: none;
}

.weight-date {
  font-size: 26rpx;
  color: #666;
}

.weight-value {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.weight-change {
  font-size: 26rpx;
}

.weight-change.up { color: #F44336; }
.weight-change.down { color: #4CAF50; }
</style>
