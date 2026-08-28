<template>
  <!-- 独立引导页：有自绘 AppHeader 标题，不要 AppPage showHeader，但要让出状态栏+胶囊 → padStatusBar=true（标杆双行兜底） -->
  <AppPage :padStatusBar="true">
    <AppHeader title="新手任务" :show-back="false" />
    <view class="tasks-page">
      <view class="intro-card">
        <text class="intro-title">7 天新手旅程</text>
        <text class="intro-sub">完成每日小任务，解锁专属成就奖励</text>
      </view>

      <view class="progress-card">
        <view class="progress-text">
          <text>已完成 {{ completedCount }}/{{ tasks.length }}</text>
          <text class="progress-percent">{{ Math.round((completedCount / tasks.length) * 100) }}%</text>
        </view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: (completedCount / tasks.length * 100) + '%' }"></view>
        </view>
      </view>

      <view class="task-list">
        <view v-for="(task, index) in tasks" :key="task.task_key" class="task-item" :class="{ completed: task.status === 'completed' || task.status === 'claimed', claimed: task.status === 'claimed' }">
          <view class="task-day">DAY {{ index + 1 }}</view>
          <view class="task-main">
            <text class="task-title">{{ task.title }}</text>
            <text class="task-desc">{{ task.description }}</text>
          </view>
          <view class="task-check" @click="claim(task)">
            <text v-if="task.status === 'claimed'">✓</text>
            <text v-else-if="task.status === 'completed'" class="claim-text">领</text>
          </view>
        </view>
      </view>

      <AppButton block type="primary" @click="finish">进入首页</AppButton>
    </view>

    <!-- 奖励回执弹层 -->
    <view v-if="receiptVisible" class="receipt-mask" @click="closeReceipt">
      <view class="receipt-panel" @click.stop>
        <image class="receipt-avatar" src="/static/image/icon/celebrate01.jpg" mode="aspectFit" />
        <text class="receipt-title">搭搭给你发奖励啦</text>
        <text class="receipt-content">{{ receipt.content }}</text>
        <view class="receipt-rewards">
          <text v-if="receipt.berries" class="receipt-reward">🫐 {{ receipt.berries }} 浆果</text>
        </view>
        <view class="receipt-btn" @click="closeReceipt">开心收下</view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';
import { newbieTaskApi } from '../../api';

const tasks = ref([]);
const receiptVisible = ref(false);
const receipt = ref({ content: '', berries: 0 });

const completedCount = computed(() => tasks.value.filter(t => t.status === 'completed' || t.status === 'claimed').length);

onMounted(() => {
  load();
});

async function load() {
  try {
    const res = await newbieTaskApi.list();
    tasks.value = res.data.list || [];
  } catch (e) {
    console.error(e);
  }
}

function showReceipt(data) {
  if (!data || !data.content) return;
  receipt.value = {
    content: data.content,
    berries: data.berries || 0
  };
  receiptVisible.value = true;
}

function closeReceipt() {
  receiptVisible.value = false;
}

async function claim(task) {
  if (task.status !== 'completed') return;
  try {
    const res = await newbieTaskApi.claim(task.task_key);
    showReceipt(res.data?.receipt_message);
    load();
  } catch (e) {
    uni.showToast({ title: e.message || '领取失败', icon: 'none' });
  }
}

function finish() {
  uni.switchTab({ url: '/pages/index/index' });
}
</script>

<style lang="scss" scoped>
.tasks-page {
  padding-top: $spacing-md;
}

.intro-card {
  background: $mint;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-soft;
  color: $white;
}

.intro-title {
  font-size: $text-2xl;
  font-weight: $font-bold;
  display: block;
  margin-bottom: 12rpx;
}

.intro-sub {
  font-size: $text-sm;
  opacity: 0.9;
  font-weight: $font-light;
}

.progress-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
}

.progress-percent {
  color: $mint-dark;
  font-weight: $font-bold;
}

.progress-bar {
  height: 16rpx;
  background: $gray-50;
  border-radius: $radius-pill;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: $mint;
  border-radius: $radius-pill;
  transition: width 0.3s ease;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.task-item {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;
  opacity: 0.8;
}

.task-item.completed {
  opacity: 1;
  background: $mint-light;
}

.task-item.claimed {
  opacity: 1;
}
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
  width: 280px;
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.receipt-avatar {
  width: 80px;
  height: 80px;
  margin-bottom: 12px;
}
.receipt-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
}
.receipt-content {
  font-size: 14px;
  color: #666;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 14px;
}
.receipt-rewards {
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
}
.receipt-reward {
  font-size: 14px;
  color: #e6a23c;
  font-weight: 500;
}
.receipt-btn {
  width: 100%;
  padding: 12px 0;
  background: #8DBB77;
  color: #fff;
  text-align: center;
  border-radius: 22px;
  font-size: 15px;
  font-weight: 600;
}

.task-day {
  width: 80rpx;
  font-size: $text-xs;
  color: $text-tertiary;
  font-weight: $font-bold;
}

.task-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.task-title {
  font-size: $text-base;
  font-weight: $font-semibold;
  color: $text-primary;
  margin-bottom: 6rpx;
}

.task-desc {
  font-size: $text-xs;
  color: $text-secondary;
}

.task-check {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  border: 2rpx solid $mint;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $white;
  font-weight: $font-bold;
  margin-left: $spacing-sm;
}

.task-item.completed .task-check {
  background: rgba($mint, 0.2);
  color: $mint;
}

.task-item.claimed .task-check {
  background: $mint;
  color: $white;
}

.claim-text {
  font-size: 20rpx;
}
</style>
