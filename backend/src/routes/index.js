/**
 * 路由聚合
 */
const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const partnerController = require('../controllers/partnerController');
const chatController = require('../controllers/chatController');
const recordController = require('../controllers/recordController');
const museumController = require('../controllers/museumController');
const precipitationController = require('../controllers/precipitationController');
const systemController = require('../controllers/systemController');
const aiController = require('../controllers/aiController');
const feedbackController = require('../controllers/feedbackController');
const methodController = require('../controllers/methodController');
const photoController = require('../controllers/photoController');
const cmsAuthController = require('../controllers/cmsAuthController');
const cmsUserController = require('../controllers/cmsUserController');
const cmsConfigController = require('../controllers/cmsConfigController');
const cmsTemplateController = require('../controllers/cmsTemplateController');
const cmsAppUserController = require('../controllers/cmsAppUserController');
const cmsFeedbackController = require('../controllers/cmsFeedbackController');
const cmsFoodController = require('../controllers/cmsFoodController');
const cmsCustomFoodController = require('../controllers/cmsCustomFoodController');
const cmsExerciseController = require('../controllers/cmsExerciseController');
const cmsLogController = require('../controllers/cmsLogController');
const cmsPromptController = require('../controllers/cmsPromptController');
const cmsAiConfigController = require('../controllers/cmsAiConfigController');
const cmsMilestoneController = require('../controllers/cmsMilestoneController');
const cmsMuseumConfigController = require('../controllers/cmsMuseumConfigController');
const trialController = require('../controllers/trialController');
const cmsTrialController = require('../controllers/cmsTrialController');
const popupController = require('../controllers/popupController');
const cmsPopupController = require('../controllers/cmsPopupController');
const uploadController = require('../controllers/uploadController');
const { cmsAuthMiddleware, cmsPermissionMiddleware } = require('../middleware/cmsAuth');

const router = express.Router();

// 通用上传（图片）
router.post('/upload/image', authMiddleware, uploadController.uploadImage);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { time: new Date().toISOString() } });
});

// 认证
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.post('/auth/wechat-login', authController.wechatLogin);
router.post('/auth/wechat-bind', authController.wechatBindPhone);

// 用户（需登录）
router.get('/users/me', authMiddleware, userController.getMe);
router.put('/users/me', authMiddleware, userController.updateMe);
router.put('/users/profile', authMiddleware, userController.updateProfile);
router.post('/users/avatar', authMiddleware, userController.uploadAvatar);
router.post('/users/export', authMiddleware, userController.exportData);
router.delete('/users/data', authMiddleware, userController.clearData);
router.delete('/users/me', authMiddleware, userController.deleteAccount);

// 搭子
router.get('/partners', authMiddleware, partnerController.getPartner);
router.put('/partners', authMiddleware, partnerController.updatePartner);
router.post('/partners/switch-mode', authMiddleware, partnerController.switchMode);
router.get('/partners/status', authMiddleware, partnerController.getStatus);

// 聊天
router.post('/chat/send', authMiddleware, chatController.sendMessage);
router.get('/chat/messages', authMiddleware, chatController.getMessages);
router.get('/chat/pending-assets', authMiddleware, chatController.getPendingAssets);
router.post('/chat/confirm-precipitation', authMiddleware, chatController.confirmPrecipitation);

// 记录中心
router.get('/records/today', authMiddleware, recordController.getToday);
router.get('/records/diet', authMiddleware, recordController.getDiet);
router.post('/records/diet', authMiddleware, recordController.saveDiet);
router.put('/records/diet/:id', authMiddleware, recordController.saveDiet);
router.delete('/records/diet/:id', authMiddleware, recordController.deleteDiet);
router.get('/records/exercise', authMiddleware, recordController.getExercise);
router.post('/records/exercise', authMiddleware, recordController.saveExercise);
router.put('/records/exercise/:id', authMiddleware, recordController.saveExercise);
router.delete('/records/exercise/:id', authMiddleware, recordController.deleteExercise);
router.get('/records/body', authMiddleware, recordController.getBody);
router.post('/records/body', authMiddleware, recordController.saveBody);
router.delete('/records/body/:id', authMiddleware, recordController.deleteBody);
router.get('/records/habit', authMiddleware, recordController.getHabits);
router.post('/records/habit', authMiddleware, recordController.saveHabit);
router.put('/records/habit/:id', authMiddleware, recordController.saveHabit);
router.get('/records/milestone-data', authMiddleware, recordController.getMilestoneData);
router.get('/records/dates', authMiddleware, recordController.getRecordDates);

