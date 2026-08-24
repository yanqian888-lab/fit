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
import { petApi } from '../../api';

const categoryMap = {
  weight_loss: { label: '体重管理', icon: '⚖️', key: 'weight' },
  weight_goal: { label: '体重管理', icon: '⚖️', key: 'weight' },
  measure: { label: '围度塑形', icon: '📏', key: 'measure' },
  body: { label: '体成分', icon: '🧬', key: 'body' },
  exercise_count: { label: '运动', icon: '🏃', key: 'exercise' },
  exercise_duration: { label: '运动', icon: '🏃', key: 'exercise' },
  exercise_calorie: { label: '运动', icon: '🏃', key: 'exercise' },
  diet_days: { label: '饮食记录', icon: '🍽️', key: 'diet' },
  habit: { label: '每日习惯', icon: '💪', key: 'habit' },
  streak: { label: '连续打卡', icon: '🔥', key: 'habit' },
  chat: { label: '陪伴对话', icon: '💬', key: 'companion' },
  duration: { label: '坚持天数', icon: '⏳', key: 'companion' },
  event_collection: { label: '事件收集', icon: '📚', key: 'collection' },
  recipe_collection: { label: '食谱收集', icon: '🍳', key: 'collection' },
  special: { label: '特殊成就', icon: '⭐', key: 'special' }
};

const categoryIconMap = {
  weight: '⚖️', measure: '📏', body: '🧬', exercise: '🏃', diet: '🍽️',
  habit: '💪', companion: '💬', collection: '📚', special: '⭐'
};

const milestones = ref([]);
const activeCategory = ref('all');

const achievements = computed(() => {
  return milestones.value.map(a => {
    const cat = categoryMap[a.category] || { label: '其他', key: 'special' };
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      category: cat.key,
      icon: a.badge_icon || categoryIconMap[cat.key] || '⭐',
      unlocked: a.unlocked,
      unlockedAt: a.unlocked_at,
      progress: a.unlocked ? 1 : 0,
      target: 1
    };
  });
});

const categories = computed(() => {
  const groups = {};
  achievements.value.forEach(m => {
    if (!groups[m.category]) {
      const info = Object.values(categoryMap).find(c => c.key === m.category) || { label: '其他' };
      groups[m.category] = { label: info.label, total: 0, unlocked: 0 };
    }
    groups[m.category].total++;
    if (m.unlocked) groups[m.category].unlocked++;
  });
  const list = Object.entries(groups).map(([key, val]) => ({ key, ...val }));
  list.unshift({
    key: 'all',
    label: '全部',
    unlocked: achievements.value.filter(m => m.unlocked).length,
    total: achievements.value.length
  });
  return list;
});

const categoryStats = computed(() => {
  // 与分类 tab 同源（按展示组去重，只统计有成就的组）
  return categories.value.filter(c => c.key !== 'all');
});

const filteredMilestones = computed(() => {
  let list = achievements.value;
  if (activeCategory.value !== 'all') {
    list = list.filter(m => m.category === activeCategory.value);
  }
  return [...list].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    if (a.unlocked && b.unlocked) return new Date(b.unlockedAt || 0) - new Date(a.unlockedAt || 0);
    return 0;
  });
});

const unlockedCount = computed(() => achievements.value.filter(m => m.unlocked).length);

onMounted(async () => {
  try {
    const res = await petApi.getAchievements();
    // 后端返回 { list: [...] } 分页结构，兼容数组形态
    milestones.value = Array.isArray(res.data) ? res.data : (res.data?.list || []);
  } catch (e) {
    console.error(e);
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
