<template>
  <view class="add-food-page">
    <!-- 顶部渐变背景 -->
    <view class="header-bg"></view>

    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 页面标题栏 -->
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="header-center">
        <text class="header-date">{{ headerDate }}</text>
        <text class="header-title">{{ mealLabels[mealIndex] }}</text>
      </view>
      <view class="header-right"></view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="请输入食物名称"
        confirm-type="search"
        @confirm="searchFoods"
      />
      <image class="search-icon" src="/static/image/icon/sousuo.svg" mode="aspectFit" />
    </view>

    <!-- 左侧分类 + 右侧食物列表 -->
    <view class="content-body">
      <scroll-view class="category-sidebar" scroll-y :show-scrollbar="false">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="category-item"
          :class="{ active: currentCategory === cat.key }"
          @click="currentCategory = cat.key; searchFoods()"
        >
          <text class="category-text">{{ cat.label }}</text>
        </view>
      </scroll-view>

      <view class="food-list-wrapper">
        <scroll-view class="food-scroll" scroll-y>
          <view v-if="foods.length > 0" class="food-list">
            <view v-for="food in foods" :key="food.id" class="food-item">
              <text class="food-name">{{ food.name }}</text>
              <text class="food-calorie">{{ food.calorie_per_100g }}kcal/100g</text>
              <image class="add-btn" src="/static/image/icon/tianjia.svg" mode="aspectFit" @click="selectFood(food)" />
            </view>
          </view>
          <view v-else class="empty-tip">
            <text>搜索或选择分类查看食物</text>
          </view>
        </scroll-view>

        <!-- 去自定义食物悬浮按钮 -->
        <view class="custom-food-float" @click="goCreateFood">
          <text class="custom-food-float-text">去自定义食物</text>
        </view>
      </view>
    </view>

    <!-- 底部已选栏 -->
    <view class="bottom-bar">
      <view class="bottom-content">
        <view class="selected-summary" @click="showSelectedPanel = true">
          <text class="selected-label">{{ mealLabels[mealIndex] }}({{ currentMealFoods.length }})</text>
          <image class="selected-arrow" src="/static/image/icon/zhankai01.svg" mode="aspectFit" />
        </view>
        <view class="complete-btn" :class="{ disabled: loading }" @click="submit">完成</view>
      </view>
    </view>

    <!-- 已选食物弹窗 -->
    <view v-if="showSelectedPanel" class="selected-mask" @click="showSelectedPanel = false">
      <view class="selected-panel" @click.stop>
        <view class="panel-header">
          <text class="panel-title">已选食物</text>
          <text class="panel-close" @click="showSelectedPanel = false">✕</text>
        </view>
        <view v-for="(food, index) in currentMealFoods" :key="index" class="selected-item" @click="openEditSelectedFood(index)">
          <view class="selected-info">
            <text class="selected-name">{{ food.name }}</text>
            <view class="selected-detail">
              <text v-if="food.quantity && food.unit && !isWeightOnlyUnit(food.unit)" class="selected-quantity">{{ food.quantity }}{{ food.unit }}</text>
              <text class="selected-weight">{{ food.weight }}g</text>
              <text class="selected-calorie">{{ Math.round(food.calorie || 0) }}千卡</text>
            </view>
          </view>
          <text class="delete-btn" @click.stop="removeFood(index)">✕</text>
        </view>
        <AppEmpty v-if="currentMealFoods.length === 0" text="还没有选择食物" icon="🥗" />
      </view>
    </view>

    <!-- 添加食物编辑弹窗 -->
    <view v-if="showFoodEditModal" class="food-edit-mask" @click="closeFoodEditModal">
      <view class="food-edit-panel" @click.stop>
        <view class="panel-header">
          <text class="panel-title">{{ editMode === 'edit' ? '编辑' : '添加' }}{{ editingFood?.name }}</text>
          <text class="panel-close" @click="closeFoodEditModal">✕</text>
        </view>
        <view class="food-edit-body">
          <view v-if="showEditQuantity" class="edit-row">
            <text class="edit-label">数量</text>
            <input v-model="editQuantity" type="digit" class="edit-input" />
            <text class="edit-unit">{{ editingFood?.unit || 'g' }}</text>
          </view>
          <view class="edit-row">
            <text class="edit-label">重量</text>
            <input v-model="editWeight" type="digit" class="edit-input" />
            <text class="edit-unit">g</text>
          </view>
          <view class="edit-info">
            <text class="edit-calorie">{{ editCalorie }} 千卡</text>
          </view>
        </view>
        <view class="food-edit-footer">
          <AppButton v-if="editMode === 'add'" block @click="confirmAddFood">确认添加</AppButton>
          <AppButton v-else block @click="confirmEditFood">确认修改</AppButton>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi, systemApi } from '../../api';
