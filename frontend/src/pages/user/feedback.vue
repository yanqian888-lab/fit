<template>
  <AppPage>
    <view class="feedback-page">
      <view class="tab-bar">
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

      <view class="form-card">
        <text class="card-title">反馈类型</text>
        <view class="type-list">
          <text v-for="t in currentTypes" :key="t.value" class="type-item" :class="{ active: form.type === t.value }" @click="form.type = t.value">{{ t.label }}</text>
        </view>

        <text class="card-title">反馈内容</text>
        <textarea v-model="form.content" :placeholder="activeTab === 'report' ? '请描述你要举报的 AI 内容问题...' : '请描述你遇到的问题或建议...'" :maxlength="500" />

        <!-- 提审阶段先隐藏上传截图（相机/相册读取权限暂不声明） -->
        <view class="image-list hidden-permission">
          <view v-for="(img, idx) in form.images" :key="img" class="image-item" @click="previewImage(idx)">
            <image :src="fullImageUrl(img)" mode="aspectFill" />
            <view class="image-delete" @click.stop="removeImage(idx)">×</view>
          </view>
        </view>

        <text class="card-title">联系方式（选填）</text>
        <input v-model="form.contact" placeholder="手机号 / 邮箱" />

        <text class="card-title">满意度</text>
        <view class="score-list">
          <text v-for="s in 5" :key="s" class="score-item" :class="{ active: form.score >= s }" @click="form.score = s">★</text>
        </view>

        <AppButton block type="primary" :loading="submitting" @click="submit">提交反馈</AppButton>
      </view>

      <view class="history-card">
        <text class="card-title">反馈历史</text>
        <view v-for="item in history" :key="item.id" class="history-item">
          <view class="history-main">
            <view class="history-header">
              <text class="history-type">{{ typeLabel(item.type) }}</text>
              <text class="history-status" :class="item.status">{{ item.status_text }}</text>
            </view>
            <text class="history-content">{{ item.content }}</text>
            <view v-if="item.images && item.images.length" class="history-images">
              <image
                v-for="(img, idx) in item.images"
                :key="idx"
                class="history-image"
                :src="fullImageUrl(img)"
                mode="aspectFill"
                @click="previewHistoryImage(item.images, idx)"
              />
            </view>
            <text class="history-time">{{ formatTime(item.created_at) }}</text>
            <!-- 回复内容 -->
            <view v-if="item.reply" class="reply-box">
              <text class="reply-label">官方回复：</text>
              <text class="reply-content">{{ item.reply }}</text>
              <text v-if="item.replied_at" class="reply-time">{{ formatTime(item.replied_at) }}</text>
            </view>
          </view>
        </view>
        <AppEmpty v-if="history.length === 0" text="暂无反馈记录" icon="📝" />
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { feedbackApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppButton from '../../components/AppButton.vue';
import AppEmpty from '../../components/AppEmpty.vue';
import { uploadFile } from '../../utils/request';
import { getServerUrl } from '../../utils/environment.js';

const feedbackTypes = [
  { label: '功能建议', value: 'feature' },
  { label: 'BUG 反馈', value: 'bug' },
  { label: '其他', value: 'other' }
];
const reportTypes = [
  { label: 'AI内容举报', value: 'report' }
];
const allTypes = [...feedbackTypes, ...reportTypes];

const tabs = [
  { label: '意见反馈', value: 'feedback' },
  { label: '举报', value: 'report' }
];

const activeTab = ref('feedback');
const currentTypes = computed(() => activeTab.value === 'report' ? reportTypes : feedbackTypes);

function typeLabel(value) {
  const t = allTypes.find(t => t.value === value);
  return t ? t.label : value;
}

function switchTab(tab) {
  activeTab.value = tab;
  form.value.type = tab === 'report' ? 'report' : 'feature';
}

function formatTime(time) {
  if (!time) return '';
  const date = new Date(time);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const form = ref({ type: 'feature', content: '', contact: '', score: 5, images: [] });
const serverUrl = getServerUrl();
const history = ref([]);
const submitting = ref(false);

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage?.options || {};

  if (options.tab === 'report') {
    activeTab.value = 'report';
    form.value.type = 'report';
    form.value.content = decodeURIComponent(options.content || '');
  }

  loadHistory();
});

async function loadHistory() {
  try {
    const res = await feedbackApi.getList({ size: 10 });
    history.value = (res.data.list || []).map(item => ({
      ...item,
      images: Array.isArray(item.images) ? item.images : []
    }));
  } catch (err) {
    console.error(err);
  }
}

function fullImageUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${serverUrl}${url}`;
}

/**
 * 反馈上传图片：提审阶段相机/相册读取权限暂不声明，入口已隐藏
 * 后续开放时恢复下面的 uni.chooseImage 调用（原 chooseImage 函数体保留在注释里）
 */
function chooseImage() {
  uni.showToast({ title: '该功能暂未开放', icon: 'none' });
  /*
  const remain = 5 - form.value.images.length;
  if (remain <= 0) {
    uni.showToast({ title: '最多上传5张图片', icon: 'none' });
    return;
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      uni.showLoading({ title: '上传中...', mask: true });
      try {
        for (const tempPath of res.tempFilePaths) {
          const uploadRes = await uploadFile('/upload/image', tempPath, 'image');
          if (uploadRes.data?.url) {
            form.value.images.push(uploadRes.data.url);
          }
        }
      } catch (err) {
        console.error(err);
        uni.showToast({ title: '图片上传失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    }
  });
  */
}

function removeImage(index) {
  form.value.images.splice(index, 1);
}

function previewImage(index) {
  uni.previewImage({
    current: fullImageUrl(form.value.images[index]),
    urls: form.value.images.map(fullImageUrl)
  });
}

function previewHistoryImage(images, index) {
  uni.previewImage({
    current: fullImageUrl(images[index]),
    urls: images.map(fullImageUrl)
  });
}

async function submit() {
  if (!form.value.content.trim()) {
    uni.showToast({ title: '请输入反馈内容', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await feedbackApi.submit(form.value);
    uni.showToast({ title: '提交成功', icon: 'success' });
    activeTab.value = 'feedback';
    form.value = { type: 'feature', content: '', contact: '', score: 5, images: [] };
    loadHistory();
  } catch (err) {
    uni.showToast({ title: '提交失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.feedback-page {
  position: relative;
  z-index: 1;
  padding-top: $spacing-md;
}

.tab-bar {
  display: flex;
  margin: 0 $spacing-md $spacing-md;
  background: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: $spacing-md 0;
  font-size: $text-base;
  color: $text-secondary;
  position: relative;
}

.tab-item.active {
  color: $text-primary;
  font-weight: $font-semibold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 12rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #8DBB77;
  border-radius: 2rpx;
}

.form-card,
.history-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin: 0 $spacing-md $spacing-md;
  box-shadow: $shadow-card;
}

.form-card {
  :deep(.app-button.primary) {
    background: #8DBB77;
    color: #FFFFFF;
    box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
  }
}

.card-title {
  font-size: $text-base;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-sm;
}

.type-list {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.type-item {
  background: $gray-50;
  border-radius: $radius-pill;
  padding: 12rpx 28rpx;
  font-size: $text-sm;
  color: $text-secondary;
}

.type-item.active {
  background: #8DBB77;
  color: #FFFFFF;
}

textarea {
  width: 100%;
  height: 220rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: $spacing-md;
  font-size: $text-base;
  color: $text-primary;
  margin-bottom: $spacing-md;
}

input {
  width: 100%;
  height: 88rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  font-size: $text-base;
  color: $text-primary;
  margin-bottom: $spacing-md;
}

.score-list {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.score-item {
  font-size: 56rpx;
  color: $gray-200;
}

.score-item.active {
  color: #8DBB77;
}

.history-item {
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $gray-50;
}

.history-item:last-child {
  border-bottom: none;
}

.history-main {
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.history-type {
  font-size: $text-xs;
  color: $text-secondary;
  background: $gray-50;
  padding: 4rpx 12rpx;
  border-radius: $radius-sm;
}

.history-content {
  font-size: $text-sm;
  color: $text-primary;
  margin-bottom: 8rpx;
  line-height: 1.5;
}

.history-time {
  font-size: $text-xs;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
}

.history-status {
  font-size: $text-xs;
  padding: 4rpx 12rpx;
  border-radius: $radius-sm;
}

.history-status.pending {
  color: #FF9800;
  background: #FFF3E0;
}

.history-status.processing {
  color: #8DBB77;
  background: #E8F5E9;
}

.history-status.resolved {
  color: $mint-dark;
  background: #E8F5E9;
}

.reply-box {
  background: #F0F9F6;
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-top: $spacing-sm;
  border-left: 4rpx solid #8DBB77;
}

.reply-label {
  font-size: $text-xs;
  color: #8DBB77;
  font-weight: $font-semibold;
  margin-bottom: 8rpx;
  display: block;
}

.reply-content {
  font-size: $text-sm;
  color: $text-primary;
  line-height: 1.5;
  display: block;
  margin-bottom: 8rpx;
}

.reply-time {
  font-size: $text-xs;
  color: $text-secondary;
  display: block;
  text-align: right;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.image-item,
.image-add {
  width: 144rpx;
  height: 144rpx;
  border-radius: $radius-md;
  overflow: hidden;
  position: relative;
  background: $gray-50;
}

.image-item image {
  width: 100%;
  height: 100%;
}

.image-delete {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  line-height: 1;
}

.image-add {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx dashed $gray-200;
}

.add-icon {
  font-size: 56rpx;
  color: $gray-300;
  line-height: 1;
}

.history-images {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.history-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: $radius-sm;
  background: $gray-50;
}
</style>
