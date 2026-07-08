<template>
  <AppPage>
    <AppHeader title="上传照片" />
    <view class="upload-page">
      <view class="preview-card" @click="chooseImage">
        <image v-if="imageUrl" :src="imageUrl" mode="aspectFill" />
        <text v-else class="upload-hint">点击选择照片</text>
      </view>

      <view class="form-card">
        <view class="form-item">
          <text class="input-label">拍摄角度</text>
          <picker mode="selector" :range="angles" :value="angleIndex" @change="onAngleChange">
            <view class="picker">{{ angles[angleIndex] }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="input-label">当前体重 (kg)</text>
          <input v-model="form.weight" type="digit" placeholder="选填" />
        </view>
        <view class="form-item">
          <text class="input-label">日期</text>
          <picker mode="date" :value="form.record_date" @change="onDateChange">
            <view class="picker">{{ form.record_date }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="input-label">描述</text>
          <textarea v-model="form.description" placeholder="记录一下此刻的心情..." />
        </view>
        <AppButton block type="primary" :loading="uploading" @click="submit">保存照片</AppButton>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { photoApi } from '../../api';
import { getToday } from '../../utils/date';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppButton from '../../components/AppButton.vue';

const angles = ['正面', '侧面', '背面'];
const angleValues = ['front', 'side', 'back'];
const imageUrl = ref('');
const uploading = ref(false);
const form = ref({
  angle: 'front',
  weight: '',
  record_date: getToday(),
  description: ''
});

const angleIndex = computed(() => angleValues.indexOf(form.value.angle));

onMounted(() => {
  const pages = getCurrentPages();
  const query = pages[pages.length - 1].$page?.options || {};
  if (query.url) imageUrl.value = decodeURIComponent(query.url);
});

function chooseImage() {
  uni.chooseImage({
    count: 1,
    success: (res) => {
      imageUrl.value = res.tempFilePaths[0];
    }
  });
}

function onAngleChange(e) {
  form.value.angle = angleValues[parseInt(e.detail.value)];
}

function onDateChange(e) {
  form.value.record_date = e.detail.value;
}

async function submit() {
  if (!imageUrl.value) {
    uni.showToast({ title: '请先选择照片', icon: 'none' });
    return;
  }
  uploading.value = true;
  try {
    // 演示：本地路径直接作为 url 保存，真实场景需先上传到服务器
    await photoApi.upload({
      url: imageUrl.value,
      angle: form.value.angle,
      weight: form.value.weight ? parseFloat(form.value.weight) : null,
      record_date: form.value.record_date,
      description: form.value.description
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  } finally {
    uploading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.upload-page {
  padding-top: $spacing-md;
}

.preview-card {
  width: 100%;
  height: 600rpx;
  border-radius: $radius-xl;
  background: $gray-50;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-md;
  overflow: hidden;
}

.preview-card image {
  width: 100%;
  height: 100%;
}

.upload-hint {
  font-size: $text-lg;
  color: $text-tertiary;
}

.form-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;
}

.form-item {
  margin-bottom: $spacing-md;
}

.input-label {
  display: block;
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
  font-weight: $font-medium;
}

.picker {
  height: 88rpx;
  line-height: 88rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  font-size: $text-base;
  color: $text-primary;
}

.form-item input,
.form-item textarea {
  width: 100%;
  background: $gray-50;
  border-radius: $radius-md;
  padding: $spacing-md;
  font-size: $text-base;
  color: $text-primary;
}

.form-item input {
  height: 88rpx;
  padding: 0 $spacing-md;
}

.form-item textarea {
  height: 160rpx;
}
</style>
