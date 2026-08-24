<template>
  <div class="page-container">
    <h2 class="page-title">通知渠道</h2>
    <div class="card">
      <el-table :data="list" border v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="channel_name" label="渠道名称" />
        <el-table-column prop="channel_key" label="渠道标识" width="140" />
        <el-table-column prop="is_enabled" label="启用状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" show-overflow-tooltip />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-perm="'notification_channel:write'" type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="编辑通知渠道" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="渠道名称">
          <el-input v-model="form.channel_name" disabled />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.is_enabled" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cmsNotificationChannelApi } from '../../api/cms'

const list = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const editId = ref(null)

const form = reactive({
  channel_name: '',
  is_enabled: true,
  description: '',
  config: {},
  sort_order: 0
})

async function loadData() {
  loading.value = true
  try {
    const res = await cmsNotificationChannelApi.list()
    list.value = res.data?.list || []
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  editId.value = row.id
  Object.assign(form, {
    channel_name: row.channel_name,
    is_enabled: !!row.is_enabled,
    description: row.description || '',
    config: row.config || {},
    sort_order: row.sort_order || 0
  })
  dialogVisible.value = true
}

async function save() {
  try {
    await cmsNotificationChannelApi.update(editId.value, {
      is_enabled: form.is_enabled,
      description: form.description,
      config: form.config,
      sort_order: form.sort_order
    })
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } catch (e) {}
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 20px;
}
.page-title {
  margin-bottom: 16px;
  font-size: 20px;
  font-weight: 600;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
</style>
