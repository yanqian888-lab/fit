<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="名称 / Endpoint" clearable style="width:260px;" />
        <el-select v-model="query.role" placeholder="角色" clearable style="width:140px;">
          <el-option label="主用" value="primary" />
          <el-option label="备用" value="backup" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'ai_config:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="名称" width="160" />
        <el-table-column prop="provider" label="厂商" width="100" />
        <el-table-column prop="endpoint_id" label="Endpoint / Model" show-overflow-tooltip />
        <el-table-column prop="role" label="角色" width="90">
          <template #default="{ row }">
            <el-tag :type="row.role === 'primary' ? 'primary' : 'warning'">{{ row.role === 'primary' ? '主用' : '备用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="is_enabled" label="启用" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'ai_config:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'ai_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑 AI 配置' : '新增 AI 配置'" width="600px" :close-on-click-modal="false">
      <el-form :model="form" label-width="110px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：豆包-Helper" />
        </el-form-item>
        <el-form-item label="厂商">
          <el-input v-model="form.provider" placeholder="doubao / openai" />
        </el-form-item>
        <el-form-item label="Base URL">
          <el-input v-model="form.base_url" placeholder="https://ark.cn-beijing.volces.com/api/v3" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="form.api_key" type="password" show-password placeholder="留空表示不修改" />
        </el-form-item>
        <el-form-item label="Endpoint / Model" required>
          <el-input v-model="form.endpoint_id" placeholder="如 ep-2026xxxxxx-xxxxx" />
        </el-form-item>
        <el-form-item label="Temperature">
          <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="Max Tokens">
          <el-input-number v-model="form.max_tokens" :min="1" :max="16000" />
        </el-form-item>
        <el-form-item label="超时时间 (ms)">
          <el-input-number v-model="form.timeout_ms" :min="1000" :max="120000" :step="1000" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="form.role">
            <el-radio label="primary">主用</el-radio>
            <el-radio label="backup">备用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsAiConfigApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const loading = ref(false)
const list = ref([])
const query = ref({ keyword: '', role: '' })
const dialogVisible = ref(false)
const defaultForm = {
  name: '',
  provider: 'doubao',
  base_url: 'https://ark.cn-beijing.volces.com/api/v3',
  api_key: '',
  endpoint_id: '',
  temperature: 0.7,
  max_tokens: 1000,
  timeout_ms: 30000,
  role: 'primary',
  sort_order: 0,
  is_enabled: true
}
const form = ref({ ...defaultForm })

onMounted(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const res = await cmsAiConfigApi.list()
    const keyword = query.value.keyword.trim().toLowerCase()
    const role = query.value.role
    list.value = (res.data || []).filter(item => {
      if (role && item.role !== role) return false
      if (!keyword) return true
      return (item.name || '').toLowerCase().includes(keyword) || (item.endpoint_id || '').toLowerCase().includes(keyword)
    })
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = { keyword: '', role: '' }
  load()
}

function openDialog(row = null) {
  form.value = row ? { ...row, api_key: '' } : { ...defaultForm }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) {
      await cmsAiConfigApi.update(form.value.id, form.value)
    } else {
      await cmsAiConfigApi.create(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除该 AI 配置？', '提示', { type: 'warning' })
    await cmsAiConfigApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}
</script>
