<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="文本内容" clearable style="width:220px;" />
        <el-input v-model="query.scene" placeholder="场景" clearable style="width:160px;" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'dialogue_config:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="scene" label="场景" />
        <el-table-column prop="text" label="文本" show-overflow-tooltip />
        <el-table-column prop="weight" label="权重" width="80" />
        <el-table-column prop="probability" label="概率" width="80" />
        <el-table-column prop="is_enabled" label="启用" width="80">
          <template #default="{ row }"><el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '是' : '否' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'dialogue_config:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'dialogue_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑对话' : '新增对话'" width="600px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="场景"><el-input v-model="form.scene" /></el-form-item>
        <el-form-item label="文本"><el-input v-model="form.text" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="权重"><el-input-number v-model="form.weight" :min="0" /></el-form-item>
        <el-form-item label="概率"><el-input-number v-model="form.probability" :min="0" :max="1" :precision="2" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.is_enabled" /></el-form-item>
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
import { cmsDialogueConfigApi } from '@/api/cms'
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
const query = ref({ keyword: '', scene: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref({ scene: '', text: '', weight: 0, probability: 1, is_enabled: true })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsDialogueConfigApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally { loading.value = false }
}

function reset() {
  query.value = { keyword: '', scene: '', page: 1, size: 20 }
  load()
}

function openDialog(row = null) {
  form.value = row ? { ...row } : { scene: '', text: '', weight: 0, probability: 1, is_enabled: true }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) await cmsDialogueConfigApi.update(form.value.id, form.value)
    else await cmsDialogueConfigApi.create(form.value)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsDialogueConfigApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}
</script>

<style scoped>
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