import { MEAL_OPTIONS, isDescriptiveUnit } from '../../utils/constants';
import AppButton from '../../components/AppButton.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import { getToday } from '../../utils/date';
import { goBack as navigateBack } from '../../utils/navigate';

const pageQuery = ref({});
const isEdit = ref(false);
const loading = ref(false);
const statusBarHeight = ref(44);
const keyword = ref('');
const foods = ref([]);
const selectedFoods = ref({
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: []
});
const showSelectedPanel = ref(false);
const currentCategory = ref('all');

// 当前餐别的已选食物（计算属性）
const currentMealFoods = computed(() => {
  return selectedFoods.value[form.value.meal_time] || [];
});

// 食物编辑弹窗
const showFoodEditModal = ref(false);
const editingFood = ref(null);
const editQuantity = ref('1');
const editWeight = ref('100');
const editMode = ref('add'); // 'add' 或 'edit'
const editingIndex = ref(-1); // 编辑时的索引

const editCalorie = computed(() => {
  if (!editingFood.value) return 0;
  const ratio = parseFloat(editWeight.value) / 100;
  return Math.round((editingFood.value.calorie_per_100g || 0) * ratio * 10) / 10;
});

function isWeightOnlyUnit(unit) {
  const u = String(unit || '').trim().toLowerCase();
  return u === 'g' || u === '克' || u === '100g' || u === '100克' || isDescriptiveUnit(unit);
}

const showEditQuantity = computed(() => {
  return !isWeightOnlyUnit(editingFood.value?.unit);
});

function openFoodEditModal(food) {
  editingFood.value = food;
  editQuantity.value = '1';
  editWeight.value = String(food.unit_weight || 100);
  editMode.value = 'add';
  editingIndex.value = -1;
  showFoodEditModal.value = true;
}

function openEditSelectedFood(index) {
  const food = currentMealFoods.value[index];
  if (!food) return;
  // 从数据库加载的食物只有 calorie（总热量），需要反推 calorie_per_100g
  const caloriePer100g = food.weight > 0 ? (food.calorie / food.weight) * 100 : food.calorie || 0;
  editingFood.value = {
    ...food,
    calorie_per_100g: caloriePer100g
  };
  editQuantity.value = String(food.quantity || 1);
  editWeight.value = String(food.weight || 100);
  editMode.value = 'edit';
  editingIndex.value = index;
  showFoodEditModal.value = true;
}

function closeFoodEditModal() {
  showFoodEditModal.value = false;
  editingFood.value = null;
  editingIndex.value = -1;
}

function confirmAddFood() {
  if (!editingFood.value) return;
  const mealTime = form.value.meal_time;
  if (!selectedFoods.value[mealTime]) {
    selectedFoods.value[mealTime] = [];
  }
  selectedFoods.value[mealTime].push({
    name: editingFood.value.name,
    calorie: editingFood.value.calorie_per_100g || 0,
    protein: editingFood.value.protein_per_100g || 0,
    carb: editingFood.value.carb_per_100g || 0,
    fat: editingFood.value.fat_per_100g || 0,
    weight: parseFloat(editWeight.value) || 100,
    unit: editingFood.value.unit || 'g',
    quantity: parseFloat(editQuantity.value) || 1,
    category: editingFood.value.category || ''
  });
  closeFoodEditModal();
  uni.showToast({ title: '已添加', icon: 'none' });
}

