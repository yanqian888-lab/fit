<template>
  <view class="pet-page">
    <view class="status-bar"></view>

    <!-- 底层：可滑动场景地图（设置兜底背景色，避免背景图加载失败时整页空白） -->
    <view
      class="scene-stage"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @mousedown="onMouseDown"
    >
      <transition name="scene-fade" mode="out-in">
        <view
          :key="currentSceneKey"
          class="scene-map"
          :style="mapStyle"
        >
          <image
            class="scene-bg"
            :src="currentBgImage"
            mode="aspectFill"
            @error="onSceneBgError"
          />

          <!-- 场景物品 -->
          <view
            v-for="item in (currentScene.items || [])"
            :key="item.key"
            class="scene-item"
            :style="{
              left: item.x * coordScale + 'rpx',
              top: item.y * coordScale + 'rpx',
              width: item.width * coordScale + 'rpx',
              height: item.height * coordScale + 'rpx',
              zIndex: 5
            }"
            @click="onItemClick(item)"
          >
            <image
              :src="item.src"
              mode="aspectFit"
              class="scene-item-img"
              :style="item.animation ? { animation: item.animation } : {}"
            />
            <view
              v-if="itemBubbleVisible(item)"
              class="item-bubble"
              @click="onItemBubbleClick(item)"
            >
              <image :src="bubbleIcon(item.bubbleKey)" mode="aspectFit" class="item-bubble-icon" />
            </view>
          </view>

          <!-- 宠物角色（夜晚休息不展示；坐标/形象由 CMS pet_sprite 配置） -->
          <PetSprite
            v-if="!isAway && !isNight"
            :x="spriteConfig.x * coordScale"
            :y="spriteConfig.y * coordScale"
            :width="spriteConfig.width * coordScale"
            :height="spriteConfig.height * coordScale"
            :animations="spriteAnimations"
            :anim="petAnim"
            :show-bubble="showPetBubble"
            bubble-icon="/static/image/icon/tanhao@3x.png"
            @bubbleClick="onPetBubbleClick"
            @animationEnd="onPetAnimationEnd"
            @spriteClick="onPetSpriteClick"
          />
        </view>
      </transition>
    </view>

    <!-- 外出/夜晚提示（屏幕居中固定，不随地图滑动） -->
    <view v-if="isAway" class="away-tip away-tip--screen">
      <text class="away-tip-text">搭搭出去逛逛啦，先去玩会儿别的再来吧～</text>
      <text v-if="remainingTime" class="away-tip-time">预计 {{ remainingTime }} 后回来</text>
    </view>
    <view v-else-if="isNight" class="away-tip away-tip--screen">
      <text class="away-tip-text">搭搭已经休息了，明天再来陪它玩吧～</text>
    </view>

    <!-- 顶层：固定功能层（不随地图滑动） -->
    <view class="fixed-layer">
      <!-- 场景切换入口（后台配置了多个场景才显示，一期单场景不显示） -->
      <view v-if="showSceneSwitcher" class="scene-switcher" style="right: 32rpx; top: calc(var(--status-bar-height) + 20rpx);">
        <view
          v-for="s in sceneList"
          :key="s.key"
          class="scene-switch-item"
          :class="{ active: currentSceneKey === s.key }"
          @click="switchScene(s.key)"
        >
          <text>{{ s.name }}</text>
        </view>
      </view>

      <!-- 底部功能面板：上半部分透明透出背景图，下半部分保留浅绿色衬底 -->

      <view class="bottom-panel">
        <view class="bottom-item" @click="goTasks">
          <image class="bottom-icon" src="/static/image/icon/renwu@3x.png" mode="aspectFit" />
          <text class="bottom-text">任务</text>
        </view>
        <view class="bottom-item" @click="goInventory">
          <image class="bottom-icon" src="/static/image/icon/beibao@3x.png" mode="aspectFit" />
          <text class="bottom-text">背包</text>
        </view>
        <view class="bottom-item" @click="openEventsPanel">
          <image class="bottom-icon" src="/static/image/icon/shijian@3x.png" mode="aspectFit" />
          <text class="bottom-text">事件</text>
        </view>
        <view class="bottom-item" @click="goShop">
          <image class="bottom-icon" src="/static/image/icon/shangdianicon@3x.png" mode="aspectFit" />
          <text class="bottom-text">商店</text>
        </view>
      </view>
    </view>

    <!-- 弹窗层：吃饭/运动提示 -->
    <view v-if="hintBubbleVisible" class="hint-mask" @click="closeHintBubble">
      <image class="hint-pet" src="/static/image/icon/dada02@3x.png" mode="aspectFit"/>
      <view class="hint-bubble">
        <text class="hint-bubble-text">{{ hintType === 'exercise' ? '该运动啦，帮我选一个吧' : '好饿呀，给我吃点东西吧!' }}</text>
      </view>
      <view
        v-if="hintType === 'meal'"
        class="hint-btn"
        style="top: 868rpx;"
        @click="onFindFood"
      >去找食物</view>
      <template v-else>
        <view
          v-for="(option, index) in exerciseOptions"
          :key="option.key"
          class="hint-btn"
          :class="{ locked: option.locked }"
          :style="{ top: (868 + index * 112) + 'rpx' }"
          @click="onExercise(option)"
        >{{ option.name }}{{ option.locked ? '（需器材）' : '' }}</view>
      </template>
    </view>

    <!-- 弹窗层：点击宠物随机对话 -->
    <view v-if="petDialogueVisible" class="dialogue-mask" @click="closePetDialogue">
      <view class="dialogue-bubble" @click="noop">
        <text class="dialogue-bubble-text">{{ currentPetDialogue }}</text>
      </view>
      <view class="dialogue-btn" @click="closePetDialogue">我知道啦！</view>
    </view>

    <!-- 弹窗层：任务气泡详情（GIF/视频，后台配置） -->
    <view v-if="taskPopupVisible" class="popup-mask" @click="closeTaskPopup">
      <view class="popup-card">
        <view class="popup-close" @click="closeTaskPopup">✕</view>
        <view v-if="taskPopup.type === 'video'" class="popup-video-wrap">
          <video class="popup-video" :src="taskPopup.url" controls autoplay loop muted />
        </view>
        <image v-else class="popup-gif" :src="taskPopup.url" mode="widthFix" />
        <view class="popup-desc">{{ taskPopup.description || '完成这个任务，搭搭会更开心哦～' }}</view>
        <view class="popup-btn" @click="onTaskPopupConfirm">去完成</view>
      </view>
    </view>

    <!-- 弹窗层：事件相册（集合 tab + 解锁进度 + 缺省槽位） -->
    <EventsPanel v-if="eventPanelVisible" @close="eventPanelVisible = false" @select-event="onViewEvent" />

    <!-- 弹窗层：任务/背包/商店（页面内弹层） -->
    <TaskPanel v-if="taskPanelVisible" @close="taskPanelVisible = false" @updated="loadCurrency" @open-shop="onTaskOpenShop" />
    <BagPanel v-if="bagPanelVisible" :pet-data="pet" @close="bagPanelVisible = false" @goShop="onBagGoShop" @fed="onBagFed" />
    <ShopPanel v-if="shopPanelVisible" :initial-category="shopInitialCategory" @close="onShopClose" @bought="loadCurrency" />

    <!-- 弹窗层：首喂食谱解锁 -->
    <RecipeUnlockPopup v-if="recipeUnlock" :recipe="recipeUnlock" @close="recipeUnlock = null" />

    <!-- 弹窗层：运动动画（运动配置的运动动画，展示 3 秒） -->
    <view v-if="exerciseAnimVisible" class="exercise-anim-mask">
      <image class="exercise-anim-img" :src="exerciseAnimUrl" mode="aspectFit" />
    </view>

    <!-- 弹窗层：新事件（掉落入场动画） -->
    <view v-if="newEvent" class="event-mask">
      <view class="event-card">
        <!-- 顶部插画：事件图垫在外框内（位置偏下，对齐外框窗口） -->
        <view class="card-frame-wrap">
          <image class="card-photo" :src="newEventPhoto" mode="aspectFill" />
          <image class="card-frame" :src="newEvent.review ? '/static/image/icon/huigu.png' : '/static/image/icon/xinshijian.png'" mode="aspectFit" />
        </view>
        <!-- 绿色信息面板 -->
        <view class="card-panel">
          <text v-if="newEvent.collection_name" class="event-coll-pill">{{ newEvent.collection_name }}</text>
          <text class="event-title">{{ newEvent.title }}</text>
          <text class="event-content">{{ newEvent.content || '暂无详细内容' }}</text>
          <!-- 底部操作栏：保存到相册 + 关闭 -->
          <view class="card-actions">
            <view class="btn btn-ghost" @click="closeNewEvent">
              <text>关闭</text>
            </view>
            <view class="btn btn-primary" @click="downloadEventPhoto">
              <text>保存到相册</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 隐藏画布：生成事件分享图（离屏，不可见） -->
    <canvas
      canvas-id="eventShareCanvas"
      class="event-share-canvas"
      :style="{ width: SHARE_CANVAS_W + 'px', height: SHARE_CANVAS_H + 'px' }"
    />

    <!-- 运动需要器材引导弹框 -->
    <AppModal
      v-model:visible="showNeedEquipmentModal"
      icon="none"
      title="需要器材"
      :text="needEquipmentText"
      confirmText="去商城"
      cancelText="取消"
      @confirm="confirmGoShop"
      @cancel="showNeedEquipmentModal = false"
    />

    <!-- 运动完成后引导跟练弹框 -->
    <AppModal
      v-model:visible="showWorkoutGuideModal"
      icon="none"
      title="跟练课程"
      :text="workoutGuideText"
      confirmText="去跟练"
      cancelText="下次"
      @confirm="confirmGoWorkout"
      @cancel="showWorkoutGuideModal = false"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import PetSprite from '../../components/PetSprite.vue';
