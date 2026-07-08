<template>
  <view class="privacy-modal" v-if="visible">
    <view class="modal-overlay"></view>
    <view class="modal-content">
      <view class="modal-header">
        <text class="modal-title">隐私政策与用户协议</text>
      </view>
      <view class="modal-body">
        <text class="modal-text">
          欢迎使用减肥搭子！在使用本应用前，请您仔细阅读并同意我们的
          <text class="link" @click="openAgreement">《用户协议》</text>
          和
          <text class="link" @click="openPrivacy">《隐私政策》</text>
          。我们将严格保护您的个人信息安全，仅用于提供减肥记录、AI 陪伴等服务。
        </text>
      </view>
      <view class="modal-actions">
        <button class="btn-reject" @click="reject">不同意并退出</button>
        <button class="btn-agree" @click="agree">同意</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { configApi } from '../api';

const visible = ref(false);
const config = ref({});
const emit = defineEmits(['agreed', 'rejected']);

onMounted(() => {
  // 组件挂载时自动加载配置并判断是否需要展示
  check();
});

async function loadConfig() {
  try {
    const res = await configApi.getAppConfig();
    config.value = res.data || {};
  } catch (err) {
    console.error('获取协议配置失败:', err);
    config.value = { privacy_version: '1.0.0', force_privacy_update: false };
  }
}

async function check() {
  await loadConfig();

  const currentVersion = config.value.privacy_version || '1.0.0';
  const forceUpdate = config.value.force_privacy_update === true || config.value.force_privacy_update === 'true' || config.value.force_privacy_update === '1';
  let acceptedVersion = uni.getStorageSync('privacy_agreed_version');
  // 兼容旧版：曾经点击过“同意”但没有版本号的用户，默认视为同意 1.0.0 版本
  if (!acceptedVersion && uni.getStorageSync('privacy_agreed')) {
    acceptedVersion = '1.0.0';
  }

  // 强制更新开关打开时，无论本地是否同意过都重新弹窗
  if (forceUpdate) {
    visible.value = true;
    return true;
  }

  // 未同意过，或版本号不一致时展示
  if (!acceptedVersion || acceptedVersion !== currentVersion) {
    visible.value = true;
    return true;
  }

  visible.value = false;
  return false;
}

function agree() {
  const currentVersion = config.value.privacy_version || '1.0.0';
  uni.setStorageSync('privacy_agreed_version', currentVersion);
  uni.setStorageSync('privacy_agreed_at', Date.now());
  visible.value = false;
  emit('agreed');
}

function reject() {
  uni.showModal({
    title: '提示',
    content: '不同意隐私政策和用户协议将无法使用本应用，是否退出？',
    confirmText: '退出',
    cancelText: '再想想',
    success: (res) => {
      if (res.confirm) {
        emit('rejected');
        exitApp();
      }
    }
  });
}

function exitApp() {
  // #ifdef APP-PLUS
  plus.runtime.quit();
  // #endif
  // #ifdef H5
  // H5 无法强制关闭标签页，清空本地授权并跳转到空白提示页
  uni.removeStorageSync('privacy_agreed_version');
  window.location.replace('about:blank');
  // #endif
  // #ifdef MP-WEIXIN
  uni.reLaunch({ url: '/pages/blank/index' });
  // #endif
}

function openAgreement() {
  uni.navigateTo({ url: '/pages/user/agreement' });
}

function openPrivacy() {
  uni.navigateTo({ url: '/pages/user/privacy' });
}

// 暴露方法给父组件
function show() {
  visible.value = true;
}

function hide() {
  visible.value = false;
}

defineExpose({ check, show, hide, loadConfig });
</script>

<style lang="scss" scoped>
.privacy-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  width: 80%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 32rpx;
  padding: 48rpx;
  z-index: 1;
}

.modal-header {
  text-align: center;
  margin-bottom: 32rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.modal-body {
  margin-bottom: 32rpx;
}

.modal-text {
  display: block;
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.link {
  color: #8DBB77;
  text-decoration: underline;
}

.modal-actions {
  display: flex;
  gap: 24rpx;
}

.btn-reject,
.btn-agree {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  text-align: center;
  border: none;
}

.btn-reject {
  background: #F5F7FA;
  color: #999;
  border: 0 !important;
  outline: none;
}
.btn-reject::after {
  border: none;
}

.btn-agree {
  background: #8DBB77;
  color: #fff;
  box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
}
.btn-agree::after {
  border: none;
}
</style>
