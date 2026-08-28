<template>
  <AppPage :showHeader="true" title="记运动">
  <view class="exercise-page">
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

    <!-- 运动记录列表 -->
    <scroll-view class="exercise-scroll" scroll-y>
      <view class="exercise-list">
        <view
          v-for="item in todayRecords"
          :key="item.id"
          class="record-card"
        >
          <view class="record-header">
            <text class="record-title">{{ getExerciseNames(item.exercises) }}</text>
            <text class="record-calorie">{{ Math.round(item.total_calorie || 0) }} kcal</text>
          </view>

          <view class="record-body">
            <text class="record-duration">{{ item.total_duration }} 分钟</text>
            <text v-if="getExerciseDistance(item.exercises)" class="record-distance">{{ getExerciseDistance(item.exercises) }} 公里</text>
            <view class="record-actions">
              <view class="action-btn edit" @click="editItem(item)">修改</view>
              <view class="action-btn delete" @click="deleteItem(item.id)">删除</view>
            </view>
          </view>
        </view>

        <view v-if="todayRecords.length === 0" class="empty-state">
          <view class="empty-icon">
            <image class="empty-svg" src="/static/image/icon/empty_dish.svg" mode="aspectFit" />
          </view>
          <text class="empty-text">暂无记录</text>
        </view>

        <!-- 底部占位 -->
        <view class="bottom-placeholder"></view>
      </view>
    </scroll-view>

    <!-- 底部添加按钮 -->
    <view class="bottom-actions">
      <view class="add-btn-main" @click="addExercise">
        <text>添加运动</text>
      </view>
    </view>

    <!-- 编辑弹窗 -->
    <view v-if="showEditModal" class="modal-mask" @click="closeEditModal"></view>
    <view v-if="showEditModal" class="edit-modal">
      <view class="modal-header">
        <text class="modal-title">编辑运动</text>
        <text class="modal-close" @click="closeEditModal">✕</text>
      </view>
      <view v-if="editingItem && editingItem.exercises" class="modal-body">
        <view v-for="(exercise, index) in editingItem.exercises" :key="index" class="edit-exercise-row">
          <text class="edit-exercise-name">{{ exercise.name }}</text>
          <view class="edit-field">
            <text class="edit-label">时长</text>
            <input v-model="editDurations[index]" type="digit" class="edit-input" />
            <text class="edit-unit">分钟</text>
          </view>
          <view class="edit-field" v-if="exercise.distance !== undefined">
            <text class="edit-label">距离</text>
            <input v-model="editDistances[index]" type="digit" class="edit-input" />
            <text class="edit-unit">km</text>
          </view>
          <view class="edit-field" v-if="exercise.sets !== undefined">
            <text class="edit-label">组数</text>
            <input v-model="editSets[index]" type="digit" class="edit-input" />
            <text class="edit-unit">组</text>
          </view>
          <view class="edit-field" v-if="exercise.reps !== undefined">
            <text class="edit-label">次数</text>
            <input v-model="editReps[index]" type="digit" class="edit-input" />
            <text class="edit-unit">次</text>
          </view>
        </view>
        <view class="edit-calorie">
          <text>热量: {{ editTotalCalorie }} kcal</text>
        </view>
      </view>
      <view class="modal-footer">
        <view class="modal-btn secondary" @click="closeEditModal">取消</view>
        <view class="modal-btn primary" @click="saveEdit">保存</view>
      </view>
    </view>

    <!-- 删除运动确认弹框 -->
    <AppModal
      v-model:visible="showDeleteModal"
      icon="none"
      title="提示"
      text="确定删除这条记录吗？"
      confirmText="删除"
      confirmDanger
      cancelText="取消"
      @confirm="confirmDeleteItem"
    />
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { recordApi } from '../../api';
import { EXERCISE_TYPES } from '../../utils/constants';
import { getToday, formatDate } from '../../utils/date';
import AppModal from '../../components/AppModal.vue';

// 删除确认弹框
const showDeleteModal = ref(false);
let pendingDeleteId = null;

