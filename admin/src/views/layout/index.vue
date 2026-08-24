<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">掉秤搭搭 CMS</div>
      <el-menu :default-active="activeMenu" router class="menu" background-color="#ffffff" text-color="#333" active-text-color="#8DBB77">
        <template v-for="item in menuList" :key="item.path">
          <el-sub-menu v-if="item.children && item.children.length" :index="item.path">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
              <el-icon v-if="child.icon"><component :is="child.icon" /></el-icon>
              <span>{{ child.title }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ pageTitle }}</div>
        <div class="header-right">
          <span>{{ auth.user.nickname || auth.user.username }}</span>
          <el-button link type="danger" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/auth'
import { routes } from '@/router/menu'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const menuList = computed(() => routes.filter(r => auth.hasPermission(r.perm)))
const pageTitle = computed(() => route.meta.title || '')

const activeMenu = computed(() => {
  const allPaths = []
  menuList.value.forEach(item => {
    allPaths.push(item.path)
    item.children?.forEach(child => allPaths.push(child.path))
  })
  if (allPaths.includes(route.path)) return route.path
  // 匹配父级菜单（如 /cms-users/roles -> /cms-users）
  const parent = allPaths
    .filter(p => route.path.startsWith(p) && p !== '/')
    .sort((a, b) => b.length - a.length)[0]
  return parent || route.path
})

function logout() {
  auth.logout()
  ElMessage.success('已退出')
  router.push('/login')
}
</script>

<style scoped>
.layout {
  height: 100vh;
}
.sidebar {
  background: #fff;
  border-right: 1px solid #eee;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
  border-bottom: 1px solid #f0f0f0;
}
.menu {
  border-right: none;
}
.header {
  background: var(--header-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eee;
}
.header-title {
  font-size: 18px;
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #666;
}
.main {
  padding: 0;
  background: var(--page-bg);
}
</style>
