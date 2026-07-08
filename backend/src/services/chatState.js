/**
 * 聊天状态管理（内存级）
 * 用于防止模板消息、提醒等打断正在生成的 AI 回复
 */
const helperPending = new Map();

function setHelperPending(userId, pending) {
  if (pending) {
    helperPending.set(userId, true);
  } else {
    helperPending.delete(userId);
  }
}

function isHelperPending(userId) {
  return !!helperPending.get(userId);
}

module.exports = {
  setHelperPending,
  isHelperPending
};
