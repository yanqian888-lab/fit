<template>
  <AppPage>
    <AppHeader title="食物详情" />
    <view class="food-detail-page">
      <view class="header-placeholder"></view>
      <scroll-view class="food-detail-scroll" scroll-y>
        <view class="food-detail-content">
          <view class="food-header">
            <text class="food-name">{{ food.name }}</text>
            <text class="food-category">{{ food.category || '自定义食物' }}</text>
            <view class="food-actions">
              <text class="action-star" @click="toggleFavorite">{{ food.is_favorite ? '★' : '☆' }}</text>
            </view>
          </view>

          <view class="calorie-card">
            <text class="calorie-value">{{ food.calorie_per_100g }}</text>
            <text class="calorie-unit">千卡 / 100g</text>
          </view>

          <view class="nutrient-card">
            <text class="card-title">营养成分</text>
            <view class="nutrient-grid">
              <view class="nutrient-item">
                <text class="nutrient-value">{{ food.protein_per_100g }}g</text>
                <text class="nutrient-label">蛋白质</text>
              </view>
              <view class="nutrient-item">
                <text class="nutrient-value">{{ food.carb_per_100g }}g</text>
                <text class="nutrient-label">碳水</text>
              </view>
              <view class="nutrient-item">
                <text class="nutrient-value">{{ food.fat_per_100g }}g</text>
                <text class="nutrient-label">脂肪</text>
              </view>
              <view class="nutrient-item">
                <text class="nutrient-value">{{ food.fiber_per_100g || 0 }}g</text>
                <text class="nutrient-label">膳食纤维</text>
              </view>
            </view>
          </view>

          <view v-if="food.gi" class="gi-card">
            <text class="card-title">升糖指数 (GI)</text>
            <text class="gi-value">{{ food.gi }}</text>
            <text class="gi-desc">{{ giDesc }}</text>
          </view>

          <view class="suggest-card">
            <text class="card-title">食用建议</text>
            <text class="suggest-text">{{ suggestText }}</text>
          </view>
          
          <view class="bottom-placeholder"></view>
        </view>
      </scroll-view>

      <view class="bottom-actions">
        <AppButton block type="primary" @click="addToDiet">添加到今日饮食</AppButton>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { systemApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const food = ref({});
const foodId = ref(null);
const source = ref('common');

const giDesc = computed(() => {
  const gi = food.value.gi;
  if (!gi) return '';
  if (gi <= 55) return '低 GI，饱腹感较强，适合减脂期食用';
  if (gi <= 70) return '中 GI，可适量食用，建议搭配蛋白质';
  return '高 GI，建议控制分量，避免血糖快速升高';
});

const suggestText = computed(() => {
  const cal = food.value.calorie_per_100g;
  if (!cal) return '暂无建议';
  if (cal < 50) return '低热量食物，可以多吃一点，帮助增加饱腹感。';
  if (cal < 150) return '热量适中，注意控制分量即可。';
  return '热量较高，建议少量食用，或作为欺骗餐享用。';
});

onMounted(() => {
  const pages = getCurrentPages();
  // 微信端参数在原生 page.options 上，$page?.options 仅作兜底
  const page = pages[pages.length - 1];
  const query = page.options || page.$page?.options || {};
  foodId.value = parseInt(query.id);
  source.value = query.source || 'common';
  loadFood();
});

async function loadFood() {
  try {
    const res = await systemApi.getFoodDetail(foodId.value, source.value);
    food.value = res.data;
  } catch (err) {
    console.error(err);
  }
}

async function toggleFavorite() {
  try {
    const res = await systemApi.toggleFavoriteFood(foodId.value);
    food.value.is_favorite = res.data.is_favorite;
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

function addToDiet() {
  uni.navigateTo({
    url: `/pages/record/add-food?foodId=${foodId.value}&source=${source.value}&name=${encodeURIComponent(food.value.name)}`
  });
}
</script>

<style lang="scss" scoped>
.food-detail-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-placeholder {
  height: calc(100rpx + 24rpx + env(safe-area-inset-top) + 20rpx);
  flex-shrink: 0;
}

.food-detail-scroll {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.food-detail-content {
  padding: $spacing-md;
  padding-bottom: 0;
}

.bottom-placeholder {
  height: calc(120rpx + env(safe-area-inset-bottom));
}

.food-header {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
  position: relative;
}

.food-name {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
  margin-bottom: 8rpx;
}

.food-category {
  font-size: $text-sm;
  color: $text-secondary;
}

.food-actions {
  position: absolute;
  right: $spacing-lg;
  top: $spacing-lg;
}

.action-star {
  font-size: 56rpx;
  color: $cream;
}

.calorie-card {
  background: $mint;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: $white;
  box-shadow: $shadow-soft;
}

.calorie-value {
  font-size: 80rpx;
  font-weight: $font-bold;
}

.calorie-unit {
  font-size: $text-sm;
  opacity: 0.9;
  font-weight: $font-light;
}

.nutrient-card,
.gi-card,
.suggest-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.card-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.nutrient-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-sm;
}

.nutrient-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nutrient-value {
  font-size: $text-lg;
  font-weight: $font-bold;
  color: $text-primary;
}

.nutrient-label {
  font-size: $text-xs;
  color: $text-secondary;
  margin-top: 8rpx;
}

.gi-value {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $mint-dark;
  display: block;
  margin-bottom: 8rpx;
}

.gi-desc {
  font-size: $text-sm;
  color: $text-secondary;
  line-height: 1.5;
}

.suggest-text {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.6;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  padding: $spacing-md;
  background: $bg-page;
  border-top: 1rpx solid $gray-100;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
  z-index: 100;
  box-sizing: border-box;
}
</style>
