<template>
  <view class="inventory-page">
    <view class="status-bar"></view>

    <!-- 返回按钮 -->
    <view class="back-btn" @click="goBack">
      <image class="back-icon" src="/static/image/icon/chehui@3x.png" mode="aspectFit" />
    </view>

    <!-- 顶部标题图 -->
    <image class="title-img" src="/static/image/icon/shangdian_biaoti@3x.png" mode="aspectFit" />

    <!-- 底部浅色面板 -->
    <view class="panel">
      <view class="category-tabs">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: activeTab === tab.value }"
          @click="switchTab(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <scroll-view class="item-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
        <view v-if="items.length === 0" class="empty-state">
          <image class="empty-img" src="/static/image/icon/quesheng01.png" mode="aspectFit" />
          <text class="empty-text">背包里空空如也</text>
          <text class="empty-sub" @click="goShop">去商城看看 ›</text>
        </view>
        <view v-else class="item-grid">
          <view v-for="item in items" :key="item.id" class="grid-cell">
            <view class="item-card">
              <text class="item-count">x{{ item.quantity }}</text>
              <view class="item-img-box">
                <image class="item-img" :src="categoryImage(item.category)" mode="aspectFit" />
              </view>
              <text class="item-name">{{ item.name }}</text>
              <text class="item-desc">{{ effectText(item.effect_json, item.category) }}</text>
            </view>
            <button
              class="use-btn"
              :class="{ disabled: !canUse(item) }"
              :disabled="!canUse(item)"
              @click="use(item)"
            >
              {{ useButtonText(item) }}
            </button>
          </view>
        </view>
        <view class="bottom-safe"></view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { petApi } from '../../api';

const tabs = ref([{ label: '全部', value: '' }]);
const activeTab = ref('');
const items = ref([]);
const currency = ref({});
const refreshing = ref(false);

const CATEGORY_LABELS = {
  food: '食物',
  equipment: '运动器材',
  prop: '道具',
  skin: '皮肤'
};

onMounted(() => {
  loadCurrency();
  loadCategories();
  loadItems();
});

async function loadCategories() {
  try {
    const res = await petApi.getInventory({ page: 1, size: 1 });
    const cats = res.data?.categories || [];
    // 固定分类：食物、运动器材始终在最前；其余分类（除皮肤外）排在后面；皮肤并入道具 tab
    const fixed = ['food', 'equipment'];
    const others = cats.filter(c => !fixed.includes(c) && c !== 'skin');
    tabs.value = [
      { label: '全部', value: '' },
      ...fixed.map(c => ({ label: CATEGORY_LABELS[c] || c, value: c })),
      ...others.map(c => ({ label: CATEGORY_LABELS[c] || c, value: c }))
    ];
  } catch (e) {
    tabs.value = [
      { label: '全部', value: '' },
      { label: '食物', value: 'food' },
      { label: '运动器材', value: 'equipment' },
      { label: '道具', value: 'prop' }
    ];
  }
}

function switchTab(value) {
  activeTab.value = value;
  loadItems();
}

async function loadCurrency() {
  try {
    const res = await petApi.getCurrency();
    currency.value = res.data || {};
  } catch (e) {}
}

async function loadItems() {
  try {
    // 一次性拉全量，前端按 tab 过滤；道具 tab 包含 prop + skin（皮肤归入道具）
    const res = await petApi.getInventory({});
    const all = (res.data?.list || []).filter(i => i.quantity > 0);
    if (!activeTab.value) {
      items.value = all;
    } else if (activeTab.value === 'prop') {
      items.value = all.filter(i => ['prop', 'skin'].includes(i.category));
    } else {
      items.value = all.filter(i => i.category === activeTab.value);
    }
  } catch (e) {}
}

function onRefresh() {
  refreshing.value = true;
  Promise.all([loadCurrency(), loadItems()]).finally(() => {
    refreshing.value = false;
  });
}

// 返回：有上级页面（如从搭搭页进入）则返回，否则回到搭搭 tab 页
function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.switchTab({ url: '/pages/pet/index' });
  }
}

function goShop() {
  uni.navigateTo({ url: '/pages/shop/index' });
}

function categoryImage(category) {
  const map = {
    food: '/static/image/icon/jiyinshi@3x.png',
    equipment: '/static/image/icon/jiyundong.png',
    prop: '/static/image/icon/gongjvxiang@3x.png',
    skin: '/static/image/icon/baobao@3x.png'
  };
  return map[category] || '/static/image/icon/quesheng01.png';
}

function effectText(effectJson, category) {
  try {
    const effect = JSON.parse(effectJson || '{}');
    const parts = [];
    if (effect.recipe) parts.push('可能掉落食谱');
    if (effect.unlock_workout) parts.push('已解锁跟练');
    if (effect.skin_id) parts.push('可装备皮肤');
    if (effect.reduce_explore_seconds) parts.push(`缩短外出 ${Math.floor(effect.reduce_explore_seconds / 60)} 分钟`);
    if (effect.increase_rare_drop) parts.push('提高稀有掉落');
    if (parts.length) return parts.join('，');
  } catch (e) {}
  return category === 'food' ? '美味食物' : category === 'prop' ? '道具效果' : category === 'skin' ? '宠物皮肤' : '永久拥有';
}

