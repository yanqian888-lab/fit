<template>
  <view class="record-page">
    <view class="status-bar"></view>

    <view class="page-header">
      <text class="header-date">{{ todayDate }}</text>
      <text class="header-title">今日记录</text>
    </view>

    <!-- 今日摄入卡片 -->
    <view class="intake-card">
      <text class="intake-card-title">今日摄入</text>
      <view class="intake-main">
        <view class="intake-ring-wrap">
          <svg viewBox="0 0 100 100" class="intake-ring">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#FFFFFF" stroke-width="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#8DBB77" stroke-width="8" stroke-linecap="round" stroke-dasharray="264" :stroke-dashoffset="intakeRingDashoffset" transform="rotate(-90 50 50)" />
          </svg>
          <view class="intake-ring-center">
            <text class="intake-ring-value">{{ todayStats.intake || 0 }}</text>
            <text class="intake-ring-label">剩余{{ todayStats.remaining || 0 }}kcal</text>
          </view>
        </view>

        <view class="macros">
          <view class="macro-row" v-for="m in macroList" :key="m.name">
            <text class="macro-name">{{ m.name }}</text>
            <view class="macro-bar-bg">
              <view class="macro-bar-fill" :style="{ width: m.percent + '%' }"></view>
            </view>
            <text class="macro-value">{{ m.current }}/{{ m.target }}g</text>
          </view>
        </view>
      </view>

      <view class="weight-bar">
        <view class="weight-bar-left">
          <text class="weight-label">今日体重</text>
          <view class="weight-value-row">
            <text class="weight-value">{{ todayStats.current_weight || '--' }}</text>
            <text class="weight-unit">kg</text>
          </view>
        </view>
        <view class="weight-bar-right">
          <view class="weight-stat-row">
            <text class="weight-stat-label">已减</text>
            <text class="weight-stat-value">{{ weightLost }}kg</text>
          </view>
          <view class="weight-stat-row">
            <text class="weight-stat-label">目标</text>
            <text class="weight-stat-value">{{ todayStats.target_weight || '--' }}kg</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-actions">
      <view class="action-item" @click="goTo('/pages/record/diet-detail')">
        <view class="action-icon-box">
          <image class="action-icon-img" src="/static/image/icon/jiyinshi.png" mode="aspectFit" />
        </view>
        <text class="action-label">记饮食</text>
      </view>
      <view class="action-item" @click="goTo('/pages/record/exercise-detail')">
        <view class="action-icon-box">
          <image class="action-icon-img" src="/static/image/icon/jiyundong.png" mode="aspectFit" />
        </view>
        <text class="action-label">记运动</text>
      </view>
      <view class="action-item" @click="goTo('/pages/record/body-data')">
        <view class="action-icon-box">
          <image class="action-icon-img" src="/static/image/icon/jitizhong.png" mode="aspectFit" />
        </view>
        <text class="action-label">记体重</text>
      </view>
      <view class="action-item" @click="goTo('/pages/record/habit')">
        <view class="action-icon-box">
          <image class="action-icon-img" src="/static/image/icon/jiheshui.png" mode="aspectFit" />
        </view>
        <text class="action-label">记喝水</text>
      </view>
    </view>

    <!-- 轻断食打卡 -->
    <view class="fasting-card">
      <view class="fasting-header">
        <text class="fasting-title">轻断食打卡</text>
        <view class="fasting-edit" @click="openFastingPanel">
          <text class="fasting-edit-text">编辑</text>
          <image class="fasting-edit-icon" src="/static/image/icon/xiugai.png" mode="aspectFit" />
        </view>
      </view>
      <view class="fasting-body">
        <view class="fasting-ring-wrap">
          <svg viewBox="0 0 100 100" class="fasting-ring">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(204,204,204,0.8)" stroke-width="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#8DBB77" stroke-width="8" stroke-linecap="round" stroke-dasharray="264" :stroke-dashoffset="fastingRingDashoffset" transform="rotate(-90 50 50)" />
          </svg>
          <view class="fasting-ring-center">
            <text class="fasting-ring-value">{{ countdownText }}</text>
            <text class="fasting-ring-label">{{ eatingHint }}</text>
          </view>
        </view>

        <view class="fasting-info">
          <view class="fasting-time-row">
            <view class="fasting-time-col">
              <text class="fasting-time-label">开始用餐</text>
              <text class="fasting-time-value">{{ formatTime(eatingStart) }}</text>
            </view>
            <view class="fasting-time-col">
              <text class="fasting-time-label">结束用餐</text>
              <text class="fasting-time-value">{{ formatTime(eatingEnd) }}</text>
            </view>
          </view>
          <view class="fasting-action-btn" :class="{ disabled: fastingDisabled }" @click="onFastingAction">
            <text>{{ fastingActionText }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 生成今日分析 -->
    <view class="diary-btn" @click="generateDiary">
      <text>生成今日分析</text>
    </view>

    <!-- 轻断食设置面板 -->
    <view class="panel-overlay" :class="{ show: showFastingPanel }" @click="closeFastingPanel"></view>
    <view class="fasting-panel" :class="{ show: showFastingPanel }">
      <view class="panel-header">
        <text class="panel-title">轻断食设置</text>
        <text class="panel-close" @click="closeFastingPanel">✕</text>
      </view>
      <view class="mode-list">
        <view v-for="mode in fastingModes" :key="mode.value" class="mode-item" :class="{ active: panelSelectedMode === mode.value }" @click="panelSelectedMode = mode.value">
          <text class="mode-label">{{ mode.label }}</text>
          <text class="mode-desc">{{ mode.desc }}</text>
        </view>
      </view>
      <view class="time-picker-wrap">
        <view class="time-display-row">
          <view class="time-display-item">
            <text class="time-display-label">用餐开始</text>
            <text class="time-display-value">{{ formatTime(panelEatingStart) }}</text>
          </view>
          <view class="time-display-arrow">→</view>
          <view class="time-display-item">
            <text class="time-display-label">用餐结束</text>
            <text class="time-display-value">{{ formatTime(panelEatingEnd) }}</text>
          </view>
        </view>
        <text class="time-picker-label">用餐开始时间</text>
        <picker-view class="picker-view" :value="panelStartTimeValue" @change="onStartTimeChange" indicator-style="height: 60rpx; line-height: 60rpx;" style="height: 300rpx;">
          <picker-view-column>
            <view class="picker-col" v-for="h in 24" :key="h">{{ String(h-1).padStart(2,'0') }}</view>
          </picker-view-column>
          <picker-view-column>
            <view class="picker-col-label">时</view>
          </picker-view-column>
          <picker-view-column>
            <view class="picker-col" v-for="m in 12" :key="m">{{ String((m-1)*5).padStart(2,'0') }}</view>
          </picker-view-column>
          <picker-view-column>
            <view class="picker-col-label">分</view>
          </picker-view-column>
        </picker-view>
      </view>
      <view class="panel-actions">
        <AppButton type="cancel-gray" @click="closeFastingPanel">取消</AppButton>
        <AppButton type="confirm-light" @click="confirmFastingSettings">确定</AppButton>
      </view>
    </view>

    <!-- 当天用餐时间调整弹窗 -->
    <view class="panel-overlay" :class="{ show: showDailyAdjustPanel }" @click="closeDailyAdjustPanel"></view>
    <view class="fasting-panel daily-adjust-panel" :class="{ show: showDailyAdjustPanel }">
      <view class="panel-header">
        <text class="panel-title">调整今日用餐时间</text>
        <text class="panel-close" @click="closeDailyAdjustPanel">✕</text>
      </view>
      <view class="time-picker-wrap daily-adjust">
        <view class="time-pickers-row">
          <view class="picker-section single-picker">
            <text class="time-picker-label">用餐开始</text>
            <text class="time-picker-value">{{ formatTime(dailyAdjustStart) }}</text>
            <picker-view class="picker-view" :value="dailyAdjustTimeValue" @change="onDailyAdjustTimeChange" indicator-style="height: 60rpx; line-height: 60rpx;" style="height: 300rpx;">
              <picker-view-column>
                <view class="picker-col" v-for="h in 24" :key="h">{{ String(h-1).padStart(2,'0') }}</view>
              </picker-view-column>
              <picker-view-column>
                <view class="picker-col-label">时</view>
              </picker-view-column>
              <picker-view-column>
                <view class="picker-col" v-for="m in 12" :key="m">{{ String((m-1)*5).padStart(2,'0') }}</view>
              </picker-view-column>
              <picker-view-column>
                <view class="picker-col-label">分</view>
              </picker-view-column>
            </picker-view>
          </view>
        </view>
      </view>
      <view class="panel-actions">
        <AppButton type="cancel-gray" @click="closeDailyAdjustPanel">取消</AppButton>
        <AppButton type="confirm-light" @click="confirmDailyAdjust">确定打卡</AppButton>
      </view>
    </view>

    <CustomTabBar />
  </view>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi, aiApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppButton from '../../components/AppButton.vue';
import CustomTabBar from '../../custom-tab-bar/index.vue';
import { getToday } from '../../utils/date';

const today = getToday();
const todayStats = ref({
  intake: 0, burned: 0, remaining: 0, target: 1500, status: 'green',
  current_weight: null, initial_weight: null, target_weight: null,
  protein: 0, protein_target: 0, carb: 0, carb_target: 0, fat: 0, fat_target: 0,
  weight_days: 1
});

// ========== 日期计算 ==========
const todayDate = computed(() => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[d.getDay()];
  return `${year}年${month}月${date}日 · ${weekday}`;
});

