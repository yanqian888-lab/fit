import request from './request'

export const cmsAuthApi = {
  login: (data) => request.post('/cms/auth/login', data),
  profile: () => request.get('/cms/auth/profile'),
  changePassword: (data) => request.put('/cms/auth/password', data)
}

export const cmsConfigApi = {
  get: () => request.get('/cms/app-config'),
  update: (data) => request.put('/cms/app-config', data)
}

export const cmsPromptApi = {
  list: () => request.get('/cms/prompts'),
  detail: (key) => request.get(`/cms/prompts/${encodeURIComponent(key)}`),
  publish: (key, content, aiConfigId) => request.post(`/cms/prompts/${encodeURIComponent(key)}/versions`, { content, ai_config_id: aiConfigId }),
  setEnabled: (key, version, isEnabled) => request.put(`/cms/prompts/${encodeURIComponent(key)}/versions/${version}/status`, { is_enabled: isEnabled }),
  setAiConfig: (key, aiConfigId) => request.put(`/cms/prompts/${encodeURIComponent(key)}/ai-config`, { ai_config_id: aiConfigId })
}

export const cmsAiConfigApi = {
  list: () => request.get('/cms/ai-configs'),
  simple: () => request.get('/cms/ai-configs/simple'),
  detail: (id) => request.get(`/cms/ai-configs/${id}`),
  create: (data) => request.post('/cms/ai-configs', data),
  update: (id, data) => request.put(`/cms/ai-configs/${id}`, data),
  remove: (id) => request.delete(`/cms/ai-configs/${id}`)
}

export const cmsTemplateApi = {
  list: (params) => request.get('/cms/template-config', { params }),
  types: () => request.get('/cms/template-config/types'),
  create: (data) => request.post('/cms/template-config', data),
  update: (id, data) => request.put(`/cms/template-config/${id}`, data),
  remove: (id) => request.delete(`/cms/template-config/${id}`),
  seed: () => request.post('/cms/template-config/seed')
}

export const cmsAppUserApi = {
  list: (params) => request.get('/cms/app-users', { params }),
  create: (data) => request.post('/cms/app-users', data),
  detail: (id) => request.get(`/cms/app-users/${id}`),
  updateStatus: (id, status) => request.put(`/cms/app-users/${id}/status`, { status }),
  deleteUser: (id) => request.delete(`/cms/app-users/${id}`)
}

export const cmsFeedbackApi = {
  list: (params) => request.get('/cms/feedbacks', { params }),
  detail: (id) => request.get(`/cms/feedbacks/${id}`),
  reply: (id, reply) => request.post(`/cms/feedbacks/${id}/reply`, { reply }),
  updateStatus: (id, status) => request.put(`/cms/feedbacks/${id}/status`, { status })
}

export const cmsFoodApi = {
  list: (params) => request.get('/cms/foods', { params }),
  detail: (id) => request.get(`/cms/foods/${id}`),
  create: (data) => request.post('/cms/foods', data),
  update: (id, data) => request.put(`/cms/foods/${id}`, data),
  remove: (id) => request.delete(`/cms/foods/${id}`),
  import: (items) => request.post('/cms/foods/import', { items })
}

export const cmsCustomFoodApi = {
  list: (params) => request.get('/cms/custom-foods', { params }),
  detail: (id) => request.get(`/cms/custom-foods/${id}`),
  approve: (id) => request.post(`/cms/custom-foods/${id}/approve`),
  reject: (id) => request.post(`/cms/custom-foods/${id}/reject`)
}

export const cmsExerciseApi = {
  list: (params) => request.get('/cms/exercises', { params }),
  detail: (id) => request.get(`/cms/exercises/${id}`),
  create: (data) => request.post('/cms/exercises', data),
  update: (id, data) => request.put(`/cms/exercises/${id}`, data),
  remove: (id) => request.delete(`/cms/exercises/${id}`)
}

export const cmsUserApi = {
  list: () => request.get('/cms/users'),
  create: (data) => request.post('/cms/users', data),
  update: (id, data) => request.put(`/cms/users/${id}`, data),
  resetPassword: (id, password) => request.put(`/cms/users/${id}/password`, { password }),
  remove: (id) => request.delete(`/cms/users/${id}`),
  roles: () => request.get('/cms/roles'),
  createRole: (data) => request.post('/cms/roles', data),
  updateRole: (id, data) => request.put(`/cms/roles/${id}`, data),
  removeRole: (id) => request.delete(`/cms/roles/${id}`)
}

export const cmsMilestoneApi = {
  list: () => request.get('/cms/milestone-templates'),
  create: (data) => request.post('/cms/milestone-templates', data),
  update: (id, data) => request.put(`/cms/milestone-templates/${id}`, data),
  remove: (id) => request.delete(`/cms/milestone-templates/${id}`),
  seed: () => request.post('/cms/milestone-templates/seed')
}

export const cmsMuseumConfigApi = {
  get: () => request.get('/cms/museum-config'),
  update: (data) => request.put('/cms/museum-config', data)
}

export const cmsLogApi = {
  list: (params) => request.get('/cms/logs', { params })
}

export const cmsTrialApi = {
  dashboard: () => request.get('/cms/trial/dashboard'),
  getConfig: () => request.get('/cms/trial/config'),
  updateConfig: (data) => request.put('/cms/trial/config', data),
  auditMode: (appVersion) => request.post('/cms/trial/audit-mode', { app_version: appVersion }),
  listWhitelist: (params) => request.get('/cms/trial/whitelist', { params }),
  createWhitelist: (data) => request.post('/cms/trial/whitelist', data),
  batchCreateWhitelist: (data) => request.post('/cms/trial/whitelist/batch', data),
  updateWhitelist: (id, data) => request.put(`/cms/trial/whitelist/${id}`, data),
  removeWhitelist: (id) => request.delete(`/cms/trial/whitelist/${id}`),
  listLogs: (params) => request.get('/cms/trial/logs', { params })
}

export const cmsPopupApi = {
  list: (params) => request.get('/cms/popups', { params }),
  detail: (id) => request.get(`/cms/popups/${id}`),
  create: (data) => request.post('/cms/popups', data),
  update: (id, data) => request.put(`/cms/popups/${id}`, data),
  remove: (id) => request.delete(`/cms/popups/${id}`),
  copy: (id) => request.post(`/cms/popups/${id}/copy`),
  batchStatus: (data) => request.post('/cms/popups/batch-status', data),
  batchDelete: (data) => request.post('/cms/popups/batch-delete', data)
}

export const cmsPopupWhitelistApi = {
  list: (params) => request.get('/cms/popup-whitelist', { params }),
  create: (data) => request.post('/cms/popup-whitelist', data),
  update: (id, data) => request.put(`/cms/popup-whitelist/${id}`, data),
  remove: (id) => request.delete(`/cms/popup-whitelist/${id}`)
}

export const cmsPopupRouteApi = {
  list: (params) => request.get('/cms/app-routes', { params }),
  create: (data) => request.post('/cms/app-routes', data),
  update: (id, data) => request.put(`/cms/app-routes/${id}`, data),
  remove: (id) => request.delete(`/cms/app-routes/${id}`)
}

export const cmsPopupStatsApi = {
  dashboard: (params) => request.get('/cms/popup-stats/dashboard', { params }),
  detail: (params) => request.get('/cms/popup-stats/detail', { params }),
  export: (params) => request.get('/cms/popup-events/export', { params, responseType: 'blob' })
}

export const cmsPopupGlobalApi = {
  get: () => request.get('/cms/popup-global'),
  update: (data) => request.put('/cms/popup-global', data)
}
