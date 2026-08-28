<template>
  <AppPage :showHeader="true" title="食谱详情">
  <view class="recipe-detail-page">
    <view class="page-header">
      <view class="header-right">
        <text class="delete-btn" @click="deleteRecipe">删除</text>
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y>
      <view class="content-wrapper">
        <!-- 食谱标题卡片 -->
        <view class="recipe-header-card">
          <text class="recipe-title">{{ recipe.title || recipe.sub_type || '健康食谱' }}</text>
          <!-- 总克数/总热量/建议餐别 -->
          <view v-if="totalWeight || totalCalorie || mealType" class="recipe-totals-row">
            <view v-if="mealType" class="total-item">
              <text class="total-value meal-type-value">{{ mealType }}</text>
              <text class="total-label">建议餐别</text>
            </view>
            <view v-if="totalWeight" class="total-item">
              <text class="total-value">{{ totalWeight }}g</text>
              <text class="total-label">总克数</text>
            </view>
            <view v-if="totalCalorie" class="total-item">
              <text class="total-value">{{ totalCalorie }}</text>
              <text class="total-label">总热量（千卡/份）</text>
            </view>
          </view>
          <image
            v-if="recipeImage"
            class="recipe-image"
            :src="recipeImage"
            mode="aspectFill"
          />
        </view>

        <!-- 食材（有数据才显示） -->
        <view v-if="ingredients.length" class="section-card">
          <text class="section-title">食材</text>
          <view v-for="(item, idx) in ingredients" :key="idx" class="ingredient-item">
            <text>{{ item.name }}</text>
            <text class="ingredient-amount">{{ item.amount }}</text>
          </view>
        </view>

        <!-- 做法（有数据才显示） -->
        <view v-if="steps" class="section-card">
          <text class="section-title">做法</text>
          <text class="steps-text">{{ steps }}</text>
        </view>

        <!-- 小贴士（有数据才显示） -->
        <view v-if="tip" class="section-card">
          <text class="section-title">小贴士</text>
          <text class="tip-text">{{ tip }}</text>
        </view>

        <!-- 聊聊食谱：原文展示 -->
        <view v-if="isRawRecipe" class="section-card">
          <text class="section-title">食谱内容</text>
          <text class="raw-content-text">{{ recipe.content }}</text>
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

    <!-- 餐次选择弹层（App 风格底部弹层） -->
    <template v-if="showMealPicker">
      <view class="meal-picker-mask" @click="showMealPicker = false"></view>
      <view class="meal-picker" @click.stop>
        <text class="meal-picker-title">选择要添加到的餐次</text>
        <view class="meal-options">
          <view
            v-for="opt in mealOptions"
            :key="opt.value"
            class="meal-option"
            @click="onPickMeal(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
        <view class="meal-cancel" @click="showMealPicker = false">取消</view>
      </view>
    </template>

    <!-- 删除确认弹框 -->
    <AppModal
      v-model:visible="showDeleteModal"
      icon="none"
      title="确认删除"
      text="删除后无法恢复哦"
      confirmText="删除"
      confirmDanger
      cancelText="取消"
      @confirm="confirmDelete"
    />
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { museumApi, recordApi } from '../../api';
import { showRewardToast } from '../../utils/rewardToast.js';
import AppModal from '../../components/AppModal.vue';

const recipe = ref({});
const recipeId = ref(null);

// 删除确认弹框状态
const showDeleteModal = ref(false);

// 食谱图片：blob: 是历史前端临时地址（已失效），只展示有效的 http/静态路径
const recipeImage = computed(() => {
  const img = recipe.value.extracted_data?.image || '';
  return (/^https?:\/\//.test(img) || img.startsWith('/')) ? img : '';
});

// 总克数/总热量
const totalWeight = computed(() => recipe.value.extracted_data?.total_weight || 0);
const totalCalorie = computed(() => recipe.value.extracted_data?.total_calorie || 0);
// 建议餐别
const mealType = computed(() => recipe.value.extracted_data?.meal_type || '');

// 聊聊食谱（ precipitation_recipe ）直接展示原文，避免 AI 解析格式错乱
const isRawRecipe = computed(() => {
  if (recipe.value.sub_type === 'precipitation_recipe' && recipe.value.content) {
    return true;
  }
  const data = recipe.value.extracted_data || {};
  if (data.title === 'precipitation_recipe' && recipe.value.content) {
    return true;
  }
  return false;
});

const ingredients = computed(() => {
  const data = recipe.value.extracted_data || {};
  // 优先使用结构化数据
  if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
    // 兼容字符串数组格式（历史数据可能是 ["鸡蛋 2个"] 而非 [{name, amount}]）
    return data.ingredients.map(item => {
      if (typeof item === 'string') {
        const parsed = parseIngredientString(item);
        return parsed || { name: item, amount: '适量' };
      }
      if (item && item.name) return item;
      return { name: '食材', amount: '适量' };
    }).filter(item => item.name && item.name !== '食材');
  }
  // 从 content 原文兜底解析
  if (recipe.value.content) {
    const parsed = parseIngredientsFromText(recipe.value.content);
    if (parsed.length > 0) return parsed;
  }
  // 无数据时返回空，页面不显示食材区块（不展示占位假数据）
  return [];
});

