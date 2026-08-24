<template>
  <div class="page-container">
    <div class="card">
      <div class="card-header">
        <h3>博物馆入口展示开关</h3>
        <p class="tips">关闭后，APP 博物馆首页将不再显示对应入口，剩余入口会自动向前补齐。</p>
      </div>

      <el-form label-width="120px" v-loading="loading">
        <el-form-item v-for="item in entryList" :key="item.key" :label="item.name">
          <el-switch
            v-model="config[item.key]"
            active-text="显示"
            inactive-text="隐藏"
            :disabled="!canWrite"
          />
        </el-form-item>
      </el-form>

      <div class="actions">
        <el-button type="primary" @click="save" :loading="saving" :disabled="!canWrite">保存设置</el-button>
        <el-button @click="reset" :disabled="!canWrite">恢复默认</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cmsMuseumConfigApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const canWrite = computed(() => auth.hasPermission('museum_config:write'))

const loading = ref(false)
const saving = ref(false)
const config = ref({})

const entryList = [
  { key: 'recipe', name: '食谱库' },
  { key: 'insight', name: '感悟集' },
  { key: 'photo', name: '照片墙' },
  { key: 'method', name: '方法库' },
  { key: 'diary', name: '日记与分析' },
  { key: 'milestone', name: '里程碑' }
]

const defaultConfig = {
  recipe: true,
  insight: true,
  photo: true,
  method: true,
  diary: true,
  milestone: true
}

onMounted(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const res = await cmsMuseumConfigApi.get()
    config.value = { ...defaultConfig, ...(res.data || {}) }
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload = {}
    for (const item of entryList) {
      payload[item.key] = !!config.value[item.key]
    }
    await cmsMuseumConfigApi.update(payload)
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

function reset() {
  config.value = { ...defaultConfig }
}
</script>

<style scoped>
.page-container {
  padding: 20px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  max-width: 600px;
}
.card-header {
  margin-bottom: 24px;
}
.card-header h3 {
  margin: 0 0 8px;
  font-size: 18px;
}
.tips {
  color: #909399;
  font-size: 13px;
  margin: 0;
}
.actions {
  margin-top: 24px;
  padding-left: 120px;
}
</style>
