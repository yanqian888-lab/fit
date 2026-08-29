<template>
  <AppPage :fixed="true" :showHeader="true" title="感悟与心情">
  <view class="insights-page">
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索感悟内容"
        confirm-type="search"
        @confirm="onSearch"
      />
      <image class="search-icon" src="/static/image/icon/sousuo.svg" mode="aspectFit" @click="onSearch" />
    </view>

    <scroll-view class="list-scroll" scroll-y @scrolltolower="loadMore">
      <view class="list-content">
        <view v-if="sortedList.length > 0" class="insights-list">
          <view v-for="item in sortedList" :key="item.type + '-' + item.id" class="insight-card" :class="{ quote: item.type === 'quote' }">
            <!-- 金句 -->
            <template v-if="item.type === 'quote'">
              <view class="quote-header">
                <text class="quote-icon">"</text>
                <text class="quote-content">{{ item.content }}</text>
              </view>
            </template>
            <!-- 感悟 -->
            <template v-else>
              <text v-if="item.sub_type" class="insight-title">{{ item.sub_type }}</text>
              <text class="insight-content">{{ item.content }}</text>
              <view v-if="item.emotion" class="insight-emotions">
                <text v-for="(tag, idx) in formatEmotions(item.emotion)" :key="idx" class="emotion-tag">{{ tag }}</text>
              </view>
            </template>
            <view class="insight-footer">
              <text class="insight-date">{{ formatDate(item.created_at) }}</text>
              <view class="card-actions">
                <text class="card-action" @click="editItem(item)">编辑</text>
                <text class="card-action danger" @click="deleteItem(item)">删除</text>
              </view>
            </view>
          </view>
          <AppLoadMore :has-more="hasMore" />
      </view>
        <AppEmpty v-else :image="'/static/image/icon/quesheng01.png'" :title="emptyTitle" :subtitle="emptySubtitle" full />
      </view>
    </scroll-view>

    <view class="add-insight-btn" @click="addInsight">添加感悟</view>

    <!-- 删除确认弹框 -->
    <AppModal
      v-model:visible="showDeleteModal"
      icon="none"
      title="确认删除"
      text="删除后无法恢复哦"
      confirmText="删除"
      confirmDanger
      cancelText="取消"
      @confirm="confirmDelete"
    />
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { museumApi } from '../../api';
import { formatDate } from '../../utils/date';
import AppEmpty from '../../components/AppEmpty.vue';
import AppLoadMore from '../../components/AppLoadMore.vue';
import AppModal from '../../components/AppModal.vue';

// 删除确认弹框状态
const showDeleteModal = ref(false);
let pendingDeleteItem = null;

const quoteList = ref([]);
const insightList = ref([]);
const quotePage = ref(1);
const insightPage = ref(1);
const hasMoreQuote = ref(true);
const hasMoreInsight = ref(true);
const hasMore = computed(() => hasMoreQuote.value || hasMoreInsight.value);
const keyword = ref('');

function wrapType(list, type) {
  return (list || []).map(item => ({ ...item, type })).filter(item => item.author !== 'partner');
}

const sortedList = computed(() => {
  const all = [
    ...wrapType(quoteList.value, 'quote'),
    ...wrapType(insightList.value, 'insight')
  ];
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
});
const hasContent = computed(() => quoteList.value.length > 0 || insightList.value.length > 0);
const emptyTitle = computed(() => keyword.value.trim() ? '未找到相关内容' : '暂无内容');
const emptySubtitle = computed(() => keyword.value.trim() ? '换个关键词试试' : '去添加你的第一条感悟或金句吧');

async function load(more = false) {
  try {
    if (!more) {
      quotePage.value = 1;
      insightPage.value = 1;
      hasMoreQuote.value = true;
      hasMoreInsight.value = true;
      quoteList.value = [];
      insightList.value = [];
    }

    const [quoteRes, insightRes] = await Promise.all([
      museumApi.getItems({ type: 'quote', page: quotePage.value, size: 20, keyword: keyword.value }),
      museumApi.getItems({ type: 'insight', page: insightPage.value, size: 20, keyword: keyword.value })
    ]);

    const quotes = wrapType(quoteRes.data.list || [], 'quote');
    const insights = wrapType(insightRes.data.list || [], 'insight');

    if (more) {
      quoteList.value.push(...quotes);
      insightList.value.push(...insights);
    } else {
      quoteList.value = quotes;
      insightList.value = insights;
    }

    hasMoreQuote.value = quoteRes.data.pagination?.has_more ?? false;
    hasMoreInsight.value = insightRes.data.pagination?.has_more ?? false;
  } catch (err) {
    console.error(err);
  }
}

