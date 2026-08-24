<template>
  <AppPage fixed>
    <view class="page-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">账户设置</text>
      <view class="header-right"></view>
    </view>

    <scroll-view class="content-scroll" scroll-y>
      <view class="content-wrapper">
        <!-- 账户信息卡片 -->
        <view class="info-card">
          <view class="info-item">
            <text class="info-label">账号</text>
            <text class="info-value">{{ userInfo?.username || '-' }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">手机号</text>
            <text class="info-value">{{ maskedPhone }}</text>
          </view>
        </view>

        <!-- 操作列表 -->
        <view class="action-card">
          <view class="action-item danger" @click="goToDeleteAccount">
            <text class="action-text">注销账号</text>
            <text class="action-arrow">›</text>
          </view>
        </view>

        <!-- 退出登录 -->
        <view class="logout-wrap">
          <button class="logout-btn" @click="logout">退出登录</button>
        </view>
      </view>
    </scroll-view>

    <!-- 退出登录确认弹框 -->
    <AppModal
      v-model:visible="showLogoutModal"
      icon="none"
      title="确认退出"
      text="确定要退出登录吗？"
      confirmText="确认"
      cancelText="取消"
      @confirm="confirmLogout"
    />
  </AppPage>
</template>

<script setup>
import { ref, computed } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppModal from '../../components/AppModal.vue';
import { useUserStore } from '../../store';
import popupManager from '../../utils/popupManager';
import { goBack } from '../../utils/navigate';

const userStore = useUserStore();
const userInfo = computed(() => userStore.userInfo);

// 退出登录确认弹框
const showLogoutModal = ref(false);

const statusBarHeight = ref(44);
try {
  statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 44;
  // #ifdef MP-WEIXIN
  statusBarHeight.value += 44; // 小程序胶囊高度
  // #endif
} catch (e) {}

const maskedPhone = computed(() => {
  const phone = userInfo.value?.phone;
  if (!phone || phone.length !== 11) return phone || '-';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
});

function goToDeleteAccount() {
  uni.navigateTo({ url: '/pages/user/delete-account-agreement' });
}

function logout() {
  showLogoutModal.value = true;
}

/**
 * 确认执行退出登录
 */
function confirmLogout() {
  showLogoutModal.value = false;
  userStore.logout();
  popupManager.clearCache();
  uni.reLaunch({ url: '/pages/login/index' });
}
</script>

<style lang="scss" scoped>
.page-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #DDF2D2 0%, #F7FbF4 360rpx, #F7FbF4 100%);
  z-index: 0;
}

.status-bar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.page-header {
  /* #ifdef MP-WEIXIN */
  margin-top: -88rpx; /* 标题/返回按钮上移到胶囊所在顶部栏 */
  /* #endif */
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx 24rpx;
  flex-shrink: 0;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 48rpx;
  color: #27282D;
  font-weight: 700;
  line-height: 1;
  margin-left: -4rpx;
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 40rpx;
}

.content-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  padding: $spacing-md $spacing-md calc(140rpx + env(safe-area-inset-bottom));
}

.info-card,
.action-card {
  background: $bg-card;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: $text-base;
  color: $text-primary;
  font-weight: $font-medium;
}

.info-value {
  font-size: $text-base;
  color: $text-secondary;
}

.action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;
}

.action-item.danger .action-text {
  color: #E57373;
}

.action-text {
  font-size: $text-base;
  color: $text-primary;
  font-weight: $font-medium;
}

.action-arrow {
  font-size: 40rpx;
  color: $gray-300;
  margin-left: 16rpx;
}

.logout-wrap {
  margin-top: $spacing-lg;
  display: flex;
  justify-content: center;
}

.logout-btn {
  font-size: 30rpx;
  color: #FB86A5;
  background: transparent;
  border: none;
}

.logout-btn::after {
  border: none;
}
</style>
