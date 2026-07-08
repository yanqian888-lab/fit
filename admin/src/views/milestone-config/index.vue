<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-select v-model="query.type" placeholder="类型" clearable style="width:160px;">
          <el-option label="减重" value="weight_loss" />
          <el-option label="坚持天数" value="duration" />
          <el-option label="累计打卡" value="checkin" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'milestone:write'">新增</el-button>
        <el-button type="warning" @click="seed" v-perm="'milestone:write'">重置默认</el-button>
      </div>
      <el-table :data="filteredList" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            {{ typeLabel[row.type] || row.type }}
          </template>
        </el-table-column>
        <el-table-column label="适用值" width="120">
          <template #default="{ row }">
            {{ formatValue(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="content" label="文案" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序" width="90" />
        <el-table-column prop="is_enabled" label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'milestone:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'milestone:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑里程碑文案' : '新增里程碑文案'" width="600px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型" required>
          <el-select v-model="form.type" style="width:100%;" :disabled="!!form.id" @change="onTypeChange">
            <el-option label="减重" value="weight_loss" />
            <el-option label="坚持天数" value="duration" />
            <el-option label="累计打卡" value="checkin" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用值">
          <el-select v-model="form.value" style="width:100%;" clearable placeholder="通用（所有该类型里程碑）">
            <el-option label="通用（所有该类型里程碑）" :value="null" />
            <el-option
              v-for="v in allowedValues[form.type] || []"
              :key="v"
              :label="v + (form.type === 'weight_loss' ? 'kg' : '天')"
              :value="v"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文案" required>
          <el-input v-model="form.content" type="textarea" :rows="3" placeholder="可用 {value} 占位符表示具体数值，如：累计减重{value}kg" />
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
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsMilestoneApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const loading = ref(false)
const list = ref([])
const query = ref({ type: '' })
const dialogVisible = ref(false)
const typeLabel = {
  weight_loss: '减重',
  duration: '坚持天数',
  checkin: '累计打卡'
}
const allowedValues = {
  weight_loss: [2.5, 5, 10, 15, 20, 30],
  duration: [7, 30, 60, 100, 180, 365],
  checkin: [7, 30, 60, 100]
}
const defaultForm = {
  type: 'weight_loss',
  value: null,
  content: '',
  sort_order: 0,
  is_enabled: true
}
const form = ref({ ...defaultForm })

const filteredList = computed(() => {
  if (!query.value.type) return list.value
  return list.value.filter(item => item.type === query.value.type)
})

onMounted(() => {
  load()
})

function formatValue(row) {
  if (row.value === null || row.value === undefined || row.value === '') return '通用'
  const unit = row.type === 'weight_loss' ? 'kg' : '天'
  return row.value + unit
}

function onTypeChange() {
  form.value.value = null
}

async function load() {
  loading.value = true
  try {
    const res = await cmsMilestoneApi.list()
    list.value = res.data || []
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = { type: '' }
  load()
}

function openDialog(row = null) {
  form.value = row ? { ...row } : { ...defaultForm }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) {
      await cmsMilestoneApi.update(form.value.id, form.value)
    } else {
      await cmsMilestoneApi.create(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsMilestoneApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}

async function seed() {
  try {
    await ElMessageBox.confirm('确认重置为默认文案？会补充缺失的默认项并更新现有默认项的适用值。', '提示', { type: 'warning' })
    await cmsMilestoneApi.seed()
    ElMessage.success('重置成功')
    load()
  } catch (e) {}
}
</script>
