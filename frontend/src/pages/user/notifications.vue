<template>
  <AppPage>
    <AppHeader title="通知设置" />
    <view class="notifications-page">
      <view class="settings-card">
        <view class="setting-row">
          <text>接收通知总开关</text>
          <switch :checked="settings.notification_enabled === 1" @change="toggle('notification_enabled', $event)" color="#B5E2FF" />
        </view>
      </view>

      <view class="section-title">提醒类型</view>
      <view class="settings-card">
        <view class="setting-row">
          <text>喝水提醒</text>
          <switch :checked="settings.reminder_water === 1" @change="toggle('reminder_water', $event)" color="#B5E2FF" />
        </view>
        <view class="setting-row">
          <text>运动提醒</text>
          <switch :checked="settings.reminder_exercise === 1" @change="toggle('reminder_exercise', $event)" color="#B5E2FF" />
        </view>
        <view class="setting-row">
          <text>体重提醒</text>
          <switch :checked="settings.reminder_weight === 1" @change="toggle('reminder_weight', $event)" color="#B5E2FF" />
        </view>
      </view>

      <view class="section-title">饮水目标</view>
      <view class="settings-card">
        <view class="setting-row input-row">
          <text>每日目标饮水量</text>
          <view class="input-wrap">
            <input
              class="goal-input"
              type="number"
              v-model="settings.water_goal"
              placeholder="2000"
              @blur="saveWaterGoal"
            />
            <text class="input-unit">ml</text>
          </view>
        </view>
      </view>

      <view class="section-title">勿扰时段</view>
      <view class="settings-card">
        <view class="setting-row time-row">
          <text>开始时间</text>
          <picker mode="time" :value="settings.dnd_start" @change="onDndStartChange">
            <view class="picker-value">{{ settings.dnd_start || '22:00' }}</view>
          </picker>
        </view>
        <view class="setting-row time-row">
          <text>结束时间</text>
          <picker mode="time" :value="settings.dnd_end" @change="onDndEndChange">
            <view class="picker-value">{{ settings.dnd_end || '08:00' }}</view>
          </picker>
        </view>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import { systemApi } from '../../api';

const settings = ref({
  notification_enabled: 1,
  reminder_water: 1,
  reminder_weight: 1,
  reminder_exercise: 1,
  water_goal: 2000,
  dnd_start: '22:00',
  dnd_end: '08:00'
});

onMounted(() => {
  loadSettings();
});

async function loadSettings() {
  try {
    const res = await systemApi.getSettings();
    const data = res.data || {};
    settings.value = {
      notification_enabled: data.notification_enabled ?? 1,
      reminder_water: data.reminder_water ?? 1,
      reminder_weight: data.reminder_weight ?? 1,
      reminder_exercise: data.reminder_exercise ?? 1,
      water_goal: data.water_goal || 2000,
      dnd_start: (data.dnd_start || '22:00').slice(0, 5),
      dnd_end: (data.dnd_end || '08:00').slice(0, 5)
    };
  } catch (e) {
    console.error('加载通知设置失败:', e);
  }
}

async function saveSettings(updates = {}) {
  try {
    const payload = {
      ...settings.value,
      ...updates
    };
    await systemApi.updateSettings(payload);
  } catch (e) {
    console.error('保存通知设置失败:', e);
  }
}

function toggle(key, e) {
  const value = e.detail.value ? 1 : 0;
  settings.value[key] = value;
  saveSettings({ [key]: value });
}

function saveWaterGoal() {
  let value = parseInt(settings.value.water_goal);
  if (isNaN(value) || value < 500) value = 2000;
  settings.value.water_goal = value;
  saveSettings({ water_goal: value });
}

function onDndStartChange(e) {
  settings.value.dnd_start = e.detail.value;
  saveSettings({ dnd_start: e.detail.value });
}

function onDndEndChange(e) {
  settings.value.dnd_end = e.detail.value;
  saveSettings({ dnd_end: e.detail.value });
}
</script>

<style lang="scss" scoped>
.notifications-page {
  padding: $spacing-md;
}

.section-title {
  font-size: $text-sm;
  color: $text-tertiary;
  margin: $spacing-md 0 $spacing-sm 0;
  padding-left: $spacing-sm;
}

.settings-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: 0 $spacing-md;
  box-shadow: $shadow-card;
  margin-bottom: $spacing-md;
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

.input-row {
  align-items: center;
}

.input-wrap {
  display: flex;
  align-items: center;
}

.goal-input {
  width: 120rpx;
  text-align: right;
  font-size: $text-base;
  color: $text-primary;
  padding-right: 8rpx;
}

.input-unit {
  font-size: $text-sm;
  color: $text-tertiary;
}

.time-row {
  align-items: center;
}

.picker-value {
  font-size: $text-base;
  color: $text-secondary;
  padding: 8rpx 16rpx;
  background: $gray-50;
  border-radius: $radius-sm;
}
</style>
