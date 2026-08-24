<template>
  <view class="diary-detail-page">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">{{ date }} 分析</text>
      <view class="header-right">
        <text class="header-action" @click="onMore">⋯</text>
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y>
      <view class="diary-card">
        <view class="diary-header">
          <text class="diary-date">{{ date }}</text>
          <text v-if="detail.is_favorite" class="favorite-tag">已收藏</text>
        </view>
        <text class="diary-content">{{ detail.content || '暂无内容' }}</text>
      </view>

      <view class="action-grid">
        <view class="action-btn" @click="toggleFavorite">
          <text class="action-icon">{{ detail.is_favorite ? '★' : '☆' }}</text>
          <text class="action-text">{{ detail.is_favorite ? '取消收藏' : '收藏' }}</text>
        </view>
        <view class="action-btn" @click="shareText">
          <text class="action-icon">↗</text>
          <text class="action-text">分享</text>
        </view>
        <view class="action-btn" @click="regenerate">
          <text class="action-icon">↻</text>
          <text class="action-text">重新生成</text>
        </view>
        <view class="action-btn danger" @click="deleteDiary">
          <text class="action-icon">🗑</text>
          <text class="action-text">删除</text>
        </view>
      </view>
    </scroll-view>

    <!-- 删除确认弹框 -->
    <AppModal
      v-model:visible="showDeleteModal"
      icon="none"
      title="确认删除"
      text="删除后无法恢复，确定要删除这篇分析吗？"
      confirmText="删除"
      confirmDanger
      cancelText="取消"
      @confirm="confirmDelete"
    />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { aiApi } from '../../api';
import { goBack as navigateBack } from '../../utils/navigate';
import { showGlobalLoading, hideGlobalLoading } from '../../utils/loading';
import AppModal from '../../components/AppModal.vue';

const statusBarHeight = ref(44);
const id = ref(null);
const date = ref('');
const detail = ref({});

// 删除确认弹框状态
const showDeleteModal = ref(false);

onMounted(() => {
  // #ifdef H5
  statusBarHeight.value = 44;
  // #endif
  // #ifndef H5
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 44;
  // #endif

  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  id.value = page.options?.id || page.$page?.options?.id;
  date.value = page.options?.date || page.$page?.options?.date || '';
  loadDetail();
});

async function loadDetail() {
  if (!id.value) return;
  showGlobalLoading();
  try {
    const res = await aiApi.getDiaryDetail(id.value);
    detail.value = res.data || {};
  } catch (e) {
    console.error(e);
  } finally {
    hideGlobalLoading();
  }
}

function goBack() {
  navigateBack();
}

function onMore() {
  uni.showActionSheet({
    itemList: [detail.value.is_favorite ? '取消收藏' : '收藏', '分享', '重新生成', '删除'],
    success: (res) => {
      if (res.tapIndex === 0) toggleFavorite();
      else if (res.tapIndex === 1) shareText();
      else if (res.tapIndex === 2) regenerate();
      else if (res.tapIndex === 3) deleteDiary();
    }
  });
}

async function toggleFavorite() {
  try {
    const res = await aiApi.toggleDiaryFavorite(id.value);
    detail.value.is_favorite = res.data?.is_favorite || 0;
    uni.showToast({ title: detail.value.is_favorite ? '已收藏' : '已取消收藏', icon: 'success' });
  } catch (e) {
    console.error(e);
  }
}

function shareText() {
  const text = `${date.value} 减肥日记\n\n${detail.value.content || ''}`;
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制到剪贴板', icon: 'success' })
  });
}

async function regenerate() {
  if (!date.value) return;
  showGlobalLoading({ text: '重新生成中…' });
  try {
    const res = await aiApi.generateDiary(date.value);
    uni.showToast({ title: '已重新生成', icon: 'success' });
    // 重新加载详情
    id.value = res.data?.item_id || id.value;
    await loadDetail();
  } catch (e) {
    console.error(e);
    uni.showToast({ title: '生成失败', icon: 'none' });
  } finally {
    hideGlobalLoading();
  }
}

function deleteDiary() {
  showDeleteModal.value = true;
}

/**
 * 确认删除日记
 */
async function confirmDelete() {
  showDeleteModal.value = false;
  try {
    await aiApi.deleteDiary(id.value);
    uni.showToast({ title: '已删除', icon: 'success' });
    setTimeout(() => goBack(), 800);
  } catch (e) {
    console.error(e);
  }
}
</script>

<style lang="scss" scoped>
.diary-detail-page {
  min-height: 100vh;
  background: #f7fbf4;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
  background: #fff;
}
.back-btn { width: 40px; }
.back-icon { font-size: 28px; color: #333; }
.page-title { font-size: 17px; font-weight: 600; color: #333; }
.header-right { width: 40px; text-align: right; }
.header-action { font-size: 24px; color: #666; padding: 0 4px; }

.content-scroll {
  padding: 16px;
  box-sizing: border-box;
}

.diary-card {
  background: #fff;
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.diary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.diary-date {
  font-size: 15px;
  color: #999;
}
.favorite-tag {
  font-size: 12px;
  color: #FFB347;
  background: #FFF8E7;
  padding: 4px 10px;
  border-radius: 12px;
}
.diary-content {
  font-size: 15px;
  color: #333;
  line-height: 1.8;
  white-space: pre-wrap;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.action-btn {
  background: #fff;
  border-radius: 16px;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.action-btn.danger .action-icon,
.action-btn.danger .action-text {
  color: #E57373;
}
.action-icon {
  font-size: 22px;
  color: #8DBB77;
  margin-bottom: 6px;
}
.action-text {
  font-size: 12px;
  color: #666;
}
</style>
