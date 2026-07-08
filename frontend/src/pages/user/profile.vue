<template>
  <AppPage>
    <view class="profile-back" @click="goBack">
      <text class="back-icon">‹</text>
    </view>
    <view class="profile-page">
      <view class="avatar-card">
        <view class="avatar" @click="chooseAvatar">
          <image v-if="user.avatar_url && !avatarError" :src="avatarFullUrl" class="avatar-img" mode="aspectFill" @error="avatarError = true" />
          <text v-else>{{ user.nickname?.[0] || 'U' }}</text>
        </view>
        <text class="nickname">{{ user.nickname || '未设置昵称' }}</text>
        <text class="avatar-tip">点击更换头像</text>
      </view>
      <view class="form-card">
        <view class="form-item">
          <text class="input-label">昵称</text>
          <input v-model="form.nickname" placeholder="取个好听的名字" />
        </view>
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
        <view class="form-item">
          <text class="input-label">身高 (cm) *</text>
          <input v-model="form.height" type="digit" placeholder="165" />
        </view>
        <view class="form-item">
          <text class="input-label">当前体重 (kg)</text>
          <input v-model="form.current_weight" type="digit" placeholder="60" />
        </view>
        <view class="form-item">
          <text class="input-label">目标体重 (kg)</text>
          <input v-model="form.target_weight" type="digit" placeholder="55" />
        </view>
        <view class="form-item">
          <text class="input-label">目标日期</text>
          <picker mode="date" :value="form.target_date" @change="onDateChange">
            <view class="picker">{{ form.target_date || '选择目标日期' }}</view>
          </picker>
        </view>
        <AppButton block type="primary" @click="save">更新资料</AppButton>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { userApi } from '../../api';
import { uploadFile } from '../../utils/request';
import { getServerUrl } from '../../utils/environment.js';
import popupManager from '../../utils/popupManager';
import { getToday } from '../../utils/date';
import { useUserStore } from '../../store';
import AppPage from '../../components/AppPage.vue';
import AppButton from '../../components/AppButton.vue';

const user = ref({});
const userStore = useUserStore();
const avatarError = ref(false);
const today = getToday();
const genderLabels = ['请选择性别', '男', '女'];
const genderValues = [null, 1, 2];
const form = ref({
  nickname: '',
  gender: null,
  birth_date: '',
  height: '',
  current_weight: '',
  target_weight: '',
  target_date: ''
});

const genderIndex = computed(() => {
  const idx = genderValues.findIndex(v => v === form.value.gender);
  return idx >= 0 ? idx : 0;
});

const genderLabel = computed(() => genderLabels[genderIndex.value]);

const avatarFullUrl = computed(() => {
  if (!user.value.avatar_url) return '';
  if (user.value.avatar_url.startsWith('http')) return user.value.avatar_url;
  return `${getServerUrl()}${user.value.avatar_url}`;
});

function redirectToLogin() {
  userStore.logout();
  popupManager.clearCache();
  uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
  // 清除页面栈并回到登录页，防止未登录状态下继续查看旧数据
  uni.reLaunch({ url: '/pages/login/index' });
}

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    redirectToLogin();
    return;
  }
  try {
    const res = await userApi.getMe();
    const data = res.data || {};
    const profile = data.profile || {};
    user.value = data;
    avatarError.value = false;
    form.value.nickname = data.nickname || '';
    form.value.gender = data.gender ?? null;
    form.value.birth_date = data.birth_date || '';
    form.value.height = data.height || profile.height || '';
    form.value.current_weight = profile.current_weight || '';
    form.value.target_weight = profile.target_weight || '';
    form.value.target_date = profile.target_date || '';
  } catch (err) {
    if (err.status === 401) {
      redirectToLogin();
      return;
    }
    console.error(err);
  }
});

function goBack() {
  // #ifdef H5
  if (window.history.length > 1) {
    window.history.back();
  } else {
    uni.switchTab({ url: '/pages/record/index' });
  }
  // #endif
  // #ifndef H5
  uni.navigateBack({ delta: 1 });
  // #endif
}

function onDateChange(e) {
  form.value.target_date = e.detail.value;
}

function onGenderChange(e) {
  form.value.gender = genderValues[parseInt(e.detail.value)];
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

async function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: async (res) => {
      const tempFilePath = res.tempFilePaths[0];
      try {
        uni.showLoading({ title: '上传中...' });
        const uploadRes = await uploadFile('/users/avatar', tempFilePath, 'avatar');
        user.value.avatar_url = uploadRes.data.avatar_url;
        avatarError.value = false;
        uni.showToast({ title: '头像更新成功', icon: 'success' });
      } catch (err) {
        console.error('头像上传失败:', err);
      } finally {
        uni.hideLoading();
      }
    },
    fail: (err) => {
      if (err.errMsg && (err.errMsg.includes('cancel') || err.errMsg.includes('用户取消'))) {
        return;
      }
      console.error('选择图片失败:', err);
      uni.showToast({ title: '无法访问相册，请检查权限', icon: 'none' });
    }
  });
}

async function save() {
  if (form.value.gender === null || !form.value.birth_date || !form.value.height) {
    uni.showToast({ title: '性别、出生日期、身高必填', icon: 'none' });
    return;
  }
  try {
    await userApi.updateMe({
      nickname: form.value.nickname,
      gender: form.value.gender,
      birth_date: form.value.birth_date,
      height: parseFloat(form.value.height)
    });
    await userApi.updateProfile({
      current_weight: parseFloat(form.value.current_weight) || null,
      target_weight: parseFloat(form.value.target_weight) || null,
      target_date: form.value.target_date
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.profile-page {
  padding-top: 140rpx;
}

.profile-back {
  position: fixed;
  top: calc(var(--status-bar-height) + 20rpx);
  left: 32rpx;
  z-index: 1000;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-card;
}

.back-icon {
  font-size: 40rpx;
  color: $text-primary;
  font-weight: $font-bold;
  line-height: 1;
  margin-left: -4rpx;
}

.avatar-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: $spacing-md;
}

.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #8DBB77;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $text-2xl;
  font-weight: $font-bold;
  color: $white;
  margin-bottom: $spacing-sm;
  box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-tip {
  font-size: $text-sm;
  color: $text-secondary;
  margin-top: $spacing-xs;
}

.nickname {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
}

.form-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  box-shadow: $shadow-card;

  :deep(.app-button.primary) {
    background: #8DBB77;
    color: #FFFFFF;
    box-shadow: 0 4rpx 20rpx rgba(141, 187, 119, 0.25);
  }
}

.form-row {
  display: flex;
  gap: $spacing-sm;
}

.form-row .form-item {
  flex: 1;
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

.form-item input,
.picker {
  width: 100%;
  height: 88rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  font-size: $text-base;
  color: $text-primary;
}

.picker {
  line-height: 88rpx;
}
</style>