import TaskPanel from './panels/TaskPanel.vue';
import BagPanel from './panels/BagPanel.vue';
import ShopPanel from './panels/ShopPanel.vue';
import EventsPanel from './panels/EventsPanel.vue';
import RecipeUnlockPopup from '../../components/RecipeUnlockPopup.vue';
import AppModal from '../../components/AppModal.vue';
import { petApi } from '../../api';
import { fallbackScenes, defaultSceneKey } from './sceneConfig.js';
import { resolveStaticUrl } from '../../utils/environment';
import { getSystemInfoSafe } from '../../utils/systemInfo';
import { useUserStore } from '../../store';
import { usePageCacheStore, CACHE_KEYS } from '../../store/page-cache';

const userStore = useUserStore();
const pageCache = usePageCacheStore();

// 数据加载状态
const loading = ref(false);
// 是否有缓存数据
const hasCachedData = ref(false);

function noop() {}

// ==================== 统一风格弹框状态 ====================
// 运动需要器材引导
const showNeedEquipmentModal = ref(false);
const needEquipmentText = ref('');
let needEquipmentOpenShop = false;
// 运动完成引导跟练
const showWorkoutGuideModal = ref(false);
const workoutGuideText = ref('');
let pendingWorkoutKey = '';

const pet = ref({});
const state = ref({});
const currency = ref({});
const eventPanelVisible = ref(false);
const hintBubbleVisible = ref(false);
const newEvent = ref(null);
const newEventReward = ref(null);
// 首喂掉落的食谱弹窗
const recipeUnlock = ref(null);
const remainingTime = ref('');
let timer = null;

// 场景与地图
const currentSceneKey = ref(defaultSceneKey);
// 场景列表：后台 pet_scenes 配置优先，未配置时用本地兜底（一期默认单场景小窝）
const sceneList = computed(() => {
  const cfg = pet.value.scenes;
  const list = cfg && Array.isArray(cfg.list) ? cfg.list.filter(s => s && s.key && s.name) : [];
  return list.length > 0 ? list : fallbackScenes;
});
const currentScene = computed(() =>
  sceneList.value.find(s => s.key === currentSceneKey.value) || sceneList.value[0]
);
// 配置了多个场景才显示切换入口
const showSceneSwitcher = computed(() => sceneList.value.length > 1);
const translateX = ref(0);
const isDragging = ref(false);
// 用户是否手动拖过地图（未拖动时窗口尺寸变化后保持居中）
const hasDragged = ref(false);
let dragStartX = 0;
let dragStartTranslateX = 0;

// 背景图设计稿参考高度（rpx），后台所有地图坐标均基于此固定参考系：
// 坐标系原点为背景图左上角，Y 轴范围 [0, bg_height]，X 轴范围 [0, bg_height × 宽高比]
const DESIGN_HEIGHT_RPX = 1450;

// 舞台实际高度 = 屏幕可用高度 - 底部 tabbar（含安全区），确保背景完整展示
const stageHeightRpx = ref(DESIGN_HEIGHT_RPX);

function measureStage() {
  try {
    const info = getSystemInfoSafe();
    const windowWidth = info.windowWidth || 375;
    const windowHeight = info.windowHeight || 667;
    const safeBottom = (info.safeAreaInsets && info.safeAreaInsets.bottom) || 0;
    /*
     * 向下扩展背景图高度，减少浅绿色底色区域：
     * 背景图下沿接近功能区底部，舞台下沿设为 16rpx。
     */
    const tabbarPx = (16 / 750) * windowWidth + safeBottom;
    const stagePx = Math.max(0, windowHeight - tabbarPx);
    stageHeightRpx.value = (stagePx / windowWidth) * 750;
  } catch (e) {}
}

const designHeightRpx = computed(() => {
  const scene = currentScene.value || {};
  return scene.bg_height || scene.bgHeight || DESIGN_HEIGHT_RPX;
});

// 坐标缩放比例：把后台配置的地图坐标（基于背景参考高度）映射到当前舞台实际尺寸。
// 背景高度固定 = 舞台高度，宽度按真实宽高比等比缩放，坐标随同一比例缩放，
// 因此屏幕尺寸变化时形象/物品始终固定在背景地图的同一位置。
const coordScale = computed(() => stageHeightRpx.value / designHeightRpx.value);

// 背景图真实宽高比（运行时测量），避免后台配置值与图片实际比例不符导致拉伸/错位
const bgAspect = ref(0);
let bgAspectRetryCount = 0;
const MAX_BG_ASPECT_RETRIES = 3;

/**
 * 测量背景图真实宽高比
 * 带重试机制，避免首次加载时图片缓存未就绪导致的测量失败
 * @param {string} url - 背景图 URL
 */
function measureBgAspect(url) {
  if (!url) return;
  uni.getImageInfo({
    src: url,
    success: (info) => {
      // 仅当测量的仍是当前背景时采纳，防止时段切换后旧图结果覆盖
      if (info && info.width && info.height && currentBgImage.value === url) {
        bgAspect.value = info.width / info.height;
        bgAspectRetryCount = 0; // 成功后重置重试计数
      }
    },
    fail: () => {
      // 重试机制：最多重试 3 次，每次间隔 500ms
      if (bgAspectRetryCount < MAX_BG_ASPECT_RETRIES) {
        bgAspectRetryCount++;
        setTimeout(() => {
          // 重试前再次确认 URL 未变
          if (currentBgImage.value === url) {
            measureBgAspect(url);
          }
        }, 500);
      }
    }
  });
}

/**
 * 有效宽高比：优先使用实测值，回退到场景配置，最后使用通用默认值
 */
const effectiveAspect = computed(() => {
  const scene = currentScene.value || {};
  if (bgAspect.value > 0) return bgAspect.value;
  if (scene.bg_aspect && scene.bg_aspect > 0) return scene.bg_aspect;
  if (scene.bgAspect && scene.bgAspect > 0) return scene.bgAspect;
  // 通用默认值：基于常见竖屏背景图比例
  return 1871 / 1930;
});

// 地图宽度 = 舞台高度 × 宽高比（等比缩放，不拉伸）
const mapWidth = computed(() => Math.max(750, Math.round(stageHeightRpx.value * effectiveAspect.value)));

// 底图默认在屏幕中水平居中展示
function centerMap() {
  translateX.value = clampTranslateX((viewportWidth.value - mapWidth.value) / 2);
}