// 博物馆
router.get('/museum/overview', authMiddleware, museumController.getOverview);
router.get('/museum/timeline', authMiddleware, museumController.getTimeline);
router.get('/museum/items', authMiddleware, museumController.getItems);
router.get('/museum/items/:id', authMiddleware, museumController.getItem);
router.post('/museum/items', authMiddleware, museumController.addItem);
router.put('/museum/items/:id', authMiddleware, museumController.updateItem);
router.delete('/museum/items/:id', authMiddleware, museumController.deleteItem);
router.post('/museum/items/:id/confirm', authMiddleware, museumController.confirmItem);
router.post('/museum/items/:id/discard', authMiddleware, museumController.discardItem);
router.post('/museum/items/:id/favorite', authMiddleware, museumController.toggleFavorite);

// 沉淀记录
router.get('/precipitations', authMiddleware, precipitationController.getPrecipitations);
router.post('/precipitations', authMiddleware, precipitationController.createPrecipitation);
router.put('/precipitations/:id', authMiddleware, precipitationController.updatePrecipitation);
router.delete('/precipitations/:id', authMiddleware, precipitationController.deletePrecipitation);

// 系统数据
router.get('/foods', authMiddleware, systemController.getFoods);
router.get('/foods/:id', authMiddleware, systemController.getFoodDetail);
router.post('/foods/:id/favorite', authMiddleware, systemController.toggleFavoriteFood);
router.post('/foods/custom', authMiddleware, systemController.addCustomFood);
router.get('/exercises', authMiddleware, systemController.getExercises);
router.get('/exercises/:id', authMiddleware, systemController.getExerciseDetail);
router.post('/exercises/:id/favorite', authMiddleware, systemController.toggleFavoriteExercise);
router.post('/exercises/custom', authMiddleware, systemController.addCustomExercise);
router.get('/settings', authMiddleware, systemController.getSettings);
router.put('/settings', authMiddleware, systemController.updateSettings);

// AI P1 功能
router.get('/ai/diary', authMiddleware, aiController.generateDiary);
router.get('/ai/diary/monthly', authMiddleware, aiController.generateMonthlyDiary);
router.get('/ai/milestones', authMiddleware, aiController.getMilestones);
router.post('/ai/milestones/check', authMiddleware, aiController.checkMilestones);
router.get('/ai/plateau', authMiddleware, aiController.analyzePlateau);

// 反馈
router.get('/feedback', authMiddleware, feedbackController.getFeedbacks);
router.post('/feedback', authMiddleware, feedbackController.createFeedback);

// 应用全局配置（启动页、协议页使用）
router.get('/app-config', systemController.getAppConfig);

// 试用权限（需登录，但异常时前端自行兜底放行）
router.get('/trial/get-config', authMiddleware, trialController.getConfig);
router.post('/trial/check-permission', authMiddleware, trialController.checkPermission);
router.post('/trial/report-count', authMiddleware, trialController.reportCount);

// 反馈管理后台（管理员接口）
router.get('/admin/feedbacks', authMiddleware, adminMiddleware, feedbackController.getAllFeedbacks);
router.post('/admin/feedbacks/:id/reply', authMiddleware, adminMiddleware, feedbackController.replyFeedback);
router.put('/admin/feedbacks/:id/status', authMiddleware, adminMiddleware, feedbackController.updateFeedbackStatus);

// 协议与隐私政策管理后台（管理员接口）
router.get('/admin/app-config', authMiddleware, adminMiddleware, systemController.getAppConfig);
router.put('/admin/app-config', authMiddleware, adminMiddleware, systemController.updateAppConfig);

// ==================== CMS 管理后台接口 ====================

// CMS 认证
router.post('/cms/auth/login', cmsAuthController.login);
router.get('/cms/auth/profile', cmsAuthMiddleware, cmsAuthController.getProfile);
router.put('/cms/auth/password', cmsAuthMiddleware, cmsAuthController.changePassword);

