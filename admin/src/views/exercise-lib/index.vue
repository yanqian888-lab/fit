<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="运动名称" clearable style="width:220px;" />
        <el-select v-model="query.category" placeholder="分类" clearable style="width:160px;">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'exercise_lib:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容" @filter-change="handleFilterChange">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="exercise_name" label="名称" />
        <el-table-column
          prop="category"
          label="分类"
          width="140"
          column-key="category"
          :filters="categoryFilters"
          :filter-multiple="false"
        />
        <el-table-column prop="intensity_desc" label="强度" width="110" />
        <el-table-column prop="calorie_per_hour" label="每小时消耗（千卡）" width="150" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'exercise_lib:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'exercise_lib:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑运动' : '新增运动'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称"><el-input v-model="form.exercise_name" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="请选择分类" filterable allow-create style="width:100%;" @change="onCategoryChange">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="子分类">
          <el-select v-model="form.sub_category" placeholder="请选择子分类" filterable allow-create clearable style="width:100%;">
            <el-option v-for="s in subCategoryOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="强度">
          <el-select v-model="form.intensity_desc" placeholder="请选择强度" style="width:100%;">
            <el-option v-for="s in INTENSITY_OPTIONS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="每小时消耗">
          <el-input-number v-model="form.calorie_per_hour" :precision="2" :min="0" />
          <span style="margin-left:8px;color:#909399;font-size:12px;">（千卡）</span>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsExerciseApi } from '@/api/cms'
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
const categories = ref([])
const subCategories = ref({})
// 强度固定档位（下拉选择，不再手填）
const INTENSITY_OPTIONS = ['极低强度', '低强度', '中低强度', '中等强度', '中高强度', '高强度', '极高强度']
const query = ref({ keyword: '', category: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref({ exercise_name: '', category: '', sub_category: '', calorie_per_hour: 0, intensity_desc: '', remark: '' })

// 子分类下拉随分类联动
const subCategoryOptions = computed(() => subCategories.value[form.value.category] || [])

function onCategoryChange() {
  // 切换分类后，当前子分类不属于新分类时清空
  if (form.value.sub_category && !subCategoryOptions.value.includes(form.value.sub_category)) {
    form.value.sub_category = ''
  }
}

onMounted(load)

const categoryFilters = computed(() => categories.value.map(c => ({ text: c, value: c })))

async function load() {
  loading.value = true
  try {
    const res = await cmsExerciseApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
    categories.value = res.data.categories || []
    subCategories.value = res.data.subCategories || {}
  } finally {
    loading.value = false
  }
}

function handleFilterChange(filters) {
  if (filters.category) {
    query.value.category = filters.category[0] || ''
  }
  query.value.page = 1
  load()
}

function reset() {
  query.value = { keyword: '', category: '', page: 1, size: 20 }
  load()
}

function openDialog(row = null) {
  form.value = row ? { ...row } : { exercise_name: '', category: '', sub_category: '', calorie_per_hour: 0, intensity_desc: '', remark: '' }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) {
      await cmsExerciseApi.update(form.value.id, form.value)
    } else {
      await cmsExerciseApi.create(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsExerciseApi.remove(row.id)
    ElMessage.success('删除成功')
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