// 日期相关
const today = getToday();
const selectedDate = ref(today);
const isExpanded = ref(false);
const currentMonth = ref(parseLocalDate(today));

// 运动数据
const exerciseData = ref({ total_calorie: 0, total_duration: 0, types: { aerobic: [], strength: [], stretch: [], ball: [] } });

// 有运动记录的日期集合
const recordDates = ref(new Set());

// 编辑弹窗状态
const showEditModal = ref(false);
const editingItem = ref(null);
const editDurations = ref([]);
const editDistances = ref([]);
const editSets = ref([]);
const editReps = ref([]);

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const weekDays = computed(() => getWeekDays(selectedDate.value).map(d => ({ ...d, hasRecord: recordDates.value.has(d.date) })));
const calendarDays = computed(() => getCalendarDays(currentMonth.value).map(d => ({ ...d, hasRecord: recordDates.value.has(d.date) })));
const headerDate = computed(() => {
  const d = parseLocalDate(selectedDate.value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
});

const todayRecords = computed(() => {
  const all = [];
  const types = exerciseData.value.types || {};
  for (const type of Object.keys(types)) {
    for (const item of types[type]) {
      all.push({ ...item, exercise_type: type });
    }
  }
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
});

const editTotalCalorie = computed(() => {
  if (!editingItem.value || !editingItem.value.exercises) return 0;
  return Math.round(editingItem.value.exercises.reduce((sum, exercise, index) => {
    const duration = parseFloat(editDurations.value[index]) || exercise.duration || 30;
    const caloriePerMin = (exercise.calorie || 0) / (exercise.duration || 30);
    return sum + (caloriePerMin * duration);
  }, 0));
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
  // 2026.8 月底实测：最后一周 = [8/30, 8/31, 9/1~5] → 当月仅 2 天 → 触发删除 ✅
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
  load(date);
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

function getExerciseNames(exercises) {
  if (!exercises || exercises.length === 0) return '未知运动';
  const uniqueNames = [...new Set(exercises.map(e => e.name))];
  return uniqueNames.join('、');
}

// 汇总记录中的距离（公里），无距离数据时返回空串
function getExerciseDistance(exercises) {
  if (!exercises || exercises.length === 0) return '';
  const total = exercises.reduce((sum, e) => sum + (parseFloat(e.distance) || 0), 0);
  return total > 0 ? (Math.round(total * 10) / 10).toString() : '';
}

async function load(date = getToday()) {
  try {
    const res = await recordApi.getExercise(date);
    exerciseData.value = res.data;
  } catch (err) {
    console.error('加载运动记录失败', err);
  }
}

async function loadRecordDates() {
  const start = formatDate(new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1).toISOString());
  const end = formatDate(new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 0).toISOString());
  try {
    const res = await recordApi.getRecordDates({ type: 'exercise', start_date: start, end_date: end });
    recordDates.value = new Set(res.data.dates || []);
  } catch (err) {
    console.error('加载运动记录日期失败', err);
  }
}

function addExercise() {
  uni.navigateTo({
    url: `/pages/record/add-exercise?date=${selectedDate.value}`
  });
}

function editItem(item) {
  editingItem.value = JSON.parse(JSON.stringify(item));
  editDurations.value = item.exercises.map(e => String(e.duration || 30));
  editDistances.value = item.exercises.map(e => String(e.distance || 0));
  editSets.value = item.exercises.map(e => String(e.sets || 0));
  editReps.value = item.exercises.map(e => String(e.reps || 0));
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingItem.value = null;
  editDurations.value = [];
  editDistances.value = [];
  editSets.value = [];
  editReps.value = [];
}

async function saveEdit() {
  if (!editingItem.value) return;

  const exercises = editingItem.value.exercises.map((exercise, index) => {
    const duration = parseFloat(editDurations.value[index]) || exercise.duration || 30;
    const ratio = duration / (exercise.duration || 30);
    return {
      ...exercise,
      duration: duration,
      distance: parseFloat(editDistances.value[index]) || exercise.distance || undefined,
      sets: parseFloat(editSets.value[index]) || exercise.sets || undefined,
      reps: parseFloat(editReps.value[index]) || exercise.reps || undefined,
      calorie: Math.round((exercise.calorie || 0) * ratio)
    };
  });

  const totalDuration = exercises.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalCalorie = exercises.reduce((sum, e) => sum + (e.calorie || 0), 0);

  try {
    await recordApi.saveExercise({
      id: editingItem.value.id,
      record_date: selectedDate.value,
      exercise_type: editingItem.value.exercise_type || 'aerobic',
      exercises,
      total_duration: totalDuration,
      total_calorie: totalCalorie
    });
    uni.showToast({ title: '修改成功', icon: 'success' });
    closeEditModal();
    load(selectedDate.value);
    loadRecordDates();
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}

async function deleteItem(id) {
  pendingDeleteId = id;
  showDeleteModal.value = true;
}

/**
 * 确认删除运动记录
 */
async function confirmDeleteItem() {
  showDeleteModal.value = false;
  const id = pendingDeleteId;
  pendingDeleteId = null;
  if (id == null) return;
  await recordApi.deleteExercise(id);
  load(selectedDate.value);
  loadRecordDates();
}

onMounted(() => {
  load();
  loadRecordDates();
});

onShow(() => {
  load(selectedDate.value);
  loadRecordDates();
});
</script>

<style lang="scss" scoped>
.exercise-page {
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
  /* 强制左对齐：只剩 2-3 个日期时也紧贴左侧，不会被 space-between 分到两端中间空一大段 */
  justify-content: flex-start;
  padding: 0 8rpx;
}

.calendar-day {
  /* 严格 1/7 百分比宽度：每行恰好 7 个日期，不随容器宽度浮动折行到错乱 */
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

/* 运动列表 */
.exercise-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  margin-top: 32rpx;
  padding: 0 32rpx;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.record-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.record-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 500;
  color: #27282D;
  line-height: 40rpx;
  margin-right: 20rpx;
}

.record-calorie {
  font-size: 32rpx;
  font-weight: 700;
  color: #8DBB77;
  line-height: 40rpx;
}

.record-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.record-duration {
  font-size: 26rpx;
  color: #999999;
  line-height: 40rpx;
}

.record-distance {
  font-size: 26rpx;
  color: #8DBB77;
  line-height: 40rpx;
  margin-left: 16rpx;
}

.record-actions {
  display: flex;
  gap: 12rpx;
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
  padding: 80rpx 0 32rpx;
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
  background: #F7FbF4;
  z-index: 100;
  display: flex;
  gap: 24rpx;
}

.add-btn-main {
  flex: 1;
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

.add-btn-main.secondary {
  background: #fff;
  border: 2rpx solid #8DBB77;
  color: #8DBB77;
}

.add-btn-main:active {
  opacity: 0.9;
}

/* 编辑弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.edit-modal {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  z-index: 1001;
  max-height: 70vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #27282D;
}

.modal-close {
  font-size: 36rpx;
  color: #999999;
}

.modal-body {
  margin-bottom: 24rpx;
}

.edit-exercise-row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F0F2F5;
  margin-bottom: 16rpx;
}

.edit-exercise-row:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.edit-exercise-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #27282D;
  display: block;
  margin-bottom: 16rpx;
}

.edit-field {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.edit-label {
  width: 120rpx;
  font-size: 24rpx;
  color: #6B7280;
}

.edit-input {
  flex: 1;
  height: 72rpx;
  background: #F5F7FA;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #27282D;
  text-align: right;
}

.edit-unit {
  width: 80rpx;
  font-size: 24rpx;
  color: #9CA3AF;
  text-align: right;
  margin-left: 8rpx;
}

.edit-calorie {
  text-align: center;
  padding: 16rpx 0;
  font-size: 32rpx;
  font-weight: 700;
  color: #8DBB77;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 500;
}

.modal-btn.secondary {
  background: #F0F0F0;
  color: #666666;
}

.modal-btn.primary {
  background: #8DBB77;
  color: #FFFFFF;
}
</style>