// CMS 角色
router.get('/cms/roles', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:read'), cmsUserController.getRoles);
router.post('/cms/roles', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:write'), cmsUserController.createRole);
router.put('/cms/roles/:id', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:write'), cmsUserController.updateRole);
router.delete('/cms/roles/:id', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:write'), cmsUserController.deleteRole);

// CMS 管理员账号
router.get('/cms/users', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:read'), cmsUserController.getUsers);
router.post('/cms/users', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:write'), cmsUserController.createUser);
router.put('/cms/users/:id', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:write'), cmsUserController.updateUser);
router.put('/cms/users/:id/password', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:write'), cmsUserController.resetUserPassword);
router.delete('/cms/users/:id', cmsAuthMiddleware, cmsPermissionMiddleware('cms_user:write'), cmsUserController.deleteUser);

// CMS 应用配置
router.get('/cms/app-config', cmsAuthMiddleware, cmsPermissionMiddleware('app_config:read'), cmsConfigController.getAppConfig);
router.put('/cms/app-config', cmsAuthMiddleware, cmsPermissionMiddleware('app_config:write'), cmsConfigController.updateAppConfig);

// CMS AI Prompt 管理
router.get('/cms/prompts', cmsAuthMiddleware, cmsPermissionMiddleware('prompt:read'), cmsPromptController.list);
router.get('/cms/prompts/:key', cmsAuthMiddleware, cmsPermissionMiddleware('prompt:read'), cmsPromptController.detail);
router.post('/cms/prompts/:key/versions', cmsAuthMiddleware, cmsPermissionMiddleware('prompt:write'), cmsPromptController.publish);
router.put('/cms/prompts/:key/versions/:version/status', cmsAuthMiddleware, cmsPermissionMiddleware('prompt:write'), cmsPromptController.setEnabled);
router.put('/cms/prompts/:key/ai-config', cmsAuthMiddleware, cmsPermissionMiddleware('prompt:write'), cmsPromptController.setAiConfig);

// CMS AI 配置管理
router.get('/cms/ai-configs', cmsAuthMiddleware, cmsPermissionMiddleware('ai_config:read'), cmsAiConfigController.list);
router.get('/cms/ai-configs/simple', cmsAuthMiddleware, cmsPermissionMiddleware('ai_config:read'), cmsAiConfigController.simple);
router.get('/cms/ai-configs/:id', cmsAuthMiddleware, cmsPermissionMiddleware('ai_config:read'), cmsAiConfigController.detail);
router.post('/cms/ai-configs', cmsAuthMiddleware, cmsPermissionMiddleware('ai_config:write'), cmsAiConfigController.create);
router.put('/cms/ai-configs/:id', cmsAuthMiddleware, cmsPermissionMiddleware('ai_config:write'), cmsAiConfigController.update);
router.delete('/cms/ai-configs/:id', cmsAuthMiddleware, cmsPermissionMiddleware('ai_config:write'), cmsAiConfigController.remove);

// CMS 里程碑文案模板管理
router.get('/cms/milestone-templates', cmsAuthMiddleware, cmsPermissionMiddleware('milestone:read'), cmsMilestoneController.list);
router.post('/cms/milestone-templates', cmsAuthMiddleware, cmsPermissionMiddleware('milestone:write'), cmsMilestoneController.create);
router.put('/cms/milestone-templates/:id', cmsAuthMiddleware, cmsPermissionMiddleware('milestone:write'), cmsMilestoneController.update);
router.delete('/cms/milestone-templates/:id', cmsAuthMiddleware, cmsPermissionMiddleware('milestone:write'), cmsMilestoneController.remove);
router.post('/cms/milestone-templates/seed', cmsAuthMiddleware, cmsPermissionMiddleware('milestone:write'), cmsMilestoneController.seed);

// CMS 博物馆入口配置
router.get('/cms/museum-config', cmsAuthMiddleware, cmsPermissionMiddleware('museum_config:read'), cmsMuseumConfigController.get);
router.put('/cms/museum-config', cmsAuthMiddleware, cmsPermissionMiddleware('museum_config:write'), cmsMuseumConfigController.update);

// CMS 模板消息 / 搭子话术配置
router.get('/cms/template-config', cmsAuthMiddleware, cmsPermissionMiddleware('template_config:read'), cmsTemplateController.list);
router.get('/cms/template-config/types', cmsAuthMiddleware, cmsPermissionMiddleware('template_config:read'), cmsTemplateController.getTypes);
router.post('/cms/template-config', cmsAuthMiddleware, cmsPermissionMiddleware('template_config:write'), cmsTemplateController.create);
router.get('/cms/template-config/:id', cmsAuthMiddleware, cmsPermissionMiddleware('template_config:read'), cmsTemplateController.getById);
router.put('/cms/template-config/:id', cmsAuthMiddleware, cmsPermissionMiddleware('template_config:write'), cmsTemplateController.update);
router.delete('/cms/template-config/:id', cmsAuthMiddleware, cmsPermissionMiddleware('template_config:write'), cmsTemplateController.remove);
router.post('/cms/template-config/seed', cmsAuthMiddleware, cmsPermissionMiddleware('template_config:write'), cmsTemplateController.seed);

// CMS C 端用户管理
router.get('/cms/app-users', cmsAuthMiddleware, cmsPermissionMiddleware('app_user:read'), cmsAppUserController.list);
router.post('/cms/app-users', cmsAuthMiddleware, cmsPermissionMiddleware('app_user:write'), cmsAppUserController.create);
router.get('/cms/app-users/:id', cmsAuthMiddleware, cmsPermissionMiddleware('app_user:read'), cmsAppUserController.getById);
router.put('/cms/app-users/:id/status', cmsAuthMiddleware, cmsPermissionMiddleware('app_user:write'), cmsAppUserController.updateStatus);
router.delete('/cms/app-users/:id', cmsAuthMiddleware, cmsPermissionMiddleware('app_user:write'), cmsAppUserController.deleteUser);
router.get('/cms/app-users/:id/records', cmsAuthMiddleware, cmsPermissionMiddleware('app_user:read'), cmsAppUserController.getRecordsOverview);

// CMS 反馈管理
router.get('/cms/feedbacks', cmsAuthMiddleware, cmsPermissionMiddleware('feedback:read'), cmsFeedbackController.list);
router.get('/cms/feedbacks/:id', cmsAuthMiddleware, cmsPermissionMiddleware('feedback:read'), cmsFeedbackController.getById);
router.post('/cms/feedbacks/:id/reply', cmsAuthMiddleware, cmsPermissionMiddleware('feedback:write'), cmsFeedbackController.reply);
router.put('/cms/feedbacks/:id/status', cmsAuthMiddleware, cmsPermissionMiddleware('feedback:write'), cmsFeedbackController.updateStatus);

// CMS 食品库
router.get('/cms/foods', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:read'), cmsFoodController.list);
router.get('/cms/foods/:id', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:read'), cmsFoodController.getById);
router.post('/cms/foods', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:write'), cmsFoodController.create);
router.put('/cms/foods/:id', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:write'), cmsFoodController.update);
router.delete('/cms/foods/:id', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:write'), cmsFoodController.remove);
router.post('/cms/foods/import', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:write'), cmsFoodController.batchImport);

// CMS 自定义食物审核
router.get('/cms/custom-foods', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:read'), cmsCustomFoodController.list);
router.get('/cms/custom-foods/:id', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:read'), cmsCustomFoodController.getById);
router.post('/cms/custom-foods/:id/approve', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:write'), cmsCustomFoodController.approve);
router.post('/cms/custom-foods/:id/reject', cmsAuthMiddleware, cmsPermissionMiddleware('food_lib:write'), cmsCustomFoodController.reject);

// CMS 运动库
router.get('/cms/exercises', cmsAuthMiddleware, cmsPermissionMiddleware('exercise_lib:read'), cmsExerciseController.list);
router.get('/cms/exercises/:id', cmsAuthMiddleware, cmsPermissionMiddleware('exercise_lib:read'), cmsExerciseController.getById);
router.post('/cms/exercises', cmsAuthMiddleware, cmsPermissionMiddleware('exercise_lib:write'), cmsExerciseController.create);
router.put('/cms/exercises/:id', cmsAuthMiddleware, cmsPermissionMiddleware('exercise_lib:write'), cmsExerciseController.update);
router.delete('/cms/exercises/:id', cmsAuthMiddleware, cmsPermissionMiddleware('exercise_lib:write'), cmsExerciseController.remove);

// CMS 操作日志
router.get('/cms/logs', cmsAuthMiddleware, cmsPermissionMiddleware('log:read'), cmsLogController.list);

// CMS 试用权限管理
router.get('/cms/trial/dashboard', cmsAuthMiddleware, cmsPermissionMiddleware('trial_config:read'), cmsTrialController.dashboard);
router.get('/cms/trial/config', cmsAuthMiddleware, cmsPermissionMiddleware('trial_config:read'), cmsTrialController.getConfig);
router.put('/cms/trial/config', cmsAuthMiddleware, cmsPermissionMiddleware('trial_config:write'), cmsTrialController.updateConfig);
router.post('/cms/trial/audit-mode', cmsAuthMiddleware, cmsPermissionMiddleware('trial_config:write'), cmsTrialController.auditMode);
router.get('/cms/trial/whitelist', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:read'), cmsTrialController.listWhitelist);
router.post('/cms/trial/whitelist', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.createWhitelist);
router.post('/cms/trial/whitelist/batch', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.batchCreateWhitelist);
router.put('/cms/trial/whitelist/:id', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.updateWhitelist);
router.delete('/cms/trial/whitelist/:id', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.removeWhitelist);
router.get('/cms/trial/logs', cmsAuthMiddleware, cmsPermissionMiddleware('trial_log:read'), cmsTrialController.listLogs);

// C 端弹窗广告
// 弹窗配置对未登录用户也可下发（如开屏运营活动），上报仍需登录
router.get('/app/popup/config/list', popupController.getConfigList);
router.post('/app/popup/report', authMiddleware, popupController.reportEvents);

// CMS 弹窗广告管理
router.get('/cms/popups', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:read'), cmsPopupController.listPopups);
router.get('/cms/popups/:id', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:read'), cmsPopupController.getPopupById);
router.post('/cms/popups', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:write'), cmsPopupController.createPopup);
router.put('/cms/popups/:id', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:write'), cmsPopupController.updatePopup);
router.delete('/cms/popups/:id', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:write'), cmsPopupController.removePopup);
router.post('/cms/popups/:id/copy', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:write'), cmsPopupController.copyPopup);
router.post('/cms/popups/batch-status', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:write'), cmsPopupController.batchStatus);
router.post('/cms/popups/batch-delete', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:write'), cmsPopupController.batchDelete);

router.get('/cms/popup-whitelist', cmsAuthMiddleware, cmsPermissionMiddleware('popup_whitelist:read'), cmsPopupController.listWhitelist);
router.post('/cms/popup-whitelist', cmsAuthMiddleware, cmsPermissionMiddleware('popup_whitelist:write'), cmsPopupController.createWhitelist);
router.put('/cms/popup-whitelist/:id', cmsAuthMiddleware, cmsPermissionMiddleware('popup_whitelist:write'), cmsPopupController.updateWhitelist);
router.delete('/cms/popup-whitelist/:id', cmsAuthMiddleware, cmsPermissionMiddleware('popup_whitelist:write'), cmsPopupController.removeWhitelist);

router.get('/cms/app-routes', cmsAuthMiddleware, cmsPermissionMiddleware('popup_route:read'), cmsPopupController.listRoutes);
router.post('/cms/app-routes', cmsAuthMiddleware, cmsPermissionMiddleware('popup_route:write'), cmsPopupController.createRoute);
router.put('/cms/app-routes/:id', cmsAuthMiddleware, cmsPermissionMiddleware('popup_route:write'), cmsPopupController.updateRoute);
router.delete('/cms/app-routes/:id', cmsAuthMiddleware, cmsPermissionMiddleware('popup_route:write'), cmsPopupController.removeRoute);

router.get('/cms/popup-stats/dashboard', cmsAuthMiddleware, cmsPermissionMiddleware('popup_stats:read'), cmsPopupController.getStatsDashboard);
router.get('/cms/popup-stats/detail', cmsAuthMiddleware, cmsPermissionMiddleware('popup_stats:read'), cmsPopupController.getStatsDetail);
router.get('/cms/popup-events/export', cmsAuthMiddleware, cmsPermissionMiddleware('popup_stats:read'), cmsPopupController.exportEvents);

router.get('/cms/popup-global', cmsAuthMiddleware, cmsPermissionMiddleware('popup_global:read'), cmsPopupController.getGlobalConfig);
router.put('/cms/popup-global', cmsAuthMiddleware, cmsPermissionMiddleware('popup_global:write'), cmsPopupController.updateGlobalConfig);

// 模板消息
router.get('/chat/stats', authMiddleware, chatController.getChatStats);
router.post('/chat/wakeup', authMiddleware, chatController.sendWakeupMessage);

// 方法库
router.get('/methods', authMiddleware, methodController.getMethods);
router.post('/methods', authMiddleware, methodController.addMethod);
router.put('/methods/:id', authMiddleware, methodController.updateMethod);
router.delete('/methods/:id', authMiddleware, methodController.deleteMethod);

// 照片/对比墙
router.get('/photos', authMiddleware, photoController.getPhotos);
router.post('/photos', authMiddleware, photoController.uploadPhoto);
router.delete('/photos/:id', authMiddleware, photoController.deletePhoto);

module.exports = router;
