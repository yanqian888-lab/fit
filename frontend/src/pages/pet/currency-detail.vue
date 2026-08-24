<template>
  <view class="currency-page">
    <view class="header-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <view class="header-center">
        <text class="header-title">货币明细</text>
      </view>
      <view class="header-right"></view>
    </view>

    <!-- 余额卡片 -->
    <view class="balance-row">
      <view class="balance-card">
        <image class="balance-icon" src="/static/image/icon/jiangguo@3x.png" mode="aspectFit" />
        <text class="balance-num">{{ currency.berries ?? 0 }}</text>
        <text class="balance-label">浆果</text>
      </view>
      <view class="balance-card">
        <image class="balance-icon" src="/static/image/icon/xianhua@3x.png" mode="aspectFit" />
        <text class="balance-num">{{ currency.flowers ?? 0 }}</text>
        <text class="balance-label">鲜花</text>
      </view>
    </view>

    <!-- 收支流水 -->
    <scroll-view class="tx-scroll" scroll-y>
      <view class="tx-list">
        <view v-for="tx in list" :key="tx.id" class="tx-item">
          <view class="tx-info">
            <text class="tx-title">{{ sourceLabel(tx) }}</text>
            <text class="tx-time">{{ formatTime(tx.created_at) }}</text>
          </view>
          <view class="tx-amount" :class="{ minus: tx.amount < 0 }">
            <image class="tx-icon" :src="tx.currency_type === 'flowers' ? '/static/image/icon/xianhua@3x.png' : '/static/image/icon/jiangguo@3x.png'" mode="aspectFit" />
            <text>{{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}</text>
          </view>
        </view>
        <view v-if="!loading && list.length === 0" class="tx-empty">暂无流水记录</view>
        <view v-if="list.length > 0 && !hasMore" class="tx-end">没有更多了</view>
        <view v-if="hasMore && list.length > 0" class="tx-more" @click="loadMore">加载更多</view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { petApi } from '../../api';

const statusBarHeight = ref(44);
const currency = ref({});
const list = ref([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);

const SOURCE_LABELS = {
  task: '任务奖励',
  newbie_task: '新手任务',
  achievement: '成就奖励',
  checkin: '签到奖励',
  chat: '聊天奖励',
  pet_feed: '喂食搭搭',
  pet_exercise: '搭搭运动',
  pet_explore: '搭搭外出',
  pet_home_event: '居家事件',
  small_joy: '小确幸',
  record_diet: '记录饮食',
  record_exercise: '记录运动',
  record_body: '记录体重',
  record_water: '记录饮水',
  record_sleep: '记录睡眠',
  record_mood: '记录心情',
  record_habit: '记录习惯',
  record_defecation: '记录排便',
  record_fasting_complete: '完成轻断食',
  shop_buy: '商店购买',
  use_item: '使用道具',
  generate_analysis: '生成分析',
  manual_adjust: '系统调整'
};

onMounted(async () => {
  // #ifndef H5
  try {
    statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 44;
  } catch (e) {}
  // #endif
  loadCurrency();
  loadTransactions(1);
});

function sourceLabel(tx) {
  return SOURCE_LABELS[tx.source] || tx.source || '其他';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  // 服务器存 UTC，转东八区显示
  const cn = new Date(d.getTime() + 8 * 3600000);
  const mm = String(cn.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cn.getUTCDate()).padStart(2, '0');
  const hh = String(cn.getUTCHours()).padStart(2, '0');
  const mi = String(cn.getUTCMinutes()).padStart(2, '0');
  return `${cn.getUTCFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}

async function loadCurrency() {
  try {
    const res = await petApi.getCurrency();
    currency.value = res.data || {};
  } catch (e) {}
}

async function loadTransactions(p) {
  if (loading.value) return;
  loading.value = true;
  try {
    const res = await petApi.getCurrencyTransactions({ page: p, size: 20 });
    const data = res.data || {};
    if (p === 1) list.value = data.list || [];
    else list.value = list.value.concat(data.list || []);
    hasMore.value = !!data.pagination?.has_more;
    page.value = p;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  loadTransactions(page.value + 1);
}

function goBack() {
  uni.navigateBack({ delta: 1 });
}
</script>

<style lang="scss" scoped>
.currency-page {
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

.balance-row {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
}

.balance-card {
  flex: 1;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05);
}

.balance-icon {
  width: 64rpx;
  height: 64rpx;
  margin-bottom: 12rpx;
}

.balance-num {
  font-size: 56rpx;
  font-weight: 700;
  color: #563E22;
  line-height: 1.2;
}

.balance-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
}

.tx-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
}

.tx-list {
  margin: 0 32rpx 32rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 8rpx 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.05);
}

.tx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #F0F2F5;
}

.tx-item:last-child {
  border-bottom: none;
}

.tx-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.tx-title {
  font-size: 28rpx;
  color: #27282D;
  font-weight: 600;
}

.tx-time {
  font-size: 22rpx;
  color: #9CA3AF;
}

.tx-amount {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #8DBB77;
}

.tx-amount.minus {
  color: #E8A65C;
}

.tx-icon {
  width: 32rpx;
  height: 32rpx;
}

.tx-empty,
.tx-end,
.tx-more {
  text-align: center;
  font-size: 26rpx;
  color: #9CA3AF;
  padding: 48rpx 0;
}

.tx-more {
  color: #8DBB77;
  font-weight: 600;
}
</style>
