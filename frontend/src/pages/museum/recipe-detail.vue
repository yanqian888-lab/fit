<template>
  <view class="recipe-detail-page">
    <view class="header-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="header-center">
        <text class="header-title">食谱详情</text>
      </view>
      <view class="header-right">
        <text class="delete-btn" @click="deleteRecipe">删除</text>
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y>
      <view class="content-wrapper">
        <!-- 食谱标题卡片 -->
        <view class="recipe-header-card">
          <text class="recipe-title">{{ recipe.sub_type || '健康食谱' }}</text>
          <image
            v-if="recipe.extracted_data?.image"
            class="recipe-image"
            :src="recipe.extracted_data.image"
            mode="aspectFill"
          />
        </view>

        <!-- 食材 -->
        <view class="section-card">
          <text class="section-title">食材</text>
          <view v-for="(item, idx) in ingredients" :key="idx" class="ingredient-item">
            <text>{{ item.name }}</text>
            <text class="ingredient-amount">{{ item.amount }}</text>
          </view>
        </view>

        <!-- 做法 -->
        <view class="section-card">
          <text class="section-title">做法</text>
          <text class="steps-text">{{ steps }}</text>
        </view>

        <!-- 小贴士 -->
        <view class="section-card">
          <text class="section-title">小贴士</text>
          <text class="tip-text">{{ tip }}</text>
        </view>

        <!-- 底部占位 -->
        <view class="bottom-placeholder"></view>
      </view>
    </scroll-view>

    <!-- 底部操作按钮 -->
    <view class="action-btns">
      <view class="action-btn primary" @click="addToDiet">添加到今日饮食</view>
      <view class="action-btn" @click="editRecipe">编辑食谱</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { museumApi, recordApi } from '../../api';
import { goBack as navigateBack } from '../../utils/navigate';

const recipe = ref({});
const recipeId = ref(null);
const statusBarHeight = ref(44);

const ingredients = computed(() => {
  const data = recipe.value.extracted_data || {};
  return data.ingredients || [
    { name: '主料', amount: '适量' },
    { name: '蔬菜', amount: '适量' }
  ];
});

const steps = computed(() => {
  const data = recipe.value.extracted_data || {};
  return data.steps || '简单烹饪，少油少盐，保持食材原味。';
});

const tip = computed(() => {
  const data = recipe.value.extracted_data || {};
  return data.tip || '控制用油量，搭配优质蛋白，就是一道减脂餐。';
});

onMounted(() => {
  // #ifdef H5
  statusBarHeight.value = 44;
  // #endif
  // #ifndef H5
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 44;
  // #endif

  const pages = getCurrentPages();
  const query = pages[pages.length - 1].$page?.options || {};
  recipeId.value = parseInt(query.id);
  loadRecipe();
});

function goBack() {
  navigateBack('/pages/museum/recipes');
}

async function loadRecipe() {
  try {
    const res = await museumApi.getItem(recipeId.value);
    recipe.value = res.data;
  } catch (err) {
    console.error(err);
  }
}

async function toggleFavorite() {
  try {
    const res = await museumApi.toggleFavorite(recipeId.value);
    recipe.value.is_favorite = res.data.is_favorite;
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

function parseIngredientAmount(amount) {
  if (!amount) return { weight: 0, quantity: 1, unit: '适量' };
  const weightMatch = amount.match(/^(\d+(?:\.\d+)?)\s*(g|克|kg|千克|mg|毫克)$/);
  if (weightMatch) {
    const value = parseFloat(weightMatch[1]);
    const unit = weightMatch[2];
    if (unit === 'kg' || unit === '千克') return { weight: value * 1000, quantity: 1, unit: 'g' };
    if (unit === 'mg' || unit === '毫克') return { weight: value / 1000, quantity: 1, unit: 'g' };
    return { weight: value, quantity: 1, unit: 'g' };
  }
  const qtyMatch = amount.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (qtyMatch) {
    return { weight: 0, quantity: parseFloat(qtyMatch[1]), unit: qtyMatch[2] };
  }
  return { weight: 0, quantity: 1, unit: amount };
}

async function addToDiet() {
  if (!recipe.value.id) return;

  const mealOptions = ['早餐', '午餐', '晚餐', '加餐'];
  const mealValues = ['breakfast', 'lunch', 'dinner', 'snack'];

  uni.showActionSheet({
    itemList: mealOptions,
    title: '选择要添加到的餐次',
    success: async (res) => {
      const mealTime = mealValues[res.tapIndex];
      const today = new Date().toISOString().split('T')[0];

      const foods = ingredients.value.map(item => ({
        name: item.name,
        ...parseIngredientAmount(item.amount)
      }));

      try {
        await recordApi.saveDiet({
          record_date: today,
          meal_time: mealTime,
          foods
        });
        uni.showToast({ title: '添加成功', icon: 'success' });
      } catch (err) {
        console.error(err);
        uni.showToast({ title: '添加失败', icon: 'none' });
      }
    }
  });
}

function editRecipe() {
  uni.navigateTo({ url: `/pages/museum/item-edit?id=${recipeId.value}&type=recipe` });
}

function deleteRecipe() {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复哦',
    confirmColor: '#E57373',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await museumApi.deleteItem(recipeId.value);
        uni.showToast({ title: '已删除', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 800);
      } catch (err) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
}
</script>

<style lang="scss" scoped>
.recipe-detail-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 360rpx;
  background: linear-gradient(180deg, #DDF2D2 0%, #F7FbF4 100%);
  z-index: 0;
}

.status-bar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 48rpx;
  color: #666666;
  font-weight: 700;
  line-height: 1;
  margin-left: -8rpx;
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 42rpx;
}

.header-right {
  width: 60rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.delete-btn {
  font-size: 26rpx;
  color: #E57373;
}

.content-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  padding-top: 48rpx;
  padding-bottom: calc(240rpx + env(safe-area-inset-bottom));
}

.recipe-header-card,
.section-card {
  background: $bg-card;
  border-radius: 32rpx;
  padding: $spacing-md;
  margin: 0 48rpx $spacing-md;
  box-shadow: $shadow-card;
}

.recipe-title {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-sm;
}

.recipe-image {
  width: 100%;
  height: 360rpx;
  border-radius: $radius-lg;
  margin-top: $spacing-md;
  background: $gray-50;
}

.section-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.ingredient-item {
  display: flex;
  justify-content: space-between;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $gray-50;
  font-size: $text-base;
  color: $text-primary;
}

.ingredient-item:last-child {
  border-bottom: none;
}

.ingredient-amount {
  color: $text-secondary;
}

.steps-text,
.tip-text {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.8;
}

.bottom-placeholder {
  height: 40rpx;
}

.action-btns {
  position: fixed;
  left: 48rpx;
  right: 48rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  z-index: 100;
}

.action-btn {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFFFFF;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #27282D;
  box-shadow: $shadow-card;
}

.action-btn.primary {
  background: #FFE585;
}
</style>
