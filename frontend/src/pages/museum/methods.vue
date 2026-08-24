<template>
  <view class="methods-page">
    <view class="header-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="header-center">
        <text class="header-title">我的方法库</text>
      </view>
      <view class="header-right"></view>
    </view>

    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索方法名称或内容"
        confirm-type="search"
      />
      <image class="search-icon" src="/static/image/icon/sousuo.svg" mode="aspectFit" />
    </view>

    <scroll-view class="list-scroll" scroll-y>
      <view class="list-content">
        <view v-if="displayList.length > 0" class="methods-list">
        <view v-for="item in displayList" :key="item.id" class="method-card">
          <image v-if="item.extracted_data?.image" class="method-image" :src="item.extracted_data.image" mode="aspectFill" />
          <view class="method-header">
            <text class="method-title">{{ item.title }}</text>
          </view>
          <text class="method-content">{{ item.content }}</text>
          <view class="method-footer">
            <text class="method-date">{{ formatDateTime(item.created_at) }}</text>
            <view class="method-actions">
              <view class="action-btn edit" @click="editItem(item)">编辑</view>
              <view class="action-btn delete" @click="remove(item.id)">删除</view>
            </view>
          </view>
        </view>
        <AppLoadMore :has-more="hasMore" />
      </view>
        <AppEmpty v-else :image="'/static/image/icon/quesheng01.png'" :title="emptyTitle" :subtitle="emptySubtitle" full />
      </view>
    </scroll-view>

    <view class="add-method-btn" @click="goAdd">添加方法</view>

    <!-- 删除确认弹框 -->
    <AppModal
      v-model:visible="showDeleteModal"
      icon="none"
      title="确认删除"
      text="删除后无法恢复"
      confirmText="删除"
      confirmDanger
      cancelText="取消"
      @confirm="confirmDelete"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onReachBottom } from '@dcloudio/uni-app';
import { museumApi } from '../../api';
import { goBack as navigateBack } from '../../utils/navigate';
import AppEmpty from '../../components/AppEmpty.vue';
import AppLoadMore from '../../components/AppLoadMore.vue';
import AppModal from '../../components/AppModal.vue';
import { formatDateTime } from '../../utils/date';

const statusBarHeight = ref(44);

// 删除确认弹框状态
const showDeleteModal = ref(false);
let pendingDeleteId = null;

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
    const title = (item.title || '').toLowerCase();
    const content = (item.content || '').toLowerCase();
    return title.includes(k) || content.includes(k);
  });
});

const emptyTitle = computed(() => keyword.value.trim() ? '未找到相关方法' : '暂无方法');
const emptySubtitle = computed(() => keyword.value.trim() ? '换个关键词试试' : '点击下方按钮添加你的第一条方法吧');

async function load(more = false) {
  try {
    const params = { type: 'method', page: page.value, size: 999 };
    const res = await museumApi.getItems(params);
    const rows = (res.data.list || []).map(item => ({
      ...item,
      // 优先使用后端生成的方法标题
      title: item.extracted_data?.title || item.sub_type || item.content?.split('\n')[0]?.slice(0, 20) || '方法',
    }));
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
  // #ifdef MP-WEIXIN
  statusBarHeight.value += 44; // 小程序胶囊高度
  // #endif
  // #endif

  load();
});

onReachBottom(() => {
  if (!hasMore.value) return;
  page.value++;
  load(true);
});

function editItem(item) {
  uni.navigateTo({ url: `/pages/museum/item-edit?id=${item.id}&type=method` });
}

function goAdd() {
  uni.navigateTo({ url: '/pages/museum/item-edit?type=method' });
}

async function remove(id) {
  pendingDeleteId = id;
  showDeleteModal.value = true;
}

/**
 * 确认删除方法
 */
async function confirmDelete() {
  showDeleteModal.value = false;
  const id = pendingDeleteId;
  pendingDeleteId = null;
  if (id == null) return;
  try {
    await museumApi.deleteItem(id);
    load();
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' });
  }
}

</script>

<style lang="scss" scoped>
.methods-page {
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
  /* #ifdef MP-WEIXIN */
  margin-top: -88rpx; /* 标题/返回按钮上移到胶囊所在顶部栏 */
  /* #endif */
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
  padding-bottom: 24rpx;
}

.methods-list {
  flex: 1;
}

.method-card {
  background: $bg-card;
  border-radius: 32rpx;
  padding: $spacing-md;
  margin: 0 48rpx $spacing-sm;
  box-shadow: $shadow-card;
}

.method-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.method-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
}

.method-image {
  width: 100%;
  height: 360rpx;
  border-radius: 24rpx;
  margin-bottom: $spacing-md;
  overflow: hidden;
}

.method-content {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.6;
  display: block;
  margin-bottom: $spacing-md;
}

.method-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.method-date {
  font-size: $text-xs;
  color: $text-tertiary;
}

.method-actions {
  display: flex;
  gap: $spacing-md;
}

.action-btn {
  padding: 8rpx 20rpx;
  border-radius: 32rpx;
  font-size: $text-sm;
}

.action-btn.edit {
  background: #F5F5F5;
  color: #666666;
}

.action-btn.delete {
  background: #FFEBEE;
  color: #E57373;
}

.add-method-btn {
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