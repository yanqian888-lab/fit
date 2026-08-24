<template>
  <div class="page-container">
    <div class="card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="货币规则" name="rules">
          <div class="search-bar" style="justify-content:flex-end;">
            <el-button type="warning" @click="openAdjustDialog" v-perm="'currency_config:write'">手动调整</el-button>
            <el-button type="primary" @click="saveRules" v-perm="'currency_config:write'">保存</el-button>
          </div>
          <el-form v-if="rules" label-width="160px" style="max-width: 640px;">
            <el-divider content-position="left">新用户初始货币</el-divider>
            <el-form-item label="初始浆果"><el-input-number v-model="rules.initial.berries" :min="0" /></el-form-item>
            <el-form-item label="初始鲜花"><el-input-number v-model="rules.initial.flowers" :min="0" /></el-form-item>

            <el-divider content-position="left">浆果规则</el-divider>
            <el-form-item label="每日上限"><el-input-number v-model="rules.berries.daily_max" :min="0" /></el-form-item>
            <el-form-item>
              <span style="color:#909399;font-size:12px;line-height:1.6;">各行为的浆果/鲜花奖励统一在「任务配置」中按行为设置，此处不再单独配置。</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="adjustVisible" title="手动调整货币" width="500px">
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="用户ID"><el-input v-model="adjustForm.user_id" /></el-form-item>
        <el-form-item label="货币类型">
          <el-select v-model="adjustForm.currency_type" placeholder="请选择">
            <el-option label="浆果" value="berries" />
            <el-option label="鲜花" value="flowers" />
          </el-select>
        </el-form-item>
        <el-form-item label="变动数量"><el-input-number v-model="adjustForm.amount" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="adjustForm.reason" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" @click="adjust">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cmsCurrencyConfigApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const activeTab = ref('rules')
const rules = ref(null)
const adjustVisible = ref(false)
const adjustForm = ref({ user_id: '', currency_type: '', amount: 0, reason: '' })

onMounted(loadRules)

async function loadRules() {
  try {
    const res = await cmsCurrencyConfigApi.getRules()
    rules.value = res.data
  } catch (e) { console.error(e) }
}

async function saveRules() {
  try {
    await cmsCurrencyConfigApi.updateRules(rules.value)
    ElMessage.success('保存成功')
  } catch (e) {
    console.error(e)
  }
}

function openAdjustDialog() {
  adjustForm.value = { user_id: '', currency_type: '', amount: 0, reason: '' }
  adjustVisible.value = true
}

async function adjust() {
  try {
    await cmsCurrencyConfigApi.adjust(adjustForm.value)
    ElMessage.success('调整成功')
    adjustVisible.value = false
  } catch (e) { console.error(e) }
}
</script>

<style scoped>
.pagination { margin-top: 16px; justify-content: flex-end; }
.limit-label { margin: 0 8px 0 20px; color: #909399; }
.limit-tip { margin-left: 8px; color: #c0c4cc; font-size: 12px; }
</style>
