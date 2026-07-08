<template>
  <view class="register-page">
    <view class="register-header">
      <text class="app-title">注册账号</text>
      <text class="app-subtitle">{{ isFromSetup ? '注册后自动保存你的基础信息' : '开启你的减肥之旅' }}</text>
    </view>

    <view class="register-form">
      <view class="form-item">
        <text class="form-label">账号</text>
        <input
          v-model="form.username"
          class="form-input"
          type="text"
          placeholder="请设置6位字母+数字组合账号"
          maxlength="6"
        />
      </view>
      <view class="form-item">
        <text class="form-label">密码</text>
        <input
          v-model="form.password"
          class="form-input"
          type="password"
          placeholder="请设置6位密码"
          maxlength="6"
        />
      </view>
      <view class="form-item">
        <text class="form-label">确认密码</text>
        <input
          v-model="form.confirmPassword"
          class="form-input"
          type="password"
          placeholder="请再次输入密码"
          maxlength="6"
        />
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input
          v-model="form.phone"
          class="form-input"
          type="number"
          placeholder="请输入手机号"
          maxlength="11"
        />
      </view>
      <button class="register-btn" @click="register">注册</button>
      <view class="login-link" @click="goToLogin">
        <text>已有账号？去登录</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { authApi, userApi } from '../../api';
import { useUserStore } from '../../store';
import { getDeviceId } from '../../utils/trial.js';
import { handlePostAuthRedirect } from '../../utils/authRedirect';

const userStore = useUserStore();
const isFromSetup = ref(false);

const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  phone: ''
});

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (currentPage && currentPage.options && currentPage.options.from === 'setup') {
    isFromSetup.value = true;
  }
});

function goToLogin() {
  uni.navigateTo({ url: '/pages/login/index?from=setup' });
}

const USERNAME_REGEX = /^[a-zA-Z0-9]{6}$/;
function validateUsernameCombo(username) {
  return USERNAME_REGEX.test(username) && /[a-zA-Z]/.test(username) && /[0-9]/.test(username);
}

async function register() {
  const { username, password, confirmPassword, phone } = form.value;

  if (!USERNAME_REGEX.test(username || '')) {
    uni.showToast({ title: '请输入6位字母+数字账号', icon: 'none' });
    return;
  }
  if (!validateUsernameCombo(username)) {
    uni.showToast({ title: '账号需同时包含字母和数字', icon: 'none' });
    return;
  }
  if (!password || password.length !== 6) {
    uni.showToast({ title: '请输入6位密码', icon: 'none' });
    return;
  }
  if (password !== confirmPassword) {
    uni.showToast({ title: '两次密码不一致', icon: 'none' });
    return;
  }
  if (!phone || phone.length !== 11) {
    uni.showToast({ title: '请输入11位手机号', icon: 'none' });
    return;
  }

  try {
    const res = await authApi.register({ username, password, phone, device_id: getDeviceId() });
    userStore.login(res.data.token, res.data.user);

    uni.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => {
      handlePostAuthRedirect(userStore);
    }, 1000);
  } catch (err) {
    console.error(err);
    uni.showToast({ title: err.message || '注册失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.register-page {
  min-height: 100vh;
  background: #F7FbF4;
  padding: calc(60rpx + env(safe-area-inset-top)) 48rpx 48rpx;
}

.register-header {
  text-align: center;
  margin-bottom: 64rpx;
}

.app-title {
  font-size: 52rpx;
  font-weight: 700;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}

.app-subtitle {
  font-size: 28rpx;
  color: #999;
}

.register-form {
  background: #fff;
  border-radius: 48rpx;
  padding: 48rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.04);
}

.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
  display: block;
}

.form-input {
  width: 100%;
  height: 88rpx;
  background: #F5F7FA;
  border-radius: 24rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.register-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #8DBB77;
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  margin-top: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
}

.login-link {
  text-align: center;
  margin-top: 32rpx;
}

.login-link text {
  font-size: 26rpx;
  color: #8DBB77;
}
</style>
