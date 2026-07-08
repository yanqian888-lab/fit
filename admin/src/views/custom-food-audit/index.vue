<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="食物名称" clearable style="width:220px;" />
        <el-select v-model="query.status" placeholder="审核状态" clearable style="width:160px;">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-select v-model="query.category" placeholder="分类" clearable style="width:160px;">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="calorie_per_100g" label="热量/100g" width="110" />
        <el-table-column prop="protein_per_100g" label="蛋白质" width="80" />
        <el-table-column prop="carb_per_100g" label="碳水" width="80" />
        <el-table-column prop="fat_per_100g" label="脂肪" width="80" />
        <el-table-column prop="creator_name" label="创建者" width="120">
          <template #default="{ row }">
            {{ row.creator_name || row.creator_phone || '用户' + row.user_id }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'pending'" type="warning">待审核</el-tag>
            <el-tag v-else-if="row.status === 'approved'" type="success">已通过</el-tag>
            <el-tag v-else-if="row.status === 'rejected'" type="info">已拒绝</el-tag>
            <el-tag v-else>{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" link type="success" @click="approve(row)" v-perm="'food_lib:write'">通过</el-button>
            <el-button v-if="row.status === 'pending'" link type="danger" @click="reject(row)" v-perm="'food_lib:write'">拒绝</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsCustomFoodApi } from '@/api/cms'
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
const query = ref({ keyword: '', status: 'pending', category: '', page: 1, size: 20 })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsCustomFoodApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
    categories.value = res.data.categories || []
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = { keyword: '', status: 'pending', category: '', page: 1, size: 20 }
  load()
}

async function approve(row) {
  try {
    await ElMessageBox.confirm('审核通过后，所有用户都可在食物库中搜索到该食物，确认通过？', '提示', { type: 'warning' })
    await cmsCustomFoodApi.approve(row.id)
    ElMessage.success('已通过')
    load()
  } catch (e) {}
}

async function reject(row) {
  try {
    await ElMessageBox.confirm('拒绝后该食物仅创建者自己可见，确认拒绝？', '提示', { type: 'warning' })
    await cmsCustomFoodApi.reject(row.id)
    ElMessage.success('已拒绝')
    load()
  } catch (e) {}
}
</script>

<style scoped>
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
