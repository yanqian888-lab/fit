<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="食物名称" clearable style="width:220px;" />
        <el-select v-model="query.category" placeholder="分类" clearable style="width:160px;">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'food_lib:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容" @filter-change="handleFilterChange">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="food_name" label="名称" />
        <el-table-column
          prop="category"
          label="分类"
          width="140"
          column-key="category"
          :filters="categoryFilters"
          :filter-multiple="false"
        />
        <el-table-column prop="calories_per_100g" label="热量/100g" width="120" />
        <el-table-column prop="protein_per_100g" label="蛋白质" width="90" />
        <el-table-column prop="carb_per_100g" label="碳水" width="90" />
        <el-table-column prop="fat_per_100g" label="脂肪" width="90" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'food_lib:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'food_lib:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑食物' : '新增食物'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称"><el-input v-model="form.food_name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="form.category" /></el-form-item>
        <el-form-item label="子分类"><el-input v-model="form.sub_category" /></el-form-item>
        <el-form-item label="热量/100g"><el-input-number v-model="form.calories_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="蛋白质"><el-input-number v-model="form.protein_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="碳水"><el-input-number v-model="form.carb_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="脂肪"><el-input-number v-model="form.fat_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="常见单位"><el-input v-model="form.common_unit" /></el-form-item>
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
import { cmsFoodApi } from '@/api/cms'
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
const query = ref({ keyword: '', category: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref({ food_name: '', category: '', sub_category: '', calories_per_100g: 0, protein_per_100g: 0, carb_per_100g: 0, fat_per_100g: 0, common_unit: '', remark: '' })

onMounted(load)

const categoryFilters = computed(() => categories.value.map(c => ({ text: c, value: c })))

async function load() {
  loading.value = true
  try {
    const res = await cmsFoodApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
    categories.value = res.data.categories || []
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
  form.value = row ? { ...row } : { food_name: '', category: '', sub_category: '', calories_per_100g: 0, protein_per_100g: 0, carb_per_100g: 0, fat_per_100g: 0, common_unit: '', remark: '' }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) {
      await cmsFoodApi.update(form.value.id, form.value)
    } else {
      await cmsFoodApi.create(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsFoodApi.remove(row.id)
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
