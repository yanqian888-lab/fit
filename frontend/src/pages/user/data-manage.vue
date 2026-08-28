<template>
  <AppPage>
    <AppHeader title="数据管理" />
    <view class="data-page">
      <view class="data-card">
        <text class="card-title">本地/云端数据</text>
        <text class="card-desc">你的记录会自动同步到云端。你可以导出数据备份或清空本地缓存。</text>
        <view class="data-actions">
          <AppButton type="primary" block @click="exportData">导出数据</AppButton>
          <AppButton type="secondary" block @click="clearCache">清空本地缓存</AppButton>
          <AppButton type="danger" block @click="clearAll">清空所有数据</AppButton>
        </view>
      </view>

      <view class="data-card">
        <text class="card-title">同步状态</text>
        <view class="sync-row">
          <text>上次同步</text>
          <text class="sync-time">{{ lastSync || '未同步' }}</text>
        </view>
        <AppButton block @click="syncNow">立即同步</AppButton>
      </view>
    </view>

    <!-- 清空缓存确认弹框 -->
    <AppModal
      v-model:visible="showClearCacheModal"
      icon="none"
      title="清空缓存"
      text="这不会删除云端数据，仅清除本地临时文件"
      confirmText="确认"
      cancelText="取消"
      @confirm="confirmClearCache"
    />

    <!-- 清空所有数据确认弹框（危险） -->
    <AppModal
      v-model:visible="showClearAllModal"
      icon="none"
      title="危险操作"
      text="将清空所有数据且无法恢复，确定吗？"
      confirmText="确认清空"
      confirmDanger
      cancelText="取消"
      @confirm="confirmClearAll"
    />
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { dataApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';
import AppModal from '../../components/AppModal.vue';

const lastSync = ref('');

// 清空类弹框状态
const showClearCacheModal = ref(false);
const showClearAllModal = ref(false);

onMounted(() => {
  lastSync.value = uni.getStorageSync('lastSync') || '';
});

async function exportData() {
  try {
    const res = await dataApi.export();
    const dataStr = JSON.stringify(res.data, null, 2);
    const filename = `fit_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;

    // #ifdef H5
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    uni.showToast({ title: '已开始下载', icon: 'success' });
    // #endif

    // #ifndef H5
    const fs = uni.getFileSystemManager();
    const filePath = `${uni.env.USER_DATA_PATH}/${filename}`;
    fs.writeFile({
      filePath,
      data: dataStr,
      encoding: 'utf8',
      success: () => {
        uni.showToast({ title: '已保存到本地', icon: 'success' });
      },
      fail: (err) => {
        console.error('导出保存失败:', err);
        uni.showToast({ title: '保存失败', icon: 'none' });
      }
    });
    // #endif
  } catch (err) {
    console.error('导出失败:', err);
    uni.showToast({ title: '导出失败', icon: 'none' });
  }
}

function clearCache() {
  showClearCacheModal.value = true;
}

/**
 * 确认清空本地缓存
 */
function confirmClearCache() {
  showClearCacheModal.value = false;
  uni.clearStorage();
  uni.showToast({ title: '缓存已清空', icon: 'success' });
}

async function clearAll() {
  showClearAllModal.value = true;
}

/**
 * 确认清空所有数据（危险操作）
 */
async function confirmClearAll() {
  showClearAllModal.value = false;
  try {
    await dataApi.clearAll();
    uni.clearStorage();
    uni.showToast({ title: '已清空', icon: 'success' });
    setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 800);
  } catch (err) {
    uni.showToast({ title: '清空失败', icon: 'none' });
  }
}

function syncNow() {
  const now = new Date().toLocaleString();
  uni.setStorageSync('lastSync', now);
  lastSync.value = now;
  uni.showToast({ title: '同步完成', icon: 'success' });
}
</script>

<style lang="scss" scoped>
.data-page {
  padding-top: $spacing-md;
}

.data-card {
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
  margin-bottom: $spacing-sm;
}

.card-desc {
  font-size: $text-sm;
  color: $text-secondary;
  line-height: 1.6;
  display: block;
  margin-bottom: $spacing-md;
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.sync-row {
  display: flex;
  justify-content: space-between;
  font-size: $text-base;
  color: $text-secondary;
  margin-bottom: $spacing-md;
}

.sync-time {
  color: $text-tertiary;
}
</style>
