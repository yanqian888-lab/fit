<template>
  <AppPage :showHeader="true" title="添加饮食">
  <view class="add-food-page">
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
              <view class="food-info" @click="goFoodDetail(food)">
                <text class="food-name">{{ food.name }}</text>
                <text class="food-calorie">{{ food.calorie_per_100g }}kcal/100g</text>
              </view>
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
    <template v-if="showSelectedPanel">
      <view class="selected-mask" @click="showSelectedPanel = false"></view>
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
    </template>

    <!-- 添加食物编辑弹窗 -->
    <template v-if="showFoodEditModal">
      <view class="food-edit-mask" @click="closeFoodEditModal"></view>
      <view class="food-edit-panel" @click.stop>
        <view class="panel-header">
          <text class="panel-title">{{ editMode === 'edit' ? '编辑' : '添加' }}{{ editingFoodName }}</text>
          <text class="panel-close" @click="closeFoodEditModal">✕</text>
        </view>
        <view class="food-edit-body">
          <!-- 单位切换：克 / 个数等单位 -->
          <view v-if="unitOptions.length > 1" class="unit-tabs">
            <view
              v-for="u in unitOptions"
              :key="u"
              class="unit-tab"
              :class="{ active: editUnit === u }"
              @click="switchUnit(u)"
            >
              <text>{{ u === 'g' ? '克' : u }}</text>
            </view>
          </view>
          <view class="edit-row">
            <text class="edit-label">{{ editUnit === 'g' ? '重量' : '数量' }}</text>
            <input v-model="editValue" type="digit" class="edit-input" :focus="true" />
            <text class="edit-unit">{{ editUnit === 'g' ? 'g' : editUnit }}</text>
          </view>
          <!-- 非克数记录时给出大致克数 -->
          <view v-if="editUnit !== 'g'" class="estimate-row">
            <text v-if="hasUnitWeight" class="estimate-text">约 {{ editingFoodUnitWeight }}g/{{ editUnit }}，共约 {{ estimatedWeight }}g</text>
            <text v-else-if="hasUnitCalorie" class="estimate-text">1 {{ editUnit }} ≈ {{ editingFoodUnitCalorie }} 千卡</text>
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
    </template>
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi, systemApi } from '../../api';
import { showRewardToast } from '../../utils/rewardToast.js';
import { MEAL_OPTIONS, isDescriptiveUnit } from '../../utils/constants';
import AppButton from '../../components/AppButton.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import { getToday } from '../../utils/date';

const pageQuery = ref({});
const isEdit = ref(false);
const loading = ref(false);
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
const editValue = ref('100');   // 当前输入值（克数或个数，取决于 editUnit）
const editUnit = ref('g');      // 当前单位：g 或食物自带单位（个/颗/碗…）
const editMode = ref('add'); // 'add' 或 'edit'
const editingIndex = ref(-1); // 编辑时的索引
// 从已选列表打开编辑弹窗时，先收起已选面板；关闭/保存编辑后恢复（数据已联动更新）
const returnToSelected = ref(false);
// 被编辑/删除过的当日已有记录行 id（提交时同步到服务器）
const dirtyRecordIds = new Set();

// 可切换的单位：克 + 食物自带单位（有的话）
const unitOptions = computed(() => {
  const u = editingFood.value?.unit;
  return u ? ['g', u] : ['g'];
});

// 个数模式下的估算总克数
const estimatedWeight = computed(() => {
  const qty = parseFloat(editValue.value) || 0;
  const per = editingFood.value ? (editingFood.value.unit_weight || 0) : 0;
  return Math.round(qty * per * 10) / 10;
});

/** 当前编辑食物名称（安全访问，避免模板可选链） */
const editingFoodName = computed(() => {
  return editingFood.value ? editingFood.value.name : '';
});

/** 是否有单位重量信息 */
const hasUnitWeight = computed(() => {
  return editingFood.value ? !!editingFood.value.unit_weight : false;
});

/** 是否有单位热量信息 */
const hasUnitCalorie = computed(() => {
  return editingFood.value ? !!editingFood.value.unit_calorie : false;
});

/** 食物单位重量值（安全访问） */
const editingFoodUnitWeight = computed(() => {
  return editingFood.value ? (editingFood.value.unit_weight || 0) : 0;
});

/** 食物单位热量值（安全访问） */
const editingFoodUnitCalorie = computed(() => {
  return editingFood.value ? (editingFood.value.unit_calorie || 0) : 0;
});

