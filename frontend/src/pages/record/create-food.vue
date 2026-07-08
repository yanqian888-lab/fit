<template>
  <AppPage>
    <view class="create-food-page">
      <AppHeader title="自定义食物" />

      <scroll-view class="create-food-scroll" scroll-y>
        <view class="form-card">
          <AppInput v-model="form.name" label="食物名称 *" placeholder="请输入食物名称" />

          <view class="form-item">
            <text class="input-label">类别 *</text>
            <picker mode="selector" :range="categoryLabels" :value="categoryIndex" @change="onCategoryChange">
              <view class="picker" :class="{ placeholder: !form.category }">{{ categoryLabel }}</view>
            </picker>
          </view>

          <AppInput v-model="form.calorie_per_100g" label="热量（每100g）*" type="digit" placeholder="请输入热量" suffix="千卡" />

          <view class="form-row">
            <view class="form-item">
              <AppInput v-model="form.protein_per_100g" label="蛋白质" type="digit" placeholder="0" suffix="g" />
            </view>
            <view class="form-item">
              <AppInput v-model="form.carb_per_100g" label="碳水化合物" type="digit" placeholder="0" suffix="g" />
            </view>
            <view class="form-item">
              <AppInput v-model="form.fat_per_100g" label="脂肪" type="digit" placeholder="0" suffix="g" />
            </view>
          </view>

          <view class="form-item switch-item">
            <view class="switch-label">
              <text class="input-label">是否公开到食谱库</text>
            </view>
            <switch :checked="form.is_public" color="#7BC8A0" @change="form.is_public = $event.detail.value" />
          </view>
        </view>

        <view class="bottom-placeholder"></view>
      </scroll-view>

      <view class="bottom-actions">
        <AppButton block size="lg" :loading="loading" @click="submit">保存</AppButton>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed } from 'vue';
import { systemApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppInput from '../../components/AppInput.vue';
import AppButton from '../../components/AppButton.vue';

const categories = [
  { value: '主食类', label: '主食类' },
  { value: '蔬菜水果类', label: '蔬果类' },
  { value: '肉蛋奶类', label: '肉蛋奶' },
  { value: '豆类坚果类', label: '豆/坚果' },
  { value: '零食饮料类', label: '零食饮料' },
  { value: '中西菜肴类', label: '中西菜肴' },
  { value: '调味油脂类', label: '调味油脂' },
  { value: '代餐特殊食品', label: '代餐特殊' }
];

const categoryLabels = categories.map(c => c.label);

const form = ref({
  name: '',
  category: '',
  calorie_per_100g: '',
  protein_per_100g: '',
  carb_per_100g: '',
  fat_per_100g: '',
  is_public: false
});

const loading = ref(false);

const categoryIndex = computed(() => {
  const idx = categories.findIndex(c => c.value === form.value.category);
  return idx >= 0 ? idx : 0;
});

const categoryLabel = computed(() => {
  const item = categories.find(c => c.value === form.value.category);
  return item ? item.label : '请选择类别';
});

function onCategoryChange(e) {
  form.value.category = categories[parseInt(e.detail.value)].value;
}

async function submit() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入食物名称', icon: 'none' });
    return;
  }
  if (!form.value.category) {
    uni.showToast({ title: '请选择类别', icon: 'none' });
    return;
  }
  if (!form.value.calorie_per_100g || isNaN(parseFloat(form.value.calorie_per_100g))) {
    uni.showToast({ title: '请输入正确热量', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    await systemApi.addCustomFood({
      name: form.value.name.trim(),
      category: form.value.category,
      calorie_per_100g: parseFloat(form.value.calorie_per_100g),
      unit: '100g',
      protein_per_100g: parseFloat(form.value.protein_per_100g) || 0,
      carb_per_100g: parseFloat(form.value.carb_per_100g) || 0,
      fat_per_100g: parseFloat(form.value.fat_per_100g) || 0,
      is_public: form.value.is_public
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => {
      uni.navigateBack({
        delta: 1,
        fail: () => uni.redirectTo({ url: '/pages/record/index' })
      });
    }, 800);
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '保存失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.create-food-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.create-food-scroll {
  flex: 1;
  height: 100%;
  padding: 0 32rpx;
  padding-top: 160rpx;
}

.form-card {
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  margin-top: 32rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.input-label {
  display: block;
  font-size: 26rpx;
  color: #6B7280;
  margin-bottom: 12rpx;
  font-weight: 500;
}

.picker {
  height: 88rpx;
  line-height: 88rpx;
  background: #F5F7FA;
  border-radius: 32rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
  color: #333333;
}

.picker.placeholder {
  color: #9CA3AF;
}

.form-row {
  display: flex;
  gap: 16rpx;
}

.form-row .form-item {
  flex: 1;
}

.switch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16rpx;
}

.switch-label {
  flex: 1;
}

.switch-desc {
  display: block;
  font-size: 22rpx;
  color: #9CA3AF;
  margin-top: 4rpx;
}

.bottom-placeholder {
  height: 160rpx;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #F7FbF4;
  z-index: 100;
}
</style>
