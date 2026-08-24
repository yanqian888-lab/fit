import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { noticeApi } from '../api';
import { useUserStore } from './index';

export const useNoticeStore = defineStore('notice', () => {
  const userStore = useUserStore();

  const unreadCount = ref(0);
  const announcements = ref([]);
  const messages = ref([]);
  const channels = ref([]);
  const loading = ref(false);

  const hasUnread = computed(() => unreadCount.value > 0);

  // 仅登录态下请求，未登录静默跳过
  async function safeCall(promise) {
    if (!userStore.isLoggedIn) return null;
    try {
      return await promise;
    } catch (err) {
      console.error('[notice] 请求失败:', err);
      return null;
    }
  }

  async function fetchUnreadCount() {
    const res = await safeCall(noticeApi.getUnreadCount());
    if (res && res.code === 0) {
      unreadCount.value = res.data?.unread_count || 0;
    }
  }

  async function fetchAnnouncements(position = 'home') {
    const res = await safeCall(noticeApi.getAnnouncements({ position }));
    if (res && res.code === 0) {
      announcements.value = res.data?.list || [];
    }
  }

  async function fetchMessages(page = 1, size = 20) {
    loading.value = true;
    const res = await safeCall(noticeApi.getAnnouncements({ position: 'message_center', page, size }));
    loading.value = false;
    if (res && res.code === 0) {
      if (page === 1) {
        messages.value = res.data?.list || [];
      } else {
        messages.value = messages.value.concat(res.data?.list || []);
      }
      return res.data?.pagination || { has_more: false };
    }
    return { has_more: false };
  }

  async function markRead(id) {
    const res = await safeCall(noticeApi.markRead(id));
    if (res && res.code === 0) {
      const item = messages.value.find(m => m.id === Number(id));
      if (item) item.user_status = 'read';
      const ann = announcements.value.find(a => a.id === Number(id));
      if (ann) ann.user_status = 'read';
      await fetchUnreadCount();
    }
    return res;
  }

  async function recordShow(id) {
    const res = await safeCall(noticeApi.recordShow(id));
    if (res && res.code === 0) {
      const item = messages.value.find(m => m.id === Number(id));
      if (item) item.show_count = (item.show_count || 0) + 1;
      const ann = announcements.value.find(a => a.id === Number(id));
      if (ann) ann.show_count = (ann.show_count || 0) + 1;
    }
    return res;
  }

  async function fetchChannels() {
    const res = await safeCall(noticeApi.getChannels());
    if (res && res.code === 0) {
      channels.value = res.data?.list || [];
    }
  }

  function clear() {
    unreadCount.value = 0;
    announcements.value = [];
    messages.value = [];
    channels.value = [];
  }

  return {
    unreadCount,
    announcements,
    messages,
    channels,
    loading,
    hasUnread,
    fetchUnreadCount,
    fetchAnnouncements,
    fetchMessages,
    markRead,
    recordShow,
    fetchChannels,
    clear
  };
});
