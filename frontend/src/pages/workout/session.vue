<template>
  <view class="session-page">
    <scroll-view class="scroll-content" scroll-y>
      <view class="video-wrap">
        <video
          v-if="detail.video_url"
          id="workoutVideo"
          class="workout-video"
          :src="detail.video_url"
          :poster="detail.cover_url"
          :controls="false"
          :show-play-btn="false"
          :show-center-play-btn="false"
          :show-fullscreen-btn="false"
          :enable-play-gesture="false"
          loop
          object-fit="contain"
        ></video>
        <view v-else class="video-placeholder">
          <image class="placeholder-img" :src="detail.cover_url || defaultWorkoutCoverUrl" mode="aspectFit" />
          <text class="placeholder-text">视频准备中，先跟着动作完成吧</text>
        </view>

        <!-- 开始前 5 秒倒计时 -->
        <view v-if="phase === 'countdown'" class="video-overlay">
          <text class="countdown-num">{{ countdownLeft }}</text>
          <text class="overlay-tip">准备开始</text>
        </view>
        <!-- 组间休息 -->
        <view v-else-if="phase === 'resting'" class="video-overlay">
          <text class="countdown-num">{{ restLeft }}</text>
          <text class="overlay-tip">组间休息，下一组马上开始</text>
        </view>
        <!-- 暂停 -->
        <view v-else-if="phase === 'paused'" class="video-overlay">
          <text class="overlay-tip paused-tip">已暂停</text>
        </view>
      </view>

      <view class="info-card">
        <view class="info-stats">
          <view class="stat-item">
            <text class="stat-value">{{ durationText }}</text>
            <text class="stat-label">课程时长</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-item">
            <text class="stat-value">{{ Math.round(detail.calorie_per_hour || 0) }}</text>
            <text class="stat-label">千卡/小时</text>
          </view>
        </view>
        <text v-if="detail.description" class="info-desc">{{ detail.description }}</text>
      </view>

      <view class="timer-card">
        <text class="timer-label">已跟练</text>
        <text class="timer-value">{{ formatTime(elapsed) }}</text>
        <text v-if="isSetsMode" class="set-label">第 {{ currentSet }} / {{ detail.sets_count || 1 }} 组</text>
      </view>

      <view class="bottom-placeholder"></view>
    </scroll-view>

    <view class="bottom-actions">
      <template v-if="phase === 'ready'">
        <view class="action-btn primary full" @click="startWorkout">开始跟练</view>
      </template>
      <template v-else>
        <view class="action-btn secondary" @click="onExit">{{ phase === 'done' ? '返回' : '结束' }}</view>
        <view v-if="phase === 'playing'" class="action-btn primary" @click="pause">暂停</view>
        <view v-else-if="phase === 'paused'" class="action-btn primary" @click="resume">继续</view>
        <view v-else-if="phase === 'countdown' || phase === 'resting'" class="action-btn primary disabled">准备中</view>
        <view v-else class="action-btn primary disabled">已完成</view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { workoutApi } from '../../api';
import { goBack as navigateBack } from '../../utils/navigate';
import { resolveStaticUrl } from '../../utils/environment.js';

/** 跟练页默认封面：改为远程 CDN 加载以减小小程序包体积 */
const defaultWorkoutCoverUrl = resolveStaticUrl('/static/image/icon/jiyundong.png');

const workoutKey = ref('');
const detail = ref({});

// phase: ready(待开始) -> countdown(5秒倒计时) -> playing ⇄ paused，分组模式插入 resting，结束为 done
const phase = ref('ready');
const countdownLeft = ref(5);
const elapsed = ref(0);        // 实际跟练秒数（仅 playing 时累计，用于消耗折算）
const currentSet = ref(1);
const setElapsed = ref(0);     // 当前组已进行秒数
const restLeft = ref(0);
const recorded = ref(false);   // 是否已写入运动记录（防止重复记录）

let timer = null;
let videoCtx = null;

const isSetsMode = computed(() => detail.value.duration_mode !== 'unlimited');

const durationText = computed(() => {
  const d = detail.value;
  if (d.duration_mode === 'unlimited') return '不限时长';
  const mins = d.set_minutes || Math.round((d.duration_seconds || 0) / 60) || 0;
  const sets = d.sets_count || 1;
  return sets > 1 ? `${mins} 分钟 × ${sets} 组` : `${mins} 分钟`;
});

onMounted(() => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  workoutKey.value = page.options?.key || page.$page?.options?.key;
  loadDetail();
});

onUnmounted(() => {
  stopTick();
});

async function loadDetail() {
  if (!workoutKey.value) return;
  try {
    const res = await workoutApi.getDetail(workoutKey.value);
    detail.value = res.data || {};
  } catch (e) {
    console.error(e);
  }
}

function getVideoCtx() {
  if (!videoCtx && detail.value.video_url) {
    videoCtx = uni.createVideoContext('workoutVideo');
  }
  return videoCtx;
}

function playVideo() {
  const ctx = getVideoCtx();
  if (ctx) ctx.play();
}

function pauseVideo() {
  const ctx = getVideoCtx();
  if (ctx) ctx.pause();
}

// 用户点击「开始跟练」后进入 5 秒准备倒计时
function startWorkout() {
  if (phase.value !== 'ready') return;
  phase.value = 'countdown';
  countdownLeft.value = 5;
  startTick();
}

function startTick() {
  stopTick();
  timer = setInterval(onTick, 1000);
}