/**
 * 场景背景图加载失败处理
 * 带重试机制：最多重试 3 次，避免后端短暂抖动导致背景空白
 */
let sceneBgErrorCount = 0;
const MAX_SCENE_BG_ERROR_RETRIES = 3;
function onSceneBgError() {
  console.error('[PetScene] 背景图加载失败:', currentBgImage.value);
  if (sceneBgErrorCount < MAX_SCENE_BG_ERROR_RETRIES) {
    sceneBgErrorCount++;
    setTimeout(() => {
      // 通过切换 key 强制 image 组件重新加载
      const originalKey = currentSceneKey.value;
      currentSceneKey.value = `${originalKey}_retry_${sceneBgErrorCount}`;
      nextTick(() => {
        currentSceneKey.value = originalKey;
      });
    }, 500);
  }
}

const mapStyle = computed(() => ({
  width: mapWidth.value + 'rpx',
  height: '100%',
  transform: `translateX(${translateX.value}rpx)`
}));

// 屏幕可见宽度（rpx）
const viewportWidth = computed(() => 750);
const minTranslateX = computed(() => Math.min(0, viewportWidth.value - mapWidth.value));

// 窗口尺寸变化（H5 调整窗口、App 横竖屏切换）：重新测量舞台并修正地图位置
function onWindowResize() {
  measureStage();
  if (hasDragged.value) {
    translateX.value = clampTranslateX(translateX.value);
  } else {
    centerMap();
  }
}

// ==================== 时段背景（白天/傍晚/夜晚） ====================
// day: 6:01-19:00  evening: 19:01-22:00  night: 22:01-次日6:00
function getTimePeriod() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 22 * 60 + 1 || minutes <= 6 * 60) return 'night';
  if (minutes >= 19 * 60 + 1) return 'evening';
  return 'day';
}
const timePeriod = ref(getTimePeriod());
const isNight = computed(() => timePeriod.value === 'night');
let periodTimer = null;

// 当前场景背景按时段切换，缺傍晚/夜晚图时回退白天图
const currentBgImage = computed(() => {
  const s = currentScene.value || {};
  let url = '';
  if (timePeriod.value === 'night') url = s.bg_night || s.bg_day || '';
  else if (timePeriod.value === 'evening') url = s.bg_evening || s.bg_day || '';
  else url = s.bg_day || '';
  // 统一解析为完整 URL，避免微信小程序相对路径请求异常
  return resolveStaticUrl(url);
});

function showNightToast() {
  uni.showToast({ title: '搭搭已经休息了', icon: 'none' });
}

// 背景图切换（时段/场景变化）时重新测量真实宽高比，并在未拖动时保持居中
watch(currentBgImage, (url) => {
  bgAspect.value = 0;
  measureBgAspect(url);
});

// 宽高比测量完成后，地图宽度变化，未拖动时重新居中
watch(bgAspect, () => {
  if (!hasDragged.value) centerMap();
  else translateX.value = clampTranslateX(translateX.value);
});

// ==================== 宠物形象配置（后台 pet_sprite） ====================
// CMS 可配置坐标/尺寸/序列帧/播放速率；不再使用前端兜底图片，
// 若后台未配置形象，则宠物不显示，避免展示错误的默认剪影。

/**
 * 规范化帧数组：支持多种格式
 * - 字符串数组: ['url1', 'url2']
 * - 对象数组: [{ url: 'url1' }, { url: 'url2' }]
 * - 混合格式
 * 同时将相对路径解析为完整 URL，确保小程序可访问
 * @param {Array} raw - 原始帧数据
 * @returns {string[]} 规范化后的完整 URL 字符串数组
 */
function normalizeFrames(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      let url = '';
      if (typeof item === 'string') url = item.trim();
      else if (item && typeof item === 'object') url = (item.url || item.src || '').trim();
      // 解析相对路径为完整 URL
      url = resolveStaticUrl(url);
      return url;
    })
    .filter(url => url.length > 0);
}

const spriteConfig = computed(() => {
  const s = pet.value.sprite || {};
  const activity = pet.value.home_activity || {};
  const skin = pet.value.skin || {};

  // 空配置兜底（坐标/尺寸默认值，frames 由最后一层兜底填充）
  const EMPTY_CONFIG = { x: 375, y: 500, width: 380, height: 380, fps: 2, frames: [] };

  /**
   * 按当前选中的形象来源构建最终配置
   * @param {object} source - 原始配置对象
   * @param {string[]} frames - 已规范化的帧 URL 数组
   * @param {string} label - 日志标识
   * @returns {object} 宠物形象配置
   */
  function buildFrom(source, frames, label) {
    const x = typeof source.x === 'number' ? source.x : EMPTY_CONFIG.x;
    const y = typeof source.y === 'number' ? source.y : EMPTY_CONFIG.y;
    const width = typeof source.width === 'number' ? source.width : EMPTY_CONFIG.width;
    const height = typeof source.height === 'number' ? source.height : EMPTY_CONFIG.height;
    const fps = typeof source.fps === 'number' && source.fps > 0 ? source.fps : EMPTY_CONFIG.fps;
    console.log(`[PetSprite] source=${label}, frames=${frames.length}, first=${frames[0] || 'empty'}`);
    return { x, y, width, height, fps, frames };
  }

  // 吃饭/运动时段：始终使用 CMS pet_sprite 主形象并顶气泡
  if (showHint.value) {
    const frames = normalizeFrames(s.frames);
    if (frames.length === 0) {
      console.warn('[PetSprite] 提示时段但 pet_sprite.frames 为空，使用兜底形象');
      return buildFallbackConfig();
    }
    return buildFrom(s, frames, 'pet_sprite(hint)');
  }

  // 非吃饭/运动时段：按优先级选择形象来源
  // 1. CMS 形象配置（pet_sprite）：用户主动上传的默认形象，优先级最高
  const spriteFrames = normalizeFrames(s.frames);
  if (spriteFrames.length > 0) {
    return buildFrom(s, spriteFrames, 'pet_sprite');
  }

  // 2. 当前穿戴皮肤（pet_skins 表）：当 pet_sprite 未配置时的兜底
  const skinFrames = normalizeFrames(skin.frames || (skin.static_url ? [skin.static_url] : []));
  if (skinFrames.length > 0) {
    return buildFrom({ ...EMPTY_CONFIG, ...skin }, skinFrames, 'pet_skin');
  }

  // 3. 状态库活动形象（home_activity）：按时段/概率随机触发的特殊状态
  // 注意：状态库使用 frame_rate 字段表示播放速率，需要映射为 fps
  const activityFrames = normalizeFrames(activity.frames);
  if (activityFrames.length > 0) {
    return buildFrom(
      { ...activity, fps: activity.frame_rate },
      activityFrames,
      'home_activity'
    );
  }

  // 4. 最终兜底：使用内置默认宠物图，保证宠物永远可见（避免完全空白）
  console.warn('[PetSprite] 所有形象来源均为空（pet_sprite/skin/home_activity），使用内置兜底形象');
  return buildFallbackConfig();

  /**
   * 构建兜底配置：使用 pet_moren.png 作为最后一道防线
   * @returns {object} 宠物形象配置
   */
  function buildFallbackConfig() {
    // 注意：文件实际在后端 public/uploads/ 目录，通过 /static/uploads/ 对外暴露
    const fallbackUrl = resolveStaticUrl('/static/uploads/pet_moren.png');
    return {
      x: EMPTY_CONFIG.x,
      y: EMPTY_CONFIG.y,
      width: EMPTY_CONFIG.width,
      height: EMPTY_CONFIG.height,
      fps: 1,
      frames: [fallbackUrl]
    };
  }
});
// 后台只配置主形象序列帧（1 张即静态）；其他动作名由 PetSprite 回退到 idle
const spriteAnimations = computed(() => ({
  idle: { frames: spriteConfig.value.frames, fps: spriteConfig.value.fps, loop: true }
}));

