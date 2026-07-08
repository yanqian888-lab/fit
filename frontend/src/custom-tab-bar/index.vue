<template>
  <view class="custom-tab-bar">
    <view class="tab-bar-inner">
      <view
        v-for="(item, index) in list"
        :key="item.pagePath"
        class="tab-item"
        :class="{ active: currentSelected === index }"
        @click="switchTab(index)"
      >
        <view class="circle">
          <image
            class="tab-icon"
            :src="currentSelected === index ? item.selectedIconPath : item.iconPath"
            mode="aspectFit"
          />
          <text class="tab-label">{{ item.text }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  selected: Number
});


const innerSelected = ref(0);

const list = [
  {
    pagePath: '/pages/index/index',
    text: '搭子',
    iconPath: '/static/image/icon/dazi.png',
    selectedIconPath: '/static/image/icon/dazi_hover.png'
  },
  {
    pagePath: '/pages/record/index',
    text: '今日',
    iconPath: '/static/image/icon/jinri.png',
    selectedIconPath: '/static/image/icon/jinri_hover.png'
  },
  {
    pagePath: '/pages/museum/index',
    text: '博物馆',
    iconPath: '/static/image/icon/bowuguan.png',
    selectedIconPath: '/static/image/icon/bowuguan_hover.png'
  },
  {
    pagePath: '/pages/user/index',
    text: '我的',
    iconPath: '/static/image/icon/wode.png',
    selectedIconPath: '/static/image/icon/wode_hover.png'
  }
];

const currentSelected = computed(() => props.selected ?? innerSelected.value);

function switchTab(index) {
  const url = list[index].pagePath;
  uni.switchTab({ url });
}

function setSelectedByRoute() {
  const pages = getCurrentPages();
  const route = pages[pages.length - 1]?.route || '';
  const idx = list.findIndex(item => {
    const path = item.pagePath.replace(/^\//, '');
    return route === path;
  });
  if (idx > -1) innerSelected.value = idx;
}

onMounted(() => {
  setSelectedByRoute();

  uni.$on('tabbar-select', (index) => {
    innerSelected.value = index;
  });
});
</script>

<style lang="scss" scoped>
.custom-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 999;
  pointer-events: none;
  background: transparent;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.tab-bar-inner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 460rpx;
  height: 112rpx;
  padding: 6rpx;
  background: #FFFFFF;
  border-radius: 56rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.tab-item {
  position: relative;
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.tab-icon {
  width: 36rpx;
  height: 36rpx;
}

.tab-label {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #9CA3AF;
  line-height: 1.2;
}

.tab-item.active .circle {
  background: #1F2937;
}

.tab-item.active .tab-label {
  color: #FFFFFF;
  font-weight: 600;
}
</style>
