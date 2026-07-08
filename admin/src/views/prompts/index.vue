<template>
  <div class="page-container">
    <div class="card">
      <h3 style="margin-bottom:20px;">AI Prompt 管理</h3>
      <p style="color:#666;margin-bottom:16px;">
        每个 Prompt 保留最新版本 + 最多 {{ historyLimit }} 个历史版本。编辑最新版本并保存后会发布为新版本，最早的历史版本会被自动顶替。
      </p>
      <el-table :data="promptList" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="prompt_key" label="Prompt 标识" width="180" />
        <el-table-column label="用处" min-width="200">
          <template #default="{ row }">
            {{ usageMap[row.prompt_key] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="最新版本" width="100">
          <template #default="{ row }">
            <el-tag type="info">v{{ row.latest_version }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最新版本状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.is_enabled ? 'success' : 'danger'">{{ row.is_enabled ? '已启用' : '已停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="历史版本数" width="110">
          <template #default="{ row }">
            {{ Math.max(0, row.version_count - 1) }}
          </template>
        </el-table-column>
        <el-table-column label="使用 AI" width="160">
          <template #default="{ row }">
            <span>{{ row.ai_config_name || '默认' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row.prompt_key)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="Prompt 版本管理" width="900px" :close-on-click-modal="false">
      <div v-loading="detailLoading">
        <div style="margin-bottom:12px;font-weight:600;">当前最新版本（v{{ currentMeta.latest?.version }})</div>
        <div style="margin-bottom:16px;">
          <span style="font-weight:600;margin-right:12px;">使用 AI：</span>
          <el-select v-model="selectedAiConfigId" placeholder="选择 AI 配置" clearable style="width:260px;" :loading="aiConfigLoading">
            <el-option v-for="cfg in aiConfigList" :key="cfg.id" :label="cfg.name" :value="cfg.id" />
          </el-select>
          <el-button type="primary" size="small" style="margin-left:8px;" @click="saveAiConfigOnly" :loading="aiConfigSaving">保存 AI 配置</el-button>
        </div>
        <el-input v-model="editContent" type="textarea" :rows="14" />

        <div style="margin:20px 0 12px;font-weight:600;">版本历史（可启用/停用）</div>
        <el-table :data="currentMeta.versions" border size="small" empty-text="暂无历史版本">
          <el-table-column prop="version" label="版本" width="80" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.is_enabled ? 'success' : 'danger'" size="small">{{ row.is_enabled ? '已启用' : '已停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="180" />
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openView(row)">查看</el-button>
              <el-switch
                v-model="row.is_enabled"
                :active-value="1"
                :inactive-value="0"
                style="margin-left:8px;"
                @change="(val) => toggleEnabled(row, val)"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save" :loading="saving">保存并发布新版本</el-button>
      </template>
    </el-dialog>

    <!-- 查看历史版本内容 -->
    <el-dialog v-model="viewDialogVisible" title="查看 Prompt 内容" width="800px" :close-on-click-modal="false">
      <div style="margin-bottom:12px;font-weight:600;">版本 v{{ viewVersion }}</div>
      <el-input v-model="viewContent" type="textarea" :rows="16" readonly />
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsPromptApi, cmsAiConfigApi } from '@/api/cms'

const historyLimit = 3

const usageMap = {
  diary_system: '每日减肥日记的系统提示词，约束输出结构与风格',
  diary_user: '每日减肥日记的用户数据填充提示词',
  helper_agent: '搭子/Helper 助手的系统提示词',
  main_agent: '主智能体（减肥搭子）的系统提示词',
  method_extraction: '从聊天记录中提取减脂方法/经验的提示词',
  monthly_diary: '生成月度减肥日记的提示词',
  plateau_analysis: '体重平台期分析的提示词',
  precipitation_agent: '从聊天记录沉淀饮食/运动/身体数据的提示词',
  recipe_extraction: '从聊天记录中提取食谱的提示词'
}
const loading = ref(false)
const detailLoading = ref(false)
const saving = ref(false)
const promptList = ref([])
const dialogVisible = ref(false)
const currentKey = ref('')
const editContent = ref('')
const currentMeta = ref({ latest: null, versions: [] })
const viewDialogVisible = ref(false)
const viewVersion = ref('')
const viewContent = ref('')
const aiConfigList = ref([])
const selectedAiConfigId = ref('')
const aiConfigLoading = ref(false)
const aiConfigSaving = ref(false)

onMounted(() => {
  loadList()
})

async function loadList() {
  loading.value = true
  try {
    const res = await cmsPromptApi.list()
    promptList.value = res.data || []
  } finally {
    loading.value = false
  }
}

async function openEdit(key) {
  currentKey.value = key
  dialogVisible.value = true
  detailLoading.value = true
  aiConfigLoading.value = true
  try {
    const [detailRes, cfgRes] = await Promise.all([
      cmsPromptApi.detail(key),
      cmsAiConfigApi.simple()
    ])
    currentMeta.value = detailRes.data || { latest: null, versions: [] }
    editContent.value = currentMeta.value.latest?.content || ''
    aiConfigList.value = cfgRes.data || []
    selectedAiConfigId.value = currentMeta.value.latest?.ai_config_id || ''
  } finally {
    detailLoading.value = false
    aiConfigLoading.value = false
  }
}

async function toggleEnabled(row, val) {
  try {
    await cmsPromptApi.setEnabled(currentKey.value, row.version, !!val)
    ElMessage.success('状态已更新')
    loadDetail()
    loadList()
  } catch (e) {
    console.error(e)
    row.is_enabled = val ? 0 : 1
  }
}

async function loadDetail() {
  const res = await cmsPromptApi.detail(currentKey.value)
  currentMeta.value = res.data || { latest: null, versions: [] }
  editContent.value = currentMeta.value.latest?.content || ''
  selectedAiConfigId.value = currentMeta.value.latest?.ai_config_id || ''
}

function openView(row) {
  viewVersion.value = row.version
  viewContent.value = row.content || ''
  viewDialogVisible.value = true
}

async function saveAiConfigOnly() {
  if (!currentKey.value) return
  aiConfigSaving.value = true
  try {
    await cmsPromptApi.setAiConfig(currentKey.value, selectedAiConfigId.value || undefined)
    ElMessage.success('AI 配置已保存')
    loadList()
  } catch (e) {
    console.error(e)
  } finally {
    aiConfigSaving.value = false
  }
}

async function save() {
  try {
    await ElMessageBox.confirm('保存后会生成新版本，最早的历史版本将被顶替，是否继续？', '提示', { type: 'warning' })
  } catch {
    return
  }
  saving.value = true
  try {
    await cmsPromptApi.publish(currentKey.value, editContent.value, selectedAiConfigId.value || undefined)
    ElMessage.success('已发布新版本')
    await loadDetail()
    loadList()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}
</script>