// 宠物状态
const timeState = computed(() => pet.value.time_state || 'home');
const isAway = computed(() => timeState.value === 'away' || state.value.location === 'away');
const hints = computed(() => pet.value.hints || {});
const showHint = computed(() => {
  if (isAway.value) return false;
  if (timeState.value === 'meal_time') return !!hints.value.feed;
  if (timeState.value === 'exercise_time') return !!hints.value.exercise;
  return false;
});
const hintType = computed(() => (timeState.value === 'exercise_time' ? 'exercise' : 'meal'));
const exerciseOptions = computed(() => pet.value.exercise_options || []);

// 点击宠物随机对话
const petDialogueVisible = ref(false);
const currentPetDialogue = ref('');
const petDialogues = ref([]);

// 宠物动画（居家主形象动画由后台 pet_global.anim 配置，默认 idle 发呆）
const petAnim = ref('idle');
// 运动动画展示（运动配置的运动动画，点击运动后全屏展示 3 秒）
const exerciseAnimVisible = ref(false);
const exerciseAnimUrl = ref('');
const defaultAnim = computed(() => pet.value.anim || 'idle');
watch(timeState, (val) => {
  if (val === 'away') petAnim.value = 'sleep';
  else petAnim.value = defaultAnim.value;
});

// 宠物任务气泡（吃饭/运动/任务）
const showPetBubble = computed(() => showHint.value || (pet.value.tasks || []).length > 0);

// 任务气泡弹窗
const taskPopupVisible = ref(false);
const taskPopup = ref({ type: 'gif', url: '', description: '' });

// 场景物品气泡（模拟接口字段）
const sceneFlags = computed(() => pet.value.scene_flags || {});

function itemBubbleVisible(item) {
  if (!item.clickable) return false;
  const bubble = (currentScene.value.bubbles || {})[item.bubbleKey];
  if (!bubble) return false;
  return !!sceneFlags.value[bubble.showKey];
}

function bubbleIcon(bubbleKey) {
  return (currentScene.value.bubbles || {})[bubbleKey]?.icon || '/static/image/icon/tanhao@3x.png';
}

function onItemBubbleClick(item) {
  // 模拟从接口获取弹窗内容
  taskPopup.value = {
    type: 'gif',
    url: '/static/image/icon/dada@3x.png',
    description: `点击了【${item.name}】的任务气泡，这里应展示后台配置的 GIF/视频。`
  };
  taskPopupVisible.value = true;
}

function onPetBubbleClick() {
  if (!userStore.requireAuth()) return;
  if (isNight.value) {
    showNightToast();
    return;
  }
  hintBubbleVisible.value = true;
}

function closeTaskPopup() {
  taskPopupVisible.value = false;
}

function onTaskPopupConfirm() {
  closeTaskPopup();
  uni.showToast({ title: '任务已标记，待接口接入', icon: 'none' });
}

function onItemClick(item) {
  if (!item.clickable) return;
  uni.showToast({ title: `点击了${item.name}`, icon: 'none' });
}

// ==================== 拖拽滑动 ====================
let lastDragUpdate = 0;
function onTouchStart(e) {
  isDragging.value = true;
  dragStartX = e.touches[0].clientX;
  dragStartTranslateX = translateX.value;
}

function applyDrag(clientX) {
  // clientX 单位是 px，需要按 rpx 换算：1px = 750 / 屏幕宽度 px rpx
  const screenWidthPx = getSystemInfoSafe().windowWidth;
  const deltaPx = clientX - dragStartX;
  const deltaRpx = (deltaPx / screenWidthPx) * 750;
  if (Math.abs(deltaRpx) > 4) hasDragged.value = true;
  translateX.value = clampTranslateX(dragStartTranslateX + deltaRpx);
}

function onTouchMove(e) {
  if (!isDragging.value) return;
  // ~30fps 节流：小程序每次数据更新都要过 JS↔Native 桥，全帧更新会掉帧
  const now = Date.now();
  if (now - lastDragUpdate < 32) return;
  lastDragUpdate = now;
  applyDrag(e.touches[0].clientX);
}

function onTouchEnd(e) {
  // 收尾时按最终触点补一次定位，避免节流残留偏差
  const t = e && e.changedTouches && e.changedTouches[0];
  if (isDragging.value && t) applyDrag(t.clientX);
  isDragging.value = false;
}

// H5 鼠标拖拽（桌面浏览器预览时验证左右滑动）
function onMouseDown(e) {
  isDragging.value = true;
  dragStartX = e.clientX;
  dragStartTranslateX = translateX.value;
}

function onMouseMove(e) {
  if (!isDragging.value) return;
  const screenWidthPx = getSystemInfoSafe().windowWidth;
  const deltaRpx = ((e.clientX - dragStartX) / screenWidthPx) * 750;
  if (Math.abs(deltaRpx) > 4) hasDragged.value = true;
  translateX.value = clampTranslateX(dragStartTranslateX + deltaRpx);
}

function onMouseUp() {
  isDragging.value = false;
}

function clampTranslateX(val) {
  // 地图比屏幕窄时（宽扁窗口）无法滑动，固定在屏幕水平居中
  if (mapWidth.value <= viewportWidth.value) {
    return (viewportWidth.value - mapWidth.value) / 2;
  }
  return Math.max(minTranslateX.value, Math.min(0, val));
}

// ==================== 场景切换 ====================
function switchScene(key) {
  if (currentSceneKey.value === key) return;
  currentSceneKey.value = key;
  // 预加载当前时段的背景图
  if (currentBgImage.value) {
    const img = new Image();
    img.src = currentBgImage.value;
  }
  centerMap();
  // 切换场景后重新拉取宠物状态，以获取该场景对应的状态配置
  loadPet();
}

// ==================== 数据加载 ====================
/**
 * 加载宠物公共展示配置（无需登录）
 * 填充 pet.value.sprite / pet.value.scenes / pet.value.anim，
 * 让未登录游客也能看到搭搭形象和场景背景
 * 使用 Object.assign 合并赋值，确保触发 Vue 响应式更新
 */
async function loadPetConfig() {
  try {
    const res = await petApi.getPetConfig();
    const cfg = res.data || {};
    // 用 Object.assign 合并赋值，确保触发 Vue 响应式更新
    pet.value = Object.assign({}, pet.value, {
      sprite: cfg.sprite || pet.value.sprite || {},
      scenes: cfg.scenes || pet.value.scenes || {},
      anim: cfg.anim || pet.value.anim || 'idle'
    });
    console.log('[PetConfig] 公共配置加载成功, sprite.frames:', cfg.sprite?.frames?.length || 0);
  } catch (e) {
    console.warn('[PetConfig] 公共配置加载失败（不影响主流程）:', e.message);
  }
}

/**
 * 加载宠物完整数据（需登录）
 * 包含状态、互动、事件等用户专属数据
 */
