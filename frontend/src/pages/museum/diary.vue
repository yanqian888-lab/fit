<template>
  <view class="diary-page">
    <!-- 顶部渐变背景 -->
    <view class="header-bg"></view>

    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 页面标题栏 -->
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">每日日记</text>
      <view class="header-right"></view>
    </view>

    <scroll-view class="diary-scroll" scroll-y>
      <!-- 日期模块 -->
      <view class="date-module">
        <view class="calendar-panel">
          <view class="calendar-header">
            <view class="month-arrow" @click="prevMonth">
              <text class="arrow-icon left">‹</text>
            </view>
            <text class="calendar-title">{{ currentYear }}年{{ currentMonth + 1 }}月</text>
            <view class="month-arrow" @click="nextMonth">
              <text class="arrow-icon right">›</text>
            </view>
          </view>

          <view class="calendar-weekdays">
            <text v-for="day in weekdays" :key="day" class="calendar-weekday">{{ day }}</text>
          </view>

          <view class="calendar-days">
            <view
              v-for="(day, index) in calendarDays"
              :key="index"
              class="calendar-day"
              :class="{
                'other-month': !day.isCurrentMonth,
                today: day.isToday && !day.isSelected,
                selected: day.isSelected,
                'future-day': day.isFuture
              }"
              @click="selectDay(day)"
            >
              <text class="calendar-day-text" :class="{ 'future-text': day.isFuture }">{{ day.day }}</text>
              <view v-if="day.hasDiary && !day.isSelected" class="day-dot"></view>
            </view>
          </view>
        </view>
      </view>

      <view class="diary-cards">
        <view
          v-if="!selectedDate || selectedDate === todayStr"
          class="today-diary-card"
          @click="goToGenerateToday"
        >
          <view class="today-diary-main">
            <text class="today-diary-icon">✨</text>
            <view class="today-diary-info">
              <text class="today-diary-title">{{ todayDiaryTitle }}</text>
              <text class="today-diary-desc">{{ todayDiaryDesc }}</text>
            </view>
          </view>
          <text class="today-diary-arrow">›</text>
        </view>

        <view v-if="todayDiaryContent" class="diary-card">
          <view class="diary-header">
            <text class="diary-date">{{ todayStr }} 日记</text>
            <text class="diary-status">已生成</text>
          </view>
          <text class="diary-content">{{ todayDiaryContent }}</text>
        </view>

        <view v-if="selectedDate && selectedDate !== todayStr" class="diary-card">
          <view class="diary-header">
            <text class="diary-date">{{ selectedDate }} 日记</text>
            <text v-if="selectedDiary" class="diary-status">已生成</text>
            <text v-else class="diary-status pending">未生成</text>
          </view>
          <text v-if="selectedDiary" class="diary-content">{{ selectedDiary }}</text>
          <view v-else class="diary-empty">
            <image class="empty-image" src="/static/image/icon/quesheng01.png" mode="aspectFit" />
            <text class="empty-text">这一天还没有日记</text>
          </view>
        </view>

        <view v-if="monthlyDiary" class="diary-card monthly">
          <view class="diary-header">
            <text class="diary-date">{{ monthlyMonth }} 月度日记</text>
          </view>
          <text class="diary-content">{{ monthlyDiary }}</text>
        </view>

        <view class="bottom-placeholder"></view>
      </view>
    </scroll-view>

    <!-- 底部生成按钮 -->
    <view v-if="selectedDate && selectedDate !== todayStr" class="bottom-actions">
      <view
        class="add-btn-main"
        :class="{ disabled: loading }"
        @click="generateDailyDiary"
      >
        <image v-if="loading" class="btn-loading" src="/static/image/icon/loading01.svg" mode="aspectFit" />
        <text v-if="loading">生成中...</text>
        <text v-else>{{ selectedDiary ? '重新生成' : '生成日记' }}</text>
      </view>
    </view>

    <!-- 授权引导弹窗 -->
    <AuthPopup ref="authPopupRef" />

    <!-- 生成今日分析确认弹框 -->
    <AppModal
      v-model:visible="showGenerateModal"
      icon="none"
      title="生成今日分析"
      text="每天只能分析一次，请确认饮食、运动等相关数据已经记录完全，点击确认进入分析～"
      confirmText="确认"
      cancelText="取消"
      @confirm="confirmGenerateToday"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { aiApi, museumApi, recordApi } from '../../api';
import { checkPermission, reportCount } from '../../utils/trial.js';
import AuthPopup from '../../components/AuthPopup.vue';
import AppModal from '../../components/AppModal.vue';

import { goBack as navigateBack } from '../../utils/navigate';
import { showGlobalLoading, hideGlobalLoading } from '../../utils/loading';

// 生成今日分析确认弹框
const showGenerateModal = ref(false);