function confirmEditFood() {
  if (editingIndex.value < 0) return;
  const mealTime = form.value.meal_time;
  const food = selectedFoods.value[mealTime][editingIndex.value];
  if (!food) return;
  food.quantity = parseFloat(editQuantity.value) || 1;
  food.weight = parseFloat(editWeight.value) || 100;
  // 重新计算总热量（calorie_per_100g 是每100g的值）
  const ratio = food.weight / 100;
  food.calorie = Math.round((editingFood.value.calorie_per_100g || 0) * ratio);
  closeFoodEditModal();
  uni.showToast({ title: '已修改', icon: 'none' });
}

function selectFood(food) {
  openFoodEditModal(food);
}

const categories = [
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
  { key: 'staple', label: '主食类' },
  { key: 'vegetable', label: '蔬果类' },
  { key: 'meat', label: '肉蛋奶' },
  { key: 'bean', label: '豆/坚果' },
  { key: 'snack', label: '零食饮料' },
  { key: 'dish', label: '中西菜肴' },
  { key: 'seasoning', label: '调味油脂' },
  { key: 'meal_replacement', label: '代餐特殊' }
];

const form = ref({
  meal_time: 'breakfast'
});

const mealLabels = MEAL_OPTIONS.map(m => m.label);
const mealIndex = computed(() => {
  const idx = MEAL_OPTIONS.findIndex(m => m.value === form.value.meal_time);
  return idx >= 0 ? idx : 0; // 兜底：如果找不到，默认第一个（早餐）
});

// 当前记录日期，默认今天
const recordDate = ref(getToday());

const headerDate = computed(() => {
  const d = new Date(recordDate.value);
  if (isNaN(d.getTime())) return recordDate.value;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
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
  const cur = pages[pages.length - 1];
  pageQuery.value = cur.$page?.options || {};
  if (pageQuery.value.date) {
    recordDate.value = pageQuery.value.date;
  }
  if (pageQuery.value.meal) {
    form.value.meal_time = pageQuery.value.meal;
  }
  if (pageQuery.value.editMode) {
    // 编辑模式：加载当前餐别的所有食物
    isEdit.value = true;
    loadMealFoods(pageQuery.value.meal);
  } else if (pageQuery.value.id) {
    // 兼容旧逻辑：单个食物编辑
    isEdit.value = true;
    loadDetail(pageQuery.value.id);
  }
  if (pageQuery.value.foodId) {
    loadFoodToSelected(parseInt(pageQuery.value.foodId), pageQuery.value.source || 'common');
  }
  // 默认加载食物
  searchFoods();
});

onShow(() => {
  // 每次显示页面时，重新加载当前餐别的食物和食物列表
  loadMealFoods(form.value.meal_time);
  searchFoods();
});

function onMealChange(e) {
  form.value.meal_time = MEAL_OPTIONS[parseInt(e.detail.value)].value;
}

function goBack() {
  navigateBack('/pages/record/index');
}

function goCreateFood() {
  uni.navigateTo({ url: '/pages/record/create-food' });
}

function getFoodStatus(food) {
  // 根据卡路里密度判断：绿色=低卡，橙色=中卡，红色=高卡
  const calorie = food.calorie_per_100g || 0;
  if (calorie < 50) return 'low';
  if (calorie < 200) return 'medium';
  return 'high';
}

async function searchFoods() {
  try {
    const params = { size: 999 };
    if (keyword.value.trim()) params.keyword = keyword.value;
    if (currentCategory.value !== 'all') params.category = currentCategory.value;
    const res = await systemApi.getFoods(params);
    foods.value = res.data.list || [];
  } catch (err) {
    console.error(err);
  }
}