async function loadPet() {
  try {
    const res = await petApi.getPet({ scene: currentSceneKey.value });
    pet.value = res.data || {};
    state.value = pet.value.state || {};
    // 调试日志：查看 API 返回的形象来源数据
    const spriteData = pet.value.sprite || {};
    const homeActivityData = pet.value.home_activity || {};
    const skinData = pet.value.skin || {};
    const spriteFrames = Array.isArray(spriteData.frames) ? spriteData.frames : [];
    const skinFrames = Array.isArray(skinData.frames) ? skinData.frames : (skinData.static_url ? [skinData.static_url] : []);
    const activityFrames = Array.isArray(homeActivityData.frames) ? homeActivityData.frames : [];

    console.log('[Pet] API response - sprite:', JSON.stringify({
      x: spriteData.x, y: spriteData.y, width: spriteData.width, height: spriteData.height,
      fps: spriteData.fps,
      framesCount: spriteFrames.length,
      firstFrame: spriteFrames[0] || 'N/A'
    }));
    console.log('[Pet] API response - skin:', JSON.stringify({
      skin_id: skinData.skin_id,
      name: skinData.name,
      static_url: skinData.static_url,
      framesCount: skinFrames.length,
      firstFrame: skinFrames[0] || 'N/A'
    }));
    console.log('[Pet] API response - home_activity:', JSON.stringify({
      state_key: homeActivityData.state_key,
      framesCount: activityFrames.length,
      firstFrame: activityFrames[0] || 'N/A'
    }));

    if (spriteFrames.length === 0) {
      console.warn('[Pet] ⚠️ API 返回的 pet_sprite.frames 为空，将尝试使用 pet_skin / home_activity / 前端兜底');
    }
    // 更新缓存
    pageCache.setCache(CACHE_KEYS.PET_INFO, {
      pet: pet.value,
      state: state.value,
      sceneKey: currentSceneKey.value
    });

    // 同步后台配置的默认场景；当前场景不在配置列表时回退到第一个场景
    const cfgDefault = pet.value.scenes && pet.value.scenes.default;
    if (cfgDefault && sceneList.value.some(s => s.key === cfgDefault)) {
      currentSceneKey.value = cfgDefault;
    } else if (!sceneList.value.some(s => s.key === currentSceneKey.value)) {
      currentSceneKey.value = sceneList.value[0].key;
    }

    if (pet.value.pending_event) {
      // 从其他页面引导来买东西（如未解锁课程跳商店）时，新事件弹窗会让路，不遮挡商店弹层
      if (!shopPanelVisible.value) {
        newEvent.value = pet.value.pending_event;
        newEventReward.value = pet.value.pending_reward || null;
        loadCurrency();
        const reward = rewardText(newEventReward.value);
        if (reward) {
          setTimeout(() => uni.showToast({ title: `搭搭带回了 ${reward}`, icon: 'none' }), 400);
        }
      }
    } else if (pet.value.home_event && !shopPanelVisible.value) {
      // 居家事件状态掉落的居家事件，同样弹新事件弹窗（商店引导场景让路）
      newEvent.value = {
        title: pet.value.home_event.title,
        content: pet.value.home_event.content,
        collection_name: pet.value.home_event.collection_name || '',
        photo_url: pet.value.home_event.image_url,
        image_url: pet.value.home_event.image_url
      };
      newEventReward.value = pet.value.home_event.reward || null;
      loadCurrency();
      const reward = rewardText(newEventReward.value);
      if (reward) {
        setTimeout(() => uni.showToast({ title: `遇到小美好，获得 ${reward}`, icon: 'none' }), 400);
      }
    }

    if (pet.value.ongoing_explore) {
      startExploreTimer(pet.value.ongoing_explore.end_at);
    } else {
      stopExploreTimer();
      remainingTime.value = '';
    }
  } catch (e) {
    console.error('[Pet] loadPet FAILED:', e.message, '请检查：①后端是否启动 ②开发者工具是否勾选"不校验合法域名"');
    // 加载失败时保留已有的缓存数据，不强制清空
  }
}

/**
 * 从缓存恢复数据
 * @returns {boolean} 是否有缓存数据
 */
function initFromCache() {
  const cached = pageCache.getCache(CACHE_KEYS.PET_INFO);
  if (cached) {
    pet.value = cached.pet || {};
    state.value = cached.state || {};
    if (cached.sceneKey && sceneList.value.some(s => s.key === cached.sceneKey)) {
      currentSceneKey.value = cached.sceneKey;
    }
    hasCachedData.value = true;
  }
  const cachedCurrency = pageCache.getCache(CACHE_KEYS.PET_CURRENCY);
  if (cachedCurrency) {
    currency.value = cachedCurrency;
    hasCachedData.value = true;
  }
  return hasCachedData.value;
}

/**
 * 检查是否需要刷新缓存
 */
function needRefresh() {
  if (pageCache.consumeForceRefresh(CACHE_KEYS.PET_INFO)) {
    return true;
  }
  if (!hasCachedData.value) {
    return true;
  }
  if (pageCache.isExpired(CACHE_KEYS.PET_INFO)) {
    return true;
  }
  return false;
}

async function loadCurrency() {
  try {
    const res = await petApi.getCurrency();
    currency.value = res.data || {};
    // 更新缓存
    pageCache.setCache(CACHE_KEYS.PET_CURRENCY, currency.value);
  } catch (e) {}
}

const checkin = ref({ today_checkin: false, continuous_days: 0 });
async function loadCheckin() {
  try {
    const res = await petApi.getCheckinStatus();
    checkin.value = res.data || { today_checkin: false, continuous_days: 0 };
  } catch (e) {}
}

// ==================== 气泡交互 ====================
function closeHintBubble() {
  hintBubbleVisible.value = false;
}

function closePetDialogue() {
  petDialogueVisible.value = false;
}

async function loadPetDialogues() {
  if (petDialogues.value.length > 0) return;
  try {
    const res = await petApi.getDialogues('pet_tap');
    petDialogues.value = (res.data?.list || []).filter(d => d && d.text);
  } catch (e) {}
}

function pickRandomDialogue() {
  const list = petDialogues.value;
  if (list.length === 0) return '';
  const enabled = list.filter(d => Math.random() <= (d.probability || 1));
  const pool = enabled.length > 0 ? enabled : list;
  const totalWeight = pool.reduce((sum, d) => sum + (d.weight || 1), 0);
  let rand = Math.random() * totalWeight;
  for (const d of pool) {
    rand -= (d.weight || 1);
    if (rand <= 0) return d.text;
  }
  return pool[0].text;
}

async function onPetSpriteClick() {
  // 喂食/运动提示优先，不弹对话
  if (!userStore.requireAuth()) return;
  if (showHint.value) return;
  await loadPetDialogues();
  const text = pickRandomDialogue();
  if (!text) return;
  currentPetDialogue.value = text;
  petDialogueVisible.value = true;
}

function onFindFood() {
  if (!userStore.requireAuth()) return;
  closeHintBubble();
  goInventory();
}

async function onExercise(option) {
  if (!userStore.requireAuth()) return;
  if (isNight.value) {
    showNightToast();
    closeHintBubble();
    return;
  }
  // 器械运动：未持有对应器材时引导去商城购买
  if (option.locked) {
    closeHintBubble();
    needEquipmentText.value = `「${option.name}」需要${option.equipment_name || '对应器材'}，请先到商城购买`;
    needEquipmentOpenShop = true;
    showNeedEquipmentModal.value = true;
    return;
  }
  try {
    const res = await petApi.exercise(option.key);
    const done = res.data?.option || {};
    pet.value.daily_exercise_count = res.data.daily_exercise_count;
    closeHintBubble();
    // 配置了运动动画则全屏展示 3 秒，否则用默认开心动画
    if (done.anim_url) {
      exerciseAnimUrl.value = done.anim_url;
      exerciseAnimVisible.value = true;
      setTimeout(() => { exerciseAnimVisible.value = false; }, 3000);
    } else {
      petAnim.value = 'happy';
    }
    uni.showToast({ title: `搭搭完成了${option.name}，真棒！`, icon: 'none' });
    loadPet();
    // 关联了跟练课程：引导进入跟练
    if (done.has_workout && done.workout_key) {
      setTimeout(() => {
        workoutGuideText.value = `要跟着「${done.workout_name || '课程'}」一起练吗？`;
        pendingWorkoutKey = done.workout_key;
        showWorkoutGuideModal.value = true;
      }, 800);
    }
  } catch (e) {}
}

function onPetAnimationEnd(anim) {
  if (anim !== defaultAnim.value) {
    petAnim.value = defaultAnim.value;
  }
}

function rewardText(reward) {
  if (!reward) return '';
  const parts = [];
  if (reward.berries) parts.push(`${reward.berries} 浆果`);
  if (reward.flowers) parts.push(`${reward.flowers} 鲜花`);
  return parts.join('、');
}

// ==================== 事件 ====================
function openEventsPanel() {
  if (!userStore.requireAuth()) return;
  eventPanelVisible.value = true;
}

// 相册中点击已解锁事件：复用事件详情卡片展示（回顾场景，外框用"事件回顾"）
function onViewEvent(slot) {
  newEvent.value = {
    title: slot.title,
    content: slot.content,
    collection_name: slot.collection_name || '',
    photo_url: slot.image_url,
    image_url: slot.image_url,
    review: true
  };
}

function closeNewEvent() {
  newEvent.value = null;
  newEventReward.value = null;
}

const newEventPhoto = computed(() => {
  if (!newEvent.value) return '';
  return resolveStaticUrl(newEvent.value.photo_url || newEvent.value.image_url) || '/static/image/icon/event_default.jpg';
});

