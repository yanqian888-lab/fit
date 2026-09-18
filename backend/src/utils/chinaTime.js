/**
 * 东八区时间工具
 * 项目主要用户在中国，所有按天统计/时段判断/DND/每日重置统一用东八区。
 */

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

function getChinaNow() {
  return new Date(Date.now() + CHINA_OFFSET_MS);
}

function getChinaDateStr() {
  return getChinaNow().toISOString().split('T')[0];
}

/**
 * 东八区日期 ±N 天（负数往前），返回 YYYY-MM-DD
 */
function getChinaDateStrOffset(days = 0) {
  const d = getChinaNow();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function getChinaTimeStr() {
  const d = getChinaNow();
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function getChinaHour() {
  return getChinaNow().getUTCHours();
}

function getChinaDateTimeStr() {
  const d = getChinaNow();
  return d.toISOString().replace('Z', '').replace('T', ' ');
}

function getMsUntilChinaMidnight() {
  const now = getChinaNow();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow - now;
}

module.exports = {
  getChinaNow,
  getChinaDateStr,
  getChinaDateStrOffset,
  getChinaTimeStr,
  getChinaHour,
  getChinaDateTimeStr,
  getMsUntilChinaMidnight
};
