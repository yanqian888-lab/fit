<template>
  <view class="login-page">
    <!-- 介绍模块：icon + 应用名 + 介绍文案（替换原顶部 header + 账号密码登录框） -->
    <view class="intro-module">
      <view class="intro-logo">
        <!-- 三重兜底，总有一个能显示：
             1. 优先读 login-logo.png（你自己放的柴犬 logo，独立文件不影响其他页面）
             2. 失败 → 读 dada.png（项目自带搭搭虚拟形象）
             3. 还失败 → 显示瘦字方框（纯 view 不依赖图片，100% 不崩） -->
        <template v-if="!useDadaFallback && !useBoxFallback">
          <image
            class="logo-image"
            src="/static/image/icon/login-logo.png"
            mode="aspectFit"
            @error="onLogoErrorLogin"
          />
        </template>
        <template v-else-if="useDadaFallback && !useBoxFallback">
          <image
            class="logo-image"
            src="/static/image/icon/dada.png"
            mode="aspectFit"
            @error="onLogoErrorDada"
          />
        </template>
        <template v-else>
          <view class="logo-fallback-box">
            <text class="logo-text">瘦</text>
          </view>
        </template>
      </view>
      <text class="intro-app-name">掉秤搭搭</text>
      <text class="intro-app-subtitle">你的虚拟减脂伙伴"搭搭"，陪你健康减脂，追赶目标</text>

      <view class="intro-features">
        <view class="feature-item">
          <view class="feature-icon">
            <text class="feature-icon-text">✓</text>
          </view>
          <view class="feature-content">
            <text class="feature-title">对话即记录</text>
            <text class="feature-desc">AI 智能沉淀，零负担记录</text>
          </view>
        </view>
        <view class="feature-item">
          <view class="feature-icon">
            <text class="feature-icon-text">✓</text>
          </view>
          <view class="feature-content">
            <text class="feature-title">游戏化激励闭环</text>
            <text class="feature-desc">喂食、互动、事件，让坚持上瘾</text>
          </view>
        </view>
        <view class="feature-item">
          <view class="feature-icon">
            <text class="feature-icon-text">✓</text>
          </view>
          <view class="feature-content">
            <text class="feature-title">科学营养引擎</text>
            <text class="feature-desc">智能计算热量，严格监督进食</text>
          </view>
        </view>
        <view class="feature-item">
          <view class="feature-icon">
            <text class="feature-icon-text">✓</text>
          </view>
          <view class="feature-content">
            <text class="feature-title">伙伴运动跟练</text>
            <text class="feature-desc">从"不想动"到"一起动"无缝衔接</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 账号密码登录：小程序端隐藏，仅保留微信登录 -->
    <!-- #ifndef MP-WEIXIN -->
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
        <view class="password-wrap">
          <input
            v-model="accountForm.password"
            class="form-input password-input"
            :password="!showPassword"
            placeholder="请输入6-12位数字+字母密码"
            maxlength="12"
          />
          <view class="eye-toggle" @click="showPassword = !showPassword">
            <image v-if="showPassword" class="eye-icon" src="/static/image/icon/eye_open.svg" mode="aspectFit" />
            <image v-else class="eye-icon" src="/static/image/icon/eye_close.svg" mode="aspectFit" />
          </view>
        </view>
      </view>
      <button class="login-btn" @click="accountLogin">登录</button>
      <view class="register-link" @click="goToRegister">
        <text>还没有账号？去注册</text>
      </view>

      <!-- 微信一键登录（仅小程序端展示，App/H5 已下架微信登录） -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="wechat-login-wrap">
        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">或</text>
          <view class="divider-line"></view>
        </view>
        <button class="wechat-login-btn" @click="wechatLogin">
          <text class="wechat-icon">💬</text>
          <text>微信一键登录</text>
        </button>
      </view>
      <!-- #endif -->
    </view>
    <!-- #endif -->

    <!-- 绑定手机号弹窗（微信登录后未绑定手机号时弹出） -->
    <view v-if="showBindPhone" class="panel-overlay show" @click="closeBindPhone"></view>
    <!-- 关键：用 v-if 确保弹窗完全从 DOM 中移除，避免原生 button 组件拦截点击事件 -->
    <view v-if="showBindPhone" class="bind-panel show">
      <view class="panel-header">
        <text class="panel-title">绑定手机号</text>
        <text class="panel-close" @click="closeBindPhone">✕</text>
      </view>
      <view class="panel-body">
        <text class="bind-tip">为了保障您的账号安全，请用微信授权绑定手机号</text>
        <!-- #ifdef MP-WEIXIN -->
        <button
          class="bind-phone-btn"
          open-type="getPhoneNumber"
          @getphonenumber="onGetPhoneNumber"
        >微信授权绑定</button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
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
        <button class="btn-save" @click="confirmBindPhoneManual">确认绑定</button>
        <!-- #endif -->
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <view class="panel-actions">
        <button class="btn-cancel" @click="closeBindPhone">取消</button>
      </view>
      <!-- #endif -->
    </view>

    <!-- 底部区域：微信登录按钮 + 隐私勾选框（一组，贴屏幕底部） -->
    <view class="bottom-area">
      <!-- 微信账号登录入口（仅小程序端显示，且唯一登录入口） -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="wechat-login-wrap">
        <!-- 用 view 而非原生 button：规避原生组件在部分基础库上的手势吞没问题 -->
        <view
          class="wechat-login-btn"
          :class="{ 'btn-disabled': !privacyAgreed }"
          hover-class="wechat-login-btn-hover"
          @tap="onWechatLoginClick"
        >
          <text>微信账号登录</text>
        </view>
      </view>
      <!-- #endif -->

      <!-- 隐私协议勾选框（使用小程序原生 checkbox-group，解决自定义 view 无法点击的问题） -->
      <view class="privacy-agree-bar">
        <checkbox-group class="privacy-checkbox-group" @change="onPrivacyChange">
          <label class="checkbox-label">
            <checkbox
              class="privacy-checkbox"
              value="agree"
              :checked="privacyAgreed"
              color="#8DBB77"
            />
          </label>
        </checkbox-group>
        <!-- 点文字也能切换勾选，链接除外 -->
        <text class="agree-text" @tap="togglePrivacy">
          我已阅读并同意
          <text class="link" @tap.stop="openAgreement">《用户协议》</text>
          和
          <text class="link" @tap.stop="openPrivacy">《隐私政策》</text>
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { authApi } from '../../api';
import { useUserStore } from '../../store';
import { getDeviceId } from '../../utils/trial.js';
import { handlePostAuthRedirect } from '../../utils/authRedirect';

