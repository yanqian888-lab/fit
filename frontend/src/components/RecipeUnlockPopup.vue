<template>
  <view class="recipe-mask">
    <view class="recipe-card">
      <!-- 顶部食谱图：食物图垫在“新食谱”外框窗口内，与事件掉落外框保持一致的结构 -->
      <view class="food-image-wrap">
        <image class="food-photo" :src="resolveStaticUrl(recipe.icon_url) || recipeDefaultIconUrl" mode="aspectFill" />
        <image class="food-frame" :src="frameUrl" mode="aspectFit" />
      </view>
      <view class="card-close" @click="$emit('close')">✕</view>
      <!-- 绿色信息面板 -->
      <view class="card-panel">
        <text class="food-title">{{ recipe.title }}</text>
        <text v-if="recipe.effect_text" class="food-effect">{{ recipe.effect_text }}</text>
        <scroll-view class="food-content-scroll" scroll-y>
          <text class="food-content">{{ recipe.content }}</text>
        </scroll-view>
        <view class="got-btn" @click="$emit('close')">
          <text class="got-btn-text">已获得新食谱！</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { resolveStaticUrl } from '../utils/environment';

/** 食谱掉落外框图片：改为远程 CDN 加载以减小小程序包体积 */
const frameUrl = resolveStaticUrl('/static/image/icon/xinshipu.png');
/** 食谱默认配图：改为远程 CDN 加载以减小小程序包体积 */
const recipeDefaultIconUrl = resolveStaticUrl('/static/image/icon/jiyinshi@3x.png');

defineProps({
  recipe: { type: Object, required: true }
});
defineEmits(['close']);
</script>

<style lang="scss" scoped>
.recipe-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.recipe-card {
  width: 668rpx;
  position: relative;
  animation: eventDrop 0.55s cubic-bezier(0.34, 1.4, 0.64, 1);
}

/* 掉落入场：与事件卡片一致 */
@keyframes eventDrop {
  0% { transform: translateY(-110%); opacity: 0; }
  70% { transform: translateY(2%); opacity: 1; }
  100% { transform: translateY(0); }
}

/* 顶部食谱图外框：与事件掉落弹窗保持一致的层叠结构 */
.food-image-wrap {
  position: relative;
  z-index: 2;
  width: 560rpx;
  aspect-ratio: 1262 / 1452;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 食物图：垫在外框窗口区域内 */
.food-photo {
  position: absolute;
  left: 10%;
  top: 24%;
  width: 80%;
  height: 66%;
  z-index: 1;
  border-radius: 32rpx;
  background: #F8FBF4;
}

/* 新食谱外框：压在最上层 */
.food-frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

/* 关闭按钮：右上角白色圆圈 ✕ */
.card-close {
  position: absolute;
  z-index: 3;
  right: 0;
  top: 0;
  width: 64rpx;
  height: 64rpx;
  background: rgba(0, 0, 0, 0.25);
  border: 3rpx solid #FFFFFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #FFFFFF;
  line-height: 1;
}

/* 绿色信息面板 */
.card-panel {
  position: relative;
  z-index: 1;
  margin-top: -120rpx;
  background: #E8F6D7;
  border: 4rpx solid #563E22;
  border-radius: 24rpx;
  padding: 160rpx 46rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.food-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #563E22;
  text-align: center;
  line-height: 52rpx;
}

.food-effect {
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #8EBB77;
  text-align: center;
  line-height: 34rpx;
}

.food-content-scroll {
  margin-top: 32rpx;
  max-height: 210rpx;
  width: 100%;
}

.food-content {
  display: block;
  font-size: 24rpx;
  color: #563E22;
  text-align: center;
  line-height: 44rpx;
  white-space: pre-wrap;
}

/* 已获得按钮：148×44px 绿色胶囊 */
.got-btn {
  width: 296rpx;
  height: 88rpx;
  margin-top: 40rpx;
  background: #8EBB77;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.got-btn-text {
  font-size: 28rpx;
  color: #FFFFFF;
  font-weight: 500;
}
</style>