// ===== 事件分享图（拼接：事件图 + 事件集 + 标题 + 说明 + 二维码 + 应用信息） =====
const SHARE_APP_NAME = '掉秤搭搭';
const SHARE_APP_SLOGAN = '你的AI掉秤搭子，陪你一起健康瘦下去～';
const SHARE_CANVAS_W = 1080;
const SHARE_CANVAS_H = 1920;
const SHARE_QR_PLACEHOLDER = '/static/image/icon/qr_placeholder.png'; // 占位二维码，后续替换为正式 App 二维码

// 加载图片为 canvas 可绘制的路径；H5 先 fetch 成 blob，避免跨域污染画布导致无法导出
function loadDrawableImage(src) {
  return new Promise((resolve, reject) => {
    const getInfo = (s) => uni.getImageInfo({
      src: s,
      success: (info) => resolve(info),
      fail: reject
    });
    // #ifdef H5
    if (/^https?:\/\//.test(src)) {
      fetch(src)
        .then(r => {
          if (!r.ok) throw new Error('image fetch failed');
          return r.blob();
        })
        .then(blob => getInfo(URL.createObjectURL(blob)))
        .catch(reject);
      return;
    }
    // #endif
    getInfo(src);
  });
}

// 圆角矩形路径
function traceRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// aspectFill 裁剪绘制
function drawImageCover(ctx, info, x, y, w, h) {
  const scale = Math.max(w / info.width, h / info.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(info.path, (info.width - sw) / 2, (info.height - sh) / 2, sw, sh, x, y, w, h);
}

// 按宽度换行（逐字测量，兼容中英文），超出 maxLines 截断补省略号
function wrapShareText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  const chars = String(text);
  let i = 0;
  for (; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\n') {
      lines.push(line);
      line = '';
      if (lines.length === maxLines) break;
      continue;
    }
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    } else {
      line += ch;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (i < chars.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = last + '…';
  }
  return lines;
}

// 生成事件分享图，返回临时文件路径（H5 为 dataURL）
async function buildEventShareImage(ev, photoUrl) {
  const [photo, qr] = await Promise.all([
    loadDrawableImage(photoUrl),
    loadDrawableImage(SHARE_QR_PLACEHOLDER)
  ]);
  const ctx = uni.createCanvasContext('eventShareCanvas');
  const W = SHARE_CANVAS_W;
  const H = SHARE_CANVAS_H;

  // 背景
  ctx.setFillStyle('#F6F3EA');
  ctx.fillRect(0, 0, W, H);

  // 事件图（圆角裁切）
  const imgX = 64, imgY = 64, imgW = W - 128, imgH = 952;
  ctx.save();
  traceRoundRect(ctx, imgX, imgY, imgW, imgH, 36);
  ctx.clip();
  drawImageCover(ctx, photo, imgX, imgY, imgW, imgH);
  ctx.restore();
  let y = imgY + imgH;

  // 所属事件集胶囊
  ctx.setTextAlign('center');
  ctx.setTextBaseline('middle');
  if (ev.collection_name) {
    ctx.setFontSize(30);
    const pw = ctx.measureText(ev.collection_name).width + 72;
    const ph = 64;
    const py = y + 56;
    ctx.setFillStyle('#E6F0DA');
    traceRoundRect(ctx, (W - pw) / 2, py, pw, ph, ph / 2);
    ctx.fill();
    ctx.setFillStyle('#5E8B4E');
    ctx.fillText(ev.collection_name, W / 2, py + ph / 2);
    y = py + ph;
  }

  // 事件名（二次绘制微偏移模拟加粗）
  y += 64;
  ctx.setFillStyle('#2E3B28');
  ctx.setFontSize(56);
  ctx.fillText(ev.title || '', W / 2, y + 28);
  ctx.fillText(ev.title || '', W / 2 + 1, y + 28);
  y += 84;

  // 事件说明
  ctx.setFillStyle('#6B7264');
  ctx.setFontSize(34);
  const lines = wrapShareText(ctx, ev.content || '暂无详细内容', 880, 4);
  lines.forEach((line, i) => ctx.fillText(line, W / 2, y + 27 + i * 54));
  y += lines.length * 54;

  // 分隔线（与底部二维码模块保持间距）
  const qrSize = 200;
  const qrPad = 18;
  const qrCardW = qrSize + qrPad * 2;
  const qrX = 96;
  const qrY = H - 96 - qrCardW;
  const divY = Math.max(y + 56, qrY - 72);
  ctx.setStrokeStyle('#E0DACA');
  ctx.setLineWidth(2);
  ctx.beginPath();
  ctx.moveTo(96, divY);
  ctx.lineTo(W - 96, divY);
  ctx.stroke();

  // 二维码白卡
  ctx.setFillStyle('#FFFFFF');
  traceRoundRect(ctx, qrX, qrY, qrCardW, qrCardW, 20);
  ctx.fill();
  ctx.drawImage(qr.path, qrX + qrPad, qrY + qrPad, qrSize, qrSize);

  // 应用名 + 一句话介绍
  const textX = qrX + qrCardW + 40;
  const midY = qrY + qrCardW / 2;
  ctx.setTextAlign('left');
  ctx.setFillStyle('#2E3B28');
  ctx.setFontSize(48);
  ctx.fillText(SHARE_APP_NAME, textX, midY - 34);
  ctx.fillText(SHARE_APP_NAME, textX + 1, midY - 34);
  ctx.setFillStyle('#8A8F80');
  ctx.setFontSize(30);
  ctx.fillText(SHARE_APP_SLOGAN, textX, midY + 30);

  return new Promise((resolve, reject) => {
    ctx.draw(false, () => {
      // 等一帧再导出，避免 App 端绘制未提交
      setTimeout(() => {
        uni.canvasToTempFilePath({
          canvasId: 'eventShareCanvas',
          width: W,
          height: H,
          destWidth: W,
          destHeight: H,
          success: (res) => resolve(res.tempFilePath),
          fail: reject
        });
      }, 80);
    });
  });
}

/**
 * 保存分享图到相册：合成事件海报（事件图 + 事件集合名 + 标题 + 说明 + 二维码 + 小程序名和副标题）
 */
function saveShareImage(filePath) {
  uni.saveImageToPhotosAlbum({
    filePath,
    success: () => {
      uni.hideLoading();
      uni.showToast({ title: '已保存到相册', icon: 'success' });
    },
    fail: (err) => {
      uni.hideLoading();
      onAlbumSaveFail(err);
    }
  });
}

/**
 * 保存到相册失败兜底：用户拒绝授权时弹确认引导去系统设置页开启相册权限
 */
function onAlbumSaveFail(err) {
  const errMsg = (err && err.errMsg) ? String(err.errMsg) : '';
  // 拒绝授权 / 未授权场景
  if (errMsg.includes('auth deny') || errMsg.includes('authorize') || errMsg.includes('cancel')) {
    uni.showModal({
      title: '需要相册权限',
      content: '为了把这张美好瞬间保存到相册，请在设置中开启「保存到相册」权限',
      confirmText: '去设置',
      confirmColor: '#8EBB77',
      cancelText: '取消',
      success: (r) => {
        if (r.confirm) {
          try { uni.openSetting(); } catch (_) {
            uni.showToast({ title: '请在设置里手动开启相册权限', icon: 'none' });
          }
        }
      }
    });
    return;
  }
  uni.showToast({ title: '保存失败，请稍后再试', icon: 'none' });
}

function downloadEventPhoto() {
  if (!newEvent.value) return;
  const url = resolveStaticUrl(newEvent.value.photo_url || newEvent.value.image_url) || '/static/image/icon/event_default.jpg';
  uni.showLoading({ title: '生成分享图...' });
  buildEventShareImage(newEvent.value, url)
    .then(saveShareImage)
    .catch(() => {
      uni.hideLoading();
      uni.showToast({ title: '分享图生成失败，请重试', icon: 'none' });
    });
}

/**
 * 运动需要器材：确认后进入商城
 */
function confirmGoShop() {
  showNeedEquipmentModal.value = false;
  if (needEquipmentOpenShop) shopPanelVisible.value = true;
  needEquipmentOpenShop = false;
}

