<template>
  <AppPage>
    <AppHeader title="里程碑" />
    <view class="milestone-page">
      <!-- 总览卡片 -->
      <view class="summary-card">
        <text class="summary-title">已获得里程碑</text>
        <view class="summary-progress">
          <text class="summary-num">{{ unlockedCount }}</text>
          <text class="summary-total">/ {{ milestones.length }}</text>
        </view>
        <view class="summary-categories">
          <view v-for="cat in categoryStats" :key="cat.key" class="cat-stat">
            <text class="cat-stat-num">{{ cat.unlocked }}</text>
            <text class="cat-stat-label">{{ cat.label }}</text>
          </view>
        </view>
      </view>

      <!-- 分类标签 -->
      <view class="category-tabs">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="tab-item"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          <text class="tab-text">{{ cat.label }}</text>
          <text class="tab-count">{{ cat.unlocked }}/{{ cat.total }}</text>
        </view>
      </view>

      <!-- 里程碑列表 -->
      <view class="milestone-list">
        <view
          v-for="item in filteredMilestones"
          :key="item.id"
          class="milestone-item"
          :class="{ unlocked: item.unlocked, locked: !item.unlocked }"
        >
          <view class="milestone-icon-wrap">
            <text class="milestone-icon">{{ item.icon }}</text>
            <view v-if="item.unlocked" class="unlocked-badge">✓</view>
          </view>
          <view class="milestone-info">
            <text class="milestone-name">{{ item.name }}</text>
            <text class="milestone-desc">{{ item.description }}</text>
            <text v-if="item.unlocked && item.unlockedAt" class="milestone-time">{{ formatDate(item.unlockedAt) }}</text>
            <text v-else-if="!item.unlocked && item.progress !== undefined" class="milestone-progress">进度 {{ item.progress }}/{{ item.target }}</text>
          </view>
        </view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import { recordApi } from '../../api';

