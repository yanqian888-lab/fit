<template>
  <div class="page-container">
    <h2 class="page-title">二维码管理</h2>
    <div class="card">
      <p style="color:#666;margin-bottom:20px;">
        上传小程序二维码/宣传二维码图片。上线后可在本页替换为正式小程序码，前端分享海报等位置会从这里读取最新图片。
      </p>

      <el-form label-width="120px" @submit.prevent>
        <el-form-item label="二维码图片">
          <ImageUpload v-model="mpQrcodeUrl" width="160px" height="160px" tip="建议尺寸 400×400，PNG/JPG" />
        </el-form-item>

        <el-form-item label="当前图片地址" v-if="mpQrcodeUrl">
          <el-input v-model="mpQrcodeUrl" readonly style="max-width: 480px;" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" native-type="button" :loading="saving" @click="save" v-perm="'app_config:write'">保存</el-button>
          <el-button native-type="button" @click="load">刷新</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cmsConfigApi } from '@/api/cms'
import ImageUpload from '@/components/ImageUpload.vue'

const mpQrcodeUrl = ref('')
const saving = ref(false)

async function load() {
  try {
    const res = await cmsConfigApi.get()
    mpQrcodeUrl.value = res.data?.mp_qrcode_url || ''
  } catch (e) {
    console.error(e)
  }
}

async function save() {
  saving.value = true
  try {
    await cmsConfigApi.update({ mp_qrcode_url: mpQrcodeUrl.value })
    ElMessage.success('保存成功')
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-title {
  margin-bottom: 16px;
  font-size: 20px;
  font-weight: 600;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}
</style>