/**
 * 运动完成：确认后跳转跟练
 */
function confirmGoWorkout() {
  showWorkoutGuideModal.value = false;
  if (pendingWorkoutKey) uni.navigateTo({ url: `/pages/workout/session?key=${pendingWorkoutKey}` });
  pendingWorkoutKey = '';
}

// ==================== 互动 / 跳转 ====================
// 任务/背包/商店弹层（页面内弹层，不跳转）
const taskPanelVisible = ref(false);
const bagPanelVisible = ref(false);
const shopPanelVisible = ref(false);
// 商店弹层打开时定位的分类 tab（如从跟练列表引导购买器材时传 equipment）
const shopInitialCategory = ref('');

function goTasks() {
  if (!userStore.requireAuth()) return;
  taskPanelVisible.value = true;
}

function goInventory() {
  if (!userStore.requireAuth()) return;
  bagPanelVisible.value = true;
}

function goShop() {
  if (!userStore.requireAuth()) return;
  shopPanelVisible.value = true;
}

function onTaskOpenShop() {
  taskPanelVisible.value = false;
  shopPanelVisible.value = true;
}

function onBagGoShop() {
  bagPanelVisible.value = false;
  shopPanelVisible.value = true;
}

function onBagFed() {
  loadPet();
  loadCurrency();
}

function onShopClose() {
  shopPanelVisible.value = false;
}
function goMood() {
  uni.navigateTo({ url: '/pages/record/mood' });
}

// ==================== 外出倒计时 ====================
function startExploreTimer(endAt) {
  stopExploreTimer();
  updateRemaining(endAt);
  timer = setInterval(() => {
    const done = updateRemaining(endAt);
    if (done) {
      stopExploreTimer();
      loadPet();
    }
  }, 1000);
}

function stopExploreTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function updateRemaining(endAt) {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) {
    remainingTime.value = '00:00';
    return true;
  }
  const m = Math.floor(diff / 60000).toString().padStart(2, '0');
  const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
  remainingTime.value = `${m}:${s}`;
  return false;
}

// ==================== 生命周期 ====================
onShow(() => {
  timePeriod.value = getTimePeriod();
  
  // 先从缓存恢复数据（避免白屏）
  if (!hasCachedData.value) {
    initFromCache();
  }
  
  // 无论登录与否，都加载公共展示配置（让未登录游客也能看到搭搭形象）
  loadPetConfig();
  
  // 已登录用户额外加载完整数据（状态/互动/事件等）
  if (userStore.isLoggedIn && needRefresh()) {
    if (!hasCachedData.value) {
      loading.value = true;
    }
    nextTick(() => {
      loadPet();
      loadCurrency();
      loading.value = false;
      hasCachedData.value = true;
    });
  }
  
  measureStage();
  centerMap();
  // 其他页面引导打开商店并定位分类（如跟练课程未解锁 → 运动器材 tab）
  const pendingShopCat = uni.getStorageSync('pending_shop_category');
  if (pendingShopCat) {
    uni.removeStorageSync('pending_shop_category');
    shopInitialCategory.value = pendingShopCat;
    shopPanelVisible.value = true;
  }
  // 每次进入页面刷新点击对话缓存，确保 CMS 配置变更生效
  petDialogues.value = [];
  petDialogueVisible.value = false;
});

onMounted(() => {
  // 1. 先从缓存恢复数据（避免白屏）
  const hasCache = initFromCache();
  
  // 2. 无论登录与否，都加载公共展示配置（让未登录游客也能看到搭搭形象）
  loadPetConfig();
  
  // 3. 已登录用户额外加载完整数据
  if (userStore.isLoggedIn) {
    if (!hasCache) {
      loading.value = true;
    }
    nextTick(() => {
      loadPet();
      loadCurrency();
      loadCheckin();
      loading.value = false;
      hasCachedData.value = true;
    });
  }
  
  measureStage();
  centerMap();
  measureBgAspect(currentBgImage.value);
  // 窗口尺寸变化时重新测量舞台，保证背景不拉伸、坐标不漂移
  if (typeof uni.onWindowResize === 'function') {
    uni.onWindowResize(onWindowResize);
  }
  // #ifdef H5
  // H5 桌面预览：鼠标拖拽查看地图（仅 H5 端生效，小程序端用 touch 事件处理，避免 addListener of undefined 空指针）
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
  // #endif
  // 每分钟刷新时段，跨 19:00 / 22:00 / 6:00 边界自动切换背景与互动限制
  periodTimer = setInterval(() => {
    timePeriod.value = getTimePeriod();
  }, 60000);
});

onUnmounted(() => {
  stopExploreTimer();
  if (typeof uni.offWindowResize === 'function') {
    uni.offWindowResize(onWindowResize);
  }
  // #ifdef H5
  // H5 桌面端：移除 mouse 事件监听（小程序端不执行，避免 removeListener 调用到 undefined 对象）
  if (typeof window !== 'undefined' && window.removeEventListener) {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }
  // #endif
  if (periodTimer) {
    clearInterval(periodTimer);
    periodTimer = null;
  }
});
</script>

<style lang="scss" scoped>
.pet-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  /* 页面背景透明，让 scene-stage 的背景图从顶部状态栏位置显示 */
  background: transparent;
}

.status-bar {
  /* 标杆第一行硬码兜底：44px + 88rpx，--status-bar-height 未注入前几帧不塌缩 */
  height: calc(44px + 88rpx);
  /* 标杆第二行：兼容非小程序端 var 注入真实高度，覆盖第一行 */
  height: calc(var(--status-bar-height, 44px) + 88rpx);
  /* 背景透明，让底层场景图从顶部通顶显示 */
  background: transparent;
  position: relative;
  z-index: 100;
  flex-shrink: 0;
}

/* 底层：场景地图 */
.scene-stage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  /*
   * 向下扩展背景图高度，减少浅绿色底色区域：
   * 背景图下沿接近功能区底部，仅保留功能区本身所需的浅绿色背景。
   * 功能区底部距 tabBar 16rpx，因此场景舞台下沿设为 16rpx。
   */
  bottom: calc(16rpx + env(safe-area-inset-bottom));
  overflow: hidden;
  touch-action: none;
  user-select: none;
  /* 兜底背景色：场景图加载失败时至少显示浅绿色，避免整页空白 */
  background: #E8F6D7;
}

.scene-map {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  will-change: transform;
}

.scene-bg {
  /* 地图容器尺寸 = 舞台高度 × 图片真实宽高比，图片铺满容器即等比缩放，不拉伸 */
  width: 100%;
  height: 100%;
  display: block;
}

.scene-fade-enter-active,
.scene-fade-leave-active {
  transition: opacity 0.4s ease;
}
.scene-fade-enter-from,
.scene-fade-leave-to {
  opacity: 0;
}

/* 场景物品 */
.scene-item {
  position: absolute;
  pointer-events: auto;
}

.scene-item-img {
  width: 100%;
  height: 100%;
}

.item-bubble {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: -50rpx;
  width: 56rpx;
  height: 56rpx;
  background: #FFFFFF;
  border: 4rpx solid #563E22;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(86, 62, 34, 0.15);
  animation: bubble-bounce 1.2s ease-in-out infinite;
  z-index: 20;
}

.item-bubble-icon {
  width: 32rpx;
  height: 32rpx;
}

/* 外出提示 */
.away-tip {
  position: absolute;
  transform: translateX(-50%);
  min-width: 400rpx;
  padding: 24rpx;
  background: #E8F6D7;
  border: 4rpx solid #563E22;
  border-radius: 24rpx;
  text-align: center;
  z-index: 30;
}

/* 屏幕居中固定位置（不随地图滑动） */
.away-tip--screen {
  position: fixed;
  left: 50%;
  top: 40%;
  transform: translate(-50%, -50%);
  z-index: 60;
}

.away-tip-text {
  display: block;
  font-size: 28rpx;
  color: #563E22;
  font-weight: 700;
  line-height: 40rpx;
}

.away-tip-time {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8DBB77;
}

/* 顶层：固定功能层 */
.fixed-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 50;
}

