import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, userApi } from '../api';

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const userInfo = ref(null);
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => userInfo.value?.role === 'admin');

  // 初始化
  async function init() {
    if (token.value) {
      await fetchUserInfo();
    }
  }

  // 登录成功
  function login(newToken, user) {
    token.value = newToken;
    userInfo.value = user;
    uni.setStorageSync('token', newToken);
  }

  // 退出登录
  function logout() {
    token.value = '';
    userInfo.value = null;
    uni.removeStorageSync('token');
  }

  // 获取用户信息
  async function fetchUserInfo() {
    try {
      const res = await userApi.getMe();
      userInfo.value = res.data;
    } catch (err) {
      console.error('获取用户信息失败:', err);
      if (err.status === 401) {
        logout();
      }
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
    isAdmin,
    init,
    login,
    logout,
    fetchUserInfo,
    setPartnerMode
  };
});
