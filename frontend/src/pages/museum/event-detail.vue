<template>
  <AppPage>
    <AppHeader title="事件详情" />
    <view class="event-detail-page">
      <view class="event-card">
        <view class="event-icon">{{ typeIcon }}</view>
        <text class="event-title">{{ event.title }}</text>
        <text class="event-date">{{ event.event_date }}</text>
        <text class="event-content">{{ event.content || '暂无详细内容' }}</text>
      </view>

      <view class="tags-card">
        <text class="card-title">标签</text>
        <view class="tag-list">
          <text v-for="(tag, idx) in tags" :key="idx" class="tag-item">{{ tag }}</text>
          <text v-if="tags.length === 0" class="tag-placeholder">暂无标签</text>
        </view>
        <input v-model="newTag" class="tag-input" placeholder="添加标签" @confirm="addTag" />
      </view>

      <view class="actions">
        <AppButton type="primary" block @click="editTitle">编辑内容</AppButton>
        <AppButton type="danger" block @click="remove">删除事件</AppButton>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { museumApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const event = ref({});
const eventId = ref(null);
const newTag = ref('');

const tags = computed(() => event.value.tags ? JSON.parse(event.value.tags) : []);

const typeIcon = computed(() => {
  const map = {
    weight: '⚖️', milestone: '🏆', exercise: '🏃', diet: '🥗',
    quote: '💬', insight: '📝', recipe: '🍳', photo: '📷'
  };
  return map[event.value.event_type] || '✨';
});

onMounted(() => {
  const pages = getCurrentPages();
  const query = pages[pages.length - 1].$page?.options || {};
  eventId.value = parseInt(query.id);
  loadEvent();
});

async function loadEvent() {
  try {
    // 时间轴数据通过 museum items 近似，实际可扩展 timeline 详情接口
    const res = await museumApi.getTimeline({ size: 100 });
    const item = res.data.list.find(i => i.id === eventId.value);
    event.value = item || {};
  } catch (err) {
    console.error(err);
  }
}

function addTag() {
  if (!newTag.value.trim()) return;
  const list = [...tags.value, newTag.value.trim()];
  event.value.tags = JSON.stringify(list);
  newTag.value = '';
}

function editTitle() {
  const content = prompt('编辑事件内容', event.value.content);
  if (content === null) return;
  event.value.content = content;
  uni.showToast({ title: '已更新（演示）', icon: 'success' });
}

function remove() {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复',
    confirmColor: '#E57373',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已删除（演示）', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 800);
      }
    }
  });
}
</script>

<style lang="scss" scoped>
.event-detail-page {
  padding-top: $spacing-md;
}

.event-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
  text-align: center;
}

.event-icon {
  font-size: 96rpx;
  margin-bottom: $spacing-sm;
}

.event-title {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
  margin-bottom: 8rpx;
}

.event-date {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
  margin-bottom: $spacing-md;
}

.event-content {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.6;
  text-align: left;
}

.tags-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.card-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.tag-item {
  background: $mint-light;
  color: $mint-dark;
  font-size: $text-sm;
  padding: 6rpx 18rpx;
  border-radius: $radius-pill;
}

.tag-placeholder {
  font-size: $text-sm;
  color: $text-tertiary;
}

.tag-input {
  width: 100%;
  height: 76rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  font-size: $text-base;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}
</style>
