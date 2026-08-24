<template>
  <AppPage>
  <view class="header-bg"></view>
    <AppHeader title="里程碑" headerBg="transparent" />
    <view class="milestones-page">
      <view class="header-bg"></view>
      <AppEmpty v-if="milestones.length === 0" image="/static/image/icon/quesheng01.png" title="还没有里程碑" subtitle="坚持记录，达成目标后会自动解锁成就" full />

      <view class="milestone-list">
        <view v-for="item in milestones" :key="item.id" class="milestone-card">
          <view class="milestone-icon">{{ item.icon || '🏆' }}</view>
          <view class="milestone-info">
            <text class="milestone-title">{{ item.title }}</text>
            <text class="milestone-desc">{{ item.description }}</text>
            <text class="milestone-date">{{ formatDate(item.achieved_at) }}</text>
          </view>
        </view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { aiApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppEmpty from '../../components/AppEmpty.vue';

const milestones = ref([]);

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function load() {
  try {
    const res = await aiApi.getMilestones();
    milestones.value = res.data.list || [];
  } catch (err) {
    console.error(err);
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.milestones-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-top: $spacing-md;
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

.milestone-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.milestone-card {
  background: $mint-light;
  border-radius: 32rpx;
  padding: $spacing-md;
  display: flex;
  align-items: center;
  box-shadow: $shadow-card;
  border: 2rpx solid $mint-light;
}

.milestone-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $mint;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-right: $spacing-md;
  flex-shrink: 0;
}

.milestone-info {
  flex: 1;
}

.milestone-title {
  font-size: $text-lg;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
  margin-bottom: 6rpx;
}

.milestone-desc {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
  margin-bottom: 8rpx;
  line-height: 1.5;
}

.milestone-date {
  font-size: $text-xs;
  color: $text-tertiary;
}
</style>
