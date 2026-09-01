<template>
  <AppPage :showHeader="true" title="添加运动">
  <view class="add-exercise-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="请输入运动名称"
        confirm-type="search"
        @confirm="searchExercises"
      />
      <image class="search-icon" src="/static/image/icon/sousuo.svg" mode="aspectFit" @click="searchExercises" />
    </view>

    <!-- 左侧分类 + 右侧运动列表 -->
    <view class="content-body">
      <scroll-view class="category-sidebar" scroll-y :show-scrollbar="false">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="category-item"
          :class="{ active: currentCategory === cat.key }"
          @click="currentCategory = cat.key; searchExercises()"
        >
          <text class="category-text">{{ cat.label }}</text>
        </view>
      </scroll-view>

      <scroll-view class="exercise-scroll" scroll-y>
        <view v-if="exercises.length > 0" class="exercise-list">
          <view v-for="ex in exercises" :key="ex.id" class="exercise-item">
            <view class="exercise-main">
              <text class="exercise-name">{{ ex.name }}</text>
              <view class="exercise-tags">
                <text class="tag intensity">{{ ex.intensity_desc || ex.intensity }}</text>
                <text class="tag category">{{ ex.sub_category || ex.category }}</text>
              </view>
            </view>
            <text class="exercise-calorie">{{ ex.calorie_per_hour }}千卡/小时</text>
            <image class="add-btn" src="/static/image/icon/tianjia.svg" mode="aspectFit" @click="selectExercise(ex)" />
          </view>
        </view>
        <view v-else class="empty-tip">
          <text>搜索或选择分类查看运动</text>
        </view>
      </scroll-view>
    </view>

    <!-- 底部已选栏 -->
    <view class="bottom-bar">
      <view class="bottom-content">
        <view class="selected-summary" @click="showSelectedPanel = true">
          <text class="selected-label">已选运动({{ selectedExercises.length }})</text>
          <image class="selected-arrow" src="/static/image/icon/zhankai01.svg" mode="aspectFit" />
        </view>
        <view class="complete-btn" :class="{ disabled: loading }" @click="submit">完成</view>
      </view>
    </view>

    <!-- 已选运动弹窗 -->
    <view v-if="showSelectedPanel" class="selected-mask" @click="showSelectedPanel = false">
      <view class="selected-panel" @click.stop>
        <view class="panel-header">
          <text class="panel-title">已选运动</text>
          <text class="panel-close" @click="showSelectedPanel = false">✕</text>
        </view>
        <view v-for="(ex, index) in selectedExercises" :key="index" class="selected-item" @click="openEditExercise(index)">
          <view class="selected-info">
            <text class="selected-name">{{ ex.name }}</text>
            <view class="selected-detail">
              <text class="selected-duration">{{ ex.duration }}分钟</text>
              <text class="selected-calorie">{{ ex.calorie }}千卡</text>
              <text v-if="ex.distance" class="selected-extra">{{ ex.distance }}公里</text>
              <text v-if="ex.sets" class="selected-extra">{{ ex.sets }}组×{{ ex.reps }}次</text>
            </view>
          </view>
          <text class="delete-btn" @click.stop="removeExercise(index)">✕</text>
        </view>
        <AppEmpty v-if="selectedExercises.length === 0" text="还没有选择运动" icon="🤸" />
      </view>
    </view>

    <!-- 添加/编辑运动弹窗 -->
    <view v-if="showExerciseEditModal" class="exercise-edit-mask" @click="onMaskClick">
      <view class="exercise-edit-panel" @click.stop @tap.stop>
        <view class="panel-header">
          <text class="panel-title">{{ editMode === 'edit' ? '编辑' : '添加' }}{{ editingExerciseName }}</text>
          <text class="panel-close" @click="closeExerciseEditModal">✕</text>
        </view>
        <view class="exercise-edit-body">
          <view class="edit-row">
            <text class="edit-label">时长</text>
            <input v-model="editDuration" type="digit" class="edit-input" />
            <text class="edit-unit">分钟</text>
          </view>
          <view class="edit-row" v-if="showDistance">
            <text class="edit-label">距离</text>
            <input v-model="editDistance" type="digit" class="edit-input" placeholder="0" />
            <text class="edit-unit">公里</text>
          </view>
          <view class="edit-row" v-if="showCount">
            <text class="edit-label">组数</text>
            <input v-model="editSets" type="digit" class="edit-input" placeholder="0" />
            <text class="edit-unit">组</text>
          </view>
          <view class="edit-row" v-if="showCount">
            <text class="edit-label">每组次数</text>
            <input v-model="editReps" type="digit" class="edit-input" placeholder="0" />
            <text class="edit-unit">次</text>
          </view>
          <view class="edit-info">
            <text class="edit-calorie">🔥 {{ editCalorie }} 千卡</text>
          </view>
        </view>
        <view class="exercise-edit-footer">
          <AppButton v-if="editMode === 'add'" block @click="confirmAddExercise">确认添加</AppButton>
          <AppButton v-else block @click="confirmEditExercise">确认修改</AppButton>
        </view>
      </view>
    </view>
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { recordApi, systemApi } from '../../api';
import { showRewardToast } from '../../utils/rewardToast.js';
import AppButton from '../../components/AppButton.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import { getToday } from '../../utils/date';

