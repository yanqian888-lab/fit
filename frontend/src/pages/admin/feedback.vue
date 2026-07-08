<template>
  <AppPage>
    <AppHeader title="反馈管理" />
    <view class="header-placeholder"></view>
    <view class="admin-page">
      <!-- 统计卡片 -->
      <view class="stats-card">
        <view class="stat-item">
          <text class="stat-num">{{ stats.total }}</text>
          <text class="stat-label">总反馈</text>
        </view>
        <view class="stat-item">
          <text class="stat-num pending">{{ stats.pending }}</text>
          <text class="stat-label">待处理</text>
        </view>
        <view class="stat-item">
          <text class="stat-num resolved">{{ stats.resolved }}</text>
          <text class="stat-label">已处理</text>
        </view>
      </view>

      <!-- 筛选 -->
      <view class="filter-bar">
        <text v-for="f in filters" :key="f.value" class="filter-item" :class="{ active: currentFilter === f.value }" @click="currentFilter = f.value; loadFeedbacks()">
          {{ f.label }}
        </text>
      </view>

      <!-- 反馈列表 -->
      <scroll-view scroll-y class="feedback-list" @scrolltolower="loadMore">
        <view v-for="item in feedbacks" :key="item.id" class="feedback-item" @click="openDetail(item)">
          <view class="feedback-header">
            <text class="feedback-type">{{ typeLabel(item.type) }}</text>
            <text class="feedback-status" :class="item.status">{{ statusText(item.status) }}</text>
          </view>
          <text class="feedback-content">{{ item.content }}</text>
          <view class="feedback-footer">
            <text class="feedback-user">{{ item.nickname || '匿名用户' }}</text>
            <text class="feedback-time">{{ formatTime(item.created_at) }}</text>
          </view>
          <view v-if="item.reply" class="has-reply-badge">已回复</view>
        </view>
        <AppEmpty v-if="feedbacks.length === 0" text="暂无反馈" icon="📝" />
      </scroll-view>
    </view>

    <!-- 详情弹窗 -->
    <view v-if="showDetail" class="detail-mask" @click="showDetail = false">
      <view class="detail-panel" @click.stop>
        <view class="detail-header">
          <text class="detail-title">反馈详情</text>
          <text class="detail-close" @click="showDetail = false">✕</text>
        </view>
        <scroll-view scroll-y class="detail-body">
          <view class="detail-section">
            <text class="detail-label">用户信息</text>
            <text class="detail-text">昵称：{{ currentFeedback.nickname || '匿名' }}</text>
            <text class="detail-text">联系方式：{{ currentFeedback.contact || '未填写' }}</text>
            <text class="detail-text">满意度：{{ currentFeedback.score ? currentFeedback.score + '星' : '未评分' }}</text>
          </view>
          <view class="detail-section">
            <text class="detail-label">反馈内容</text>
            <text class="detail-content">{{ currentFeedback.content }}</text>
          </view>
          <view v-if="currentFeedback.reply" class="detail-section">
            <text class="detail-label">已回复</text>
            <view class="reply-box">
              <text class="reply-content">{{ currentFeedback.reply }}</text>
              <text class="reply-time">{{ formatTime(currentFeedback.replied_at) }}</text>
            </view>
          </view>
          <view v-else class="detail-section">
            <text class="detail-label">回复</text>
            <textarea v-model="replyContent" placeholder="请输入回复内容..." :maxlength="500" />
            <AppButton block type="primary" :loading="replying" @click="submitReply">提交回复</AppButton>
          </view>
        </scroll-view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { feedbackApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';
import AppEmpty from '../../components/AppEmpty.vue';

const filters = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已处理', value: 'resolved' }
];

const types = [
  { label: '功能建议', value: 'feature' },
  { label: 'BUG 反馈', value: 'bug' },
  { label: '其他', value: 'other' }
];

const currentFilter = ref('');
const feedbacks = ref([]);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);
const showDetail = ref(false);
const currentFeedback = ref({});
const replyContent = ref('');
const replying = ref(false);

const stats = computed(() => {
  const total = feedbacks.value.length;
  const pending = feedbacks.value.filter(f => f.status === 'pending').length;
  const resolved = feedbacks.value.filter(f => f.status === 'resolved').length;
  return { total, pending, resolved };
});

function typeLabel(value) {
  const t = types.find(t => t.value === value);
  return t ? t.label : value;
}

function statusText(status) {
  const map = { pending: '待处理', processing: '处理中', resolved: '已处理' };
  return map[status] || status;
}

