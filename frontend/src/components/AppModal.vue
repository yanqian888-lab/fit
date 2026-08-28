<template>
  <view class="app-modal" v-if="visible" @click.self="handleOverlayClick">
    <view class="modal-overlay" @click="handleOverlayClick"></view>
    <view class="modal-card" :class="[cardClass]">
      <!-- 标题区域（可带图标/小熊猫） -->
      <view v-if="!hideHeader" class="modal-header">
        <image
          v-if="icon === 'panda' && pandaIcon"
          class="modal-panda"
          :src="pandaIcon"
          mode="aspectFit"
        />
        <text v-if="title" class="modal-title">{{ title }}</text>
        <view v-if="$slots.header" class="modal-header-slot">
          <slot name="header" />
        </view>
      </view>

      <!-- 内容主体 -->
      <view class="modal-body">
        <!-- 优先使用默认插槽内容 -->
        <slot v-if="$slots.default" />
        <!-- 没有插槽时，使用 text 属性 -->
        <text v-else-if="text" class="modal-text" :class="{ center: textAlign === 'center' }">{{ text }}</text>
      </view>

      <!-- 按钮区域 -->
      <view v-if="!hideActions" class="modal-actions" :class="{ single: !showCancel }">
        <button
          v-if="showCancel"
          class="modal-btn cancel"
          :class="{ 'is-disabled': loading || disabled }"
          :disabled="loading || disabled"
          @click="handleCancel"
        >{{ cancelText }}</button>
        <button
          class="modal-btn confirm"
          :class="{ loading, danger: confirmDanger, 'is-disabled': loading || disabled }"
          :disabled="loading || disabled"
          @click="handleConfirm"
        >
          <text v-if="loading" class="btn-loading-dot"></text>
          {{ confirmText }}
        </button>
      </view>
      <view v-if="$slots.actions" class="modal-actions slot-actions">
        <slot name="actions" />
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 统一风格的确认/提示弹框组件
 * 替代原生 uni.showModal，融入治愈系 pastel 设计系统
 *
 * Props:
 *  - visible: 是否显示
 *  - title: 标题
 *  - text: 内容文字（无插槽时使用）
 *  - icon: 头部图标 'panda' | 'none'
 *  - confirmText: 确认按钮文字
 *  - cancelText: 取消按钮文字
 *  - showCancel: 是否显示取消按钮
 *  - confirmDanger: 确认按钮为危险色样式
 *  - loading: 确认按钮加载中
 *  - hideHeader: 隐藏标题栏
 *  - hideActions: 隐藏按钮栏（使用插槽）
 *  - closeOnOverlay: 点击遮罩关闭
 *  - textAlign: 内容文字对齐方式 'center' | 'left'
 *  - cardClass: 自定义卡片 class
 *  - pandaIcon: 自定义小熊猫图标路径
 *
 * Slots:
 *  - default: 自定义内容
 *  - header: 自定义头部
 *  - actions: 自定义底部按钮
 *
 * Events:
 *  - confirm: 点击确认
 *  - cancel: 点击取消/遮罩关闭
 *  - update:visible: 双向绑定显示状态
 */
import { computed } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  icon: { type: String, default: 'none' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  showCancel: { type: Boolean, default: true },
  confirmDanger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  hideHeader: { type: Boolean, default: false },
  hideActions: { type: Boolean, default: false },
  closeOnOverlay: { type: Boolean, default: false },
  textAlign: { type: String, default: 'center' },
  cardClass: { type: String, default: '' },
  pandaIcon: { type: String, default: '/static/image/icon/gongjvxiang01@3x.png' }
});

const emit = defineEmits(['confirm', 'cancel', 'update:visible']);

function handleConfirm() {
  if (props.loading) return;
  emit('confirm');
}
function handleCancel() {
  emit('cancel');
  emit('update:visible', false);
}
function handleOverlayClick() {
  if (props.closeOnOverlay) handleCancel();
}
</script>

<style lang="scss" scoped>
.app-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  box-sizing: border-box;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(51, 51, 51, 0.5);
  backdrop-filter: blur(4rpx);
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.88) translateY(16rpx);
  }
  70% { transform: scale(1.02) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 620rpx;
  background: #FFFFFF;
  border-radius: 40rpx;
  padding: 48rpx 40rpx 36rpx;
  box-sizing: border-box;
  box-shadow: 0 16rpx 48rpx rgba(86, 62, 34, 0.16);
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}

/* ============ 标题 ============ */
.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28rpx;
  position: relative;
}

.modal-header-slot {
  width: 100%;
}

.modal-panda {
  width: 108rpx;
  height: 108rpx;
  margin-bottom: 16rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #563E22;
  letter-spacing: 1rpx;
  line-height: 1.3;
  text-align: center;
}

/* ============ 内容 ============ */
.modal-body {
  margin-bottom: 40rpx;
  min-height: 40rpx;
}

.modal-text {
  display: block;
  font-size: 28rpx;
  color: #6B7280;
  line-height: 1.7;
}
.modal-text.center {
  text-align: center;
}

/* ============ 按钮区 ============ */
.modal-actions {
  display: flex;
  gap: 20rpx;
  align-items: center;
}
.modal-actions.single {
  gap: 0;
}
.modal-actions.single .modal-btn {
  flex: 1;
}
.modal-actions.slot-actions {
  margin-top: 8rpx;
}

.modal-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none !important;
  outline: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
}
.modal-btn::after { border: none; }
.modal-btn:active { transform: scale(0.97); }
.modal-btn.is-disabled { opacity: 0.6; }

.modal-btn.cancel {
  background: #F7FbF4;
  color: #6B7280;
  font-weight: 500;
}

.modal-btn.confirm {
  background: linear-gradient(135deg, #9BD085 0%, #8DBB77 100%);
  color: #FFFFFF;
  box-shadow: 0 8rpx 24rpx rgba(141, 187, 119, 0.3);
}

.modal-btn.confirm.danger {
  background: linear-gradient(135deg, #FFB5B5 0%, #FF8A8A 100%);
  box-shadow: 0 8rpx 24rpx rgba(255, 138, 138, 0.28);
}

.modal-btn.loading {
  pointer-events: none;
}

.btn-loading-dot {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.45);
  border-top-color: #FFFFFF;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
