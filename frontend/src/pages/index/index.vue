<template>
  <view class="chat-page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="partner-info">
        <text class="partner-name">{{ partnerName }}</text>
        <view class="partner-status">
          <text class="status-dot" :class="partnerStatus"></text>
          <text class="status-text">{{ partnerStatusText }}</text>
        </view>
      </view>
      <view class="mode-switch">
        <text
          v-for="mode in modes"
          :key="mode.value"
          class="mode-item"
          :class="{ active: currentMode === mode.value }"
          @click="switchMode(mode.value)"
        >{{ mode.label }}</text>
      </view>
    </view>

    <!-- 今日进度悬浮卡 -->
    <view class="progress-card" @click="goToRecord">
      <view class="progress-item">
        <text class="progress-label">摄入</text>
        <text class="progress-value">{{ todayStats.intake }}</text>
      </view>
      <view class="progress-item">
        <text class="progress-label">消耗</text>
        <text class="progress-value">{{ todayStats.burned }}</text>
      </view>
      <view class="progress-item">
        <text class="progress-label">剩余</text>
        <text class="progress-value" :class="todayStats.status">{{ todayStats.remaining }}</text>
      </view>
    </view>

    <!-- 聊天消息列表 -->
    <scroll-view
      class="message-list"
      scroll-y
      :scroll-top="scrollTop"
      @scrolltoupper="loadMore"
      :upper-threshold="50"
    >
      <view
        v-for="msg in messages"
        :key="msg.id"
        class="message-item"
        :class="msg.role"
      >
        <view class="avatar">
          <text v-if="msg.role === 'user'">我</text>
          <text v-else>瘦</text>
        </view>
        <view class="message-content">
          <view class="bubble" :class="msg.role">
            <text class="message-text">{{ msg.content }}</text>
          </view>
          <view v-if="msg.precipitation_status === 1" class="precipitation-tag confirmed">
            <text class="tag-icon">✓</text>
            <text>已记录</text>
          </view>
          <view v-else-if="msg.precipitation_status === 2" class="precipitation-tag pending">
            <text>待确认</text>
          </view>
        </view>
      </view>

      <view v-if="loading" class="loading-tip">
        <text>搭子正在输入...</text>
      </view>
    </scroll-view>

    <!-- 底部输入区 -->
    <view class="input-area">
      <input
        v-model="inputText"
        class="chat-input"
        type="text"
        placeholder="和搭子聊聊今天吃了什么..."
        confirm-type="send"
        @confirm="sendMessage"
      />
      <button class="send-btn" :disabled="!inputText.trim() || loading" @click="sendMessage">
        发送
      </button>
    </view>

    <!-- 快速记录悬浮按钮 -->
    <view class="quick-record-btn" @click="showQuickRecord = true">
      <text class="plus">+</text>
    </view>

    <!-- 快速记录弹窗 -->
    <view v-if="showQuickRecord" class="quick-record-mask" @click="showQuickRecord = false">
      <view class="quick-record-panel" @click.stop>
        <view class="quick-title">快速记录</view>
        <view class="quick-grid">
          <view class="quick-item" @click="quickRecord('diet')">
            <text class="quick-icon">🍚</text>
            <text>饮食</text>
          </view>
          <view class="quick-item" @click="quickRecord('exercise')">
            <text class="quick-icon">🏃</text>
            <text>运动</text>
          </view>
          <view class="quick-item" @click="quickRecord('weight')">
            <text class="quick-icon">⚖️</text>
            <text>体重</text>
          </view>
          <view class="quick-item" @click="quickRecord('water')">
            <text class="quick-icon">💧</text>
            <text>喝水</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useUserStore } from '../../store';
import { chatApi, partnerApi, recordApi } from '../../api';

const userStore = useUserStore();

const messages = ref([]);
const inputText = ref('');
const loading = ref(false);
const scrollTop = ref(0);
const page = ref(1);
const hasMore = ref(true);
const showQuickRecord = ref(false);
const todayStats = ref({ intake: 0, burned: 0, remaining: 0, status: 'green' });

const modes = [
  { label: '温柔', value: 'gentle' },
  { label: '严格', value: 'strict' },
  { label: '损友', value: 'tease' }
];

const partnerName = computed(() => userStore.userInfo?.partner?.name || '瘦瘦');
const currentMode = computed(() => userStore.userInfo?.partner?.mode || 'gentle');
const partnerStatus = computed(() => userStore.userInfo?.partner?.status || 'awake');
const partnerStatusText = computed(() => userStore.userInfo?.partner?.status_text || '刚刚起床');

onMounted(() => {
  loadMessages();
  loadTodayStats();
});

// 加载聊天记录
async function loadMessages(reset = false) {
  if (reset) {
    page.value = 1;
    messages.value = [];
  }
  if (!hasMore.value && !reset) return;

  try {
    const res = await chatApi.getMessages({ page: page.value, size: 20 });
    const list = res.data.list || [];
    if (reset) {
      messages.value = list;
    } else {
      messages.value = [...list, ...messages.value];
    }
    hasMore.value = res.data.pagination.has_more;
    page.value++;
    scrollToBottom();
  } catch (err) {
    console.error('加载消息失败:', err);
  }
}

function loadMore() {
  loadMessages(false);
}