const isEdit = ref(false);
const loading = ref(false);
const keyword = ref('');
const exercises = ref([]);
const selectedExercises = ref([]);
const pageQuery = ref({});
const showSelectedPanel = ref(false);
const currentCategory = ref('all');

// 当前记录日期，默认今天
const recordDate = ref(getToday());

const headerDate = computed(() => {
  const d = new Date(recordDate.value);
  if (isNaN(d.getTime())) return recordDate.value;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
});

// 运动编辑弹窗
const showExerciseEditModal = ref(false);
const editingExercise = ref(null);
const editDuration = ref('30');
const editDistance = ref('');
const editSets = ref('');
const editReps = ref('');
const editMode = ref('add');
const editingIndex = ref(-1);

// 计算属性：实时计算热量
const editCalorie = computed(() => {
  if (!editingExercise.value) return 0;
  const duration = parseFloat(editDuration.value) || 0;
  if (duration > 0 && editingExercise.value.calorie_per_hour > 0) {
    return Math.round(editingExercise.value.calorie_per_hour * (duration / 60));
  }
  return 0;
});

/** 当前编辑运动的名称（安全访问，避免模板可选链） */
const editingExerciseName = computed(() => {
  return editingExercise.value ? editingExercise.value.name : '';
});

/** 是否显示距离输入行（安全访问，避免模板可选链） */
const showDistance = computed(() => {
  return editingExercise.value ? !!editingExercise.value.showDistance : false;
});

/** 是否显示次数/组数输入行（安全访问，避免模板可选链） */
const showCount = computed(() => {
  return editingExercise.value ? !!editingExercise.value.showCount : false;
});

// 运动分类
const categories = [
  { key: 'all', label: '全部' },
  { key: '有氧运动', label: '有氧' },
  { key: '力量抗阻训练', label: '力量' },
  { key: '拉伸瑜伽轻活动', label: '拉伸' },
  { key: '球类运动', label: '球类' },
  { key: '水上运动', label: '水上' },
  { key: '骑行运动', label: '骑行' },
  { key: '户外与极限运动', label: '户外' },
  { key: '网红跟练课程', label: '跟练' }
];

onMounted(() => {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  // 微信端参数在原生 page.options 上，$page?.options 仅作兜底
  pageQuery.value = cur.options || cur.$page?.options || {};
  if (pageQuery.value.date) {
    recordDate.value = pageQuery.value.date;
  }
  if (pageQuery.value.id) {
    isEdit.value = true;
    loadDetail(pageQuery.value.id);
  }
  // 默认加载运动
  searchExercises();
});

