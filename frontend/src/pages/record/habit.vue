<template>
  <view class="habit-page">
    <view class="header-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">喝水记录</text>
      <view class="header-right"></view>
    </view>
    <view class="habit-content">
        <!-- 日期切换 -->
        <view class="date-module">
          <!-- 展开：月历标题 -->
          <view v-if="isExpanded" class="date-header">
            <text class="date-arrow" @click="prevMonth()">‹</text>
            <text class="date-title">{{ monthTitle }}</text>
            <text class="date-arrow" @click="nextMonth()">›</text>
          </view>

          <!-- 折叠：周视图 -->
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
            </view>
          </view>

          <!-- 展开：月视图 -->
          <view v-else class="calendar-panel">
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

        <view class="water-card">
          <text class="card-title">{{ selectedDate === today ? '今日喝水' : selectedDateText }}</text>
          <view class="water-progress">
            <view class="water-fill" :style="{ width: Math.min((waterTotal / 2000) * 100, 100) + '%' }"></view>
          </view>
          <view class="water-info">
            <text class="water-value">{{ waterTotal }} ml</text>
            <text class="water-target">/ 2000 ml</text>
          </view>
          <view class="water-actions">
            <text v-for="cap in cups" :key="cap" class="cup-btn" @click="addWater(cap)">+{{ cap }}ml</text>
            <text class="cup-btn undo" :class="{ disabled: undoStack.length === 0 }" @click="undoWater">↩</text>
          </view>
        </view>
      </view>
    </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi } from '../../api';
import { getToday } from '../../utils/date';
import { goBack as navigateBack } from '../../utils/navigate';


const waterTotal = ref(0);
const waterRecordId = ref(null);
const undoStack = ref([]);
const cups = [100, 300, 500];
const statusBarHeight = ref(44);

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const today = getToday();
const selectedDate = ref(today);

