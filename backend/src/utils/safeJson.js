/**
 * 安全 JSON 解析/序列化工具
 * 避免数据库字段异常或脏数据导致进程崩溃
 */
function safeJsonParse(str, fallback = null) {
  if (str === null || str === undefined || str === '') return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

function safeJsonStringify(obj, fallback = '{}') {
  if (obj === undefined || obj === null) return fallback;
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return fallback;
  }
}

module.exports = { safeJsonParse, safeJsonStringify };
