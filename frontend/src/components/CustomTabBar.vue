<template>
  <!-- CustomTabBar 组件 —— 视觉装饰层，覆盖在原生 tabBar 上方 -->
  <!-- 架构：pages.json custom:false + 原生 tabBar 正常显示 + 本组件做圆形装饰 -->
  <view class="custom-tab-bar">
    <view
      v-for="(item, index) in list"
      :key="item.pagePath"
      class="tab-item"
      :class="{ active: currentSelected === index }"
      :style="itemStyle(index)"
      @click="switchTab(index)"
    >
      <image
        class="tab-icon"
        :src="currentSelected === index ? item.selectedIconPath : item.iconPath"
        mode="aspectFit"
      />
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  selected: Number
});

const innerSelected = ref(0);

// ⚠️ 注意：图标路径要对应 frontend/static/tabbar/ 下的文件
const list = [
  {
    pagePath: '/pages/index/index',
    text: '聊聊',
    iconPath: '/static/tabbar/chat.png',
    selectedIconPath: '/static/tabbar/chat-active.png'
  },
  {
    pagePath: '/pages/pet/index',
    text: '搭搭',
    iconPath: '/static/tabbar/pet.png',
    selectedIconPath: '/static/tabbar/pet-active.png'
  },
  {
    pagePath: '/pages/record/index',
    text: '记录',
    iconPath: '/static/tabbar/record.png',
    selectedIconPath: '/static/tabbar/record-active.png'
  },
  {
    pagePath: '/pages/museum/index',
    text: '博物馆',
    iconPath: '/static/tabbar/museum.png',
    selectedIconPath: '/static/tabbar/museum-active.png'
  }
];

const currentSelected = computed(() => props.selected ?? innerSelected.value);

// ⚠️ 绝对坐标（rpx）—— iPhone 12/13 屏幕宽度 750rpx
// 原生 tabBar 4 个 tab，中心位置分别是：
// 750/4 = 187.5rpx 宽，中心 = 93.75, 281.25, 468.75, 656.25
const tabCenters = [94, 281, 469, 656];
const itemSize = 88; // 44px → 88rpx 直径
const itemTop = 56; // 圆形顶部距离 tabBar 顶部的位置（rpx）

/**
 * 计算每个 tab-item 的绝对定位样式
 * @param {number} index 
 */
function itemStyle(index) {
  return {
    left: `${tabCenters[index] - itemSize / 2}rpx`,
    top: `${itemTop}rpx`,
    width: `${itemSize}rpx`,
    height: `${itemSize}rpx`
  };
}

/**
 * 切换 tab
 * ⚠️ 必须带前导斜杠
 * ⚠️ 微信基础库 3.17.1 bug：从其他 tab 切回 index=0 可能失败
 *    加了 reLaunch 兜底
 */
function switchTab(index) {
  const url = list[index].pagePath;
  innerSelected.value = index;

  console.log('[CustomTabBar] 点击 tab:', index, url);

  // #ifdef MP-WEIXIN
  wx.switchTab({
    url,
    success: () => console.log('[CustomTabBar] switchTab ✅'),
    fail: (err) => {
      console.warn('[CustomTabBar] switchTab ❌', err.errMsg);
      if (index === 0) {
        console.log('[CustomTabBar] reLaunch 兜底');
        wx.reLaunch({ url });
      }
    }
  });
  // #endif
  
  // #ifndef MP-WEIXIN
  uni.switchTab({ url });
  // #endif
}

/**
 * 根据当前路由自动设置选中状态
 */
function setSelectedByRoute() {
  // #ifdef MP-WEIXIN
  const pages = getCurrentPages();
  const route = pages[pages.length - 1]?.route || '';
  const idx = list.findIndex(item => {
    const path = item.pagePath.replace(/^\//, '');
    return route === path;
  });
  if (idx > -1) innerSelected.value = idx;
  // #endif
}

onMounted(() => {
  setSelectedByRoute();
  uni.$on('tabbar-select', (index) => {
    innerSelected.value = index;
  });
});

onUnmounted(() => {
  uni.$off('tabbar-select');
});
</script>

<style lang="scss" scoped>
.custom-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: 750rpx;
  height: 156rpx; // tabBar 高度 50px = 100rpx + safe-area
  z-index: 999;
  pointer-events: none; // ⚠️ 穿透！让底下原生 tabBar 能收到点击
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  position: absolute;
  pointer-events: auto; // 只有圆形本身能点击
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.tab-item.active {
  background: #563E22; // 深色圆形背景
}

.tab-icon {
  width: 48rpx;  // 24px
  height: 48rpx;
}
</style>
