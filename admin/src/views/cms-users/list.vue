<template>
  <div class="card">
    <div class="search-bar">
      <el-button type="primary" @click="openDialog()">新增管理员</el-button>
    </div>
    <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="账号" />
      <el-table-column prop="nickname" label="昵称" />
      <el-table-column prop="role_name" label="角色" />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'">{{ row.status ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_login_at" label="最后登录" width="160" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="warning" @click="openPwd(row)">重置密码</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="form.id ? '编辑管理员' : '新增管理员'" width="500px">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
      <el-form-item label="账号" prop="username">
        <el-input v-model="form.username" :disabled="!!form.id" />
      </el-form-item>
      <el-form-item label="昵称" prop="nickname">
        <el-input v-model="form.nickname" />
      </el-form-item>
      <el-form-item label="角色" prop="role_id">
        <el-select v-model="form.role_id" style="width:100%;" :loading="rolesLoading">
          <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="密码" prop="password" v-if="!form.id">
        <el-input v-model="form.password" type="password" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio :label="1">正常</el-radio>
          <el-radio :label="0">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="save" :loading="saving">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="pwdVisible" title="重置密码" width="400px">
    <el-input v-model="newPassword" type="password" placeholder="新密码" />
    <template #footer>
      <el-button @click="pwdVisible = false">取消</el-button>
      <el-button type="primary" @click="resetPwd">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsUserApi } from '@/api/cms'

const loading = ref(false)
const saving = ref(false)
const rolesLoading = ref(false)
const list = ref([])
const roles = ref([])
const dialogVisible = ref(false)
const pwdVisible = ref(false)
const newPassword = ref('')
const currentRow = ref(null)
const formRef = ref()
const form = ref({ username: '', nickname: '', role_id: '', password: '', status: 1 })

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  role_id: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(async () => {
  await loadRoles()
  await load()
})

async function load() {
  loading.value = true
  try {
    const res = await cmsUserApi.list()
    list.value = res.data.list
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  rolesLoading.value = true
  try {
    const res = await cmsUserApi.roles()
    roles.value = res.data.map(r => ({ ...r, permissions: Array.isArray(r.permissions) ? r.permissions : JSON.parse(r.permissions || '[]') }))
  } finally {
    rolesLoading.value = false
  }
}

async function openDialog(row = null) {
  if (!roles.value.length) {
    await loadRoles()
  }
  form.value = row
    ? { ...row, password: '' }
    : { username: '', nickname: '', role_id: roles.value[0]?.id || '', password: '', status: 1 }
  dialogVisible.value = true
  formRef.value?.clearValidate()
}

async function save() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (form.value.id) {
      await cmsUserApi.update(form.value.id, { nickname: form.value.nickname, role_id: form.value.role_id, status: form.value.status })
    } else {
      await cmsUserApi.create(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

function openPwd(row) {
  currentRow.value = row
  newPassword.value = ''
  pwdVisible.value = true
}

async function resetPwd() {
  if (!newPassword.value || newPassword.value.length < 6) return ElMessage.warning('密码不少于6位')
  try {
    await cmsUserApi.resetPassword(currentRow.value.id, newPassword.value)
    ElMessage.success('重置成功')
    pwdVisible.value = false
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsUserApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}
</script>
