/**
 * 减肥搭子 APP 后端服务入口
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const { initTables, initSeedData } = require('./db');
const routes = require('./routes');
const partnerController = require('./controllers/partnerController');

const app = express();

// 初始化数据库
initTables();
initSeedData();
console.log('数据库初始化完成');

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 限流
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { code: 429, message: '请求过于频繁，请稍后再试', data: null }
});
app.use('/api/', limiter);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { code: 429, message: '聊天请求过于频繁，请稍后再试', data: null }
});
app.use('/api/chat/send', chatLimiter);

// 静态资源
app.use('/static', express.static(path.join(__dirname, '../public')));

// 路由
app.use('/api', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
});

// 定时任务：每 30 分钟更新一次搭子状态
setInterval(() => {
  try {
    partnerController.updatePartnerStatus();
    console.log('搭子状态已更新');
  } catch (err) {
    console.error('更新搭子状态失败:', err);
  }
}, 30 * 60 * 1000);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`减肥搭子后端服务已启动，端口：${PORT}`);
  console.log(`环境：${config.env}`);
});
