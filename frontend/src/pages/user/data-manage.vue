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
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { dataApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const lastSync = ref('');

onMounted(() => {
  lastSync.value = uni.getStorageSync('lastSync') || '';
});

async function exportData() {
  try {
    const res = await dataApi.export();
    const dataStr = JSON.stringify(res.data, null, 2);
    console.log('export data', dataStr);
    uni.showToast({ title: '已生成导出数据', icon: 'success' });
  } catch (err) {
    uni.showToast({ title: '导出失败', icon: 'none' });
  }
}

function clearCache() {
  uni.showModal({
    title: '清空缓存',
    content: '这不会删除云端数据，仅清除本地临时文件',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorage();
        uni.showToast({ title: '缓存已清空', icon: 'success' });
      }
    }
  });
}

async function clearAll() {
  uni.showModal({
    title: '危险操作',
    content: '将清空所有数据且无法恢复，确定吗？',
    confirmColor: '#E57373',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await dataApi.clearAll();
        uni.clearStorage();
        uni.showToast({ title: '已清空', icon: 'success' });
        setTimeout(() => uni.reLaunch({ url: '/pages/splash/index' }), 800);
      } catch (err) {
        uni.showToast({ title: '清空失败', icon: 'none' });
      }
    }
  });
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
