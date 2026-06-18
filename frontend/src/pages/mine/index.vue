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
          <text class="menu-icon">📊</text>
          <text class="menu-text">记录中心</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item" @click="goToPage('/pages/museum/index')">
          <text class="menu-icon">🏛️</text>
          <text class="menu-text">减肥博物馆</text>
          <text class="menu-arrow">></text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item">
          <text class="menu-icon">👤</text>
          <text class="menu-text">个人资料</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <text class="menu-icon">🤖</text>
          <text class="menu-text">搭子管理</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <text class="menu-icon">⚙️</text>
          <text class="menu-text">系统设置</text>
          <text class="menu-arrow">></text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item">
          <text class="menu-icon">🔒</text>
          <text class="menu-text">隐私政策</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <text class="menu-icon">📄</text>
          <text class="menu-text">用户协议</text>
          <text class="menu-arrow">></text>
        </view>
        <view class="menu-item">
          <text class="menu-icon">❓</text>
          <text class="menu-text">帮助与反馈</text>
          <text class="menu-arrow">></text>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item danger">
          <text class="menu-icon">🗑️</text>
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
  background: #f5f6fa;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.user-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #4CAF50;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 48rpx;
  margin-right: 24rpx;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.nickname {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
}

.target {
  font-size: 26rpx;
  color: #999;
}

.menu-list {
  margin-bottom: 40rpx;
}

.menu-group {
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f6fa;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item.danger .menu-text {
  color: #F44336;
}

.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-arrow {
  font-size: 28rpx;
  color: #ccc;
}

.version {
  text-align: center;
  font-size: 24rpx;
  color: #999;
  padding: 20rpx 0;
}
</style>