const weekdayShort = computed(() => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[new Date().getDay()];
});

const overviewDay = computed(() => {
  // 从用户注册日期计算今天是第几天（后端已返回 weight_days）
  return todayStats.value.weight_days || 1;
});

const weightLost = computed(() => {
  const current = todayStats.value.current_weight;
  const initial = todayStats.value.initial_weight;
  if (current && initial) {
    return (initial - current).toFixed(2);
  }
  return '0.0';
});

const intakePercent = computed(() => {
  const intake = todayStats.value.intake || 0;
  const target = todayStats.value.target || 1500;
  return Math.min(100, Math.round((intake / target) * 100));
});

const proteinPercent = computed(() => {
  const current = todayStats.value.protein || 0;
  const target = todayStats.value.protein_target || 1;
  return Math.min(100, Math.round((current / target) * 100));
});

const carbPercent = computed(() => {
  const current = todayStats.value.carb || 0;
  const target = todayStats.value.carb_target || 1;
  return Math.min(100, Math.round((current / target) * 100));
});

const fatPercent = computed(() => {
  const current = todayStats.value.fat || 0;
  const target = todayStats.value.fat_target || 1;
  return Math.min(100, Math.round((current / target) * 100));
});


const intakeRingDashoffset = computed(() => {
  const p = intakePercent.value || 0;
  return 264 - (264 * p / 100);
});