/* 原来的 `.fixed-layer > *` 用了通配符，小程序 WXSS 解析器会报错 error at token '*'
   改为枚举所有可交互标签（与 pet 页 fixed-layer 实际直接子元素清单匹配即可）
   效果等价：抵消 .fixed-layer 的 pointer-events:none，让它的子层能独立接收点击 */
.fixed-layer view,
.fixed-layer text,
.fixed-layer image,
.fixed-layer button,
.fixed-layer scroll-view,
.fixed-layer input,
.fixed-layer picker,
.fixed-layer swiper,
.fixed-layer label,
.fixed-layer canvas,
.fixed-layer cover-view,
.fixed-layer form {
  pointer-events: auto;
}

.currency-pill {
  position: absolute;
  width: 194rpx;
  height: 64rpx;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  padding: 0 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(86, 62, 34, 0.06);
}

.currency-icon {
  width: 52rpx;
  height: 44rpx;
}

.currency-text {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #563E22;
  font-weight: 500;
}

.currency-plus {
  width: 32rpx;
  height: 32rpx;
  line-height: 30rpx;
  text-align: center;
  border-radius: 50%;
  background: #8DBB77;
  color: #FFFFFF;
  font-size: 24rpx;
}

/* 场景切换 */
.scene-switcher {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.scene-switch-item {
  padding: 12rpx 24rpx;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 32rpx;
  font-size: 24rpx;
  color: #563E22;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(86, 62, 34, 0.06);
}

.scene-switch-item.active {
  background: #8DBB77;
  color: #FFFFFF;
}

/* 底部功能面板 */
.bottom-panel {
  position: absolute;
  left: 32rpx;
  right: 32rpx;
  /* 功能区底部与 tabBar 顶部保持 8px（16rpx）间距 */
  bottom: 16rpx;
  height: 160rpx;
  /* 功能区保持完整的浅绿色背景 */
  background: #E8F6D7;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 24rpx;
  z-index: 60;
}

.bottom-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.bottom-icon {
  width: 72rpx;
  height: 72rpx;
}

.bottom-text {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #563E22;
  font-weight: 500;
}

/* 吃饭/运动气泡 */
.hint-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 900;
}

.hint-pet {
  position: absolute;
  left: 58rpx;
  top: 620rpx;
  width: 184rpx;
  height: 268rpx;
  transform: scaleX(-1);
  z-index: 2; /* 形象压在对话框上层，不被气泡遮挡 */
}

.hint-bubble {
  position: absolute;
  left: 186rpx;
  top: 644rpx;
  width: 510rpx;
  min-height: 176rpx;
  background: #E8F6D7;
  border: 4rpx solid #563E22;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
  z-index: 1;
}

.hint-bubble-text {
  font-size: 32rpx;
  color: #563E22;
  line-height: 46rpx;
  text-align: center;
  font-weight: 700;
}

.hint-btn {
  position: absolute;
  left: 256rpx;
  width: 440rpx;
  height: 96rpx;
  background: #E8F6D7;
  border: 4rpx solid #563E22;
  border-radius: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #563E22;
  font-weight: 700;
}

.hint-btn.locked {
  opacity: 0.55;
}

/* 点击宠物随机对话 */
.dialogue-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 900;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
}

.dialogue-bubble {
  width: 100%;
  max-width: 560rpx;
  min-height: 176rpx;
  background: #E8F6D7;
  border: 4rpx solid #563E22;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
  margin-bottom: 32rpx;
}

.dialogue-bubble-text {
  font-size: 32rpx;
  color: #563E22;
  line-height: 46rpx;
  text-align: center;
  font-weight: 700;
}

.dialogue-btn {
  width: 100%;
  max-width: 440rpx;
  height: 96rpx;
  background: #E8F6D7;
  border: 4rpx solid #563E22;
  border-radius: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #563E22;
  font-weight: 700;
}

/* 运动动画展示 */
.exercise-anim-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  z-index: 1500;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
}
.exercise-anim-img {
  width: 560rpx;
  height: 560rpx;
}

/* 任务气泡弹窗 */
.popup-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-card {
  width: 600rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  position: relative;
}

.popup-close {
  position: absolute;
  right: 24rpx;
  top: 24rpx;
  width: 48rpx;
  height: 48rpx;
  background: #F3F4F6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #6B7280;
}

.popup-gif {
  width: 100%;
  border-radius: 16rpx;
}

.popup-video-wrap {
  width: 100%;
  border-radius: 16rpx;
  overflow: hidden;
}

.popup-video {
  width: 100%;
  height: 320rpx;
}

.popup-desc {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: #563E22;
  line-height: 40rpx;
  text-align: center;
}

.popup-btn {
  margin-top: 32rpx;
  height: 88rpx;
  background: #8DBB77;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #FFFFFF;
  font-weight: 500;
}

/* 新事件弹窗（设计稿 334×558px，掉落入场） */
.event-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-card {
  width: 668rpx;
  position: relative;
  animation: eventDrop 0.55s cubic-bezier(0.34, 1.4, 0.64, 1);
}

/* 掉落入场：从屏幕上方落入，带回弹 */
@keyframes eventDrop {
  0% { transform: translateY(-110%); opacity: 0; }
  70% { transform: translateY(2%); opacity: 1; }
  100% { transform: translateY(0); }
}

/* 顶部插画：307×307px，压在绿色面板上方，手绘感圆角 */
/* 事件外框：614×732 的框图 + 事件照片垫在框内窗口（窗口占框图 left10.9% top25.4% right87.8% bottom90.4%，位置偏下） */
.card-frame-wrap {
  position: relative;
  z-index: 2;
  width: 614rpx;
  aspect-ratio: 614 / 732;
  margin: 0 auto;
}

.card-frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

.card-photo {
  position: absolute;
  left: 10.9%;
  top: 25.4%;
  width: 76.9%;
  height: 65%;
  z-index: 1;
  border-radius: 32rpx;
  background: #F8FBF4;
}

/* 关闭按钮：卡片右上角白色圆圈 ✕（32×32px） */
.card-close {
  position: absolute;
  z-index: 3;
  right: 0;
  top: 0;
  width: 64rpx;
  height: 64rpx;
  background: rgba(0, 0, 0, 0.25);
  border: 3rpx solid #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #FFFFFF;
  line-height: 1;
}

/* 绿色信息面板：#E8F6D7 + #563E22 描边，被插画压住上缘 */
.card-panel {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  background: #E8F6D7;
  border: 4rpx solid #563E22;
  border-radius: 24rpx;
  padding: 120rpx 46rpx 48rpx;
}

/* 事件标题：18px 粗体居中，可换行 */
.event-coll-pill {
  display: table;
  margin: 0 auto 16rpx;
  padding: 6rpx 24rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #6B8F4E;
  background: rgba(255, 255, 255, 0.75);
  border: 2rpx solid #B5D89A;
  border-radius: 999rpx;
}

.event-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #563E22;
  text-align: center;
  line-height: 52rpx;
}

/* 事件详情：12px 居中，可换行，行距 21.6px，与标题间距拉大 */
.event-content {
  display: block;
  margin-top: 32rpx;
  font-size: 24rpx;
  color: #563E22;
  text-align: center;
  line-height: 44rpx;
}

/* 底部操作栏：左"关闭"幽灵按钮 + 右"保存到相册"主按钮 */
.card-actions {
  margin-top: 48rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}
.card-actions .btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
}
.card-actions .btn text { pointer-events: none; }
.card-actions .btn.btn-ghost {
  background: #F1F5E8;
  color: #8EBB77;
}
.card-actions .btn.btn-primary {
  background: linear-gradient(180deg, #9DCB87 0%, #8EBB77 100%);
  color: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(142, 187, 119, 0.28);
}

/* 下载按钮：148×44px #8EBB77 胶囊 */
.download-btn {
  width: 296rpx;
  height: 88rpx;
  margin: 48rpx auto 0;
  background: #8EBB77;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.download-btn-text {
  font-size: 28rpx;
  color: #FFFFFF;
  font-weight: 500;
}

/* 离屏画布：生成事件分享图用，移出视口但保持可绘制 */
.event-share-canvas {
  position: fixed;
  left: -3000px;
  top: 0;
  pointer-events: none;
}
</style>
