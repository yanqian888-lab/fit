<template>
  <AppPage>
    <AppHeader title="时间轴" />
    <view class="timeline-page">
      <view v-for="item in list" :key="item.id" class="timeline-card" :class="item.type" @click="goDetail(item.id)">
        <view class="timeline-icon">{{ typeIcon(item.type) }}</view>
        <view class="timeline-main">
          <text class="timeline-title">{{ item.title }}</text>
          <text class="timeline-desc">{{ item.description }}</text>
          <text class="timeline-date">{{ item.event_date }}</text>
        </view>
      </view>
      <AppEmpty v-if="list.length === 0" image="/static/image/icon/quesheng01.png" text="还没有时间轴事件" />
      <AppLoadMore :has-more="hasMore" />
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { museumApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import AppLoadMore from '../../components/AppLoadMore.vue';

const list = ref([]);
const page = ref(1);
const hasMore = ref(true);

const typeIcons = {
  milestone: '🏆',
  weight: '⚖️',
  exercise: '🏃',
  diet: '🥗',
  quote: '💬',
  insight: '📝',
  recipe: '🍳'
};

function typeIcon(type) {
  return typeIcons[type] || '✨';
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/museum/event-detail?id=${id}` });
}

async function load(more = false) {
  try {
    const res = await museumApi.getTimeline({ page: page.value, size: 15 });
    const rows = res.data.list || [];
    if (more) list.value.push(...rows);
    else list.value = rows;
    hasMore.value = rows.length === 15;
  } catch (err) {
    console.error(err);
  }
}

onMounted(() => load());

onReachBottom(() => {
  if (!hasMore.value) return;
  page.value++;
  load(true);
});
</script>

<style lang="scss" scoped>
.timeline-page {
  padding-top: $spacing-md;
}

.timeline-card {
  display: flex;
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  box-shadow: $shadow-card;
  border-left: 10rpx solid $mint;
}

.timeline-card.weight { border-left-color: $sky; }
.timeline-card.exercise { border-left-color: $pink; }
.timeline-card.diet { border-left-color: $cream; }
.timeline-card.quote { border-left-color: #C9B1FF; }
.timeline-card.insight { border-left-color: #FFB085; }
.timeline-card.recipe { border-left-color: #B5E2FF; }

.timeline-icon {
  font-size: $text-xl;
  margin-right: $spacing-md;
}

.timeline-main {
  flex: 1;
}

.timeline-title {
  font-size: $text-base;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: 8rpx;
}

.timeline-desc {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
  margin-bottom: 8rpx;
  line-height: 1.5;
}

.timeline-date {
  font-size: $text-xs;
  color: $text-tertiary;
}
</style>
