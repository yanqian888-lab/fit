<template>
  <div class="page-container">
    <div class="card current-user-card" v-if="auth.user.id">
      <div class="user-main">
        <el-icon size="40" color="var(--primary)"><UserFilled /></el-icon>
        <div class="user-meta">
          <div class="user-name">
            {{ auth.user.nickname || auth.user.username }}
            <el-tag size="small" type="success">{{ currentRoleName }}</el-tag>
          </div>
          <div class="user-account">账号：{{ auth.user.username }}</div>
        </div>
      </div>
      <div class="user-extra">
        <span>状态：<el-tag size="small" type="success">正常</el-tag></span>
        <span>最后登录：{{ auth.user.last_login_at || '-' }}</span>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="border-card" class="cms-tabs card" @tab-change="onTabChange">
      <el-tab-pane label="管理员列表" name="list" />
      <el-tab-pane label="角色权限" name="roles" />
    </el-tabs>

    <router-view />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UserFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import { cmsUserApi } from '@/api/cms'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const roles = ref([])
const activeTab = ref(route.path === '/cms-users/roles' ? 'roles' : 'list')

const currentRoleName = computed(() => {
  const role = roles.value.find(r => r.id === auth.user.role_id)
  if (!role) return '-'
  if (role.name === 'superadmin') return '超级管理员'
  return role.description || role.name
})

onMounted(async () => {
  auth.fetchProfile().catch(() => {})
  await loadRoles()
})

watch(
  () => route.path,
  (path) => {
    activeTab.value = path === '/cms-users/roles' ? 'roles' : 'list'
  }
)

function onTabChange(name) {
  router.push(name === 'roles' ? '/cms-users/roles' : '/cms-users')
}

async function loadRoles() {
  try {
    const res = await cmsUserApi.roles()
    roles.value = res.data.map(r => ({ ...r, permissions: Array.isArray(r.permissions) ? r.permissions : JSON.parse(r.permissions || '[]') }))
  } catch (e) {
    console.error(e)
  }
}
</script>

<style scoped>
.current-user-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.user-main {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user-name {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-account {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}
.user-extra {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: #666;
}
.cms-tabs {
  padding: 0;
}
.cms-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.cms-tabs :deep(.el-tabs__content) {
  display: none;
}
</style>
