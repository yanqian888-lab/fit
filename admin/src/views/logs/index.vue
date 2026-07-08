<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.action" placeholder="操作类型" clearable style="width:180px;" />
        <el-input v-model="query.target_type" placeholder="目标类型" clearable style="width:180px;" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="cms_username" label="管理员" width="120" />
        <el-table-column prop="action" label="操作" width="180" />
        <el-table-column prop="target_type" label="目标类型" width="120" />
        <el-table-column prop="target_id" label="目标ID" width="100" />
        <el-table-column prop="detail" label="详情" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.detail ? JSON.stringify(row.detail) : '' }}
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column prop="created_at" label="时间" width="160" />
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { cmsLogApi } from '@/api/cms'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = ref({ action: '', target_type: '', page: 1, size: 20 })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsLogApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = { action: '', target_type: '', page: 1, size: 20 }
  load()
}
</script>

<style scoped>
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
