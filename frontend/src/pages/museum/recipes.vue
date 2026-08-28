<template>
  <AppPage :showHeader="true" title="食谱库">
  <view class="recipes-page">
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索食谱标题"
        confirm-type="search"
      />
      <image class="search-icon" src="/static/image/icon/sousuo.svg" mode="aspectFit" />
    </view>

    <view class="category-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <scroll-view class="list-scroll" scroll-y>
      <view class="list-content">
        <view v-if="displayList.length > 0" class="recipes-list">
        <view v-for="item in displayList" :key="item.id" class="recipe-card">
          <view class="recipe-card-body" @click="goDetail(item.id)">
            <view v-if="getRecipeImage(item)" class="recipe-image">
              <image :src="getRecipeImage(item)" mode="aspectFill" />
            </view>
            <view class="recipe-main">
              <text class="recipe-title">{{ item.title || getRecipeTitle(item) || '健康食谱' }}</text>
              <text class="recipe-desc">{{ getRecipeContent(item) }}</text>
              <text v-if="recipeTotalsText(item)" class="recipe-totals">{{ recipeTotalsText(item) }}</text>
              <text v-if="getRecipeTags(item)" class="recipe-tags">{{ getRecipeTags(item) }}</text>
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
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { museumApi } from '../../api';
import { formatDate } from '../../utils/date';
import AppEmpty from '../../components/AppEmpty.vue';
import AppLoadMore from '../../components/AppLoadMore.vue';
import AppModal from '../../components/AppModal.vue';

// 删除确认弹框状态
const showDeleteModal = ref(false);
let pendingDeleteItem = null;

const list = ref([]);
const page = ref(1);
const hasMore = ref(true);
const keyword = ref('');

const activeTab = ref('all');
const tabs = [
  { label: '全部', value: 'all' },
  { label: '搭搭食谱', value: 'dada_recipe' },
  { label: '聊聊食谱', value: 'precipitation_recipe' },
  { label: '自定义食谱', value: 'custom_recipe' }
];

const displayList = computed(() => {
  let filtered = list.value;
  if (activeTab.value !== 'all') {
    filtered = filtered.filter(item => item.sub_type === activeTab.value);
  }
  if (!keyword.value.trim()) return filtered;
  const k = keyword.value.trim().toLowerCase();
  return filtered.filter(item => {
    const title = (item.title || item.sub_type || '').toLowerCase();
    return title.includes(k);
  });
});

const emptyTitle = computed(() => keyword.value.trim() ? '未找到相关食谱' : '暂无食谱');
const emptySubtitle = computed(() => keyword.value.trim() ? '换个关键词试试' : '去添加你的第一条食谱吧');

function formatTags(tags) {
  return Array.isArray(tags) ? tags.join(' · ') : tags;
}

/**
 * 安全获取食谱图片地址，防止 extracted_data 为 null/undefined 时访问属性报错
 */
function getRecipeImage(item) {
  const d = item.extracted_data;
  if (d && typeof d === 'object' && d.image) return d.image;
  return '';
}

/**
 * 安全获取食谱标题，从 extracted_data 中兜底
 */
function getRecipeTitle(item) {
  const d = item.extracted_data;
  if (d && typeof d === 'object' && d.title) return d.title;
  return '';
}

/**
 * 安全获取食谱内容，处理 content 为对象或 JSON 字符串的情况
 */
function getRecipeContent(item) {
  const c = item.content;
  if (c == null) return '';
  if (typeof c === 'object') {
    // content 是对象时，尝试从 extracted_data 中取 content 字段
    const d = item.extracted_data;
    if (d && typeof d === 'object' && d.content) return d.content;
    return '';
  }
  if (typeof c === 'string' && c.startsWith('{')) {
    // content 是 JSON 字符串时，尝试解析并取 content 字段
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === 'object') {
        return parsed.content || parsed.title || '';
      }
    } catch (e) {}
  }
  return String(c);
}

/**
 * 安全获取食谱标签，处理 tags 为对象的情况
 */
function getRecipeTags(item) {
  const t = item.tags;
  if (t == null) return '';
  if (Array.isArray(t)) return t.join(' · ');
  if (typeof t === 'object') {
    // tags 是对象时，提取所有值
    return Object.values(t).filter(v => typeof v === 'string').join(' · ');
  }
  return String(t);
}

// 食谱总克数/总热量展示文案（有数据才显示）
function recipeTotalsText(item) {
  const d = item.extracted_data;
  if (!d || typeof d !== 'object') return '';
  const parts = [];
  if (d.total_weight > 0) parts.push(`约 ${d.total_weight}g`);
  if (d.total_calorie > 0) parts.push(`约 ${d.total_calorie} 千卡`);
  return parts.join(' · ');
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
  pendingDeleteItem = item;
  showDeleteModal.value = true;
}

/**
 * 确认删除食谱
 */
async function confirmDelete() {
  showDeleteModal.value = false;
  const item = pendingDeleteItem;
  pendingDeleteItem = null;
  if (!item) return;
  try {
    await museumApi.deleteItem(item.id);
    uni.showToast({ title: '已删除', icon: 'success' });
    load();
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' });
  }
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

.category-tabs {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 32rpx 24rpx;
  position: relative;
  z-index: 1;
  flex-wrap: nowrap;
  overflow-x: auto;
  white-space: nowrap;
}

.tab-item {
  padding: 12rpx 20rpx;
  border-radius: 32rpx;
  background: #FFFFFF;
  font-size: 24rpx;
  color: #666666;
  border: 2rpx solid #E5E7EB;
  flex-shrink: 0;
}

.tab-item.active {
  background: #DDF3D2;
  color: #563E22;
  border-color: #8DBB77;
  font-weight: 600;
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

.recipe-totals {
  font-size: $text-xs;
  color: #E8A65C;
  font-weight: 600;
  margin-top: 8rpx;
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