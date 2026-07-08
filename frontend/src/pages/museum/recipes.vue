<template>
  <view class="recipes-page">
    <view class="header-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="header-center">
        <text class="header-title">食谱库</text>
      </view>
      <view class="header-right"></view>
    </view>

    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索食谱标题"
        confirm-type="search"
      />
      <image class="search-icon" src="/static/image/icon/sousuo.svg" mode="aspectFit" />
    </view>

    <scroll-view class="list-scroll" scroll-y>
      <view class="list-content">
        <view v-if="displayList.length > 0" class="recipes-list">
        <view v-for="item in displayList" :key="item.id" class="recipe-card">
          <view class="recipe-card-body" @click="goDetail(item.id)">
            <view v-if="item.extracted_data?.image" class="recipe-image">
              <image :src="item.extracted_data.image" mode="aspectFill" />
            </view>
            <view class="recipe-main">
              <text class="recipe-title">{{ item.sub_type || '健康食谱' }}</text>
              <text class="recipe-desc">{{ item.content }}</text>
              <text v-if="item.tags" class="recipe-tags">{{ formatTags(item.tags) }}</text>
            </view>
          </view>
          <view class="recipe-actions">
            <text class="recipe-date">{{ formatDate(item.created_at) }}</text>
            <view class="recipe-action-group">
              <text class="recipe-action" @click="editItem(item)">编辑</text>
              <text class="recipe-action danger" @click="deleteItem(item)">删除</text>
            </view>
          </view>
        </view>
        <AppLoadMore :has-more="hasMore" />
      </view>
        <AppEmpty v-else :image="'/static/image/icon/quesheng01.png'" :title="emptyTitle" :subtitle="emptySubtitle" full />
      </view>
    </scroll-view>

    <view v-if="list.length === 0" class="empty-action-btn" @click="addRecipe">添加食谱</view>
    <view v-else class="add-recipe-btn" @click="addRecipe">添加食谱</view>
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

const list = ref([]);
const page = ref(1);
const hasMore = ref(true);
const keyword = ref('');

const displayList = computed(() => {
  if (!keyword.value.trim()) return list.value;
  const k = keyword.value.trim().toLowerCase();
  return list.value.filter(item => {
    const title = (item.sub_type || '').toLowerCase();
    return title.includes(k);
  });
});

const emptyTitle = computed(() => keyword.value.trim() ? '未找到相关食谱' : '暂无食谱');
const emptySubtitle = computed(() => keyword.value.trim() ? '换个关键词试试' : '去添加你的第一条食谱吧');

function formatTags(tags) {
  return Array.isArray(tags) ? tags.join(' · ') : tags;
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/museum/recipe-detail?id=${id}` });
}

function addRecipe() {
  uni.navigateTo({ url: '/pages/museum/item-edit?type=recipe' });
}

function editItem(item) {
  uni.navigateTo({ url: `/pages/museum/item-edit?id=${item.id}&type=recipe` });
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
        load();
      } catch (err) {
        uni.showToast({ title: '删除失败', icon: 'none' });
      }
    }
  });
}

async function load(more = false) {
  try {
    const res = await museumApi.getItems({ type: 'recipe', page: page.value, size: 999 });
    const rows = res.data.list || [];
    if (more) list.value.push(...rows);
    else list.value = rows;
    hasMore.value = res.data.pagination?.has_more || false;
  } catch (err) {
    console.error(err);
  }
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
.recipes-page {
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
  margin: 0 48rpx 24rpx;
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
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.recipes-list {
  flex: 1;
}

.recipe-card {
  background: $bg-card;
  border-radius: 32rpx;
  padding: $spacing-md;
  margin: 0 48rpx $spacing-sm;
  box-shadow: $shadow-card;
}

.recipe-card-body {
  display: flex;
}

.recipe-image {
  width: 140rpx;
  height: 140rpx;
  border-radius: $radius-lg;
  background: #FFF0F3;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-md;
  font-size: 60rpx;
  flex-shrink: 0;
  overflow: hidden;

  image {
    width: 100%;
    height: 100%;
  }
}

.recipe-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.recipe-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: 8rpx;
}

.recipe-desc {
  font-size: $text-sm;
  color: $text-secondary;
  display: block;
  margin-bottom: 8rpx;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.recipe-tags {
  font-size: $text-xs;
  color: $mint-dark;
  background: $mint-light;
  align-self: flex-start;
  padding: 4rpx 14rpx;
  border-radius: $radius-pill;
}

.recipe-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: $spacing-sm;
  padding-top: $spacing-sm;
  border-top: 1rpx solid $gray-50;
}

.recipe-date {
  font-size: $text-xs;
  color: $text-tertiary;
}

.recipe-action-group {
  display: flex;
  gap: $spacing-md;
}

.recipe-action {
  padding: 8rpx 20rpx;
  border-radius: 32rpx;
  font-size: $text-sm;
  background: #F5F5F5;
  color: #666666;
}

.recipe-action.danger {
  background: #FFEBEE;
  color: #E57373;
}

.empty-action-btn,
.add-recipe-btn {
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