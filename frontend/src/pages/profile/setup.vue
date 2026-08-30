<template>
  <AppPage>
    <view class="setup-page">
      <view class="page-header">
        <text class="page-title">完善基础信息</text>
        <text class="page-subtitle">让搭子更了解你，给你更贴心的陪伴</text>
      </view>

      <view class="form-card">
        <!-- type="nickname"：小程序端调起微信昵称快捷填写；H5/App 端按普通文本处理 -->
        <AppInput v-model="form.nickname" label="昵称" type="nickname" placeholder="请输入你的昵称" />
        <view class="form-row">
          <view class="form-item">
            <text class="input-label">性别 *</text>
            <picker mode="selector" :range="genderLabels" :value="genderIndex" @change="onGenderChange">
              <view class="picker">{{ genderLabel }}</view>
            </picker>
          </view>
          <view class="form-item">
            <text class="input-label">出生日期 *</text>
            <picker mode="date" :value="form.birth_date" start="1900-01-01" :end="today" @change="onBirthDateChange">
              <view class="picker">{{ form.birth_date || '选择出生日期' }}</view>
            </picker>
          </view>
        </view>
        <AppInput v-model="form.height" label="身高 *" type="digit" placeholder="请输入身高" suffix="cm" />
        <AppInput v-model="form.initial_weight" label="初始体重 *" type="digit" placeholder="请输入体重" suffix="kg" />
        <AppInput v-model="form.target_weight" label="目标体重 *" type="digit" placeholder="请输入体重" suffix="kg" />
        <view class="form-item">
          <text class="input-label">目标日期 *</text>
          <picker mode="date" :value="form.target_date" :start="today" @change="onDateChange">
            <view class="picker">{{ form.target_date || '请选择目标日期' }}</view>
          </picker>
        </view>
      </view>

      <AppButton block size="lg" :loading="loading" @click="submit">下一步</AppButton>

      <!-- 沉睡老用户（90 天+ 未登录）重走新用户流程：右上角可跳过 -->
      <view v-if="isFromStale" class="skip-wrap">
        <text class="skip-btn" @click="skipToHome">暂不填写，随便逛逛</text>
      </view>
      <!-- 未登录用户显示跳过按钮（登录前引导流程） -->
      <view v-else-if="!isLoggedIn" class="skip-wrap">
        <text class="skip-btn" @click="skip">跳过，先去登录</text>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useUserStore } from '../../store';
import { userApi } from '../../api';
import AppPage from '../../components/AppPage.vue';
import AppInput from '../../components/AppInput.vue';
import AppButton from '../../components/AppButton.vue';
import { getToday } from '../../utils/date';
import { safeSwitchTab } from '../../utils/safeSwitchTab';

const userStore = useUserStore();
const loading = ref(false);
const isLoggedIn = computed(() => userStore.isLoggedIn);
const genderLabels = ['请选择性别', '男', '女'];
const genderValues = [null, 1, 2];

const today = getToday();

const form = ref({
  nickname: '',
  gender: null,
  birth_date: '',
  height: '',
  initial_weight: '',
  target_weight: '',
  target_date: ''
});

// 如果已登录，预填充已有信息
// 后端默认昵称（掉秤搭搭用户/减肥搭子用户）不视为真实昵称，不预填，让用户手动输入或选微信昵称
const DEFAULT_NICKNAMES = ['掉秤搭搭用户', '减肥搭子用户'];
// 沉睡老用户重走新用户流程标记（from=stale 时右上角显示跳过）
const isFromStale = ref(false);
onLoad((options) => {
  isFromStale.value = options?.from === 'stale';
});
onMounted(async () => {
  if (isLoggedIn.value && userStore.userInfo) {
    const user = userStore.userInfo;
    const profile = user.profile || {};
    form.value.nickname = user.nickname && !DEFAULT_NICKNAMES.includes(user.nickname) ? user.nickname : '';
    form.value.gender = user.gender || null;
    form.value.birth_date = user.birth_date || '';
    form.value.height = user.height ? String(user.height) : '';
    form.value.initial_weight = profile.initial_weight ? String(profile.initial_weight) : '';
    form.value.target_weight = profile.target_weight ? String(profile.target_weight) : '';
    form.value.target_date = profile.target_date || '';
  }
});