// ==================== 里程碑定义 ====================
const milestoneDefinitions = [
  // 1. 基础减重里程碑
  { id: 'loss_1kg', category: 'weight', name: '初见成效', description: '累计减重 1kg', icon: '🌱', target: 1, type: 'weight_loss', condition: 1 },
  { id: 'loss_3kg', category: 'weight', name: '小有成就', description: '累计减重 3kg', icon: '🌿', target: 3, type: 'weight_loss', condition: 3 },
  { id: 'loss_5kg', category: 'weight', name: '稳步前行', description: '累计减重 5kg', icon: '🍃', target: 5, type: 'weight_loss', condition: 5 },
  { id: 'loss_10kg', category: 'weight', name: '蜕变之路', description: '累计减重 10kg', icon: '🔥', target: 10, type: 'weight_loss', condition: 10 },
  { id: 'loss_15kg', category: 'weight', name: '惊人蜕变', description: '累计减重 15kg', icon: '⚡', target: 15, type: 'weight_loss', condition: 15 },
  { id: 'loss_20kg', category: 'weight', name: '重塑自我', description: '累计减重 20kg', icon: '💎', target: 20, type: 'weight_loss', condition: 20 },
  { id: 'weight_95pct', category: 'weight', name: '九五之尊', description: '达到初始体重的 95%', icon: '📊', target: 95, type: 'weight_pct', condition: 95 },
  { id: 'weight_90pct', category: 'weight', name: '九成功力', description: '达到初始体重的 90%', icon: '📉', target: 90, type: 'weight_pct', condition: 90 },
  { id: 'weight_85pct', category: 'weight', name: '八五高手', description: '达到初始体重的 85%', icon: '🎯', target: 85, type: 'weight_pct', condition: 85 },
  { id: 'reach_target', category: 'weight', name: '梦想成真', description: '达到目标体重', icon: '👑', target: 1, type: 'reach_target', condition: 1 },

  // 2. 围度塑形里程碑
  { id: 'waist_2cm', category: 'measure', name: '腰围初减', description: '腰围减少 2cm', icon: '📏', target: 2, type: 'waist_loss', condition: 2 },
  { id: 'waist_5cm', category: 'measure', name: '腰围锐减', description: '腰围减少 5cm', icon: '🎀', target: 5, type: 'waist_loss', condition: 5 },
  { id: 'waist_10cm', category: 'measure', name: '腰精诞生', description: '腰围减少 10cm', icon: '✨', target: 10, type: 'waist_loss', condition: 10 },
  { id: 'thigh_2cm', category: 'measure', name: '大腿初瘦', description: '大腿围减少 2cm', icon: '🦵', target: 2, type: 'thigh_loss', condition: 2 },
  { id: 'thigh_5cm', category: 'measure', name: '美腿成型', description: '大腿围减少 5cm', icon: '👗', target: 5, type: 'thigh_loss', condition: 5 },
  { id: 'hip_3cm', category: 'measure', name: '臀围优化', description: '臀围减少 3cm', icon: '🍑', target: 3, type: 'hip_loss', condition: 3 },
  { id: 'arm_1cm', category: 'measure', name: '手臂紧致', description: '臂围减少 1cm', icon: '💪', target: 1, type: 'arm_loss', condition: 1 },
  { id: 'whr_standard', category: 'measure', name: '黄金比例', description: '腰臀比达标', icon: '⭐', target: 1, type: 'whr_standard', condition: 1 },

  // 3. 体成分里程碑
  { id: 'fat_1pct', category: 'body', name: '脂肪初降', description: '体脂率下降 1%', icon: '📉', target: 1, type: 'fat_loss_pct', condition: 1 },
  { id: 'fat_3pct', category: 'body', name: '脂肪锐减', description: '体脂率下降 3%', icon: '🧊', target: 3, type: 'fat_loss_pct', condition: 3 },
  { id: 'fat_5pct', category: 'body', name: '脂肪克星', description: '体脂率下降 5%', icon: '❄️', target: 5, type: 'fat_loss_pct', condition: 5 },
  { id: 'fat_standard', category: 'body', name: '体脂达标', description: '体脂率达标', icon: '🏅', target: 1, type: 'fat_standard', condition: 1 },
  { id: 'visceral_1', category: 'body', name: '内脏减负', description: '内脏脂肪等级下降 1 级', icon: '🛡️', target: 1, type: 'visceral_loss', condition: 1 },
  { id: 'visceral_standard', category: 'body', name: '内脏健康', description: '内脏脂肪等级达标', icon: '💚', target: 1, type: 'visceral_standard', condition: 1 },
  { id: 'muscle_1kg', category: 'body', name: '肌肉增长', description: '肌肉量提升 1kg', icon: '🏋️', target: 1, type: 'muscle_gain', condition: 1 },
  { id: 'bmr_5pct', category: 'body', name: '代谢提升', description: '基础代谢率提升 5%', icon: '⚡', target: 5, type: 'bmr_gain_pct', condition: 5 },

  // 4. 特殊里程碑
  { id: 'plateau_break', category: 'special', name: '突破平台', description: '连续 2 周体重无变化后再次下降', icon: '🚀', target: 1, type: 'plateau_break', condition: 1 },
  { id: 'measure_win', category: 'special', name: '围度逆袭', description: '体重不变但腰围减少 3cm 以上', icon: '📐', target: 1, type: 'measure_win', condition: 1 },
  { id: 'muscle_win', category: 'special', name: '增肌减脂', description: '体重不变但肌肉量提升 1kg 以上', icon: '🏆', target: 1, type: 'muscle_win', condition: 1 },
  { id: 'maintain_1w', category: 'special', name: '一周坚守', description: '保持目标体重 1 周', icon: '📅', target: 7, type: 'maintain_days', condition: 7 },
  { id: 'maintain_1m', category: 'special', name: '月度达标', description: '保持目标体重 1 个月', icon: '📆', target: 30, type: 'maintain_days', condition: 30 },
  { id: 'maintain_3m', category: 'special', name: '季度冠军', description: '保持目标体重 3 个月', icon: '🏆', target: 90, type: 'maintain_days', condition: 90 },
  { id: 'maintain_6m', category: 'special', name: '半年王者', description: '保持目标体重 6 个月', icon: '👑', target: 180, type: 'maintain_days', condition: 180 },
  { id: 'maintain_1y', category: 'special', name: '年度传奇', description: '保持目标体重 1 年', icon: '💎', target: 365, type: 'maintain_days', condition: 365 },

  // 5. 每日习惯里程碑
  { id: 'water_1d', category: 'habit', name: '水润一天', description: '单日饮水≥2000ml', icon: '💧', target: 1, type: 'water_day', condition: 1 },
  { id: 'water_3d', category: 'habit', name: '三日水润', description: '连续 3 天饮水达标', icon: '🚰', target: 3, type: 'water_streak', condition: 3 },
  { id: 'water_7d', category: 'habit', name: '一周水润', description: '连续 7 天饮水达标', icon: '🌊', target: 7, type: 'water_streak', condition: 7 },
  { id: 'water_21d', category: 'habit', name: '水润习惯', description: '连续 21 天饮水达标', icon: '🏝️', target: 21, type: 'water_streak', condition: 21 },
  { id: 'water_90d', category: 'habit', name: '水润达人', description: '连续 90 天饮水达标', icon: '🌊', target: 90, type: 'water_streak', condition: 90 },

  { id: 'diet_1d', category: 'habit', name: '完整记录', description: '完整记录一日三餐', icon: '🍽️', target: 1, type: 'diet_day', condition: 1 },
  { id: 'diet_3d', category: 'habit', name: '三日饮食', description: '连续 3 天饮食打卡', icon: '🥗', target: 3, type: 'diet_streak', condition: 3 },
  { id: 'diet_7d', category: 'habit', name: '一周饮食', description: '连续 7 天饮食打卡', icon: '🥙', target: 7, type: 'diet_streak', condition: 7 },
  { id: 'diet_21d', category: 'habit', name: '饮食习惯', description: '连续 21 天饮食打卡', icon: '🍱', target: 21, type: 'diet_streak', condition: 21 },
  { id: 'diet_90d', category: 'habit', name: '饮食达人', description: '连续 90 天饮食打卡', icon: '👨‍🍳', target: 90, type: 'diet_streak', condition: 90 },

  { id: 'exercise_3d', category: 'habit', name: '三日运动', description: '连续 3 天运动打卡', icon: '🏃', target: 3, type: 'exercise_streak', condition: 3 },
  { id: 'exercise_7d', category: 'habit', name: '一周运动', description: '连续 7 天运动打卡', icon: '🏃‍♂️', target: 7, type: 'exercise_streak', condition: 7 },
  { id: 'exercise_21d', category: 'habit', name: '运动习惯', description: '连续 21 天运动打卡', icon: '🏃‍♀️', target: 21, type: 'exercise_streak', condition: 21 },
  { id: 'exercise_90d', category: 'habit', name: '运动达人', description: '连续 90 天运动打卡', icon: '🏅', target: 90, type: 'exercise_streak', condition: 90 },

  { id: 'reject_1', category: 'habit', name: '拒绝诱惑', description: '主动拒绝 1 次高热量食物', icon: '🙅', target: 1, type: 'reject_count', condition: 1 },
  { id: 'reject_10', category: 'habit', name: '十拒十美', description: '累计拒绝 10 次高热量食物', icon: '🛡️', target: 10, type: 'reject_count', condition: 10 },
  { id: 'reject_50', category: 'habit', name: '拒绝大师', description: '累计拒绝 50 次高热量食物', icon: '🛡️', target: 50, type: 'reject_count', condition: 50 },
  { id: 'reject_100', category: 'habit', name: '拒绝宗师', description: '累计拒绝 100 次高热量食物', icon: '⚔️', target: 100, type: 'reject_count', condition: 100 },

  { id: 'exercise_150m', category: 'habit', name: '周运动达人', description: '周累计运动≥150 分钟', icon: '⏱️', target: 150, type: 'exercise_week_minutes', condition: 150 },
  { id: 'exercise_4w', category: 'habit', name: '月度运动', description: '连续 4 周运动时长达标', icon: '📅', target: 4, type: 'exercise_week_streak', condition: 4 },
  { id: 'exercise_12w', category: 'habit', name: '季度运动', description: '连续 12 周运动时长达标', icon: '📆', target: 12, type: 'exercise_week_streak', condition: 12 },

  { id: 'no_late_1w', category: 'habit', name: '一周无宵夜', description: '一周内不吃宵夜', icon: '🌙', target: 1, type: 'no_late_night_week', condition: 1 },
  { id: 'no_late_4w', category: 'habit', name: '月度无宵夜', description: '连续 4 周不吃宵夜', icon: '🌃', target: 4, type: 'no_late_night_streak', condition: 4 },
  { id: 'no_late_12w', category: 'habit', name: '季度无宵夜', description: '连续 12 周不吃宵夜', icon: '🌌', target: 12, type: 'no_late_night_streak', condition: 12 },

  { id: 'weigh_1w', category: 'habit', name: '规律称重', description: '每周固定时间称重 1 次', icon: '⚖️', target: 1, type: 'weigh_week', condition: 1 },
  { id: 'weigh_4w', category: 'habit', name: '月度规律', description: '连续 4 周规律称重', icon: '📊', target: 4, type: 'weigh_streak', condition: 4 },
  { id: 'weigh_12w', category: 'habit', name: '季度规律', description: '连续 12 周规律称重', icon: '📈', target: 12, type: 'weigh_streak', condition: 12 },
];