function canUse(item) {
  return ['food', 'equipment', 'prop', 'skin'].includes(item.category) && item.quantity > 0;
}

function useButtonText(item) {
  if (item.category === 'equipment') return '使用';
  if (item.category === 'skin') return '装备';
  return '使用';
}

async function use(item) {
  if (!canUse(item)) return;
  uni.showLoading({ title: item.category === 'food' ? '喂食中' : '使用中', mask: true });
  try {
    // 食物直接喂给搭搭（与搭搭页喂食同一接口：每日上限/夜间休息/食谱掉落一致）
    if (item.category === 'food') {
      const res = await petApi.feed([item.id]);
      uni.hideLoading();
      const recipeText = res.data?.recipes_saved?.length ? `，解锁食谱「${res.data.recipes_saved[0]}」` : '';
      uni.showToast({ title: `喂食成功${recipeText}`, icon: 'success', duration: 2500 });
      await loadItems();
      return;
    }
    const res = await petApi.useInventoryItem(item.id);
    uni.hideLoading();
    const effect = res.data?.effect || {};
    let title = res.data?.message || (effect.skinId ? '装备成功' : '使用成功');
    uni.showToast({ title, icon: 'success', duration: 2500 });
    await Promise.all([loadCurrency(), loadItems()]);
    // 器材使用后跳转到记录页“陪你动”tab
    if (item.category === 'equipment') {
      setTimeout(() => {
        uni.setStorageSync('record_pending_tab', 'workout');
        uni.switchTab({ url: '/pages/record/index' });
      }, 1500);
    }
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '使用失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.inventory-page {
  position: relative;
  min-height: 100vh;
  background: #F8FBF4;
  display: flex;
  flex-direction: column;
}
.status-bar {
  height: var(--status-bar-height);
  /* #ifdef MP-WEIXIN */
  /* 小程序端状态栏下方还有悬浮胶囊，额外让出胶囊高度+间距 */
  height: calc(var(--status-bar-height) + 88rpx);
  /* #endif */
}

/* 返回按钮 */
.back-btn {
  padding: 20rpx 32rpx 0;
}
.back-icon {
  width: 52rpx;
  height: 40rpx;
  display: block;
}

/* 顶部标题图 */
.title-img {
  width: 200rpx;
  height: 187rpx;
  margin: 8rpx auto 0;
  display: block;
}

/* 底部浅色面板 */
.panel {
  flex: 1;
  background: #F8FBF4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Tab 切换 */
.category-tabs {
  display: flex;
  align-items: center;
  gap: 40rpx;
  padding: 24rpx 32rpx 0;
}
.tab-item {
  font-size: 28rpx;
  color: #666666;
  white-space: nowrap;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 10rpx;
}
.tab-item.active {
  background: #DDF3D2;
  border-radius: 36rpx;
  color: #333333;
  font-weight: 500;
  padding: 0 32rpx;
}

/* 商品网格 */
.item-scroll {
  flex: 1;
  height: 0;
  padding: 32rpx 32rpx 0;
  box-sizing: border-box;
}
.item-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 36rpx 19rpx;
}
.grid-cell {
  width: 216rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 商品卡片 216×308rpx */
.item-card {
  position: relative;
  width: 216rpx;
  height: 308rpx;
  background: #DDF3D2;
  border-radius: 24rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.item-count {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 999rpx;
  padding: 2rpx 14rpx;
  font-size: 22rpx;
  color: #4A7C43;
  line-height: 1.4;
}
.item-img-box {
  width: 152rpx;
  height: 141rpx;
  background: #FFFFFF;
  border-radius: 12rpx;
  margin-top: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-img {
  width: 142rpx;
  height: 116rpx;
}
.item-name {
  margin-top: 8rpx;
  font-size: 28rpx;
  color: #333333;
  font-weight: 500;
  max-width: 192rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.item-desc {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #8C9B88;
  max-width: 192rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 使用按钮 */
.use-btn {
  margin-top: 16rpx;
  width: 216rpx;
  height: 46rpx;
  line-height: 46rpx;
  border-radius: 23rpx;
  background: #DDF3D2;
  color: #3E5C38;
  font-size: 24rpx;
  font-weight: 500;
  padding: 0;
}
.use-btn::after {
  border: none;
}
.use-btn.disabled {
  background: rgba(221, 243, 210, 0.5);
  color: #A9B8A4;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}
.empty-img {
  width: 240rpx;
  height: 240rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #8C9B88;
}
.empty-sub {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #4A7C43;
}
.bottom-safe {
  height: 40rpx;
}
</style>