function formatFastingTime(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getFastingParams(date) {
  const dailyKey = `fasting_daily_${date}`;
  const settingsKey = 'fasting_settings';
  const params = { fasting_mode: '', eating_start: '', eating_end: '', fasting_status: '' };
  try {
    const dailyRaw = uni.getStorageSync(dailyKey);
    if (dailyRaw) {
      const daily = JSON.parse(dailyRaw);
      params.eating_start = formatFastingTime(daily.eatingStart);
      params.eating_end = formatFastingTime(daily.eatingEnd);
      params.fasting_status = daily.hasStartedToday ? '已开始' : '未开始';
    }
    const settingsRaw = uni.getStorageSync(settingsKey);
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      const legacyMap = { 16: '16:8', 18: '18:6', 20: '20:4', 14: '14:10' };
      const mode = legacyMap[settings.selectedMode] || settings.selectedMode;
      if (mode && typeof mode === 'string') {
        params.fasting_mode = mode;
      }
    }
  } catch (e) {
    console.error('读取断食状态失败:', e);
  }
  return params;
}

const statusBarHeight = ref(44);

const now = new Date();
const currentYear = ref(now.getFullYear());
const currentMonth = ref(now.getMonth());
const selectedDate = ref('');
const monthlyDiary = ref('');
const monthlyMonth = ref('');
const diaries = ref({});
const loading = ref(false);
const authPopupRef = ref(null);

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

const monthStr = computed(() => {
  return `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}`;
});

const todayStr = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  const startWeekday = firstDay.getDay();
  const days = [];

  // 补齐上月末尾日期
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    days.push({ date: null, day: d, isCurrentMonth: false, isFuture: false });
  }

  // 当月日期
  for (let d = 1; d <= totalDays; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month, d);
    const isFuture = dateObj > new Date();
    const isSelected = date === selectedDate.value;
    days.push({
      date,
      day: d,
      isCurrentMonth: true,
      hasDiary: !!diaries.value[date],
      isToday: date === todayStr.value,
      isSelected,
      isFuture
    });
  }

  // 补齐下月开头日期，保持固定 6 行
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: null, day: d, isCurrentMonth: false, isFuture: false });
  }

  return days;
});

const selectedDiary = computed(() => {
  return selectedDate.value ? diaries.value[selectedDate.value]?.content : '';
});

const selectedDiaryId = computed(() => {
  return selectedDate.value ? diaries.value[selectedDate.value]?.id : null;
});

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
  selectedDate.value = '';
  monthlyDiary.value = '';
  loadDiaries();
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
  selectedDate.value = '';
  monthlyDiary.value = '';
  loadDiaries();
}

function selectDay(day) {
  if (day.isFuture) return;

  // 点击上月/下月的日期时，自动切换月份
  if (!day.isCurrentMonth) {
    const isPrevMonth = day.day > 20;
    let y = currentYear.value;
    let m = currentMonth.value;
    if (isPrevMonth) {
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
    } else {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    if (new Date(date) > new Date()) return;
    currentYear.value = y;
    currentMonth.value = m;
    selectedDate.value = date;
    loadDiaries();
    return;
  }

  selectedDate.value = day.date;
}

function parseTags(tags) {
  if (!tags) return [];
  const str = String(tags).trim();
  if (str.startsWith('[')) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return [];
    }
  }
  // 兼容旧数据：'日记,2026-07-01' 这种未 JSON 化的字符串
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

async function loadDiaries() {
  showGlobalLoading();
  try {
    const res = await aiApi.getDiaryHistory({ month: monthStr.value, size: 200 });
    const list = res.data.list || [];
    const map = {};
    list.forEach(item => {
      if (item.date) {
        // 日记内容在列表页完整展示，不再跳详情页
        map[item.date] = { id: item.id, content: item.content || item.summary || '' };
      }
    });
    diaries.value = map;
  } catch (err) {
    console.error(err);
  } finally {
    hideGlobalLoading();
  }
}

function goBack() {
  navigateBack('/pages/museum/index');
}

function goToGenerateToday() {
  // 已生成：直接查看（服务端幂等返回当天日记）；首次生成：二次确认后进入生成页
  if (diaries.value[todayStr.value]) {
    uni.navigateTo({ url: `/pages/museum/diary-generate?date=${todayStr.value}` });
    return;
  }
  showGenerateModal.value = true;
}

/**
 * 确认进入生成今日分析页
 */
function confirmGenerateToday() {
  showGenerateModal.value = false;
  uni.navigateTo({ url: `/pages/museum/diary-generate?date=${todayStr.value}` });
}

const todayDiaryTitle = computed(() => {
  return diaries.value[todayStr.value] ? '今日分析已生成' : '生成今日分析';
});