const categoryMap = {
  weight: { label: '基础减重', icon: '⚖️' },
  measure: { label: '围度塑形', icon: '📏' },
  body: { label: '体成分', icon: '🧬' },
  special: { label: '特殊成就', icon: '⭐' },
  habit: { label: '每日习惯', icon: '💪' },
};

// ==================== 状态 ====================
const milestones = ref([]);
const activeCategory = ref('all');
const userData = ref({});

const categories = computed(() => {
  const list = Object.entries(categoryMap).map(([key, val]) => {
    const catItems = milestones.value.filter(m => m.category === key);
    return {
      key,
      label: val.label,
      unlocked: catItems.filter(m => m.unlocked).length,
      total: catItems.length,
    };
  });
  list.unshift({
    key: 'all',
    label: '全部',
    unlocked: milestones.value.filter(m => m.unlocked).length,
    total: milestones.value.length,
  });
  return list;
});

const categoryStats = computed(() => {
  return Object.entries(categoryMap).map(([key, val]) => {
    const catItems = milestones.value.filter(m => m.category === key);
    return {
      key,
      label: val.label,
      unlocked: catItems.filter(m => m.unlocked).length,
      total: catItems.length,
    };
  });
});

const filteredMilestones = computed(() => {
  let list = milestones.value;
  if (activeCategory.value !== 'all') {
    list = list.filter(m => m.category === activeCategory.value);
  }
  // 已获得的排在最前，按解锁时间倒序；未获得的按定义顺序
  return [...list].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    if (a.unlocked && b.unlocked) {
      return new Date(b.unlockedAt || 0) - new Date(a.unlockedAt || 0);
    }
    return 0;
  });
});

