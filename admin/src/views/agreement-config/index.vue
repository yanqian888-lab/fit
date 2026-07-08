<template>
  <div class="page-container">
    <div class="card">
      <h3 style="margin-bottom:20px;">协议配置</h3>
      <el-form :model="form" label-position="top" v-loading="loading">
        <el-form-item label="用户协议内容">
          <el-input v-model="form.user_agreement" type="textarea" :rows="8" />
        </el-form-item>
        <el-form-item label="用户协议 H5 链接">
          <el-input v-model="form.user_agreement_url" placeholder="https://example.com/agreement.html" />
        </el-form-item>

        <el-form-item label="隐私政策内容">
          <el-input v-model="form.privacy_policy" type="textarea" :rows="8" />
        </el-form-item>
        <el-form-item label="隐私政策 H5 链接">
          <el-input v-model="form.privacy_policy_url" placeholder="https://example.com/privacy.html" />
        </el-form-item>

        <el-form-item label="隐私版本">
          <el-input v-model="form.privacy_version" />
        </el-form-item>
        <el-form-item label="强制更新隐私政策">
          <el-switch v-model="form.force_privacy_update" />
        </el-form-item>

        <el-divider />
        <h4 style="margin-bottom:16px;">关于我们</h4>
        <el-form-item label="关于我们内容">
          <el-input v-model="form.about_us_content" type="textarea" :rows="10" />
        </el-form-item>

        <el-button type="primary" @click="save" v-perm="'app_config:write'">保存</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cmsConfigApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const loading = ref(false)
const form = ref({
  user_agreement: '',
  user_agreement_url: '',
  privacy_policy: '',
  privacy_policy_url: '',
  privacy_version: '',
  force_privacy_update: false,
  about_us_content: ''
})

onMounted(async () => {
  loading.value = true
  try {
    const res = await cmsConfigApi.get()
    form.value = { ...form.value, ...res.data }
  } finally {
    loading.value = false
  }
})

async function save() {
  try {
    await cmsConfigApi.update(form.value)
    ElMessage.success('保存成功')
  } catch (e) {
    console.error(e)
  }
}
</script>
