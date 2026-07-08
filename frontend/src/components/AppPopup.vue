<template>
  <view v-if="visible" class="popup-root" @click="onMaskClick">
    <!-- 居中弹窗：全屏蒙层 -->
    <view v-if="popup.style === 'center'" class="popup-center-mask">
      <view class="popup-center-panel" @click.stop>
        <image
          v-if="!imageError"
          class="popup-center-image"
          :src="popup.image_url"
          mode="aspectFit"
          @error="onImageError"
          @click="onContentClick"
        />
        <view v-else class="popup-image-fallback" @click="onContentClick">
          <text>图片加载失败</text>
        </view>
        <view v-if="popup.show_close_button !== false" class="popup-close-btn" @click="onCloseClick">×</view>
      </view>
    </view>

    <!-- 顶部弹窗：悬浮无蒙层 -->
    <view
      v-else-if="popup.style === 'top'"
      class="popup-top-panel"
      @click.stop="onContentClick"
      @touchstart="touchStart"
      @touchend="touchEnd"
    >
      <image
        v-if="!imageError"
        class="popup-top-image"
        :src="popup.image_url"
        mode="widthFix"
        @error="onImageError"
      />
      <view v-else class="popup-image-fallback popup-top-fallback" @click="onContentClick">
        <text>图片加载失败</text>
      </view>
      <view v-if="popup.show_close_button !== false" class="popup-top-close" @click.stop="onCloseClick">×</view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import popupManager from '@/utils/popupManager';

const visible = ref(false);
const popup = ref({});
const page = ref('');
const trigger = ref('');
const imageError = ref(false);

let touchY = 0;

function show({ popup: p, page: pg, trigger: t }) {
  console.log('[AppPopup] show', p?.id, p?.name, pg, t);
  popup.value = p || {};
  page.value = pg || '';
  trigger.value = t || '';
  imageError.value = false;
  visible.value = true;
  // 真正渲染到 UI 后再计数，防止 init 阶段事件丢失导致后续被启动防重拦截
  popupManager.markShown(popup.value, page.value, trigger.value);
}

function hide(reason = '') {
  console.log('[AppPopup] hide', reason);
  visible.value = false;
  popup.value = {};
}

function onImageError(e) {
  console.error('[AppPopup] image error', popup.value.image_url, e);
  imageError.value = true;
}

function close(way) {
  if (!visible.value) return;
  popupManager.onClose(way);
  hide();
}

function onCloseClick() {
  close('close_btn');
}

function onMaskClick() {
  if (popup.value.style === 'center' && popup.value.mask_closeable !== false) {
    close('mask');
  }
}

function onContentClick() {
  if (!visible.value) return;
  if (popup.value.jump_type && popup.value.jump_type !== 'none') {
    popupManager.onClick(popup.value, page.value, trigger.value);
    popupManager.navigate(popup.value);
    hide();
  }
}

function touchStart(e) {
  touchY = e.changedTouches[0]?.clientY || 0;
}

function touchEnd(e) {
  const y = e.changedTouches[0]?.clientY || 0;
  if (y - touchY > 60) {
    close('swipe');
  }
}

onMounted(() => {
  uni.$on('popup:show', show);
  uni.$on('popup:hide', hide);
  // 组件就绪后主动检查一次，防止 init 阶段事件已发出但监听未注册
  popupManager.checkShow({ trigger: 'immediate' });
  popupManager.checkShow({ trigger: 'duration' });
});

onUnmounted(() => {
  uni.$off('popup:show', show);
  uni.$off('popup:hide', hide);
})

console.log('[AppPopup] mounted');;
</script>

<style scoped>
.popup-root {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  pointer-events: none;
}
.popup-center-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.popup-center-panel {
  position: relative;
  width: 78vw;
  max-width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}
.popup-center-image {
  width: 100%;
  height: 720rpx;
  display: block;
}
.popup-close-btn {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 48rpx;
  height: 48rpx;
  line-height: 44rpx;
  text-align: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 36rpx;
  z-index: 10;
}
.popup-top-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: auto;
  background: #fff;
  border-radius: 0 0 24rpx 24rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}
.popup-top-image {
  width: 100%;
  display: block;
}
.popup-top-close {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 48rpx;
  height: 48rpx;
  line-height: 44rpx;
  text-align: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 36rpx;
}
.popup-image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  color: #999;
  font-size: 28rpx;
  min-height: 200rpx;
}
.popup-top-fallback {
  width: 100%;
  min-height: 160rpx;
}
</style>
