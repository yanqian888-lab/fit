<template>
  <view class="privacy-modal" v-if="visible">
    <view class="modal-overlay"></view>
    <view class="modal-content">
      <view class="modal-header">
        <text class="modal-title">隐私政策与用户协议</text>
      </view>
      <view class="modal-body">
        <text class="modal-text">
          欢迎使用掉秤搭搭！在使用本应用前，请您仔细阅读并同意我们的
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

    <!-- 退出二次确认弹框 -->
    <AppModal
      v-model:visible="showRejectConfirm"
      icon="none"
      title="提示"
      text="不同意隐私政策和用户协议将无法使用本应用，是否退出？"
      confirmText="退出"
      confirmDanger
      cancelText="再想想"
      @confirm="confirmRejectExit"
    />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { configApi } from '../api';
import AppModal from './AppModal.vue';

const visible = ref(false);
const config = ref({});
// 拒绝协议退出二次确认
const showRejectConfirm = ref(false);
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

  // 小程序端不再处理原生隐私弹窗（微信在启动期已通过《小程序隐私保护指引》弹窗获得同意）

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
  showRejectConfirm.value = true;
}

/**
 * 确认执行退出 App
 */
function confirmRejectExit() {
  showRejectConfirm.value = false;
  emit('rejected');
  exitApp();
}

/**
 * 用户拒绝隐私协议时退出到空白页
 * 小程序端：仅保留 reLaunch 到空白页，不触发 APP/H5 的退出逻辑
 */
function exitApp() {
  uni.reLaunch({ url: '/pages/blank/index' });
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
