<template>
  <view class="overlay-mask">
    <view class="overlay-backdrop" @click="$emit('close')"></view>
    <view class="overlay-panel">
      <view class="overlay-header">
        <text class="overlay-title">任务</text>
        <view class="overlay-close" @click="$emit('close')">✕</view>
      </view>

      <scroll-view class="overlay-scroll" scroll-y>
        <!-- 每日签到卡片 -->
        <view class="checkin-card" @click="doCheckin">
          <view class="checkin-left">
            <text class="checkin-title">每日签到</text>
            <text class="checkin-desc">已连续签到{{ checkin.continuous_days || 0 }}天</text>
          </view>
          <view class="checkin-btn" :class="{ disabled: checkin.today_checkin }">
            <text>{{ checkin.today_checkin ? '已签到' : '签到领浆果' }}</text>
          </view>
        </view>

        <!-- 任务列表 -->
        <view class="task-section" v-for="section in sections" :key="section.type">
          <template v-if="section.tasks.length">
            <text class="section-title">{{ section.title }}</text>
            <view class="task-list">
              <view class="task-item" v-for="task in section.tasks" :key="task.id">
                <view class="task-info">
                  <text class="task-name">{{ task.name }}</text>
                  <text class="task-reward">{{ rewardText(task) }}</text>
                </view>
                <view class="task-progress">
                  <view class="progress-bar-bg">
                    <view class="progress-bar-fill" :style="{ width: taskProgress(task) + '%' }"></view>
                  </view>
                </view>
                <text class="progress-text">{{ taskProgressText(task) }}</text>
                <view
                  class="task-action"
                  :class="{ completed: task.status === 2, clickable: task.status !== 2 }"
                  @click="onTaskAction(task)"
                >
                  <text>{{ task.status === 2 ? '已完成' : (task.status === 1 ? '可领取' : '去完成') }}</text>
                </view>
              </view>
            </view>
          </template>
        </view>
        <view class="bottom-safe"></view>
      </scroll-view>

      <!-- 奖励回执弹层 -->
      <view v-if="receiptVisible" class="receipt-mask" @click="receiptVisible = false">
        <view class="receipt-panel" @click.stop>
          <image class="receipt-avatar" src="/static/image/icon/celebrate01.jpg" mode="aspectFit" />
          <text class="receipt-title">搭搭给你发奖励啦</text>
          <text class="receipt-content">{{ receipt.content }}</text>
          <view class="receipt-rewards">
            <view v-if="receipt.berries" class="receipt-reward">
              <image class="reward-icon" src="/static/image/icon/jiangguo@3x.png" mode="aspectFit" />
              <text class="reward-text">{{ receipt.berries }} 浆果</text>
            </view>
            <view v-if="receipt.flowers" class="receipt-reward">
              <image class="reward-icon" src="/static/image/icon/xianhua@3x.png" mode="aspectFit" />
              <text class="reward-text">{{ receipt.flowers }} 鲜花</text>
            </view>
          </view>
          <view class="receipt-btn" @click="receiptVisible = false">开心收下</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { petApi } from '../../../api';

const emit = defineEmits(['close', 'updated', 'openShop']);

const tasks = ref([]);
const checkin = ref({});
const receiptVisible = ref(false);
const receipt = ref({ content: '', berries: 0, flowers: 0 });

const sections = computed(() => [
  // 顶部已有签到卡片，每日任务里不再重复显示「每日签到」
  { type: 'daily', title: '每日任务', tasks: tasks.value.filter(t => t.type === 'daily' && t.name !== '每日签到') },
  { type: 'weekly', title: '周常任务', tasks: tasks.value.filter(t => t.type === 'weekly') },
  { type: 'once', title: '常驻任务', tasks: tasks.value.filter(t => t.type === 'once') }
]);

function rewardText(task) {
  const parts = [];
  if (task.reward_berries) parts.push(`+浆果 ${task.reward_berries} 个`);
  if (task.reward_flowers) parts.push(`+鲜花 ${task.reward_flowers} 朵`);
  return parts.join(' ');
}

function taskProgress(task) {
  const current = task.progress?.count || 0;
  const target = task.condition?.count || 1;
  return Math.min(100, Math.floor((current / target) * 100));
}

function taskProgressText(task) {
  const current = task.progress?.count || 0;
  const target = task.condition?.count || 1;
  return `${current}/${target}`;
}

async function load() {
  try {
    const res = await petApi.getTasks();
    tasks.value = res.data.list || [];
    const cin = await petApi.getCheckinStatus();
    checkin.value = cin.data || {};
  } catch (e) {}
}

function showReceipt(data) {
  if (!data || !data.content) return;
  receipt.value = {
    content: data.content,
    berries: data.berries || 0,
    flowers: data.flowers || 0
  };
  receiptVisible.value = true;
}

async function doCheckin() {
  if (checkin.value.today_checkin) return;
  try {
    const res = await petApi.checkin();
    showReceipt(res.data?.receipt_message);
    load();
    emit('updated');
  } catch (e) {
    uni.showToast({ title: e.message || '签到失败', icon: 'none' });
  }
}