// 获取运动图标
function getExerciseIcon(ex) {
  const category = ex.category || '';
  const name = ex.name || '';
  if (category.includes('有氧') || name.includes('跑') || name.includes('跳')) return '🏃';
  if (category.includes('力量') || name.includes('深蹲') || name.includes('哑铃')) return '💪';
  if (category.includes('拉伸') || name.includes('瑜伽')) return '🧘';
  if (category.includes('球')) return '🏀';
  if (category.includes('水上') || name.includes('泳')) return '🏊';
  if (category.includes('骑行') || name.includes('骑')) return '🚴';
  if (category.includes('户外') || name.includes('山')) return '🧗';
  return '🤸';
}

async function searchExercises() {
  try {
    const params = { size: 999 };
    if (keyword.value.trim()) params.keyword = keyword.value;
    if (currentCategory.value !== 'all') params.category = currentCategory.value;
    const res = await systemApi.getExercises(params);
    exercises.value = res.data.list || [];
  } catch (err) {
    console.error(err);
  }
}

async function loadDetail(id) {
  try {
    const res = await recordApi.getExercise(recordDate.value);
    const all = Object.values(res.data.types).flat();
    const item = all.find(i => String(i.id) === id);
    if (item) {
      selectedExercises.value = item.exercises.map(e => ({
        ...e,
        duration: e.duration || 30,
        calorie: e.calorie || 0,
        category: e.category || '有氧运动',
        intensity_desc: e.intensity === 'low' ? '低强度' : e.intensity === 'high' ? '高强度' : '中等强度',
        showDistance: isDistanceExercise(e.name),
        showCount: isCountExercise(e.name),
        distance: e.distance || '',
        sets: e.sets || '',
        reps: e.reps || ''
      }));
    }
  } catch (err) {
    console.error(err);
  }
}

// 判断是否是距离类运动
function isDistanceExercise(name) {
  const distanceKeywords = ['跑', '走', '骑', '游', '步', '行', '爬', '登', '越野', '马拉松'];
  return distanceKeywords.some(k => name.includes(k));
}

// 判断是否是次数/组数类运动
function isCountExercise(name) {
  const countKeywords = ['深蹲', '俯卧撑', '仰卧起坐', '卷腹', '平板支撑', '引体向上', '哑铃', '杠铃', '器械', '壶铃', '弹力带', 'TRX', '战绳', '波比跳', '开合跳', '高抬腿', '登山跑', '臀桥', '硬拉', '卧推', '划船', '推举', '弯举', '飞鸟', '侧平举', '前平举', '夹胸', '腿举', '腿弯举', '腿屈伸', '史密斯', '龙门架', '蝴蝶机'];
  return countKeywords.some(k => name.includes(k));
}

function openExerciseEditModal(ex) {
  editingExercise.value = ex;
  editDuration.value = '30';
  editDistance.value = '';
  editSets.value = '';
  editReps.value = '';
  editMode.value = 'add';
  editingIndex.value = -1;
  showExerciseEditModal.value = true;
}

function openEditExercise(index) {
  const ex = selectedExercises.value[index];
  if (!ex) return;
  editingExercise.value = ex;
  editDuration.value = String(ex.duration || 30);
  editDistance.value = String(ex.distance || '');
  editSets.value = String(ex.sets || '');
  editReps.value = String(ex.reps || '');
  editMode.value = 'edit';
  editingIndex.value = index;
  showExerciseEditModal.value = true;
}

function closeExerciseEditModal() {
  showExerciseEditModal.value = false;
  editingExercise.value = null;
  editingIndex.value = -1;
}

function onMaskClick(e) {
  if (e.target === e.currentTarget) {
    closeExerciseEditModal();
  }
}

function selectExercise(ex) {
  openExerciseEditModal(ex);
}

function confirmAddExercise() {
  if (!editingExercise.value) return;
  const duration = parseFloat(editDuration.value) || 30;
  const calorie = Math.round((editingExercise.value.calorie_per_hour || 0) * (duration / 60));
  
  selectedExercises.value.push({
    name: editingExercise.value.name,
    duration: duration,
    intensity: editingExercise.value.intensity || 'moderate',
    intensity_desc: editingExercise.value.intensity_desc || '中等强度',
    category: editingExercise.value.category || '有氧运动',
    sub_category: editingExercise.value.sub_category || '',
    calorie: calorie,
    calorie_per_hour: editingExercise.value.calorie_per_hour || 0,
    met_value: editingExercise.value.met_value || 0,
    showDistance: editingExercise.value.showDistance || isDistanceExercise(editingExercise.value.name),
    showCount: editingExercise.value.showCount || isCountExercise(editingExercise.value.name),
    distance: editDistance.value ? parseFloat(editDistance.value) : null,
    sets: editSets.value ? parseInt(editSets.value) : null,
    reps: editReps.value ? parseInt(editReps.value) : null
  });
  closeExerciseEditModal();
  uni.showToast({ title: '已添加', icon: 'none' });
}

