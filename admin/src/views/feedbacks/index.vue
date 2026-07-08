<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="内容/用户" clearable style="width:220px;" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
      <el-table
        :data="list"
        v-loading="loading"
        border
        empty-text="暂无内容"
        @filter-change="handleFilterChange"
      >
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="user_nickname" label="用户" />
        <el-table-column prop="user_phone" label="手机号" />
        <el-table-column
          prop="type"
          label="类型"
          column-key="type"
          :filters="typeFilters"
          :filter-multiple="false"
        >
          <template #default="{ row }">
            {{ typeText(row.type) }}
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" show-overflow-tooltip />
        <el-table-column
          prop="status"
          label="状态"
          width="110"
          column-key="status"
          :filters="statusFilters"
          :filter-multiple="false"
        >
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="160" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="openReply(row)" v-perm="'feedback:write'">回复</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="replyVisible" title="反馈详情/回复" width="560px">
      <div v-if="currentRow" class="detail-wrap">
        <p><strong>用户：</strong>{{ currentRow.user_nickname }} {{ currentRow.user_phone ? `（${currentRow.user_phone}）` : '' }}</p>
        <p><strong>类型：</strong>{{ typeText(currentRow.type) }}</p>
        <p><strong>内容：</strong>{{ currentRow.content }}</p>
        <p v-if="currentRow.contact"><strong>联系方式：</strong>{{ currentRow.contact }}</p>
        <div v-if="currentRow.images && currentRow.images.length" class="image-list">
          <p><strong>截图：</strong></p>
          <el-image
            v-for="(img, idx) in currentRow.images"
            :key="idx"
            :src="img"
            :preview-src-list="currentRow.images"
            fit="cover"
            class="feedback-img"
          />
        </div>
      </div>
      <el-divider />
      <el-input v-model="replyText" type="textarea" :rows="4" placeholder="请输入回复内容" />
      <template #footer>
        <el-button @click="replyVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReply">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cmsFeedbackApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const statusFilters = [
  { text: '待处理', value: 'pending' },
  { text: '处理中', value: 'processing' },
  { text: '已处理', value: 'resolved' }
]

const typeFilters = [
  { text: '功能建议', value: 'feature' },
  { text: 'BUG 反馈', value: 'bug' },
  { text: '其他', value: 'other' }
]

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = ref({ status: '', type: '', keyword: '', page: 1, size: 20 })
const replyVisible = ref(false)
const replyText = ref('')
const currentRow = ref(null)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsFeedbackApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally {
    loading.value = false
  }
}

function reset() {
  query.value = { status: '', type: '', keyword: '', page: 1, size: 20 }
  load()
}

function handleFilterChange(filters) {
  if (filters.status) {
    query.value.status = filters.status[0] || ''
  }
  if (filters.type) {
    query.value.type = filters.type[0] || ''
  }
  query.value.page = 1
  load()
}

function typeText(value) {
  const map = { feature: '功能建议', bug: 'BUG 反馈', other: '其他' }
  return map[value] || value
}

function statusType(status) {
  return { pending: 'warning', processing: 'primary', resolved: 'success' }[status] || 'info'
}

function openReply(row) {
  currentRow.value = row
  replyText.value = row.reply || ''
  replyVisible.value = true
}

async function submitReply() {
  if (!replyText.value.trim()) return ElMessage.warning('请输入回复内容')
  try {
    await cmsFeedbackApi.reply(currentRow.value.id, replyText.value)
    ElMessage.success('回复成功')
    replyVisible.value = false
    load()
  } catch (e) { console.error(e) }
}
</script>

<style scoped>
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.detail-wrap p {
  margin-bottom: 8px;
  color: #333;
  line-height: 1.6;
}
.image-list {
  margin-top: 8px;
}
.feedback-img {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  margin-right: 8px;
  cursor: pointer;
}
</style>
