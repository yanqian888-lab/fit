<template>
  <view class="insights-page">
    <view class="header-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="header-center">
        <text class="header-title">感悟与心情</text>
      </view>
      <view class="header-right"></view>
    </view>

    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索感悟内容"
        confirm-type="search"
      />
      <image class="search-icon" src="/static/image/icon/sousuo.svg" mode="aspectFit" />
    </view>

    <scroll-view class="list-scroll" scroll-y>
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
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { museumApi } from '../../api';
import { formatDate } from '../../utils/date';
import { goBack as navigateBack } from '../../utils/navigate';
import AppEmpty from '../../components/AppEmpty.vue';
import AppLoadMore from '../../components/AppLoadMore.vue';

const statusBarHeight = ref(44);

function goBack() {
  navigateBack('/pages/museum/index');
}

const quoteList = ref([]);
const insightList = ref([]);
const page = ref(1);
const hasMore = ref(true);
const keyword = ref('');

function matchesKeyword(item) {
  if (!keyword.value.trim()) return true;
  const k = keyword.value.trim().toLowerCase();
  const content = (item.content || '').toLowerCase();
  const title = (item.sub_type || '').toLowerCase();
  return content.includes(k) || title.includes(k);
}

const filteredQuoteList = computed(() => quoteList.value.filter(matchesKeyword).map(item => ({ ...item, type: 'quote' })));
const filteredInsightList = computed(() => insightList.value.filter(matchesKeyword).map(item => ({ ...item, type: 'insight' })));
const sortedList = computed(() => {
  const all = [...filteredQuoteList.value, ...filteredInsightList.value];
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
});
const hasContent = computed(() => quoteList.value.length > 0 || insightList.value.length > 0);
const emptyTitle = computed(() => keyword.value.trim() ? '未找到相关内容' : '暂无内容');
const emptySubtitle = computed(() => keyword.value.trim() ? '换个关键词试试' : '去添加你的第一条感悟或金句吧');

async function load(more = false) {
  try {
    // 同时加载金句和感悟
    const [quoteRes, insightRes] = await Promise.all([
      museumApi.getItems({ type: 'quote', page: page.value, size: 999 }),
      museumApi.getItems({ type: 'insight', page: page.value, size: 999 })
    ]);
    
    let quotes = (quoteRes.data.list || []).filter(item => item.author !== 'partner');
    let insights = (insightRes.data.list || []).filter(item => item.author !== 'partner');

    // 按创建时间倒序展示
    const sortByTime = (a, b) => new Date(b.created_at) - new Date(a.created_at);
    quotes = quotes.sort(sortByTime);
    insights = insights.sort(sortByTime);

    if (more) {
      quoteList.value.push(...quotes);
      insightList.value.push(...insights);
    } else {
      quoteList.value = quotes;
      insightList.value = insights;
    }
    
    hasMore.value = quoteRes.data.pagination.has_more || insightRes.data.pagination.has_more;
  } catch (err) {
    console.error(err);
  }
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
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复哦',
    confirmColor: '#E57373',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await museumApi.deleteItem(item.id);
        uni.showToast({ title: '已删除', icon: 'success' });
        page.value = 1;
        load();
      } catch (err) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
}

onMounted(() => {
  // #ifdef H5
  statusBarHeight.value = 44;
  // #endif
  // #ifndef H5
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 44;
  // #endif

  load();
});
onShow(() => {
  page.value = 1;
  load();
});

onReachBottom(() => {
  if (!hasMore.value) return;
  page.value++;
  load(true);
});
</script>

<style lang="scss" scoped>
.insights-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
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

.status-bar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 48rpx;
  color: #666666;
  font-weight: 700;
  line-height: 1;
  margin-left: -8rpx;
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 42rpx;
}

.header-right {
  width: 60rpx;
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

.add-insight-btn {
  flex-shrink: 0;
  height: 88rpx;
  margin: 24rpx 48rpx calc(40rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFE585;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #27282D;
}
</style>