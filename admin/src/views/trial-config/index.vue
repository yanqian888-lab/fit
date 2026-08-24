<template>
  <div class="page-container">
    <h2 class="page-title">试用权限管理</h2>

    <!-- 顶部看板 -->
    <div class="card" style="margin-bottom: 16px;">
      <div class="dashboard-cards">
        <div class="dashboard-card">
          <div class="dashboard-label">限流总开关</div>
          <el-switch v-model="config.global_enabled" active-value="1" inactive-value="0" active-text="开启" inactive-text="关闭" @change="saveConfigQuick" />
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">灰度比例</div>
          <div class="dashboard-value">{{ config.grayscale_percent }}%</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">AI 对话限流</div>
          <el-switch v-model="config.ai_chat_enabled" active-value="1" inactive-value="0" @change="saveConfigQuick" />
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">生成日记限流</div>
          <el-switch v-model="config.diary_enabled" active-value="1" inactive-value="0" @change="saveConfigQuick" />
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">今日弹窗拦截</div>
          <div class="dashboard-value">{{ dashboard.block_count }}</div>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <el-button type="warning" @click="openAuditMode">审核模式一键开启</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 限流配置 -->
      <el-tab-pane label="限流配置" name="config">
        <div class="card">
          <el-form :model="config" label-width="140px">
            <el-divider>全局开关</el-divider>
            <el-form-item label="限流总开关">
              <el-radio-group v-model="config.global_enabled">
                <el-radio label="1">开启</el-radio>
                <el-radio label="0">关闭（审核模式）</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="灰度放量比例">
              <el-slider v-model="config.grayscale_percent" :min="0" :max="100" show-input style="width: 500px;" />
              <div class="form-tip">0% 表示全量放行，100% 表示全部用户进入限流逻辑</div>
            </el-form-item>

            <el-divider>AI 对话</el-divider>
            <el-form-item label="AI 对话限流开关">
              <el-radio-group v-model="config.ai_chat_enabled">
                <el-radio label="1">开启</el-radio>
                <el-radio label="0">关闭</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="AI 对话免费阈值">
              <el-input-number v-model="config.ai_chat_threshold" :min="1" :max="10000" />
              <span class="form-tip">累计有效发送超过该值后触发弹窗</span>
            </el-form-item>

            <el-divider>生成日记</el-divider>
            <el-form-item label="日记限流开关">
              <el-radio-group v-model="config.diary_enabled">
                <el-radio label="1">开启</el-radio>
                <el-radio label="0">关闭</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="日记免费阈值">
              <el-input-number v-model="config.diary_threshold" :min="1" :max="10000" />
              <span class="form-tip">累计成功生成超过该值后触发弹窗（默认2，第3次拦截）</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveConfig">保存配置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 弹窗文案 -->
      <el-tab-pane label="弹窗文案" name="popup">
        <div class="card">
          <el-form :model="config" label-width="140px">
            <el-divider>AI 对话弹窗</el-divider>
            <el-form-item label="标题">
              <el-input v-model="config.popup_ai_title" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="正文">
              <el-input v-model="config.popup_ai_content" type="textarea" :rows="3" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="主按钮文字">
              <el-input v-model="config.popup_ai_primary_btn" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="次按钮文字">
              <el-input v-model="config.popup_ai_secondary_btn" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="客服微信号">
              <el-input v-model="config.popup_ai_contact" style="width: 400px;" />
            </el-form-item>

            <el-divider>生成日记弹窗</el-divider>
            <el-form-item label="标题">
              <el-input v-model="config.popup_diary_title" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="正文">
              <el-input v-model="config.popup_diary_content" type="textarea" :rows="3" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="主按钮文字">
              <el-input v-model="config.popup_diary_primary_btn" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="次按钮文字">
              <el-input v-model="config.popup_diary_secondary_btn" style="width: 400px;" />
            </el-form-item>
            <el-form-item label="客服微信号">
              <el-input v-model="config.popup_diary_contact" style="width: 400px;" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveConfig">保存文案</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 白名单 -->
      <el-tab-pane label="白名单" name="whitelist">
        <div class="card">
          <div class="search-bar">
            <el-select v-model="whitelistQuery.type" placeholder="类型" clearable style="width: 120px;">
              <el-option label="用户账号" value="user" />
              <el-option label="App版本" value="version" />
              <el-option label="IP" value="ip" />
            </el-select>
            <el-button type="primary" @click="loadWhitelist">查询</el-button>
            <el-button type="success" @click="openWhitelistDialog">新增白名单</el-button>
            <el-button type="success" plain @click="openBatchWhitelistDialog">批量导入</el-button>
          </div>

          <el-table :data="whitelistList" border v-loading="whitelistLoading">
            <el-table-column prop="type" label="类型" width="120">
              <template #default="{ row }">
                {{ { user: '用户账号', version: 'App版本', ip: 'IP' }[row.type] }}
              </template>
            </el-table-column>
            <el-table-column prop="value" label="值" />
            <el-table-column prop="expire_at" label="过期时间" width="180">
              <template #default="{ row }">
                {{ row.expire_at || '永久' }}
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="openEditWhitelist(row)">编辑</el-button>
                <el-button type="danger" size="small" @click="removeWhitelist(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="whitelistQuery.page"
            v-model:page-size="whitelistQuery.size"
            :total="whitelistTotal"
            layout="total, prev, pager, next"
            @change="loadWhitelist"
            style="margin-top: 16px;"
          />
        </div>
      </el-tab-pane>

      <!-- 拦截日志 -->
      <el-tab-pane label="拦截日志" name="logs">
        <div class="card">
          <div class="search-bar">
            <el-select v-model="logQuery.feature_type" placeholder="功能" clearable style="width: 120px;">
              <el-option label="AI 对话" value="ai_chat" />
              <el-option label="生成日记" value="diary" />
            </el-select>
            <el-select v-model="logQuery.action" placeholder="行为" clearable style="width: 120px;">
              <el-option label="放行" value="allow" />
              <el-option label="拦截" value="block" />
              <el-option label="白名单" value="whitelist" />
              <el-option label="上报" value="report" />
            </el-select>
            <el-button type="primary" @click="loadLogs">查询</el-button>
          </div>

          <el-table :data="logList" border v-loading="logLoading">
            <el-table-column prop="created_at" label="时间" width="180" />
            <el-table-column prop="feature_type" label="功能" width="120">
              <template #default="{ row }">
                {{ { ai_chat: 'AI 对话', diary: '生成日记' }[row.feature_type] || row.feature_type }}
              </template>
            </el-table-column>
            <el-table-column prop="action" label="行为" width="120" />
            <el-table-column prop="user_id" label="用户ID" width="100" />
            <el-table-column prop="device_id" label="设备ID" width="180" show-overflow-tooltip />
            <el-table-column prop="reason" label="原因" />
            <el-table-column prop="ip" label="IP" width="140" />
          </el-table>
          <el-pagination
            v-model:current-page="logQuery.page"
            v-model:page-size="logQuery.size"
            :total="logTotal"
            layout="total, prev, pager, next"
            @change="loadLogs"
            style="margin-top: 16px;"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增白名单弹窗 -->
    <el-dialog v-model="whitelistDialogVisible" title="新增白名单" width="500px">
      <el-form :model="whitelistForm" label-width="100px">
        <el-form-item label="类型">
          <el-radio-group v-model="whitelistForm.type">
            <el-radio label="user">用户账号</el-radio>
            <el-radio label="version">App版本</el-radio>
            <el-radio label="ip">IP</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="值">
          <div style="display:flex;gap:8px;width:100%;">
            <el-input v-model="whitelistForm.value" :placeholder="whitelistForm.type === 'user' ? '用户账号或ID' : '版本号或IP'" style="flex:1;" @input="lookupState = ''" />
            <el-button v-if="whitelistForm.type === 'user'" :loading="lookupLoading" @click="lookupUserAccount">查找</el-button>
          </div>
          <div v-if="whitelistForm.type === 'user' && lookupState === 'found'" class="lookup-result found">
            ✓ 已找到用户：{{ lookupResult.nickname || '-' }}（账号 {{ lookupResult.username }}）
          </div>
          <div v-else-if="whitelistForm.type === 'user' && lookupState === 'notfound'" class="lookup-result notfound">
            ✗ 库中没有该用户，无法添加白名单
          </div>
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker v-model="whitelistForm.expire_at" type="datetime" placeholder="永久则留空" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="whitelistForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="whitelistDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveWhitelist">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑白名单弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑白名单" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="类型">
          <el-input :model-value="{ user: '用户账号', version: 'App版本', ip: 'IP' }[editForm.type]" disabled />
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="editForm.value" disabled />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker v-model="editForm.expire_at" type="datetime" placeholder="永久则留空" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEditWhitelist">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入白名单 -->
    <el-dialog v-model="batchDialogVisible" title="批量导入白名单" width="500px">
      <el-form :model="batchForm" label-width="100px">
        <el-form-item label="类型">
          <el-radio-group v-model="batchForm.type">
            <el-radio label="user">用户账号</el-radio>
            <el-radio label="version">App版本</el-radio>
            <el-radio label="ip">IP</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="值列表">
          <el-input v-model="batchForm.values" type="textarea" :rows="8" placeholder="每行一个，支持换行批量粘贴" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker v-model="batchForm.expire_at" type="datetime" placeholder="永久则留空" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="batchForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBatchWhitelist">确定</el-button>
      </template>
    </el-dialog>

    <!-- 审核模式弹窗 -->
    <el-dialog v-model="auditDialogVisible" title="开启审核模式" width="450px">
      <p>审核模式将自动：</p>
      <ul>
        <li>关闭限流全局总开关</li>
        <li>灰度比例设为 0%</li>
        <li>将指定版本号加入白名单</li>
      </ul>
      <el-form :model="auditForm" label-width="100px" style="margin-top: 16px;">
        <el-form-item label="提审版本号">
          <el-input v-model="auditForm.app_version" placeholder="如 1.0.0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="auditDialogVisible = false">取消</el-button>
        <el-button type="warning" @click="confirmAuditMode">确定开启</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsTrialApi, cmsAppUserApi } from '../../api/cms.js'

