<template>
  <view class="mood-page">
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">记录心情</text>
      <view class="header-right"></view>
    </view>

    <view class="mood-content">
      <text class="section-title">今天感觉怎么样？</text>
      <view class="mood-options">
        <view
          v-for="item in moodOptions"
          :key="item.value"
          class="mood-item"
          :class="{ active: selectedMood === item.value }"
          @click="selectedMood = item.value"
        >
          <text class="mood-emoji">{{ item.emoji }}</text>
          <text class="mood-label">{{ item.label }}</text>
        </view>
      </view>

      <text class="section-title">想写点什么（可选）</text>
      <textarea
        class="mood-note"
        v-model="note"
        placeholder="记录下此刻的想法..."
        maxlength="200"
      />
      <text class="note-count">{{ note.length }}/200</text>

      <view class="submit-btn" :class="{ disabled: !selectedMood }" @click="submit">
        <text>保存</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { museumApi } from '../../api';
import { showRewardToast } from '../../utils/rewardToast.js';
import { getToday } from '../../utils/date';
import { goBack as navigateBack } from '../../utils/navigate';

const statusBarHeight = ref(44);
const selectedMood = ref('');
const note = ref('');

const moodOptions = [
  { value: 'great', emoji: '😄', label: '超棒' },
  { value: 'good', emoji: '🙂', label: '不错' },
  { value: 'normal', emoji: '😐', label: '一般' },
  { value: 'bad', emoji: '😔', label: '低落' },
  { value: 'terrible', emoji: '😫', label: '糟糕' }
];

function goBack() {
  navigateBack();
}

async function submit() {
  if (!selectedMood.value) {
    uni.showToast({ title: '请选择心情', icon: 'none' });
    return;
  }
  try {
    const res = await museumApi.saveMood({
      record_date: getToday(),
      emotion: selectedMood.value,
      content: note.value
    });
    showRewardToast(res.data?.reward_messages || [], '保存成功');
    setTimeout(() => goBack(), 800);
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' });
  }
}
</script>

<style scoped>
.mood-page {
  min-height: 100vh;
  background: #f5f5f5;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
  background: #fff;
}
.back-btn {
  width: 40px;
}
.back-icon {
  font-size: 28px;
  color: #333;
}
.page-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}
.header-right {
  width: 40px;
}
.mood-content {
  padding: 24px 16px;
}
.section-title {
  font-size: 15px;
  color: #666;
  margin-bottom: 16px;
}
.mood-options {
  display: flex;
  justify-content: space-between;
  margin-bottom: 32px;
}
.mood-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background: #fff;
  border-radius: 12px;
  width: 18%;
  border: 2px solid transparent;
}
.mood-item.active {
  border-color: #8DBB77;
  background: #f0f7ec;
}
.mood-emoji {
  font-size: 32px;
  margin-bottom: 6px;
}
.mood-label {
  font-size: 12px;
  color: #666;
}
.mood-note {
  width: 100%;
  height: 120px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-sizing: border-box;
  font-size: 14px;
}
.note-count {
  text-align: right;
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  margin-bottom: 32px;
}
.submit-btn {
  height: 48px;
  background: #8DBB77;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
.submit-btn.disabled {
  background: #ccc;
}
</style>
