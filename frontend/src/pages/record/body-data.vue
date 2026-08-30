<template>
  <AppPage :showHeader="true" :fixed="true" title="身体数据">
  <view class="body-page">
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
            <view v-if="chartPoints.length > 0" class="trend-svg">
              <view
                v-for="(seg, idx) in chartSegments"
                :key="'seg'+idx"
                class="trend-segment"
                :style="seg.style"
              ></view>
              <view
                v-for="(point, idx) in chartPoints"
                :key="'pt'+idx"
                class="trend-point"
                :style="{ left: (point.x / 320 * 100) + '%', top: (point.y / 120 * 100) + '%' }"
              >
                <view class="trend-dot"></view>
                <text class="chart-value">{{ point.value }}</text>
              </view>
            </view>
            <view v-else class="chart-empty">
              <text>记录体重后查看趋势</text>
            </view>
          </view>
          <view class="x-axis">
            <text
              v-for="(point, idx) in chartPoints"
              :key="idx"
              class="x-label"
              :style="{ left: (point.x / 320 * 100) + '%' }"
            >{{ point.date }}</text>
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
          <view v-if="fullscreenPoints.length > 0" class="fullscreen-trend-svg">
            <view
              v-for="(seg, idx) in fullscreenSegments"
              :key="'fseg'+idx"
              class="trend-segment fullscreen"
              :style="seg.style"
            ></view>
            <view
              v-for="(point, idx) in fullscreenPoints"
              :key="'fpt'+idx"
              class="trend-point fullscreen"
              :style="{ left: (point.x / 320 * 100) + '%', top: (point.y / 160 * 100) + '%' }"
            >
              <view class="trend-dot fullscreen"></view>
              <text class="chart-value fullscreen">{{ point.value }}</text>
            </view>
          </view>
          <view class="fullscreen-x-axis">
            <text v-for="(point, idx) in fullscreenPoints" :key="idx" class="fullscreen-x-label">{{ point.date }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi } from '../../api';
