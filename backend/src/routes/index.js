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
const announcementController = require('../controllers/announcementController');
const cmsAnnouncementController = require('../controllers/cmsAnnouncementController');
const cmsOperationStatsController = require('../controllers/cmsOperationStatsController');
const uploadController = require('../controllers/uploadController');
const companionController = require('../controllers/companionController');
const newbieTaskController = require('../controllers/newbieTaskController');
const workoutController = require('../controllers/workoutController');
const voiceController = require('../controllers/voiceController');
const cmsPetController = require('../controllers/cmsPetController');
const cmsCurrencyController = require('../controllers/cmsCurrencyController');
const cmsShopController = require('../controllers/cmsShopController');
const cmsEventController = require('../controllers/cmsEventController');
const cmsWorkoutController = require('../controllers/cmsWorkoutController');
const cmsTaskController = require('../controllers/cmsTaskController');
const cmsAchievementController = require('../controllers/cmsAchievementController');
const cmsDialogueController = require('../controllers/cmsDialogueController');
const { cmsAuthMiddleware, cmsPermissionMiddleware } = require('../middleware/cmsAuth');

const router = express.Router();

// 通用上传（图片）
router.post('/upload/image', authMiddleware, uploadController.uploadImage);
// CMS 后台上传（图片，自动存储到服务端 /static/uploads）
router.post('/cms/upload/image', cmsAuthMiddleware, uploadController.uploadImage);

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { time: new Date().toISOString() } });
});

// 认证
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.post('/auth/wechat-login', authController.wechatLogin);
// 绑定微信手机号需登录态，通过 token 定位当前用户
router.post('/auth/wechat-bind', authMiddleware, authController.wechatBindPhone);

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
router.delete('/records/habit/:id', authMiddleware, recordController.deleteHabit);
router.get('/records/fasting', authMiddleware, recordController.getFasting);
router.get('/records/fasting/stats', authMiddleware, recordController.getFastingStats);
router.post('/records/fasting', authMiddleware, recordController.saveFasting);
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
router.post('/museum/items/:id/share', authMiddleware, museumController.shareItem);
router.post('/museum/mood', authMiddleware, museumController.saveMood);
router.get('/museum/moods', authMiddleware, museumController.getMoods);
router.get('/museum/moods/stats', authMiddleware, museumController.getMoodStats);

// 沉淀记录
router.get('/precipitations', authMiddleware, precipitationController.getPrecipitations);
router.post('/precipitations', authMiddleware, precipitationController.createPrecipitation);
router.put('/precipitations/:id', authMiddleware, precipitationController.updatePrecipitation);
router.delete('/precipitations/:id', authMiddleware, precipitationController.deletePrecipitation);

// 陪伴系统
router.get('/pet/config', companionController.getPetConfig);
router.get('/pet', authMiddleware, companionController.getPet);
router.post('/pet/feed', authMiddleware, companionController.feed);
router.post('/pet/exercise', authMiddleware, companionController.exercise);
router.post('/pet/explore', authMiddleware, companionController.startExplore);
router.post('/pet/explore/complete', authMiddleware, companionController.completeExplore);
router.get('/pet/events', authMiddleware, companionController.getEvents);
router.get('/pet/events/album', authMiddleware, companionController.getEventAlbum);
router.put('/pet/events/:id/read', authMiddleware, companionController.markEventRead);
router.get('/pet/dialogues', authMiddleware, companionController.getDialogues);

router.get('/currency', authMiddleware, companionController.getCurrency);
router.get('/currency/transactions', authMiddleware, companionController.getCurrencyTransactions);

router.get('/shop/items', authMiddleware, companionController.getShopItems);
router.post('/shop/buy', authMiddleware, companionController.buyShopItem);

router.get('/inventory', authMiddleware, companionController.getInventory);
router.post('/inventory/use', authMiddleware, companionController.useInventoryItem);
router.get('/inventory/equipment-workouts', authMiddleware, companionController.getEquipmentWorkouts);

router.get('/tasks', authMiddleware, companionController.getTasks);
router.post('/tasks/:id/claim', authMiddleware, companionController.claimTaskReward);
router.get('/checkin/status', authMiddleware, companionController.getCheckinStatus);
router.post('/checkin', authMiddleware, companionController.checkin);

router.get('/achievements', authMiddleware, companionController.getAchievements);

// 新手任务
router.get('/newbie-tasks', authMiddleware, newbieTaskController.list);
router.post('/newbie-tasks/:key/claim', authMiddleware, newbieTaskController.claim);

// 陪你动
router.get('/workouts', authMiddleware, workoutController.list);
router.get('/workouts/:key', authMiddleware, workoutController.detail);
router.post('/workouts/:key/start', authMiddleware, workoutController.start);
router.post('/workouts/:key/complete', authMiddleware, workoutController.complete);

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

