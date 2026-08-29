<template>
  <view class="overlay-mask">
    <view class="overlay-backdrop" @click="$emit('close')"></view>
    <view class="overlay-panel">
      <view class="overlay-header">
        <text class="overlay-title">商店</text>
        <view class="overlay-close" @click="$emit('close')">✕</view>
      </view>

      <view class="header-currency" @click="goCurrencyDetail">
        <view class="currency-item">
          <image class="currency-icon" :src="resolveStaticUrl('/static/image/icon/jiangguo@3x.png')" mode="aspectFit" />
          <text class="currency-value">{{ currency.berries || 0 }}</text>
        </view>
        <view class="currency-item">
          <image class="currency-icon" :src="resolveStaticUrl('/static/image/icon/xianhua@3x.png')" mode="aspectFit" />
          <text class="currency-value">{{ currency.flowers || 0 }}</text>
        </view>
      </view>

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

      <scroll-view class="overlay-scroll" scroll-y @scrolltolower="loadMore" :scroll-top="scrollTop">
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
                <image class="price-icon" :src="resolveStaticUrl('/static/image/icon/jiangguo@3x.png')" />
                <text>{{ item.price_berries }}浆果</text>
              </view>
              <view class="price-tag" v-if="item.price_flowers > 0">
                <image class="price-icon" :src="resolveStaticUrl('/static/image/icon/xianhua@3x.png')" />
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
import { resolveStaticUrl } from '../../../utils/environment.js';
import { ref, onMounted, nextTick } from 'vue';
import { petApi } from '../../../api';

const emit = defineEmits(['close', 'bought']);

// 外部可指定打开时定位的分类 tab（如从跟练列表引导购买器材时传 equipment）
const props = defineProps({
  initialCategory: { type: String, default: '' }
});

const CATEGORY_LABELS = {
  food: '食物',
  equipment: '运动器材',
  prop: '道具',
  skin: '皮肤'
};

const tabs = ref([]);
const activeTab = ref('');
const items = ref([]);
const currency = ref({});
const scrollTop = ref(0);
// 分页加载（小程序全量渲染 180+ 卡片会卡，30 条/页滚动加载）
const PAGE_SIZE = 30;
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);

onMounted(async () => {
  loadCurrency();
  await loadCategories();
  loadItems();
});

async function loadCategories() {
  try {
    const res = await petApi.getShopItems({ page: 1, size: 1 });
    const cats = res.data?.categories || [];
    const fixed = ['food', 'equipment'];
    const others = cats.filter(c => !fixed.includes(c));
    tabs.value = [
      ...fixed.map(c => ({ label: CATEGORY_LABELS[c] || c, value: c })),
      ...others.map(c => ({ label: CATEGORY_LABELS[c] || c, value: c }))
    ];
    // 默认选中：外部指定分类优先（存在才生效），否则第一个分类
    if (tabs.value.length > 0 && !activeTab.value) {
      const specified = props.initialCategory && tabs.value.some(t => t.value === props.initialCategory);
      activeTab.value = specified ? props.initialCategory : tabs.value[0].value;
    }
  } catch (e) {}
}

function switchTab(value) {
  activeTab.value = value;
  page.value = 1;
  hasMore.value = true;
  items.value = [];
  // 切换 tab 时重置滚动位置
  scrollTop.value = 0;
  nextTick(() => {
    scrollTop.value = 1;
    nextTick(() => { scrollTop.value = 0; });
  });
  loadItems();
}

