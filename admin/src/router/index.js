import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/views/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '首页', icon: 'HomeFilled', perm: 'dashboard' } },
      { path: 'app-config', component: () => import('@/views/app-config/index.vue'), meta: { title: '应用配置', icon: 'Setting', perm: 'app_config:read' } },
      { path: 'app-config/protocol', component: () => import('@/views/agreement-config/index.vue'), meta: { title: '协议配置', icon: 'DocumentCopy', perm: 'app_config:read' } },
      { path: 'app-config/popup', component: () => import('@/views/popup-config/index.vue'), meta: { title: '弹窗广告管理', icon: 'Picture', perm: 'popup_config:read' } },
      { path: 'milestone-config', component: () => import('@/views/milestone-config/index.vue'), meta: { title: '里程碑文案', icon: 'Trophy', perm: 'milestone:read' } },
      { path: 'museum-config', component: () => import('@/views/museum-config/index.vue'), meta: { title: '博物馆入口', icon: 'Grid', perm: 'museum_config:read' } },
      { path: 'prompts', component: () => import('@/views/prompts/index.vue'), meta: { title: 'Prompt 管理', icon: 'MagicStick', perm: 'prompt:read' } },
      { path: 'ai-config', component: () => import('@/views/ai-config/index.vue'), meta: { title: 'AI 配置', icon: 'Cpu', perm: 'ai_config:read' } },
      { path: 'template-config', component: () => import('@/views/template-config/index.vue'), meta: { title: '模板消息', icon: 'ChatLineRound', perm: 'template_config:read' } },
      { path: 'app-users', component: () => import('@/views/app-users/index.vue'), meta: { title: 'C端用户', icon: 'UserFilled', perm: 'app_user:read' } },
      { path: 'feedbacks', component: () => import('@/views/feedbacks/index.vue'), meta: { title: '反馈管理', icon: 'Message', perm: 'feedback:read' } },
      { path: 'food-lib', component: () => import('@/views/food-lib/index.vue'), meta: { title: '公共食品库', icon: 'Food', perm: 'food_lib:read' } },
      { path: 'custom-food-audit', component: () => import('@/views/custom-food-audit/index.vue'), meta: { title: '自定义食物审核', icon: 'DocumentChecked', perm: 'food_lib:read' } },
      { path: 'exercise-lib', component: () => import('@/views/exercise-lib/index.vue'), meta: { title: '运动库', icon: 'Basketball', perm: 'exercise_lib:read' } },
      {
        path: 'cms-users',
        component: () => import('@/views/cms-users/index.vue'),
        meta: { title: '管理员', icon: 'Avatar', perm: 'cms_user:read' },
        children: [
          { path: '', name: 'CmsUserList', component: () => import('@/views/cms-users/list.vue'), meta: { title: '管理员列表', perm: 'cms_user:read' } },
          { path: 'roles', name: 'CmsRoles', component: () => import('@/views/cms-users/roles.vue'), meta: { title: '角色权限', perm: 'cms_user:read' } }
        ]
      },
      { path: 'logs', component: () => import('@/views/logs/index.vue'), meta: { title: '操作日志', icon: 'Document', perm: 'log:read' } },
      { path: 'trial-config', component: () => import('@/views/trial-config/index.vue'), meta: { title: '试用权限', icon: 'Lock', perm: 'trial_config:read' } }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLogin) {
    return next('/login')
  }
  if (to.path === '/login' && auth.isLogin) {
    return next('/')
  }
  next()
})

export default router
