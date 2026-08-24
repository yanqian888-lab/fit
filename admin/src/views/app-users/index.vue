<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="用户ID/昵称/手机号/账号" clearable style="width:220px;" />
        <el-select v-model="query.status" placeholder="状态" clearable style="width:120px;">
          <el-option label="正常" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openCreateDialog" v-perm="'app_user:write'">新增用户</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="user_id" label="用户ID" width="110" />
        <el-table-column prop="username" label="账号" width="110">
          <template #default="{ row }">
            {{ row.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="openid" label="OpenID" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.openid || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="130">
          <template #default="{ row }">
            {{ row.phone || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="gender_text" label="性别" width="80" />
        <el-table-column prop="age" label="年龄" width="80" />
        <el-table-column prop="height" label="身高(cm)" width="100" />
        <el-table-column prop="current_weight" label="当前体重" width="100" />
        <el-table-column prop="target_weight" label="目标体重" width="100" />
        <el-table-column prop="bmi" label="BMI" width="90" />
        <el-table-column prop="partner_name" label="搭子名称" width="120" />
        <el-table-column prop="mode_text" label="搭子模式" width="90" />
        <el-table-column prop="source_text" label="注册方式" width="100">
          <template #default="{ row }">
            <el-tag :type="row.source === 'wechat' ? 'success' : row.source === 'cms' ? 'warning' : 'info'">
              {{ row.source_text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="160" />
        <el-table-column prop="last_login_at" label="最近登录" width="160" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'">{{ row.status ? '正常' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/app-users/${row.id}`)">详情</el-button>
            <el-button link :type="row.status ? 'danger' : 'success'" @click="toggleStatus(row)" v-perm="'app_user:write'">
              {{ row.status ? '禁用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="deleteUser(row)" v-perm="'app_user:write'">注销</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <!-- 新增 C 端用户弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新增 C 端用户" width="500px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="账号">
          <el-input v-model="createForm.username" maxlength="10" placeholder="6-10位字母+数字组合（需同时包含）" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" type="password" maxlength="6" placeholder="6位初始密码" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="createForm.phone" maxlength="11" placeholder="11位手机号" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="createForm.nickname" placeholder="选填，默认“掉秤搭搭用户”" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCreate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsAppUserApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = ref({ keyword: '', status: '', page: 1, size: 20 })

const createDialogVisible = ref(false)
const createForm = ref({ username: '', password: '', phone: '', nickname: '' })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsAppUserApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = { keyword: '', status: '', page: 1, size: 20 }
  load()
}

function openCreateDialog() {
  createForm.value = { username: '', password: '', phone: '', nickname: '' }
  createDialogVisible.value = true
}

const USERNAME_REGEX = /^[a-zA-Z0-9]{6,10}$/
function validateUsernameCombo(username) {
  return USERNAME_REGEX.test(username) && /[a-zA-Z]/.test(username) && /[0-9]/.test(username)
}

async function saveCreate() {
  const { username, password, phone } = createForm.value
  if (!USERNAME_REGEX.test(username || '')) {
    return ElMessage.warning('请输入6-10位字母+数字账号')
  }
  if (!validateUsernameCombo(username)) {
    return ElMessage.warning('账号需同时包含字母和数字')
  }
  if (!password || password.length !== 6) {
    return ElMessage.warning('请输入6位密码')
  }
  if (!phone || phone.length !== 11) {
    return ElMessage.warning('请输入11位手机号')
  }
  try {
    await cmsAppUserApi.create(createForm.value)
    ElMessage.success('用户创建成功')
    createDialogVisible.value = false
    load()
  } catch (e) {
    // request 拦截器已展示错误提示
  }
}

async function toggleStatus(row) {
  const actionText = row.status ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${actionText}该用户？`, '提示', { type: 'warning' })
    await cmsAppUserApi.updateStatus(row.id, row.status ? 0 : 1)
    ElMessage.success('操作成功')
    load()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function deleteUser(row) {
  try {
    await ElMessageBox.confirm(`确认注销用户「${row.username || row.id}」？注销后将删除该用户所有数据，且不可恢复。`, '危险操作', { type: 'error' })
    await cmsAppUserApi.deleteUser(row.id)
    ElMessage.success('账号已注销')
    load()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}
</script>

<style scoped>
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
