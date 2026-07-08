/**
 * 日期工具
 */

/**
 * 根据创建时间计算已使用（坚持）天数
 * 按本地日历天计算，包含创建当天；创建次日即为第 2 天
 */
function getUsedDays(createdAt) {
  if (!createdAt) return 1;

  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return 1;

  const now = new Date();

  // 只比较日期部分，忽略时分秒
  const createdDay = new Date(
    created.getFullYear(), created.getMonth(), created.getDate()
  ).getTime();
  const nowDay = new Date(
    now.getFullYear(), now.getMonth(), now.getDate()
  ).getTime();

  const days = Math.floor((nowDay - createdDay) / 86400000) + 1;
  return days < 1 ? 1 : days;
}

module.exports = {
  getUsedDays
};
