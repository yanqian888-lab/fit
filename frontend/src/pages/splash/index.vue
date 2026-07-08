<template>
  <view class="splash-page">
    <view class="splash-content">
      <view class="logo">
        <text>瘦</text>
      </view>
      <text class="app-name">减肥搭子</text>
      <text class="app-slogan">你的专属 AI 减肥伙伴</text>
    </view>
    
    <!-- 隐私政策弹窗 -->
    <PrivacyModal
      ref="privacyModal"
      @agreed="onPrivacyAgreed"
      @rejected="onPrivacyRejected"
    />
  </view>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useUserStore } from '../../store';
import { isProfileComplete } from '../../utils/authRedirect';
import PrivacyModal from '../../components/PrivacyModal.vue';

const userStore = useUserStore();
const privacyModal = ref(null);

onMounted(() => {
  setTimeout(async () => {
    await userStore.init();

    // 等待隐私弹窗完成配置加载与本地版本校验
    const needShow = await privacyModal.value?.check();
    if (needShow) {
      // 需要用户确认，弹窗已显示，等待用户点击同意/拒绝
      return;
    }

    // 已同意且版本一致，进入主流程
    enterApp();
  }, 1500);
});

function onPrivacyAgreed() {
  enterApp();
}

function onPrivacyRejected() {
  // 用户已选择拒绝，由 PrivacyModal 执行退出逻辑
  // 此处可做额外清理（如清除本地缓存）
  uni.removeStorageSync('privacy_agreed_version');
  uni.removeStorageSync('privacy_agreed_at');
}

function enterApp() {
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
