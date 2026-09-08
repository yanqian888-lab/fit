import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, userApi } from '../api';
import { setUmengOpenid } from '../utils/umeng';

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const userInfo = ref(null);
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => userInfo.value?.role === 'admin');

  /**
   * 启动初始化：从 storage 恢复 userInfo 并从后端同步
   * 使用 skip401Redirect 防止启动期间 401 跳转登录页
   * token 失效时静默清除登录态，让用户以游客身份浏览 tab 页
   */
  async function init() {
    // 启动时从 storage 恢复 userInfo（不然后续判断会认为未登录）
    if (!userInfo.value) {
      const storedUser = uni.getStorageSync('userInfo');
      if (storedUser) {
        try {
          userInfo.value = typeof storedUser === 'string' ? JSON.parse(storedUser) : storedUser;
          // 友盟埋点：启动恢复登录态时，若本地已缓存 openid 则立即上报（无网络也能先关联）
          if (userInfo.value && userInfo.value.openid) {
            setUmengOpenid(userInfo.value.openid);
          }
        } catch (e) {
          console.warn('[store] 恢复 userInfo 失败:', e);
        }
      }
    }
    if (token.value) {
      const result = await fetchUserInfo(true);
      // token 已过期或无效：静默清除登录态，用户以游客身份浏览
      if (!result) {
        logout();
      }
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
      // 友盟埋点：登录成功后上报 openid（user 可能是对象或 JSON 字符串，兼容解析）
      let openid = null;
      if (typeof user === 'string') {
        try { openid = JSON.parse(user).openid; } catch (e) { openid = null; }
      } else {
        openid = user.openid;
      }
      if (openid) setUmengOpenid(openid);
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
      // 友盟埋点：getMe 返回最新 openid 后上报（覆盖已登录老用户启动场景）
      if (res.data && res.data.openid) {
        setUmengOpenid(res.data.openid);
      }
      return res.data;
    } catch (err) {
      console.error('获取用户信息失败:', err);
      if (!skip401Redirect && err.status === 401) {
        logout();
      }
      return null;
    }
  }

  /**
   * 检查登录状态，未登录则跳转登录页
   * @returns {boolean} 是否已登录
   */
  function requireAuth() {
    if (!token.value) {
      uni.navigateTo({ url: '/pages/login/index' });
      return false;
    }
    return true;
  }

  // 监听 request.js 401 事件：同步清除 token ref，避免 isLoggedIn 仍为 true 反复触发 401
  uni.$on('auth:expired', () => {
    token.value = '';
    userInfo.value = null;
  });

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
    requireAuth,
    setPartnerMode
  };
});
