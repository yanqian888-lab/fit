/**
 * 掉秤搭搭 APP 后端服务入口
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const { initTables, initSeedData, migrateTables } = require('./db');
const routes = require('./routes');
const partnerController = require('./controllers/partnerController');
const templateMessageService = require('./services/templateMessageService');
const milestoneTemplateService = require('./services/milestoneTemplateService');
const { seedCms } = require('./utils/seedCms');

const app = express();

// 服务运行在 Nginx 反向代理之后，信任 X-Forwarded-* 头
app.set('trust proxy', 1);

// 兜底：捕获未处理异常，避免单个错误直接拉垮整个进程
process.on('uncaughtException', (err) => {
  console.error('[FATAL] 未捕获的异常:', err);
  // 让进程退出，由 PM2/systemd 等进程管理器自动重启，保证服务干净恢复
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] 未处理的 Promise 拒绝:', reason);
});

// 初始化数据库
initTables();
migrateTables();
initSeedData();
console.log('数据库初始化完成');

// 初始化 CMS 超级管理员与角色
seedCms();

// 补全/校准里程碑文案模板（支持按 value 区分）
try {
  milestoneTemplateService.seedDefaults();
  console.log('里程碑文案模板校准完成');
} catch (err) {
  console.error('里程碑文案模板校准失败:', err);
}

// 初始化模板消息配置
try {
  templateMessageService.initTemplateConfigs();
  console.log('模板消息配置初始化完成');
} catch (err) {
  console.error('模板消息配置初始化失败:', err);
}

// 启动时立即刷新一次搭子状态，避免定时任务首次执行前的状态滞后
try {
  partnerController.updatePartnerStatus(true);
  console.log('搭子状态已刷新');
} catch (err) {
  console.error('启动时刷新搭子状态失败:', err);
}

// 启动时立即检查一次模板消息，避免服务重启期间错过发送时段
try {
  const sentTemplates = templateMessageService.checkAndSendTemplates();
  console.log(`启动时模板消息检查完成，发送 ${sentTemplates.length} 条`);
} catch (err) {
  console.error('启动时模板消息检查失败:', err);
}

// 中间件
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 限流（开发环境放宽，避免本地调试频繁触发 429）
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.env === 'development' ? 1000 : 120,
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

// 定时任务：每 15 分钟检查并发送模板消息
setInterval(() => {
  try {
    const sentMessages = templateMessageService.checkAndSendTemplates();
    if (sentMessages.length > 0) {
      console.log(`模板消息发送完成，共 ${sentMessages.length} 条`);
    }
  } catch (err) {
    console.error('模板消息发送失败:', err);
  }
}, 15 * 60 * 1000);

// 定时任务：每天东八区 0 点重置统计
function scheduleDailyReset() {
  const msUntilMidnight = templateMessageService.getMsUntilChinaMidnight();

  setTimeout(() => {
    try {
      templateMessageService.resetDailyStats();
      console.log('每日统计已重置');
    } catch (err) {
      console.error('每日统计重置失败:', err);
    }
    // 之后每24小时执行一次
    setInterval(() => {
      try {
        templateMessageService.resetDailyStats();
        console.log('每日统计已重置');
      } catch (err) {
        console.error('每日统计重置失败:', err);
      }
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}
scheduleDailyReset();

// 定时任务：每天东八区 10:00 检查沉默召回
function getMsUntilChinaHour(hour) {
  const now = new Date();
  const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const target = new Date(chinaNow);
  target.setUTCHours(hour, 0, 0, 0);
  if (target.getTime() <= chinaNow.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  const targetUtc = new Date(target.getTime() - 8 * 60 * 60 * 1000);
  return targetUtc.getTime() - now.getTime();
}

function scheduleRecall() {
  const run = () => {
    try {
      const sent = templateMessageService.checkAndSendRecalls();
      if (sent.length > 0) {
        console.log(`沉默召回检查完成，发送 ${sent.length} 条`);
      }
    } catch (err) {
      console.error('沉默召回检查失败:', err);
    }
  };

  const msUntil10 = getMsUntilChinaHour(10);
  setTimeout(() => {
    run();
    setInterval(run, 24 * 60 * 60 * 1000);
  }, msUntil10);
}
scheduleRecall();

const PORT = config.port;
app.listen(PORT, '::', () => {
  console.log(`掉秤搭搭后端服务已启动，端口：${PORT}`);
  console.log(`环境：${config.env}`);
});
