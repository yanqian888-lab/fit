import { userApi } from '../api';
import { safeSwitchTab } from './safeSwitchTab';

/* ………… 中间 isProfileComplete / saveSetupDataIfExists / isStaleReturning 函数保持不变 ………… */

/**
 * 判断用户基础资料是否已完善
 */
export function isProfileComplete(user) {
  if (!user) return false;
  const profile = user.profile || {};
  return !!(
    user.gender &&
    user.birth_date &&
    user.height &&
    profile.current_weight &&
    profile.target_weight &&
    profile.target_date
  );
}

/**
 * 保存游客阶段填写的 setup_data（如果有）
 */
async function saveSetupDataIfExists() {
  const setupDataRaw = uni.getStorageSync('setup_data');
  if (!setupDataRaw) return false;

  let setupData;
  try {
    setupData = JSON.parse(setupDataRaw);
  } catch (e) {
    console.error('[authRedirect] setup_data 解析失败，已清除:', e);
    uni.removeStorageSync('setup_data');
    return false;
  }

  try {
    await userApi.updateMe({
      nickname: setupData.nickname,
      gender: setupData.gender,
      birth_date: setupData.birth_date,
      height: setupData.height
    });
    await userApi.updateProfile({
      initial_weight: setupData.initial_weight,
      current_weight: setupData.current_weight,
      target_weight: setupData.target_weight,
      target_date: setupData.target_date
    });
    uni.removeStorageSync('setup_data');
    return true;
  } catch (err) {
    console.error('[authRedirect] 同步 setup_data 失败:', err);
    return false;
  }
}

/**
 * 沉睡用户判定：超过 90 天未登录的老用户
 * 优先用登录响应里的 stale_returning 标记（按登录前的 last_login 计算）；
 * token 续期场景用 /users/me 的 last_login_at（该字段仅在真实登录时更新）判断
 */
const STALE_DAYS = 90;
export function isStaleReturning(user) {
  if (!user) return false;
  if (user.stale_returning) return true;
  // 本次登录的沉睡标记（登录响应落盘，fetchUserInfo 覆盖 userInfo 后仍有效）
  if (uni.getStorageSync('stale_returning') === 1) return true;
  if (!user.last_login_at) return false;
  const t = new Date(String(user.last_login_at).replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) return false;
  return Date.now() - t > STALE_DAYS * 86400000;
}

/**
 * 登录/注册成功后的统一跳转
 * - 有 setup_data 时先保存，然后去首页
 * - 新用户（资料未完善）：走新用户流程（完善信息无跳过 → 选搭子模式 → 首页搭子分析）
 * - 老用户（90 天内活跃）：直接进入首页，不走新用户流程
 * - 沉睡老用户（90 天+ 未登录）：再走新用户流程（带入历史信息、右上角可跳过，修改后同步更新并重新分析）
 */
export async function handlePostAuthRedirect(userStore) {
  const hasSetupData = await saveSetupDataIfExists();
  
  // 登录后获取用户信息时跳过 401 重定向，避免死循环
  // 如果获取用户信息失败，使用登录返回的用户数据
  let user = userStore.userInfo;
  try {
    const fetchedUser = await userStore.fetchUserInfo(true);
    if (fetchedUser) {
      user = fetchedUser;
    }
  } catch (e) {
    console.warn('[authRedirect] 获取用户信息失败，使用登录返回的数据');
  }

  // 新用户/资料未完善：完善信息页（无跳过；历史跳过标记仅对沉睡用户生效）
  if (!isProfileComplete(user) && !uni.getStorageSync('profile_setup_skipped')) {
    // 加空 fail 兜底：防止并行跳转被打断时，微信 3.17.1+ 灰度基础库 fail 回调 undefined 触发 SDK 内部默认 errMsg 访问崩溃
    uni.redirectTo({ url: '/pages/profile/setup', fail: () => {} });
    return;
  }

  // 沉睡老用户：再走新用户流程（预填历史信息、可跳过）
  if (isStaleReturning(user) && !uni.getStorageSync('profile_setup_skipped')) {
    uni.redirectTo({ url: '/pages/profile/setup?from=stale', fail: () => {} });
    return;
  }

  // 资料完整但未选择搭子模式/完成引导，先去选择模式页
  // 优先以服务端 settings 为准，避免本地缓存被清除后重复进入引导
  const settings = user?.settings || uni.getStorageSync('settings') || {};
  if (!settings.guide_completed) {
    uni.redirectTo({ url: '/pages/partner/select-mode', fail: () => {} });
    return;
  }

  // 资料完整且已完成引导：safeSwitchTab 跳首页（命中基础库 bug 自动 blank 桥接，不卡死）
  safeSwitchTab('/pages/index/index');
}
