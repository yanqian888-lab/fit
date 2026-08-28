import { get, post, put, del, uploadFile } from '../utils/request';

// 认证
export const authApi = {
  wechatLogin: (data) => post('/auth/wechat-login', data),
  login: (data) => post('/auth/login', data),
  register: (data) => post('/auth/register', data),
  wechatBindPhone: (data) => post('/auth/wechat-bind', data)
};

// 用户
export const userApi = {
  getMe: (options = {}) => get('/users/me', options),
  updateMe: (data) => put('/users/me', data),
  updateProfile: (data) => put('/users/profile', data),
  exportData: () => post('/users/export'),
  clearData: () => del('/users/data'),
  deleteAccount: () => del('/users/me')
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
  send: (content, contentType = 'text', date) => post('/chat/send', { content, content_type: contentType, record_date: date }),
  getMessages: (params) => get('/chat/messages', params),
  getPendingAssets: (messageIds) => get('/chat/pending-assets', { message_ids: messageIds.join(',') }),
  confirmPrecipitation: (data) => post('/chat/confirm-precipitation', data),
  getChatStats: () => get('/chat/stats'),
  sendWakeupMessage: () => post('/chat/wakeup'),
  getAdvice: () => post('/chat/advice')
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
  deleteBody: (id) => del(`/records/body/${id}`),
  getHabits: (params) => get('/records/habit', params),
  saveHabit: (data) => data.id ? put(`/records/habit/${data.id}`, data) : post('/records/habit', data),
  deleteHabit: (id) => del(`/records/habit/${id}`),
  getFasting: (date) => get('/records/fasting', { date }),
  getFastingStats: () => get('/records/fasting/stats'),
  saveFasting: (data) => post('/records/fasting', data),
  getRecordDates: (params) => get('/records/dates', params),
  getMilestoneData: () => get('/records/milestone-data')
};

// 博物馆
export const museumApi = {
  getOverview: () => get('/museum/overview'),
  getTimeline: (params) => get('/museum/timeline', params),
  getItems: (params) => get('/museum/items', params),
  getItem: (id) => get(`/museum/items/${id}`),
  addItem: (data) => post('/museum/items', data),
  updateItem: (id, data) => put(`/museum/items/${id}`, data),
  deleteItem: (id) => del(`/museum/items/${id}`),
  confirmItem: (id, data) => post(`/museum/items/${id}/confirm`, data),
  discardItem: (id) => post(`/museum/items/${id}/discard`),
  toggleFavorite: (id) => post(`/museum/items/${id}/favorite`),
  shareItem: (id) => post(`/museum/items/${id}/share`),
  saveMood: (data) => post('/museum/mood', data),
  getMoods: (params) => get('/museum/moods', params),
  getMoodStats: (params) => get('/museum/moods/stats', params)
};

// 沉淀记录
export const precipitationApi = {
  getList: (params) => get('/precipitations', params),
  create: (data) => post('/precipitations', data),
  update: (id, data) => put(`/precipitations/${id}`, data),
  delete: (id) => del(`/precipitations/${id}`)
};

// 语音
export const voiceApi = {
  transcribe: (filePath) => uploadFile('/voice/transcribe', filePath, 'audio')
};

// AI P1 功能
export const aiApi = {
  generateDiary: (date, params = {}) => get('/ai/diary', { date, ...params }),
  getDiaryHistory: (params) => get('/ai/diary/history', params),
  getDiaryDetail: (id) => get(`/ai/diary/${id}`),
  deleteDiary: (id) => del(`/ai/diary/${id}`),
  toggleDiaryFavorite: (id) => post(`/ai/diary/${id}/favorite`),
  generateMonthlyDiary: (month) => get('/ai/diary/monthly', { month }),
  checkMilestones: () => post('/ai/milestones/check'),
  getMilestones: () => get('/ai/milestones'),
  analyzePlateau: (days) => get('/ai/plateau', { days })
};

// 数据管理
export const dataApi = {
  export: () => userApi.exportData(),
  clearAll: () => userApi.clearData()
};

// 应用全局配置（协议、隐私政策）
export const configApi = {
  getAppConfig: () => get('/app-config'),
  updateAppConfig: (data) => put('/admin/app-config', data)
};

