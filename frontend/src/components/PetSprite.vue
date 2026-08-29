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
      v-if="useCssSprite && hasValidFrames"
      class="pet-sprite-canvas"
      :class="currentAnimClass"
      :style="{ backgroundImage: `url(${spriteUrl})` }"
    ></view>
    <!-- 小程序端：所有帧预加载完成后再开始动画，避免 v-show 切换时图片未加载导致闪动 -->
    <template v-else-if="hasValidFrames">
      <image
        v-for="(url, i) in frameUrls"
        :key="url + '_' + i"
        class="pet-sprite-image"
        :src="url"
        mode="aspectFit"
        @load="onFrameLoad(i)"
        @error="onFrameError(i)"
        v-show="framesLoaded && displayFrameIndex === i"
      />
      <!-- 未加载完成时显示首帧占位，防止空白闪动 -->
      <image
        v-if="frameUrls.length > 0 && (!framesLoaded || !framesStarted)"
        class="pet-sprite-image"
        :src="frameUrls[0]"
        mode="aspectFit"
      />
    </template>
    <!-- 兜底：无可用帧图时显示占位剪影，避免完全空白；src 为空时不渲染 image 节点，防止 addListener 空指针 -->
    <view v-else class="pet-sprite-placeholder">
      <image
        v-if="fallbackImage"
        :src="fallbackImage"
        mode="aspectFit"
        class="pet-sprite-placeholder-img"
      />
    </view>
    <!-- 任务气泡：世界坐标绑定，跟随人物头顶 -->
    <view
      v-if="showBubble"
      class="task-bubble"
      :style="bubbleStyle"
      @click="onBubbleClick"
    >
      <slot name="bubble">
        <image v-if="bubbleIcon" :src="resolveStaticUrl(bubbleIcon)" mode="aspectFit" class="task-bubble-icon" />
        <text v-else class="task-bubble-text">!</text>
      </slot>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, onMounted } from 'vue';
import { resolveStaticUrl } from '../utils/environment';

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
  // 是否使用 CSS 雪碧图（默认 false，小程序端用逐帧 image）
  useCssSprite: { type: Boolean, default: false },
  // CSS 雪碧图地址（useCssSprite 为 true 时生效）
  spriteUrl: { type: String, default: '' },
  // 气泡控制
  showBubble: { type: Boolean, default: false },
  bubbleOffsetY: { type: Number, default: -60 },
  bubbleIcon: { type: String, default: '' },
  // 兜底占位图地址（可选，为空时使用默认剪影）
  fallbackSrc: { type: String, default: '' }
});

const emit = defineEmits(['bubbleClick', 'animationEnd', 'spriteClick']);

const currentFrameIndex = ref(0);
const currentAnimClass = computed(() => `anim-${props.anim}`);
let frameTimer = null;

// 帧预加载状态追踪
const loadedFrames = ref(new Set());
const framesLoaded = ref(false);
// 动画是否已开始播放（用于控制占位图显示时机）
const framesStarted = ref(false);
// 记录已开始加载的帧 URL，避免重复计数
const loadingFrameUrls = ref(new Set());

/**
 * 规范化帧数组：支持字符串和对象格式，同时解析 URL
 * @param {Array} raw - 原始帧数据
 * @returns {string[]} 规范化后的完整 URL 数组
 */
function normalizeFrameArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      let url = '';
      if (typeof item === 'string') url = item.trim();
      else if (item && typeof item === 'object') url = (item.url || item.src || '').trim();
      // 解析相对路径/localhost URL 为完整可访问地址
      url = resolveStaticUrl(url);
      return url;
    })
    .filter(url => url.length > 0);
}

const currentAnim = computed(() => {
  const anim = props.animations[props.anim] || props.animations.idle;
  if (!anim || !anim.frames) {
    console.warn('[PetSprite] 无可用动画配置，将显示兜底占位图');
    return { frames: [], fps: 2, loop: true };
  }
  const normalized = normalizeFrameArray(anim.frames);
  if (normalized.length === 0) {
    console.warn('[PetSprite] 动画配置 frames 解析后为空，将显示兜底占位图');
    return { frames: [], fps: 2, loop: true };
  }
  console.log('[PetSprite] using provided frames, count:', normalized.length, normalized[0]);
  return { ...anim, frames: normalized };
});

/**
 * 是否有有效的帧图可显示
 */
const hasValidFrames = computed(() => {
  if (props.useCssSprite) {
    return !!props.spriteUrl;
  }
  return currentAnim.value.frames.length > 0;
});

const frameUrls = computed(() => currentAnim.value.frames || []);

/**
 * 兜底占位图：优先使用传入的 fallbackSrc，其次使用当前动画的第一帧。
 * 不再回退到已不存在的 pet_moren.png，避免 404 报错。
 */
