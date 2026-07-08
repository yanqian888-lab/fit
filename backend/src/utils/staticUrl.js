/**
 * 根据请求信息生成可被外部访问的静态资源完整 URL
 * 支持反向代理透传的 X-Forwarded-Proto / X-Forwarded-Host
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost';
  return `${protocol}://${host}`;
}

function staticUrl(req, relativePath) {
  if (!relativePath) return '';
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return getBaseUrl(req) + path;
}

module.exports = { getBaseUrl, staticUrl };
