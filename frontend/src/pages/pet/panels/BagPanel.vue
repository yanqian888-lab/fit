<template>
  <view class="overlay-mask">
    <view class="overlay-backdrop" @click="!countdownVisible && !selectWorkoutVisible && !confirmDialogVisible && $emit('close')"></view>
    <view class="overlay-panel">
      <view class="overlay-header">
        <text class="overlay-title">背包</text>
        <view class="overlay-close" @click="!countdownVisible && !selectWorkoutVisible && !confirmDialogVisible && $emit('close')">✕</view>
      </view>

      <view class="category-tabs">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: activeTab === tab.value }"
          @click="switchTab(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <scroll-view class="overlay-scroll" scroll-y>
        <view v-if="items.length === 0" class="empty-state">
          <image class="empty-img" src="/static/image/icon/quesheng01.png" mode="aspectFit" />
          <text class="empty-text">背包里空空如也</text>
          <text class="empty-sub" @click="$emit('goShop')">去商城看看 ›</text>
        </view>
        <view v-else class="item-grid">
          <view v-for="item in items" :key="item.id" class="grid-cell">
            <view class="item-card">
              <text class="item-count">x{{ item.quantity }}</text>
              <view class="item-img-box">
                <image class="item-img" :src="resolveStaticUrl(item.icon_url) || categoryImage(item.category)" mode="aspectFit" />
              </view>
              <text class="item-name">{{ item.name }}</text>
              <text class="item-desc">{{ effectText(item.effect_json, item.category) }}</text>
            </view>
            <button
              class="use-btn"
              :class="{ disabled: !canUse(item) }"
              :disabled="!canUse(item)"
              @click="use(item)"
            >
              {{ item.category === 'food' ? '喂食' : (item.category === 'skin' ? '装备' : '使用') }}
            </button>
          </view>
        </view>
        <view class="bottom-safe"></view>
      </scroll-view>
    </view>

    <!-- 首喂食谱解锁弹窗 -->
    <RecipeUnlockPopup v-if="recipeUnlock" :recipe="recipeUnlock" @close="recipeUnlock = null" />

    <!-- 运动倒计时弹窗 -->
    <ExerciseCountdownPopup
      v-if="countdownVisible"
      :exercise-name="currentExercise?.name || '运动'"
      :anim-url="currentExercise?.anim_url || ''"
      :duration="currentExercise?.duration_seconds || 180"
      :has-workout="!!currentExercise?.has_workout"
      :workout-key="currentExercise?.workout_key || ''"
      @close="onCountdownClose"
      @go-workout="onGoWorkout"
    />

    <!-- 跟练课程/运动选项选择弹窗 -->
    <view v-if="selectWorkoutVisible" class="dialog-mask">
      <view class="dialog-card">
        <text class="dialog-title">{{ selectMode === 'workout' ? '选择跟练课程' : '选择运动' }}</text>
        <view class="workout-list">
          <view
            v-for="item in selectMode === 'workout' ? equipmentWorkouts : exerciseOptionsList"
            :key="item.id || item.key"
            class="workout-item"
            @click="selectWorkout(item)"
          >
            <text class="workout-name">{{ item.name }}</text>
            <text v-if="item.duration_seconds" class="workout-duration">{{ formatDuration(item.duration_seconds) }}</text>
          </view>
        </view>
        <view class="dialog-cancel" @click="selectWorkoutVisible = false">
          <text>取消</text>
        </view>
      </view>
    </view>

    <!-- 确认跟练对话框 -->
    <view v-if="confirmDialogVisible" class="dialog-mask">
      <view class="dialog-card">
        <text class="dialog-title">和搭搭一起跟练？</text>
        <text class="dialog-desc">「{{ pendingWorkout?.name }}」</text>
        <view class="dialog-btns">
          <view class="dialog-btn dialog-btn-cancel" @click="confirmDialogVisible = false">
            <text>否</text>
          </view>
          <view class="dialog-btn dialog-btn-confirm" @click="confirmWorkout">
            <text>是</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { petApi } from '../../../api';