const userStore = useUserStore();
const isFromSetup = ref(false);

const showBindPhone = ref(false);
const bindPhone = ref('');
// 微信 wx.login 返回的 code，绑定手机号失败重试时复用
const wechatLoginCode = ref('');

// 账号密码登录表单（H5/App 端）
const accountForm = ref({ username: '', password: '' });
const showPassword = ref(false);

/**
 * 登录页展示时如果已经登录，直接跳走（避免用户手动回到 login 页看到已登录却没跳转）
 */
function redirectIfLoggedIn() {
  if (userStore.isLoggedIn) {
    console.log('[登录页] 检测到已登录状态，直接跳转主页');
    handlePostAuthRedirect(userStore).catch(err => {
      console.warn('[登录页] 跳转失败，直接 switchTab 到首页:', err?.message || err);
      uni.switchTab({ url: '/pages/index/index' });
    });
  }
}

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (currentPage && currentPage.options && currentPage.options.from === 'setup') {
    isFromSetup.value = true;
  }
  // 页面初始化时检查一次（避免 App.vue 初始化失败却已登录）
  setTimeout(redirectIfLoggedIn, 200);
});

/**
 * 每次回到登录页，都重新判断：如果后台已经 restore userInfo，则跳走
 */
onShow(() => {
  redirectIfLoggedIn();
});

/**
 * logo 三重兜底开关
 * 1. 默认：优先加载 login-logo.png（用户自己放的柴犬图）
 * 2. useDadaFallback=true → login-logo.png 加载失败，用项目自带的 dada.png
 * 3. useBoxFallback=true  → 两个图都加载失败，用瘦字方框兜底（100% 不崩）
 */
