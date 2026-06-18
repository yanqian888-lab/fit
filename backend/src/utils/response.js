/**
 * 统一响应工具
 */
function success(data = null, message = 'success') {
  return { code: 0, message, data };
}

function error(message = 'error', code = 500, data = null) {
  return { code, message, data };
}

module.exports = {
  success,
  error
};
