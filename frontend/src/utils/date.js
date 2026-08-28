/**
 * 日期/时间工具
 */

export function formatDate(dateStr, format = 'YYYY-MM-DD') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const monthNum = d.getMonth() + 1;
  const dayNum = d.getDate();
  let result = format.replace('YYYY', year);
  result = result.replace('MM', month).replace('DD', day);
  result = result.replace('M', monthNum).replace('D', dayNum);
  return result;
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getRelativeDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - d) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === -1) return '明天';
  if (diff > 1 && diff < 7) return `${diff}天前`;
  return formatDate(dateStr);
}

export function getToday() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 判断日期字符串是否为未来日期（大于今天）
 * @param {string} dateStr 格式 YYYY-MM-DD
 * @returns {boolean}
 */
export function isFutureDate(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d.getTime() > today.getTime();
}

/**
 * 如果日期是未来日期，返回今天；否则返回原日期
 * @param {string} dateStr 格式 YYYY-MM-DD
 * @returns {string}
 */
export function clampFutureDate(dateStr) {
  if (!dateStr) return getToday();
  return isFutureDate(dateStr) ? getToday() : dateStr;
}