const unlockedCount = computed(() => milestones.value.filter(m => m.unlocked).length);

// ==================== 检测逻辑 ====================
function checkMilestones(data) {
  const user = data.user || {};
  const stats = data.stats || {};
  const records = data.records || [];

  const initialWeight = user.initial_weight;
  const currentWeight = user.current_weight;
  const targetWeight = user.target_weight;
  const gender = user.gender || 'female';

  const weightLoss = initialWeight && currentWeight ? initialWeight - currentWeight : 0;
  const weightPct = initialWeight && currentWeight ? (currentWeight / initialWeight) * 100 : 100;

  // 计算体脂率、肌肉量等（从最近记录获取）
  const latestRecord = records.length > 0 ? records[records.length - 1] : {};
  const initialBody = records.length > 0 ? records[0] : {};

  const fatRate = latestRecord.body_fat_rate || 0;
  const initialFatRate = initialBody.body_fat_rate || fatRate;
  const fatLoss = initialFatRate - fatRate;

  const muscleMass = latestRecord.muscle_mass || 0;
  const initialMuscle = initialBody.muscle_mass || muscleMass;
  const muscleGain = muscleMass - initialMuscle;

  const visceralFat = latestRecord.visceral_fat_level || 0;
  const initialVisceral = initialBody.visceral_fat_level || visceralFat;
  const visceralLoss = initialVisceral - visceralFat;

  const bmr = latestRecord.basal_metabolism || 0;
  const initialBmr = initialBody.basal_metabolism || bmr;
  const bmrGain = initialBmr > 0 ? ((bmr - initialBmr) / initialBmr) * 100 : 0;

  const waist = latestRecord.waist || 0;
  const initialWaist = initialBody.waist || waist;
  const waistLoss = initialWaist - waist;

  const thigh = latestRecord.thigh || 0;
  const initialThigh = initialBody.thigh || thigh;
  const thighLoss = initialThigh - thigh;

  const hip = latestRecord.hip || 0;
  const initialHip = initialBody.hip || hip;
  const hipLoss = initialHip - hip;

  const arm = latestRecord.arm || 0;
  const initialArm = initialBody.arm || arm;
  const armLoss = initialArm - arm;

  const whr = waist && hip ? waist / hip : 0;
  const whrStandard = gender === 'male' ? 0.9 : 0.85;

  // 习惯数据
  const waterDays = stats.water_days || 0;
  const waterStreak = stats.water_streak || 0;
  const dietDays = stats.diet_days || 0;
  const dietStreak = stats.diet_streak || 0;
  const exerciseDays = stats.exercise_days || 0;
  const exerciseStreak = stats.exercise_streak || 0;
  const rejectCount = stats.reject_count || 0;
  const exerciseWeekMinutes = stats.exercise_week_minutes || 0;
  const exerciseWeekStreak = stats.exercise_week_streak || 0;
  const noLateNightWeek = stats.no_late_night_week || 0;
  const noLateNightStreak = stats.no_late_night_streak || 0;
  const weighWeek = stats.weigh_week || 0;
  const weighStreak = stats.weigh_streak || 0;

  // 特殊检测
  const maintainDays = stats.maintain_target_days || 0;
  const hasPlateauBreak = stats.plateau_break || false;
  const hasMeasureWin = stats.measure_win || false;
  const hasMuscleWin = stats.muscle_win || false;

  const checks = {
    weight_loss: weightLoss,
    weight_pct: weightPct,
    reach_target: targetWeight && Math.abs(currentWeight - targetWeight) <= 1 ? 1 : 0,
    waist_loss: waistLoss,
    thigh_loss: thighLoss,
    hip_loss: hipLoss,
    arm_loss: armLoss,
    whr_standard: whr > 0 && whr < whrStandard ? 1 : 0,
    fat_loss_pct: fatLoss,
    fat_standard: gender === 'male' ? (fatRate > 0 && fatRate < 20 ? 1 : 0) : (fatRate > 0 && fatRate < 25 ? 1 : 0),
    visceral_loss: visceralLoss,
    visceral_standard: visceralFat > 0 && visceralFat < 9 ? 1 : 0,
    muscle_gain: muscleGain,
    bmr_gain_pct: bmrGain,
    plateau_break: hasPlateauBreak ? 1 : 0,
    measure_win: hasMeasureWin ? 1 : 0,
    muscle_win: hasMuscleWin ? 1 : 0,
    maintain_days: maintainDays,
    water_day: waterDays >= 1 ? 1 : 0,
    water_streak: waterStreak,
    diet_day: dietDays >= 1 ? 1 : 0,
    diet_streak: dietStreak,
    exercise_streak: exerciseStreak,
    reject_count: rejectCount,
    exercise_week_minutes: exerciseWeekMinutes,
    exercise_week_streak: exerciseWeekStreak,
    no_late_night_week: noLateNightWeek,
    no_late_night_streak: noLateNightStreak,
    weigh_week: weighWeek,
    weigh_streak: weighStreak,
  };

  return milestoneDefinitions.map(def => {
    const value = checks[def.type] || 0;
    const unlocked = value >= def.condition;
    return {
      ...def,
      unlocked,
      progress: Math.min(value, def.target),
      unlockedAt: unlocked ? new Date().toISOString() : null,
    };
  });
}

