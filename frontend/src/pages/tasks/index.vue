<template>
  <view class="tasks-page">
    <!-- 顶部标题图 -->
    <image class="title-img" :src="tasksTitleUrl" mode="aspectFit" />

    <!-- 底部浅色面板 -->
    <view class="panel">
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

      <!-- 快捷入口 -->
      <view class="quick-entry">
        <view class="entry-card" @click="goAchievements">
          <image class="entry-icon" :src="resolveStaticUrl('/static/image/icon/bowuguan@3x.png')" mode="aspectFit" />
          <text class="entry-label">成就</text>
        </view>
        <view class="entry-card" @click="goMilestones">
          <image class="entry-icon" :src="resolveStaticUrl('/static/image/icon/lichengbei.png')" mode="aspectFit" />
          <text class="entry-label">里程碑</text>
        </view>
        <view class="entry-card" @click="goNewbieTasks">
          <image class="entry-icon" :src="resolveStaticUrl('/static/image/icon/renwu@3x.png')" mode="aspectFit" />
          <text class="entry-label">新手任务</text>
        </view>
      </view>

      <!-- 任务列表 -->
      <view class="task-section" v-for="section in sections" :key="section.type">
        <text class="section-title">{{ section.title }}</text>
        <view class="task-list">
          <view class="task-item" v-for="task in section.tasks" :key="task.id">
            <text class="task-name">{{ task.name }}</text>
            <view class="task-progress">
              <view class="progress-bar-bg">
                <view class="progress-bar-fill" :style="{ width: taskProgress(task) + '%' }"></view>
              </view>
            </view>
            <text class="progress-text">{{ taskProgressText(task) }}</text>
            <view class="task-action" :class="{ completed: task.status === 2 }">
              <text>{{ task.status === 2 ? '已完成' : (task.status === 1 ? '可领取' : '进行中') }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 奖励回执弹层 -->
    <view v-if="receiptVisible" class="receipt-mask" @click="closeReceipt">
      <view class="receipt-panel" @click.stop>
        <image class="receipt-avatar" :src="celebrateAvatarUrl" mode="aspectFit" />
        <text class="receipt-title">搭搭给你发奖励啦</text>
        <text class="receipt-content">{{ receipt.content }}</text>
        <view class="receipt-rewards">
          <view v-if="receipt.berries" class="receipt-reward">
            <image class="reward-icon" :src="resolveStaticUrl('/static/image/icon/jiangguo@3x.png')" mode="aspectFit" />
            <text class="reward-text">{{ receipt.berries }} 浆果</text>
          </view>
          <view v-if="receipt.flowers" class="receipt-reward">
            <image class="reward-icon" :src="resolveStaticUrl('/static/image/icon/xianhua@3x.png')" mode="aspectFit" />
            <text class="reward-text">{{ receipt.flowers }} 鲜花</text>
          </view>
        </view>
        <view class="receipt-btn" @click="closeReceipt">开心收下</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { petApi } from '../../api';
import { resolveStaticUrl } from '../../utils/environment.js';

const tasks = ref([]);
const checkin = ref({});
const receiptVisible = ref(false);

/** 奖励回执头像：改为远程 CDN 加载以减小小程序包体积 */
const celebrateAvatarUrl = resolveStaticUrl('/static/image/icon/celebrate01.jpg');
/** 任务中心标题图：改为远程 CDN 加载以减小小程序包体积 */
const tasksTitleUrl = resolveStaticUrl('/static/image/icon/renwuban_biaoti@3x.png');
const receipt = ref({ content: '', berries: 0, flowers: 0 });

const sections = computed(() => [
  { type: 'daily', title: '每日任务', tasks: tasks.value.filter(t => t.type === 'daily') },
  { type: 'weekly', title: '周常任务', tasks: tasks.value.filter(t => t.type === 'weekly') },
  { type: 'once', title: '常驻任务', tasks: tasks.value.filter(t => t.type === 'once') }
]);

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
    showRecentCompletionToast(tasks.value);
    const cin = await petApi.getCheckinStatus();
    checkin.value = cin.data;
  } catch (e) {
    console.error(e);
  }
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

function closeReceipt() {
  receiptVisible.value = false;
}

const toastedTaskIds = new Set();

function showRecentCompletionToast(list) {
  const now = Date.now();
  for (const task of list) {
    if (task.status !== 2 || !task.completed_at) continue;
    const completedAt = new Date(task.completed_at).getTime();
    if (now - completedAt <= 5 * 60 * 1000 && !toastedTaskIds.has(task.id)) {
      toastedTaskIds.add(task.id);
      const parts = [];
      if (task.reward_berries) parts.push(`${task.reward_berries} 浆果`);
      if (task.reward_flowers) parts.push(`${task.reward_flowers} 鲜花`);
      uni.showToast({
        title: `「${task.name}」完成${parts.length ? '，+' + parts.join('、') : ''}`,
        icon: 'none',
        duration: 2500
      });
      break;
    }
  }
}

async function doCheckin() {
  if (checkin.value.today_checkin) return;
  try {
    const res = await petApi.checkin();
    showReceipt(res.data?.receipt_message);
    load();
  } catch (e) {
    uni.showToast({ title: e.message || '签到失败', icon: 'none' });
  }
}

function goAchievements() {
  uni.navigateTo({ url: '/pages/user/achievement' });
}

function goMilestones() {
  uni.navigateTo({ url: '/pages/museum/milestones' });
}

function goNewbieTasks() {
  uni.navigateTo({ url: '/pages/onboarding/tasks' });
}

onMounted(() => {
  load();
});
</script>

<style lang="scss" scoped>
.tasks-page {
  position: relative;
  min-height: 100vh;
  background: rgba(0, 0, 0, 0.5);
}

/* 顶部标题图：设计稿 x=125px y=255px w=126px h=120px（1px=2rpx） */
.title-img {
  position: absolute;
  left: 250rpx;
  top: 510rpx;
  width: 252rpx;
  height: 240rpx;
  z-index: 2;
}

/* 底部面板：设计稿 y=341px 起，bg=#F8FBF4，顶部圆角 12px */
.panel {
  position: absolute;
  left: 0;
  right: 0;
  top: 682rpx;
  bottom: 0;
  background: #F8FBF4;
  border-radius: 24rpx 24rpx 0 0;
  padding: 84rpx 32rpx 32rpx;
  box-sizing: border-box;
  overflow-y: auto;
  z-index: 1;
}

/* 每日签到卡片：x=16px y=383px（相对面板 84rpx）w=343px h=76px，bg=#DDF3D2 */
.checkin-card {
  width: 686rpx;
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
/* 签到按钮：w=111px h=44px，bg=#8EBB77，圆角 22px */
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

/* 快捷入口 */
.quick-entry {
  margin-top: 24rpx;
  display: flex;
  gap: 20rpx;
}
.entry-card {
  flex: 1;
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 20rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.entry-icon {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 8rpx;
}
.entry-label {
  font-size: 24rpx;
  color: #563E22;
}

/* 任务分组 */
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

/* 任务项：w=343px h=30px */
.task-item {
  width: 686rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
}
.task-name {
  font-size: 28rpx;
  color: #563E22;
  width: 200rpx;
  flex-shrink: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* 进度条：x=107px y=13px w=114px h=4px */
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
/* 状态胶囊：w=68px h=30px */
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

/* 奖励回执弹层 */
.receipt-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
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