<template>
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
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  selected: Number
});

const innerSelected = ref(0);

const list = [
  {
    pagePath: '/pages/index/index',
    text: '聊聊',
    iconPath: '/static/image/icon/liaoliao@3x.png',
    selectedIconPath: '/static/image/icon/liaoliao_hover@3x.png'
  },
  {
    pagePath: '/pages/pet/index',
    text: '搭搭',
    iconPath: '/static/image/icon/dada@3x.png',
    selectedIconPath: '/static/image/icon/dada_hover@3x.png'
  },
  {
    pagePath: '/pages/record/index',
    text: '工具箱',
    iconPath: '/static/image/icon/gongjvxiang@3x.png',
    selectedIconPath: '/static/image/icon/gongjvxiang_hover@3x.png'
  },
  {
    pagePath: '/pages/museum/index',
    text: '博物馆',
    iconPath: '/static/image/icon/bowuguan@3x.png',
    selectedIconPath: '/static/image/icon/bowuguan_hover@3x.png'
  }
];

const currentSelected = computed(() => props.selected ?? innerSelected.value);

const centers = [164, 304, 444, 584]; // 82, 152, 222, 292 px -> rpx
const itemSize = 88; // 44 px radius -> 88 rpx diameter
const top = 34; // center y 39 px -> 78 rpx, top = 78 - 44 = 34 rpx

function itemStyle(index) {
  return {
    left: `${centers[index] - itemSize / 2}rpx`,
    top: `${top}rpx`,
    width: `${itemSize}rpx`,
    height: `${itemSize}rpx`
  };
}

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
  bottom: 32rpx; /* 整体上移 16px，避开底部手势区 */
  width: 750rpx;
  height: 156rpx;
  background: #F7FBF4;
  /* 背景向下补齐上移露出的 16px 缝隙，避免下方弹窗/列表内容透出 */
  box-shadow: 0 32rpx 0 0 #F7FBF4;
  z-index: 999;
  pointer-events: none;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  position: absolute;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.tab-item.active {
  background: #563E22;
}

.tab-icon {
  width: 72rpx;
  height: 72rpx;
}
</style>
