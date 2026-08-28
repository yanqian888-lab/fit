<template>
  <AppPage :showHeader="true" title="对比分析">
    <view class="photo-wall-page">
      <!-- 上传按钮 -->
      <view v-if="photos.length > 0" class="upload-bar">
        <text class="upload-btn" @click="goUpload">+ 上传照片</text>
      </view>

      <!-- 时间轴照片列表 -->
      <view v-if="photos.length > 0" class="timeline">
        <view v-for="photo in photos" :key="photo.id" class="timeline-item">
          <view class="timeline-date">
            <text class="date-day">{{ formatDay(photo.record_date) }}</text>
            <text class="date-month">{{ formatMonth(photo.record_date) }}</text>
          </view>
          <view class="timeline-content">
            <view class="photo-card" @click="previewPhoto(photo)">
              <image :src="photo.url" mode="aspectFill" class="photo-image" />
              <view class="photo-info">
                <text v-if="photo.weight" class="photo-weight">{{ photo.weight }}kg</text>
                <text v-if="photo.description" class="photo-desc">{{ photo.description }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <AppEmpty v-else image="/static/image/icon/quesheng01.png" title="暂无照片" subtitle="去上传你的第一张照片吧" full />
    </view>
    <view v-if="photos.length === 0" class="empty-action-btn" @click="goUpload">上传照片</view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { photoApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppEmpty from '../../components/AppEmpty.vue';

const photos = ref([]);

onMounted(() => loadPhotos());

async function loadPhotos() {
  try {
    const res = await photoApi.getList({ size: 200 });
    photos.value = res.data.list || [];
  } catch (err) {
    console.error(err);
  }
}

function goUpload() {
  uni.navigateTo({ url: '/pages/museum/photo-upload' });
}

function previewPhoto(photo) {
  uni.previewImage({
    urls: [photo.url],
    current: photo.url
  });
}

function formatDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return String(d.getDate()).padStart(2, '0');
}

function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月`;
}
</script>

<style lang="scss" scoped>
.photo-wall-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: $spacing-md;
}

.upload-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: $spacing-md;
}

.upload-btn {
  background: $mint;
  color: $white;
  border-radius: $radius-pill;
  padding: 12rpx 28rpx;
  font-size: $text-sm;
  font-weight: $font-medium;
}

/* 时间轴 */
.timeline {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.timeline-item {
  display: flex;
  gap: $spacing-md;
}

.timeline-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80rpx;
  padding-top: 8rpx;
}

.date-day {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
}

.date-month {
  font-size: $text-xs;
  color: $text-tertiary;
}

.timeline-content {
  flex: 1;
  position: relative;
}

.timeline-content::before {
  content: '';
  position: absolute;
  left: -24rpx;
  top: 16rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: $mint;
}

.timeline-content::after {
  content: '';
  position: absolute;
  left: -19rpx;
  top: 28rpx;
  bottom: -32rpx;
  width: 2rpx;
  background: rgba(93, 190, 157, 0.2);
}

.timeline-item:last-child .timeline-content::after {
  display: none;
}

.photo-card {
  background: $bg-card;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: $shadow-card;
}

.photo-image {
  width: 100%;
  height: 400rpx;
}

.photo-info {
  padding: $spacing-sm $spacing-md;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.photo-weight {
  font-size: $text-sm;
  color: $mint-dark;
  font-weight: $font-semibold;
}

.photo-desc {
  font-size: $text-sm;
  color: $text-secondary;
}

.empty-action-btn {
  position: fixed;
  left: 40rpx;
  right: 40rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFE585;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #27282D;
}
</style>