const fastingRingDashoffset = computed(() => {
  const p = Math.min(100, Math.max(0, eatingProgress.value || 0));
  // 圆环表示“剩余进度”，开始时 full（offset=0），结束时 empty（offset=264）
  return 264 * (p / 100);
});

const macroList = computed(() => [
  { name: '蛋白质', current: todayStats.value.protein || 0, target: todayStats.value.protein_target || 0, percent: proteinPercent.value },
  { name: '碳水', current: todayStats.value.carb || 0, target: todayStats.value.carb_target || 0, percent: carbPercent.value },
  { name: '脂肪', current: todayStats.value.fat || 0, target: todayStats.value.fat_target || 0, percent: fatPercent.value }
]);

const fastingActionText = computed(() => {
  if (!hasStartedToday.value) {
    // 只要今天还没手动打卡，按钮就一直高亮可点
    return '开始用餐打卡';
  }
  if (isInEatingWindow.value) return '提前结束用餐';
  return '今日已完成';
});

const fastingDisabled = computed(() => {
  // 今天还没手动打卡时，按钮始终可点；只有已打卡且用餐窗口结束后才置灰
  if (!hasStartedToday.value) return false;
  if (hasStartedToday.value && !isInEatingWindow.value) return true;
  return false;
});

function onFastingAction() {
  if (fastingDisabled.value) return;
  if (!hasStartedToday.value) startEating();
  else if (isInEatingWindow.value) endEatingEarly();
}

// ========== 轻断食（保留原有逻辑） ==========
const FASTING_SETTINGS_KEY = 'fasting_settings';
function getFastingDailyKey() { return 'fasting_daily_' + getToday(); }

const fastingModes = [
  { label: '16:8', value: 16, desc: '16小时断食，8小时用餐' },
  { label: '18:6', value: 18, desc: '18小时断食，6小时用餐' },
  { label: '20:4', value: 20, desc: '20小时断食，4小时用餐' },
  { label: '14:10', value: 14, desc: '14小时断食，10小时用餐' }
];

