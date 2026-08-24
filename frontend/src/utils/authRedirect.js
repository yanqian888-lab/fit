import { userApi } from '../api';

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
 * 登录/注册成功后的统一跳转
 * - 有 setup_data 时先保存，然后去首页
 * - 否则判断基础资料是否完善，不完善则去完善信息页
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

  // 用户已在完善信息页主动跳过过，不再每次登录强制拦截（可在"我的-资料"里补全）
  if (!isProfileComplete(user) && !uni.getStorageSync('profile_setup_skipped')) {
    uni.redirectTo({ url: '/pages/profile/setup' });
    return;
  }

  // 资料完整但未选择搭子模式/完成引导，先去选择模式页
  // 优先以服务端 settings 为准，避免本地缓存被清除后重复进入引导
  const settings = user?.settings || uni.getStorageSync('settings') || {};
  if (!settings.guide_completed) {
    uni.redirectTo({ url: '/pages/partner/select-mode' });
    return;
  }

  uni.switchTab({ url: '/pages/index/index' });
}
