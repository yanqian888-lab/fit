<template>
  <AppPage>
    <AppHeader title="通知设置" />
    <view class="notifications-page">
      <view class="settings-card">
        <view class="setting-row">
          <text>每日提醒</text>
          <switch :checked="settings.daily" @change="toggle('daily', $event)" color="#B5E2FF" />
        </view>
        <view class="setting-row">
          <text>打卡提醒</text>
          <switch :checked="settings.checkin" @change="toggle('checkin', $event)" color="#B5E2FF" />
        </view>
        <view class="setting-row">
          <text>沉淀确认提醒</text>
          <switch :checked="settings.precipitation" @change="toggle('precipitation', $event)" color="#B5E2FF" />
        </view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';

const settings = ref({ daily: true, checkin: true, precipitation: true });

onMounted(() => {
  const stored = uni.getStorageSync('notificationSettings');
  if (stored) settings.value = JSON.parse(stored);
});

function toggle(key, e) {
  settings.value[key] = e.detail.value;
  uni.setStorageSync('notificationSettings', JSON.stringify(settings.value));
}
</script>

<style lang="scss" scoped>
.notifications-page {
  padding-top: $spacing-md;
}

.settings-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: 0 $spacing-md;
  box-shadow: $shadow-card;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
  font-size: $text-base;
  color: $text-primary;
}

.setting-row:last-child {
  border-bottom: none;
}
</style>