const editCalorie = computed(() => {
  if (!editingFood.value) return 0;
  if (editUnit.value === 'g') {
    const ratio = (parseFloat(editValue.value) || 0) / 100;
    return Math.round((editingFood.value.calorie_per_100g || 0) * ratio * 10) / 10;
  }
  // 个数模式：优先每单位热量，其次按估算克数折算
  const qty = parseFloat(editValue.value) || 0;
  if (editingFood.value.unit_calorie) {
    return Math.round(qty * editingFood.value.unit_calorie * 10) / 10;
  }
  const ratio = estimatedWeight.value / 100;
  return Math.round((editingFood.value.calorie_per_100g || 0) * ratio * 10) / 10;
});

function switchUnit(u) {
  if (editUnit.value === u) return;
  editUnit.value = u;
  // 切换单位时给一个合理的默认值
  if (u === 'g') {
    editValue.value = String(editingFood.value?.unit_weight || 100);
  } else {
    editValue.value = '1';
  }
}

function isWeightOnlyUnit(unit) {
  const u = String(unit || '').trim().toLowerCase();
  return u === 'g' || u === '克' || u === '100g' || u === '100克' || isDescriptiveUnit(unit);
}


function openFoodEditModal(food) {
  editingFood.value = food;
  // 有自带单位（个/颗/碗…）默认按个数记录，否则按克
  editUnit.value = food.unit ? food.unit : 'g';
  editValue.value = food.unit ? '1' : String(food.unit_weight || 100);
  editMode.value = 'add';
  editingIndex.value = -1;
  showFoodEditModal.value = true;
}

function openEditSelectedFood(index) {
  const food = currentMealFoods.value[index];
  if (!food) return;
  // 从数据库加载的食物只有 calorie（总热量），需要反推 calorie_per_100g
  const caloriePer100g = food.weight > 0 ? (food.calorie / food.weight) * 100 : food.calorie || 0;
  const qty = parseFloat(food.quantity) || 1;
  editingFood.value = {
    ...food,
    calorie_per_100g: caloriePer100g,
    // 记录里的食物没有单位克数/单位热量时，按 总量÷个数 反推，避免编辑弹窗热量显示 0
    unit_weight: food.unit_weight || (food.weight > 0 && qty > 0 ? Math.round((food.weight / qty) * 10) / 10 : null),
    unit_calorie: food.unit_calorie || (food.calorie > 0 && qty > 0 ? Math.round((food.calorie / qty) * 10) / 10 : null)
  };
  const u = food.unit && food.unit !== 'g' && food.unit !== '克' ? food.unit : 'g';
  editUnit.value = u;
  editValue.value = String(u === 'g' ? (food.weight || 100) : (food.quantity || 1));
  editMode.value = 'edit';
  editingIndex.value = index;
  // 先收起已选面板，编辑弹窗独占展示；关闭/保存后再恢复
  showSelectedPanel.value = false;
  returnToSelected.value = true;
  showFoodEditModal.value = true;
}

function closeFoodEditModal() {
  showFoodEditModal.value = false;
  editingFood.value = null;
  editingIndex.value = -1;
  // 从已选列表进入的编辑，关闭后恢复已选面板（数据是同一引用，已同步）
  if (returnToSelected.value) {
    returnToSelected.value = false;
    showSelectedPanel.value = true;
  }
}