function formatTime(time) {
  if (!time) return '';
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

onMounted(() => loadFeedbacks());

async function loadFeedbacks() {
  page.value = 1;
  hasMore.value = true;
  await fetchFeedbacks();
}

async function fetchFeedbacks() {
  if (loading.value || !hasMore.value) return;
  loading.value = true;
  try {
    const res = await feedbackApi.getAdminList({ page: page.value, size: 20, status: currentFilter.value });
    const list = res.data.list || [];
    if (page.value === 1) {
      feedbacks.value = list;
    } else {
      feedbacks.value.push(...list);
    }
    hasMore.value = res.data.pagination.has_more;
    page.value++;
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  if (hasMore.value) fetchFeedbacks();
}

function openDetail(item) {
  currentFeedback.value = item;
  replyContent.value = '';
  showDetail.value = true;
}

async function submitReply() {
  if (!replyContent.value.trim()) {
    uni.showToast({ title: '请输入回复内容', icon: 'none' });
    return;
  }
  replying.value = true;
  try {
    await feedbackApi.reply(currentFeedback.value.id, { reply: replyContent.value.trim() });
    uni.showToast({ title: '回复成功', icon: 'success' });
    currentFeedback.value.reply = replyContent.value.trim();
    currentFeedback.value.status = 'resolved';
    showDetail.value = false;
    loadFeedbacks();
  } catch (err) {
    uni.showToast({ title: '回复失败', icon: 'none' });
  } finally {
    replying.value = false;
  }
}
</script>

<style lang="scss" scoped>
.admin-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: $spacing-md;
}

.header-placeholder {
  height: calc(100rpx + 24rpx + env(safe-area-inset-top) + 20rpx);
  flex-shrink: 0;
}

.stats-card {
  display: flex;
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 48rpx;
  font-weight: $font-bold;
  color: $text-primary;
  display: block;
}

.stat-num.pending {
  color: #FF9800;
}

.stat-num.resolved {
  color: $mint-dark;
}

.stat-label {
  font-size: $text-sm;
  color: $text-secondary;
}

.filter-bar {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.filter-item {
  background: $gray-50;
  border-radius: $radius-pill;
  padding: 12rpx 28rpx;
  font-size: $text-sm;
  color: $text-secondary;
}

.filter-item.active {
  background: $mint;
  color: $white;
}

.feedback-list {
  flex: 1;
  height: 100%;
}

.feedback-item {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
  position: relative;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.feedback-type {
  font-size: $text-xs;
  color: $text-secondary;
  background: $gray-50;
  padding: 4rpx 12rpx;
  border-radius: $radius-sm;
}

.feedback-status {
  font-size: $text-xs;
  padding: 4rpx 12rpx;
  border-radius: $radius-sm;
}

.feedback-status.pending {
  color: #FF9800;
  background: #FFF3E0;
}

.feedback-status.processing {
  color: #2196F3;
  background: #E3F2FD;
}

.feedback-status.resolved {
  color: $mint-dark;
  background: #E8F5E9;
}

.feedback-content {
  font-size: $text-sm;
  color: $text-primary;
  margin-bottom: $spacing-sm;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feedback-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feedback-user {
  font-size: $text-xs;
  color: $text-secondary;
}

.feedback-time {
  font-size: $text-xs;
  color: $text-secondary;
}

.has-reply-badge {
  position: absolute;
  top: $spacing-sm;
  right: $spacing-sm;
  background: $mint;
  color: $white;
  font-size: $text-xs;
  padding: 2rpx 8rpx;
  border-radius: $radius-sm;
}

.detail-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
}

.detail-panel {
  background: $white;
  border-radius: $radius-xl $radius-xl 0 0;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $gray-50;
}

.detail-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
}

.detail-close {
  font-size: 40rpx;
  color: $text-secondary;
}

.detail-body {
  flex: 1;
  height: 100%;
  padding: $spacing-md;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: $spacing-md;
}

.detail-label {
  font-size: $text-sm;
  font-weight: $font-semibold;
  color: $text-primary;
  margin-bottom: $spacing-sm;
  display: block;
}

.detail-text {
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: 8rpx;
  display: block;
}

.detail-content {
  font-size: $text-base;
  color: $text-primary;
  line-height: 1.6;
  background: $gray-50;
  padding: $spacing-md;
  border-radius: $radius-md;
}

.reply-box {
  background: #F0F9F6;
  border-radius: $radius-md;
  padding: $spacing-md;
  border-left: 4rpx solid $mint;
}

.reply-content {
  font-size: $text-sm;
  color: $text-primary;
  line-height: 1.5;
  margin-bottom: 8rpx;
  display: block;
}

.reply-time {
  font-size: $text-xs;
  color: $text-secondary;
  display: block;
  text-align: right;
}

textarea {
  width: 100%;
  height: 200rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: $spacing-md;
  font-size: $text-base;
  color: $text-primary;
  margin-bottom: $spacing-md;
}
</style>