async function loadMealFoods(mealTime) {
  try {
    const res = await recordApi.getDiet(recordDate.value);
    const mealItems = res.data.meals[mealTime] || [];
    // 将食物加载到对应餐别
    const allFoods = [];
    for (const item of mealItems) {
      if (item.foods && item.foods.length > 0) {
        for (const food of item.foods) {
          allFoods.push({
            ...food,
            weight: food.weight || 100,
            quantity: food.quantity || 1,
            unit: food.unit || 'g',
            recordId: item.id
          });
        }
      }
    }
    selectedFoods.value[mealTime] = allFoods;
    console.log(`[loadMealFoods] 加载${mealTime}餐别食物:`, allFoods.length, '个');
  } catch (err) {
    console.error(err);
  }
}

async function loadDetail(id) {
  try {
    const res = await recordApi.getDiet(recordDate.value);
    const all = Object.values(res.data.meals).flat();
    const item = all.find(i => String(i.id) === id);
    if (item) {
      form.value.meal_time = item.meal_time || pageQuery.value.meal || 'breakfast';
      const mealTime = form.value.meal_time;
      selectedFoods.value[mealTime] = item.foods.map(f => ({ ...f, weight: f.weight || 100 }));
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadFoodToSelected(foodId, source) {
  try {
    const res = await systemApi.getFoodDetail(foodId, source);
    const food = res.data;
    const unit = food.unit || 'g';
    const unitWeight = food.unit_weight || 100;
    const mealTime = form.value.meal_time;
    if (!selectedFoods.value[mealTime]) {
      selectedFoods.value[mealTime] = [];
    }
    selectedFoods.value[mealTime].push({
      name: food.name,
      calorie: food.calorie_per_100g || 0,
      protein: food.protein_per_100g || 0,
      carb: food.carb_per_100g || 0,
      fat: food.fat_per_100g || 0,
      weight: unitWeight,
      unit: unit,
      quantity: 1,
      category: food.category || ''
    });
  } catch (err) {
    console.error(err);
  }
}

function removeFood(index) {
  const mealTime = form.value.meal_time;
  if (selectedFoods.value[mealTime]) {
    selectedFoods.value[mealTime].splice(index, 1);
  }
}

async function submit() {
  const mealTime = form.value.meal_time;
  const foods = selectedFoods.value[mealTime] || [];
  if (foods.length === 0) {
    uni.showToast({ title: '请至少选择一种食物', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    // 如果是编辑模式（加载了整个餐别），先删除该餐别的所有旧记录
    if (isEdit.value && pageQuery.value.editMode) {
      const res = await recordApi.getDiet(recordDate.value);
      const mealItems = res.data.meals[mealTime] || [];
      for (const item of mealItems) {
        await recordApi.deleteDiet(item.id);
      }
      console.log(`[submit] 已删除${mealTime}餐别的${mealItems.length}条旧记录`);
    }

    const foodsData = foods.map(f => {
      const quantity = parseFloat(f.quantity) || 1;
      const weight = parseFloat(f.weight) || 100;
      return {
        name: f.name,
        weight: weight,
        quantity: quantity,
        unit: f.unit || 'g',
        calorie: parseFloat(f.calorie) || 0,
        protein: parseFloat(f.protein) || 0,
        carb: parseFloat(f.carb) || 0,
        fat: parseFloat(f.fat) || 0,
        category: f.category || ''
      };
    });
    const data = {
      record_date: recordDate.value,
      meal_time: mealTime,
      foods: foodsData
    };
    if (isEdit.value && pageQuery.value.id) {
      data.id = parseInt(pageQuery.value.id);
    }
    await recordApi.saveDiet(data);
    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>
<style lang="scss" scoped>
.add-food-page {
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

.header-date {
  font-size: 26rpx;
  color: #999999;
  line-height: 34rpx;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 42rpx;
}

.header-right {
  width: 60rpx;
}

/* 搜索栏 */
.search-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  margin: 0 32rpx 24rpx;
  padding: 0 24rpx;
  height: 84rpx;
  background: #FFFFFF;
  border-radius: 42rpx;
  border: 2rpx solid #27282D;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 28rpx;
  color: #27282D;
}

.search-icon {
  width: 40rpx;
  height: 40rpx;
}

/* 内容主体：分类 + 食物列表 */
.content-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 0 32rpx;
  padding-bottom: 160rpx;
}

/* 左侧分类 */
.category-sidebar {
  width: 170rpx;
  height: 100%;
  flex-shrink: 0;
  padding-top: 8rpx;
}

.category-item {
  padding: 30rpx 0;
  display: flex;
  justify-content: center;
}

.category-text {
  font-size: 28rpx;
  color: #666666;
  line-height: 36rpx;
  padding: 8rpx 16rpx;
  border-radius: 32rpx;
  white-space: nowrap;
}

.category-item.active .category-text {
  background: #FFFFFF;
  color: #27282D;
  font-weight: 600;
}

/* 右侧食物列表容器 */
.food-list-wrapper {
  flex: 1;
  margin-left: 16rpx;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 右侧食物列表 */
.food-scroll {
  flex: 1;
  height: 100%;
  background: #FFFFFF;
}

/* 去自定义食物悬浮按钮 */
.custom-food-float {
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  height: 88rpx;
  background: #FBE386;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(251, 227, 134, 0.35);
  z-index: 10;
}

.custom-food-float-text {
  font-size: 30rpx;
  color: #27282D;
  font-weight: 600;
}

.food-list {
  padding: 16rpx 24rpx 140rpx;
}

.food-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F0F2F5;
}

.food-item:last-child {
  border-bottom: none;
}

.food-name {
  flex: 1;
  font-size: 34rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 44rpx;
  min-width: 0;
}

.food-calorie {
  font-size: 26rpx;
  color: #999999;
  line-height: 36rpx;
  margin-right: 24rpx;
}

.add-btn {
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
}

.empty-tip {
  text-align: center;
  padding: 80rpx 0;
  color: #999999;
  font-size: 26rpx;
}

/* 底部栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #F7FbF4;
  z-index: 100;
}

.bottom-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.selected-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: #FFFFFF;
  border-radius: 44rpx;
  padding: 0 28rpx;
  height: 88rpx;
  flex: 1;
}

.selected-label {
  font-size: 32rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 44rpx;
}

.selected-arrow {
  width: 32rpx;
  height: 32rpx;
}

.complete-btn {
  height: 88rpx;
  padding: 0 80rpx;
  background: #FBE386;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  color: #27282D;
  font-weight: 400;
}

.complete-btn.disabled {
  opacity: 0.6;
}

/* 已选弹窗 */
.selected-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.selected-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  max-height: 60vh;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
}

.panel-close {
  font-size: 36rpx;
  color: #9CA3AF;
}

.selected-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F0F2F5;
}

.selected-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.selected-name {
  font-size: 30rpx;
  color: #27282D;
}

.selected-detail {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 2rpx;
}

.selected-quantity,
.selected-weight,
.selected-calorie {
  font-size: 24rpx;
  color: #8F9098;
}

.weight-input {
  display: flex;
  align-items: center;
  background: #F5F7FA;
  border-radius: 16rpx;
  padding: 0 16rpx;
  margin-right: 16rpx;
}

.weight-input input {
  width: 100rpx;
  height: 56rpx;
  text-align: right;
  font-size: 30rpx;
}

.delete-btn {
  color: #E57373;
  font-size: 32rpx;
  padding: 0 16rpx;
}

/* 食物编辑弹窗 */
.food-edit-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}

.food-edit-panel {
  width: 100%;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
}

.food-edit-body {
  padding: 24rpx 0;
}

.edit-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F0F2F5;
}

.edit-label {
  width: 120rpx;
  font-size: 30rpx;
  color: #6B7280;
}

.edit-input {
  flex: 1;
  height: 72rpx;
  background: #F5F7FA;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #27282D;
  text-align: right;
}

.edit-unit {
  width: 60rpx;
  font-size: 24rpx;
  color: #9CA3AF;
  text-align: right;
}

.edit-info {
  text-align: center;
  padding: 24rpx 0;
}

.edit-calorie {
  font-size: 32rpx;
  font-weight: 700;
  color: #8DBB77;
}

.food-edit-footer {
  margin-top: 24rpx;
}
</style>