const selectedDateText = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日喝水`;
});

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return start;
}

function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const weekDays = computed(() => {
  const start = getWeekStart(selectedDate.value);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const dateStr = formatLocalDate(cur);
    days.push({
      date: dateStr,
      day: cur.getDate(),
      weekLabel: WEEKDAYS[cur.getDay()],
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate.value
    });
  }
  return days;
});

const isExpanded = ref(false);
const currentMonth = ref(new Date(today + 'T00:00:00'));

const monthTitle = computed(() => {
  const d = currentMonth.value;
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
});

const calendarDays = computed(() => getCalendarDays(currentMonth.value));

function getCalendarDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const days = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const cur = new Date(year, month - 1, prevMonthLastDay - i);
    days.push(makeCalendarDay(cur, false));
  }
  for (let i = 1; i <= totalDays; i++) {
    const cur = new Date(year, month, i);
    days.push(makeCalendarDay(cur, true));
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const cur = new Date(year, month + 1, i);
    days.push(makeCalendarDay(cur, false));
  }
  return days;
}

function makeCalendarDay(d, isCurrentMonth) {
  const dateStr = formatLocalDate(d);
  return {
    date: dateStr,
    day: d.getDate(),
    isCurrentMonth,
    isToday: dateStr === today,
    isSelected: dateStr === selectedDate.value
  };
}

function toggleCalendar() {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    currentMonth.value = new Date(selectedDate.value + 'T00:00:00');
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

function goBack() {
  navigateBack('/pages/record/index');
}

onMounted(async () => {
  // #ifdef H5
  statusBarHeight.value = 44;
  // #endif
  // #ifndef H5
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 44;
  // #endif
  await loadHabits();
});

onShow(async () => {
  await loadHabits();
});

async function loadHabits() {
  try {
    const res = await recordApi.getHabits({ date: selectedDate.value });
    const list = res.data.list || [];
    // 按 created_at DESC 返回，取第一条作为当前最新喝水量
    const water = list.find(item => item.type === 'water');
    waterTotal.value = water ? water.value : 0;
    waterRecordId.value = water ? water.id : null;
    undoStack.value = [];
  } catch (err) {
    console.error(err);
  }
}

async function saveHabit(type, value, unit, remark) {
  try {
    const res = await recordApi.saveHabit({
      id: waterRecordId.value,
      record_date: selectedDate.value,
      type,
      value,
      unit,
      remark
    });
    // 新增时后端会返回 id，后续在此基础上更新而非重复插入
    if (!waterRecordId.value && res && res.data && res.data.id) {
      waterRecordId.value = res.data.id;
    }
  } catch (err) {
    console.error(err);
  }
}

function selectDate(date) {
  selectedDate.value = date;
  currentMonth.value = new Date(date + 'T00:00:00');
  loadHabits();
}

async function addWater(amount) {
  waterTotal.value += amount;
  undoStack.value.push(amount);
  if (undoStack.value.length > 3) {
    undoStack.value.shift();
  }
  await saveHabit('water', waterTotal.value, 'ml');
  uni.showToast({ title: `已记录 ${waterTotal.value}ml`, icon: 'none' });
}

async function undoWater() {
  if (undoStack.value.length === 0) return;
  const amount = undoStack.value.pop();
  waterTotal.value = Math.max(0, waterTotal.value - amount);
  await saveHabit('water', waterTotal.value, 'ml');
  uni.showToast({ title: `已撤销 ${amount}ml`, icon: 'none' });
}
</script>

<style lang="scss" scoped>
.habit-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: #F7FbF4;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 320rpx;
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
  font-size: 52rpx;
  color: #27282D;
  font-weight: 400;
  line-height: 1;
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  color: #27282D;
}

.header-right {
  width: 60rpx;
}

.habit-content {
  flex: 1;
  padding: $spacing-md;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.date-module {
  position: relative;
  z-index: 1;
  background: #FFFFFF;
  border-radius: 32rpx;
  box-shadow: 0 4rpx 32rpx rgba(0, 0, 0, 0.05);
  padding: 24rpx 20rpx;
  margin-bottom: $spacing-md;
}

.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 0 12rpx;
}

.date-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
}

.date-arrow {
  font-size: 40rpx;
  color: #757B8C;
  padding: 0 16rpx;
}

.date-bar {
  display: flex;
  justify-content: space-between;
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
  margin-bottom: 6rpx;
}

.date-day {
  font-size: 32rpx;
  color: #494A50;
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
  padding: 0 0 8rpx;
}

.calendar-weekdays {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding: 0 8rpx;
}

.calendar-weekday {
  width: 60rpx;
  text-align: center;
  font-size: 24rpx;
  color: #8F9098;
}

.calendar-days {
  display: flex;
  flex-wrap: wrap;
}

.calendar-day {
  width: 14.28%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 0;
}

.calendar-day-text {
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 28rpx;
  color: #494A50;
}

.calendar-day.other-month .calendar-day-text {
  color: #C5C5C7;
}

.calendar-day.today .calendar-day-text {
  background: #F6F6F6;
}

.calendar-day.selected .calendar-day-text {
  background: #8DBB77;
  color: #FFFFFF;
}

.toggle-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48rpx;
  margin-top: 8rpx;
}

.toggle-icon {
  width: 48rpx;
  height: 24rpx;
}

.water-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.card-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.water-progress {
  height: 32rpx;
  background: $sky-light;
  border-radius: $radius-pill;
  overflow: hidden;
  margin-bottom: $spacing-sm;
}

.water-fill {
  height: 100%;
  background: $sky;
  border-radius: $radius-pill;
  transition: width 0.3s ease;
}

.water-info {
  display: flex;
  align-items: baseline;
  margin-bottom: $spacing-md;
}

.water-value {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
}

.water-target {
  font-size: $text-sm;
  color: $text-secondary;
  margin-left: 8rpx;
}

.water-actions {
  display: flex;
  gap: $spacing-sm;
}

.cup-btn {
  flex: 1;
  text-align: center;
  background: #DDF2D2;
  color: #8DBB77;
  border-radius: $radius-pill;
  padding: 18rpx 0;
  font-size: $text-sm;
  font-weight: $font-medium;
}

.cup-btn.undo {
  flex: 0.6;
  font-size: $text-base;
}

.cup-btn.undo.disabled {
  opacity: 0.4;
}
</style>
