/**
 * AI 客户端统一入口
 * 现基于 aiConfigService 的 Prompt Key 配置链进行调用
 */
const { callWithPrompt } = require('./aiConfigService');

module.exports = {
  callWithPrompt
};
