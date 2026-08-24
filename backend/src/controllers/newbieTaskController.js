/**
 * 新手任务 C 端控制器
 */
const { success, error } = require('../utils/response');
const newbieTaskService = require('../services/newbieTaskService');

function list(req, res) {
  const userId = req.userId;
  const list = newbieTaskService.list(userId);
  const completed = list.filter(t => t.status === 'completed').length;
  const total = list.length;
  return res.json(success({ list, completed, total, progress: total > 0 ? Math.round((completed / total) * 100) : 0 }));
}

function claim(req, res) {
  const userId = req.userId;
  const { key } = req.params;
  const result = newbieTaskService.claim(userId, key);
  if (result.error) return res.status(400).json(error(result.error, 400));
  return res.json(success(result, '领取成功'));
}

module.exports = {
  list,
  claim
};
