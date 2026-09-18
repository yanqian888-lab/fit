<template>
  <div class="card">
    <div class="search-bar">
      <el-button type="primary" @click="openDialog()" v-perm="'cms_user:write'">新增角色</el-button>
    </div>
    <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="标识" />
      <el-table-column prop="description" label="说明" />
      <el-table-column prop="is_system" label="系统" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_system ? 'warning' : 'info'">{{ row.is_system ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="权限" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.permissions.join('，') }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)" v-perm="'cms_user:write'">编辑</el-button>
          <el-button link type="danger" @click="remove(row)" v-perm="'cms_user:write'">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="form.id ? '编辑角色' : '新增角色'" width="600px">
    <el-form :model="form" label-width="80px">
      <el-form-item label="标识"><el-input v-model="form.name" :disabled="form.is_system" /></el-form-item>
      <el-form-item label="说明"><el-input v-model="form.description" /></el-form-item>
      <el-form-item label="权限">
        <el-checkbox-group v-model="form.permissions">
          <el-checkbox v-for="p in allPermissions" :key="p" :label="p">{{ p }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsUserApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
// v-perm 自定义指令：用户无该权限码时直接移除按钮元素
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

// CMS 后台已注册的全部权限码清单，用于角色编辑页 checkbox 渲染
const allPermissions = [
  'dashboard:read',
  'announcement:read', 'announcement:write',
  'notification_channel:read', 'notification_channel:write',
  'popup_config:read', 'popup_config:write',
  'operation_stats:read',
  'milestone:read', 'milestone:write',
  'museum_config:read', 'museum_config:write',
  'prompt:read', 'prompt:write',
  'ai_config:read', 'ai_config:write',
  'trial_config:read', 'trial_config:write',
  'workout_config:read', 'workout_config:write',
  'template_config:read', 'template_config:write',
  'food_lib:read', 'food_lib:write',
  'exercise_lib:read', 'exercise_lib:write',
  'shop_config:read', 'shop_config:write',
  'event_config:read', 'event_config:write',
  'task_config:read', 'task_config:write',
  'achievement_config:read', 'achievement_config:write',
  'dialogue_config:read', 'dialogue_config:write',
  'pet_config:read', 'pet_config:write',
  'currency_config:read', 'currency_config:write',
  'log:read',
  'feedback:read', 'feedback:write',
  'app_user:read', 'app_user:write',
  'cms_user:read', 'cms_user:write',
  'app_config:read', 'app_config:write'
]

const loading = ref(false)
const list = ref([])
const dialogVisible = ref(false)
const form = ref({ name: '', description: '', permissions: [] })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsUserApi.roles()
    list.value = res.data.map(r => ({ ...r, permissions: Array.isArray(r.permissions) ? r.permissions : JSON.parse(r.permissions || '[]') }))
  } finally {
    loading.value = false
  }
}

function openDialog(row = null) {
  form.value = row ? { ...row, permissions: [...row.permissions] } : { name: '', description: '', permissions: [] }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) {
      await cmsUserApi.updateRole(form.value.id, form.value)
    } else {
      await cmsUserApi.createRole(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsUserApi.removeRole(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}
</script>
