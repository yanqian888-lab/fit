<template>
  <view
    class="pet-sprite"
    :style="{
      left: x + 'rpx',
      top: y + 'rpx',
      width: width + 'rpx',
      height: height + 'rpx',
      zIndex: zIndex
    }"
    @click="onSpriteClick"
  >
    <!-- CSS 雪碧图方式（H5/App） -->
    <view
      v-if="useCssSprite"
      class="pet-sprite-canvas"
      :class="currentAnimClass"
      :style="{ backgroundImage: `url(${spriteUrl})` }"
    ></view>
    <!-- 兜底：逐帧 image 切换（小程序/兼容性兜底） -->
    <image
      v-else
      class="pet-sprite-image"
      :src="currentFrameUrl"
      mode="aspectFit"
    />
    <!-- 任务气泡：世界坐标绑定，跟随人物头顶 -->
    <view
      v-if="showBubble"
      class="task-bubble"
      :style="bubbleStyle"
      @click="onBubbleClick"
    >
      <slot name="bubble">
        <image v-if="bubbleIcon" :src="bubbleIcon" mode="aspectFit" class="task-bubble-icon" />
        <text v-else class="task-bubble-text">!</text>
      </slot>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';

const props = defineProps({
  // 世界坐标（rpx）
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  // 角色尺寸（rpx）
  width: { type: Number, default: 300 },
  height: { type: Number, default: 300 },
  zIndex: { type: Number, default: 10 },
  // 动画配置 { animKey: { frames: 8, fps: 12, loop: true, frames: ['url1','url2'] } }
  animations: { type: Object, required: true },
  // 当前动画名
  anim: { type: String, default: 'idle' },
  // 是否使用 CSS 雪碧图（默认 true，App 建议 false 用逐帧 image）
  useCssSprite: { type: Boolean, default: false },
  // CSS 雪碧图地址（useCssSprite 为 true 时生效）
  spriteUrl: { type: String, default: '' },
  // 气泡控制
  showBubble: { type: Boolean, default: false },
  bubbleOffsetY: { type: Number, default: -60 },
  bubbleIcon: { type: String, default: '' }
});

const emit = defineEmits(['bubbleClick', 'animationEnd', 'spriteClick']);

const currentFrameIndex = ref(0);
const currentAnimClass = computed(() => `anim-${props.anim}`);
let frameTimer = null;

const currentAnim = computed(() => props.animations[props.anim] || props.animations.idle || { frames: [], fps: 10, loop: true });

const frameUrls = computed(() => currentAnim.value.frames || []);
const currentFrameUrl = computed(() => frameUrls.value[currentFrameIndex.value % frameUrls.value.length] || '');

const bubbleStyle = computed(() => ({
  left: '50%',
  transform: 'translateX(-50%)',
  // 锚定气泡底边，与形象顶部保持 8px 间距（气泡再高也不会压到形象）
  bottom: '100%',
  marginBottom: '8px'
}));

function startFrameTimer() {
  stopFrameTimer();
  if (props.useCssSprite || !frameUrls.value.length) return;
  const fps = currentAnim.value.fps || 10;
  frameTimer = setInterval(() => {
    currentFrameIndex.value++;
    if (!currentAnim.value.loop && currentFrameIndex.value >= frameUrls.value.length) {
      stopFrameTimer();
      emit('animation-end', props.anim);
    }
  }, 1000 / fps);
}

function stopFrameTimer() {
  if (frameTimer) {
    clearInterval(frameTimer);
    frameTimer = null;
  }
}

function onAnimationEnd() {
  emit('animationEnd', props.anim);
}

function onBubbleClick() {
  emit('bubbleClick');
}

function onSpriteClick() {
  emit('spriteClick');
}

watch(() => props.anim, () => {
  currentFrameIndex.value = 0;
  startFrameTimer();
});

// 监听动画配置变化（如后台修改 fps、替换序列帧），实时重启定时器
watch(() => currentAnim.value.fps, () => {
  startFrameTimer();
});

startFrameTimer();
onUnmounted(stopFrameTimer);
</script>

<style lang="scss" scoped>
.pet-sprite {
  position: absolute;
  pointer-events: auto;
}

.pet-sprite-canvas {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  background-size: cover;
}

.pet-sprite-image {
  width: 100%;
  height: 100%;
}

.task-bubble {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: bubble-bounce 1.2s ease-in-out infinite;
}

.task-bubble-icon {
  width: 60px;
  height: 64px;
}

.task-bubble-text {
  font-size: 32rpx;
  color: #563E22;
  font-weight: 700;
  line-height: 1;
}

@keyframes bubble-bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-10rpx); }
}
</style>