// ==================== 生命周期 ====================
onMounted(async () => {
  try {
    const res = await recordApi.getMilestoneData();
    userData.value = res.data || {};
    milestones.value = checkMilestones(userData.value);
  } catch (err) {
    console.error('获取里程碑数据失败:', err);
    // 使用空数据展示
    milestones.value = milestoneDefinitions.map(def => ({
      ...def,
      unlocked: false,
      progress: 0,
      unlockedAt: null,
    }));
  }
});

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<style lang="scss" scoped>
.milestone-page {
  padding-top: $spacing-md;
}

.summary-card {
  background: $mint;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-soft;
  text-align: center;
}

.summary-title {
  font-size: $text-base;
  color: $text-secondary;
  display: block;
  margin-bottom: $spacing-sm;
}

.summary-progress {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: $spacing-md;
}

.summary-num {
  font-size: 72rpx;
  font-weight: $font-bold;
  color: $text-primary;
}

.summary-total {
  font-size: $text-xl;
  color: $text-secondary;
  margin-left: 8rpx;
}

.summary-categories {
  display: flex;
  justify-content: space-around;
  padding-top: $spacing-md;
  border-top: 1rpx solid rgba(0, 0, 0, 0.08);
}

.cat-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cat-stat-num {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
}

.cat-stat-label {
  font-size: $text-xs;
  color: $text-secondary;
  margin-top: 4rpx;
}