import { resolveStaticUrl } from '../../../utils/environment';
import RecipeUnlockPopup from '../../../components/RecipeUnlockPopup.vue';
import ExerciseCountdownPopup from '../../../components/ExerciseCountdownPopup.vue';

const props = defineProps({
  /** 宠物数据（包含 time_state 等信息） */
  petData: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['close', 'goShop', 'fed']);

const recipeUnlock = ref(null);

// 弹窗状态
const countdownVisible = ref(false);
const selectWorkoutVisible = ref(false);
const confirmDialogVisible = ref(false);

// 当前运动信息
const currentExercise = ref(null);
const pendingWorkout = ref(null);
const currentItem = ref(null);

// 器材关联的跟练课程列表
const equipmentWorkouts = ref([]);
// 器材关联的运动选项列表
const exerciseOptionsList = ref([]);
// 选择模式：'workout' (跟练) 或 'exercise' (运动弹窗)
const selectMode = ref('workout');

const tabs = ref([
  { label: '全部', value: '' },
  { label: '食物', value: 'food' },
  { label: '运动器材', value: 'equipment' },
  { label: '道具', value: 'prop' }
]);
const activeTab = ref('');
const items = ref([]);

/**
 * 判断是否为运动时间
 */
const isExerciseTime = computed(() => {
  return props.petData?.time_state === 'exercise';
});

/**
 * 判断是否为进食时间
 */
const isFeedTime = computed(() => {
  return props.petData?.time_state === 'feed';
});

/**
 * 格式化时长
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}分钟`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hrs}小时${remainingMins}分钟` : `${hrs}小时`;
}

function switchTab(value) {
  activeTab.value = value;
  loadItems();
}

/**
 * 加载背包物品
 */
async function loadItems() {
  try {
    const res = await petApi.getInventory({});
    const all = (res.data?.list || []).filter(i => i.quantity > 0);
    if (!activeTab.value) {
      items.value = all;
    } else if (activeTab.value === 'prop') {
      items.value = all.filter(i => ['prop', 'skin'].includes(i.category));
    } else {
      items.value = all.filter(i => i.category === activeTab.value);
    }
  } catch (e) {}
}

function categoryImage(category) {
  const map = {
    food: '/static/image/icon/jiyinshi@3x.png',
    equipment: '/static/image/icon/jiyundong.png',
    prop: '/static/image/icon/gongjvxiang@3x.png',
    skin: '/static/image/icon/baobao@3x.png'
  };
  return map[category] || '/static/image/icon/quesheng01.png';
}

function effectText(effectJson, category) {
  try {
    const effect = JSON.parse(effectJson || '{}');
    const parts = [];
    if (effect.recipe) parts.push('可能掉落食谱');
    if (effect.unlock_workout) parts.push('已解锁跟练');
    if (effect.skin_id) parts.push('可装备皮肤');
    if (effect.reduce_explore_seconds) parts.push(`缩短外出 ${Math.floor(effect.reduce_explore_seconds / 60)} 分钟`);
    if (effect.increase_rare_drop) parts.push('提高稀有掉落');
    if (parts.length) return parts.join('，');
  } catch (e) {}
  return category === 'food' ? '美味食物' : category === 'prop' ? '道具效果' : category === 'skin' ? '宠物皮肤' : '永久拥有';
}

function canUse(item) {
  return ['food', 'equipment', 'prop', 'skin'].includes(item.category) && item.quantity > 0;
}

/**
 * 查询器材关联的跟练课程
 */
async function loadEquipmentWorkouts(itemId) {
  try {
    const res = await petApi.getEquipmentWorkouts(itemId);
    return res.data || { workouts: [], exercise_options: [] };
  } catch (e) {
    return { workouts: [], exercise_options: [] };
  }
}

/**
 * 使用物品（主入口）
 */
async function use(item) {
  if (!canUse(item)) return;

  // 食物使用逻辑
  if (item.category === 'food') {
    if (!isFeedTime.value) {
      uni.showToast({
        title: '搭搭还不饿哦！减肥路上一定要控制食欲！',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    await useFood(item);
    return;
  }

  // 运动器材使用逻辑
  if (item.category === 'equipment') {
    await useEquipment(item);
    return;
  }

  // 其他物品使用逻辑
  uni.showLoading({ title: '使用中', mask: true });
  try {
    const res = await petApi.useInventoryItem(item.id);
    uni.hideLoading();
    const effect = res.data?.effect || {};
    const title = res.data?.message || (effect.skinId ? '装备成功' : '使用成功');
    uni.showToast({ title, icon: 'success', duration: 2500 });
    await loadItems();
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '使用失败', icon: 'none' });
  }
}

/**
 * 使用食物
 */
async function useFood(item) {
  uni.showLoading({ title: '喂食中', mask: true });
  try {
    const res = await petApi.feed([item.id]);
    uni.hideLoading();
    const reward = res.data?.reward || {};
    const rewardParts = [];
    if (reward.berries) rewardParts.push(`+${reward.berries} 浆果`);
    if (reward.flowers) rewardParts.push(`+${reward.flowers} 鲜花`);
    uni.showToast({ title: `喂食成功${rewardParts.length ? '，' + rewardParts.join(' ') : ''}`, icon: 'none', duration: 2500 });
    const unlocked = res.data?.recipes_unlocked || [];
    if (unlocked.length > 0) {
      recipeUnlock.value = unlocked[0];
    }
    await loadItems();
    emit('fed');
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '喂食失败', icon: 'none' });
  }
}