const useDadaFallback = ref(false);
const useBoxFallback = ref(false);

/**
 * login-logo.png 加载失败回调
 * 下一档：用项目自带的 dada.png 当 logo
 */
function onLogoErrorLogin() {
  useDadaFallback.value = true;
}

/**
 * dada.png 也加载失败回调
 * 最后一档：显示薄荷绿「瘦」字方框，绝不让页面空
 */
function onLogoErrorDada() {
  useBoxFallback.value = true;
}

/**
 * 隐私协议勾选状态（默认未勾选，点两次登录按钮之间不会记忆）
 * 登录页合并了原来的独立隐私弹窗：未勾选时任何登录按钮都会先提示
 */
const privacyAgreed = ref(false);

/**
 * 写入「用户已同意隐私协议」本地标记
 * 1. 隐私政策版本号固定 1.0.0（与 PrivacyModal 兜底版本一致，将来后台配置版本号时同步改）
 * 2. 记录同意的时间戳，将来后台强制更新时可以比对
 */
function markPrivacyAgreed() {
  uni.setStorageSync('privacy_agreed', true);
  uni.setStorageSync('privacy_agreed_version', '1.0.0');
  uni.setStorageSync('privacy_agreed_at', Date.now());
}

/**
 * 小程序原生 checkbox-group 勾选变化回调（解决自定义 view 无法点击的问题）
 * @param {*} e 小程序原生 checkbox-group change 事件：e.detail.value = [选中的 checkbox 的 value]
 */
function onPrivacyChange(e) {
  const values = e?.detail?.value || [];
  privacyAgreed.value = values.includes('agree');
}

// 点文字区域也可切换勾选（原生 checkbox 点击区域太小）
function togglePrivacy() {
  privacyAgreed.value = !privacyAgreed.value;
}

/**
 * 打开用户协议详情页（小程序原生页，提审合规）
 */
function openAgreement() {
  uni.navigateTo({ url: '/pages/user/agreement' });
}

/**
 * 打开隐私政策详情页（小程序原生页，提审合规）
 */
function openPrivacy() {
  uni.navigateTo({ url: '/pages/user/privacy' });
}

/**
 * 前置校验：登录按钮点击前必须先勾选隐私协议
 * @returns {boolean} true = 校验通过，可以继续登录流程
 */
function checkPrivacyBeforeLogin() {
  if (!privacyAgreed.value) {
    uni.showToast({
      title: '请先阅读并同意用户协议和隐私政策',
      icon: 'none',
      duration: 1800
    });
    return false;
  }
  markPrivacyAgreed();
  return true;
}

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
const PASSWORD_REGEX = /^[a-zA-Z0-9]{6,12}$/;
function validatePassword(password) {
  return PASSWORD_REGEX.test(password) && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

// 账号密码登录
async function accountLogin() {
  if (!checkPrivacyBeforeLogin()) {
    return;
  }
  const { username, password } = accountForm.value;

  if (!USERNAME_REGEX.test(username || '')) {
    uni.showToast({ title: '请输入6-10位字母+数字账号', icon: 'none' });
    return;
  }
  if (!validatePassword(password)) {
    uni.showToast({ title: '请输入6-12位数字+字母密码', icon: 'none' });
    return;
  }

  try {
    const res = await authApi.login({ username, password, device_id: getDeviceId() });
    userStore.login(res.data.token, res.data.user);
    // 沉睡标记随本次登录落盘（fetchUserInfo 会覆盖 userInfo，last_login_at 登录后已刷新，无法用其判断沉睡）
    uni.setStorageSync('stale_returning', res.data.stale_returning ? 1 : '');

    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      handlePostAuthRedirect(userStore);
    }, 1000);
  } catch (err) {
    uni.showToast({ title: err.message || '登录失败', icon: 'none' });
  }
}

/**
 * 带超时的 Promise 包装：任何一步挂起都要在限定时间内给出可见反馈
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}超时，请检查网络后重试`)), ms))
  ]);
}

/**
 * 点击「微信账号登录」按钮
 * open-type="getUserInfo" 会同时拉起用户信息授权，
 * 但登录主体仍是 wx.login() + 后端 code2session
 */
