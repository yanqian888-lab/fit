import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/auth'
import { API_BASE_URL } from '@/config/env.js'

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
})

request.interceptors.request.use(
  (config) => {
    const auth = useAuthStore()
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    // blob 下载（CSV/Excel 导出）直接返回完整 response，不解析 JSON code 字段
    // （Blob 对象没有 .code 属性，原逻辑会恒走错误分支导致导出失败）
    if (response.config?.responseType === 'blob' || response.headers['content-type']?.includes('application/octet-stream')) {
      return response
    }
    const res = response.data
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message))
    }
    return res
  },
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      // 登录接口本身的 401 是账号密码错误，按普通错误提示，不做登出跳转
      const isLoginRequest = String(error.config?.url || '').includes('/cms/auth/login')
      if (isLoginRequest) {
        ElMessage.error(error.response?.data?.message || '账号或密码错误')
      } else {
        ElMessage.error('登录已过期，请重新登录')
        const auth = useAuthStore()
        auth.logout()
        window.location.href = import.meta.env.BASE_URL + 'login'
      }
    } else {
      ElMessage.error(error.response?.data?.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