/**
 * 使用运动器材
 */
async function useEquipment(item) {
  currentItem.value = item;

  // 查询器材关联的跟练课程和运动选项
  uni.showLoading({ title: '加载中', mask: true });
  const data = await loadEquipmentWorkouts(item.id);
  uni.hideLoading();

  equipmentWorkouts.value = data.workouts || [];
  exerciseOptionsList.value = data.exercise_options || [];

  // 检查是否有跟练课程（在 workout_lib 中）
  const hasWorkouts = equipmentWorkouts.value.length > 0;
  // 检查是否有搭搭运动选项（在 pet_exercise_lib 中）
  const hasExerciseOptions = exerciseOptionsList.value.length > 0;

  // 未到运动时间
  if (!isExerciseTime.value) {
    if (hasWorkouts) {
      // 有跟练课程，跳转到跟练页
      selectMode.value = 'workout';
      if (equipmentWorkouts.value.length === 1) {
        // 只有一个跟练课程，直接跳转
        const workoutKey = equipmentWorkouts.value[0].workout_key;
        uni.navigateTo({ url: `/pages/workout/session?key=${workoutKey}` });
        emit('close');
      } else {
        // 多个跟练课程，让用户选择
        selectWorkoutVisible.value = true;
      }
    } else {
      // 无跟练课程，提示
      uni.showToast({
        title: '还没到搭搭的运动时间哦～',
        icon: 'none',
        duration: 2000
      });
    }
    return;
  }

  // 已到运动时间
  if (hasWorkouts) {
    // 有跟练课程，询问是否跟练
    selectMode.value = 'workout';
    if (equipmentWorkouts.value.length === 1) {
      // 只有一个跟练课程，直接询问
      const w = equipmentWorkouts.value[0];
      pendingWorkout.value = {
        key: w.workout_key,
        name: w.name,
        has_workout: true,
        workout_key: w.workout_key,
        workout_name: w.name,
        duration_seconds: w.duration_seconds || 180,
        id: w.id
      };
      confirmDialogVisible.value = true;
    } else {
      // 多个跟练课程，先让用户选择
      selectWorkoutVisible.value = true;
    }
  } else if (hasExerciseOptions) {
    // 无跟练课程但有运动选项，显示运动弹窗
    selectMode.value = 'exercise';
    if (exerciseOptionsList.value.length === 1) {
      showCountdownPopup(exerciseOptionsList.value[0]);
    } else {
      // 多个运动选项，让用户选择（用于弹窗展示）
      selectWorkoutVisible.value = true;
    }
  } else {
    // 既无跟练也无运动选项，直接使用
    await useEquipmentDirect(item);
  }
}

