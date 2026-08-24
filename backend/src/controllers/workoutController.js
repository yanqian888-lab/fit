/**
 * 陪你动控制器
 */
const { success, error } = require('../utils/response');
const workoutService = require('../services/workoutService');

function list(req, res) {
  const userId = req.userId;
  const list = workoutService.getWorkouts(userId);
  return res.json(success({ list }));
}

function detail(req, res) {
  const userId = req.userId;
  const { key } = req.params;
  const item = workoutService.getWorkoutDetail(userId, key);
  if (!item) return res.status(404).json(error('课程不存在', 404));
  return res.json(success(item));
}

function start(req, res) {
  const userId = req.userId;
  const { key } = req.params;
  const result = workoutService.startWorkout(userId, key);
  if (result.error) return res.status(400).json(error(result.error));
  return res.json(success(result.workout));
}

function complete(req, res) {
  const userId = req.userId;
  const { key } = req.params;
  const { duration_seconds } = req.body || {};
  const result = workoutService.completeWorkout(userId, key, { duration_seconds });
  if (result.error) return res.status(400).json(error(result.error));
  return res.json(success(result));
}

module.exports = {
  list,
  detail,
  start,
  complete
};