// 加载今日概览
async function loadTodayStats() {
  try {
    const res = await recordApi.getToday();
    todayStats.value = res.data;
  } catch (err) {
    console.error('加载今日概览失败:', err);
  }
}

// 发送消息
async function sendMessage() {
  const content = inputText.value.trim();
  if (!content || loading.value) return;

  loading.value = true;
  inputText.value = '';

  // 先显示用户消息
  messages.value.push({
    id: Date.now(),
    role: 'user',
    content,
    precipitation_status: 0,
    created_at: new Date().toISOString()
  });
  scrollToBottom();

  try {
    const res = await chatApi.send(content);
    const data = res.data;

    // 更新用户消息状态
    const userMsgIndex = messages.value.findIndex(m => m.id === Date.now());
    if (userMsgIndex > -1) {
      messages.value[userMsgIndex] = data.user_message;
    }

    // 添加搭子回复
    messages.value.push(data.partner_message);

    // 刷新今日概览
    loadTodayStats();
  } catch (err) {
    messages.value.push({
      id: Date.now() + 1,
      role: 'partner',
      content: '哎呀，我这边网络有点卡，你再说一遍好不？',
      created_at: new Date().toISOString()
    });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

// 切换模式
async function switchMode(mode) {
  try {
    await partnerApi.switchMode(mode);
    userStore.setPartnerMode(mode);
    uni.showToast({ title: '切换成功', icon: 'none' });
  } catch (err) {
    console.error('切换模式失败:', err);
  }
}

// 快速记录
function quickRecord(type) {
  showQuickRecord.value = false;
  const placeholders = {
    diet: '我今天吃了',
    exercise: '我今天运动了',
    weight: '今天体重',
    water: '今天喝了'
  };
  inputText.value = placeholders[type] || '';
}

// 跳转到记录中心
function goToRecord() {
  uni.switchTab({ url: '/pages/record/index' });
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    scrollTop.value = messages.value.length * 1000 + Date.now();
  });
}
</script>

<style lang="scss" scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f6fa;
}

.nav-bar {
  padding: 80rpx 24rpx 20rpx;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.partner-info {
  display: flex;
  flex-direction: column;
}

.partner-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.partner-status {
  display: flex;
  align-items: center;
  margin-top: 6rpx;
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 8rpx;
  background: #999;
}

.status-dot.awake { background: #FFC107; }
.status-dot.eating { background: #4CAF50; }
.status-dot.exercising { background: #2196F3; }
.status-dot.sleeping { background: #9E9E9E; }

.status-text {
  font-size: 22rpx;
  color: #999;
}

.mode-switch {
  display: flex;
  background: #f5f6fa;
  border-radius: 32rpx;
  padding: 4rpx;
}

.mode-item {
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  color: #666;
  border-radius: 28rpx;
}

.mode-item.active {
  background: #4CAF50;
  color: #fff;
}

.progress-card {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  justify-content: space-around;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.progress-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.progress-value {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
}

.progress-value.green { color: #4CAF50; }
.progress-value.yellow { color: #FFC107; }
.progress-value.red { color: #F44336; }

.message-list {
  flex: 1;
  padding: 0 24rpx;
  overflow-y: auto;
}

.message-item {
  display: flex;
  margin-bottom: 32rpx;
}

.message-item.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #4CAF50;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  flex-shrink: 0;
}

.message-item.user .avatar {
  background: #2196F3;
}

.message-content {
  max-width: 70%;
  margin: 0 20rpx;
}

.bubble {
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  background: #fff;
  word-break: break-all;
}

.bubble.partner {
  background: #fff;
  border-top-left-radius: 6rpx;
}

.bubble.user {
  background: #95EC69;
  border-top-right-radius: 6rpx;
}

.message-text {
  font-size: 30rpx;
  color: #333;
  line-height: 1.5;
}

.precipitation-tag {
  display: inline-flex;
  align-items: center;
  margin-top: 8rpx;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 20rpx;
}

.precipitation-tag.confirmed {
  color: #4CAF50;
  background: #E8F5E9;
}

.precipitation-tag.pending {
  color: #FF9800;
  background: #FFF3E0;
}

.tag-icon {
  margin-right: 4rpx;
}

.loading-tip {
  text-align: center;
  padding: 20rpx;
  font-size: 24rpx;
  color: #999;
}

.input-area {
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  display: flex;
  align-items: center;
  border-top: 1rpx solid #eee;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  background: #f5f6fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  margin-right: 16rpx;
}

.send-btn {
  width: 120rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: #4CAF50;
  color: #fff;
  border-radius: 36rpx;
  font-size: 28rpx;
  padding: 0;
}

.send-btn[disabled] {
  background: #ccc;
}

.quick-record-btn {
  position: fixed;
  right: 30rpx;
  bottom: 180rpx;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #4CAF50;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(76, 175, 80, 0.3);
}

.plus {
  color: #fff;
  font-size: 48rpx;
  font-weight: 300;
}

.quick-record-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.quick-record-panel {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 32rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.quick-title {
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 32rpx;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24rpx;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 0;
  background: #f5f6fa;
  border-radius: 16rpx;
}

.quick-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}

.quick-item text:last-child {
  font-size: 24rpx;
  color: #666;
}
</style>
