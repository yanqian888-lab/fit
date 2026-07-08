import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { cmsAuthApi } from '@/api/cms'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('cms_token') || '')
  const user = ref(JSON.parse(localStorage.getItem('cms_user') || '{}'))

  const isLogin = computed(() => !!token.value)
  const permissions = computed(() => user.value.permissions || [])

  function hasPermission(code) {
    return permissions.value.includes('*') || permissions.value.includes(code)
  }

  async function login(form) {
    const res = await cmsAuthApi.login(form)
    token.value = res.data.token
    user.value = res.data.user
    localStorage.setItem('cms_token', token.value)
    localStorage.setItem('cms_user', JSON.stringify(user.value))
    return res
  }

  async function fetchProfile() {
    const res = await cmsAuthApi.profile()
    user.value = { ...user.value, ...res.data }
    localStorage.setItem('cms_user', JSON.stringify(user.value))
    return res
  }

  function logout() {
    token.value = ''
    user.value = {}
    localStorage.removeItem('cms_token')
    localStorage.removeItem('cms_user')
  }

  return {
    token,
    user,
    isLogin,
    permissions,
    hasPermission,
    login,
    fetchProfile,
    logout
  }
})