/**
 * 选择跟练课程或运动选项
 */
function selectWorkout(workout) {
  selectWorkoutVisible.value = false;

  if (selectMode.value === 'workout') {
    // 选择的是跟练课程
    pendingWorkout.value = {
      key: workout.workout_key,
      name: workout.name,
      has_workout: true,
      workout_key: workout.workout_key,
      workout_name: workout.name,
      duration_seconds: workout.duration_seconds || 180,
      id: workout.id
    };
    // 询问用户是否跟练
    confirmDialogVisible.value = true;
  } else {
    // 选择的是运动选项，显示弹窗
    const opt = exerciseOptionsList.value.find(o => o.key === workout.key || o.key === workout.id);
    if (opt) {
      showCountdownPopup(opt);
    }
  }
}

/**
 * 确认跟练
 */
function confirmWorkout() {
  const workoutKey = pendingWorkout.value?.workout_key;
  confirmDialogVisible.value = false;
  if (workoutKey) {
    uni.navigateTo({ url: `/pages/workout/session?key=${workoutKey}` });
    emit('close');
  }
}

/**
 * 显示运动倒计时弹窗
 */
function showCountdownPopup(exercise) {
  currentExercise.value = {
    name: exercise.name || '运动',
    anim_url: exercise.anim_url || '',
    duration_seconds: exercise.duration_seconds || 180,
    has_workout: exercise.has_workout || false,
    workout_key: exercise.workout_key || ''
  };
  countdownVisible.value = true;

  // 调用后端接口记录运动
  useEquipmentDirect(currentItem.value);
}

/**
 * 倒计时关闭
 */
function onCountdownClose() {
  countdownVisible.value = false;
  currentExercise.value = null;
  currentItem.value = null;
  emit('close');
}

/**
 * 跳转到跟练页面
 */
function onGoWorkout(workoutKey) {
  countdownVisible.value = false;
  uni.navigateTo({ url: `/pages/workout/session?key=${workoutKey}` });
  emit('close');
}

/**
 * 直接使用器材（记录运动次数）
 */
async function useEquipmentDirect(item) {
  try {
    const res = await petApi.useInventoryItem(item.id);
    const effect = res.data?.effect || {};
    if (effect.equipment) {
      // 运动弹窗已显示，这里只记录后端数据
      return;
    }
    uni.showToast({ title: res.data?.message || '使用成功', icon: 'success', duration: 2500 });
    await loadItems();
  } catch (e) {
    uni.showToast({ title: e.message || '使用失败', icon: 'none' });
  }
}

onMounted(loadItems);
</script>

<style lang="scss" scoped>
.overlay-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.overlay-backdrop {
  position: absolute;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
}
.overlay-panel {
  position: relative;
  width: 100%;
  height: 82vh;
  background: #F8FBF4;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.overlay-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx 32rpx 8rpx;
  position: relative;
}
.overlay-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #563E22;
}
.overlay-close {
  position: absolute;
  right: 32rpx;
  top: 24rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #999;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 14rpx;
  /* 顶部 padding 取消 16rpx（8px），内容区上移，滚动空间扩大 8px */
  padding: 0 32rpx 16rpx;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
}
.category-tabs::-webkit-scrollbar {
  display: none;
}
.tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  padding: 0 32rpx;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #999999;
  white-space: nowrap;
  flex-shrink: 0;
}
.tab-item text {
  white-space: nowrap;
}
.tab-item.active {
  background: #DDF3D2;
  color: #8EBB77;
  font-weight: 700;
}

