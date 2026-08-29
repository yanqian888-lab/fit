<template>
  <view class="shop-page">
    <view class="page-header">
      <view class="currency-bar">
        <view class="currency-item">
          <image class="currency-icon" :src="resolveStaticUrl('/static/image/icon/jiangguo@3x.png')" mode="aspectFit" />
          <text class="currency-value">{{ currency.berries || 0 }}</text>
        </view>
        <view class="currency-item">
          <image class="currency-icon" :src="resolveStaticUrl('/static/image/icon/xianhua@3x.png')" mode="aspectFit" />
          <text class="currency-value">{{ currency.flowers || 0 }}</text>
        </view>
      </view>
    </view>

    <image class="shop-title" :src="shopTitleUrl" mode="aspectFit" />

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

      <scroll-view class="item-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh" @scrolltolower="loadMore">
        <view v-if="items.length === 0 && !loading" class="empty-state">
          <image class="empty-icon" :src="resolveStaticUrl('/static/image/icon/quesheng01.png')" mode="aspectFit" />
          <text class="empty-text">暂无商品</text>
        </view>
        <view v-else class="item-grid">
          <view v-for="item in items" :key="item.id" class="item-card">
            <image class="item-image" :src="resolveStaticUrl(item.icon_thumb_url || item.icon_url) || categoryIcon(item.category)" mode="aspectFit" lazy-load />
            <text class="item-name">{{ item.name }}</text>
            <view class="item-price">
              <view class="price-tag" v-if="item.price_berries > 0">
                <image class="price-icon" :src="resolveStaticUrl('/static/image/icon/jiangguo@3x.png')" mode="aspectFit" />
                <text>{{ item.price_berries }}浆果</text>
              </view>
              <view class="price-tag" v-if="item.price_flowers > 0">
                <image class="price-icon" :src="resolveStaticUrl('/static/image/icon/xianhua@3x.png')" mode="aspectFit" />
                <text>{{ item.price_flowers }}鲜花</text>
              </view>
            </view>
            <button
              class="buy-btn"
              :class="{ disabled: !canBuy(item), owned: item.owned }"
              @click="buy(item)"
            >
              {{ item.owned ? '已拥有' : (item.stock === 0 ? '售罄' : '购买') }}
            </button>
          </view>
        </view>
        <view v-if="loading" class="list-tip">加载中…</view>
        <view v-else-if="items.length > 0 && !hasMore" class="list-tip">没有更多了</view>
        <view class="bottom-safe"></view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { resolveStaticUrl } from '../../utils/environment.js';
import { ref, onMounted } from 'vue';
import { petApi } from '../../api';

const tabs = ref([{ label: '全部', value: '' }]);
const activeTab = ref('');

/** 商店标题图：改为远程 CDN 加载以减小小程序包体积 */
const shopTitleUrl = resolveStaticUrl('/static/image/icon/shangdian_biaoti@3x.png');
const items = ref([]);
const currency = ref({});
const refreshing = ref(false);
// 分页加载（小程序全量渲染会卡，30 条/页滚动加载）
const PAGE_SIZE = 30;
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);

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
    const res = await petApi.getShopItems({ page: 1, size: 1 });
    const cats = res.data?.categories || [];
    // 固定分类：食物、运动器材始终在最前；其余分类按返回顺序排在后面
    const fixed = ['food', 'equipment'];
    const others = cats.filter(c => !fixed.includes(c));
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
      { label: '其他', value: 'prop' }
    ];
  }
}

function switchTab(value) {
  activeTab.value = value;
  page.value = 1;
  hasMore.value = true;
  items.value = [];
  loadItems();
}

async function loadCurrency() {
  try {
    const res = await petApi.getCurrency();
    currency.value = res.data || {};
  } catch (e) {}
}

async function loadItems() {
  if (loading.value) return;
  loading.value = true;
  try {
    const params = { page: page.value, size: PAGE_SIZE };
    if (activeTab.value) params.category = activeTab.value;
    const res = await petApi.getShopItems(params);
    const list = res.data?.list || [];
    items.value = page.value === 1 ? list : [...items.value, ...list];
    hasMore.value = res.data?.pagination ? res.data.pagination.has_more : false;
  } catch (e) {} finally {
    loading.value = false;
  }
}

function loadMore() {
  if (!hasMore.value || loading.value) return;
  page.value++;
  loadItems();
}

function onRefresh() {
  refreshing.value = true;
  page.value = 1;
  hasMore.value = true;
  Promise.all([loadCurrency(), loadItems()]).finally(() => {
    refreshing.value = false;
  });
}

/** 商店分类图标：改为远程 CDN 加载以减小小程序包体积 */
const categoryIconMap = {
  food: resolveStaticUrl('/static/image/icon/jiyinshi@3x.png'),
  equipment: resolveStaticUrl('/static/image/icon/jiyundong.png'),
  prop: resolveStaticUrl('/static/image/icon/gongjvxiang@3x.png'),
  skin: resolveStaticUrl('/static/image/icon/baobao@3x.png')
};
const defaultCategoryIcon = resolveStaticUrl('/static/image/icon/shangdianicon@3x.png');

