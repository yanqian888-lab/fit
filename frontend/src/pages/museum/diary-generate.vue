<template>
  <AppPage>
    <AppHeader title="生成今日分析" />
    <view class="generate-page">
      <!-- 生成过程 -->
      <view v-if="status === 'generating'" class="process-card">
        <view class="process-header">
          <image class="loading-icon" src="/static/image/icon/loading01.svg" mode="aspectFit" />
          <text class="process-title">正在生成今日分析</text>
        </view>
        <view class="steps">
          <view
            v-for="(step, index) in steps"
            :key="index"
            class="step-item"
            :class="{ active: index <= currentStep, done: index < currentStep }"
          >
            <view class="step-dot">
              <text v-if="index < currentStep" class="step-check">✓</text>
              <text v-else class="step-number">{{ index + 1 }}</text>
            </view>
            <text class="step-label">{{ step }}</text>
          </view>
        </view>
        <view class="process-hint">
          <text>{{ currentHint }}</text>
        </view>
      </view>

      <!-- 生成结果 -->
      <view v-else-if="status === 'done'" class="result-card">
        <view class="result-header">
          <text class="result-icon">📝</text>
          <text class="result-title">{{ date }} 今日分析</text>
        </view>
        <text class="result-content">{{ diary }}</text>
      </view>

      <!-- 生成失败 -->
      <view v-else-if="status === 'error'" class="error-card">
        <text class="error-icon">😅</text>
        <text class="error-title">生成失败</text>
        <text class="error-desc">网络有点问题，请稍后再试</text>
      </view>

      <!-- 试用权限已用尽 -->
      <view v-else-if="status === 'blocked'" class="error-card">
        <text class="error-icon">🔒</text>
        <text class="error-title">试用权限已用尽</text>
        <text class="error-desc">可联系客服获取正式使用授权</text>
      </view>

      <view class="actions">
        <AppButton v-if="status === 'done'" block type="primary" @click="regenerate">重新生成</AppButton>
        <AppButton v-if="status === 'error'" block type="primary" @click="regenerate">重试</AppButton>
        <AppButton block :type="status === 'generating' ? 'ghost' : 'secondary'" @click="goBack">
          {{ status === 'generating' ? '取消' : '返回' }}
        </AppButton>
      </view>
    </view>

    <!-- 授权引导弹窗 -->
    <AuthPopup ref="authPopupRef" />
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { aiApi } from '../../api';
import { getToday } from '../../utils/date';
import { goBack as navigateBack } from '../../utils/navigate';
import { checkPermission, reportCount } from '../../utils/trial.js';
import AuthPopup from '../../components/AuthPopup.vue';

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
      if (settings.selectedMode) {
        params.fasting_mode = `${24 - settings.selectedMode}:${settings.selectedMode}`;
      }
    }
  } catch (e) {
    console.error('读取断食状态失败:', e);
  }
  return params;
}
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const props = defineProps({
  date: { type: String, default: '' }
});

// 兼容 uni-app 页面参数
const routeDate = computed(() => props.date || getToday());

const status = ref('generating'); // generating | done | error | blocked
const authPopupRef = ref(null);
const currentStep = ref(0);
const diary = ref('');
const steps = ['收集今日记录', '分析运动饮食', '生成日记内容'];
const hints = [
  '正在读取你今天的饮食、运动和体重记录…',
  '正在分析今日摄入与消耗，寻找亮点…',
  '正在用温暖的文字记录这一天…'
];
const currentHint = computed(() => hints[currentStep.value] || '');

let cancelled = false;

onMounted(async () => {
  const perm = await checkPermission('diary');
  if (!perm.allow_use) {
    status.value = 'blocked';
    if (perm.show_popup && authPopupRef.value) {
      authPopupRef.value.show(perm.popup_config);
    }
    return;
  }
  startGeneration();
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startGeneration() {
  const perm = await checkPermission('diary');
  if (!perm.allow_use) {
    status.value = 'blocked';
    if (perm.show_popup && authPopupRef.value) {
      authPopupRef.value.show(perm.popup_config);
    }
    return;
  }

  status.value = 'generating';
  currentStep.value = 0;
  cancelled = false;

  try {
    // 过程演示：分步骤展示
    for (let i = 0; i < steps.length; i++) {
      if (cancelled) return;
      currentStep.value = i;
      await delay(800);
    }

    if (cancelled) return;

    const res = await aiApi.generateDiary(routeDate.value, getFastingParams(routeDate.value));
    diary.value = res.data.diary;
    status.value = 'done';
    // 成功后上报日记生成次数
    reportCount('diary');
  } catch (err) {
    console.error('日记生成失败:', err);
    status.value = 'error';
  }
}

function regenerate() {
  startGeneration();
}

function goBack() {
  if (status.value === 'generating') {
    cancelled = true;
  }
  navigateBack('/pages/museum/index');
}
</script>

<style lang="scss" scoped>
.generate-page {
  padding-top: 216rpx;
}

.process-card,
.result-card,
.error-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.process-title,
.error-title,
.result-title {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
}

.process-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-bottom: $spacing-md;
}

.loading-icon {
  width: 40rpx;
  height: 40rpx;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.steps {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.step-item {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.step-item.active {
  opacity: 1;
}

.step-dot {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $gray-100;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-item.active .step-dot {
  background: #F7FbF4;
  border: 2rpx solid #8DBB77;
}

.step-item.done .step-dot {
  background: #8DBB77;
}

.step-number,
.step-check {
  font-size: $text-sm;
  color: $text-secondary;
}

.step-item.active .step-number {
  color: #8DBB77;
}

.step-item.done .step-check {
  color: #FFFFFF;
}

.step-label {
  font-size: $text-base;
  color: $text-primary;
}

.process-hint {
  margin-top: $spacing-lg;
  padding: $spacing-md;
  background: #F7FbF4;
  border-radius: $radius-lg;
  text-align: center;
}

.process-hint text {
  font-size: $text-sm;
  color: #8DBB77;
}

.result-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.result-icon {
  font-size: 40rpx;
}

.result-content {
  font-size: $text-base;
  color: $text-primary;
  line-height: 1.8;
  display: block;
  white-space: pre-wrap;
}

.error-card {
  text-align: center;
}

.error-icon {
  font-size: 64rpx;
  display: block;
  margin-bottom: $spacing-sm;
}

.error-desc {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
  margin-top: $spacing-xs;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}
</style>
