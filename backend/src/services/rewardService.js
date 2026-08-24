/**
 * 奖励链路统一服务
 * 供 Controller 与 Agent 复用：记录奖励、任务进度、小确幸、体重达标。
 */
const { db, withTransaction } = require('../db');
const taskService = require('./taskService');
const eventService = require('./eventService');
const achievementService = require('./achievementService');
const rewardReceiptService = require('./rewardReceiptService');
const newbieTaskService = require('./newbieTaskService');
const { getChinaDateStr } = require('../utils/chinaTime');

function rewardForRecord(userId, action, relatedId, value = null) {
  return withTransaction(() => {
    // 行为浆果奖励已收口到任务系统：这里只推进任务进度，由任务配置决定是否发奖
    const result = { added: 0 };
    const taskResults = taskService.updateTaskProgress(userId, action, 1);

    if (action === 'record_diet') {
      eventService.triggerJoy004_ThreeDayDiet(userId);
      eventService.triggerJoy001_AllMealsOnTime(userId);
    } else if (action === 'record_exercise') {
      eventService.triggerJoy002_ExerciseDone(userId);
    } else if (action === 'record_body') {
      eventService.triggerJoy003_WeightDrop(userId);
    } else if (action === 'record_water') {
      eventService.triggerJoy005_WaterGoal(userId, value);

      // 饮水达标任务：以用户设置的 water_goal 为准
      const today = getChinaDateStr();
      const profile = db.prepare('SELECT water_goal FROM user_profiles WHERE user_id = ?').get(userId);
      const waterGoal = profile?.water_goal || 2000;
      const total = db.prepare(`
        SELECT COALESCE(SUM(water_ml), 0) as total FROM habit_records
        WHERE user_id = ? AND record_date = ? AND type = 'water' AND status = 1
      `).get(userId, today).total || 0;
      if (total >= waterGoal) {
        const extraResults = taskService.updateTaskProgress(userId, 'drink_water_goal', 1);
        taskResults.push(...extraResults);
      }
    }

    const rewardMessages = taskResults.filter(t => t.reward_message).map(t => ({ name: t.name, message: t.reward_message }));
    return { ...result, task_results: taskResults, reward_messages: rewardMessages };
  });
}

function handleWeightRecord(userId, relatedId, weightValue) {
  return withTransaction(() => {
    const rewardResult = rewardForRecord(userId, 'record_body', relatedId);
    achievementService.checkWeightLossMilestone(userId);
    rewardReceiptService.checkWeightGoalReached(userId, parseFloat(weightValue));
    achievementService.checkAll(userId);
    return rewardResult;
  });
}

function getActionByPrecipitationType(recordType, subType = null, extractedData = null) {
  const rewardMap = {
    'diet_record': 'record_diet',
    'exercise_record': 'record_exercise',
    'body_data': 'record_body'
  };
  let action = rewardMap[recordType];
  if (recordType === 'habit') {
    action = subType === 'water' ? 'record_water' : `record_${subType || 'habit'}`;
  }
  return action;
}

function rewardForPrecipitationRecord(userId, recordType, subType = null, extractedData = null, relatedId = null) {
  return withTransaction(() => {
    const action = getActionByPrecipitationType(recordType, subType, extractedData);
    if (!action) return null;

    const isWeight = recordType === 'body_data' && subType === 'weight';
    let result = null;

    if (!isWeight) {
      let value = null;
      if (action === 'record_water') {
        const data = extractedData && typeof extractedData === 'object' ? extractedData : {};
        value = parseInt(data.value || data.water_ml || 0);
      }
      result = rewardForRecord(userId, action, relatedId, value);
    }

    // 体重记录统一走 handleWeightRecord，避免重复奖励
    if (isWeight) {
      const weightValue = extractedData && typeof extractedData === 'object'
        ? (extractedData.value || extractedData.weight)
        : null;
      if (weightValue !== null && weightValue !== undefined) {
        result = handleWeightRecord(userId, relatedId, weightValue);
      }
    }

    // 同步触发新手任务（如 first_diet / first_exercise / first_weight）
    if (action && ['record_diet', 'record_exercise', 'record_body'].includes(action)) {
      newbieTaskService.checkAction(userId, action);
    }

    achievementService.checkAll(userId);
    return result;
  });
}

module.exports = {
  rewardForRecord,
  handleWeightRecord,
  getActionByPrecipitationType,
  rewardForPrecipitationRecord
};
