import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, userApi } from '../api';

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const userInfo = ref(null);
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => userInfo.value?.role === 'admin');

  /**
   * 启动初始化：从 storage 恢复 userInfo 并从后端同步
   */
  async function init() {
    // 启动时从 storage 恢复 userInfo（不然后续判断会认为未登录）
    if (!userInfo.value) {
      const storedUser = uni.getStorageSync('userInfo');
      if (storedUser) {
        try {
          userInfo.value = typeof storedUser === 'string' ? JSON.parse(storedUser) : storedUser;
        } catch (e) {
          console.warn('[store] 恢复 userInfo 失败:', e);
        }
      }
    }
    if (token.value) {
      await fetchUserInfo();
    }
  }

  /**
   * 登录成功：持久化 token 与 userInfo
   * @param {string} newToken - JWT Token
   * @param {object|string} user - 用户信息
   */
  function login(newToken, user) {
    token.value = newToken;
    userInfo.value = user;
    uni.setStorageSync('token', newToken);
    if (user) {
      uni.setStorageSync('userInfo', typeof user === 'string' ? user : JSON.stringify(user));
    }
  }

  /**
   * 退出登录：清除内存 + storage 登录态
   */
  function logout() {
    token.value = '';
    userInfo.value = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('userInfo');
    uni.removeStorageSync('stale_returning');
  }

  /**
   * 获取用户信息（从后端同步）
   * @param {boolean} skip401Redirect - 是否跳过401重定向（防死循环）
   */
  async function fetchUserInfo(skip401Redirect = false) {
    try {
      const res = await userApi.getMe({ skip401Redirect });
      userInfo.value = res.data;
      // 保存最新 userInfo 到 storage，保证下次初始化正确
      uni.setStorageSync('userInfo', JSON.stringify(res.data));
      return res.data;
    } catch (err) {
      console.error('获取用户信息失败:', err);
      if (!skip401Redirect && err.status === 401) {
        logout();
      }
      return null;
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