const steps = computed(() => {
  const data = recipe.value.extracted_data || {};
  if (data.steps && typeof data.steps === 'string' && data.steps.trim()) {
    return data.steps;
  }
  // 从 content 原文兜底解析做法
  if (recipe.value.content) {
    const parsed = parseStepsFromText(recipe.value.content);
    if (parsed) return parsed;
  }
  return '';
});

const tip = computed(() => {
  const data = recipe.value.extracted_data || {};
  if (data.tip && typeof data.tip === 'string' && data.tip.trim()) {
    return data.tip;
  }
  return '';
});

onMounted(() => {
  const pages = getCurrentPages();
  const query = pages[pages.length - 1].$page?.options || {};
  recipeId.value = parseInt(query.id);
  loadRecipe();
});

/**
 * 从字符串格式解析食材，如 "鸡蛋 2个" → {name:"鸡蛋", amount:"2个"}
 * @param {string} str 食材字符串
 * @returns {object|null} {name, amount}
 */
function parseIngredientString(str) {
  if (!str) return null;
  const s = str.trim();
  if (!s) return null;
  // 优先匹配：名称 + 空格 + 数量（支持数量内带空格，如 "姜片 2 片"）
  const match1 = s.match(/^(.+?)\s+(\d+(?:\.\d+)?\s*[\u4e00-\u9fa5a-zA-Z]+)$/);
  if (match1) return { name: match1[1].trim(), amount: match1[2].trim().replace(/\s+/g, '') };
  // 兼容：名称与数量之间无空格，如 "鸡胸肉150g"
  const match2 = s.match(/^(.+?)(\d+(?:\.\d+)?[\u4e00-\u9fa5a-zA-Z]+)$/);
  if (match2) return { name: match2[1].trim(), amount: match2[2].trim() };
  // 纯短文本（如 "盐少许"）视为名称，用量适量
  if (s.length > 0 && s.length <= 12) return { name: s, amount: '适量' };
  return null;
}

/**
 * 从 content 原文兜底解析食材列表
 * @param {string} content 食谱原文
 * @returns {Array<{name, amount}>} 食材数组
 */
function parseIngredientsFromText(content) {
  if (!content) return [];
  const ingredients = [];
  // 按「食材：」分段
  const match = content.match(/食材[：:]\s*([\s\S]*?)(?=做法|步骤|小贴士|$)/i);
  if (!match) return [];
  const parts = match[1].split(/[、，,；;\n]/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const parsed = parseIngredientString(part);
    if (parsed) ingredients.push(parsed);
  }
  return ingredients;
}

/**
 * 从 content 原文兜底解析做法步骤
 * @param {string} content 食谱原文
 * @returns {string|null} 做法文本
 */
function parseStepsFromText(content) {
  if (!content) return null;
  const match = content.match(/(?:做法|步骤)[：:]\s*([\s\S]*?)(?=小贴士|$)/i);
  if (match) return match[1].trim();
  return null;
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

const showMealPicker = ref(false);
const mealOptions = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '加餐', value: 'snack' }
];

function addToDiet() {
  if (!recipe.value.id) return;
  if (!ingredients.value.length) {
    uni.showToast({ title: '该食谱没有可添加的食材', icon: 'none' });
    return;
  }
  showMealPicker.value = true;
}

async function onPickMeal(mealTime) {
  showMealPicker.value = false;
  const today = new Date().toISOString().split('T')[0];
  const foods = ingredients.value.map(item => ({
    name: item.name,
    ...parseIngredientAmount(item.amount)
  }));
  try {
    const res = await recordApi.saveDiet({
      record_date: today,
      meal_time: mealTime,
      foods
    });
    showRewardToast(res.data?.reward_messages || [], '添加成功');
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '添加失败', icon: 'none' });
  }
}

function editRecipe() {
  uni.navigateTo({ url: `/pages/museum/item-edit?id=${recipeId.value}&type=recipe` });
}

function deleteRecipe() {
  showDeleteModal.value = true;
}

/**
 * 确认删除食谱
 */
async function confirmDelete() {
  showDeleteModal.value = false;
  try {
    await museumApi.deleteItem(recipeId.value);
    uni.showToast({ title: '已删除', icon: 'success' });
    setTimeout(() => {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
      } else {
        uni.switchTab({ url: '/pages/museum/index' });
      }
    }, 800);
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' });
  }
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
.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16rpx 32rpx;
}

.header-right {
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

.recipe-totals-row {
  display: flex;
  gap: 48rpx;
  margin-top: 16rpx;
}

.total-item {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.total-value {
  font-size: 34rpx;
  font-weight: 700;
  color: #E8A65C;
}

.meal-type-value {
  color: #8DBB77;
}

.total-label {
  font-size: 22rpx;
  color: $text-tertiary;
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
.tip-text,
.raw-content-text {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
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

/* 餐次选择弹层 */
.meal-picker-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
}

.meal-picker {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 201;
  background: #FFFFFF;
  border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.meal-picker-title {
  display: block;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: #27282D;
  margin-bottom: 32rpx;
}

.meal-options {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.meal-option {
  height: 96rpx;
  border-radius: 999rpx;
  background: #F0F7EC;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #563E22;
}

.meal-option:active {
  background: #E8F6D7;
}

.meal-cancel {
  height: 96rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  color: #999;
  background: #F5F5F5;
}
</style>