.overlay-scroll {
  flex: 1;
  height: 0;
  overflow-y: auto;
  /*
   * [搭搭页4弹层滚动条避让最终版（与ShopPanel完全一致，对齐overlay真实父宽750rpx）]
   *
   * 对齐基准：overlay-header padding 左右 32rpx / close right:32rpx → 内容左右必须 32rpx 对齐头部
   * 左视觉边距 = padding-left 32rpx
   * 右视觉边距 = padding-right 72(32+40避让) - |margin-right|(40) = 32rpx → 完全对称
   * 顶部 padding-top: 8rpx 保留原设计与头部"食物/道具"Tab 的间隙
   * box-sizing: content-box → 负margin真正外伸40rpx避让带，滚动条画在避让区，不压背包卡 ✅
   */
  padding: 8rpx 72rpx 0 32rpx;
  margin-right: -40rpx;
  box-sizing: content-box;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}
.empty-img {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
}
.empty-sub {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #8EBB77;
}
.item-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 36rpx 19rpx;
}
.grid-cell {
  width: 216rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.item-card {
  position: relative;
  width: 216rpx;
  height: 308rpx;
  background: #DDF3D2;
  border-radius: 24rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.item-count {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 999rpx;
  padding: 2rpx 14rpx;
  font-size: 22rpx;
  color: #4A7C43;
  line-height: 1.4;
}
.item-img-box {
  width: 152rpx;
  height: 141rpx;
  background: #FFFFFF;
  border-radius: 12rpx;
  margin-top: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-img {
  width: 120rpx;
  height: 120rpx;
}
.item-name {
  margin-top: 12rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #563E22;
  max-width: 192rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.item-desc {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #8EBB77;
  max-width: 192rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.use-btn {
  margin-top: 16rpx;
  width: 156rpx;
  height: 60rpx;
  line-height: 60rpx;
  padding: 0;
  border-radius: 30rpx;
  background: #8EBB77;
  color: #FFFFFF;
  font-size: 24rpx;
  text-align: center;
}
.use-btn::after {
  border: none;
}
.use-btn.disabled {
  background: #C9D6C2;
  color: #FFFFFF;
}
.bottom-safe {
  /* 列表末尾内容能完整滚入视口，不被底部手势条/tab 遮挡 */
  height: calc(96rpx + env(safe-area-inset-bottom));
}

/* 弹窗对话框样式 */
.dialog-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.dialog-card {
  width: 560rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dialog-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #563E22;
  text-align: center;
  margin-bottom: 32rpx;
}

.dialog-desc {
  font-size: 28rpx;
  color: #8EBB77;
  text-align: center;
  margin-bottom: 32rpx;
}

.workout-list {
  width: 100%;
  max-height: 400rpx;
  overflow-y: auto;
}

.workout-item {
  width: 100%;
  padding: 24rpx 32rpx;
  background: #DDF3D2;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.workout-name {
  font-size: 28rpx;
  color: #563E22;
  font-weight: 500;
}

.workout-duration {
  font-size: 24rpx;
  color: #8EBB77;
}

.dialog-btns {
  display: flex;
  gap: 32rpx;
  margin-top: 32rpx;
  width: 100%;
}

.dialog-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 500;
}

.dialog-btn-cancel {
  background: #F5F5F5;
  color: #999;
}

.dialog-btn-confirm {
  background: #8EBB77;
  color: #FFFFFF;
}

.dialog-cancel {
  margin-top: 32rpx;
  padding: 24rpx 48rpx;
  border-radius: 32rpx;
  background: #F5F5F5;
  font-size: 28rpx;
  color: #999;
}
</style>
