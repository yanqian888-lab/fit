<template>
  <view class="splash-page">
    <view class="splash-content">
      <view class="logo">
        <text>瘦</text>
      </view>
      <text class="app-name">掉秤搭搭</text>
      <text class="app-slogan">你的AI掉秤搭子，陪你一起健康瘦下去～</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted } from 'vue';
import { useUserStore } from '../../store';
import { isProfileComplete } from '../../utils/authRedirect';

const userStore = useUserStore();

/**
 * 当前隐私政策版本号（必须和 PrivacyModal 兜底版本、login/index 写入版本保持一致 1.0.0）
 * 将来后台配置了新版本号，这里同步改
 */
const EXPECTED_PRIVACY_VERSION = '1.0.0';

/**
 * 校验用户是否已经同意过当前版本的隐私政策
 * 1. 本地 privacy_agreed === true
 * 2. 本地 privacy_agreed_version === 当前期望版本号
 */
function hasAgreedCurrentPrivacy() {
  const agreed = uni.getStorageSync('privacy_agreed') === true;
  const version = uni.getStorageSync('privacy_agreed_version');
  return agreed && version === EXPECTED_PRIVACY_VERSION;
}

onMounted(() => {
  setTimeout(async () => {
    await userStore.init();

    // 未同意过当前版本隐私协议 → 直接跳登录页（登录页底部带勾选框，一站式处理）
    if (!hasAgreedCurrentPrivacy()) {
      uni.redirectTo({ url: '/pages/login/index' });
      return;
    }

    // 已同意，进入主流程
    enterApp();
  }, 1500);
});

function enterApp() {
  // 预览模式：直接进首页，不校验登录态
  if (uni.getStorageSync('preview_mode') === '1') {
    uni.switchTab({ url: '/pages/index/index' });
    return;
  }
  const settings = uni.getStorageSync('settings') || {};
  if (!settings.guide_completed) {
    uni.redirectTo({ url: '/pages/onboarding/index' });
  } else if (!userStore.isLoggedIn || !userStore.userInfo) {
    // token 失效或获取用户信息失败，统一视为未登录
    if (userStore.isLoggedIn && !userStore.userInfo) {
      userStore.logout();
    }
    uni.redirectTo({ url: '/pages/login/index' });
  } else if (!isProfileComplete(userStore.userInfo)) {
    uni.redirectTo({ url: '/pages/profile/setup' });
  } else {
    uni.switchTab({ url: '/pages/index/index' });
  }
}
</script>

<style lang="scss" scoped>
.splash-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, $mint-light 0%, $bg-page 100%);
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  border-radius: 48rpx;
  background: $mint;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $white;
  font-size: 80rpx;
  font-weight: $font-bold;
  box-shadow: $shadow-soft;
  margin-bottom: $spacing-md;
}

.app-name {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.app-slogan {
  font-size: $text-base;
  color: $text-tertiary;
  font-weight: $font-light;
}
</style>