async function onWechatLoginClick() {
  console.log('[登录] 微信登录按钮被点击');

  if (!checkPrivacyBeforeLogin()) {
    console.log('[登录] 隐私协议未勾选，拦截登录');
    return;
  }

  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '登录中...', mask: true });
  try {
    console.log('[登录] 开始 wx.login()');
    const loginRes = await withTimeout(uni.login({ provider: 'weixin' }), 10000, '微信授权');
    console.log('[登录] wx.login 成功，code:', loginRes.code);
    wechatLoginCode.value = loginRes.code;

    console.log('[登录] 调用后端 /auth/wechat-login');
    const res = await withTimeout(
      authApi.wechatLogin({ code: loginRes.code, device_id: getDeviceId() }),
      10000,
      '登录请求'
    );
    console.log('[登录] 后端返回:', res.data);
    uni.hideLoading();

    if (res.data.need_bind_phone) {
      console.log('[登录] 需要绑定手机号');
      userStore.login(res.data.token, res.data.user);
      uni.setStorageSync('stale_returning', res.data.stale_returning ? 1 : '');
      showBindPhone.value = true;
    } else {
      console.log('[登录] 登录成功，跳转主页');
      userStore.login(res.data.token, res.data.user);
      uni.setStorageSync('stale_returning', res.data.stale_returning ? 1 : '');
      uni.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        handlePostAuthRedirect(userStore);
      }, 1000);
    }
  } catch (err) {
    console.error('[登录] 登录失败:', err);
    uni.hideLoading();
    // 保证任何失败都有可见提示（err 可能是字符串/空对象）
    const msg = (err && err.message) ? String(err.message) : '微信登录失败，请重试';
    uni.showToast({ title: msg.slice(0, 30) || '微信登录失败，请重试', icon: 'none' });
  }
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '微信登录仅支持小程序端', icon: 'none' });
  // #endif
}

/**
 * 微信原生 getPhoneNumber 回调
 * e.detail.code 为手机号授权 code，发送到后端换真实手机号
 */
async function onGetPhoneNumber(e) {
  if (!e.detail || e.detail.errMsg !== 'getPhoneNumber:ok') {
    uni.showToast({ title: '已取消授权', icon: 'none' });
    return;
  }
  const phoneCode = e.detail.code;
  try {
    uni.showLoading({ title: '绑定中...', mask: true });
    const res = await authApi.wechatBindPhone({ phone_code: phoneCode, device_id: getDeviceId() });
    uni.hideLoading();

    // 更新本地 user 信息
    if (userStore.userInfo) {
      userStore.userInfo.phone = res.data.user.phone;
    }
    closeBindPhone();

    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      handlePostAuthRedirect(userStore);
    }, 1000);
  } catch (err) {
    uni.hideLoading();
    uni.showToast({ title: err.message || '绑定失败', icon: 'none' });
  }
}

/**
 * 非小程序端的兜底绑定（手输手机号，后端目前仅支持微信授权，此分支仅用于占位）
 */
async function confirmBindPhoneManual() {
  if (!bindPhone.value || bindPhone.value.length !== 11) {
    uni.showToast({ title: '请输入11位手机号', icon: 'none' });
    return;
  }
  uni.showToast({ title: '请在小程序端用微信授权绑定手机号', icon: 'none' });
}

// 关闭绑定手机号弹窗
function closeBindPhone() {
  showBindPhone.value = false;
  bindPhone.value = '';
}
</script>