function stopTick() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function onTick() {
  if (phase.value === 'countdown') {
    countdownLeft.value--;
    if (countdownLeft.value <= 0) {
      phase.value = 'playing';
      playVideo();
    }
    return;
  }

  if (phase.value === 'playing') {
    elapsed.value++;
    if (isSetsMode.value) {
      setElapsed.value++;
      const setSeconds = (detail.value.set_minutes || 0) * 60;
      const totalSets = detail.value.sets_count || 1;
      if (setSeconds > 0 && setElapsed.value >= setSeconds) {
        if (currentSet.value >= totalSets) {
          // 最后一组结束：自动完成并记录
          finish();
        } else {
          // 进入组间休息
          currentSet.value++;
          setElapsed.value = 0;
          const rest = detail.value.rest_seconds || 0;
          if (rest > 0) {
            restLeft.value = rest;
            phase.value = 'resting';
            pauseVideo();
          }
        }
      }
    }
    return;
  }

  if (phase.value === 'resting') {
    restLeft.value--;
    if (restLeft.value <= 0) {
      phase.value = 'playing';
      playVideo();
    }
  }
}

function pause() {
  if (phase.value !== 'playing') return;
  phase.value = 'paused';
  pauseVideo();
}

function resume() {
  if (phase.value !== 'paused') return;
  phase.value = 'playing';
  playVideo();
}

// 写入运动记录（按实际跟练时长，后端按 千卡/小时 折算消耗）
async function recordOnce() {
  if (recorded.value || elapsed.value <= 0) return null;
  recorded.value = true;
  try {
    const res = await workoutApi.complete(workoutKey.value, { duration_seconds: elapsed.value });
    return res.data || {};
  } catch (e) {
    console.error(e);
    recorded.value = false;
    return null;
  }
}

async function finish() {
  if (phase.value === 'done') return;
  phase.value = 'done';
  stopTick();
  pauseVideo();
  const result = await recordOnce();
  if (result && !result.error) {
    const mins = Math.round(elapsed.value / 60);
    const kcal = result.calorie !== undefined ? `，消耗 ${result.calorie} 千卡` : '';
    uni.showToast({ title: `已完成跟练 ${mins} 分钟${kcal}`, icon: 'none', duration: 2000 });
  } else {
    uni.showToast({ title: '打卡失败，请重试', icon: 'none' });
  }
  setTimeout(() => navigateBack(), 1500);
}

// 随时退出：已开始则按已跟练时长自动记录当日运动数据，未开始直接返回
async function onExit() {
  if (phase.value === 'done' || phase.value === 'ready') {
    navigateBack();
    return;
  }
  stopTick();
  pauseVideo();
  if (elapsed.value > 0) {
    const result = await recordOnce();
    if (result && !result.error) {
      const mins = Math.max(1, Math.round(elapsed.value / 60));
      const kcal = result.calorie !== undefined ? `，消耗 ${result.calorie} 千卡` : '';
      uni.showToast({ title: `已记录运动 ${mins} 分钟${kcal}`, icon: 'none', duration: 2000 });
      setTimeout(() => navigateBack(), 1200);
      return;
    }
  }
  navigateBack();
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
</script>

<style lang="scss" scoped>
.session-page {
  height: 100vh;
  min-height: 100vh;
  background: #F7FBF4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scroll-content {
  flex: 1;
  height: 0;
  overflow-y: auto;
}

/* 播放器：1:1，距屏幕四边 24px，全局超浅绿色底 */
.video-wrap {
  position: relative;
  margin: 24px;
  aspect-ratio: 1 / 1;
  border-radius: 24rpx;
  overflow: hidden;
  background: #F7FBF4;
}
.workout-video {
  width: 100%;
  height: 100%;
  background: #F7FBF4;
  /* 用户只能通过 开始/暂停/结束 控制视频，不能直接操作视频窗口 */
  pointer-events: none;
}
/* 视频元素默认黑底会在边缘露出一圈不匀称的黑线，统一为全局浅绿底 */
.video-wrap :deep(uni-video),
.video-wrap :deep(video),
.video-wrap :deep(.uni-video-container) {
  background: #F7FBF4;
}
.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.placeholder-img {
  width: 200rpx;
  height: 200rpx;
}
.placeholder-text {
  font-size: 24rpx;
  color: #999;
  margin-top: 16rpx;
}
.video-overlay {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(247, 251, 244, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.countdown-num {
  font-size: 120rpx;
  font-weight: 700;
  color: #563E22;
  line-height: 1;
}
.overlay-tip {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #8a9b80;
}
.paused-tip {
  font-size: 40rpx;
  font-weight: 600;
}

/* 课程信息：数据分层展示（不再重复显示标题，标题在顶部导航） */
.info-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin: 0 24px 24rpx;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.info-stats {
  display: flex;
  align-items: center;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.stat-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #563E22;
}
.stat-label {
  font-size: 22rpx;
  color: #999;
}
.stat-divider {
  width: 2rpx;
  height: 56rpx;
  background: #eef3ea;
}
.info-desc {
  display: block;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid #f4f7f1;
  font-size: 24rpx;
  color: #999;
  line-height: 36rpx;
  text-align: center;
}

.timer-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin: 0 24px 24rpx;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.timer-label {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}
.timer-value {
  font-size: 64rpx;
  font-weight: 700;
  color: #8DBB77;
}
.set-label {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #8DBB77;
  font-weight: 600;
}

.bottom-placeholder {
  height: 200rpx;
  flex-shrink: 0;
}

.bottom-actions {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 24px calc(24rpx + env(safe-area-inset-bottom));
  background: #F7FBF4;
  border-top: 1rpx solid rgba(0,0,0,0.04);
  flex-shrink: 0;
}
.action-btn {
  flex: 1;
  height: 96rpx;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 600;
}
.action-btn.secondary {
  background: #fff;
  color: #666;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.action-btn.primary {
  background: #8DBB77;
  color: #fff;
}
.action-btn.primary.disabled {
  background: #ccc;
}
</style>
