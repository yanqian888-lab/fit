/**
 * 根据请求信息生成可被外部访问的静态资源完整 URL
 * 支持反向代理透传的 X-Forwarded-Proto / X-Forwarded-Host
 * 注意：默认协议用 https——本服务生产环境始终在 nginx HTTPS 反代之后，
 * 若转发头缺失（未配置 X-Forwarded-Proto）拼出 http:// 绝对 URL，
 * 微信小程序真机会拒绝加载 http 图片导致空白（H5 混合内容也会被拦截）
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost';
  return `${protocol}://${host}`;
}

function staticUrl(req, relativePath) {
  if (!relativePath) return '';
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return getBaseUrl(req) + path;
}

module.exports = { getBaseUrl, staticUrl };
