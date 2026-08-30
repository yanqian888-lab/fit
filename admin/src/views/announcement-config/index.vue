<template>
  <div class="page-container">
    <h2 class="page-title">公告管理</h2>
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="标题/内容关键词" clearable style="width: 220px;" />
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 120px;">
          <el-option label="已发送" value="enabled" />
          <el-option label="已撤回" value="disabled" />
          <el-option label="草稿" value="draft" />
        </el-select>
        <el-button type="primary" @click="loadData">查询</el-button>
        <el-button v-perm="'announcement:write'" type="success" @click="openDialog()">新增公告</el-button>
      </div>

      <el-table :data="list" border v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" v-perm="'announcement:write'" />
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" show-overflow-tooltip />
        <el-table-column prop="content" label="内容" show-overflow-tooltip />
        <el-table-column prop="start_time" label="发送时间" width="170" />
        <el-table-column prop="effective_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.effective_status)">
              {{ { draft: '草稿', enabled: '已发送', disabled: '已撤回', expired: '已结束', pending: '待发送' }[row.effective_status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="target_user_count" label="定向" width="90">
          <template #default="{ row }">
            {{ row.target_user_count > 0 ? row.target_user_count + '人' : '全部' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_by" label="创建人" width="120" />
        <el-table-column label="操作" width="280">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="row.status === 'enabled'" v-perm="'announcement:write'" type="warning" size="small" @click="recall(row)">撤回</el-button>
            <el-button v-perm="'announcement:write'" type="danger" size="small" @click="remove(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="batch-actions" v-perm="'announcement:write'">
        <el-button type="danger" size="small" :disabled="!selectedIds.length" @click="batchDelete">批量删除</el-button>
      </div>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
        :total="total"
        layout="total, prev, pager, next"
        @change="loadData"
        style="margin-top: 16px;"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑公告' : '新增公告'" width="680px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="公告标题" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="3" placeholder="公告正文" />
        </el-form-item>
        <el-form-item label="图片">
          <ImageUpload v-model="form.image_url" />
        </el-form-item>
        <el-form-item label="跳转类型">
          <el-radio-group v-model="form.jump_type">
            <el-radio-button label="none">无</el-radio-button>
            <el-radio-button label="internal">站内页</el-radio-button>
            <el-radio-button label="h5">外部H5</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.jump_type === 'internal'" label="站内路由">
          <el-select v-model="form.jump_route_id" placeholder="请选择路由" clearable>
            <el-option v-for="r in routes" :key="r.id" :label="r.route_name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.jump_type === 'h5'" label="H5链接">
          <el-input v-model="form.jump_url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="定向用户">
          <el-radio-group v-model="form.target_type">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="specified_users">指定用户</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.target_type === 'specified_users'" label="用户ID列表">
          <el-input v-model="targetUsersText" type="textarea" :rows="3" placeholder="每行一个 6 位用户ID，或英文逗号分隔" />
        </el-form-item>
        <el-form-item label="发送方式">
          <el-radio-group v-model="sendMode">
            <el-radio-button label="now">立即发送</el-radio-button>
            <el-radio-button label="scheduled">定时发送</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="sendMode === 'scheduled'" label="发送时间">
          <el-date-picker
            v-model="sendTime"
            type="datetime"
            placeholder="选择发送时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item>
          <span class="form-tip">发送后进入「我的-我的消息」，按发送时间倒序展示；发送后可撤回，撤回后用户端不再展示</span>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsAnnouncementApi, cmsPopupRouteApi } from '../../api/cms'
import ImageUpload from '../../components/ImageUpload.vue'

const query = reactive({ keyword: '', status: '', page: 1, size: 20 })
const list = ref([])
const total = ref(0)
const loading = ref(false)
const selectedIds = ref([])
const routes = ref([])

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const sendMode = ref('now')
const sendTime = ref('')
const targetUsersText = ref('')

// 站内信公告：类型固定 message，进「我的-我的消息」，按发送时间倒序
const defaultForm = {
  title: '',
  content: '',
  type: 'message',
  position: 'message_center',
  status: 'enabled',
  priority: 5,
  target_type: 'all',
  target_users: [],
  image_url: '',
  jump_type: 'none',
  jump_route_id: null,
  jump_url: '',
  jump_params: {}
}

const form = reactive({ ...defaultForm })

const statusTagType = (s) => {
  const map = { draft: 'info', enabled: 'success', disabled: 'info', expired: 'danger', pending: 'warning' }
  return map[s] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const res = await cmsAnnouncementApi.list(query)
    list.value = res.data?.list || []
    total.value = res.data?.pagination?.total || 0
  } finally {
    loading.value = false
  }
}

async function loadRoutes() {
  try {
    const res = await cmsPopupRouteApi.list({ status: 'enabled', size: 999 })
    routes.value = res.data?.list || []
  } catch (e) {
    routes.value = []
  }
}

function handleSelectionChange(rows) {
  selectedIds.value = rows.map(r => r.id)
}

function openDialog(row) {
  loadRoutes()
  if (row) {
    isEdit.value = true
    editId.value = row.id
    Object.assign(form, {
      ...defaultForm,
      ...row,
      jump_params: row.jump_params || {},
      target_users: row.target_users || []
    })
    // 按开始时间是否在未来判断发送方式
    sendMode.value = row.start_time && new Date(row.start_time.replace(' ', 'T')) > new Date() ? 'scheduled' : 'now'
    sendTime.value = row.start_time || ''
    targetUsersText.value = (row.target_users || []).join('\n')
  } else {
    isEdit.value = false
    editId.value = null
    Object.assign(form, { ...defaultForm })
    sendMode.value = 'now'
    sendTime.value = ''
    targetUsersText.value = ''
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.title.trim()) return ElMessage.error('标题不能为空')
  if (form.jump_type === 'internal' && !form.jump_route_id) return ElMessage.error('请选择站内路由')
  if (form.jump_type === 'h5' && !form.jump_url.trim()) return ElMessage.error('请输入 H5 链接')
  if (sendMode.value === 'scheduled' && !sendTime.value) return ElMessage.error('请选择发送时间')

  const now = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  const payload = { ...form }
  payload.start_time = sendMode.value === 'scheduled' ? sendTime.value : now
  payload.end_time = '2099-12-31 23:59:59'
  payload.status = 'enabled'
  if (form.target_type === 'specified_users') {
    payload.target_users = targetUsersText.value.split(/[,，\n]+/).map(s => s.trim()).filter(Boolean)
  } else {
    payload.target_users = []
  }
  payload.jump_params = form.jump_params || {}

  try {
    if (isEdit.value) {
      await cmsAnnouncementApi.update(editId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await cmsAnnouncementApi.create(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

// 撤回：用户端消息列表立即不再展示该公告
async function recall(row) {
  try {
    await ElMessageBox.confirm(`确定撤回公告「${row.title}」吗？撤回后用户端不再展示`, '提示', { type: 'warning' })
    await cmsAnnouncementApi.update(row.id, { status: 'disabled' })
    ElMessage.success('已撤回')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function remove(id) {
  try {
    await ElMessageBox.confirm('确定删除该公告吗？', '提示', { type: 'warning' })
    await cmsAnnouncementApi.remove(id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function batchDelete() {
  try {
    await ElMessageBox.confirm('确定批量删除选中的公告吗？', '提示', { type: 'warning' })
    await cmsAnnouncementApi.batchDelete({ ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

onMounted(() => {
  loadData()
  loadRoutes()
})
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
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.batch-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
.form-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
</style>