/* 分类标签 */
.category-tabs {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  overflow-x: auto;
  padding: 0 $spacing-sm;
  -webkit-overflow-scrolling: touch;
}

.tab-item {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border-radius: $radius-lg;
  background: $bg-card;
  border: 2rpx solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.2s;
}

.tab-item.active {
  background: rgba(93, 190, 157, 0.1);
  border-color: #5AA8D8;
}

.tab-text {
  font-size: $text-sm;
  color: $text-primary;
  font-weight: $font-semibold;
}

.tab-count {
  font-size: 20rpx;
  color: $text-tertiary;
  margin-top: 2rpx;
}

/* 里程碑列表 */
.milestone-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding: 0 $spacing-sm;
  padding-bottom: $spacing-lg;
}

.milestone-item {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;
  transition: all 0.3s;
}

.milestone-item.locked {
  opacity: 0.55;
  filter: grayscale(0.8);
}

.milestone-item.unlocked {
  border: 2rpx solid rgba(93, 190, 157, 0.3);
  background: rgba(93, 190, 157, 0.04);
}

.milestone-icon-wrap {
  position: relative;
  flex-shrink: 0;
}

.milestone-icon {
  font-size: 56rpx;
}

.unlocked-badge {
  position: absolute;
  bottom: -4rpx;
  right: -4rpx;
  width: 28rpx;
  height: 28rpx;
  background: #5AA8D8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16rpx;
  color: #fff;
  border: 2rpx solid #fff;
}

.milestone-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.milestone-name {
  font-size: $text-base;
  font-weight: $font-semibold;
  color: $text-primary;
}

.milestone-desc {
  font-size: $text-sm;
  color: $text-secondary;
}

.milestone-time {
  font-size: 22rpx;
  color: $mint;
  margin-top: 4rpx;
}

.milestone-progress {
  font-size: 22rpx;
  color: $text-tertiary;
  margin-top: 4rpx;
}
</style>
