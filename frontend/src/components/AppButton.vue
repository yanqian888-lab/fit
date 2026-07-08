.app-button.disabled,
.app-button[disabled] {
  background: $gray-200 !important;
  color: $text-tertiary !important;
  box-shadow: none !important;
  opacity: 0.7;
  cursor: not-allowed;
}

.app-button.disabled:active,
.app-button[disabled]:active {
  transform: none;
}<template>
  <button class="app-button" :class="[type, size, { block, disabled: disabled || loading }]" :disabled="disabled || loading" @click="onClick">
    <image v-if="loading" class="btn-loading" src="/static/image/icon/loading01.svg" mode="aspectFit" />
    <slot></slot>
  </button>
</template>

<script setup>
const props = defineProps({
  type: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['click']);

function onClick() {
  if (!props.disabled && !props.loading) {
    emit('click');
  }
}
</script>

<style lang="scss" scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-pill;
  font-weight: $font-medium;
  transition: transform 0.2s ease;
  border: none;
  opacity: 1;
}

.app-button::after {
  border: none;
}

.app-button:active {
  transform: scale(0.98);
}

.app-button.primary {
  background: #8DBB77;
  color: #FFFFFF;
  opacity: 1;
  box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
}

.app-button.secondary {
  background: #F7FbF4;
  color: #8DBB77;
  opacity: 1;
  box-shadow: $shadow-soft;
}

.app-button.cream {
  background: $cream;
  color: $text-primary;
  box-shadow: 0 4rpx 20rpx rgba(255, 243, 176, 0.4);
}

.app-button.ghost {
  background: $white;
  color: #8DBB77;
  box-shadow: $shadow-card;
}

.app-button.danger {
  background: $danger-bg;
  color: #E57373;
}

.app-button.confirm-light {
  background: #CEE9BE;
  color: #27282D;
  box-shadow: none;
}

.app-button.cancel-gray {
  background: #EEEEEE;
  color: #666666;
  box-shadow: none;
}

.app-button.md {
  padding: 18rpx 48rpx;
  font-size: $text-base;
}

.app-button.sm {
  padding: 12rpx 32rpx;
  font-size: $text-sm;
}

.app-button.lg {
  padding: 24rpx 64rpx;
  font-size: $text-lg;
}

.app-button.block {
  width: 100%;
}

.btn-loading {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
  animation: btn-spin 1s linear infinite;
}

@keyframes btn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.app-button.disabled,
.app-button[disabled] {
  background: #E0E0E0 !important;
  color: #999 !important;
  box-shadow: none !important;
  opacity: 0.8;
}

.app-button.disabled:active,
.app-button[disabled]:active {
  transform: none;
}
</style>
