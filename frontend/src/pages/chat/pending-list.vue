<template>
  <AppPage>
    <AppHeader title="待确认记录" />
    <view class="pending-page">
      <AppTabs v-model="activeType" :tabs="typeTabs" />
      <view class="list">
        <view v-for="item in filteredList" :key="item.id" class="pending-card">
          <view class="pending-header">
            <text class="pending-type">{{ typeName(item.type) }}</text>
            <text class="pending-date">{{ formatDate(item.created_at) }}</text>
          </view>
          <text class="pending-content">{{ item.content }}</text>
          <view v-if="item.extracted_data" class="pending-detail">
            <text>{{ formatExtracted(item) }}</text>
          </view>
          <view class="pending-actions">
            <AppButton type="ghost" size="sm" @click="reject(item.id)">忽略</AppButton>
            <AppButton size="sm" @click="confirm(item.id)">确认</AppButton>
          </view>
        </view>
        <AppEmpty v-if="filteredList.length === 0" text="没有待确认记录" icon="📭" />
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { precipitationApi, chatApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppTabs from '../../components/AppTabs.vue';
import AppButton from '../../components/AppButton.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import { formatDate } from '../../utils/date';

const activeType = ref('all');
const list = ref([]);
const typeTabs = [
  { label: '全部', value: 'all' },
  { label: '饮食', value: 'diet_record' },
  { label: '运动', value: 'exercise_record' },
  { label: '其他', value: 'other' }
];

const typeMap = {
  diet_record: '饮食',
  exercise_record: '运动',
  body_data: '身体数据',
  quote: '金句',
  insight: '感悟',
  recipe: '食谱'
};

const filteredList = computed(() => {
  if (activeType.value === 'all') return list.value;
  if (activeType.value === 'other') return list.value.filter(i => !['diet_record', 'exercise_record'].includes(i.type));
  return list.value.filter(i => i.type === activeType.value);
});

function typeName(type) {
  return typeMap[type] || type;
}

function formatExtracted(item) {
  const data = item.extracted_data || {};
  if (item.type === 'diet_record') {
    const foods = (data.foods || []).map(f => `${f.name} ${f.weight || ''}g`).join('、');
    return foods + (data.total_calorie ? ` · ${data.total_calorie} kcal` : '');
  }
  if (item.type === 'exercise_record') {
    return `${data.total_duration || 0} 分钟 · ${data.total_calorie || 0} kcal`;
  }
  return JSON.stringify(data);
}

async function load() {
  try {
    const res = await precipitationApi.getList({ status: 0, size: 50 });
    list.value = res.data.list;
  } catch (err) {
    console.error(err);
  }
}

async function confirm(id) {
  try {
    await chatApi.confirmPrecipitation({ precipitation_id: id, action: 'confirm' });
    uni.showToast({ title: '已确认', icon: 'success' });
    load();
  } catch (err) {
    uni.showToast({ title: '确认失败', icon: 'none' });
  }
}

async function reject(id) {
  try {
    await chatApi.confirmPrecipitation({ precipitation_id: id, action: 'reject' });
    uni.showToast({ title: '已忽略', icon: 'none' });
    load();
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.pending-page {
  padding-top: $spacing-md;
}

.list {
  margin-top: $spacing-md;
}

.pending-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  box-shadow: $shadow-card;
}

.pending-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.pending-type {
  font-size: $text-sm;
  color: $mint-dark;
  background: $mint-light;
  padding: 6rpx 16rpx;
  border-radius: $radius-pill;
  font-weight: $font-medium;
}

.pending-date {
  font-size: $text-xs;
  color: $text-tertiary;
}

.pending-content {
  font-size: $text-base;
  color: $text-primary;
  line-height: 1.6;
  display: block;
  margin-bottom: $spacing-sm;
}

.pending-detail {
  background: $gray-50;
  border-radius: $radius-md;
  padding: $spacing-sm;
  margin-bottom: $spacing-sm;
  font-size: $text-sm;
  color: $text-secondary;
}

.pending-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}
</style>
