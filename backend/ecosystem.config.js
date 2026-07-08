/**
 * PM2 进程配置文件
 * 同时托管测试环境和正式环境后端服务
 * 用法：
 *   pm2 start ecosystem.config.js --only fit-backend-test
 *   pm2 start ecosystem.config.js --only fit-backend-prod
 */
const path = require('path');

const baseConfig = {
  script: './src/app.js',
  instances: 1,
  exec_mode: 'fork',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  merge_logs: true,
  max_memory_restart: '500M',
  env: {
    NODE_ENV: 'development'
  },
  // 异常退出后自动重启
  autorestart: true,
  // 1分钟内重启超过10次则停止，避免死循环
  min_uptime: '10s',
  max_restarts: 10
};

module.exports = {
  apps: [
    {
      ...baseConfig,
      name: 'fit-backend-test',
      env: {
        NODE_ENV: 'test'
      },
      error_file: './logs/pm2-test-error.log',
      out_file: './logs/pm2-test-out.log',
      // 测试环境可以暴露更多调试信息
      log_level: 'info'
    },
    {
      ...baseConfig,
      name: 'fit-backend-prod',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-prod-error.log',
      out_file: './logs/pm2-prod-out.log',
      log_level: 'warn'
    }
  ]
};
