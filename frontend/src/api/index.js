import { get, post, put, del } from '../utils/request';

// 认证
export const authApi = {
  wechatLogin: (code) => post('/auth/wechat-login', { code })
};

// 用户
export const userApi = {
  getMe: () => get('/users/me'),
  updateMe: (data) => put('/users/me', data),
  updateProfile: (data) => put('/users/profile', data)
};

// 搭子
export const partnerApi = {
  getPartner: () => get('/partners'),
  updatePartner: (data) => put('/partners', data),
  switchMode: (mode) => post('/partners/switch-mode', { mode }),
  getStatus: () => get('/partners/status')
};

// 聊天
export const chatApi = {
  send: (content, contentType = 'text') => post('/chat/send', { content, content_type: contentType }),
  getMessages: (params) => get('/chat/messages', params),
  confirmPrecipitation: (data) => post('/chat/confirm-precipitation', data)
};

// 记录
export const recordApi = {
  getToday: () => get('/records/today'),
  getDiet: (date) => get('/records/diet', { date }),
  saveDiet: (data) => data.id ? put(`/records/diet/${data.id}`, data) : post('/records/diet', data),
  deleteDiet: (id) => del(`/records/diet/${id}`),
  getExercise: (date) => get('/records/exercise', { date }),
  saveExercise: (data) => data.id ? put(`/records/exercise/${data.id}`, data) : post('/records/exercise', data),
  deleteExercise: (id) => del(`/records/exercise/${id}`),
  getBody: (params) => get('/records/body', params),
  saveBody: (data) => post('/records/body', data),
  deleteBody: (id) => del(`/records/body/${id}`)
};

// 博物馆
export const museumApi = {
  getOverview: () => get('/museum/overview'),
  getTimeline: (params) => get('/museum/timeline', params),
  getItems: (params) => get('/museum/items', params),
  addItem: (data) => post('/museum/items', data),
  updateItem: (id, data) => put(`/museum/items/${id}`, data),
  deleteItem: (id) => del(`/museum/items/${id}`)
};

// 系统
export const systemApi = {
  getFoods: (params) => get('/foods', params),
  getExercises: (params) => get('/exercises', params),
  getSettings: () => get('/settings'),
  updateSettings: (data) => put('/settings', data)
};