// 系统
export const systemApi = {
  getFoods: (params) => get('/foods', params),
  getFoodDetail: (id, source) => get(`/foods/${id}`, { source }),
  toggleFavoriteFood: (id) => post(`/foods/${id}/favorite`),
  addCustomFood: (data) => post('/foods/custom', data),
  getExercises: (params) => get('/exercises', params),
  getExerciseDetail: (id, source) => get(`/exercises/${id}`, { source }),
  toggleFavoriteExercise: (id) => post(`/exercises/${id}/favorite`),
  addCustomExercise: (data) => post('/exercises/custom', data),
  getSettings: () => get('/settings'),
  updateSettings: (data) => put('/settings', data)
};

// 反馈
export const feedbackApi = {
  getList: (params) => get('/feedback', params),
  submit: (data) => post('/feedback', data),
  // 管理后台
  getAdminList: (params) => get('/admin/feedbacks', params),
  reply: (id, data) => post(`/admin/feedbacks/${id}/reply`, data),
  updateStatus: (id, status) => put(`/admin/feedbacks/${id}/status`, { status })
};

// 弹窗广告
export const popupApi = {
  getConfigList: (params) => get('/app/popup/config/list', params),
  report: (data) => post('/app/popup/report', data)
};

// 公告/消息中心
export const noticeApi = {
  getUnreadCount: () => get('/app/notifications/unread-count'),
  getAnnouncements: (params) => get('/app/announcements', params),
  getAnnouncement: (id) => get(`/app/announcements/${id}`),
  markRead: (id) => post(`/app/announcements/${id}/read`),
  recordShow: (id) => post(`/app/announcements/${id}/show`),
  getChannels: () => get('/app/notifications/channels')
};

// 陪你动
export const workoutApi = {
  getList: () => get('/workouts'),
  getDetail: (key) => get(`/workouts/${key}`),
  start: (key) => post(`/workouts/${key}/start`),
  complete: (key, data) => post(`/workouts/${key}/complete`, data)
};

// 方法库
export const methodApi = {
  getList: (params) => get('/methods', params),
  add: (data) => post('/methods', data),
  update: (id, data) => put(`/methods/${id}`, data),
  delete: (id) => del(`/methods/${id}`)
};

// 照片/对比墙
export const photoApi = {
  getList: (params) => get('/photos', params),
  upload: (data) => post('/photos', data),
  delete: (id) => del(`/photos/${id}`)
};

// 新手任务
export const newbieTaskApi = {
  list: () => get('/newbie-tasks'),
  claim: (key) => post(`/newbie-tasks/${key}/claim`)
};

// 宠物陪伴系统（搭搭）
export const petApi = {
  // 公共接口：无需登录，返回 sprite/scenes/anim 等展示配置
  getPetConfig: () => get('/pet/config'),
  getPet: (params) => get('/pet', params),
  feed: (inventoryItemIds) => post('/pet/feed', { inventory_item_ids: Array.isArray(inventoryItemIds) ? inventoryItemIds : [inventoryItemIds] }),
  exercise: (optionKey) => post('/pet/exercise', { option_key: optionKey }),
  startExplore: () => post('/pet/explore'),
  completeExplore: (id) => post('/pet/explore/complete', { id }),
  getDialogues: (scene) => get('/pet/dialogues', { scene }),
  getEvents: () => get('/pet/events'),
  getEventAlbum: () => get('/pet/events/album'),
  markEventRead: (id) => put(`/pet/events/${id}/read`),
  getCurrency: () => get('/currency'),
  getCurrencyTransactions: (params) => get('/currency/transactions', params),
  getShopItems: (params) => get('/shop/items', params),
  buyShopItem: (itemId) => post('/shop/buy', { item_id: itemId }),
  getInventory: (params) => get('/inventory', params),
  useInventoryItem: (itemId) => post('/inventory/use', { item_id: itemId }),
  getEquipmentWorkouts: (itemId) => get('/inventory/equipment-workouts', { item_id: itemId }),
  getTasks: () => get('/tasks'),
  claimTaskReward: (id) => post(`/tasks/${id}/claim`),
  getCheckinStatus: () => get('/checkin/status'),
  checkin: () => post('/checkin'),
  getAchievements: () => get('/achievements')
};