import { showRewardToast } from '../../utils/rewardToast.js';
import { getToday, formatDate, isFutureDate } from '../../utils/date';

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
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}.${m}`;
});

// 数据
const weightList = ref([]);
const currentWeight = ref(null);
const bodyFatRate = ref(null);
const initialWeight = ref(null);
const targetWeight = ref(null);
const userHeight = ref(null);
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
  const h = parseFloat(userHeight.value);
  if (!w || !h || h <= 0) return '--';
  const heightM = h / 100;
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
      date: item.date?.slice(5).replace('-', '.') || '',
      value: item.value,
      x: Math.round(x),
      y: Math.round(y)
    };
  });
});

// 小程序端不支持 svg，用 view + rotate 模拟每段折线
const chartSegments = computed(() => {
  const pts = chartPoints.value;
  if (pts.length < 2) return [];
  // viewBox 320 x 120，宽高比固定
  const VB_W = 320;
  const VB_H = 120;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    // 角度按 viewBox 坐标系算（容器宽高比与 viewBox 一致时视觉无失真）
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segs.push({
      style: {
        left: (p1.x / VB_W * 100) + '%',
        top: (p1.y / VB_H * 100) + '%',
        width: (length / VB_W * 100) + '%',
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 50%'
      }
    });
  }
  return segs;
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
      date: item.date?.slice(5).replace('-', '.') || '',
      value: item.value,
      x: Math.round(x),
      y: Math.round(y)
    };
  });
});

// 全屏趋势的折线段（viewBox 320 x 160）
const fullscreenSegments = computed(() => {
  const pts = fullscreenPoints.value;
  if (pts.length < 2) return [];
  const VB_W = 320;
  const VB_H = 160;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segs.push({
      style: {
        left: (p1.x / VB_W * 100) + '%',
        top: (p1.y / VB_H * 100) + '%',
        width: (length / VB_W * 100) + '%',
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 50%'
      }
    });
  }
  return segs;
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

  // 下月补位：只补齐当前周；末行若没有当月日期则整行不展示
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const cur = new Date(year, month + 1, i);
    const curStr = formatDate(cur.toISOString());
    days.push({ date: curStr, day: cur.getDate(), isCurrentMonth: false, isToday: curStr === today, isSelected: curStr === selectedDate.value, hasRecord: recordDates.value.has(curStr) });
  }
  // 末行校验：最后一周完全没有当月日期时才删除。
  // 关键修复：原逻辑「当月日期数 ≤ 2 即删除」会导致月底日期被从当月日历移除。
  const weeks = Math.floor(days.length / 7);
  if (weeks >= 2) {
    const lastIdx = (weeks - 1) * 7;
    const lastWeek = days.slice(lastIdx, lastIdx + 7);
    const currentCount = lastWeek.filter(d => d.isCurrentMonth).length;
    if (currentCount === 0) days.splice(lastIdx, 7);
  }
  return days;
}

/**
 * 选择日期并加载该日期的数据
 * @param {string} date - 日期字符串 YYYY-MM-DD
 */
function selectDate(date) {
  if (isFutureDate(date)) {
    uni.showToast({ title: '不能添加未来日期的记录', icon: 'none' });
    return;
  }
  selectedDate.value = date;
  currentMonth.value = parseLocalDate(date);
  // 清空旧的记录日期，避免重复
  recordDates.value.clear();
  // 加载数据（loadWeight 内部会调用 updateCurrentData 更新UI）
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

/**
 * 加载所有身体数据（体重、围度、个人资料）
 * 顺序加载确保数据一致性
 */
async function loadData() {
  await loadWeight();
  await loadMeasurements();
  await loadProfile();
}

/**
 * 加载体重数据并更新UI
 */
async function loadWeight() {
  try {
    // 清空旧数据，确保显示最新数据
    recordDates.value.clear();
    const res = await recordApi.getBody({ type: 'weight', days: 365 });
    weightList.value = res.data.list || [];
    // 更新记录日期集合，用于日历显示
    (res.data.list || []).forEach(item => recordDates.value.add(item.date));
    // 根据当前选中日期更新UI显示
    updateCurrentData();
  } catch (err) {
    console.error(err);
  }
}

/**
 * 根据选中日期更新当前显示的体重数据
 * 优先显示选中日期当天的记录，若无则显示该日期之前最近的一条
 */
function updateCurrentData() {
  // 如果 weightList 还未加载完成，延迟更新
  if (!weightList.value || weightList.value.length === 0) {
    currentWeight.value = null;
    bodyFatRate.value = null;
    return;
  }
  
  const selected = selectedDate.value;
  // 优先查找选中日期当天的记录
  let record = weightList.value.find(item => item.date === selected);
  // 如果没有当天记录，查找该日期之前最近的一条
  if (!record) {
    record = weightList.value.find(item => item.date < selected);
  }

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
    if (data.height) {
      userHeight.value = data.height;
    }
  } catch (err) {
    console.error(err);
  }
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
    const res = await recordApi.saveBody({
      record_date: selectedDate.value,
      type: 'weight',
      value: parseFloat(weightForm.value.value),
      unit: 'kg',
      body_fat: bodyFat
    });
    showRewardToast(res.data?.reward_messages || [], '保存成功');
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
      uni.showToast({ title: '请输入数据后再保存哦！', icon: 'none' });
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
  loadData();
});

onShow(() => {
  loadData();
});
// 注意：不再使用 watch(selectedDate, updateCurrentData) 
// 因为 loadWeight 完成后会自动调用 updateCurrentData
// 避免在数据未加载完成时显示过时数据
</script>

<style lang="scss" scoped>
.body-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
  overflow: hidden;
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
  letter-spacing: 0.5rpx;
  margin-bottom: 2rpx;
  line-height: 24rpx;
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
  justify-content: flex-start;
  padding: 0 8rpx;
}

.calendar-day {
  width: 14.2857%;
  flex: 0 0 14.2857%;
  aspect-ratio: 1;
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
  position: relative;
}

/* 折线段：view + rotate 模拟 */
.trend-segment {
  position: absolute;
  height: 2rpx;
  background: #8DBB77;
  transform-origin: 0 50%;
}

.trend-segment.fullscreen {
  height: 3rpx;
}

/* 数据点 */
.trend-point {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 80rpx;
}

.trend-point.fullscreen {
  width: 96rpx;
}

.trend-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #8DBB77;
  margin-bottom: 4rpx;
}

.trend-dot.fullscreen {
  width: 16rpx;
  height: 16rpx;
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
  position: relative;
  height: 30rpx;
  margin-top: 8rpx;
  padding: 0;
}

.x-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 22rpx;
  color: #999999;
  line-height: 30rpx;
  text-align: center;
  white-space: nowrap;
}

/* 围度网格 —— 3列一行，使用 calc 精确计算宽度避免 gap + 百分比溢出 */
.measurement-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.measurement-item {
  width: calc((100% - 32rpx) / 3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #F0F0F0;
  border-radius: 24rpx;
  padding: 28rpx 0;
  box-sizing: border-box;
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
  height: 32rpx;
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
  position: relative;
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