// 进入货币明细页（余额 + 收支流水）
function goCurrencyDetail() {
  uni.navigateTo({ url: '/pages/pet/currency-detail' });
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

/** 商店面板分类图标：改为远程 CDN 加载以减小小程序包体积 */
const categoryIconMap = {
  food: resolveStaticUrl('/static/image/icon/jiyinshi@3x.png'),
  equipment: resolveStaticUrl('/static/image/icon/jiyundong.png'),
  prop: resolveStaticUrl('/static/image/icon/gongjvxiang@3x.png'),
  skin: resolveStaticUrl('/static/image/icon/baobao@3x.png')
};
const defaultShopIcon = resolveStaticUrl('/static/image/icon/shangdianicon@3x.png');

function categoryIcon(category) {
  return categoryIconMap[category] || defaultShopIcon;
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
    emit('bought');
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '购买失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.overlay-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.overlay-backdrop {
  position: absolute;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
}
.overlay-panel {
  position: relative;
  width: 100%;
  height: 82vh;
  background: #F8FBF4;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.overlay-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx 32rpx 8rpx;
  position: relative;
}
.overlay-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #563E22;
}
.header-currency {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding: 8rpx 32rpx 12rpx;
}
.currency-item {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 40rpx;
  padding: 12rpx 28rpx;
  gap: 10rpx;
  min-width: 140rpx;
}
.currency-icon {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
}
.currency-value {
  font-size: 32rpx;
  color: #563E22;
  font-weight: 700;
  flex-shrink: 1;
}
.overlay-close {
  position: absolute;
  right: 32rpx;
  top: 24rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #999;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 32rpx;
  padding: 16rpx 32rpx 16rpx;
  /* 上移 8px（16rpx），取消之前为"与头部拉开间距"而加的 margin-top，滚动空间因此扩大 8px */
  margin-top: 0;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
}
.category-tabs::-webkit-scrollbar {
  display: none;
}
.tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  padding: 0 32rpx;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #999999;
  white-space: nowrap;
  flex-shrink: 0;
}
.tab-item text {
  white-space: nowrap;
}
.tab-item.active {
  background: #DDF3D2;
  color: #8EBB77;
  font-weight: 700;
}
.tab-item.active {
  background: #DDF3D2;
  color: #8EBB77;
  font-weight: 700;
}

.overlay-scroll {
  flex: 1;
  height: 0;
  overflow-y: auto;
  /*
   * 商品网格水平居中，左右边距对称 32rpx。
   * 右侧额外通过 item-grid 的 padding-right 为滚动条预留空间，
   * 避免滚动条压到第三列商品。
   */
  padding-left: 32rpx;
  padding-right: 32rpx;
  box-sizing: border-box;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}
.empty-icon {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
}
.item-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  row-gap: 32rpx;
  column-gap: 16rpx;
  /*
   * 右侧预留 16rpx 滚动条避让区，确保第三列卡片不会被滚动条遮挡。
   * 使用 flex-start + gap 替代 space-between，最后一行不足3个时左对齐。
   */
  padding-right: 16rpx;
}
.item-card {
  /*
   * 固定 32% 百分比宽度：弹层占满屏幕宽度（750rpx 基准）下每卡 ≈ 219rpx，
   * 3×32% = 96%，剩余宽度由 gap 分配为列间距，任何设备宽度永不折成 2 列 ✅
   * 内部子元素尺寸（图/字/max-width）统一按百分比约束，避免超出卡边缘
   */
  width: calc((100% - 32rpx) / 3);
  flex: 0 0 calc((100% - 32rpx) / 3);
  height: 340rpx;
  background: #DDF3D2;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 8rpx 16rpx;
  box-sizing: border-box;
}
.item-image {
  /* 卡宽 ≈172rpx，两侧各留 10rpx → 图宽 152rpx? 152>172-16=156 可，但统一用百分比更稳 */
  width: 88%;
  height: 120rpx;
  object-fit: contain;
}
.item-name {
  margin-top: 8rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: #563E22;
  max-width: 100%;
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
  width: 92%;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0;
  border-radius: 28rpx;
  background: #8EBB77;
  color: #FFFFFF;
  font-size: 22rpx;
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
  line-height: 52rpx;
}
.bottom-safe {
  /* 列表末尾内容能完整滚入视口，不被底部手势条/tab 遮挡 */
  height: calc(96rpx + env(safe-area-inset-bottom));
}
.list-tip {
  text-align: center;
  font-size: 24rpx;
  color: #9AA894;
  padding: 24rpx 0;
}
</style>
