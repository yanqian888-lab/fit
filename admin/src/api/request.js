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
  async (response) => {
    // blob 下载（CSV/Excel 导出）：当后端实际返回 JSON（即下载出错）时，
    // 把 Blob 解析成文本再 JSON.parse，按普通业务错误处理；否则原样返回 response
    if (response.config?.responseType === 'blob' || response.headers['content-type']?.includes('application/octet-stream')) {
      const contentType = response.headers['content-type'] || ''
      if (response.data instanceof Blob && contentType.includes('application/json')) {
        const text = await response.data.text()
        let res
        try {
          res = JSON.parse(text)
        } catch (e) {
          res = { message: text || '导出失败' }
        }
        if (res.code !== 0) {
          ElMessage.error(res.message || '请求失败')
          return Promise.reject(new Error(res.message || '请求失败'))
        }
        return res
      }
      return response
    }
    const res = response.data
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message))
    }
    return res
  },
  async (error) => {
    const status = error.response?.status
    // blob 响应错误时，response.data 是 Blob，需要先 await blob.text() 解析出 JSON 才能拿到 message
    let errorData = error.response?.data
    if (errorData instanceof Blob) {
      try {
        const text = await errorData.text()
        errorData = text ? JSON.parse(text) : {}
      } catch (e) {
        errorData = {}
      }
    }
    if (status === 401) {
      // 登录接口本身的 401 是账号密码错误，按普通错误提示，不做登出跳转
      const isLoginRequest = String(error.config?.url || '').includes('/cms/auth/login')
      if (isLoginRequest) {
        ElMessage.error(errorData?.message || '账号或密码错误')
      } else {
        ElMessage.error('登录已过期，请重新登录')
        const auth = useAuthStore()
        auth.logout()
        window.location.href = import.meta.env.BASE_URL + 'login'
      }
    } else if (status === 403) {
      // 收到 403 且提示"无权访问 CMS"时，token 已被服务端视为非法，必须清空本地态并跳登录页
      const msg = errorData?.message || ''
      if (msg.includes('无权访问CMS') || msg.includes('无权访问 CMS')) {
        ElMessage.error(msg || '无权访问 CMS')
        const auth = useAuthStore()
        auth.logout()
        window.location.href = import.meta.env.BASE_URL + 'login'
      } else {
        ElMessage.error(msg || '网络错误')
      }
    } else {
      ElMessage.error(errorData?.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
