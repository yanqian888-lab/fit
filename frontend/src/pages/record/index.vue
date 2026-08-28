<template>
  <view class="record-page">
    <view class="status-bar"></view>

    <view class="page-header">
      <view class="header-bg"></view>
      <view class="header-content">
        <image class="header-panda" src="/static/image/icon/gongjvxiang01@3x.png" mode="aspectFit" />
        <view class="header-tabs">
          <view class="header-tab" :class="{ active: activeTab === 'data' }" @click="activeTab = 'data'">
            <text>今日数据</text>
          </view>
          <view class="header-tab workout-tab" :class="{ active: activeTab === 'workout' }" @click="switchWorkoutTab">
            <text>陪你动</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 今日数据 -->
    <view v-if="activeTab === 'data'" class="tab-content">
    <!-- 快捷入口 -->
    <view class="quick-actions">
      <view class="action-item" @click="goTo('/pages/record/diet-detail')">
        <view class="action-icon-box">
          <image class="action-icon-img" src="/static/image/icon/jiyinshi@3x.png" mode="aspectFit" />
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
          <image class="action-icon-img" src="/static/image/icon/jitizhong@3x.png" mode="aspectFit" />
        </view>
        <text class="action-label">记体重</text>
      </view>
    </view>

    <!-- 今日摄入卡片 -->
    <view class="intake-card">
      <text class="intake-card-title">今日摄入</text>
      <view class="intake-main">
        <view class="intake-ring-wrap">
          <view
            class="intake-ring"
            :style="{ background: `conic-gradient(#8DBB77 ${intakeRingDeg}deg, #FFFFFF ${intakeRingDeg}deg)` }"
          >
            <view class="intake-ring-hole"></view>
          </view>
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

    <!-- 轻断食打卡 -->
    <view class="fasting-card">
      <view class="fasting-header">
        <text class="fasting-title">轻断食打卡</text>
        <view class="fasting-header-right">
          <text v-if="fastingStatsText" class="fasting-stats-text">{{ fastingStatsText }}</text>
          <view class="fasting-edit" @click="openFastingPanel">
            <text class="fasting-edit-text">编辑</text>
            <image class="fasting-edit-icon" src="/static/image/icon/xiugai.png" mode="aspectFit" />
          </view>
        </view>
      </view>
      <view class="fasting-body">
        <view class="fasting-ring-wrap">
          <view
            class="fasting-ring"
            :style="{ background: `conic-gradient(#8DBB77 ${fastingRingDeg}deg, rgba(204,204,204,0.8) ${fastingRingDeg}deg)` }"
          >
            <view class="fasting-ring-hole"></view>
          </view>
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

    <!-- 饮水模块 -->
    <view class="water-card">
      <view class="water-header">
        <text class="water-title">喝点水</text>
        <text class="water-amount">{{ waterTotal }}ml / 2000ml</text>
      </view>
      <view class="water-progress">
        <view class="water-fill" :style="{ width: Math.min((waterTotal / 2000) * 100, 100) + '%' }"></view>
      </view>
      <view class="water-actions">
        <text class="cup-btn" @click="addWater(100)">+100ml</text>
        <text class="cup-btn" @click="addWater(200)">+200ml</text>
        <text class="cup-btn" @click="addWater(500)">+500ml</text>
        <view class="cup-btn undo" :class="{ disabled: undoStack.length === 0 }" @click="undoWater">
          <image class="undo-icon" src="/static/image/icon/chehui@3x.png" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- 生成今日分析（已生成则去查看） -->
    <view class="diary-btn" @click="generateDiary">
      <text>{{ todayDiaryExists ? '今日分析已生成，去查看' : '生成今日分析' }}</text>
    </view>
    </view>

    <!-- 陪你动（页内切换，不跳二级页面） -->
    <view v-else class="tab-content">
      <view class="intro-card">
        <text class="intro-title">今日跟练推荐</text>
        <text class="intro-desc">选择一门课程，跟着搭搭一起动起来</text>
      </view>

      <view class="workout-list">
        <view
          v-for="item in workoutList"
          :key="item.workout_key"
          class="workout-card"
          :class="{ locked: !item.is_unlocked }"
          @click="handleWorkoutClick(item)"
        >
          <image class="workout-cover" :src="item.cover_url || '/static/image/icon/jiyundong.png'" mode="aspectFill" />
          <view class="workout-info">
            <text class="workout-name">{{ item.name }}</text>
            <text class="workout-desc">{{ item.description }}</text>
            <view class="workout-meta">
              <text class="meta-text">{{ workoutDurationText(item) }}</text>
              <text class="meta-text">{{ Math.round(item.calorie_per_hour || 0) }} 千卡/小时</text>
            </view>
          </view>
          <view class="workout-badge" :class="{ locked: !item.is_unlocked }">
            <text class="badge-text">{{ item.is_unlocked ? '去跟练' : '去解锁' }}</text>
          </view>
        </view>        <view v-if="workoutLoaded && workoutList.length === 0" class="workout-empty">暂无课程</view>
      </view>
    </view>

    <!-- 轻断食设置面板 -->
    <view class="panel-overlay" :class="{ show: showFastingPanel }" @click="closeFastingPanel"></view>
    <view class="fasting-panel" :class="{ show: showFastingPanel }">
      <view class="panel-header">
        <text class="panel-title">轻断食设置</text>
        <text class="panel-close" @click="closeFastingPanel">✕</text>
      </view>
      <!-- 可滚动内容区（模式卡/自定义时长/时间选择器），吸底按钮固定在面板底部不随内容滚动 -->
      <scroll-view class="panel-content" scroll-y>
        <view class="mode-list">
          <view v-for="mode in fastingModes" :key="mode.value" class="mode-item" :class="{ active: panelSelectedMode === mode.value }" @click="panelSelectedMode = mode.value">
            <text class="mode-label">{{ mode.label }}</text>
            <text class="mode-desc">{{ mode.desc }}</text>
          </view>
        </view>
        <view v-if="panelSelectedMode === 'custom'" class="custom-hours-row">
          <text class="custom-hours-label">断食时长</text>
          <input class="custom-hours-input" type="number" v-model="customTargetHours" />
          <text class="custom-hours-unit">小时</text>
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
          <picker-view class="picker-view" :value="panelStartTimeValue" @change="onStartTimeChange" indicator-style="height: 60rpx; line-height: 60rpx;" style="height: 240rpx;">
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
      </scroll-view>
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
      <scroll-view class="panel-content" scroll-y>
        <view class="time-picker-wrap daily-adjust">
          <view class="time-pickers-row">
            <view class="picker-section single-picker">
              <text class="time-picker-label">用餐开始</text>
              <text class="time-picker-value">{{ formatTime(dailyAdjustStart) }}</text>
              <picker-view class="picker-view" :value="dailyAdjustTimeValue" @change="onDailyAdjustTimeChange" indicator-style="height: 60rpx; line-height: 60rpx;" style="height: 240rpx;">
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
      </scroll-view>
      <view class="panel-actions">
        <AppButton type="cancel-gray" @click="closeDailyAdjustPanel">取消</AppButton>
        <AppButton type="confirm-light" @click="confirmDailyAdjust">确定打卡</AppButton>
      </view>
    </view>

    <!-- 生成今日分析确认弹框 -->
    <AppModal
      v-model:visible="showDiaryModal"
      icon="none"
      title="生成今日分析"
      text="每天只能分析一次，请确认饮食、运动等相关数据已经记录完全，点击确认进入分析～"
      confirmText="确认"
      cancelText="取消"
      @confirm="confirmGenerateDiary"
      @cancel="showDiaryModal = false"
    />

    <!-- 结束用餐二次确认弹框 -->
    <AppModal
      v-model:visible="showEndEatingModal"
      icon="none"
      title="结束用餐"
      text="你是否已经完成今天所有的饮食了？"
      confirmText="是"
      cancelText="否"
      @confirm="confirmEndEating"
      @cancel="showEndEatingModal = false"
    />

  </view>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi, aiApi, workoutApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppButton from '../../components/AppButton.vue';
