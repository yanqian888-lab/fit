<template>
  <view class="login-page">
    <view class="login-header">
      <text class="app-title">减肥搭子</text>
      <text class="app-subtitle">你的专属减肥伙伴</text>
    </view>

    <!-- 账号密码登录 -->
    <view class="login-form">
      <view class="form-item">
        <text class="form-label">账号</text>
        <input
          v-model="accountForm.username"
          class="form-input"
          type="text"
          placeholder="请输入6-10位字母+数字账号"
          maxlength="10"
        />
      </view>
      <view class="form-item">
        <text class="form-label">密码</text>
        <input
          v-model="accountForm.password"
          class="form-input"
          type="password"
          placeholder="请输入6位密码"
          maxlength="6"
        />
      </view>
      <button class="login-btn" @click="accountLogin">登录</button>
      <view class="register-link" @click="goToRegister">
        <text>还没有账号？去注册</text>
      </view>
    </view>

    <!-- 手机号绑定弹窗（微信登录后，当前隐藏） -->
    <view v-if="showBindPhone" class="panel-overlay show" @click="closeBindPhone"></view>
    <view class="bind-panel" :class="{ show: showBindPhone }">
      <view class="panel-header">
        <text class="panel-title">绑定手机号</text>
        <text class="panel-close" @click="closeBindPhone">✕</text>
      </view>
      <view class="panel-body">
        <text class="bind-tip">为了保障您的账号安全，请绑定手机号</text>
        <view class="form-item">
          <text class="form-label">手机号</text>
          <input
            v-model="bindPhone"
            class="form-input"
            type="number"
            placeholder="请输入手机号"
            maxlength="11"
          />
        </view>
      </view>
      <view class="panel-actions">
        <button class="btn-cancel" @click="closeBindPhone">取消</button>
        <button class="btn-save" @click="confirmBindPhone">确认绑定</button>
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

const loginType = ref('account');
const showBindPhone = ref(false);
const bindPhone = ref('');
const wechatCode = ref('');

const accountForm = ref({
  username: '',
  password: ''
});

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (currentPage && currentPage.options && currentPage.options.from === 'setup') {
    isFromSetup.value = true;
  }
});

function goToRegister() {
  uni.navigateTo({ url: '/pages/register/index?from=setup' });
}

const USERNAME_REGEX = /^[a-zA-Z0-9]{6,10}$/;

// 账号密码登录
async function accountLogin() {
  const { username, password } = accountForm.value;
  
  if (!USERNAME_REGEX.test(username || '')) {
    uni.showToast({ title: '请输入6-10位字母+数字账号', icon: 'none' });
    return;
  }
  if (!password || password.length !== 6) {
    uni.showToast({ title: '请输入6位密码', icon: 'none' });
    return;
  }

  try {
    const res = await authApi.login({ username, password, device_id: getDeviceId() });
    userStore.login(res.data.token, res.data.user);

    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      handlePostAuthRedirect(userStore);
    }, 1000);
  } catch (err) {
    uni.showToast({ title: err.message || '登录失败', icon: 'none' });
  }
}

// 微信登录
async function wechatLogin() {
  try {
    // 调用微信登录获取 code
    const loginRes = await uni.login({ provider: 'weixin' });
    wechatCode.value = loginRes.code;
    
    // 发送 code 到后端
    const res = await authApi.wechatLogin({ code: loginRes.code, device_id: getDeviceId() });
    
    if (res.data.need_bind_phone) {
      // 需要绑定手机号
      showBindPhone.value = true;
    } else {
      // 已绑定手机号，直接登录
      userStore.login(res.data.token, res.data.user);

      uni.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        handlePostAuthRedirect(userStore);
      }, 1000);
    }
  } catch (err) {
    uni.showToast({ title: '微信登录失败', icon: 'none' });
  }
}

// 关闭绑定手机号弹窗
function closeBindPhone() {
  showBindPhone.value = false;
  bindPhone.value = '';
}

// 确认绑定手机号
async function confirmBindPhone() {
  if (!bindPhone.value || bindPhone.value.length !== 11) {
    uni.showToast({ title: '请输入11位手机号', icon: 'none' });
    return;
  }

  try {
    const res = await authApi.wechatBindPhone({
      code: wechatCode.value,
      phone: bindPhone.value,
      device_id: getDeviceId()
    });
    userStore.login(res.data.token, res.data.user);
    closeBindPhone();

    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      handlePostAuthRedirect(userStore);
    }, 1000);
  } catch (err) {
    uni.showToast({ title: err.message || '绑定失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: #F7FbF4;
  padding: calc(60rpx + env(safe-area-inset-top)) 48rpx 48rpx;
}

.login-header {
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

.login-form {
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

.login-btn {
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

.register-link {
  text-align: center;
  margin-top: 32rpx;
}

.register-link text {
  font-size: 26rpx;
  color: #8DBB77;
}

/* 绑定手机号弹窗 */
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1999;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.panel-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.bind-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  border-radius: 64rpx 64rpx 0 0;
  padding: 48rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  z-index: 2000;
  transform: translateY(100%);
  transition: transform 0.3s ease;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.12);
}
.bind-panel.show {
  transform: translateY(0);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.panel-close {
  font-size: 36rpx;
  color: #9CA3AF;
  padding: 8rpx;
}

.panel-body {
  margin-bottom: 32rpx;
}

.bind-tip {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 32rpx;
  display: block;
}

.panel-actions {
  display: flex;
  gap: 32rpx;
}

.btn-cancel,
.btn-save {
  flex: 1;
  height: 80rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.btn-cancel {
  background: #F5F7FA;
  color: #666;
}

.btn-save {
  background: #8DBB77;
  color: #fff;
  box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
}
</style>
