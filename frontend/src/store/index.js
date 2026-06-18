import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, userApi } from '../api';

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const userInfo = ref(null);
  const isLoggedIn = computed(() => !!token.value);

  // 初始化：自动登录
  async function init() {
    if (!token.value) {
      await mockLogin();
    }
    await fetchUserInfo();
  }

  // 模拟登录（MVP 阶段用固定 code）
  async function mockLogin() {
    try {
      const res = await authApi.wechatLogin('mock_code_' + Date.now());
      token.value = res.data.token;
      uni.setStorageSync('token', res.data.token);
    } catch (err) {
      console.error('登录失败:', err);
    }
  }

  // 获取用户信息
  async function fetchUserInfo() {
    try {
      const res = await userApi.getMe();
      userInfo.value = res.data;
    } catch (err) {
      console.error('获取用户信息失败:', err);
    }
  }

  // 切换搭子模式
  function setPartnerMode(mode) {
    if (userInfo.value && userInfo.value.partner) {
      userInfo.value.partner.mode = mode;
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    init,
    mockLogin,
    fetchUserInfo,
    setPartnerMode
  };
});