<style lang="scss" scoped>
.login-page {
  height: 100vh;
  background: #F7FbF4;
  padding: calc(48rpx + env(safe-area-inset-top)) 48rpx calc(48rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* ========== 介绍模块（收紧白底，自适应内容大小，垂直居中） ========== */
.intro-module {
  width: 100%;
  background: #fff;
  border-radius: 56rpx;
  padding: 56rpx 48rpx 48rpx;
  box-shadow: 0 12rpx 48rpx rgba(141, 187, 119, 0.08);
  border: 2rpx solid rgba(141, 187, 119, 0.06);
  display: flex;
  flex-direction: column;
  margin: auto 0;
}

.intro-logo {
  width: 200rpx;
  height: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 32rpx;
  filter: drop-shadow(0 8rpx 20rpx rgba(141, 187, 119, 0.18));
}

.logo-image {
  width: 100%;
  height: 100%;
}

/* logo 加载失败兜底：薄荷绿「瘦」字方框，跟 splash 页一致 */
.logo-fallback-box {
  width: 180rpx;
  height: 180rpx;
  border-radius: 48rpx;
  background: #8DBB77;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 40rpx rgba(141, 187, 119, 0.3);
}

.logo-text {
  font-size: 80rpx;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.intro-app-name {
  display: block;
  text-align: center;
  font-size: 46rpx;
  font-weight: 800;
  color: #1F2937;
  margin-bottom: 20rpx;
  letter-spacing: 2rpx;
}

.intro-app-subtitle {
  display: block;
  text-align: center;
  font-size: 28rpx;
  color: #4B5563;
  line-height: 1.7;
  padding: 0 24rpx;
  margin-bottom: 40rpx;
}

.intro-features {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 22rpx;
}

.feature-icon {
  margin-top: 6rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 10rpx;
  background: #E8F5E0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2rpx 6rpx rgba(141, 187, 119, 0.12);
}

.feature-icon-text {
  font-size: 22rpx;
  color: #5A8A47;
  font-weight: 800;
  line-height: 22rpx;
}

.feature-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.feature-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1F2937;
  line-height: 1.5;
}

.feature-desc {
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.6;
}

/* ========== 底部区域：登录按钮 + 隐私勾选（贴屏幕底部） ========== */
.bottom-area {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

/* ========== 旧登录表单、头部（仅 H5/非小程序端可见） ========== */
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

.password-wrap {
  position: relative;
}

.password-input {
  padding-right: 88rpx;
}

.eye-toggle {
  position: absolute;
  right: 0;
  top: 0;
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eye-icon {
  width: 36rpx;
  height: 36rpx;
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

/* ========== 微信登录按钮（用 view 替代 button，小程序点击更可靠） ========== */
.wechat-login-wrap {
  width: 100%;
}

.wechat-login-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #07C160;
  color: #fff;
  border-radius: 48rpx;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  box-shadow: 0 8rpx 28rpx rgba(7, 193, 96, 0.3);
  transition: transform 0.1s ease;
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  text-align: center;
}

.wechat-login-btn::after {
  border: none;
}

/* 未勾选协议：浅绿禁用态（仍可点击，点击弹出协议提示） */
.wechat-login-btn.btn-disabled {
  background: #B7E4C7;
  box-shadow: none;
  color: rgba(255, 255, 255, 0.9);
}

.wechat-login-btn-hover {
  transform: scale(0.97);
  opacity: 0.9;
}
.wechat-icon {
  width: 40rpx;
  height: 40rpx;
}
.wechat-icon-text {
  font-size: 34rpx;
  line-height: 1;
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
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.12);
}

/* 由于使用 v-if，不再需要 .bind-panel.show 控制显示 */

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

.bind-phone-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #07C160;
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.bind-phone-btn::after {
  border: none;
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

/* ========== 隐私协议勾选框（小程序原生 checkbox-group，解决无法点击） ========== */
.privacy-agree-bar {
  display: flex;
  align-items: center; /* 勾选框和文字垂直居中 */
  justify-content: center;
  gap: 14rpx;
  padding: 0 8rpx;
}

.privacy-checkbox-group {
  flex-shrink: 0;
  margin-top: 0; /* 去掉原来的 4rpx，因为已经垂直居中了 */
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 小尺寸原生 checkbox，刚好跟文字大小匹配 */
.privacy-checkbox {
  transform: scale(0.95);
}

.agree-text {
  flex: 1;
  font-size: 24rpx;
  color: #6B7280;
  line-height: 1.5;
}

.agree-text .link {
  color: #8DBB77;
  font-weight: 500;
}
</style>
