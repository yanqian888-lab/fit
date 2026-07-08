<template>
  <AppPage>
    <AppHeader title="帮助中心" />
    <view class="help-page">
      <view class="search-bar">
        <input v-model="keyword" placeholder="搜索问题" @confirm="search" />
      </view>

      <view v-for="cat in categories" :key="cat.name" class="help-card">
        <text class="category-title">{{ cat.name }}</text>
        <view v-for="item in cat.items" :key="item.id" class="help-item" @click="goDetail(item)">
          <text>{{ item.title }}</text>
          <text class="arrow">›</text>
        </view>
      </view>

      <view class="more-actions">
        <AppButton block type="primary" @click="goFeedback">意见反馈</AppButton>
        <AppButton block @click="goGuide">重新查看引导</AppButton>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const keyword = ref('');
const categories = ref([
  {
    name: '新手入门',
    items: [
      { id: 1, title: '如何和搭子聊天记录饮食？', content: '直接在聊天框输入你吃了什么，搭子会自动识别并沉淀。' },
      { id: 2, title: '第一次使用需要设置什么？', content: '完成基础信息、选择搭子模式即可开始。' }
    ]
  },
  {
    name: '记录功能',
    items: [
      { id: 3, title: '如何修改已经确认的记录？', content: '进入今日记录，找到对应记录左滑或点击编辑。' },
      { id: 4, title: '支持哪些身体数据记录？', content: '体重、腰围、臀围、胸围、大腿围、臂围等。' }
    ]
  },
  {
    name: '博物馆',
    items: [
      { id: 5, title: '金句和感悟会自动保存吗？', content: '聊天中的金句和感悟会自动沉淀到博物馆。' },
      { id: 6, title: '如何生成对比照片？', content: '在对比墙选择两张照片即可同屏滑动对比。' }
    ]
  }
]);

function search() {
  uni.showToast({ title: `搜索 ${keyword.value}`, icon: 'none' });
}

function goDetail(item) {
  uni.navigateTo({ url: `/pages/user/help-detail?id=${item.id}&title=${encodeURIComponent(item.title)}&content=${encodeURIComponent(item.content)}` });
}

function goFeedback() {
  uni.navigateTo({ url: '/pages/user/feedback' });
}

function goGuide() {
  uni.navigateTo({ url: '/pages/guide/feature' });
}
</script>

<style lang="scss" scoped>
.help-page {
  padding-top: $spacing-md;
}

.search-bar {
  background: $bg-card;
  border-radius: $radius-pill;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.search-bar input {
  height: 80rpx;
  font-size: $text-base;
  color: $text-primary;
}

.help-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.category-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
}

.help-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
  font-size: $text-base;
  color: $text-secondary;
}

.help-item:last-child {
  border-bottom: none;
}

.arrow {
  color: $gray-300;
}

.more-actions {
  margin-top: $spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}
</style>
