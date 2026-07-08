<template>
  <AppPage>
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
        <view v-for="(task, index) in tasks" :key="index" class="task-item" :class="{ completed: task.completed }">
          <view class="task-day">DAY {{ index + 1 }}</view>
          <view class="task-main">
            <text class="task-title">{{ task.title }}</text>
            <text class="task-desc">{{ task.desc }}</text>
          </view>
          <view class="task-check" @click="toggle(index)">
            <text v-if="task.completed">✓</text>
          </view>
        </view>
      </view>

      <AppButton block type="primary" @click="finish">进入首页</AppButton>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const tasks = ref([
  { title: '和搭子打声招呼', desc: '发送第一条消息，让搭子认识你', completed: false },
  { title: '记录今日饮食', desc: '记录早餐或午餐，体验聊天即记录', completed: false },
  { title: '记录一次运动', desc: '跑步、散步、瑜伽都可以', completed: false },
  { title: '称一次体重', desc: '记录当前体重，开启追踪', completed: false },
  { title: '收藏一条金句', desc: '把搭子的话收藏进博物馆', completed: false },
  { title: '查看博物馆', desc: '浏览时间轴，回顾进步', completed: false },
  { title: '完成 3 天打卡', desc: '连续记录，养成习惯', completed: false }
]);

const completedCount = computed(() => tasks.value.filter(t => t.completed).length);

onMounted(() => {
  const stored = uni.getStorageSync('newbieTasks');
  if (stored) tasks.value = JSON.parse(stored);
});

function toggle(index) {
  tasks.value[index].completed = !tasks.value[index].completed;
  uni.setStorageSync('newbieTasks', JSON.stringify(tasks.value));
  if (completedCount.value === tasks.value.length) {
    uni.showToast({ title: '恭喜完成全部任务！', icon: 'none' });
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
  background: $mint;
}
</style>
