<template>
  <AppPage :showHeader="true" title="习惯打卡">
  <view class="habit-page">
    <view class="habit-content">
      <!-- 日期切换 -->
      <view class="date-module">
        <view v-if="isExpanded" class="date-header">
          <text class="date-arrow" @click="prevMonth()">‹</text>
          <text class="date-title">{{ monthTitle }}</text>
          <text class="date-arrow" @click="nextMonth()">›</text>
        </view>

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

      <!-- 类型切换 -->
      <view class="type-tabs">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="type-tab"
          :class="{ active: currentType === tab.value }"
          @click="switchType(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <!-- 喝水 -->
      <view v-if="currentType === 'water'" class="habit-card">
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

      <!-- 睡眠 -->
      <view v-else-if="currentType === 'sleep'" class="habit-card">
        <text class="card-title">{{ selectedDate === today ? '今日睡眠' : selectedDateText }}</text>
        <view class="sleep-form">
          <view class="sleep-field">
            <text class="field-label">睡眠时长</text>
            <view class="field-input-row">
              <input v-model="sleepValue" class="field-input" type="digit" placeholder="0" />
              <text class="field-unit">小时</text>
            </view>
          </view>
          <view class="sleep-field">
            <text class="field-label">睡眠质量</text>
            <view class="quality-options">
              <view
                v-for="q in sleepQualityOptions"
                :key="q.value"
                class="quality-option"
                :class="{ active: sleepQuality === q.value }"
                @click="sleepQuality = q.value"
              >
                <text>{{ q.label }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="submit-btn" :class="{ disabled: !sleepValue }" @click="saveSleep">
          <text>保存睡眠</text>
        </view>
      </view>

      <!-- 排便 -->
      <view v-else-if="currentType === 'defecation'" class="habit-card">
        <text class="card-title">{{ selectedDate === today ? '今日排便' : selectedDateText }}</text>
        <view class="defecation-options">
          <view
            v-for="opt in defecationOptions"
            :key="opt.value"
            class="defecation-option"
            :class="{ active: defecationValue === opt.value }"
            @click="defecationValue = opt.value"
          >
            <text class="defecation-emoji">{{ opt.emoji }}</text>
            <text class="defecation-label">{{ opt.label }}</text>
          </view>
        </view>
        <view class="submit-btn" @click="saveDefecation">
          <text>保存记录</text>
        </view>
      </view>

      <!-- 心情 -->
      <view v-else-if="currentType === 'mood'" class="habit-card">
        <text class="card-title">记录心情</text>
        <text class="mood-tip">去心情页记录今日感受吧～</text>
        <view class="submit-btn" @click="goMood">
          <text>去记录心情</text>
        </view>
      </view>
    </view>
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { onShow, onLoad } from '@dcloudio/uni-app';
import { recordApi } from '../../api';
import { getToday, isFutureDate } from '../../utils/date';

const tabs = [
  { label: '喝水', value: 'water' },
  { label: '睡眠', value: 'sleep' },
  { label: '排便', value: 'defecation' },
  { label: '心情', value: 'mood' }
];

const currentType = ref('water');

const waterTotal = ref(0);
const waterRecordId = ref(null);
const undoStack = ref([]);
const cups = [100, 300, 500];

const sleepValue = ref('');
const sleepQuality = ref('good');
const sleepRecordId = ref(null);
const sleepQualityOptions = [
  { label: '很好', value: 'great' },
  { label: '不错', value: 'good' },
  { label: '一般', value: 'normal' },
  { label: '较差', value: 'poor' }
];

const defecationValue = ref(1);
const defecationRecordId = ref(null);
const defecationOptions = [
  { label: '正常', value: 1, emoji: '✅' },
  { label: '没有', value: 0, emoji: '❌' }
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const today = getToday();
const selectedDate = ref(today);

const selectedDateText = computed(() => {
  const d = new Date(selectedDate.value + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}.${m}`;
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
  // 下月补位：只补齐当前周；末行若没有当月日期则整行不展示
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const cur = new Date(year, month + 1, i);
    days.push(makeCalendarDay(cur, false));
  }
  // 末行校验：最后一周里「当月日期数 ≤ 2」（即 ≥5/7 都是下月日期），整周删除。
  // 避免月底 1-2 天 + 下月 5-6 天凑一周时，flex-wrap 拆开后最后出现仅 2-3 个零星下月日期的空白行。
  const weeks = Math.floor(days.length / 7);
  if (weeks >= 2) {
    const lastIdx = (weeks - 1) * 7;
    const lastWeek = days.slice(lastIdx, lastIdx + 7);
    const currentCount = lastWeek.filter(d => d.isCurrentMonth).length;
    if (currentCount <= 2) days.splice(lastIdx, 7);
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

function switchType(type) {
  currentType.value = type;
}

onLoad((options) => {
  if (options && options.type && tabs.some(t => t.value === options.type)) {
    currentType.value = options.type;
  }
});

onMounted(async () => {
  await loadHabits();
});

onShow(async () => {
  await loadHabits();
});

async function loadHabits() {
  try {
    const res = await recordApi.getHabits({ date: selectedDate.value });
    const list = res.data.list || [];

    const water = list.find(item => item.type === 'water');
    waterTotal.value = water ? Number(water.value) || 0 : 0;
    waterRecordId.value = water ? water.id : null;
    undoStack.value = [];

    const sleep = list.find(item => item.type === 'sleep');
    sleepValue.value = sleep ? Number(sleep.value) || '' : '';
    sleepQuality.value = sleep ? (sleep.remark || 'good') : 'good';
    sleepRecordId.value = sleep ? sleep.id : null;

    const def = list.find(item => item.type === 'defecation');
    defecationValue.value = def ? (Number(def.value) === 0 ? 0 : 1) : 1;
    defecationRecordId.value = def ? def.id : null;
  } catch (err) {
    console.error(err);
  }
}

import { showRewardToast } from '../../utils/rewardToast.js';

async function saveHabit(type, value, unit, remark, id) {
  const res = await recordApi.saveHabit({
    id: id || null,
    record_date: selectedDate.value,
    type,
    value,
    unit,
    remark
  });
  return res;
}

function showHabitReward(res, defaultTitle) {
  showRewardToast(res.data?.reward_messages || [], defaultTitle);
}

function selectDate(date) {
  if (isFutureDate(date)) {
    uni.showToast({ title: '不能添加未来日期的记录', icon: 'none' });
    return;
  }
  selectedDate.value = date;
  currentMonth.value = new Date(date + 'T00:00:00');
  loadHabits();
}

async function addWater(amount) {
  const oldTotal = waterTotal.value;
  waterTotal.value += amount;
  undoStack.value.push(amount);
  if (undoStack.value.length > 3) undoStack.value.shift();
  try {
    const res = await saveHabit('water', waterTotal.value, 'ml', '', waterRecordId.value);
    if (!waterRecordId.value && res && res.data && res.data.id) waterRecordId.value = res.data.id;
    showHabitReward(res, `已记录 ${waterTotal.value}ml`);
  } catch (e) {
    waterTotal.value = oldTotal;
    undoStack.value.pop();
    uni.showToast({ title: e.message || '记录失败', icon: 'none' });
  }
}

async function undoWater() {
  if (undoStack.value.length === 0) return;
  const amount = undoStack.value.pop();
  const oldTotal = waterTotal.value;
  waterTotal.value = Math.max(0, waterTotal.value - amount);
  try {
    const res = await saveHabit('water', waterTotal.value, 'ml', '', waterRecordId.value);
    if (!waterRecordId.value && res && res.data && res.data.id) waterRecordId.value = res.data.id;
    uni.showToast({ title: `已撤销 ${amount}ml`, icon: 'none' });
  } catch (e) {
    waterTotal.value = oldTotal;
    undoStack.value.push(amount);
    uni.showToast({ title: e.message || '撤销失败', icon: 'none' });
  }
}

async function saveSleep() {
  if (!sleepValue.value) {
    uni.showToast({ title: '请输入睡眠时长', icon: 'none' });
    return;
  }
  try {
    const res = await saveHabit('sleep', Number(sleepValue.value), '小时', sleepQuality.value, sleepRecordId.value);
    if (!sleepRecordId.value && res && res.data && res.data.id) sleepRecordId.value = res.data.id;
    showHabitReward(res, '睡眠已记录');
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' });
  }
}

async function saveDefecation() {
  try {
    const res = await saveHabit('defecation', defecationValue.value, '次', '', defecationRecordId.value);
    if (!defecationRecordId.value && res && res.data && res.data.id) defecationRecordId.value = res.data.id;
    showHabitReward(res, '排便已记录');
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' });
  }
}

function goMood() {
  uni.navigateTo({ url: '/pages/record/mood' });
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
  aspect-ratio: 1;
  padding: 8rpx 0;
  margin: 0 6rpx;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.date-week {
  font-size: 20rpx;
  font-weight: 600;
  color: #8F9098;
  margin-bottom: 2rpx;
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
  /* 左对齐：只剩 2-3 个日期时紧贴左侧，不出现两端空一大段的视觉效果 */
  justify-content: flex-start;
}

.calendar-day {
  width: 14.2857%;
  flex: 0 0 14.2857%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  border-radius: 50%;
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

.type-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: $spacing-md;
}

.type-tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  background: #FFFFFF;
  border-radius: 24rpx;
  font-size: 28rpx;
  color: #6B7280;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.type-tab.active {
  background: #8DBB77;
  color: #FFFFFF;
  font-weight: 600;
}

.habit-card {
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

.sleep-form {
  margin-bottom: $spacing-md;
}

.sleep-field {
  margin-bottom: $spacing-md;
}

.field-label {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
  margin-bottom: $spacing-sm;
}

.field-input-row {
  display: flex;
  align-items: center;
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.field-input {
  flex: 1;
  font-size: 32rpx;
  color: $text-primary;
}

.field-unit {
  font-size: $text-sm;
  color: $text-secondary;
  margin-left: 12rpx;
}

.quality-options {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.quality-option {
  padding: 14rpx 28rpx;
  background: #F9FAFB;
  border-radius: 24rpx;
  font-size: $text-sm;
  color: $text-secondary;
}

.quality-option.active {
  background: #8DBB77;
  color: #FFFFFF;
}

.defecation-options {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-md;
}

.defecation-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-md;
  background: #F9FAFB;
  border-radius: 24rpx;
}

.defecation-option.active {
  background: #DDF2D2;
}

.defecation-emoji {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.defecation-label {
  font-size: $text-sm;
  color: $text-secondary;
}

.mood-tip {
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: $spacing-md;
  display: block;
}

.submit-btn {
  text-align: center;
  background: #8DBB77;
  color: #FFFFFF;
  border-radius: $radius-pill;
  padding: 22rpx 0;
  font-size: $text-base;
  font-weight: $font-medium;
}

.submit-btn.disabled {
  background: #D1D5DB;
}
</style>
