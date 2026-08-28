-- ========================================================
-- CMS 超级管理员重置脚本
-- 用途：确保线上/任意环境存在可登录的 admin888 超级管理员
-- 执行后账号：admin888 / 密码：admin123
-- 注意：此脚本会覆盖 admin888 的现有密码，请谨慎使用
-- ========================================================

-- 1. 确保 superadmin 角色存在（拥有全部权限）
INSERT OR IGNORE INTO cms_roles (name, description, permissions, is_system)
VALUES (
  'superadmin',
  '超级管理员',
  '["dashboard","app_config:read","app_config:write","template_config:read","template_config:write","food_lib:read","food_lib:write","exercise_lib:read","exercise_lib:write","app_user:read","app_user:write","feedback:read","feedback:write","cms_user:read","cms_user:write","prompt:read","prompt:write","ai_config:read","ai_config:write","milestone:read","milestone:write","museum_config:read","museum_config:write","trial_config:read","trial_config:write","trial_whitelist:read","trial_whitelist:write","trial_log:read","log:read","popup_config:read","popup_config:write","popup_whitelist:read","popup_whitelist:write","popup_route:read","popup_route:write","popup_global:read","popup_global:write","popup_stats:read","announcement:read","announcement:write","notification_channel:read","notification_channel:write","operation_stats:read","pet_config:read","pet_config:write","currency_config:read","currency_config:write","shop_config:read","shop_config:write","event_config:read","event_config:write","task_config:read","task_config:write","achievement_config:read","achievement_config:write","dialogue_config:read","dialogue_config:write","workout_config:read","workout_config:write"]',
  1
);

-- 2. 如果 admin888 已存在，重置其密码为 admin123 并启用账号
UPDATE cms_users
SET password_hash = '$2b$10$OmBRFajhkvdR8btDrEfp8eqioJBeTov2HKOZcXzeQgFeh3yG3KvOu',
    status = 1,
    role_id = (SELECT id FROM cms_roles WHERE name = 'superadmin' LIMIT 1),
    updated_at = CURRENT_TIMESTAMP
WHERE username = 'admin888';

-- 3. 如果 admin888 不存在，则创建该超级管理员
INSERT INTO cms_users (username, password_hash, nickname, role_id, status)
SELECT
  'admin888',
  '$2b$10$OmBRFajhkvdR8btDrEfp8eqioJBeTov2HKOZcXzeQgFeh3yG3KvOu',
  '超级管理员',
  (SELECT id FROM cms_roles WHERE name = 'superadmin' LIMIT 1),
  1
WHERE NOT EXISTS (SELECT 1 FROM cms_users WHERE username = 'admin888');