// 任务「去完成」跳转映射（按任务条件 action）
const JUMP_MAP = {
  record_diet: { type: 'page', url: '/pages/record/diet-detail' },
  record_exercise: { type: 'page', url: '/pages/record/exercise-detail' },
  chat: { type: 'tab', url: '/pages/pet/index' },
  record_water: { type: 'tab', url: '/pages/record/index' },
  drink_water_goal: { type: 'tab', url: '/pages/record/index' },
  generate_analysis: { type: 'tab', url: '/pages/record/index' },
  record_fasting_complete: { type: 'tab', url: '/pages/record/index' },
  feed: { type: 'close' },
  shop_buy: { type: 'shop' },
  use_item: { type: 'close' },
  interact_touch: { type: 'close' },
  share: { type: 'pending' },
  complete_profile: { type: 'page', url: '/pages/user/profile' }
};

function taskActionOf(task) {
  return JUMP_MAP[task.condition?.action] || null;
}

function hasJump(task) {
  return !!taskActionOf(task);
}

async function onTaskAction(task) {
  if (task.status === 2) return;
  // 可领取：领取奖励
  if (task.status === 1) {
    try {
      const res = await petApi.claimTaskReward(task.id);
      showReceipt(res.data?.receipt_message);
      load();
      emit('updated');
    } catch (e) {
      uni.showToast({ title: e.message || '领取失败', icon: 'none' });
    }
    return;
  }
  const action = taskActionOf(task);
  if (!action) {
    // 无跳转配置：关闭面板（兜底行为）
    emit('close');
    return;
  }
  if (action.type === 'page') {
    emit('close');
    uni.navigateTo({ url: action.url });
  } else if (action.type === 'tab') {
    emit('close');
    uni.switchTab({ url: action.url });
  } else if (action.type === 'close') {
    emit('close');
  } else if (action.type === 'shop') {
    // 关闭任务面板，拉出商店面板（由父页面处理）
    emit('open-shop');
  } else if (action.type === 'pending') {
    uni.showToast({ title: '功能敬请期待', icon: 'none' });
  }
}

onMounted(load);
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
  padding: 28rpx 32rpx 16rpx;
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
.overlay-scroll {
  flex: 1;
  height: 0;
  padding: 0 32rpx;
  box-sizing: border-box;
  /* 滚动条向右移 12px（24rpx），不压「去完成」按钮；面板 overflow:hidden 裁掉超出部分 */
  margin-right: -24rpx;
}
.bottom-safe {
  /* 列表末尾任务能完整滚入视口，不被底部手势条/tab 遮挡 */
  height: calc(96rpx + env(safe-area-inset-bottom));
}

.checkin-card {
  height: 152rpx;
  background: #DDF3D2;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  box-sizing: border-box;
}
.checkin-left {
  display: flex;
  align-items: baseline;
}
.checkin-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #563E22;
}
.checkin-desc {
  font-size: 28rpx;
  color: #8EBB77;
  margin-left: 20rpx;
}
.checkin-btn {
  width: 222rpx;
  height: 88rpx;
  background: #8EBB77;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #FFFFFF;
}
.checkin-btn.disabled {
  background: #c9c9c9;
}

.task-info {
  width: 200rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.task-name {
  font-size: 28rpx;
  color: #563E22;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.task-reward {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #8EBB77;
}

.task-section {
  margin-top: 24rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #563E22;
  margin-bottom: 16rpx;
  display: block;
}
.task-list {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.task-item {
  min-height: 84rpx;
  display: flex;
  align-items: center;
}
.task-progress {
  width: 228rpx;
  flex-shrink: 0;
  margin-left: 14rpx;
}
.progress-bar-bg {
  width: 228rpx;
  height: 8rpx;
  background: #E7E7E7;
  border-radius: 12rpx;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: #8DBB77;
  border-radius: 12rpx;
}
.progress-text {
  font-size: 24rpx;
  color: #8EBB77;
  margin-left: 16rpx;
  flex: 1;
}
.task-action {
  width: 136rpx;
  height: 60rpx;
  background: #DDF3D2;
  border-radius: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #8EBB77;
  flex-shrink: 0;
}
.task-action.completed {
  background: #E7E7E7;
  color: #999999;
}

.receipt-mask {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.receipt-panel {
  width: 560rpx;
  background: #FFFFFF;
  border-radius: 40rpx;
  padding: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.receipt-avatar {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
}
.receipt-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #563E22;
  margin-bottom: 20rpx;
}
.receipt-content {
  font-size: 28rpx;
  color: #666666;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 28rpx;
}
.receipt-rewards {
  display: flex;
  gap: 32rpx;
  margin-bottom: 36rpx;
}
.receipt-reward {
  display: flex;
  align-items: center;
}
.reward-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
}
.reward-text {
  font-size: 28rpx;
  color: #e6a23c;
  font-weight: 500;
}
.receipt-btn {
  width: 100%;
  padding: 24rpx 0;
  background: #8EBB77;
  color: #FFFFFF;
  text-align: center;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
}
</style>
