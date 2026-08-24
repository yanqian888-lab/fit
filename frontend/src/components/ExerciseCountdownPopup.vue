<template>
  <view class="countdown-mask">
    <view class="countdown-card">
      <!-- 标题 -->
      <text class="card-title">{{ exerciseName }}运动中</text>
      
      <!-- 搭搭运动动画区域 -->
      <view class="pet-animation-area">
        <image 
          v-if="animUrl" 
          class="pet-anim" 
          :src="animUrl" 
          mode="aspectFit" 
          :class="{ 'playing': isPlaying }"
        />
        <view v-else class="pet-placeholder">
          <text class="placeholder-text">搭搭正在运动中...</text>
        </view>
      </view>
      
      <!-- 倒计时显示 -->
      <view class="countdown-circle">
        <text class="countdown-text">{{ formattedTime }}</text>
        <text class="countdown-label">运动倒计时</text>
      </view>
      
      <!-- 运动进度条 -->
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
      </view>
      
      <!-- 跟练按钮（如果有跟练课程） -->
      <view v-if="hasWorkout" class="workout-btn" @click="goWorkout">
        <text class="workout-btn-text">去跟练 ›</text>
      </view>
      
      <!-- 提示文字 -->
      <text class="tip-text">加油！搭搭正在努力运动💪</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  /** 运动名称 */
  exerciseName: { type: String, default: '运动' },
  /** 动画URL */
  animUrl: { type: String, default: '' },
  /** 倒计时总时长（秒） */
  duration: { type: Number, default: 180 },
  /** 是否有跟练课程 */
  hasWorkout: { type: Boolean, default: false },
  /** 跟练课程的 workout_key */
  workoutKey: { type: String, default: '' }
});

const emit = defineEmits(['close', 'go-workout']);

const isPlaying = ref(true);
const remainingSeconds = ref(props.duration);
let timer = null;

/**
 * 格式化倒计时时间为 MM:SS
 */
const formattedTime = computed(() => {
  const mins = Math.floor(remainingSeconds.value / 60);
  const secs = remainingSeconds.value % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
});

/**
 * 进度百分比
 */
const progressPercent = computed(() => {
  if (props.duration <= 0) return 100;
  return Math.round((remainingSeconds.value / props.duration) * 100);
});

/**
 * 开始倒计时
 */
function startCountdown() {
  timer = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--;
    } else {
      stopCountdown();
      emit('close');
    }
  }, 1000);
}

/**
 * 停止倒计时
 */
function stopCountdown() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * 跳转到跟练页面
 */
function goWorkout() {
  stopCountdown();
  emit('go-workout', props.workoutKey);
}

onMounted(() => {
  remainingSeconds.value = props.duration;
  startCountdown();
});

onUnmounted(() => {
  stopCountdown();
});

watch(() => props.duration, (newVal) => {
  remainingSeconds.value = newVal;
});
</script>

<style lang="scss" scoped>
.countdown-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.countdown-card {
  width: 560rpx;
  background: linear-gradient(180deg, #F0F9E8 0%, #E8F6D7 100%);
  border: 4rpx solid #563E22;
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.card-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #563E22;
  text-align: center;
}

.pet-animation-area {
  width: 320rpx;
  height: 320rpx;
  margin: 32rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFFFFF;
  border-radius: 24rpx;
  overflow: hidden;
}

.pet-anim {
  width: 100%;
  height: 100%;
}

.pet-anim.playing {
  animation: bounce 0.6s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10rpx); }
}

.pet-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  font-size: 28rpx;
  color: #8EBB77;
}

.countdown-circle {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24rpx;
}

.countdown-text {
  font-size: 80rpx;
  font-weight: 700;
  color: #563E22;
  font-family: monospace;
  line-height: 1.2;
}

.countdown-label {
  font-size: 24rpx;
  color: #8EBB77;
  margin-top: 8rpx;
}

.progress-bar {
  width: 100%;
  height: 16rpx;
  background: #DDF3D2;
  border-radius: 8rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #8EBB77 0%, #6BA55A 100%);
  border-radius: 8rpx;
  transition: width 1s linear;
}

.workout-btn {
  width: 100%;
  height: 88rpx;
  margin-top: 32rpx;
  background: linear-gradient(135deg, #FF9F6B 0%, #FF7B44 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workout-btn-text {
  font-size: 30rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.tip-text {
  margin-top: 24rpx;
  font-size: 24rpx;
  color: #8EBB77;
  text-align: center;
}
</style>
