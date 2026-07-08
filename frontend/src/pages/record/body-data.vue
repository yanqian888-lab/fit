<template>
  <view class="body-page">
    <!-- 顶部渐变背景 -->
    <view class="header-bg"></view>

    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 页面标题栏 -->
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">体重记录</text>
      <view class="header-right"></view>
    </view>

    <view class="body-scroll">
      <!-- 日期模块 -->
      <view class="date-module">
        <view v-if="!isExpanded" class="date-bar">
          <view
            v-for="item in weekDays"
            :key="item.date"
            class="date-item"
            :class="{ today: item.isToday && !item.isSelected, selected: item.isSelected }"
            @click="selectDate(item.date)"
          >
            <text class="date-week">{{ item.weekLabel }}</text>
            <text class="date-day">{{ item.day }}</text>
            <view v-if="item.hasRecord" class="day-dot"></view>
          </view>
        </view>

        <view v-else class="calendar-panel">
          <view class="calendar-header">
            <view class="month-arrow" @click="prevMonth">
              <text class="arrow-icon left">‹</text>
            </view>
            <text class="calendar-title">{{ headerDate }}</text>
            <view class="month-arrow" @click="nextMonth">
              <text class="arrow-icon right">›</text>
            </view>
          </view>

          <view class="calendar-weekdays">
            <text v-for="w in WEEKDAYS" :key="w" class="calendar-weekday">{{ w }}</text>
          </view>

          <view class="calendar-days">
            <view
              v-for="(item, index) in calendarDays"
              :key="index"
              class="calendar-day"
              :class="{
                'other-month': !item.isCurrentMonth,
                today: item.isToday && !item.isSelected,
                selected: item.isSelected
              }"
              @click="selectDate(item.date)"
            >
              <text class="calendar-day-text">{{ item.day }}</text>
              <view v-if="item.hasRecord" class="day-dot"></view>
            </view>
          </view>
        </view>

        <view class="toggle-bar" @click="toggleCalendar">
          <image
            class="toggle-icon"
            :src="isExpanded ? '/static/image/icon/xiangshang.png' : '/static/image/icon/xiangxia.png'"
            mode="aspectFit"
          />
        </view>
      </view>

      <view class="body-content">
        <!-- 当前数据 -->
        <view class="module-card">
          <text class="card-title">当前数据</text>
          <view class="data-grid">
            <view class="data-item">
              <text class="data-value">{{ currentWeight || '--' }}</text>
              <text class="data-label">体重(kg)</text>
            </view>
            <view class="data-item">
              <text class="data-value">{{ bmi }}</text>
              <text class="data-label">BMI</text>
            </view>
            <view class="data-item">
              <text class="data-value">{{ bodyFatDisplay }}</text>
              <text class="data-label">体脂率</text>
            </view>
          </view>
          <view class="record-btn" @click="openWeightModal">
            <text>记录体重</text>
          </view>
        </view>

        <!-- 体重趋势 -->
        <view class="module-card">
          <view class="card-header">
            <text class="card-title">体重趋势(kg)</text>
            <view class="fullscreen-btn" @click="openFullscreenChart">
              <image class="fullscreen-icon" src="/static/image/icon/fangda.png" mode="aspectFit" />
            </view>
          </view>
          <view class="trend-chart">
            <svg v-if="chartPoints.length > 1" class="trend-svg" viewBox="0 0 320 120" preserveAspectRatio="none">
              <polyline :points="chartLinePoints" fill="none" stroke="#8DBB77" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <g v-for="(point, idx) in chartPoints" :key="idx">
                <circle :cx="point.x" :cy="point.y" r="3" fill="#8DBB77" />
                <foreignObject :x="point.x - 25" :y="point.y - 28" width="50" height="18">
                  <div xmlns="http://www.w3.org/1999/xhtml" class="chart-value">{{ point.value }}</div>
                </foreignObject>
              </g>
            </svg>
            <view v-else class="chart-empty">
              <text>记录体重后查看趋势</text>
            </view>
          </view>
          <view class="x-axis">
            <text v-for="(point, idx) in chartPoints" :key="idx" class="x-label">{{ point.date }}</text>
          </view>
        </view>

        <!-- 身体围度 -->
        <view class="module-card">
          <view class="card-title-row">
            <text class="card-title">身体围度</text>
            <text v-if="measureLatestDate" class="card-subtitle">（最近数据：{{ measureLatestDate }}）</text>
          </view>
          <view class="measurement-grid">
            <view
              v-for="item in measurementTypes"
              :key="item.value"
              class="measurement-item"
              @click="openMeasureModal"
            >
              <text class="measurement-value">{{ measureForm[item.value] || '--' }}</text>
              <text class="measurement-label">{{ item.label }}(cm)</text>
            </view>
          </view>
          <view class="record-btn" @click="openMeasureModal">
            <text>记录围度</text>
          </view>
        </view>

        <!-- 底部占位 -->
        <view class="bottom-placeholder"></view>
      </view>
    </view>

    <!-- 记录体重弹层 -->
    <view v-if="showWeightModal" class="modal-mask" @click="closeWeightModal"></view>
    <view v-if="showWeightModal" class="record-modal">
      <view class="modal-header">
        <text class="modal-title">记录体重</text>
        <text class="modal-close" @click="closeWeightModal">✕</text>
      </view>
      <view class="modal-body">
        <view class="form-item">
          <text class="form-label">体重 (kg) *</text>
          <input v-model="weightForm.value" type="digit" placeholder="请输入体重" class="form-input" />
        </view>
        <view class="form-item">
          <text class="form-label">体脂率 (%)</text>
          <input v-model="weightForm.bodyFat" type="digit" placeholder="选填" class="form-input" />
        </view>
      </view>
      <view class="modal-footer">
        <view class="modal-btn secondary" @click="closeWeightModal">取消</view>
        <view class="modal-btn primary" @click="saveWeight">保存</view>
      </view>
    </view>

    <!-- 围度弹层 -->
    <view v-if="showMeasureModal" class="modal-mask" @click="closeMeasureModal"></view>
    <view v-if="showMeasureModal" class="record-modal">
      <view class="modal-header">
        <text class="modal-title">记录围度</text>
        <text class="modal-close" @click="closeMeasureModal">✕</text>
      </view>
      <scroll-view class="modal-body-scroll" scroll-y>
        <view v-for="item in measurementTypes" :key="item.value" class="form-item">
          <text class="form-label">{{ item.label }} (cm)</text>
          <input v-model="measureModalForm[item.value]" type="digit" placeholder="选填" class="form-input" />
        </view>
      </scroll-view>
      <view class="modal-footer">
        <view class="modal-btn secondary" @click="closeMeasureModal">取消</view>
        <view class="modal-btn primary" @click="saveMeasurements">保存</view>
      </view>
    </view>

    <!-- 全屏趋势弹窗 -->
    <view v-if="showFullscreenChart" class="fullscreen-modal" @click="closeFullscreenChart">
      <view class="fullscreen-content" @click.stop>
        <view class="fullscreen-header">
          <text class="fullscreen-title">体重趋势</text>
          <text class="fullscreen-close" @click="closeFullscreenChart">关闭</text>
        </view>
        <view class="fullscreen-chart">
          <svg v-if="chartPoints.length > 1" class="fullscreen-trend-svg" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid meet">
            <polyline :points="fullscreenLinePoints" fill="none" stroke="#8DBB77" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <g v-for="(point, idx) in fullscreenPoints" :key="idx">
              <circle :cx="point.x" :cy="point.y" r="4" fill="#8DBB77" />
              <foreignObject :x="point.x - 28" :y="point.y - 30" width="56" height="20">
                <div xmlns="http://www.w3.org/1999/xhtml" class="chart-value fullscreen">{{ point.value }}</div>
              </foreignObject>
            </g>
          </svg>
          <view class="fullscreen-x-axis">
            <text v-for="(point, idx) in fullscreenPoints" :key="idx" class="fullscreen-x-label">{{ point.date }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi } from '../../api';
