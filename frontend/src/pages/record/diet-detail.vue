<template>
  <AppPage :showHeader="true" title="今日饮食">
  <view class="diet-page">
    <!-- 日期模块 -->
    <view class="date-module">
      <!-- 收起状态：固定展示选中日期所在周 -->
      <view v-if="!isExpanded" class="date-bar">
        <view
          v-for="item in weekDays"
          :key="item.date"
          class="date-item"
          :class="{ today: item.isToday && !item.isSelected, selected: item.isSelected }"
          @click="selectDate(item.date)"
        >
          <text class="date-week">{{ item.weekLabel }}</text>
          <text class="date-day">{{ item.day }}</text>
          <view v-if="item.hasRecord" class="record-dot"></view>
        </view>
      </view>

      <!-- 展开状态：完整月历 -->
      <view v-else class="calendar-panel">
        <view class="calendar-header">
          <view class="month-arrow" @click="prevMonth">
            <text class="arrow-icon left">‹</text>
          </view>
          <text class="calendar-title">{{ headerDate }}</text>
          <view class="month-arrow" @click="nextMonth">
            <text class="arrow-icon right">›</text>
          </view>
        </view>

        <view class="calendar-weekdays">
          <text v-for="w in WEEKDAYS" :key="w" class="calendar-weekday">{{ w }}</text>
        </view>

        <view class="calendar-days">
          <view
            v-for="(item, index) in calendarDays"
            :key="index"
            class="calendar-day"
            :class="{
              'other-month': !item.isCurrentMonth,
              today: item.isToday && !item.isSelected,
              selected: item.isSelected
            }"
            @click="selectDate(item.date)"
          >
            <text class="calendar-day-text">{{ item.day }}</text>
            <view v-if="item.hasRecord" class="record-dot"></view>
          </view>
        </view>
      </view>

      <!-- 展开/收起箭头 -->
      <view class="toggle-bar" @click="toggleCalendar">
        <image
          class="toggle-icon"
          :src="isExpanded ? '/static/image/icon/xiangshang.png' : '/static/image/icon/xiangxia.png'"
          mode="aspectFit"
        />
      </view>
    </view>

    <!-- 饮食记录列表 -->
    <scroll-view class="diet-scroll" scroll-y>
      <view class="diet-list">
        <view v-for="meal in displayMeals" :key="meal.value" class="meal-card">
          <view class="meal-header">
            <text class="meal-title">{{ meal.label }}</text>
            <text class="meal-calorie">{{ getMealCalorie(meal.value) }}kcal</text>
          </view>

          <view v-if="getMealFoods(meal.value).length > 0" class="meal-foods">
            <view
              v-for="(food, fIndex) in getMealFoods(meal.value)"
              :key="fIndex"
              class="food-row"
            >
              <view class="food-main">
                <view class="food-title-wrap">
                  <text class="food-name">{{ food.name }}</text>
                  <text v-if="food.category" class="food-tag">{{ categoryLabel(food.category) }}</text>
                </view>
                <text class="food-quantity">{{ formatFoodQuantity(food) }}</text>
              </view>
              <view class="food-calorie">{{ Math.round(food.calorie || 0) }}kcal</view>
              <view class="food-actions">
                <view class="action-btn edit" @click="editFood(meal.value, food)">修改</view>
                <view class="action-btn delete" @click="deleteFood(meal.value, food)">删除</view>
              </view>
            </view>
          </view>

          <view v-else class="empty-state">
            <view class="empty-icon">
              <image class="empty-svg" src="/static/image/icon/empty_dish.svg" mode="aspectFit" />
            </view>
            <text class="empty-text">暂无记录</text>
          </view>
        </view>

        <!-- 底部占位 -->
        <view class="bottom-placeholder"></view>
      </view>
    </scroll-view>

    <!-- 食物编辑弹窗 -->
    <view class="panel-overlay" :class="{ show: showEditPanel }" @click="closeEditPanel"></view>
    <view class="edit-panel" :class="{ show: showEditPanel }">
      <view class="panel-header">
        <text class="panel-title">编辑{{ editingFood?.name }}</text>
        <text class="panel-close" @click="closeEditPanel">✕</text>
      </view>
      <view class="panel-body">
        <view v-if="!isGramOnlyFood" class="form-row">
          <text class="form-label">数量</text>
          <input v-model="editQuantity" type="digit" class="form-input" />
          <text class="form-unit">{{ editingFood?.unit || '个' }}</text>
        </view>
        <view class="form-row">
          <text class="form-label">重量</text>
          <input v-model="editWeight" type="digit" class="form-input" />
          <text class="form-unit">g</text>
        </view>
        <text class="edit-calorie">{{ editCalorie }} 千卡</text>
      </view>
      <view class="panel-actions">
        <button class="confirm-btn" @click="confirmEdit">确认修改</button>
      </view>
    </view>

    <!-- 底部添加按钮 -->
    <view class="bottom-actions">
      <view class="add-btn-main" @click="addFood">
        <text>添加饮食</text>
      </view>
    </view>

    <!-- 删除食物确认弹框 -->
    <AppModal
      v-model:visible="showDeleteModal"
      icon="none"
      title="提示"
      text="确定删除这条记录吗？"
      confirmText="删除"
      confirmDanger
      cancelText="取消"
      @confirm="confirmDeleteFood"
    />
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi } from '../../api';
import { MEAL_OPTIONS, isDescriptiveUnit } from '../../utils/constants';
import { getToday, formatDate } from '../../utils/date';
import AppModal from '../../components/AppModal.vue';