const fallbackImage = computed(() => {
  if (props.fallbackSrc) {
    return resolveStaticUrl(props.fallbackSrc);
  }
  const firstFrame = frameUrls.value[0];
  if (firstFrame) {
    return resolveStaticUrl(firstFrame);
  }
  // 无可用帧时不返回图片地址，避免请求不存在的兜底图
  return '';
});

/**
 * 计算当前显示帧索引（取模实现循环）
 */
const displayFrameIndex = computed(() => currentFrameIndex.value % Math.max(frameUrls.value.length, 1));

const bubbleStyle = computed(() => ({
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: '100%',
  marginBottom: '8px'
}));

/**
 * 重置帧加载状态，当动画切换时调用
 */
function resetFrameLoading() {
  loadedFrames.value = new Set();
  framesLoaded.value = false;
  framesStarted.value = false;
  loadingFrameUrls.value = new Set();
}

/**
 * 帧图片加载完成回调
 * @param {number} index - 帧索引
 */
function onFrameLoad(index) {
  loadedFrames.value.add(index);
  checkAllFramesLoaded();
}

/**
 * 帧图片加载失败回调（降级处理）
 * @param {number} index - 帧索引
 */
function onFrameError(index) {
  // 加载失败也计入"已加载"，避免永远不启动动画
  loadedFrames.value.add(index);
  checkAllFramesLoaded();
}

/**
 * 检查是否所有帧都已加载完成
 */
function checkAllFramesLoaded() {
  const total = frameUrls.value.length;
  if (total === 0) {
    framesLoaded.value = true;
    framesStarted.value = true;
    return;
  }
  // 只要有一半以上加载完成就认为可用（容忍个别帧加载失败）
  const minLoaded = Math.ceil(total * 0.5);
  if (loadedFrames.value.size >= minLoaded) {
    framesLoaded.value = true;
    // 所有帧就绪后再启动定时器，防止 v-show 切换时图片未加载导致闪动
    if (!framesStarted.value) {
      startFrameTimer();
    }
  }
}

/**
 * 启动帧动画定时器
 * 仅在所有帧加载完成后调用，避免帧切换时图片尚未就绪
 */
function startFrameTimer() {
  stopFrameTimer();
  if (props.useCssSprite || !frameUrls.value.length) return;
  framesStarted.value = true;
  const fps = currentAnim.value.fps || 10;
  frameTimer = setInterval(() => {
    currentFrameIndex.value++;
    if (!currentAnim.value.loop && currentFrameIndex.value >= frameUrls.value.length) {
      stopFrameTimer();
      emit('animationEnd', props.anim);
    }
  }, 1000 / fps);
}

/**
 * 停止帧动画定时器
 */
function stopFrameTimer() {
  if (frameTimer) {
    clearInterval(frameTimer);
    frameTimer = null;
  }
}

/**
 * 预加载所有帧图片（使用 uni.getImageInfo 确保图片就绪）
 * 不依赖 @load 事件，主动探测图片是否已缓存
 */
function preloadAllFrames() {
  if (props.useCssSprite) return;
  const urls = frameUrls.value;
  if (!urls.length) {
    framesLoaded.value = true;
    return;
  }
  // 重置加载状态
  resetFrameLoading();
  // 逐帧预加载
  urls.forEach((url, index) => {
    // 标记为正在加载
    loadingFrameUrls.value.add(url);
    // 使用 uni.getImageInfo 主动预加载
    uni.getImageInfo({
      src: url,
      success: () => {
        loadedFrames.value.add(index);
        checkAllFramesLoaded();
      },
      fail: () => {
        // 加载失败也计入已加载（降级容错）
        loadedFrames.value.add(index);
        checkAllFramesLoaded();
      }
    });
  });
  // 设置超时兜底：2秒后强制启动动画（即使部分帧未加载完成）
  setTimeout(() => {
    if (!framesLoaded.value) {
      framesLoaded.value = true;
      if (!framesStarted.value) {
        startFrameTimer();
      }
    }
  }, 2000);
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

// 监听动画切换：重置帧索引并预加载新动画的帧
watch(() => props.anim, () => {
  currentFrameIndex.value = 0;
  preloadAllFrames();
});

// 监听动画配置变化（fps、frames 数组等）
watch(() => currentAnim.value, () => {
  currentFrameIndex.value = 0;
  preloadAllFrames();
}, { deep: true });

// 组件挂载后再预加载帧，避免 setup 阶段异步回调触发 "Expected updated data but get first rendering data"
onMounted(() => {
  preloadAllFrames();
});

onUnmounted(() => {
  stopFrameTimer();
  loadedFrames.value = new Set();
  framesLoaded.value = false;
  framesStarted.value = false;
});
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
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 关键：添加 hardware-acceleration 和 transition:none 防止图片切换时的闪烁 */
  transition: none;
  transform: translateZ(0);
  will-change: contents;
}

/* 兜底占位图：所有帧图都不可用时显示，避免完全空白 */
.pet-sprite-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.pet-sprite-placeholder-img {
  width: 80%;
  height: 80%;
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
