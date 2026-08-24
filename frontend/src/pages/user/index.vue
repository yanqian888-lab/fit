<template>
  <view class="user-page">
    <!-- 顶部渐变色背景 -->
    <view class="header-bg"></view>

    <view class="status-bar"></view>

    <!-- 返回按钮 + 用户信息（同一行，垂直居中） -->
    <view class="header-row">
      <view class="back-btn" @click="goBack">
        <image class="back-icon" src="/static/image/icon/fanhui.png" mode="aspectFit" />
      </view>
      <view class="user-header">
        <view class="avatar">
          <image v-if="user.avatar_url && !avatarError" :src="avatarFullUrl" class="avatar-img" mode="aspectFill" @error="avatarError = true" />
          <text v-else>{{ user.nickname?.[0] || 'U' }}</text>
        </view>
        <view class="user-info">
          <text class="nickname">{{ user.nickname || '用户昵称' }}</text>
          <image class="edit-icon" src="/static/image/icon/xiugai.png" mode="aspectFit" @click="goTo('/pages/user/profile')" />
        </view>
      </view>
    </view>

    <!-- 菜单卡片 -->
    <view class="menu-card">
      <view class="menu-item" v-for="(item, index) in menuList" :key="item.title" @click="goTo(item.url)">
        <view v-if="item.badge && noticeStore.unreadCount > 0" class="menu-badge">{{ noticeStore.unreadCount > 99 ? '99+' : noticeStore.unreadCount }}</view>
        <view class="menu-icon">
          <image class="menu-icon-img" :src="item.iconImg" mode="aspectFit" />
        </view>
        <text class="menu-title">{{ item.title }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view v-if="isLoggedIn" class="logout-wrap">
      <button class="logout-btn" @click="logout">退出登录</button>
    </view>

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

  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { userApi } from '../../api';
import { getServerUrl } from '../../utils/environment.js';
import { useUserStore } from '../../store';
import { useNoticeStore } from '../../store/notice';
import popupManager from '../../utils/popupManager';
import AppModal from '../../components/AppModal.vue';
const userStore = useUserStore();
const noticeStore = useNoticeStore();
const user = ref({});
const isLoggedIn = ref(false);
const avatarError = ref(false);

// 退出登录确认弹框
const showLogoutModal = ref(false);

const avatarFullUrl = computed(() => {
  if (!user.value.avatar_url) return '';
  if (user.value.avatar_url.startsWith('http')) return user.value.avatar_url;
  return `${getServerUrl()}${user.value.avatar_url}`;
});

const menuList = [
  { title: '消息中心', iconImg: '/static/image/icon/menu_message.svg', url: '/pages/user/messages', badge: true },
  { title: '搭子设置', iconImg: '/static/image/icon/menu_partner.svg', url: '/pages/partner/settings' },
  { title: '账户设置', iconImg: '/static/image/icon/menu_account.svg', url: '/pages/user/account-settings' },
  { title: '意见反馈', iconImg: '/static/image/icon/menu_feedback.svg', url: '/pages/user/feedback' },
  { title: '关于我们', iconImg: '/static/image/icon/menu_about.svg', url: '/pages/user/about' },
  { title: '用户协议', iconImg: '/static/image/icon/menu_agreement.svg', url: '/pages/user/agreement' },
  { title: '隐私协议', iconImg: '/static/image/icon/menu_privacy.svg', url: '/pages/user/privacy' }
];

function goTo(url) {
  uni.navigateTo({ url });
}

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/login/index' });
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
  isLoggedIn.value = false;
  user.value = {};
  // 退出后清空页面栈并跳转到登录页，防止未登录状态下查看原用户数据
  uni.reLaunch({ url: '/pages/login/index' });
}

async function fetchUser() {
  isLoggedIn.value = userStore.isLoggedIn;
  if (!isLoggedIn.value) return;

  try {
    const userRes = await userApi.getMe();
    user.value = userRes.data || {};
    avatarError.value = false;
  } catch (err) {
    console.error(err);
    if (err.status === 401) {
      userStore.logout();
      popupManager.clearCache();
      isLoggedIn.value = false;
      // 登录态失效时清空页面栈并回到登录页
      uni.reLaunch({ url: '/pages/login/index' });
    }
  }
}

onMounted(fetchUser);

onShow(() => {
  fetchUser();
  noticeStore.fetchUnreadCount();
});
</script>

<style lang="scss" scoped>
.user-page {
  background: #F7FbF4;
  min-height: 100vh;
  padding: 0 32rpx calc(180rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  position: relative;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 420rpx;
  background: linear-gradient(180deg, rgba(248, 239, 203, 0.5) 0%, #FFFFFF 100%);
  z-index: 0;
}

.status-bar {
  height: var(--status-bar-height);
  position: relative;
  z-index: 1;
}

.header-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 40rpx 32rpx 0;
  margin-bottom: 48rpx;
}

.back-btn {
  padding: 10rpx;
  margin-right: 32rpx;
  flex-shrink: 0;
}

.back-icon {
  width: 48rpx;
  height: 48rpx;
  display: block;
}

.user-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}

.avatar {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  background: #8DBB77;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  font-weight: 700;
  color: #FFFFFF;
  margin-right: 32rpx;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.user-info {
  display: flex;
  align-items: center;
}

.nickname {
  font-size: 48rpx;
  font-weight: 700;
  color: #000000;
  line-height: 1.1;
  margin-right: 12rpx;
}

.edit-icon {
  width: 36rpx;
  height: 36rpx;
}

.menu-card {
  position: relative;
  z-index: 1;
  background: #FFFFFF;
  border-radius: 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #D9D9D9;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item {
  position: relative;
}

.menu-badge {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: 80rpx;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 10rpx;
  border-radius: 17rpx;
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 20rpx;
  line-height: 34rpx;
  text-align: center;
  z-index: 2;
}

.menu-icon {
  width: 56rpx;
  height: 56rpx;
  margin-right: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-icon-svg {
  width: 48rpx;
  height: 48rpx;
}

.menu-icon-img {
  width: 48rpx;
  height: 48rpx;
}

.menu-title {
  flex: 1;
  font-size: 32rpx;
  color: #27282D;
}

.menu-arrow {
  font-size: 40rpx;
  color: #C0C0C0;
  margin-left: 16rpx;
}


.logout-wrap {
  position: relative;
  z-index: 1;
  margin-top: 48rpx;
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