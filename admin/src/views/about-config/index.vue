<template>
  <div class="page-container">
    <div class="card">
      <h3 style="margin-bottom:20px;">关于我们</h3>
      <el-form :model="form" label-position="top" v-loading="loading">
        <el-form-item label="关于我们内容">
          <el-input v-model="form.about_us_content" type="textarea" :rows="12" />
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
const form = ref({ about_us_content: '' })

onMounted(async () => {
  loading.value = true
  try {
    const res = await cmsConfigApi.get()
    form.value.about_us_content = res.data.about_us_content || ''
  } finally {
    loading.value = false
  }
})

async function save() {
  try {
    await cmsConfigApi.update({ about_us_content: form.value.about_us_content })
    ElMessage.success('保存成功')
  } catch (e) {
    console.error(e)
  }
}
</script>