function confirmAddFood() {
  if (!editingFood.value) return;
  const mealTime = form.value.meal_time;
  if (!selectedFoods.value[mealTime]) {
    selectedFoods.value[mealTime] = [];
  }
  const isGram = editUnit.value === 'g';
  const weight = isGram ? (parseFloat(editValue.value) || 100) : (estimatedWeight.value || 0);
  const quantity = isGram ? 1 : (parseFloat(editValue.value) || 1);
  selectedFoods.value[mealTime].push({
    name: editingFood.value.name,
    calorie: editCalorie.value,
    protein: editingFood.value.protein_per_100g || 0,
    carb: editingFood.value.carb_per_100g || 0,
    fat: editingFood.value.fat_per_100g || 0,
    weight: weight || 100,
    unit: isGram ? 'g' : editUnit.value,
    quantity,
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
  const isGram = editUnit.value === 'g';
  food.unit = isGram ? 'g' : editUnit.value;
  food.quantity = isGram ? 1 : (parseFloat(editValue.value) || 1);
  food.weight = isGram ? (parseFloat(editValue.value) || 100) : (estimatedWeight.value || food.weight || 100);
  // 重新计算总热量（calorie_per_100g 是每100g的值）
  const ratio = food.weight / 100;
  food.calorie = Math.round((editingFood.value.calorie_per_100g || 0) * ratio);
  // 编辑的是当日已记录的食物：提交时同步更新服务器记录
  if (food.fromRecord && food.recordId) {
    dirtyRecordIds.add(food.recordId);
  }
  closeFoodEditModal();
  uni.showToast({ title: '已修改', icon: 'none' });
}

function selectFood(food) {
  openFoodEditModal(food);
}

function goFoodDetail(food) {
  uni.navigateTo({ url: `/pages/record/food-detail?id=${food.id}` });
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
    // 当日该餐别已记录的食物（来自服务器）
    const serverFoods = [];
    for (const item of mealItems) {
      if (item.foods && item.foods.length > 0) {
        for (const food of item.foods) {
          serverFoods.push({
            ...food,
            weight: food.weight || 100,
            quantity: food.quantity || 1,
            unit: food.unit || 'g',
            fromRecord: true,
            recordId: item.id
          });
        }
      }
    }
    // 合并展示：当日已记录 + 本次会话新增（未保存的不能被覆盖）
    const current = selectedFoods.value[mealTime] || [];
    const unsaved = current.filter(f => !f.fromRecord);
    selectedFoods.value[mealTime] = [...serverFoods, ...unsaved];
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
  const food = selectedFoods.value[mealTime]?.[index];
  // 删除的是当日已记录的食物：提交时需要同步更新/删除服务器记录
  if (food && food.fromRecord && food.recordId) {
    dirtyRecordIds.add(food.recordId);
  }
  if (selectedFoods.value[mealTime]) {
    selectedFoods.value[mealTime].splice(index, 1);
  }
}

async function submit() {
  const mealTime = form.value.meal_time;
  const foods = selectedFoods.value[mealTime] || [];
  if (foods.length === 0 && dirtyRecordIds.size === 0) {
    uni.showToast({ title: '请至少选择一种食物', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const toPayload = (f) => ({
      name: f.name,
      weight: parseFloat(f.weight) || 100,
      quantity: parseFloat(f.quantity) || 1,
      unit: f.unit || 'g',
      calorie: parseFloat(f.calorie) || 0,
      protein: parseFloat(f.protein) || 0,
      carb: parseFloat(f.carb) || 0,
      fat: parseFloat(f.fat) || 0,
      category: f.category || ''
    });

    if (isEdit.value && pageQuery.value.editMode) {
      // 编辑模式（整餐编辑）：先删除该餐别旧记录再整体写入
      const res = await recordApi.getDiet(recordDate.value);
      const mealItems = res.data.meals[mealTime] || [];
      for (const item of mealItems) {
        await recordApi.deleteDiet(item.id);
      }
      const foodsData = foods.map(toPayload);
      if (foodsData.length > 0) {
        const data = { record_date: recordDate.value, meal_time: mealTime, foods: foodsData };
        if (pageQuery.value.id) data.id = parseInt(pageQuery.value.id);
        const res2 = await recordApi.saveDiet(data);
        showRewardToast(res2.data?.reward_messages || [], '保存成功');
      } else {
        uni.showToast({ title: '保存成功', icon: 'none' });
      }
    } else {
      // 新增模式：先同步被编辑/删除过的已有记录行
      for (const rid of dirtyRecordIds) {
        const remaining = foods.filter(f => f.fromRecord && f.recordId === rid).map(toPayload);
        if (remaining.length === 0) {
          await recordApi.deleteDiet(rid);
        } else {
          await recordApi.saveDiet({ id: rid, record_date: recordDate.value, meal_time: mealTime, foods: remaining });
        }
      }
      // 只把本次新选的食物写入新记录，避免与当日已记录重复
      const newFoods = foods.filter(f => !f.fromRecord).map(toPayload);
      if (newFoods.length > 0) {
        const res = await recordApi.saveDiet({
          record_date: recordDate.value,
          meal_time: mealTime,
          foods: newFoods
        });
        showRewardToast(res.data?.reward_messages || [], '保存成功');
      } else {
        uni.showToast({ title: '保存成功', icon: 'none' });
      }
    }
    dirtyRecordIds.clear();
    setTimeout(() => {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
      } else {
        uni.switchTab({ url: '/pages/record/index' });
      }
    }, 800);
  } catch (err) {
    console.error(err);
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

.food-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-right: 24rpx;
}

.food-name {
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
  margin-top: 4rpx;
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
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
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
}

.food-edit-panel {
  position: fixed;
  left: 32rpx;
  right: 32rpx;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1001;
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

.unit-tabs {
  display: flex;
  gap: 16rpx;
  padding-bottom: 20rpx;
}

.unit-tab {
  padding: 12rpx 40rpx;
  border-radius: 999rpx;
  background: #F5F7FA;
  font-size: 28rpx;
  color: #6B7280;
}

.unit-tab.active {
  background: #E8F6D7;
  color: #563E22;
  font-weight: 600;
}

.estimate-row {
  padding: 12rpx 0 0;
  text-align: right;
}

.estimate-text {
  font-size: 24rpx;
  color: #E8A65C;
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