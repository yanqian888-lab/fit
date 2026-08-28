<template>
  <AppPage :showHeader="true" title="聊天设置">
    <view class="settings-page">
      <view class="settings-card">
        <view class="setting-item">
          <text>消息通知</text>
          <switch :checked="settings.notification_enabled" color="#B5E2FF" @change="onChange('notification_enabled', $event)" />
        </view>
        <view class="setting-item">
          <text>大字体模式</text>
          <switch :checked="settings.font_size === 'large'" color="#B5E2FF" @change="onFontChange" />
        </view>
        <view class="setting-item danger" @click="clearHistory">
          <text>清空聊天历史</text>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { systemApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';

const settings = ref({});

async function load() {
  try {
    const res = await systemApi.getSettings();
    settings.value = res.data;
  } catch (err) {
    console.error(err);
  }
}

function onChange(key, e) {
  settings.value[key] = e.detail.value ? 1 : 0;
  save();
}

function onFontChange(e) {
  settings.value.font_size = e.detail.value ? 'large' : 'medium';
  save();
}

async function save() {
  try {
    await systemApi.updateSettings(settings.value);
  } catch (err) {
    console.error(err);
  }
}

// 后端暂未提供清空聊天历史接口，先提示功能开发中
function clearHistory() {
  uni.showToast({ title: '功能开发中', icon: 'none' });
}

onMounted(load);
</script>

<style lang="scss" scoped>
.settings-page {
  padding-top: $spacing-md;
}

.settings-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: 0 $spacing-md;
  box-shadow: $shadow-card;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
  font-size: $text-base;
  color: $text-primary;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.danger {
  color: #E57373;
}

.arrow {
  font-size: 36rpx;
  color: $gray-300;
}
</style>