const selectedMode = ref(16);
const eatingStart = ref(null);
const eatingEnd = ref(null);
const hasStartedToday = ref(false);
const showFastingPanel = ref(false);
const startTimeValue = ref([8, 0, 0, 0]);
// 设置面板独立的预览状态，避免已打卡时拖动设置直接改动今天时间
const panelSelectedMode = ref(16);
const panelStartTimeValue = ref([8, 0, 0, 0]);
const panelEatingStart = ref(null);
const panelEatingEnd = ref(null);
const panelEatingDuration = computed(() => Math.max(1, 24 - panelSelectedMode.value));
watch(panelSelectedMode, () => {
  // 在设置面板中切换模式时，实时刷新结束时间预览
  if (showFastingPanel.value && panelEatingStart.value) {
    panelEatingEnd.value = panelEatingStart.value + panelEatingDuration.value * 3600000;
  }
});
const countdownTimer = ref(null);
const countdownText = ref('--:--');

const eatingDuration = computed(() => Math.max(1, 24 - selectedMode.value));
const fastingModeText = computed(() => {
  const mode = fastingModes.find(m => m.value === selectedMode.value);
  return mode ? mode.label + ' 轻断食' : '16:8 轻断食';
});

const isInEatingWindow = computed(() => {
  if (!eatingStart.value || !eatingEnd.value) return false;
  const now = Date.now();
  return now >= eatingStart.value && now < eatingEnd.value;
});

const eatingStatusText = computed(() => {
  const now = Date.now();
  if (!eatingStart.value || !eatingEnd.value) return '未设置';
  // 设置时间会自动轮转；手动打卡只影响当天是否按用户时间走
  if (!hasStartedToday.value) {
    if (now < eatingStart.value) return '等待中';
    if (now >= eatingEnd.value) return '已完成';
    return '用餐中';
  }
  if (now < eatingStart.value) return '断食中';
  if (now < eatingEnd.value) return '用餐中';
  return '已完成';
});

const eatingHint = computed(() => {
  if (!eatingStart.value || !eatingEnd.value) return '请设置用餐时间';
  return '用餐倒计时';
});

const eatingProgress = computed(() => {
  if (!eatingStart.value || !eatingEnd.value) return 0;
  const now = Date.now();
  const total = eatingEnd.value - eatingStart.value;
  if (now < eatingStart.value) {
    const fastingStart = eatingStart.value - (24 - eatingDuration.value) * 3600000;
    const fastingTotal = eatingStart.value - fastingStart;
    const fastingElapsed = now - fastingStart;
    if (fastingElapsed <= 0) return 0;
    if (fastingElapsed >= fastingTotal) return 100;
    return Math.round((fastingElapsed / fastingTotal) * 100);
  }
  const elapsed = now - eatingStart.value;
  if (elapsed >= total) return 100;
  if (elapsed <= 0) return 0;
  return Math.round((elapsed / total) * 100);
});

const fastingRingTransform = computed(() => 'rotate(-90 50 50)');

