<template>
  <AppPage>
    <AppHeader title="搭子设置" />
    <view class="customize-page">
      <view class="avatar-section">
        <view class="partner-avatar">
          <text>{{ partnerNameFirst }}</text>
        </view>
      </view>
      <view class="form-card">
        <AppInput v-model="form.name" label="搭子名字" placeholder="请设定你搭子的昵称" />
        <view class="form-item">
          <text class="input-label">性别</text>
          <picker mode="selector" :range="genders" :value="form.gender" @change="onGenderChange">
            <view class="picker">{{ genders[form.gender] }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="input-label">默认模式</text>
          <picker mode="selector" :range="modeLabels" :value="modeIndex" @change="onModeChange">
            <view class="picker">{{ modeLabels[modeIndex] }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="input-label">严格程度</text>
          <slider :value="form.strictness" min="1" max="10" activeColor="#B5E2FF" block-color="#B5E2FF" show-value @change="onSlider('strictness', $event)" />
        </view>
        <view class="form-item">
          <text class="input-label">幽默感</text>
          <slider :value="form.humor" min="1" max="10" activeColor="#B5E2FF" block-color="#B5E2FF" show-value @change="onSlider('humor', $event)" />
        </view>
      </view>
      <AppButton block size="lg" :loading="loading" @click="submit">保存</AppButton>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { partnerApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import AppInput from '../../components/AppInput.vue';
import AppButton from '../../components/AppButton.vue';

const genders = ['保密', '男', '女'];
const modes = [
  { value: 'gentle', label: '温柔鼓励' },
  { value: 'strict', label: '严格监督' },
  { value: 'tease', label: '毒舌模式' }
];

const form = ref({
  name: '你的搭子',
  gender: 2,
  mode: 'gentle',
  strictness: 5,
  humor: 5
});
const loading = ref(false);

const modeLabels = modes.map(m => m.label);
const modeIndex = computed(() => modes.findIndex(m => m.value === form.value.mode));
const partnerNameFirst = computed(() => form.value.name ? form.value.name.charAt(0) : '瘦');

function onGenderChange(e) {
  form.value.gender = parseInt(e.detail.value);
}

function onModeChange(e) {
  form.value.mode = modes[parseInt(e.detail.value)].value;
}

function onSlider(key, e) {
  form.value[key] = e.detail.value;
}

async function load() {
  try {
    const res = await partnerApi.getPartner();
    const p = res.data;
    form.value = {
      name: p.name,
      gender: p.gender,
      mode: p.mode,
      strictness: p.strictness,
      humor: p.humor
    };
  } catch (err) {
    console.error(err);
  }
}

async function submit() {
  loading.value = true;
  try {
    const payload = { ...form.value };
    // 如果用户清空后没有输入，恢复为默认昵称
    if (!payload.name || !payload.name.trim()) {
      payload.name = '你的搭子';
      form.value.name = '你的搭子';
    }
    await partnerApi.updatePartner(payload);
    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 1000);
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.customize-page {
  padding-top: $spacing-md;
}

.avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: $spacing-md;
}

.partner-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: $mint;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $white;
  font-size: 72rpx;
  font-weight: $font-semibold;
  box-shadow: $shadow-soft;
}

.form-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
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
</style>