// 删除食物确认弹框
const showDeleteModal = ref(false);
let pendingDeleteFood = null;

// 日期相关
const today = getToday();
const selectedDate = ref(today);
const isExpanded = ref(false);
const currentMonth = ref(parseLocalDate(today));

// 饮食数据
const dietData = ref({ meals: { breakfast: [], lunch: [], dinner: [], snack: [] }, total_calorie: 0 });

// 有饮食记录的日期集合
const recordDates = ref(new Set());

// 食物编辑弹窗
const showEditPanel = ref(false);
const editingRecord = ref(null);
const editingFoodIndex = ref(-1);
const editingFood = ref(null);
const editQuantity = ref('1');
const editWeight = ref('100');

// 展示早餐/午餐/晚餐/加餐
const displayMeals = MEAL_OPTIONS;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const weekDays = computed(() => getWeekDays(selectedDate.value).map(d => ({ ...d, hasRecord: recordDates.value.has(d.date) })));
const calendarDays = computed(() => getCalendarDays(currentMonth.value).map(d => ({ ...d, hasRecord: recordDates.value.has(d.date) })));
const headerDate = computed(() => {
  const d = currentMonth.value;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}年${m}月`;
});

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekDays(dateStr) {
  const d = parseLocalDate(dateStr);
  const dayOfWeek = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dayOfWeek);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const curStr = formatDate(cur.toISOString());
    days.push({
      date: curStr,
      day: cur.getDate(),
      weekLabel: WEEKDAYS[cur.getDay()],
      isToday: curStr === today,
      isSelected: curStr === selectedDate.value
    });
  }
  return days;
}

function getCalendarDays(monthDate) {
  const d = monthDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days = [];

  // 上月补位
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const cur = new Date(year, month - 1, prevMonthLastDay - i);
    const curStr = formatDate(cur.toISOString());
    days.push({
      date: curStr,
      day: cur.getDate(),
      isCurrentMonth: false,
      isToday: curStr === today,
      isSelected: curStr === selectedDate.value
    });
  }

  // 当月
  for (let i = 1; i <= totalDays; i++) {
    const cur = new Date(year, month, i);
    const curStr = formatDate(cur.toISOString());
    days.push({
      date: curStr,
      day: cur.getDate(),
      isCurrentMonth: true,
      isToday: curStr === today,
      isSelected: curStr === selectedDate.value
    });
  }

  // 下月补位：只补齐当前周；末行若没有当月日期则整行不展示
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const cur = new Date(year, month + 1, i);
    const curStr = formatDate(cur.toISOString());
    days.push({
      date: curStr,
      day: cur.getDate(),
      isCurrentMonth: false,
      isToday: curStr === today,
      isSelected: curStr === selectedDate.value
    });
  }
  // 末行校验：最后一周里「当月日期数 ≤ 2」（即 ≥5/7 都是下月日期），整周删除。
  // 避免月底 1-2 天 + 下月 5-6 天凑一周时，flex-wrap 拆开后最后出现仅 2-3 个零星下月日期的空白行。
  const weeks = Math.floor(days.length / 7);
  if (weeks >= 2) {
    const lastIdx = (weeks - 1) * 7;
    const lastWeek = days.slice(lastIdx, lastIdx + 7);
    const currentCount = lastWeek.filter(d => d.isCurrentMonth).length;
    if (currentCount <= 2) days.splice(lastIdx, 7);
  }
  return days;
}

function selectDate(date) {
  selectedDate.value = date;
  currentMonth.value = parseLocalDate(date);
  load();
  loadRecordDates();
}

function toggleCalendar() {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    currentMonth.value = parseLocalDate(selectedDate.value);
  }
}

function prevMonth() {
  const d = new Date(currentMonth.value);
  d.setMonth(d.getMonth() - 1);
  currentMonth.value = d;
  loadRecordDates();
}

function nextMonth() {
  const d = new Date(currentMonth.value);
  d.setMonth(d.getMonth() + 1);
  currentMonth.value = d;
  loadRecordDates();
}

function getMealCalorie(meal) {
  const items = dietData.value.meals[meal] || [];
  return Math.round(items.reduce((sum, item) => sum + (item.total_calorie || 0), 0));
}

function getMealFoods(meal) {
  const items = dietData.value.meals[meal] || [];
  const foods = [];
  items.forEach(item => {
    if (item.foods && item.foods.length > 0) {
      item.foods.forEach((food, index) => {
        foods.push({ ...food, recordId: item.id, meal_time: item.meal_time, foodIndex: index });
      });
    }
  });
  return foods;
}

const CATEGORY_LABELS = {
  staple: '主食类',
  vegetable: '蔬果类',
  meat: '肉蛋奶',
  bean: '豆/坚果',
  snack: '零食饮料',
  dish: '中西菜肴',
  seasoning: '调味油脂',
  meal_replacement: '代餐特殊'
};

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '';
}

function formatFoodQuantity(food) {
  // 用户口语形容词（如“一把”）只用于估算，不直接展示
  if (food.quantity && food.unit && food.unit !== 'g' && !isDescriptiveUnit(food.unit)) {
    return `${food.quantity}${food.unit}`;
  }
  if (food.weight) {
    return `${food.weight}g`;
  }
  return '';
}

async function load() {
  try {
    const res = await recordApi.getDiet(selectedDate.value);
    dietData.value = res.data;
  } catch (err) {
    console.error('加载饮食记录失败', err);
  }
}

async function loadRecordDates() {
  const start = formatDate(new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1).toISOString());
  const end = formatDate(new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 0).toISOString());
  try {
    const res = await recordApi.getRecordDates({ type: 'diet', start_date: start, end_date: end });
    recordDates.value = new Set(res.data.dates || []);
  } catch (err) {
    console.error('加载饮食记录日期失败', err);
  }
}

function addFood() {
  uni.navigateTo({
    url: `/pages/record/add-food?meal=breakfast&date=${selectedDate.value}&editMode=1`
  });
}

function editFood(meal, food) {
  const record = (dietData.value.meals[meal] || []).find(item => item.id === food.recordId);
  if (!record) return;
  const index = typeof food.foodIndex === 'number' ? food.foodIndex : record.foods.findIndex(f => f === food || (f.name === food.name && f.weight === food.weight));
  if (index < 0 || index >= record.foods.length) return;

  editingRecord.value = record;
  editingFoodIndex.value = index;
  editingFood.value = { ...record.foods[index] };
  editQuantity.value = String(record.foods[index].quantity || 1);
  editWeight.value = String(record.foods[index].weight || 100);
  showEditPanel.value = true;
}

function closeEditPanel() {
  showEditPanel.value = false;
  editingRecord.value = null;
  editingFoodIndex.value = -1;
  editingFood.value = null;
}

const isGramOnlyFood = computed(() => {
  return editingFood.value && ['g', '克'].includes(editingFood.value.unit);
});

const editCalorie = computed(() => {
  if (!editingFood.value) return 0;
  const weight = parseFloat(editWeight.value) || 0;
  const ratio = weight / 100;
  const per100g = editingFood.value.weight > 0
    ? (editingFood.value.calorie / editingFood.value.weight) * 100
    : editingFood.value.calorie || 0;
  return Math.round((per100g || 0) * ratio);
});

async function confirmEdit() {
  if (!editingRecord.value || editingFoodIndex.value < 0 || !editingFood.value) return;
  const food = editingRecord.value.foods[editingFoodIndex.value];
  const weight = parseFloat(editWeight.value) || 100;
  const quantity = parseFloat(editQuantity.value) || 1;

  // 反推每100g营养值
  const caloriePer100g = food.weight > 0 ? (food.calorie / food.weight) * 100 : food.calorie || 0;
  const proteinPer100g = food.weight > 0 ? (food.protein / food.weight) * 100 : food.protein || 0;
  const carbPer100g = food.weight > 0 ? (food.carb / food.weight) * 100 : food.carb || 0;
  const fatPer100g = food.weight > 0 ? (food.fat / food.weight) * 100 : food.fat || 0;

  food.quantity = quantity;
  food.weight = weight;
  food.calorie = Math.round(caloriePer100g * weight / 100 * 10) / 10;
  food.protein = Math.round(proteinPer100g * weight / 100 * 10) / 10;
  food.carb = Math.round(carbPer100g * weight / 100 * 10) / 10;
  food.fat = Math.round(fatPer100g * weight / 100 * 10) / 10;

  try {
    await recordApi.saveDiet({
      id: editingRecord.value.id,
      record_date: selectedDate.value,
      meal_time: editingRecord.value.meal_time,
      foods: editingRecord.value.foods
    });
    uni.showToast({ title: '修改成功', icon: 'success' });
    closeEditPanel();
    load();
    loadRecordDates();
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '修改失败', icon: 'none' });
  }
}

function deleteFood(meal, food) {
  pendingDeleteFood = { meal, food };
  showDeleteModal.value = true;
}

/**
 * 确认删除食物记录
 */
async function confirmDeleteFood() {
  showDeleteModal.value = false;
  const ctx = pendingDeleteFood;
  pendingDeleteFood = null;
  if (!ctx) return;
  const { meal, food } = ctx;
  if (food.recordId === undefined) return;
  try {
    const record = (dietData.value.meals[meal] || []).find(item => item.id === food.recordId);
    if (!record) {
      uni.showToast({ title: '记录不存在', icon: 'none' });
      return;
    }

    const index = typeof food.foodIndex === 'number' ? food.foodIndex : -1;
    const newFoods = [...record.foods];
    if (index >= 0 && index < newFoods.length) {
      newFoods.splice(index, 1);
    } else {
      uni.showToast({ title: '食物不存在', icon: 'none' });
      return;
    }

    if (newFoods.length === 0) {
      await recordApi.deleteDiet(food.recordId);
    } else {
      await recordApi.saveDiet({
        id: record.id,
        record_date: selectedDate.value,
        meal_time: record.meal_time,
        foods: newFoods
      });
    }

    uni.showToast({ title: '删除成功', icon: 'success' });
    load();
    loadRecordDates();
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '删除失败', icon: 'none' });
  }
}

onMounted(() => {
  load();
  loadRecordDates();
});

onShow(() => {
  load();
  loadRecordDates();
});
</script>

<style lang="scss" scoped>
.diet-page {
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
  overflow: hidden;
}
/* 日期模块 */
.date-module {
  position: relative;
  z-index: 1;
  margin: 8rpx 32rpx 0;
  background: #FFFFFF;
  border-radius: 32rpx;
  box-shadow: 0 4rpx 32rpx rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* 收起状态周视图 */
.date-bar {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 16rpx;
}

.date-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 16rpx 0;
  margin: 0 6rpx;
  border-radius: 24rpx;
  transition: background-color 0.2s ease;
}

.date-week {
  font-size: 22rpx;
  font-weight: 600;
  color: #8F9098;
  letter-spacing: 0.5rpx;
  margin-bottom: 6rpx;
  line-height: 28rpx;
}

.date-day {
  font-size: 32rpx;
  font-weight: 400;
  color: #494A50;
  line-height: 40rpx;
}

.record-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #FBE386;
  margin-top: 4rpx;
}

.date-item.today {
  background: #F6F6F6;
}

.date-item.selected {
  background: #8DBB77;
}

.date-item.selected .date-week,
.date-item.selected .date-day {
  color: #FFFFFF;
}

/* 展开状态月历 */
.calendar-panel {
  padding: 24rpx 20rpx 16rpx;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 0 12rpx;
}

.month-arrow {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-icon {
  font-size: 40rpx;
  color: #757B8C;
  font-weight: 400;
  line-height: 1;
}

.arrow-icon.left {
  margin-left: -8rpx;
}

.arrow-icon.right {
  margin-right: -8rpx;
}

.calendar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
  line-height: 40rpx;
}

.calendar-weekdays {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding: 0 8rpx;
}

.calendar-weekday {
  width: 60rpx;
  text-align: center;
  font-size: 24rpx;
  font-weight: 600;
  color: #8DBB77;
  line-height: 30rpx;
}

.calendar-days {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  padding: 0 8rpx;
}

.calendar-day {
  width: 14.2857%;
  flex: 0 0 14.2857%;
  height: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  border-radius: 50%;
}

.calendar-day-text {
  font-size: 26rpx;
  font-weight: 400;
  color: #27282D;
  line-height: 1;
}

.calendar-day.other-month .calendar-day-text {
  color: #999999;
}

.calendar-day.today {
  background: #F0F0F0;
}

.calendar-day.selected {
  background: #8DBB77;
}

.calendar-day.selected .calendar-day-text {
  color: #FFFFFF;
}

/* 展开/收起箭头 */
.toggle-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48rpx;
}

.toggle-icon {
  width: 48rpx;
  height: 24rpx;
}

/* 饮食列表 */
.diet-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  margin-top: 32rpx;
  padding: 0 32rpx;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.diet-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.meal-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
}

.meal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.meal-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 40rpx;
}

.meal-calorie {
  font-size: 28rpx;
  color: #666666;
  line-height: 40rpx;
}

.meal-foods {
  display: flex;
  flex-direction: column;
}

.food-row {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
}

.food-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  min-width: 0;
}

.food-title-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
}

.food-name {
  font-size: 30rpx;
  color: #27282D;
  line-height: 40rpx;
}

.food-tag {
  font-size: 20rpx;
  color: #8DBB77;
  background: #F0F7EC;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  line-height: 28rpx;
  flex-shrink: 0;
}

.food-quantity {
  font-size: 26rpx;
  color: #999999;
  line-height: 40rpx;
}

.food-calorie {
  font-size: 26rpx;
  color: #999999;
  line-height: 40rpx;
  margin-right: 16rpx;
  min-width: 90rpx;
  text-align: right;
}

.food-actions {
  display: flex;
  gap: 12rpx;
  flex-shrink: 0;
}

.action-btn {
  width: 72rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  font-size: 22rpx;
  line-height: 1;
}

.action-btn.edit {
  background: #F0F0F0;
  color: #666666;
}

.action-btn.delete {
  background: #FFCECE;
  color: #ED3030;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx 0 32rpx;
}

.empty-icon {
  width: 132rpx;
  height: 132rpx;
  margin-bottom: 16rpx;
}

.empty-svg {
  width: 100%;
  height: 100%;
}

.empty-text {
  font-size: 26rpx;
  color: #999999;
  line-height: 40rpx;
}

.bottom-placeholder {
  height: 160rpx;
}

/* 底部按钮 */
.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 48rpx calc(24rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(240, 240, 240, 0) 0%, #F0F0F0 40%);
  z-index: 100;
}

.add-btn-main {
  height: 92rpx;
  background: #FBE386;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  color: #27282D;
  font-weight: 400;
}

.add-btn-main:active {
  opacity: 0.9;
}

/* 编辑弹窗 */
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1999;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.panel-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.edit-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  border-radius: 48rpx 48rpx 0 0;
  padding: 48rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  z-index: 2000;
  transform: translateY(100%);
  transition: transform 0.3s ease;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.12);
}

.edit-panel.show {
  transform: translateY(0);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48rpx;
}

.panel-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #27282D;
}

.panel-close {
  font-size: 40rpx;
  color: #9CA3AF;
  padding: 8rpx;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 32rpx;
}

.form-label {
  width: 100rpx;
  font-size: 30rpx;
  color: #666666;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  height: 88rpx;
  background: #F5F7FA;
  border-radius: 24rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  color: #27282D;
  text-align: right;
}

.form-unit {
  width: 60rpx;
  font-size: 30rpx;
  color: #666666;
  text-align: right;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.edit-calorie {
  display: block;
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  color: #8DBB77;
  margin: 48rpx 0;
}

.panel-actions {
  display: flex;
}

.confirm-btn {
  flex: 1;
  height: 92rpx;
  line-height: 92rpx;
  background: #8DBB77;
  color: #FFFFFF;
  border-radius: 999rpx;
  font-size: 34rpx;
  font-weight: 500;
  border: none;
}

.confirm-btn::after {
  border: none;
}
</style>
