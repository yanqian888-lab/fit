import { userApi } from '../api';
import popupManager from './popupManager';

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

  const setupData = JSON.parse(setupDataRaw);
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
  // 重新拉取弹窗配置（登录态可能刚刚才生效）
  popupManager.init();

  const hasSetupData = await saveSetupDataIfExists();
  await userStore.fetchUserInfo();
  const user = userStore.userInfo;

  if (hasSetupData || isProfileComplete(user)) {
    uni.switchTab({ url: '/pages/index/index' });
  } else {
    uni.redirectTo({ url: '/pages/profile/setup' });
  }
}
