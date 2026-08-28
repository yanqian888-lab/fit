<template>
  <AppPage>
    <AppHeader title="协议管理" headerBg="#F6F7FA" />
    <view class="admin-privacy-page">
      <view class="form-card">
        <view class="form-item">
          <text class="form-label">隐私政策版本号</text>
          <input v-model="form.privacy_version" class="form-input" placeholder="如 1.0.0" />
        </view>

        <view class="form-item switch-item">
          <text class="form-label">强制下次启动重新确认</text>
          <switch :checked="form.force_privacy_update" color="#8DBB77" @change="onSwitchChange" />
        </view>

        <view class="form-item textarea-item">
          <text class="form-label">用户协议</text>
          <textarea
            v-model="form.user_agreement"
            class="form-textarea"
            placeholder="请输入用户协议完整内容"
            maxlength="-1"
          />
        </view>

        <view class="form-item textarea-item">
          <text class="form-label">隐私政策</text>
          <textarea
            v-model="form.privacy_policy"
            class="form-textarea"
            placeholder="请输入隐私政策完整内容"
            maxlength="-1"
          />
        </view>

        <button class="save-btn" @click="save">保存</button>
      </view>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppHeader from '../../components/AppHeader.vue';
import { configApi } from '../../api';

const form = ref({
  user_agreement: '',
  privacy_policy: '',
  privacy_version: '1.0.0',
  force_privacy_update: false
});

onMounted(async () => {
  try {
    const res = await configApi.getAppConfig();
    const data = res.data || {};
    form.value = {
      user_agreement: data.user_agreement || '',
      privacy_policy: data.privacy_policy || '',
      privacy_version: data.privacy_version || '1.0.0',
      force_privacy_update: !!data.force_privacy_update
    };
  } catch (err) {
    console.error('获取协议配置失败:', err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
});

function onSwitchChange(e) {
  form.value.force_privacy_update = e.detail.value;
}

async function save() {
  if (!form.value.privacy_version.trim()) {
    uni.showToast({ title: '请填写版本号', icon: 'none' });
    return;
  }
  try {
    await configApi.updateAppConfig({
      user_agreement: form.value.user_agreement,
      privacy_policy: form.value.privacy_policy,
      privacy_version: form.value.privacy_version,
      force_privacy_update: form.value.force_privacy_update
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
  } catch (err) {
    console.error('保存协议配置失败:', err);
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.admin-privacy-page {
  /* 自绘导航删除后，顶部已由 AppPage 贴原生导航栏底部，不再需要额外 top padding */
}

.form-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}

.form-item {
  margin-bottom: $spacing-lg;
}

.form-item:last-child {
  margin-bottom: 0;
}

.switch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.textarea-item {
  display: flex;
  flex-direction: column;
}

.form-label {
  display: block;
  font-size: $text-base;
  color: $text-primary;
  margin-bottom: $spacing-sm;
  font-weight: 500;
}

.form-input {
  height: 80rpx;
  background: #F5F7FA;
  border-radius: 16rpx;
  padding: 0 $spacing-md;
  font-size: $text-base;
  color: $text-primary;
}

.form-textarea {
  width: 100%;
  min-height: 400rpx;
  background: #F5F7FA;
  border-radius: 16rpx;
  padding: $spacing-md;
  font-size: $text-base;
  color: $text-primary;
  box-sizing: border-box;
  line-height: 1.6;
}

.save-btn {
  margin-top: $spacing-md;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  background: #8DBB77;
  color: #FFFFFF;
  font-size: 32rpx;
  border: none;
}

.save-btn::after {
  border: none;
}
</style>