function formatTime(ts) {
  if (!ts) return '--:--';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function updateCountdown() {
  if (!eatingEnd.value) { countdownText.value = '--:--'; return; }
  const now = Date.now();
  let target;
  if (now < eatingStart.value) target = eatingStart.value;
  else if (now < eatingEnd.value) target = eatingEnd.value;
  else { countdownText.value = '00:00'; return; }
  const diff = target - now;
  if (diff <= 0) { countdownText.value = '00:00'; return; }
  const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  countdownText.value = `${h}:${m}`;
}

const showDailyAdjustPanel = ref(false);
const dailyAdjustTimeValue = ref([11, 0, 0, 0]);
const dailyAdjustEndValue = ref([19, 0, 0, 0]);
const dailyAdjustStart = ref(null);
const dailyAdjustEnd = ref(null);

function openDailyAdjustPanel() {
  const hour = startTimeValue.value[0];
  const minute = startTimeValue.value[2];
  const start = new Date();
  start.setHours(hour, minute * 5, 0, 0);
  dailyAdjustStart.value = start.getTime();
  dailyAdjustEnd.value = dailyAdjustStart.value + eatingDuration.value * 3600000;
  const endHour = new Date(dailyAdjustEnd.value).getHours();
  const endMinute = Math.floor(new Date(dailyAdjustEnd.value).getMinutes() / 5);
  dailyAdjustTimeValue.value = [hour, 0, minute, 0];
  dailyAdjustEndValue.value = [endHour, 0, endMinute, 0];
  showDailyAdjustPanel.value = true;
}

function closeDailyAdjustPanel() { showDailyAdjustPanel.value = false; }

function onDailyAdjustTimeChange(e) {
  const val = e.detail.value;
  dailyAdjustTimeValue.value = val;
  const hour = val[0];
  const minute = val[2] * 5;
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  dailyAdjustStart.value = start.getTime();
  // 保持当前模式的用餐时长，联动更新结束时间
  dailyAdjustEnd.value = dailyAdjustStart.value + eatingDuration.value * 3600000;
  const endHour = new Date(dailyAdjustEnd.value).getHours();
  const endMinute = Math.floor(new Date(dailyAdjustEnd.value).getMinutes() / 5);
  dailyAdjustEndValue.value = [endHour, 0, endMinute, 0];
}

function onDailyAdjustEndChange(e) {
  const val = e.detail.value;
  dailyAdjustEndValue.value = val;
  const hour = val[0];
  const minute = val[2] * 5;
  const end = new Date();
  end.setHours(hour, minute, 0, 0);
  if (end.getTime() < dailyAdjustStart.value) end.setDate(end.getDate() + 1);
  dailyAdjustEnd.value = end.getTime();
}

function confirmDailyAdjust() {
  eatingStart.value = dailyAdjustStart.value;
  eatingEnd.value = dailyAdjustEnd.value;
  hasStartedToday.value = true;
  saveDailyState();
  closeDailyAdjustPanel();
  startCountdown();
}

function startEating() {
  if (!hasStartedToday.value) {
    const hour = startTimeValue.value[0];
    const minute = startTimeValue.value[2];
    dailyAdjustTimeValue.value = [hour, 0, minute, 0];
    const start = new Date();
    start.setHours(hour, minute * 5, 0, 0);
    dailyAdjustStart.value = start.getTime();
    dailyAdjustEnd.value = dailyAdjustStart.value + eatingDuration.value * 3600000;
    const endHour = new Date(dailyAdjustEnd.value).getHours();
    const endMinute = Math.floor(new Date(dailyAdjustEnd.value).getMinutes() / 5);
    dailyAdjustEndValue.value = [endHour, 0, endMinute, 0];
    showDailyAdjustPanel.value = true;
    return;
  }
  openDailyAdjustPanel();
}

function endEatingEarly() {
  eatingEnd.value = Date.now();
  hasStartedToday.value = true;
  saveDailyState();
  stopCountdown();
  countdownText.value = '00:00';
}

function startCountdown() {
  stopCountdown();
  updateCountdown();
  countdownTimer.value = setInterval(updateCountdown, 1000);
}

function stopCountdown() {
  if (countdownTimer.value) { clearInterval(countdownTimer.value); countdownTimer.value = null; }
}

function saveSettings() {
  uni.setStorageSync(FASTING_SETTINGS_KEY, JSON.stringify({ selectedMode: selectedMode.value, startTimeValue: startTimeValue.value }));
}

function loadSettings() {
  try {
    const raw = uni.getStorageSync(FASTING_SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      selectedMode.value = s.selectedMode || 16;
      startTimeValue.value = (Array.isArray(s.startTimeValue) && s.startTimeValue.length >= 4) ? s.startTimeValue : [8, 0, 0, 0];
    }
  } catch (e) { console.error(e); }
}

function saveDailyState() {
  uni.setStorageSync(getFastingDailyKey(), JSON.stringify({ hasStartedToday: hasStartedToday.value, eatingStart: eatingStart.value, eatingEnd: eatingEnd.value }));
}

function resetDailyState() {
  hasStartedToday.value = false;
  eatingStart.value = null;
  eatingEnd.value = null;
  saveDailyState();
}

function isSameDayAsToday(ts) {
  if (!ts) return false;
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function checkDateRollover() {
  if (eatingEnd.value && !isSameDayAsToday(eatingEnd.value)) {
    resetDailyState();
  }
}

function loadDailyState() {
  try {
    const raw = uni.getStorageSync(getFastingDailyKey());
    if (raw) {
      const s = JSON.parse(raw);
      hasStartedToday.value = s.hasStartedToday || false;
      eatingStart.value = s.eatingStart || null;
      eatingEnd.value = s.eatingEnd || null;
    }
  } catch (e) { console.error(e); }
}

function updatePanelPreview() {
  const hour = panelStartTimeValue.value[0];
  const minute = panelStartTimeValue.value[2] * 5;
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  panelEatingStart.value = start.getTime();
  panelEatingEnd.value = panelEatingStart.value + panelEatingDuration.value * 3600000;
}

function openFastingPanel() {
  panelSelectedMode.value = selectedMode.value;
  panelStartTimeValue.value = [...startTimeValue.value];
  updatePanelPreview();
  showFastingPanel.value = true;
}
function closeFastingPanel() { showFastingPanel.value = false; }

function onStartTimeChange(e) {
  const val = e.detail.value;
  panelStartTimeValue.value = val;
  updatePanelPreview();
}

function confirmFastingSettings() {
  selectedMode.value = panelSelectedMode.value;
  startTimeValue.value = [...panelStartTimeValue.value];
  saveSettings();
  closeFastingPanel();
  // 如果今天还没打卡，设置变更同步到今日计划时间
  if (!hasStartedToday.value) {
    eatingStart.value = panelEatingStart.value;
    eatingEnd.value = panelEatingEnd.value;
    saveDailyState();
    startCountdown();
  }
  // 如果今天已打卡，不覆盖今天实际打卡时间，新设置从明天开始生效
}

onMounted(() => {
  load();
  loadSettings();
  // 先用设置生成默认时间
  const hour = startTimeValue.value[0];
  const minute = startTimeValue.value[2] * 5;
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  eatingStart.value = start.getTime();
  eatingEnd.value = eatingStart.value + eatingDuration.value * 3600000;
  // 再加载今日已保存状态（覆盖默认值），并处理跨天未刷新导致的状态过期
  loadDailyState();
  checkDateRollover();
  if (eatingStart.value && eatingEnd.value) startCountdown();
});

onShow(() => {
  load();
  loadDailyState();
  checkDateRollover();
  if (eatingStart.value && eatingEnd.value) startCountdown();
  uni.$emit('tabbar-select', 1);
  uni.hideTabBar({ animation: false }).catch(() => {});
});

onUnmounted(() => { stopCountdown(); });

function goTo(url) { uni.navigateTo({ url }); }
function goToBody() { uni.navigateTo({ url: '/pages/record/body-data' }); }

async function load() {
  try {
    const res = await recordApi.getToday();
    todayStats.value = res.data;
  } catch (err) { console.error(err); }
}

function generateDiary() {
  uni.navigateTo({ url: `/pages/museum/diary-generate?date=${today}` });
}
</script>
<style lang="scss" scoped>
.record-page {
  background: #F7FbF4;
  min-height: 100vh;
  padding: 0 32rpx calc(180rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.status-bar {
  height: var(--status-bar-height);
}

/* 顶部 */
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

/* 今日摄入卡片 */
.intake-card {
  background: #DDF2D2;
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
}

.intake-card-title {
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: #8DBB77;
  display: block;
  margin-bottom: 24rpx;
}

.intake-main {
  display: flex;
  align-items: center;
}

.intake-ring-wrap {
  width: 220rpx;
  height: 220rpx;
  position: relative;
  flex-shrink: 0;
  margin-right: 24rpx;
}

.intake-ring {
  width: 100%;
  height: 100%;
}

.intake-ring-center {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.intake-ring-value {
  font-size: 56rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 1.1;
}

.intake-ring-label {
  font-size: 22rpx;
  color: #666666;
  margin-top: 8rpx;
}

.macros {
  flex: 1;
}

.macro-row {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.macro-row:last-child {
  margin-bottom: 0;
}

.macro-name {
  width: 90rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #8DBB77;
  flex-shrink: 0;
  white-space: nowrap;
}

.macro-bar-bg {
  flex: 1;
  height: 10rpx;
  background: #FFFFFF;
  border-radius: 5rpx;
  margin: 0 16rpx;
  overflow: hidden;
}

.macro-bar-fill {
  height: 100%;
  background: #8DBB77;
  border-radius: 5rpx;
  transition: width 0.3s ease;
}

.macro-value {
  width: 100rpx;
  font-size: 24rpx;
  color: #999999;
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap;
}

/* 体重条 */
.weight-bar {
  background: #FFFFFF;
  border-radius: 60rpx;
  height: 120rpx;
  margin-top: 28rpx;
  padding: 0 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.weight-bar-left {
  display: flex;
  align-items: center;
}

.weight-label {
  font-size: 28rpx;
  font-weight: 600;
  color: #8DBB77;
  margin-right: 16rpx;
}

.weight-value-row {
  display: flex;
  align-items: baseline;
}

.weight-value {
  font-size: 56rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 1;
}

.weight-unit {
  font-size: 28rpx;
  color: #666666;
  margin-left: 8rpx;
}

.weight-bar-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.weight-stat-row {
  display: flex;
  margin-bottom: 4rpx;
}

.weight-stat-label {
  font-size: 24rpx;
  color: #666666;
  margin-right: 8rpx;
}

.weight-stat-value {
  font-size: 24rpx;
  font-weight: 600;
  color: #8DBB77;
}

/* 快捷入口 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18rpx;
  margin-bottom: 32rpx;
}

.action-item {
  background: #FFFFFF;
  border-radius: 24rpx;
  height: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.action-icon-box {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.action-icon-svg {
  width: 56rpx;
  height: 56rpx;
}

.action-icon-img {
  width: 72rpx;
  height: 72rpx;
}

.action-label {
  font-size: 24rpx;
  color: #27282D;
}

/* 轻断食卡片 */
.fasting-card {
  background: #FFFFFF;
  border: 1rpx solid rgba(204, 204, 204, 0.8);
  border-radius: 32rpx;
  padding: 28rpx;
  margin-bottom: 32rpx;
}

.fasting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.fasting-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #27282D;
}

.fasting-edit {
  background: #F0F0F0;
  border-radius: 16rpx;
  padding: 8rpx 16rpx;
  display: flex;
  align-items: center;
}

.fasting-edit-text {
  font-size: 24rpx;
  color: #666666;
  margin-right: 6rpx;
}

.fasting-edit-icon {
  width: 24rpx;
  height: 24rpx;
}

.fasting-body {
  display: flex;
  align-items: center;
}

.fasting-ring-wrap {
  width: 200rpx;
  height: 200rpx;
  position: relative;
  flex-shrink: 0;
  margin-right: 24rpx;
}

.fasting-ring {
  width: 100%;
  height: 100%;
}

.fasting-ring-center {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.fasting-ring-value {
  font-size: 36rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 1.1;
}

.fasting-ring-label {
  font-size: 22rpx;
  color: #666666;
  margin-top: 8rpx;
  text-align: center;
  padding: 0 16rpx;
}

.fasting-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.fasting-time-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 18rpx;
}

.fasting-time-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.fasting-time-label {
  font-size: 26rpx;
  color: #666666;
  display: block;
}

.fasting-time-value {
  font-size: 30rpx;
  font-weight: 600;
  color: #8DBB77;
  display: block;
  margin-top: 4rpx;
}

.fasting-action-btn {
  background: #CEE9BE;
  border-radius: 40rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #27282D;
  margin-top: 8rpx;
}

.fasting-action-btn.disabled {
  background: #E5E7EB;
  color: #999999;
}

/* 生成今日分析 */
.diary-btn {
  background: #FBE386;
  border-radius: 60rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  color: #27282D;
  margin-bottom: 32rpx;
}

/* 弹窗 */
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

.fasting-panel {
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
  max-height: 80vh;
  overflow-y: auto;
}

.fasting-panel.show {
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

.mode-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.mode-item {
  background: #F3F4F6;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  min-width: 140rpx;
  flex: 1;
}

.mode-item.active {
  background: #DDF2D2;
}

.mode-label {
  font-size: 28rpx;
  font-weight: 600;
  color: #27282D;
  display: block;
  margin-bottom: 4rpx;
}

.mode-desc {
  font-size: 22rpx;
  color: #666666;
  display: block;
}

.time-display-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  margin-bottom: 16rpx;
}

.time-display-item {
  text-align: center;
}

.time-display-label {
  font-size: 24rpx;
  color: #666666;
  display: block;
}

.time-display-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #8DBB77;
  display: block;
  margin-top: 4rpx;
}

.time-display-arrow {
  font-size: 32rpx;
  color: #999999;
}

.time-picker-label {
  font-size: 26rpx;
  color: #666666;
  display: block;
  margin-bottom: 12rpx;
}

.time-picker-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #8DBB77;
  display: block;
  text-align: center;
  margin-bottom: 12rpx;
}

.picker-view {
  width: 100%;
}

.picker-col {
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  font-size: 30rpx;
  color: #27282D;
}

.picker-col-label {
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999999;
}

.time-pickers-row {
  display: flex;
  gap: 24rpx;
}

.picker-section {
  flex: 1;
}

.panel-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.panel-actions AppButton {
  flex: 1;
}
</style>