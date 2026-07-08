<template>
  <AppPage>
    <AppHeader title="搜索聊天记录" />
    <view class="search-page">
      <view class="search-bar">
        <input v-model="keyword" class="search-input" placeholder="搜索关键词..." confirm-type="search" @confirm="search" />
        <text class="search-btn" @click="search">搜索</text>
      </view>
      <view class="result-list">
        <view v-for="msg in results" :key="msg.id" class="msg-item">
          <text class="msg-role">{{ msg.role === 'user' ? '我' : '搭子' }}</text>
          <text class="msg-content">{{ msg.content }}</text>
          <text class="msg-time">{{ formatDateTime(msg.created_at) }}</text>
        </view>
        <AppEmpty v-if="results.length === 0 && searched" text="没有找到相关记录" icon="🔍" />
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref } from 'vue';
import { chatApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import { formatDateTime } from '../../utils/date';

const keyword = ref('');
const results = ref([]);
const searched = ref(false);

async function search() {
  if (!keyword.value.trim()) return;
  searched.value = true;
  try {
    const res = await chatApi.searchMessages({ keyword: keyword.value, size: 50 });
    results.value = res.data.list || [];
  } catch (err) {
    console.error(err);
  }
}
</script>

<style lang="scss" scoped>
.search-page {
  padding-top: $spacing-md;
}

.search-bar {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-pill;
  padding: 8rpx 8rpx 8rpx $spacing-md;
  box-shadow: $shadow-card;
  margin-bottom: $spacing-md;
}

.search-input {
  flex: 1;
  height: 72rpx;
  font-size: $text-base;
  color: $text-primary;
}

.search-btn {
  background: $mint;
  color: $white;
  padding: 14rpx 32rpx;
  border-radius: $radius-pill;
  font-size: $text-base;
  font-weight: $font-medium;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.msg-item {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;
}

.msg-role {
  font-size: $text-sm;
  color: $mint-dark;
  font-weight: $font-medium;
  margin-bottom: 6rpx;
  display: block;
}

.msg-content {
  font-size: $text-base;
  color: $text-primary;
  line-height: 1.6;
  display: block;
  margin-bottom: 6rpx;
}

.msg-time {
  font-size: $text-xs;
  color: $text-tertiary;
}
</style>