import AppModal from '../../components/AppModal.vue';
import { getToday } from '../../utils/date';
import { showRewardToast } from '../../utils/rewardToast.js';
import { useUserStore } from '../../store';
import { usePageCacheStore, CACHE_KEYS } from '../../store/page-cache';

const userStore = useUserStore();
const pageCache = usePageCacheStore();

const today = getToday();

// 页内 tab：今日数据 / 陪你动
const activeTab = ref('data');
const workoutList = ref([]);
const workoutLoaded = ref(false);
// 数据加载状态
const loading = ref(false);
// 是否有缓存数据
const hasCachedData = ref(false);

// 弹框可见性
const showDiaryModal = ref(false);
const showEndEatingModal = ref(false);

async function loadWorkouts() {
  try {
    const res = await workoutApi.getList();
    workoutList.value = res.data?.list || [];
  } catch (e) {
    console.error(e);
  } finally {
    workoutLoaded.value = true;
  }
}

function switchWorkoutTab() {
  if (!userStore.requireAuth()) return;
  activeTab.value = 'workout';
  // 每次切换到陪你动都刷新课程列表（器材购买后解锁状态需要更新）
  loadWorkouts();
}

function formatDuration(seconds) {
  if (!seconds) return '0 分钟';
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.round(seconds / 60)} 分钟`;
}

// 课程时长展示：不限时长 / x分钟×y组
function workoutDurationText(item) {
  if (item.duration_mode === 'unlimited') return '不限时长';
  const mins = item.set_minutes || Math.round((item.duration_seconds || 0) / 60) || 0;
  const sets = item.sets_count || 1;
  return sets > 1 ? `${mins} 分钟 × ${sets} 组` : `${mins} 分钟`;
}

function handleWorkoutClick(item) {
  if (!userStore.requireAuth()) return;
  if (!item.is_unlocked) {
    // 未购买器材：跳转搭搭 tab 拉起商店弹层，定位到运动器材 tab 引导购买
    uni.setStorageSync('pending_shop_category', 'equipment');
    uni.showToast({ title: '购买对应器材即可解锁该课程', icon: 'none' });
    uni.switchTab({ url: '/pages/pet/index' });
    return;
  }
  uni.navigateTo({ url: `/pages/workout/session?key=${item.workout_key}` });
}

const todayStats = ref({
  intake: 0, burned: 0, remaining: 0, target: 1500, status: 'green',
  current_weight: null, initial_weight: null, target_weight: null,
  protein: 0, protein_target: 0, carb: 0, carb_target: 0, fat: 0, fat_target: 0,
  weight_days: 1
});

// 饮水模块
const waterTotal = ref(0);
const waterRecordId = ref(null);
const undoStack = ref([]);
const waterCups = [100, 200, 500];

async function loadWaterToday() {
  try {
    const res = await recordApi.getHabits({ date: today, type: 'water' });
    const list = res.data.list || [];
    const water = list.find(item => item.type === 'water');
    waterTotal.value = water ? Number(water.value) || 0 : 0;
    waterRecordId.value = water ? water.id : null;
    undoStack.value = [];
  } catch (e) { console.error(e); }
}

async function addWater(amount) {
  if (!userStore.requireAuth()) return;
  const oldTotal = waterTotal.value;
  waterTotal.value += amount;
  undoStack.value.push(amount);
  if (undoStack.value.length > 3) undoStack.value.shift();
  try {
    const res = await recordApi.saveHabit({
      id: waterRecordId.value || null,
      record_date: today,
      type: 'water',
      value: waterTotal.value,
      unit: 'ml',
      remark: ''
    });
    if (!waterRecordId.value && res && res.data && res.data.id) waterRecordId.value = res.data.id;
    showRewardToast(res.data?.reward_messages || [], '饮水记录成功');
  } catch (e) {
    waterTotal.value = oldTotal;
    undoStack.value.pop();
    uni.showToast({ title: e.message || '记录失败', icon: 'none' });
  }
}

async function undoWater() {
  if (!userStore.requireAuth()) return;
  if (undoStack.value.length === 0) return;
  const amount = undoStack.value.pop();
  const oldTotal = waterTotal.value;
  waterTotal.value = Math.max(0, waterTotal.value - amount);
  try {
    await recordApi.saveHabit({
      id: waterRecordId.value || null,
      record_date: today,
      type: 'water',
      value: waterTotal.value,
      unit: 'ml',
      remark: ''
    });
  } catch (e) {
    waterTotal.value = oldTotal;
    undoStack.value.push(amount);
    uni.showToast({ title: e.message || '撤销失败', icon: 'none' });
  }
}

// ========== 日期计算 ==========
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

// conic-gradient 进度角（小程序端不支持 svg，用 conic-gradient 模拟圆环）
const intakeRingDeg = computed(() => {
  const p = Math.min(100, Math.max(0, intakePercent.value || 0));
  return p * 3.6;
});

const fastingRingDashoffset = computed(() => {
  const p = Math.min(100, Math.max(0, eatingProgress.value || 0));
  // 圆环表示“剩余进度”，开始时 full（offset=0），结束时 empty（offset=264）
  return 264 * (p / 100);
});

// 轻断食进度角：剩余进度 = 100 - eatingProgress
const fastingRingDeg = computed(() => {
  const p = Math.min(100, Math.max(0, eatingProgress.value || 0));
  return (100 - p) * 3.6;
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
  if (!userStore.requireAuth()) return;
  if (fastingDisabled.value) return;
  // 未设置过轻断食时间：提示并调起设置弹窗（与右上角「编辑」同一弹窗）
  if (!hasFastingSettings.value) {
    uni.showToast({ title: '请设置轻断食时间', icon: 'none' });
    openFastingPanel();
    return;
  }
  if (!hasStartedToday.value) startEating();
  else if (isInEatingWindow.value) {
    // 提前结束用餐前添加二次确认
    showEndEatingModal.value = true;
  }
}
/**
 * 确认结束用餐二次确认弹框
 */
function confirmEndEating() {
  showEndEatingModal.value = false;
  endEatingEarly();
}

// ========== 轻断食（保留原有逻辑） ==========
const FASTING_SETTINGS_KEY = 'fasting_settings';
function getFastingDailyKey() { return 'fasting_daily_' + getToday(); }

const fastingModes = [
  { label: '16:8', value: '16:8', hours: 16, desc: '16小时断食，8小时用餐' },
  { label: '18:6', value: '18:6', hours: 18, desc: '18小时断食，6小时用餐' },
  { label: '20:4', value: '20:4', hours: 20, desc: '20小时断食，4小时用餐' },
  { label: '14:10', value: '14:10', hours: 14, desc: '14小时断食，10小时用餐' },
  { label: 'OMAD', value: 'omad', hours: 23, desc: '一日一餐，23小时断食' },
  { label: '自定义', value: 'custom', hours: 0, desc: '自定义断食时长' }
];

const selectedMode = ref('16:8');
const customTargetHours = ref(16);
const eatingStart = ref(null);
const eatingEnd = ref(null);
const hasStartedToday = ref(false);
// 用户是否完成过首次设置（决定用餐倒计时是否每天自动滚动）
const hasFastingSettings = ref(false);
const showFastingPanel = ref(false);
const startTimeValue = ref([8, 0, 0, 0]);
// 设置面板独立的预览状态，避免已打卡时拖动设置直接改动今天时间
const panelSelectedMode = ref(16);
const panelStartTimeValue = ref([8, 0, 0, 0]);
const panelEatingStart = ref(null);
const panelEatingEnd = ref(null);
const panelModeInfo = computed(() => fastingModes.find(m => m.value === panelSelectedMode.value) || fastingModes[0]);
const panelEatingDuration = computed(() => {
  if (panelSelectedMode.value === 'custom') return Math.max(1, 24 - customTargetHours.value);
  return Math.max(1, 24 - (panelModeInfo.value?.hours || 16));
});
watch([panelSelectedMode, customTargetHours], () => {
  // 在设置面板中切换模式时，实时刷新结束时间预览
  if (showFastingPanel.value && panelEatingStart.value) {
    panelEatingEnd.value = panelEatingStart.value + panelEatingDuration.value * 3600000;
  }
});
const countdownTimer = ref(null);
const countdownText = ref('--:--');
const fastingStats = ref(null);

const fastingStatsText = computed(() => {
  if (!fastingStats.value) return '';
  if (fastingStats.value.this_week_completed > 0) {
    return `本周完成 ${fastingStats.value.this_week_completed} 天`;
  }
  return '';
});

const currentModeInfo = computed(() => fastingModes.find(m => m.value === selectedMode.value) || fastingModes[0]);
const eatingDuration = computed(() => {
  if (selectedMode.value === 'custom') return Math.max(1, 24 - customTargetHours.value);
  return Math.max(1, 24 - (currentModeInfo.value?.hours || 16));
});
const fastingModeText = computed(() => {
  return (currentModeInfo.value?.label || '16:8') + ' 轻断食';
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

function formatHHMM(ts) {
  if (!ts) return null;
  return formatTime(ts);
}

async function loadFastingStats() {
  try {
    const res = await recordApi.getFastingStats();
    fastingStats.value = res.data || null;
  } catch (e) { console.error(e); }
}

async function loadFastingFromServer() {
  try {
    const res = await recordApi.getFasting();
    const f = res.data?.fasting;
    if (!f) {
      // 服务器没有今日记录但本地标记了已打卡：说明上次打卡没提交成功（历史脱节状态），
      // 重置本地让用户可以正常打卡（后端会自动按计划创建当日记录）
      if (hasStartedToday.value) resetDailyState();
      return;
    }
    if (['16:8', '18:6', '20:4', '14:10', 'omad', 'custom'].includes(f.mode)) {
      selectedMode.value = f.mode;
      if (f.mode === 'custom' && f.target_hours) {
        customTargetHours.value = f.target_hours;
      }
    }
    hasStartedToday.value = f.status === 'fasting' || f.status === 'completed' || f.status === 'failed';
    if (f.eating_window_start && f.eating_window_end) {
      const today = new Date().toISOString().split('T')[0];
      const s = new Date(`${today}T${f.eating_window_start}`);
      const e = new Date(`${today}T${f.eating_window_end}`);
      if (!isNaN(s.getTime())) eatingStart.value = s.getTime();
      if (!isNaN(e.getTime())) eatingEnd.value = e.getTime();
    }
    if (f.status === 'completed' || f.status === 'failed') {
      eatingEnd.value = Date.now();
    }
  } catch (e) { console.error(e); }
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

async function confirmDailyAdjust() {
  // 先提交服务器（携带当前设置，无当日计划时后端自动创建），成功后再更新本地状态
  const payload = {
    action: 'start',
    mode: selectedMode.value,
    eating_window_start: formatHHMM(dailyAdjustStart.value),
    eating_window_end: formatHHMM(dailyAdjustEnd.value)
  };
  if (selectedMode.value === 'custom') payload.target_hours = customTargetHours.value;
  try {
    await recordApi.saveFasting(payload);
  } catch (e) {
    console.error(e);
    return; // 失败时不改本地状态，避免与服务器脱节
  }
  eatingStart.value = dailyAdjustStart.value;
  eatingEnd.value = dailyAdjustEnd.value;
  hasStartedToday.value = true;
  // 首次打卡选择的时间沉淀为长期设置，之后每天到点自动滚动
  startTimeValue.value = [...dailyAdjustTimeValue.value];
  saveSettings();
  saveDailyState();
  closeDailyAdjustPanel();
  startCountdown();
  // 打卡成功 toast 提示
  uni.showToast({
    title: '轻断食打卡成功',
    icon: 'success',
    duration: 2000
  });
}

function startEating() {
  if (!userStore.requireAuth()) return;
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

async function endEatingEarly() {
  if (!userStore.requireAuth()) return;
  try {
    await recordApi.saveFasting({
      action: 'end',
      mode: selectedMode.value,
      eating_window_start: formatHHMM(eatingStart.value),
      eating_window_end: formatHHMM(eatingEnd.value)
    });
  } catch (e) {
    console.error(e);
    return; // 失败时不改本地状态
  }
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
  hasFastingSettings.value = true;
  uni.setStorageSync(FASTING_SETTINGS_KEY, JSON.stringify({ selectedMode: selectedMode.value, startTimeValue: startTimeValue.value, customTargetHours: customTargetHours.value }));
}

function loadSettings() {
  try {
    const raw = uni.getStorageSync(FASTING_SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // 兼容旧版 numeric mode
      const legacyMap = { 16: '16:8', 18: '18:6', 20: '20:4', 14: '14:10' };
      selectedMode.value = legacyMap[s.selectedMode] || s.selectedMode || '16:8';
      customTargetHours.value = s.customTargetHours || 16;
      startTimeValue.value = (Array.isArray(s.startTimeValue) && s.startTimeValue.length >= 4) ? s.startTimeValue : [8, 0, 0, 0];
      hasFastingSettings.value = true;
    }
  } catch (e) { console.error(e); }
}

// 完成首次设置后，每天按设置的用餐窗口自动滚动倒计时（无需手动打卡）；
// 未设置过则不滚动，等用户首次打卡时设置时间
function ensureTodayWindow() {
  if (!hasFastingSettings.value) return;
  if (!eatingStart.value || !isSameDayAsToday(eatingStart.value)) {
    const start = new Date();
    start.setHours(startTimeValue.value[0], startTimeValue.value[2] * 5, 0, 0);
    eatingStart.value = start.getTime();
    eatingEnd.value = eatingStart.value + eatingDuration.value * 3600000;
    saveDailyState();
  }
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
  if (!userStore.requireAuth()) return;
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

async function confirmFastingSettings() {
  if (!userStore.requireAuth()) return;
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
  // 设置始终同步到服务器（后端按计划 upsert，已打卡时只更新设置不影响打卡状态）
  const payload = {
    mode: selectedMode.value,
    eating_window_start: formatHHMM(hasStartedToday.value ? eatingStart.value : panelEatingStart.value),
    eating_window_end: formatHHMM(hasStartedToday.value ? eatingEnd.value : panelEatingEnd.value)
  };
  if (selectedMode.value === 'custom') {
    payload.target_hours = customTargetHours.value;
  }
  try {
    await recordApi.saveFasting(payload);
  } catch (e) { console.error(e); }
}

/**
 * 页面挂载：先从缓存恢复数据，再后台异步刷新
 */
onMounted(() => {
  // 1. 先从缓存恢复数据（避免白屏）
  const hasCache = initFromCache();
  
  // 2. 后台异步刷新
  if (!userStore.isLoggedIn) return;
  
  if (!hasCache) {
    loading.value = true;
  }
  
  nextTick(() => {
    try {
      load();
      loadWaterToday();
      loadSettings();
      ensureTodayWindow();
      loadDailyState();
      checkDateRollover();
      loadFastingFromServer().then(() => {
        ensureTodayWindow();
        loadFastingStats();
        if (eatingStart.value && eatingEnd.value) startCountdown();
      }).catch(() => { /* 静默失败，不阻塞页面 */ });
    } catch (e) {
      console.error('[record] onMounted 数据加载异常:', e);
    } finally {
      loading.value = false;
      hasCachedData.value = true;
    }
  });
});

onShow(() => {
  // 外部跳转过来时切换到指定 tab（如使用器材后进入"陪你动"）
  const pendingTab = uni.getStorageSync('record_pending_tab');
  if (pendingTab) {
    activeTab.value = pendingTab;
    uni.removeStorageSync('record_pending_tab');
  }
  
  // 先从缓存恢复数据（避免白屏）
  if (!hasCachedData.value) {
    initFromCache();
  }
  
  // 根据缓存状态决定是否需要刷新
  if (userStore.isLoggedIn && needRefresh()) {
    if (!hasCachedData.value) {
      loading.value = true;
    }
    nextTick(() => {
      try {
        load();
        loadDailyState();
        checkDateRollover();
        ensureTodayWindow();
        if (activeTab.value === 'workout') loadWorkouts();
        if (eatingStart.value && eatingEnd.value) startCountdown();
      } catch (e) {
        console.error('[record] onShow 数据加载异常:', e);
      } finally {
        loading.value = false;
        hasCachedData.value = true;
      }
    });
  }
});

onUnmounted(() => { stopCountdown(); });

function goTo(url) {
  if (!userStore.requireAuth()) return; uni.navigateTo({ url }); }
function goToBody() {
  if (!userStore.requireAuth()) return; uni.navigateTo({ url: '/pages/record/body-data' }); }

/**
 * 加载今日数据
 * 支持缓存策略：加载完成后更新缓存
 */
async function load() {
  try {
    const res = await recordApi.getToday();
    todayStats.value = res.data;
    // 更新缓存
    pageCache.setCache(CACHE_KEYS.RECORD_TODAY, res.data);
    loadFastingStats();
    loadWaterToday();
    loadTodayDiaryStatus();
  } catch (err) { console.error(err); }
}

/**
 * 从缓存恢复数据
 * @returns {boolean} 是否有缓存数据
 */
function initFromCache() {
  let hasCache = false;
  // 恢复今日统计数据
  const cachedStats = pageCache.getCache(CACHE_KEYS.RECORD_TODAY);
  if (cachedStats) {
    todayStats.value = cachedStats;
    hasCache = true;
  }
  // 恢复断食数据
  const cachedFasting = pageCache.getCache(CACHE_KEYS.RECORD_FASTING);
  if (cachedFasting) {
    // 断食相关数据恢复
    hasCache = true;
  }
  hasCachedData.value = hasCache;
  return hasCache;
}

/**
 * 检查是否需要刷新缓存
 */
function needRefresh() {
  if (pageCache.consumeForceRefresh(CACHE_KEYS.RECORD_TODAY)) {
    return true;
  }
  if (!hasCachedData.value) {
    return true;
  }
  if (pageCache.isExpired(CACHE_KEYS.RECORD_TODAY)) {
    return true;
  }
  return false;
}

// 今天是否已生成日记分析（同一天只能生成一次）
const todayDiaryExists = ref(false);
async function loadTodayDiaryStatus() {
  try {
    const res = await aiApi.getDiaryHistory({ month: today.slice(0, 7), size: 200 });
    const list = res.data?.list || [];
    todayDiaryExists.value = list.some(item => item.date === today);
  } catch (e) { console.error(e); }
}

function generateDiary() {
  if (!userStore.requireAuth()) return;
  // 已生成：直接进入日记与分析页（默认选中当天）
  if (todayDiaryExists.value) {
    uni.navigateTo({ url: '/pages/museum/diary' });
    return;
  }
  // 每天首次生成需二次确认
  showDiaryModal.value = true;
}
/**
 * 确认生成今日分析
 */
function confirmGenerateDiary() {
  showDiaryModal.value = false;
  uni.navigateTo({ url: `/pages/museum/diary-generate?date=${today}` });
}
</script>
<style lang="scss" scoped>
.record-page {
  background: #F7FbF4;
  min-height: 100vh;
  padding: 0 32rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.status-bar {
  /*
   * 兜底第一行：iPhone 刘海屏基准高度（44px + 44px 胶囊让位 88rpx）
   * 兜底第二行：优先取 var，无 var 注入时 fallback 44px，避免 navigateTo/切 Tab
   *   触发页面重排时，前几个 frame status-bar 高度塌陷→跳变→整体"下坠"。
   */
  /* 上移 24px：将 88rpx 减为 40rpx，相当于缩短顶部绿色区域 */
  height: calc(44px + 40rpx);
  height: calc(var(--status-bar-height, 44px) + 40rpx);
  /* 记录 tab 顶部浅绿色背景，与系统状态栏无缝衔接 */
  background: $green-light;
  /* 左右负 margin 抵消 record-page 的 padding 32rpx，让背景铺满屏幕两侧 */
  margin-left: -32rpx;
  margin-right: -32rpx;
  flex-shrink: 0;
  /* 吸顶时确保 status-bar 也固定在顶部 */
  position: sticky;
  top: 0;
  z-index: 49;
}

.page-header {
  /* 吸顶固定，status-bar 吸在 top:0，header 接在下方 */
  position: sticky;
  top: calc(var(--status-bar-height, 44px) + 40rpx);
  z-index: 50;
  margin: 0 -32rpx 28rpx;
  padding: 16rpx 0 20rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: $green-light; /* 与 status-bar 颜色一致，通顶到状态栏 */
  z-index: 0;
}

.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding-left: 0;
}

.header-panda {
  width: 94rpx;
  height: 115rpx;
  margin-left: 0;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.header-tabs {
  /* 绝对定位相对整个头部居中，不受左侧小熊猫占位影响 */
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 128rpx;
  pointer-events: none;
}

.header-tab {
  pointer-events: auto;
  font-size: 32rpx;
  color: #999999;
  font-weight: 400;
  padding: 8rpx 0;
  position: relative;
}

.header-tab.active {
  color: #563E22;
  font-weight: 700;
}

/* 陪你动 tab 左移 24px（48rpx） */
.workout-tab {
  margin-left: -48rpx;
}

.header-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: #8DBB77;
  border-radius: 2rpx;
}

/* 今日摄入卡片 */
.intake-card {
  background: #DDF2D2;
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(141, 187, 119, 0.1);
}

.intake-card-title {
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #563E22;
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
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.intake-ring-hole {
  width: 78%;
  height: 78%;
  background: #DDF2D2;
  border-radius: 50%;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 22rpx;
  margin-bottom: 28rpx;
}

.action-item {
  background: #FFFFFF;
  border-radius: 24rpx;
  height: 106rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.action-icon-box {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
}

.action-icon-svg {
  width: 52rpx;
  height: 52rpx;
}

.action-icon-img {
  width: 56rpx;
  height: 56rpx;
}

.action-label {
  font-size: 26rpx;
  color: #563E22;
  font-weight: 500;
}

/* 饮水卡片 */
.water-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.03);
}

.water-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.water-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.water-amount {
  font-size: 26rpx;
  color: #563E22;
  font-weight: 600;
}

.water-progress {
  height: 16rpx;
  background: #E8F5FF;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.water-fill {
  height: 100%;
  background: #B5E2FF;
  border-radius: 8rpx;
  transition: width 0.3s ease;
}

.water-actions {
  display: flex;
  gap: 16rpx;
}

.cup-btn {
  flex: 1;
  text-align: center;
  background: #DDF2D2;
  color: #8DBB77;
  border-radius: 32rpx;
  padding: 18rpx 0;
  font-size: 24rpx;
  font-weight: 500;
}

.cup-btn.undo {
  flex: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 0;
}

.cup-btn.undo.disabled {
  opacity: 0.4;
}

.undo-icon {
  width: 32rpx;
  height: 26rpx;
}

/* 轻断食卡片 */
.fasting-card {
  background: #FFFFFF;
  border: 1rpx solid rgba(204, 204, 204, 0.8);
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);
}

.fasting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.fasting-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.fasting-edit {
  background: #F0F7EC;
  border-radius: 16rpx;
  padding: 8rpx 16rpx;
  display: flex;
  align-items: center;
}

.fasting-edit-text {
  font-size: 24rpx;
  color: #563E22;
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
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fasting-ring-hole {
  width: 78%;
  height: 78%;
  background: #FFFFFF;
  border-radius: 50%;
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
  background: #FFAB76;
  border-radius: 60rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #FFFFFF;
  font-weight: 600;
  margin-bottom: 0;
  box-shadow: 0 4rpx 16rpx rgba(255, 171, 118, 0.3);
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
  padding: 32rpx 32rpx 0 32rpx;
  z-index: 1001;
  transform: translateY(100%);
  transition: transform 0.3s;
  /*
   * 三段式（header / content-scroll / actions吸底）布局
   * 使用 flex 列布局，确保 panel-actions 始终显示在底部
   * 使用 max-height 防止内容溢出
   */
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  /* 不使用 overflow:hidden，避免裁剪 panel-actions */
}

.fasting-panel.show {
  transform: translateY(0);
}

/* 顶部 header 固定高度，不压缩 */
.panel-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

/* 中间内容区滚动，独立 flex:1 自动计算高度 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 24rpx 0 16rpx;
  box-sizing: border-box;
  min-height: 0;
}

.panel-actions {
  display: flex;
  gap: 20rpx;
  margin: 32rpx 0 0 0;
  justify-content: center;
  /*
   * 关键：flex-shrink:0 + 合理 padding，防止三段式 flex 中子内容 picker-view 过高导致
   * panel-actions 被压缩至 0 高度 → 取消/确认按钮肉眼不可见
   */
  flex-shrink: 0;
  min-height: 96rpx;
  padding-top: 16rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #FFFFFF;
  border-top: 1rpx solid #F0F0F0;
}

.panel-actions :deep(.app-button) {
  flex: 1;
}

/* 为每日调整面板也应用相同布局 */
.daily-adjust-panel .panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 24rpx 0 16rpx;
  box-sizing: border-box;
  min-height: 0;
}

.daily-adjust-panel .panel-actions {
  flex-shrink: 0;
  padding: 16rpx 0 calc(16rpx + env(safe-area-inset-bottom));
  margin: 0;
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

.fasting-header-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.fasting-stats-text {
  font-size: 22rpx;
  color: #8DBB77;
  background: #E8F5E8;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
}

.custom-hours-row {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  padding: 16rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
}

.custom-hours-label {
  font-size: 26rpx;
  color: #666;
  margin-right: 16rpx;
}

.custom-hours-input {
  width: 100rpx;
  height: 56rpx;
  background: #fff;
  border-radius: 12rpx;
  text-align: center;
  font-size: 30rpx;
  color: #333;
}

.custom-hours-unit {
  font-size: 26rpx;
  color: #666;
  margin-left: 12rpx;
}

/* 陪你动（页内切换） */
.intro-card {
  background: linear-gradient(135deg, #DDF2D2, #E8F5FF);
  border-radius: 32rpx;
  padding: 32rpx;
  /* 页面左右 padding 是 32rpx，用负边距把卡片钉在距屏幕边缘固定 16px */
  margin: 0 calc(16px - 32rpx) 16px;
}
.intro-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}
.intro-desc {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-top: 8rpx;
}
.workout-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 距屏幕左右边缘固定 16px（抵消页面 32rpx 的 rpx 边距） */
  margin: 0 calc(16px - 32rpx);
  padding: 0 0 16px;
  box-sizing: border-box;
}
.workout-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 32rpx;
  padding: 36rpx 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05);
}
.workout-card.locked {
  opacity: 0.75;
}
.workout-card:active {
  transform: scale(0.98);
}
.workout-cover {
  width: 152rpx;
  height: 152rpx;
  border-radius: 28rpx;
  background: #f0f0f0;
  margin-right: 28rpx;
  flex-shrink: 0;
}
.workout-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  margin-right: 24rpx;
}
.workout-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #333;
  margin-bottom: 12rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workout-desc {
  font-size: 24rpx;
  color: #999;
  line-height: 34rpx;
  margin-bottom: 16rpx;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-all;
}
.workout-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;
}
.meta-text {
  font-size: 24rpx;
  color: #8DBB77;
  font-weight: 600;
  white-space: nowrap;
}
.workout-badge {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #8DBB77;
  border-radius: 999rpx;
  padding: 20rpx 44rpx;
}
.workout-badge.locked {
  background: #fff;
  border: 2rpx solid #C9C9C9;
}
.badge-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  line-height: 1;
}
.workout-badge.locked .badge-text {
  color: #999;
}
.workout-empty {
  text-align: center;
  font-size: 26rpx;
  color: #999;
  padding: 80rpx 0;
}
</style>