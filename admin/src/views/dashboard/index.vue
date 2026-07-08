<template>
  <div class="page-container">
    <div class="card">
      <h3>欢迎使用减肥搭子 CMS</h3>
      <p style="color:#666;margin-top:12px;">当前账号：{{ auth.user.nickname || auth.user.username }}（{{ auth.user.username }}）</p>
      <p style="color:#666;">
        权限：
        <el-tag v-for="p in auth.permissions" :key="p" size="small" style="margin-right:8px;">
          {{ permissionMap[p] || p }}
        </el-tag>
        <span v-if="!auth.permissions.length">-</span>
      </p>
    </div>
    <el-row :gutter="16">
      <el-col :span="6"><el-statistic title="C端用户数" :value="stats.users" /></el-col>
      <el-col :span="6"><el-statistic title="今日反馈" :value="stats.feedbacks" /></el-col>
      <el-col :span="6"><el-statistic title="食品库" :value="stats.foods" /></el-col>
      <el-col :span="6"><el-statistic title="运动库" :value="stats.exercises" /></el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'
import { cmsAppUserApi, cmsFeedbackApi, cmsFoodApi, cmsExerciseApi } from '@/api/cms'

const auth = useAuthStore()
const stats = ref({ users: 0, feedbacks: 0, foods: 0, exercises: 0 })

const permissionMap = {
  dashboard: '首页',
  'app_config:read': '应用配置查看',
  'app_config:write': '应用配置编辑',
  'template_config:read': '模板消息查看',
  'template_config:write': '模板消息编辑',
  'app_user:read': 'C端用户查看',
  'app_user:write': 'C端用户编辑',
  'feedback:read': '反馈管理查看',
  'feedback:write': '反馈管理编辑',
  'food_lib:read': '食品库查看',
  'food_lib:write': '食品库编辑',
  'exercise_lib:read': '运动库查看',
  'exercise_lib:write': '运动库编辑',
  'cms_user:read': '管理员/角色查看',
  'cms_user:write': '管理员/角色编辑',
  'log:read': '操作日志'
}

onMounted(async () => {
  try {
    const [u, f, fd, ex] = await Promise.all([
      cmsAppUserApi.list({ size: 1 }),
      cmsFeedbackApi.list({ size: 1 }),
      cmsFoodApi.list({ size: 1 }),
      cmsExerciseApi.list({ size: 1 })
    ])
    stats.value = {
      users: u.data.pagination.total,
      feedbacks: f.data.pagination.total,
      foods: fd.data.pagination.total,
      exercises: ex.data.pagination.total
    }
  } catch (e) {
    console.error(e)
  }
})
</script>
