/**
 * 「H5 链接 → 小程序内部路由」归一化工具（确保小程序提审时核心内容都走原生页面，不依赖 web-view 承载主要业务）
 *
 * 使用场景：运营/弹窗/公告/消息中心配置跳转时，可能填了 H5 绝对路径（如 https://fit.mianyan.xin/h5/pages/shop/index）
 * 这里先尝试解析并映射成小程序内部路由（/pages/shop/index），匹配成功直接 navigateTo 原生页；
 * 匹配失败（真正的外部链接）再兜底走 web-view + 业务域名白名单校验。
 */

/** 可映射的 H5 路径前缀 */
const H5_PATH_PREFIX = [
  '/h5/pages/',
  '/h5/',
  '/test-h5/pages/',
  '/test-h5/',
  '/pages/',
];

/** 小程序合法内部路由白名单（与 pages.json 保持一致，防运营填错路径跳到未知原生页） */
const INTERNAL_ROUTE_WHITELIST = new Set([
  '/pages/index/index',
  '/pages/pet/index',
  '/pages/pet/currency-detail',
  '/pages/chat/settings',
  '/pages/record/index',
  '/pages/record/diet-detail',
  '/pages/record/add-food',
  '/pages/record/create-food',
  '/pages/record/food-detail',
  '/pages/record/habit',
  '/pages/record/mood',
  '/pages/record/exercise-detail',
  '/pages/record/add-exercise',
  '/pages/record/body-data',
  '/pages/museum/index',
  '/pages/museum/diary',
  '/pages/museum/diary-generate',
  '/pages/museum/diary-detail',
  '/pages/workout/session',
  '/pages/museum/milestones',
  '/pages/museum/recipes',
  '/pages/museum/insights',
  '/pages/museum/item-edit',
  '/pages/museum/compare',
  '/pages/museum/photo-upload',
  '/pages/museum/recipe-detail',
  '/pages/museum/methods',
  '/pages/login/index',
  '/pages/register/index',
  '/pages/user/index',
  '/pages/user/profile',
  '/pages/user/data-manage',
  '/pages/user/achievement',
  '/pages/tasks/index',
  '/pages/shop/index',
  '/pages/inventory/index',
  '/pages/user/notifications',
  '/pages/user/messages',
  '/pages/user/about',
  '/pages/user/privacy',
  '/pages/user/agreement',
  '/pages/user/help',
  '/pages/user/help-detail',
  '/pages/user/feedback',
  '/pages/user/delete-account-agreement',
  '/pages/onboarding/index',
  '/pages/onboarding/tasks',
  '/pages/profile/setup',
  '/pages/partner/select-mode',
  '/pages/partner/settings',
  '/pages/guide/feature',
]);

/** 允许使用 web-view 承载的域名白名单（小程序后台「业务域名」必须同时配置） */
const WEBVIEW_DOMAIN_WHITELIST = new Set([
  'fit.mianyan.xin',
  'api.fit.mianyan.xin',
]);

/**
 * 将 H5 绝对/相对路径转成小程序内部路由（如匹配不到返回 null）
 * @param {string} rawUrl 运营填入的 jump_url
 * @returns {{ url: string } | null}
 */
export function normalizeToInternalRoute(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();

  // 1. 已经是 /pages/... 这种内部路由直接校验白名单返回
  if (url.startsWith('/pages/')) {
    const clean = url.split('?')[0].split('#')[0];
    return INTERNAL_ROUTE_WHITELIST.has(clean) ? { url } : null;
  }

  // 2. 剥离 https://域名/前缀 + h5 test-h5 前缀
  let pathname = url;
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      // 如果域名不是 fit.mianyan.xin 体系的，直接不映射到内部路由（防错跳），让外层走 web-view 白名单校验
      if (!WEBVIEW_DOMAIN_WHITELIST.has(host)) return null;
      pathname = u.pathname + u.search + u.hash;
    }
  } catch (e) {
    return null;
  }

  // 3. 依次剥离已知的 H5 发布目录前缀，尝试拿到 /pages/xxx/xxx
  for (const prefix of H5_PATH_PREFIX) {
    if (pathname.startsWith(prefix)) {
      const rest = pathname.slice(prefix.length);
      const candidate = `/pages/${rest}`;
      const clean = candidate.split('?')[0].split('#')[0];
      if (INTERNAL_ROUTE_WHITELIST.has(clean)) return { url: candidate };
    }
  }
  return null;
}

/**
 * 判断某个 H5 URL 是否允许通过 web-view 承载（业务域名白名单校验 + 非核心业务页判断）
 * 我们要求：核心业务（登录、记录、聊天、搭搭、商城、背包、个人中心、记录博物馆）一律走小程序原生页
 * web-view 只能承载「帮助中心外链 / 运营临时活动页 / 第三方协议」这类边角内容
 * @param {string} url
 * @returns {boolean}
 */
export function isWebViewAllowed(url) {
  if (!url) return false;
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (!WEBVIEW_DOMAIN_WHITELIST.has(host)) return false;
    const path = u.pathname.toLowerCase();
    // 核心业务路径严格禁止落到 web-view（提审红线）
    const forbiddenKeywords = [
      '/pages/record',
      '/pages/pet',
      '/pages/shop',
      '/pages/index',
      '/pages/login',
      '/pages/museum',
      '/pages/workout',
      '/pages/inventory',
      '/pages/user/index',
      '/pages/chat',
      '/pages/tasks',
    ];
    return !forbiddenKeywords.some((kw) => path.includes(kw));
  } catch (e) {
    return false;
  }
}