// AI P1 功能（注意：/ai/diary/monthly 必须在 /ai/diary/:id 之前注册，否则会被 :id 吃掉）
router.get('/ai/diary', authMiddleware, aiController.generateDiary);
router.get('/ai/diary/history', authMiddleware, aiController.getDiaryHistory);
router.get('/ai/diary/monthly', authMiddleware, aiController.generateMonthlyDiary);
router.get('/ai/diary/:id', authMiddleware, aiController.getDiaryDetail);
router.delete('/ai/diary/:id', authMiddleware, aiController.deleteDiary);
router.post('/ai/diary/:id/favorite', authMiddleware, aiController.toggleDiaryFavorite);
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
router.post('/cms/upload/image', cmsAuthMiddleware, cmsPermissionMiddleware('popup_config:write'), uploadController.uploadImage);
router.post('/cms/upload/video', cmsAuthMiddleware, cmsPermissionMiddleware('workout_config:write'), uploadController.uploadVideo);
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
router.post('/cms/trial/config', cmsAuthMiddleware, cmsPermissionMiddleware('trial_config:write'), cmsTrialController.updateConfig);
router.post('/cms/trial/audit-mode', cmsAuthMiddleware, cmsPermissionMiddleware('trial_config:write'), cmsTrialController.auditMode);
router.get('/cms/trial/whitelist', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:read'), cmsTrialController.listWhitelist);
router.post('/cms/trial/whitelist', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.createWhitelist);
router.post('/cms/trial/whitelist/batch', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.batchCreateWhitelist);
router.put('/cms/trial/whitelist/:id', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.updateWhitelist);
router.delete('/cms/trial/whitelist/:id', cmsAuthMiddleware, cmsPermissionMiddleware('trial_whitelist:write'), cmsTrialController.removeWhitelist);
router.get('/cms/trial/logs', cmsAuthMiddleware, cmsPermissionMiddleware('trial_log:read'), cmsTrialController.listLogs);

// C 端弹窗广告
// 弹窗配置对未登录用户也可下发（如开屏运营活动），上报支持未登录用户通过 device_id 埋点
router.get('/app/popup/config/list', popupController.getConfigList);
router.post('/app/popup/report', popupController.reportEvents);

// C 端公告/消息中心
router.get('/app/announcements', authMiddleware, announcementController.listAnnouncements);
router.get('/app/announcements/:id', authMiddleware, announcementController.getAnnouncement);
router.post('/app/announcements/:id/read', authMiddleware, announcementController.markRead);
router.post('/app/announcements/:id/show', authMiddleware, announcementController.recordShow);
router.get('/app/notifications/unread-count', authMiddleware, announcementController.getUnreadCount);
router.get('/app/notifications/channels', authMiddleware, announcementController.listChannels);

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

// CMS 公告/消息中心管理
router.get('/cms/announcements', cmsAuthMiddleware, cmsPermissionMiddleware('announcement:read'), cmsAnnouncementController.list);
router.get('/cms/announcements/:id', cmsAuthMiddleware, cmsPermissionMiddleware('announcement:read'), cmsAnnouncementController.getById);
router.post('/cms/announcements', cmsAuthMiddleware, cmsPermissionMiddleware('announcement:write'), cmsAnnouncementController.create);
router.put('/cms/announcements/:id', cmsAuthMiddleware, cmsPermissionMiddleware('announcement:write'), cmsAnnouncementController.update);
router.delete('/cms/announcements/:id', cmsAuthMiddleware, cmsPermissionMiddleware('announcement:write'), cmsAnnouncementController.remove);
router.post('/cms/announcements/batch-status', cmsAuthMiddleware, cmsPermissionMiddleware('announcement:write'), cmsAnnouncementController.batchStatus);
router.post('/cms/announcements/batch-delete', cmsAuthMiddleware, cmsPermissionMiddleware('announcement:write'), cmsAnnouncementController.batchDelete);

router.get('/cms/notification-channels', cmsAuthMiddleware, cmsPermissionMiddleware('notification_channel:read'), cmsAnnouncementController.listChannels);
router.put('/cms/notification-channels/:id', cmsAuthMiddleware, cmsPermissionMiddleware('notification_channel:write'), cmsAnnouncementController.updateChannel);

// CMS 运营数据看板
router.get('/cms/operation-stats/dashboard', cmsAuthMiddleware, cmsPermissionMiddleware('operation_stats:read'), cmsOperationStatsController.dashboard);
router.get('/cms/operation-stats/announcements', cmsAuthMiddleware, cmsPermissionMiddleware('operation_stats:read'), cmsOperationStatsController.announcementStats);
router.get('/cms/operation-stats/popups', cmsAuthMiddleware, cmsPermissionMiddleware('operation_stats:read'), cmsOperationStatsController.popupStats);
router.get('/cms/operation-stats/templates', cmsAuthMiddleware, cmsPermissionMiddleware('operation_stats:read'), cmsOperationStatsController.templateStats);

// 模板消息
router.get('/chat/stats', authMiddleware, chatController.getChatStats);
router.post('/chat/wakeup', authMiddleware, chatController.sendWakeupMessage);
// 减重建议（首次完善资料/更新身体信息后进入聊聊页时触发）
router.post('/chat/advice', authMiddleware, chatController.sendAdviceMessage);

// CMS 宠物陪伴配置
router.get('/cms/pet-config/global', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.getGlobal);
router.put('/cms/pet-config/global', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.updateGlobal);

// CMS 宠物时段与限制配置（三餐/运动/逛逛/喂食上限/运动上限）
router.get('/cms/pet-config/schedules', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.getSchedules);
router.put('/cms/pet-config/schedules', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.updateSchedules);

// CMS 宠物形象配置（坐标/序列帧/播放速率）
router.get('/cms/pet-config/sprite', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.getSprite);
router.put('/cms/pet-config/sprite', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.updateSprite);

// CMS 宠物场景配置（场景名称/时段背景图/比例）
router.get('/cms/pet-config/scenes', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.getScenes);
router.put('/cms/pet-config/scenes', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.updateScenes);

router.get('/cms/pet-config/skins', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.listSkins);
router.post('/cms/pet-config/skins', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.createSkin);
router.put('/cms/pet-config/skins/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.updateSkin);
router.delete('/cms/pet-config/skins/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.removeSkin);

router.get('/cms/pet-config/states', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.listStates);
router.post('/cms/pet-config/states', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.createState);
router.put('/cms/pet-config/states/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.updateState);
router.delete('/cms/pet-config/states/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.removeState);

// CMS 宠物运动库配置
router.get('/cms/pet-config/exercises', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.listExercises);
router.post('/cms/pet-config/exercises', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.createExercise);
router.put('/cms/pet-config/exercises/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.updateExercise);
router.delete('/cms/pet-config/exercises/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.removeExercise);

router.get('/cms/pet-config/dialogues', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:read'), cmsPetController.dialogues.list);
router.post('/cms/pet-config/dialogues', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.dialogues.create);
router.put('/cms/pet-config/dialogues/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.dialogues.update);
router.delete('/cms/pet-config/dialogues/:id', cmsAuthMiddleware, cmsPermissionMiddleware('pet_config:write'), cmsPetController.dialogues.remove);

// CMS 货币经济配置
router.get('/cms/currency-config/rules', cmsAuthMiddleware, cmsPermissionMiddleware('currency_config:read'), cmsCurrencyController.getRules);
router.put('/cms/currency-config/rules', cmsAuthMiddleware, cmsPermissionMiddleware('currency_config:write'), cmsCurrencyController.updateRules);
router.get('/cms/currency-config/analysis-cost', cmsAuthMiddleware, cmsPermissionMiddleware('currency_config:read'), cmsCurrencyController.getAnalysisCost);
router.put('/cms/currency-config/analysis-cost', cmsAuthMiddleware, cmsPermissionMiddleware('currency_config:write'), cmsCurrencyController.updateAnalysisCost);
router.get('/cms/currency-config/transactions', cmsAuthMiddleware, cmsPermissionMiddleware('currency_config:read'), cmsCurrencyController.listTransactions);
router.post('/cms/currency-config/adjust', cmsAuthMiddleware, cmsPermissionMiddleware('currency_config:write'), cmsCurrencyController.adjust);

// CMS 商城配置
router.get('/cms/shop/items', cmsAuthMiddleware, cmsPermissionMiddleware('shop_config:read'), cmsShopController.list);
router.post('/cms/shop/items', cmsAuthMiddleware, cmsPermissionMiddleware('shop_config:write'), cmsShopController.create);
router.get('/cms/shop/items/:id', cmsAuthMiddleware, cmsPermissionMiddleware('shop_config:read'), cmsShopController.getById);
router.put('/cms/shop/items/:id', cmsAuthMiddleware, cmsPermissionMiddleware('shop_config:write'), cmsShopController.update);
router.delete('/cms/shop/items/:id', cmsAuthMiddleware, cmsPermissionMiddleware('shop_config:write'), cmsShopController.remove);

// CMS 事件库配置
router.get('/cms/events', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:read'), cmsEventController.list);
router.post('/cms/events', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:write'), cmsEventController.create);
// 事件集合配置（相册 tab 名称），需在 /cms/events/:id 之前注册避免被当作 id 匹配
router.get('/cms/events/collections', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:read'), cmsEventController.getCollections);
router.post('/cms/events/collections', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:write'), cmsEventController.createCollection);
router.put('/cms/events/collections/:id', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:write'), cmsEventController.updateCollection);
router.delete('/cms/events/collections/:id', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:write'), cmsEventController.removeCollection);
router.get('/cms/events/:id', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:read'), cmsEventController.getById);
router.put('/cms/events/:id', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:write'), cmsEventController.update);
router.delete('/cms/events/:id', cmsAuthMiddleware, cmsPermissionMiddleware('event_config:write'), cmsEventController.remove);

// CMS 陪你动课程库配置
router.get('/cms/workouts', cmsAuthMiddleware, cmsPermissionMiddleware('workout_config:read'), cmsWorkoutController.list);
router.post('/cms/workouts', cmsAuthMiddleware, cmsPermissionMiddleware('workout_config:write'), cmsWorkoutController.create);
router.get('/cms/workouts/:id', cmsAuthMiddleware, cmsPermissionMiddleware('workout_config:read'), cmsWorkoutController.getById);
router.put('/cms/workouts/:id', cmsAuthMiddleware, cmsPermissionMiddleware('workout_config:write'), cmsWorkoutController.update);
router.put('/cms/workouts/:id/status', cmsAuthMiddleware, cmsPermissionMiddleware('workout_config:write'), cmsWorkoutController.toggleStatus);
router.delete('/cms/workouts/:id', cmsAuthMiddleware, cmsPermissionMiddleware('workout_config:write'), cmsWorkoutController.remove);

// CMS 任务配置
router.get('/cms/tasks', cmsAuthMiddleware, cmsPermissionMiddleware('task_config:read'), cmsTaskController.list);
router.post('/cms/tasks', cmsAuthMiddleware, cmsPermissionMiddleware('task_config:write'), cmsTaskController.create);
router.get('/cms/tasks/:id', cmsAuthMiddleware, cmsPermissionMiddleware('task_config:read'), cmsTaskController.getById);
router.put('/cms/tasks/:id', cmsAuthMiddleware, cmsPermissionMiddleware('task_config:write'), cmsTaskController.update);
router.delete('/cms/tasks/:id', cmsAuthMiddleware, cmsPermissionMiddleware('task_config:write'), cmsTaskController.remove);

// CMS 成就配置
router.get('/cms/achievements', cmsAuthMiddleware, cmsPermissionMiddleware('achievement_config:read'), cmsAchievementController.list);
router.post('/cms/achievements', cmsAuthMiddleware, cmsPermissionMiddleware('achievement_config:write'), cmsAchievementController.create);
router.get('/cms/achievements/:id', cmsAuthMiddleware, cmsPermissionMiddleware('achievement_config:read'), cmsAchievementController.getById);
router.put('/cms/achievements/:id', cmsAuthMiddleware, cmsPermissionMiddleware('achievement_config:write'), cmsAchievementController.update);
router.delete('/cms/achievements/:id', cmsAuthMiddleware, cmsPermissionMiddleware('achievement_config:write'), cmsAchievementController.remove);

// CMS 宠物对话独立入口
router.get('/cms/dialogues', cmsAuthMiddleware, cmsPermissionMiddleware('dialogue_config:read'), cmsDialogueController.list);
router.post('/cms/dialogues', cmsAuthMiddleware, cmsPermissionMiddleware('dialogue_config:write'), cmsDialogueController.create);
router.get('/cms/dialogues/:id', cmsAuthMiddleware, cmsPermissionMiddleware('dialogue_config:read'), cmsDialogueController.getById);
router.put('/cms/dialogues/:id', cmsAuthMiddleware, cmsPermissionMiddleware('dialogue_config:write'), cmsDialogueController.update);
router.delete('/cms/dialogues/:id', cmsAuthMiddleware, cmsPermissionMiddleware('dialogue_config:write'), cmsDialogueController.remove);

// 方法库
router.get('/methods', authMiddleware, methodController.getMethods);
router.post('/methods', authMiddleware, methodController.addMethod);
router.put('/methods/:id', authMiddleware, methodController.updateMethod);
router.delete('/methods/:id', authMiddleware, methodController.deleteMethod);

// 语音输入/输出
router.post('/voice/transcribe', authMiddleware, voiceController.transcribe);
router.post('/voice/tts', authMiddleware, voiceController.textToSpeech);

// 照片/对比墙
router.get('/photos', authMiddleware, photoController.getPhotos);
router.post('/photos', authMiddleware, photoController.uploadPhoto);
router.delete('/photos/:id', authMiddleware, photoController.deletePhoto);

module.exports = router;