/**
 * 路由聚合
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const partnerController = require('../controllers/partnerController');
const chatController = require('../controllers/chatController');
const recordController = require('../controllers/recordController');
const museumController = require('../controllers/museumController');
const systemController = require('../controllers/systemController');

const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { time: new Date().toISOString() } });
});

// 认证
router.post('/auth/wechat-login', authController.wechatLogin);

// 用户（需登录）
router.get('/users/me', authMiddleware, userController.getMe);
router.put('/users/me', authMiddleware, userController.updateMe);
router.put('/users/profile', authMiddleware, userController.updateProfile);

// 搭子
router.get('/partners', authMiddleware, partnerController.getPartner);
router.put('/partners', authMiddleware, partnerController.updatePartner);
router.post('/partners/switch-mode', authMiddleware, partnerController.switchMode);
router.get('/partners/status', authMiddleware, partnerController.getStatus);

// 聊天
router.post('/chat/send', authMiddleware, chatController.sendMessage);
router.get('/chat/messages', authMiddleware, chatController.getMessages);
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

// 博物馆
router.get('/museum/overview', authMiddleware, museumController.getOverview);
router.get('/museum/timeline', authMiddleware, museumController.getTimeline);
router.get('/museum/items', authMiddleware, museumController.getItems);
router.post('/museum/items', authMiddleware, museumController.addItem);
router.put('/museum/items/:id', authMiddleware, museumController.updateItem);
router.delete('/museum/items/:id', authMiddleware, museumController.deleteItem);

// 系统数据
router.get('/foods', authMiddleware, systemController.getFoods);
router.get('/exercises', authMiddleware, systemController.getExercises);
router.get('/settings', authMiddleware, systemController.getSettings);
router.put('/settings', authMiddleware, systemController.updateSettings);

module.exports = router;
