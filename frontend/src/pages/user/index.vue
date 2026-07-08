<template>
  <view class="user-page">
    <!-- 顶部渐变色背景 -->
    <view class="header-bg"></view>

    <view class="status-bar"></view>

    <!-- 用户信息 -->
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

    <!-- 菜单卡片 -->
    <view class="menu-card">
      <view class="menu-item" v-for="(item, index) in menuList" :key="item.title" @click="goTo(item.url)">
        <view class="menu-icon">
          <svg viewBox="0 0 48 48" class="menu-icon-svg">
            <template v-if="item.icon === 'partner'">
              <path d="M24 42 C24 42 8 30 8 18 C8 12 12 8 18 8 C21 8 24 10 24 13 C24 10 27 8 30 8 C36 8 40 12 40 18 C40 30 24 42 24 42Z" fill="#FBB186"/>
            </template>
            <template v-else-if="item.icon === 'feedback'">
              <rect x="6" y="14" width="36" height="24" rx="4" fill="#8DBB77"/>
              <path d="M6 18 L24 30 L42 18" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else-if="item.icon === 'about'">
              <circle cx="24" cy="24" r="20" fill="#86C6FB"/>
              <path d="M24 14 L24 16 M24 22 L24 36" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
            </template>
            <template v-else-if="item.icon === 'agreement'">
              <rect x="10" y="6" width="28" height="36" rx="4" fill="#A186FB"/>
              <path d="M16 16 H32 M16 24 H32 M16 32 H26" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
            </template>
            <template v-else-if="item.icon === 'privacy'">
              <rect x="10" y="8" width="28" height="32" rx="4" fill="#FB86A5"/>
              <path d="M16 8 V 36 M32 8 V 36" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
            </template>
            <template v-else-if="item.icon === 'account'">
              <circle cx="24" cy="18" r="8" fill="#9CA3AF"/>
              <path d="M10 42 Q24 30 38 42 V44 H10Z" fill="#9CA3AF"/>
            </template>
          </svg>
        </view>
        <text class="menu-title">{{ item.title }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view v-if="isLoggedIn" class="logout-wrap">
      <button class="logout-btn" @click="logout">退出登录</button>
    </view>

    <CustomTabBar />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { userApi } from '../../api';
import { getServerUrl } from '../../utils/environment.js';
import { useUserStore } from '../../store';
import popupManager from '../../utils/popupManager';
import CustomTabBar from '../../custom-tab-bar/index.vue';

const userStore = useUserStore();
const user = ref({});
const isLoggedIn = ref(false);
const avatarError = ref(false);

const avatarFullUrl = computed(() => {
  if (!user.value.avatar_url) return '';
  if (user.value.avatar_url.startsWith('http')) return user.value.avatar_url;
  return `${getServerUrl()}${user.value.avatar_url}`;
});

const menuList = [
  { title: '搭子设置', icon: 'partner', url: '/pages/partner/settings' },
  { title: '账户设置', icon: 'account', url: '/pages/user/account-settings' },
  { title: '意见反馈', icon: 'feedback', url: '/pages/user/feedback' },
  { title: '关于我们', icon: 'about', url: '/pages/user/about' },
  { title: '用户协议', icon: 'agreement', url: '/pages/user/agreement' },
  { title: '隐私协议', icon: 'privacy', url: '/pages/user/privacy' }
];

function goTo(url) {
  uni.navigateTo({ url });
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/login/index' });
}

function logout() {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout();
        popupManager.clearCache();
        isLoggedIn.value = false;
        user.value = {};
        // 退出后清空页面栈并跳转到登录页，防止未登录状态下查看原用户数据
        uni.reLaunch({ url: '/pages/login/index' });
      }
    }
  });
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
  uni.$emit('tabbar-select', 3);
  uni.hideTabBar({ animation: false }).catch(() => {});
  fetchUser();
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

.user-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  padding-top: 40rpx;
  margin-bottom: 48rpx;
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
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #D9D9D9;
}

.menu-item:last-child {
  border-bottom: none;
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