const activeTab = ref('config')
const config = reactive({
  global_enabled: '0',
  grayscale_percent: 0,
  ai_chat_enabled: '1',
  ai_chat_threshold: 30,
  diary_enabled: '1',
  diary_threshold: 2,
  popup_ai_title: '',
  popup_ai_content: '',
  popup_ai_primary_btn: '',
  popup_ai_secondary_btn: '',
  popup_ai_contact: '',
  popup_diary_title: '',
  popup_diary_content: '',
  popup_diary_primary_btn: '',
  popup_diary_secondary_btn: '',
  popup_diary_contact: ''
})
const dashboard = reactive({
  block_count: 0,
  whitelist_count: 0,
  copy_count: 0,
  restricted_user_count: 0,
  global_enabled: false,
  grayscale_percent: 0,
  ai_chat_enabled: false,
  diary_enabled: false
})

const whitelistLoading = ref(false)
const whitelistList = ref([])
const whitelistTotal = ref(0)
const whitelistQuery = reactive({ type: '', page: 1, size: 20 })
const whitelistDialogVisible = ref(false)
const whitelistForm = reactive({ type: 'user', value: '', expire_at: '', remark: '' })
// 用户账号查找校验（库中无此用户则不允许添加）
const lookupState = ref('') // '' | 'found' | 'notfound'
const lookupResult = ref(null)
const lookupLoading = ref(false)
const batchDialogVisible = ref(false)
const batchForm = reactive({ type: 'user', values: '', expire_at: '', remark: '' })

