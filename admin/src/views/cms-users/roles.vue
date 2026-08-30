<template>
  <div class="card">
    <div class="search-bar">
      <el-button type="primary" @click="openDialog()">新增角色</el-button>
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
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
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

const allPermissions = [
  'dashboard',
  'app_config:read', 'app_config:write',
  'template_config:read', 'template_config:write',
  'app_user:read', 'app_user:write',
  'feedback:read', 'feedback:write',
  'food_lib:read', 'food_lib:write',
  'exercise_lib:read', 'exercise_lib:write',
  'cms_user:read', 'cms_user:write',
  'log:read',
  'pet_config:read', 'pet_config:write',
  'currency_config:read', 'currency_config:write',
  'shop_config:read', 'shop_config:write',
  'event_config:read', 'event_config:write',
  'task_config:read', 'task_config:write',
  'achievement_config:read', 'achievement_config:write',
  'dialogue_config:read', 'dialogue_config:write'
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