const todayDiaryDesc = computed(() => {
  return diaries.value[todayStr.value] ? '点击重新生成今日分析' : 'AI 将根据今日记录生成专属分析';
});

const todayDiaryContent = computed(() => {
  return diaries.value[todayStr.value]?.content || '';
});

async function generateDailyDiary() {
  if (loading.value) return;

  // 试用权限校验
  const perm = await checkPermission('diary');
  if (!perm.allow_use) {
    if (perm.show_popup && authPopupRef.value) {
      authPopupRef.value.show(perm.popup_config);
    }
    return;
  }

  // 检查所选日期是否有记录（历史日期不能再用「今日记录」判断）
  try {
    const [dietRes, exerciseRes] = await Promise.all([
      recordApi.getDiet(selectedDate.value),
      recordApi.getExercise(selectedDate.value)
    ]);
    const diet = dietRes.data || {};
    const exercise = exerciseRes.data || {};
    const hasRecords = (diet.total_calorie || 0) > 0 ||
                       (exercise.total_calorie || 0) > 0 ||
                       (exercise.total_duration || 0) > 0;

    if (!hasRecords) {
      uni.showToast({ title: '这一天没有记录，无法生成日记', icon: 'none' });
      return;
    }
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '检查记录失败，请重试', icon: 'none' });
    return;
  }

  loading.value = true;
  showGlobalLoading({ text: '正在生成日记…' });
  try {
    const res = await aiApi.generateDiary(selectedDate.value, getFastingParams(selectedDate.value));
    diaries.value[selectedDate.value] = res.data.diary;
    uni.showToast({ title: '日记已生成', icon: 'success' });
    // 成功后上报日记生成次数
    reportCount('diary');
  } catch (err) {
    console.error('生成日记失败:', err);
    // 具体错误文案（余额不足、记录不全、AI/网络异常等）已在 request.js 中提示
  } finally {
    loading.value = false;
    hideGlobalLoading();
  }
}

onMounted(() => {
  // #ifdef H5
  statusBarHeight.value = 44;
  // #endif
  // #ifndef H5
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 44;
  // #endif

  loadDiaries();
  selectedDate.value = todayStr.value;
});
</script>

<style lang="scss" scoped>
.diary-page {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
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

.diary-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  padding: 0 32rpx;
}

.bottom-placeholder {
  height: 160rpx;
}

.diary-cards {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 24rpx;
}

.today-diary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $cream-light;
  border-radius: 32rpx;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}

.today-diary-main {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.today-diary-icon {
  font-size: 56rpx;
}

.today-diary-info {
  display: flex;
  flex-direction: column;
}

.today-diary-title {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
}

.today-diary-desc {
  font-size: $text-sm;
  color: $text-secondary;
  margin-top: 6rpx;
}

.today-diary-arrow {
  font-size: 48rpx;
  color: $text-tertiary;
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

  &.left {
    margin-left: -8rpx;
  }

  &.right {
    margin-right: -8rpx;
  }
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
  height: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  border-radius: 50%;
  position: relative;

  &.other-month .calendar-day-text {
    color: #999999;
  }

  &.today {
    background: #F0F0F0;
  }

  &.selected {
    background: #8DBB77;

    .calendar-day-text {
      color: #FFFFFF;
      font-weight: 700;
    }
  }

  &.future-day {
    opacity: 0.5;
    pointer-events: none;
  }
}

.calendar-day-text {
  font-size: 26rpx;
  font-weight: 400;
  color: #27282D;
  line-height: 1;

  &.future-text {
    color: #999999;
  }
}

.day-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #FBE386;
  margin-top: 4rpx;
}

.diary-card {
  background: $bg-card;
  border-radius: 32rpx;
  padding: $spacing-md;
  box-shadow: $shadow-card;
}

.diary-card.monthly {
  background: $cream-light;
}

.diary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.diary-date {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
}

.diary-status {
  font-size: $text-xs;
  color: $mint-dark;
  background: $mint-light;
  padding: 4rpx 16rpx;
  border-radius: $radius-pill;
}

.diary-status.pending {
  color: $text-secondary;
  background: $gray-100;
}

.diary-content {
  font-size: $text-base;
  color: $text-primary;
  line-height: 1.8;
  display: block;
}

.diary-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-md 0;
}

.empty-image {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: $spacing-sm;
}

.empty-text {
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
}

/* 底部按钮 */
.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 48rpx calc(24rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(240, 240, 240, 0) 0%, #F0F0F0 40%);
  z-index: 100;
}

.add-btn-main {
  height: 92rpx;
  background: #8DBB77;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  color: #FFFFFF;
  font-weight: 400;

  &.disabled {
    opacity: 0.7;
  }
}

.add-btn-main:active {
  opacity: 0.9;
}

.btn-loading {
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
