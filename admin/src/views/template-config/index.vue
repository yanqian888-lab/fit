<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-select v-model="query.type" placeholder="类型" clearable style="width:140px;">
          <el-option v-for="t in types" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="query.mode" placeholder="模式" clearable style="width:140px;">
          <el-option v-for="m in modes" :key="m" :label="m" :value="m" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="关键词" clearable style="width:220px;" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'template_config:write'">新增</el-button>
        <el-button type="warning" @click="seed" v-perm="'template_config:write'">重置默认</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="template_type" label="类型" width="120" />
        <el-table-column prop="mode" label="模式" width="120" />
        <el-table-column prop="content" label="内容" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序" width="90" />
        <el-table-column prop="is_enabled" label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'template_config:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'template_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑模板' : '新增模板'" width="600px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="form.template_type" style="width:100%;">
            <el-option v-for="t in types" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="模式">
          <el-select v-model="form.mode" style="width:100%;">
            <el-option v-for="m in modes" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" />
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
import { cmsTemplateApi } from '@/api/cms'
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
const types = ref([])
const modes = ref([])
const query = ref({ type: '', mode: '', keyword: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref({ template_type: '', mode: '', content: '', sort_order: 0, is_enabled: true })

onMounted(async () => {
  const res = await cmsTemplateApi.types()
  types.value = res.data.types
  modes.value = res.data.modes
  await load()
})

async function load() {
  loading.value = true
  try {
    const res = await cmsTemplateApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = { type: '', mode: '', keyword: '', page: 1, size: 20 }
  load()
}

function openDialog(row = null) {
  form.value = row ? { ...row } : { template_type: types.value[0] || '', mode: modes.value[0] || '', content: '', sort_order: 0, is_enabled: true }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) {
      await cmsTemplateApi.update(form.value.id, form.value)
    } else {
      await cmsTemplateApi.create(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsTemplateApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}

async function seed() {
  try {
    await ElMessageBox.confirm('确认重置为默认模板？现有自定义内容将丢失。', '提示', { type: 'warning' })
    await cmsTemplateApi.seed()
    ElMessage.success('重置成功')
    load()
  } catch (e) {}
}
</script>

<style scoped>
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