function onSearch() {
  load();
}

const EMOTION_MAP = {
  positive: '积极',
  negative: '消极',
  neutral: '平静',
  happy: '开心',
  sad: '难过',
  anxious: '焦虑',
  angry: '愤怒',
  excited: '兴奋',
  calm: '平静',
  tired: '疲惫',
  stressed: '压力大',
  grateful: '感恩',
  hopeful: '期待',
  lonely: '孤独',
  confused: '迷茫',
  peaceful: '平静',
  energetic: '元气满满',
  frustrated: '烦躁',
  disappointed: '失落',
  content: '满足',
  relaxed: '放松',
  worried: '担忧',
  joyful: '喜悦',
  bored: '无聊',
  surprised: '惊喜',
  motivated: '有动力',
  discouraged: '气馁'
};

function formatEmotions(emotion) {
  if (!emotion) return [];
  return String(emotion).split(/[,，]/).map(t => t.trim()).filter(Boolean).map(t => EMOTION_MAP[t.toLowerCase()] || t);
}

function addInsight() {
  uni.navigateTo({ url: '/pages/museum/item-edit?type=insight' });
}

function editItem(item) {
  uni.navigateTo({ url: `/pages/museum/item-edit?id=${item.id}&type=${item.type}` });
}

function deleteItem(item) {
  pendingDeleteItem = item;
  showDeleteModal.value = true;
}

/**
 * 确认删除感悟/金句
 */
async function confirmDelete() {
  showDeleteModal.value = false;
  const item = pendingDeleteItem;
  pendingDeleteItem = null;
  if (!item) return;
  try {
    await museumApi.deleteItem(item.id);
    uni.showToast({ title: '已删除', icon: 'success' });
    quotePage.value = 1;
    insightPage.value = 1;
    load();
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' });
  }
}

onMounted(() => {
  load();
});
onShow(() => {
  quotePage.value = 1;
  insightPage.value = 1;
  load();
});

/**
 * 列表滚动到底部加载更多（scroll-view 内部滚动，页面级 onReachBottom 不会触发）
 */
function loadMore() {
  if (!hasMore.value) return;
  if (hasMoreQuote.value) quotePage.value++;
  if (hasMoreInsight.value) insightPage.value++;
  load(true);
}
</script>

<style lang="scss" scoped>
.insights-page {
  /* AppPage fixed 模式：flex:1 占满 header 以下剩余空间，页面本身不滚动 */
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
}
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

.list-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.list-content {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 24rpx;
}

.insights-list {
  flex: 1;
}

.section {
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin: 0 $spacing-md $spacing-sm;
}

/* 金句卡片 */
.insight-card.quote {
  .quote-header {
    display: flex;
    align-items: flex-start;
    margin-bottom: $spacing-md;
  }

  .quote-icon {
    font-size: 72rpx;
    color: $cream;
    font-family: Georgia, serif;
    line-height: 1;
    margin-right: $spacing-sm;
    flex-shrink: 0;
  }

  .quote-content {
    flex: 1;
    font-size: $text-lg;
    font-weight: $font-medium;
    color: $text-primary;
    line-height: 1.6;
    padding-top: 12rpx;
  }
}

.card-actions {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.card-action {
  padding: 8rpx 20rpx;
  border-radius: 32rpx;
  font-size: $text-sm;
  background: #F5F5F5;
  color: #666666;

  &.danger {
    background: #FFEBEE;
    color: #E57373;
  }
}

/* 感悟卡片 */
.insight-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: $spacing-md;
  margin: 0 $spacing-md $spacing-sm;
  box-shadow: $shadow-card;
}

.insight-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  line-height: 1.6;
  display: block;
  margin-bottom: $spacing-sm;
}

.insight-content {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.6;
  display: block;
  margin-bottom: $spacing-md;
}

.insight-emotions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin-bottom: $spacing-md;
}

.emotion-tag {
  padding: 6rpx 16rpx;
  border-radius: 32rpx;
  background: #E8F5E9;
  font-size: $text-xs;
  color: #2E7D32;
}

.insight-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.insight-date {
  font-size: $text-xs;
  color: $text-tertiary;
}

/* 添加按钮固定屏幕底部，不随列表滚动（与食谱库/创建食谱按钮一致） */
.add-insight-btn {
  position: fixed;
  left: 48rpx;
  right: 48rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFE585;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #27282D;
  z-index: 100;
}
</style>