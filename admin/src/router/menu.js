export const routes = [
  { path: '/dashboard', title: '首页', icon: 'HomeFilled', perm: 'dashboard' },
  {
    path: '/app-config',
    title: '应用配置',
    icon: 'Setting',
    perm: 'app_config:read',
    children: [
      { path: '/app-config', title: '应用配置', icon: 'Setting', perm: 'app_config:read' },
      { path: '/app-config/protocol', title: '协议配置', icon: 'DocumentCopy', perm: 'app_config:read' },
      { path: '/app-config/popup', title: '弹窗广告管理', icon: 'Picture', perm: 'popup_config:read' },
      { path: '/template-config', title: '模板消息', icon: 'ChatLineRound', perm: 'template_config:read' },
      { path: '/food-lib', title: '公共食品库', icon: 'Food', perm: 'food_lib:read' },
      { path: '/custom-food-audit', title: '自定义食物审核', icon: 'DocumentChecked', perm: 'food_lib:read' },
      { path: '/exercise-lib', title: '运动库', icon: 'Basketball', perm: 'exercise_lib:read' },
      { path: '/milestone-config', title: '里程碑文案', icon: 'Trophy', perm: 'milestone:read' },
      { path: '/museum-config', title: '博物馆入口', icon: 'Grid', perm: 'museum_config:read' }
    ]
  },
  {
    path: '/ai-config',
    title: 'AI 配置',
    icon: 'Cpu',
    perm: 'ai_config:read',
    children: [
      { path: '/ai-config', title: 'AI 配置', icon: 'Cpu', perm: 'ai_config:read' },
      { path: '/prompts', title: 'Prompt 管理', icon: 'MagicStick', perm: 'prompt:read' }
    ]
  },
  { path: '/app-users', title: 'C端用户', icon: 'UserFilled', perm: 'app_user:read' },
  { path: '/trial-config', title: '试用权限', icon: 'Lock', perm: 'trial_config:read' },
  { path: '/feedbacks', title: '反馈管理', icon: 'Message', perm: 'feedback:read' },
  { path: '/cms-users', title: '管理员', icon: 'Avatar', perm: 'cms_user:read' },
  { path: '/logs', title: '操作日志', icon: 'Document', perm: 'log:read' }
]
