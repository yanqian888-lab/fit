<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="任务名称" clearable style="width:220px;" />
        <el-select v-model="query.type" placeholder="类型" clearable style="width:180px;">
          <el-option label="daily（每日任务）" value="daily" />
          <el-option label="once（一次性任务）" value="once" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable style="width:120px;">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'task_config:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="type" label="类型" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="reward_berries" label="浆果奖励" />
        <el-table-column prop="reward_flowers" label="花朵奖励" />
        <el-table-column prop="jump_page" label="跳转页面" />
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }"><el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'task_config:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'task_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑任务' : '新增任务'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" placeholder="请选择类型" style="width:220px;">
            <el-option label="daily（每日任务）" value="daily" />
            <el-option label="once（一次性任务）" value="once" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="完成条件">
          <el-select v-model="form.condition_json.action" placeholder="触发行为" filterable allow-create style="width:220px;">
            <el-option v-for="(label, key) in actionLabels" :key="key" :label="label" :value="key" />
          </el-select>
          <span style="margin:0 8px;">达到</span>
          <el-input-number v-model="form.condition_json.count" :min="1" style="width:120px;" />
          <span style="margin-left:8px;">次</span>
        </el-form-item>
        <el-form-item label="浆果奖励"><el-input-number v-model="form.reward_berries" :min="0" /></el-form-item>
        <el-form-item label="花朵奖励"><el-input-number v-model="form.reward_flowers" :min="0" /></el-form-item>
        <el-form-item label="跳转页面"><el-input v-model="form.jump_page" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="开始时间"><el-date-picker v-model="form.start_time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" /></el-form-item>
        <el-form-item label="结束时间"><el-date-picker v-model="form.end_time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.status" active-text="启用" inactive-text="停用" /></el-form-item>
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
import { cmsTaskConfigApi } from '@/api/cms'
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
const query = ref({ keyword: '', type: '', status: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const emptyCondition = () => ({ action: '', count: 1 })
const form = ref({ name: '', type: 'daily', description: '', condition_json: emptyCondition(), reward_berries: 0, reward_flowers: 0, jump_page: '', sort_order: 0, start_time: '', end_time: '', status: true })

// 任务触发行为（与后端 taskService 的进度 key 对应），允许手动输入自定义值
const actionLabels = {
  checkin: '每日签到', record_diet: '记录饮食', record_exercise: '记录运动',
  record_body: '记录体重', record_water: '记录饮水', chat: '聊天',
  feed: '喂食搭搭',
  explore_complete: '外出归来', generate_analysis: '生成分析', complete_profile: '完善资料',
  save_event_image: '保存事件图'
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsTaskConfigApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally { loading.value = false }
}

function reset() {
  query.value = { keyword: '', type: '', status: '', page: 1, size: 20 }
  load()
}

function openDialog(row = null) {
  if (row) {
    const cond = row.condition_json && typeof row.condition_json === 'object' ? row.condition_json : {}
    form.value = { ...row, status: Boolean(row.status), condition_json: { action: cond.action || '', count: cond.count || 1 } }
  } else {
    form.value = { name: '', type: 'daily', description: '', condition_json: emptyCondition(), reward_berries: 0, reward_flowers: 0, jump_page: '', sort_order: 0, start_time: '', end_time: '', status: true }
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.condition_json.action) {
    ElMessage.error('请选择完成条件的触发行为')
    return
  }
  try {
    const data = { ...form.value, status: form.value.status ? 1 : 0 }
    if (data.id) await cmsTaskConfigApi.update(data.id, data)
    else await cmsTaskConfigApi.create(data)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) {
    console.error(e)
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsTaskConfigApi.remove(row.id)
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
