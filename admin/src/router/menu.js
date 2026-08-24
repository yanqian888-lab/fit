export const routes = [
  { path: '/dashboard', title: '首页', icon: 'HomeFilled', perm: 'dashboard' },
  { path: '/operation-stats', title: '运营数据', icon: 'DataLine', perm: 'operation_stats:read' },
  {
    path: '/operation',
    title: '运营内容',
    icon: 'Bell',
    perm: 'announcement:read',
    children: [
      { path: '/operation/announcements', title: '公告管理', icon: 'Notification', perm: 'announcement:read' },
      { path: '/operation/notification-channels', title: '通知渠道', icon: 'Connection', perm: 'notification_channel:read' },
      { path: '/operation/popup', title: '弹窗广告管理', icon: 'Picture', perm: 'popup_config:read' }
    ]
  },
  {
    path: '/app-config',
    title: '应用配置',
    icon: 'Setting',
    perm: 'app_config:read',
    children: [
      { path: '/app-config/protocol', title: '协议配置', icon: 'DocumentCopy', perm: 'app_config:read' },
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
  {
    path: '/companion-config',
    title: '陪伴系统',
    icon: 'Sunny',
    perm: 'pet_config:read',
    children: [
      { path: '/pet-config', title: '宠物配置', icon: 'Stamp', perm: 'pet_config:read' },
      { path: '/currency-config', title: '货币配置', icon: 'Coin', perm: 'currency_config:read' },
      { path: '/shop-config', title: '商店配置', icon: 'Goods', perm: 'shop_config:read' },
      { path: '/event-config', title: '事件配置', icon: 'Star', perm: 'event_config:read' },
      { path: '/task-config', title: '任务配置', icon: 'List', perm: 'task_config:read' },
      { path: '/achievement-config', title: '成就配置', icon: 'Trophy', perm: 'achievement_config:read' },
      { path: '/dialogue-config', title: '对话配置', icon: 'ChatLineSquare', perm: 'dialogue_config:read' }
    ]
  },
  { path: '/app-users', title: 'C端用户', icon: 'UserFilled', perm: 'app_user:read' },
  { path: '/trial-config', title: '试用权限', icon: 'Lock', perm: 'trial_config:read' },
  { path: '/feedbacks', title: '反馈管理', icon: 'Message', perm: 'feedback:read' },
  { path: '/cms-users', title: '管理员', icon: 'Avatar', perm: 'cms_user:read' },
  { path: '/logs', title: '操作日志', icon: 'Document', perm: 'log:read' }
]
