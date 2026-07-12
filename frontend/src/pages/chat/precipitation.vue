<template>
  <AppPage>
    <AppHeader title="沉淀记录" />
    <view class="precipitation-page">
      <AppTabs v-model="status" :tabs="tabs" />
      <view v-for="item in list" :key="item.id" class="precip-card">
        <view class="precip-header">
          <text class="precip-type">{{ typeName(item.type) }}</text>
          <text class="precip-status" :class="statusClass(item.status)">{{ statusText(item.status) }}</text>
        </view>
        <text class="precip-content">{{ item.content }}</text>
        <view class="precip-footer">
          <text class="precip-date">{{ item.created_at }}</text>
          <view class="precip-actions">
            <text v-if="item.status === 0" class="action-confirm" @click="confirm(item.id)">确认</text>
            <text class="action-edit" @click="edit(item)">编辑</text>
            <text class="action-delete" @click="remove(item.id)">删除</text>
          </view>
        </view>
      </view>
      <AppEmpty v-if="list.length === 0" text="暂无沉淀记录" icon="📥" />
      <AppLoadMore :has-more="hasMore" />
    </view>
  </AppPage>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { precipitationApi, chatApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppTabs from '../../components/AppTabs.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import AppLoadMore from '../../components/AppLoadMore.vue';

const status = ref('all');
const tabs = [
  { label: '全部', value: 'all' },
  { label: '待确认', value: '0' },
  { label: '已确认', value: '1' }
];
const list = ref([]);
const page = ref(1);
const hasMore = ref(true);

function typeName(type) {
  const map = { diet: '饮食', diet_record: '饮食', exercise: '运动', exercise_record: '运动', weight: '体重', body_data: '身体', habit: '习惯', recipe: '食谱', quote: '金句', insight: '感悟' };
  return map[type] || type;
}

function statusText(s) {
  return s === 1 ? '已确认' : s === 0 ? '待确认' : '已忽略';
}

function statusClass(s) {
  return s === 1 ? 'confirmed' : s === 0 ? 'pending' : 'ignored';
}

async function load(more = false) {
  try {
    const params = { page: page.value, size: 15 };
    if (status.value !== 'all') params.status = parseInt(status.value);
    const res = await precipitationApi.getList(params);
    const rows = res.data.list || [];
    if (more) list.value.push(...rows);
    else list.value = rows;
    hasMore.value = res.data.pagination.has_more;
  } catch (err) {
    console.error(err);
  }
}

watch(status, () => {
  page.value = 1;
  load();
});

onMounted(() => load());

onReachBottom(() => {
  if (!hasMore.value) return;
  page.value++;
  load(true);
});

async function confirm(id) {
  try {
    await chatApi.confirmPrecipitation({ precipitation_id: id, confirmed: true });
    load();
  } catch (err) {
    uni.showToast({ title: '确认失败', icon: 'none' });
  }
}

function edit(item) {
  const content = prompt('编辑内容', item.content);
  if (content === null || content === item.content) return;
  precipitationApi.update(item.id, { content })
    .then(() => {
      uni.showToast({ title: '已更新', icon: 'success' });
      load();
    })
    .catch(() => uni.showToast({ title: '更新失败', icon: 'none' }));
}

function remove(id) {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复',
    confirmColor: '#E57373',
    success: (res) => {
      if (!res.confirm) return;
      precipitationApi.delete(id)
        .then(() => load())
        .catch(() => uni.showToast({ title: '删除失败', icon: 'none' }));
    }
  });
}
</script>

<style lang="scss" scoped>
.precipitation-page {
  padding-top: $spacing-md;
}

.precip-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  box-shadow: $shadow-card;
}

.precip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.precip-type {
  font-size: $text-sm;
  color: $white;
  background: $sky;
  padding: 4rpx 14rpx;
  border-radius: $radius-pill;
}

.precip-status {
  font-size: $text-xs;
  padding: 4rpx 12rpx;
  border-radius: $radius-pill;
}

.precip-status.confirmed {
  background: $mint-light;
  color: $mint-dark;
}

.precip-status.pending {
  background: $cream;
  color: #D4A017;
}

.precip-status.ignored {
  background: #F0F0F0;
  color: $text-tertiary;
}

.precip-content {
  font-size: $text-base;
  color: $text-primary;
  line-height: 1.6;
  display: block;
  margin-bottom: $spacing-md;
}

.precip-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.precip-date {
  font-size: $text-xs;
  color: $text-tertiary;
}

.precip-actions {
  display: flex;
  gap: $spacing-md;
}

.precip-actions text {
  font-size: $text-sm;
  font-weight: $font-medium;
}

.action-confirm { color: $mint-dark; }
.action-edit { color: $sky; }
.action-delete { color: #E57373; }
</style>
