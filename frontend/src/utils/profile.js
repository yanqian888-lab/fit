/**
 * 用户资料完整性判断（主包共享工具）
 * 注意：该函数同时被 main.js（主包，资料门禁）与 pages/login 分包（登录跳转）使用，
 * 必须放在主包内——主包代码不能同步 require 分包模块。
 */

/**
 * 判断用户基础资料是否已完善
 * @param {object|null} user 用户对象（含 profile 扩展字段）
 * @returns {boolean}
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