const genderIndex = computed(() => {
  const idx = genderValues.findIndex(v => v === form.value.gender);
  return idx >= 0 ? idx : 0;
});

const genderLabel = computed(() => genderLabels[genderIndex.value]);

function onGenderChange(e) {
  form.value.gender = genderValues[parseInt(e.detail.value)];
}

function onDateChange(e) {
  form.value.target_date = e.detail.value;
}

function onBirthDateChange(e) {
  const selected = e.detail.value;
  if (selected > today) {
    uni.showToast({ title: '出生日期不能选择未来日期', icon: 'none' });
    form.value.birth_date = '';
    return;
  }
  form.value.birth_date = selected;
}

// 收集表单数据
function collectFormData() {
  return {
    nickname: form.value.nickname,
    gender: form.value.gender,
    birth_date: form.value.birth_date,
    height: parseFloat(form.value.height),
    initial_weight: parseFloat(form.value.initial_weight),
    current_weight: parseFloat(form.value.initial_weight),
    target_weight: parseFloat(form.value.target_weight),
    target_date: form.value.target_date
  };
}

async function submit() {
  if (!form.value.nickname || form.value.gender === null || !form.value.birth_date || !form.value.height || !form.value.initial_weight || !form.value.target_weight || !form.value.target_date) {
    uni.showToast({ title: '请填写完整信息（性别、出生日期必填）', icon: 'none' });
    return;
  }

  const setupData = collectFormData();

  // 已登录用户：直接保存信息
  if (isLoggedIn.value) {
    loading.value = true;
    try {
      await userApi.updateMe({
        nickname: setupData.nickname,
        gender: setupData.gender,
        birth_date: setupData.birth_date,
        height: setupData.height
      });
      await userApi.updateProfile({
        initial_weight: setupData.initial_weight,
        current_weight: setupData.current_weight,
        target_weight: setupData.target_weight,
        target_date: setupData.target_date
      });
      await userStore.fetchUserInfo();
      uni.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        const settings = userStore.userInfo?.settings || uni.getStorageSync('settings') || {};
        if (!settings.guide_completed) {
          uni.redirectTo({ url: '/pages/partner/select-mode' });
        } else {
          safeSwitchTab('/pages/index/index');
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      uni.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      loading.value = false;
    }
    return;
  }

  // 未登录用户：暂存数据，跳转到注册页
  uni.setStorageSync('setup_data', JSON.stringify(setupData));
  uni.redirectTo({ url: '/pages/register/index?from=setup' });
}

// 跳过完善信息，直接去登录
function skip() {
  uni.redirectTo({ url: '/pages/login/index' });
}

// 沉睡老用户跳过：记住跳过标记避免每次登录强制拦截，直接进首页（其引导早已完成）
function skipToHome() {
  uni.setStorageSync('profile_setup_skipped', 1);
  safeSwitchTab('/pages/index/index');
}
</script>

<style lang="scss" scoped>
.setup-page {
  position: relative;
  /*
   * 顶部占位：标杆双行兜底 + 原内容顶部留白 60rpx
   *   calc(44px + 88rpx)：与 AppPage 自绘 status-bar 高度完全一致（先硬码兜底，再覆盖变量版）
   *   + 60rpx：原页面设计内容顶部 padding
   * → 整体内容下移到状态栏 + 导航栏下方，不再顶到胶囊按钮（用户红框越界问题解决）
   */
  padding-top: calc(44px + 88rpx + 60rpx);
  padding-top: calc(var(--status-bar-height, 44px) + 88rpx + 60rpx);
}

.page-header {
  margin-bottom: $spacing-lg;
}

.page-title {
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: #000000;
  display: block;
}

.page-subtitle {
  font-size: $text-sm;
  color: $text-tertiary;
  margin-top: 8rpx;
  display: block;
  font-weight: $font-light;
}

.form-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-card;
}

.form-row {
  display: flex;
  gap: $spacing-sm;
}

.form-item {
  flex: 1;
  margin-bottom: $spacing-sm;
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

.skip-wrap {
  position: absolute;
  top: 100rpx;
  right: 0;
  z-index: 10;
}

.skip-btn {
  font-size: $text-sm;
  color: $text-tertiary;
  padding: $spacing-sm $spacing-md;
}
</style>