function categoryIcon(category) {
  return categoryIconMap[category] || defaultCategoryIcon;
}

function effectText(effectJson, category) {
  try {
    const effect = JSON.parse(effectJson || '{}');
    const parts = [];
    if (effect.recipe) parts.push('可能掉落食谱');
    if (effect.unlock_workout) parts.push('解锁跟练');
    if (effect.skin_id) parts.push('宠物皮肤');
    if (effect.reduce_explore_seconds) parts.push('缩短外出时间');
    if (effect.increase_rare_drop) parts.push('提高稀有掉落');
    if (parts.length) return parts.join('，');
  } catch (e) {}
  return category === 'food' ? '美味食物' : category === 'prop' ? '道具效果' : '永久拥有';
}

function stockText(item) {
  if (item.stock === 0) return '售罄';
  if (item.stock < 0) return '库存充足';
  return `剩余 ${item.stock}`;
}

function canBuy(item) {
  if (item.owned || item.stock === 0) return false;
  if ((item.price_berries || 0) > (currency.value.berries || 0)) return false;
  if ((item.price_flowers || 0) > (currency.value.flowers || 0)) return false;
  return true;
}

// 不可购买的原因（用于点击时给出明确反馈，而不是禁用按钮静默无响应）
function cantBuyReason(item) {
  if (item.owned) return '已拥有，无需重复购买';
  if (item.stock === 0) return '已售罄';
  if ((item.price_berries || 0) > (currency.value.berries || 0)) {
    return `浆果不足，还差 ${item.price_berries - (currency.value.berries || 0)} 颗`;
  }
  if ((item.price_flowers || 0) > (currency.value.flowers || 0)) {
    return `鲜花不足，还差 ${item.price_flowers - (currency.value.flowers || 0)} 朵`;
  }
  return '';
}

async function buy(item) {
  const reason = cantBuyReason(item);
  if (reason) {
    uni.showToast({ title: reason, icon: 'none' });
    return;
  }
  uni.showLoading({ title: '购买中', mask: true });
  try {
    await petApi.buyShopItem(item.id);
    uni.hideLoading();
    uni.showToast({ title: '购买成功', icon: 'success' });
    await Promise.all([loadCurrency(), loadItems()]);
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '购买失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.shop-page {
  position: relative;
  min-height: 100vh;
  background: #F8FBF4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 24rpx 32rpx;
}
.currency-bar {
  display: flex;
  gap: 20rpx;
}
.currency-item {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 32rpx;
  padding: 8rpx 20rpx;
  gap: 8rpx;
}
.currency-icon {
  width: 32rpx;
  height: 32rpx;
}
.currency-value {
  font-size: 26rpx;
  color: $text-secondary;
  font-weight: 500;
}
.shop-title {
  width: 200rpx;
  height: 205rpx;
  margin: 8rpx auto 0;
  display: block;
}
.panel {
  flex: 1;
  background: #F8FBF4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.category-tabs {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 24rpx 32rpx;
}
.tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  padding: 0 42rpx;
  border-radius: 36rpx;
  font-size: 28rpx;
  color: #999999;
  white-space: nowrap;
}
.tab-item.active {
  background: #DDF3D2;
  color: #8EBB77;
  font-weight: 700;
}
.item-scroll {
  flex: 1;
  padding: 0 32rpx;
  box-sizing: border-box;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 160rpx;
}
.empty-icon {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: $text-base;
  color: $text-tertiary;
}
.item-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 32rpx 19rpx;
}
.item-card {
  width: 216rpx;
  height: 376rpx;
  background: #DDF3D2;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 34rpx;
  box-sizing: border-box;
}
.item-image {
  width: 152rpx;
  height: 141rpx;
}
.item-name {
  margin-top: 8rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #563E22;
  max-width: 192rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.item-price {
  margin-top: 6rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.price-tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: #563E22;
}
.price-icon {
  width: 24rpx;
  height: 24rpx;
}
.buy-btn {
  margin-top: 16rpx;
  width: 156rpx;
  height: 60rpx;
  line-height: 60rpx;
  padding: 0;
  border-radius: 30rpx;
  background: #8EBB77;
  color: #FFFFFF;
  font-size: 24rpx;
  text-align: center;
}
.buy-btn::after {
  border: none;
}
.buy-btn.disabled {
  background: #C9D6C2;
  color: #FFFFFF;
}
.buy-btn.owned {
  background: transparent;
  color: #8EBB77;
  border: 2rpx solid #8EBB77;
  box-sizing: border-box;
  line-height: 56rpx;
}
.bottom-safe {
  height: 40rpx;
}
.list-tip {
  text-align: center;
  font-size: 24rpx;
  color: #9AA894;
  padding: 24rpx 0;
}
</style>