const editDialogVisible = ref(false)
const editForm = reactive({ id: null, type: 'user', value: '', expire_at: '', remark: '' })

const logLoading = ref(false)
const logList = ref([])
const logTotal = ref(0)
const logQuery = reactive({ feature_type: '', action: '', page: 1, size: 20 })

const auditDialogVisible = ref(false)
const auditForm = reactive({ app_version: '' })

async function loadConfig() {
  try {
    const res = await cmsTrialApi.getConfig()
    // 接口数值字段是字符串，滑杆/数字输入绑定前统一转 Number，避免显示回退为 0 后被误保存
    const data = { ...res.data }
    for (const k of Object.keys(data)) {
      if (typeof data[k] === 'string' && data[k] !== '' && !isNaN(Number(data[k]))) data[k] = Number(data[k])
    }
    Object.assign(config, data)
  } catch (e) {
    ElMessage.error('加载配置失败')
  }
}

async function loadDashboard() {
  try {
    const res = await cmsTrialApi.dashboard()
    Object.assign(dashboard, res.data)
  } catch (e) {
    console.error(e)
  }
}

async function saveConfig() {
  try {
    await cmsTrialApi.updateConfig(config)
    ElMessage.success('保存成功')
    loadDashboard()
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

async function saveConfigQuick() {
  await saveConfig()
}

async function loadWhitelist() {
  whitelistLoading.value = true
  try {
    const res = await cmsTrialApi.listWhitelist(whitelistQuery)
    whitelistList.value = res.data.list
    whitelistTotal.value = res.data.pagination.total
  } catch (e) {
    ElMessage.error('加载白名单失败')
  } finally {
    whitelistLoading.value = false
  }
}

function openWhitelistDialog() {
  whitelistForm.type = 'user'
  whitelistForm.value = ''
  whitelistForm.expire_at = ''
  whitelistForm.remark = ''
  lookupState.value = ''
  lookupResult.value = null
  whitelistDialogVisible.value = true
}

// 用户账号查找：与后端 checkUserExists 一致（username 或 id 精确匹配）
async function lookupUserAccount() {
  const value = (whitelistForm.value || '').trim()
  if (!value) return ElMessage.warning('请输入用户账号')
  lookupLoading.value = true
  lookupState.value = ''
  try {
    const res = await cmsAppUserApi.list({ keyword: value, page: 1, size: 20 })
    const match = (res.data?.list || []).find(u => u.username === value || String(u.id) === value)
    if (match) {
      lookupState.value = 'found'
      lookupResult.value = match
    } else {
      lookupState.value = 'notfound'
      lookupResult.value = null
    }
  } finally {
    lookupLoading.value = false
  }
}

async function saveWhitelist() {
  if (!whitelistForm.value) {
    return ElMessage.warning('请输入值')
  }
  // 用户账号类型：必须先查找并确认用户存在
  if (whitelistForm.type === 'user') {
    if (lookupState.value !== 'found') {
      await lookupUserAccount()
    }
    if (lookupState.value !== 'found') {
      return ElMessage.error('库中没有该用户，无法添加白名单')
    }
  }
  try {
    await cmsTrialApi.createWhitelist(whitelistForm)
    ElMessage.success('添加成功')
    whitelistDialogVisible.value = false
    loadWhitelist()
  } catch (e) {
    // request 拦截器已展示错误提示
  }
}

function openBatchWhitelistDialog() {
  batchForm.type = 'user'
  batchForm.values = ''
  batchForm.expire_at = ''
  batchForm.remark = ''
  batchDialogVisible.value = true
}

async function saveBatchWhitelist() {
  if (!batchForm.values) {
    return ElMessage.warning('请输入值列表')
  }
  try {
    const res = await cmsTrialApi.batchCreateWhitelist(batchForm)
    ElMessage.success(res.message || '批量添加完成')
    batchDialogVisible.value = false
    loadWhitelist()
  } catch (e) {
    // request 拦截器已展示错误提示
  }
}

function openEditWhitelist(row) {
  editForm.id = row.id
  editForm.type = row.type
  editForm.value = row.value
  editForm.expire_at = row.expire_at || ''
  editForm.remark = row.remark || ''
  editDialogVisible.value = true
}

async function saveEditWhitelist() {
  try {
    await cmsTrialApi.updateWhitelist(editForm.id, {
      expire_at: editForm.expire_at,
      remark: editForm.remark
    })
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadWhitelist()
  } catch (e) {
    // request 拦截器已展示错误提示
  }
}

async function removeWhitelist(id) {
  try {
    await ElMessageBox.confirm('确认删除该白名单？', '提示', { type: 'warning' })
    await cmsTrialApi.removeWhitelist(id)
    ElMessage.success('删除成功')
    loadWhitelist()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

async function loadLogs() {
  logLoading.value = true
  try {
    const res = await cmsTrialApi.listLogs(logQuery)
    logList.value = res.data.list
    logTotal.value = res.data.pagination.total
  } catch (e) {
    ElMessage.error('加载日志失败')
  } finally {
    logLoading.value = false
  }
}

function openAuditMode() {
  auditForm.app_version = ''
  auditDialogVisible.value = true
}

async function confirmAuditMode() {
  try {
    await cmsTrialApi.auditMode(auditForm.app_version)
    ElMessage.success('审核模式已开启')
    auditDialogVisible.value = false
    loadConfig()
    loadDashboard()
  } catch (e) {
    ElMessage.error('开启失败')
  }
}

onMounted(() => {
  loadConfig()
  loadDashboard()
  loadWhitelist()
  loadLogs()
})
</script>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}
.dashboard-cards {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.dashboard-card {
  min-width: 160px;
  padding: 16px;
  background: #f7faf4;
  border-radius: 8px;
}
.dashboard-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}
.dashboard-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
}
.form-tip {
  margin-left: 12px;
  color: #999;
  font-size: 13px;
}
.lookup-result {
  margin-top: 6px;
  font-size: 13px;
}
.lookup-result.found {
  color: #67c23a;
}
.lookup-result.notfound {
  color: #f56c6c;
}
</style>
