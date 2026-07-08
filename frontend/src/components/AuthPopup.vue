<template>
  <view v-if="visible" class="auth-popup">
    <view class="auth-popup-overlay" @touchmove.stop.prevent></view>
    <view class="auth-popup-content">
      <text class="auth-popup-title">{{ config.title || '试用权限已用尽' }}</text>
      <text class="auth-popup-body">{{ config.content || '您的免费试用次数已使用完毕，如需继续使用该功能，可联系客服获取正式使用授权。' }}</text>

      <!-- 客服微信号：点击或长按复制 -->
      <view v-if="config.contact" class="auth-popup-contact-wrap">
        <text class="auth-popup-contact-label">客服微信号</text>
        <view
          class="auth-popup-contact-box"
          @click="copyContact(config.contact)"
          @longpress="copyContact(config.contact)"
        >
          <text class="auth-popup-contact-text">{{ config.contact }}</text>
          <text class="auth-popup-copy-tag">复制</text>
        </view>
        <text class="auth-popup-contact-hint">点击或长按上方微信号即可复制，前往微信添加客服</text>
      </view>

      <view class="auth-popup-actions">
        <button class="auth-popup-btn auth-popup-btn-secondary" @click="onCancel">
          {{ config.secondary_btn || '取消' }}
        </button>
        <button class="auth-popup-btn auth-popup-btn-primary" @click="onPrimary">
          {{ config.primary_btn || '联系客服获取授权' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { copyContact } from '../utils/trial.js';

const visible = ref(false);
const config = ref({});

function show(popupConfig) {
  config.value = popupConfig || {};
  visible.value = true;
}

function hide() {
  visible.value = false;
}

function onPrimary() {
  copyContact(config.value.contact);
  hide();
}

function onCancel() {
  hide();
}

defineExpose({ show, hide });
</script>

<style lang="scss" scoped>
.auth-popup {
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

.auth-popup-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
}

.auth-popup-content {
  position: relative;
  width: 560rpx;
  background: #fff;
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  text-align: center;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.12);
}

.auth-popup-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #27282D;
  margin-bottom: 24rpx;
}

.auth-popup-body {
  display: block;
  font-size: 28rpx;
  color: #666;
  line-height: 1.7;
  margin-bottom: 40rpx;
}

.auth-popup-contact-wrap {
  margin-bottom: 40rpx;
  text-align: left;
}

.auth-popup-contact-label {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.auth-popup-contact-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F7FbF4;
  border: 2rpx solid #E8F0E3;
  border-radius: 20rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 12rpx;
}

.auth-popup-contact-text {
  flex: 1;
  font-size: 32rpx;
  color: #27282D;
  font-weight: 600;
  word-break: break-all;
  padding-right: 16rpx;
}

.auth-popup-copy-tag {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #8DBB77;
  background: #fff;
  border-radius: 16rpx;
  padding: 6rpx 16rpx;
  border: 2rpx solid #8DBB77;
}

.auth-popup-contact-hint {
  display: block;
  font-size: 22rpx;
  color: #999;
  line-height: 1.5;
}

.auth-popup-actions {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.auth-popup-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 42rpx;
  font-size: 30rpx;
  font-weight: 500;
  text-align: center;
  border: none;
  outline: none;
  box-shadow: none;
}

.auth-popup-btn::after {
  border: none;
}

.auth-popup-btn-primary {
  background: #8DBB77;
  color: #fff;
}

.auth-popup-btn-secondary {
  background: #F5F7FA;
  color: #666;
  border: none;
}
</style>
