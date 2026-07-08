<template>
  <view class="mine-page">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="avatar">
        <text>{{ nicknameFirst }}</text>
      </view>
      <view class="user-info">
        <text class="nickname">{{ userInfo?.nickname || '减肥搭子用户' }}</text>
        <text class="target" v-if="userInfo?.profile?.target_weight">
          目标 {{ userInfo.profile.target_weight }} kg
        </text>
      </view>
    </view>

    <!-- 功能列表 -->
    <view class="menu-list">
      <view class="menu-group">
        <view class="menu-item" @click="goToPage('/pages/record/index')">
          <view class="menu-icon-wrap"><text class="menu-icon">📊</text></view>
          <text class="menu-text">今日记录</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item" @click="goToPage('/pages/museum/index')">
          <view class="menu-icon-wrap"><text class="menu-icon">🏛️</text></view>
          <text class="menu-text">博物馆</text>
          <text class="menu-arrow">></text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item">
          <view class="menu-icon-wrap"><text class="menu-icon">👤</text></view>
          <text class="menu-text">个人资料</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <view class="menu-icon-wrap"><text class="menu-icon">🤖</text></view>
          <text class="menu-text">搭子管理</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <view class="menu-icon-wrap"><text class="menu-icon">⚙️</text></view>
          <text class="menu-text">系统设置</text>
          <text class="menu-arrow">></text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item">
          <view class="menu-icon-wrap"><text class="menu-icon">🔒</text></view>
          <text class="menu-text">隐私政策</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <view class="menu-icon-wrap"><text class="menu-icon">📄</text></view>
          <text class="menu-text">用户协议</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <view class="menu-icon-wrap"><text class="menu-icon">❓</text></view>
          <text class="menu-text">帮助与反馈</text>
          <text class="menu-arrow">></text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item danger">
          <view class="menu-icon-wrap" style="background: #FFF0F0;"><text class="menu-icon">🗑️</text></view>
          <text class="menu-text">清空所有数据</text>
          <text class="menu-arrow">></text>
        </view>
      </view>
    </view>

    <view class="version">减肥搭子 v1.0.0</view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useUserStore } from '../../store';

const userStore = useUserStore();
const userInfo = computed(() => userStore.userInfo);

const nicknameFirst = computed(() => {
  const name = userStore.userInfo?.nickname || '用';
  return name.charAt(0);
});

function goToPage(url) {
  uni.switchTab({ url });
}
</script>

<style lang="scss" scoped>
.mine-page {
  min-height: 100vh;
  background: linear-gradient(180deg, $mint-light 0%, $bg-page 25%, $bg-page 100%);
  padding: $spacing-md;
  padding-top: 100rpx;
  padding-bottom: calc($spacing-md + env(safe-area-inset-bottom));
}

.user-card {
  background: $mint;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-soft;
  color: $white;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  color: $white;
  font-size: 52rpx;
  font-weight: $font-semibold;
  margin-right: $spacing-md;
  border: 4rpx solid rgba(255, 255, 255, 0.4);
}

.user-info {
  display: flex;
  flex-direction: column;
}

.nickname {
  font-size: $text-xl;
  font-weight: $font-bold;
  margin-bottom: 10rpx;
}

.target {
  font-size: $text-sm;
  opacity: 0.9;
  font-weight: $font-light;
}

.menu-list {
  margin-bottom: $spacing-lg;
}

.menu-group {
  background: $white;
  border-radius: $radius-xl;
  margin-bottom: $spacing-sm;
  padding: 0 $spacing-md;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item.danger .menu-text {
  color: #E57373;
}

.menu-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-sm;
}

.menu-item:nth-child(1) .menu-icon-wrap { background: $mint-light; }
.menu-item:nth-child(2) .menu-icon-wrap { background: $sky-light; }
.menu-item:nth-child(3) .menu-icon-wrap { background: $cream-light; }

.menu-icon {
  font-size: 36rpx;
}

.menu-text {
  flex: 1;
  font-size: $text-base;
  color: $text-primary;
  font-weight: $font-medium;
}

.menu-arrow {
  font-size: $text-base;
  color: $gray-300;
}

.version {
  text-align: center;
  font-size: $text-sm;
  color: $text-tertiary;
  padding: $spacing-sm 0;
  font-weight: $font-light;
}
</style>