import { getToday, formatDate } from '../../utils/date';
import { goBack as navigateBack } from '../../utils/navigate';

const statusBarHeight = ref(44);

// 日期相关
const today = getToday();
const selectedDate = ref(today);
const isExpanded = ref(false);
const currentMonth = ref(parseLocalDate(today));

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const weekDays = computed(() => getWeekDays(selectedDate.value));
const calendarDays = computed(() => getCalendarDays(currentMonth.value));
const headerDate = computed(() => {
  const d = currentMonth.value;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}年${m}月`;
});

// 数据
const weightList = ref([]);
const currentWeight = ref(null);
const bodyFatRate = ref(null);
const initialWeight = ref(null);
const targetWeight = ref(null);
const recordDates = ref(new Set());

const measurementTypes = [
  { label: '腰围', value: 'waist' },
  { label: '臀围', value: 'hip' },
  { label: '胸围', value: 'chest' },
  { label: '大腿围', value: 'thigh' },
  { label: '小腿围', value: 'calf' },
  { label: '臂围', value: 'arm' }
];

const measureForm = ref({ waist: '', hip: '', chest: '', thigh: '', calf: '', arm: '' });
const measureLatestDate = ref('');

// 弹窗
const showWeightModal = ref(false);
const showMeasureModal = ref(false);
const showFullscreenChart = ref(false);
const weightForm = ref({ value: '', bodyFat: '' });
const measureModalForm = ref({ waist: '', hip: '', chest: '', thigh: '', calf: '', arm: '' });

const bmi = computed(() => {
  const w = parseFloat(currentWeight.value);
  if (!w) return '--';
  const heightM = 1.65;
  return (w / (heightM * heightM)).toFixed(1);
});

const bodyFatDisplay = computed(() => {
  const fat = parseFloat(bodyFatRate.value);
  if (isNaN(fat)) return '--';
  return fat + '%';
});

// 趋势图数据：最近 7 条体重记录
const chartPoints = computed(() => {
  const list = [...weightList.value].reverse().slice(-7);
  if (list.length === 0) return [];

  const values = list.map(i => parseFloat(i.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = { top: 25, bottom: 15, left: 20, right: 20 };
  const width = 320;
  const height = 120;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  return list.map((item, idx) => {
    const x = padding.left + (list.length === 1 ? chartWidth / 2 : (idx / (list.length - 1)) * chartWidth);
    const y = padding.top + (1 - (parseFloat(item.value) - min) / range) * chartHeight;
    return {
      date: item.date.slice(5).replace('-', '.'),
      value: item.value,
      x: Math.round(x),
      y: Math.round(y)
    };
  });
});

const chartLinePoints = computed(() => {
  return chartPoints.value.map(p => `${p.x},${p.y}`).join(' ');
});

// 全屏趋势图：展示更多记录，使用更宽松的边距
const fullscreenPoints = computed(() => {
  const list = [...weightList.value].reverse().slice(-14);
  if (list.length === 0) return [];

  const values = list.map(i => parseFloat(i.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = { top: 35, bottom: 25, left: 30, right: 30 };
  const width = 320;
  const height = 160;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  return list.map((item, idx) => {
    const x = padding.left + (list.length === 1 ? chartWidth / 2 : (idx / (list.length - 1)) * chartWidth);
    const y = padding.top + (1 - (parseFloat(item.value) - min) / range) * chartHeight;
    return {
      date: item.date.slice(5).replace('-', '.'),
      value: item.value,
      x: Math.round(x),
      y: Math.round(y)
    };
  });
});

const fullscreenLinePoints = computed(() => {
  return fullscreenPoints.value.map(p => `${p.x},${p.y}`).join(' ');
});

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekDays(dateStr) {
  const d = parseLocalDate(dateStr);
  const dayOfWeek = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dayOfWeek);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const curStr = formatDate(cur.toISOString());
    days.push({
      date: curStr,
      day: cur.getDate(),
      weekLabel: WEEKDAYS[cur.getDay()],
      isToday: curStr === today,
      isSelected: curStr === selectedDate.value,
      hasRecord: recordDates.value.has(curStr)
    });
  }
  return days;
}

function getCalendarDays(monthDate) {
  const d = monthDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const cur = new Date(year, month - 1, prevMonthLastDay - i);
    const curStr = formatDate(cur.toISOString());
    days.push({ date: curStr, day: cur.getDate(), isCurrentMonth: false, isToday: curStr === today, isSelected: curStr === selectedDate.value, hasRecord: recordDates.value.has(curStr) });
  }

  for (let i = 1; i <= totalDays; i++) {
    const cur = new Date(year, month, i);
    const curStr = formatDate(cur.toISOString());
    days.push({ date: curStr, day: cur.getDate(), isCurrentMonth: true, isToday: curStr === today, isSelected: curStr === selectedDate.value, hasRecord: recordDates.value.has(curStr) });
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const cur = new Date(year, month + 1, i);
    const curStr = formatDate(cur.toISOString());
    days.push({ date: curStr, day: cur.getDate(), isCurrentMonth: false, isToday: curStr === today, isSelected: curStr === selectedDate.value, hasRecord: recordDates.value.has(curStr) });
  }
  return days;
}

function selectDate(date) {
  selectedDate.value = date;
  currentMonth.value = parseLocalDate(date);
  loadData();
}

function toggleCalendar() {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    currentMonth.value = parseLocalDate(selectedDate.value);
  }
}

function prevMonth() {
  const d = new Date(currentMonth.value);
  d.setMonth(d.getMonth() - 1);
  currentMonth.value = d;
}

function nextMonth() {
  const d = new Date(currentMonth.value);
  d.setMonth(d.getMonth() + 1);
  currentMonth.value = d;
}

async function loadData() {
  await Promise.all([loadWeight(), loadMeasurements(), loadProfile()]);
}

async function loadWeight() {
  try {
    const res = await recordApi.getBody({ type: 'weight', days: 365 });
    weightList.value = res.data.list || [];
    (res.data.list || []).forEach(item => recordDates.value.add(item.date));
    updateCurrentData();
  } catch (err) {
    console.error(err);
  }
}

function updateCurrentData() {
  // 找到 selectedDate 当天或之前的最新体重记录
  const selected = selectedDate.value;
  const record = weightList.value.find(item => item.date === selected) ||
    weightList.value.find(item => item.date < selected);

  if (record) {
    currentWeight.value = record.value;
    bodyFatRate.value = record.body_fat || null;
  } else {
    currentWeight.value = null;
    bodyFatRate.value = null;
  }
}

async function loadMeasurements() {
  try {
    let latestDate = '';
    for (const m of measurementTypes) {
      const res = await recordApi.getBody({ type: m.value, days: 365 });
      const list = res.data.list || [];
      list.forEach(item => recordDates.value.add(item.date));

      // 优先取选中日期当天，否则取该日期之前最近的一次历史数据
      const selectedRecord = list.find(item => item.date === selectedDate.value);
      if (selectedRecord) {
        measureForm.value[m.value] = selectedRecord.value;
      } else {
        const latestRecord = list.find(item => item.date < selectedDate.value);
        if (latestRecord) {
          measureForm.value[m.value] = latestRecord.value;
          if (latestRecord.date > latestDate) latestDate = latestRecord.date;
        } else {
          measureForm.value[m.value] = '';
        }
      }
    }
    measureLatestDate.value = latestDate;
  } catch (err) {
    console.error(err);
  }
}

async function loadProfile() {
  try {
    const res = await recordApi.getToday();
    const data = res.data;
    initialWeight.value = data.initial_weight;
    targetWeight.value = data.target_weight;
    if (!currentWeight.value && data.current_weight) {
      currentWeight.value = data.current_weight;
    }
  } catch (err) {
    console.error(err);
  }
}

function goBack() {
  navigateBack('/pages/record/index');
}

function openWeightModal() {
  showWeightModal.value = true;
  weightForm.value = { value: '', bodyFat: '' };
}

function closeWeightModal() {
  showWeightModal.value = false;
}

async function saveWeight() {
  if (!weightForm.value.value) {
    uni.showToast({ title: '请输入体重', icon: 'none' });
    return;
  }
  try {
    const bodyFat = weightForm.value.bodyFat ? parseFloat(weightForm.value.bodyFat) : null;
    await recordApi.saveBody({
      record_date: selectedDate.value,
      type: 'weight',
      value: parseFloat(weightForm.value.value),
      unit: 'kg',
      body_fat: bodyFat
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
    closeWeightModal();
    loadData();
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}

function openMeasureModal() {
  showMeasureModal.value = true;
  measureModalForm.value = { ...measureForm.value };
}

function closeMeasureModal() {
  showMeasureModal.value = false;
}

async function saveMeasurements() {
  try {
    let saved = 0;
    for (const m of measurementTypes) {
      const value = parseFloat(measureModalForm.value[m.value]);
      if (!isNaN(value) && value > 0) {
        await recordApi.saveBody({
          record_date: selectedDate.value,
          type: m.value,
          value,
          unit: 'cm'
        });
        saved++;
      }
    }
    if (saved > 0) {
      uni.showToast({ title: '围度已保存', icon: 'success' });
      closeMeasureModal();
      loadMeasurements();
    } else {
      uni.showToast({ title: '请至少填写一项围度', icon: 'none' });
    }
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}

function openFullscreenChart() {
  showFullscreenChart.value = true;
  // #ifdef H5
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) {}
  // #endif
}

function closeFullscreenChart() {
  showFullscreenChart.value = false;
  // #ifdef H5
  try {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  } catch (e) {}
  // #endif
}

onMounted(() => {
  // #ifdef H5
  statusBarHeight.value = 44;
  // #endif
  // #ifndef H5
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 44;
  // #endif

  loadData();
});

onShow(() => {
  loadData();
});

watch(selectedDate, updateCurrentData);
</script>

<style lang="scss" scoped>
.body-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
  overflow: hidden;
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
  color: #666666;
  font-weight: 700;
  line-height: 1;
  margin-left: -8rpx;
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 40rpx;
}

.header-right {
  width: 60rpx;
}

/* 日期模块 */
.date-module {
  position: relative;
  z-index: 1;
  margin: 8rpx 0 0;
  background: #FFFFFF;
  border-radius: 32rpx;
  box-shadow: 0 4rpx 32rpx rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.date-bar {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 16rpx;
}

.date-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 16rpx 0;
  margin: 0 6rpx;
  border-radius: 24rpx;
  transition: background-color 0.2s ease;
}

.date-week {
  font-size: 22rpx;
  font-weight: 600;
  color: #8F9098;
  letter-spacing: 0.5rpx;
  margin-bottom: 6rpx;
  line-height: 28rpx;
}

.date-day {
  font-size: 32rpx;
  font-weight: 400;
  color: #494A50;
  line-height: 40rpx;
}

.day-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #FFE585;
  margin-top: 4rpx;
}

.date-item.today {
  background: #F6F6F6;
}

.date-item.selected {
  background: #8DBB77;
}

.date-item.selected .date-week,
.date-item.selected .date-day {
  color: #FFFFFF;
}

.calendar-panel {
  padding: 24rpx 20rpx 16rpx;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 0 12rpx;
}

.month-arrow {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-icon {
  font-size: 40rpx;
  color: #757B8C;
  font-weight: 400;
  line-height: 1;
}

.arrow-icon.left {
  margin-left: -8rpx;
}

.arrow-icon.right {
  margin-right: -8rpx;
}

.calendar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 40rpx;
}

.calendar-weekdays {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 0 8rpx;
}

.calendar-weekday {
  width: 60rpx;
  text-align: center;
  font-size: 24rpx;
  font-weight: 600;
  color: #8DBB77;
  line-height: 30rpx;
}

.calendar-days {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 0 8rpx;
}

.calendar-day {
  width: 60rpx;
  height: 72rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  border-radius: 50%;
}

.calendar-day-text {
  font-size: 26rpx;
  font-weight: 400;
  color: #27282D;
  line-height: 1;
}

.calendar-day.other-month .calendar-day-text {
  color: #999999;
}

.calendar-day.today {
  background: #F0F0F0;
}

.calendar-day.selected {
  background: #8DBB77;
}

.calendar-day.selected .calendar-day-text {
  color: #FFFFFF;
}

.toggle-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48rpx;
}

.toggle-icon {
  width: 48rpx;
  height: 24rpx;
}

/* 主内容 */
.body-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  margin-top: 32rpx;
  padding: 0 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.body-content {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 24rpx;
}

.module-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
}

.card-title {
  display: block;
  text-align: center;
  font-size: 30rpx;
  font-weight: 400;
  color: #27282D;
  line-height: 40rpx;
  margin-bottom: 28rpx;
}

.card-title-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28rpx;
}

.card-title-row .card-title {
  margin-bottom: 8rpx;
}

.card-subtitle {
  font-size: 22rpx;
  color: #999;
  line-height: 30rpx;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.card-header .card-title {
  margin-bottom: 0;
}

.fullscreen-btn {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-icon {
  width: 28rpx;
  height: 28rpx;
}

/* 数据网格 */
.data-grid {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.data-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #F0F0F0;
  border-radius: 24rpx;
  padding: 28rpx 0;
}

.data-value {
  font-size: 36rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 48rpx;
  margin-bottom: 8rpx;
}

.data-label {
  font-size: 24rpx;
  color: #666666;
  line-height: 32rpx;
}

/* 记录按钮 */
.record-btn {
  height: 92rpx;
  background: #FBE386;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  color: #27282D;
  font-weight: 400;
}

.record-btn:active {
  opacity: 0.9;
}

/* 趋势图 */
.trend-chart {
  height: 220rpx;
  margin-bottom: 12rpx;
}

.trend-svg {
  width: 100%;
  height: 100%;
}

.chart-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #999999;
}

.chart-value {
  font-size: 11px;
  color: #27282D;
  font-weight: 600;
  text-align: center;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-value.fullscreen {
  font-size: 12px;
  line-height: 20px;
}

.x-axis {
  display: flex;
  justify-content: space-between;
  padding: 0 8rpx;
}

.x-label {
  font-size: 22rpx;
  color: #999999;
  line-height: 30rpx;
}

/* 围度网格 */
.measurement-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.measurement-item {
  width: calc(33.33% - 11rpx);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #F0F0F0;
  border-radius: 24rpx;
  padding: 28rpx 0;
}

.measurement-value {
  font-size: 36rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 48rpx;
  margin-bottom: 8rpx;
}

.measurement-label {
  font-size: 22rpx;
  color: #666666;
  line-height: 30rpx;
}

.bottom-placeholder {
  height: 40rpx;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.record-modal {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  z-index: 1001;
  max-height: 70vh;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
}

.modal-close {
  font-size: 36rpx;
  color: #999999;
}

.modal-body {
  margin-bottom: 24rpx;
}

.modal-body-scroll {
  max-height: 50vh;
  margin-bottom: 24rpx;
}

.form-item {
  margin-bottom: 20rpx;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  margin-bottom: 12rpx;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: #F5F7FA;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #27282D;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 500;
}

.modal-btn.secondary {
  background: #F0F0F0;
  color: #666666;
}

.modal-btn.primary {
  background: #8DBB77;
  color: #FFFFFF;
}

/* 全屏趋势 */
.fullscreen-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.fullscreen-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  padding: 0;
}

.fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  flex-shrink: 0;
}

.fullscreen-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #27282D;
}

.fullscreen-close {
  font-size: 28rpx;
  color: #8DBB77;
}

.fullscreen-chart {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20rpx 40rpx 40rpx;
  min-height: 0;
}

.fullscreen-trend-svg {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.fullscreen-x-axis {
  display: flex;
  justify-content: space-between;
  padding: 0 8rpx;
  margin-top: 16rpx;
  flex-shrink: 0;
}

.fullscreen-x-label {
  font-size: 22rpx;
  color: #999999;
  line-height: 30rpx;
}
</style>