function confirmEditExercise() {
  if (editingIndex.value < 0) return;
  const ex = selectedExercises.value[editingIndex.value];
  if (!ex) return;
  ex.duration = parseFloat(editDuration.value) || 30;
  ex.distance = editDistance.value ? parseFloat(editDistance.value) : null;
  ex.sets = editSets.value ? parseInt(editSets.value) : null;
  ex.reps = editReps.value ? parseInt(editReps.value) : null;
  // 重新计算热量
  if (ex.calorie_per_hour > 0) {
    ex.calorie = Math.round(ex.calorie_per_hour * (ex.duration / 60));
  }
  closeExerciseEditModal();
  uni.showToast({ title: '已修改', icon: 'none' });
}

function removeExercise(index) {
  selectedExercises.value.splice(index, 1);
}

async function submit() {
  if (selectedExercises.value.length === 0) {
    uni.showToast({ title: '请至少选择一项运动', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const exercises = selectedExercises.value.map(e => ({
      name: e.name,
      duration: parseFloat(e.duration) || 30,
      intensity: e.intensity || 'moderate',
      calorie: parseFloat(e.calorie) || 0,
      distance: e.distance || null,
      sets: e.sets || null,
      reps: e.reps || null
    }));
    
    const firstEx = selectedExercises.value[0];
    const categoryToType = {
      '有氧运动': 'aerobic',
      '骑行运动': 'aerobic',
      '球类运动': 'ball',
      '水上运动': 'aerobic',
      '力量抗阻训练': 'strength',
      '拉伸瑜伽轻活动': 'stretch',
      '户外与极限运动': 'aerobic',
      '器械有氧': 'aerobic',
      '网红跟练课程': 'aerobic'
    };
    const exerciseType = categoryToType[firstEx.category] || 'aerobic';
    
    const data = {
      record_date: recordDate.value,
      exercise_type: exerciseType,
      exercises
    };
    if (isEdit.value && pageQuery.value.id) {
      data.id = parseInt(pageQuery.value.id);
    }
    const res = await recordApi.saveExercise(data);
    showRewardToast(res.data?.reward_messages || [], '保存成功');
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
.add-exercise-page {
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

/* 内容主体：分类 + 运动列表 */
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

/* 右侧运动列表 */
.exercise-scroll {
  flex: 1;
  height: 100%;
  margin-left: 16rpx;
  background: #FFFFFF;
}

.exercise-list {
  padding: 16rpx 24rpx;
}

.exercise-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F0F2F5;
}

.exercise-item:last-child {
  border-bottom: none;
}

.exercise-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.exercise-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 44rpx;
}

.exercise-tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}

.tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  line-height: 28rpx;
}

.tag.intensity {
  background: #E8F5FF;
  color: #4A90D9;
}

.tag.category {
  background: #F0F7EC;
  color: #8DBB77;
}

.exercise-calorie {
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
  flex-wrap: wrap;
}

.selected-duration,
.selected-calorie,
.selected-extra {
  font-size: 24rpx;
  color: #8F9098;
}

.delete-btn {
  color: #E57373;
  font-size: 32rpx;
  padding: 0 16rpx;
}

/* 运动编辑弹窗 */
.exercise-edit-mask {
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

.exercise-edit-panel {
  width: 100%;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
}

.exercise-edit-body {
  padding: 24rpx 0;
}

.edit-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #F0F2F5;
}

.edit-label {
  width: 140rpx;
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
  width: 80rpx;
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

.exercise-edit-footer {
  margin-top: 24rpx;
}
</style>