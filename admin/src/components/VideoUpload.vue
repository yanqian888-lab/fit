<template>
  <div class="video-upload">
    <el-upload
      :http-request="doUpload"
      :show-file-list="false"
      accept="video/mp4,video/quicktime,video/webm,video/avi"
      :before-upload="beforeUpload"
    >
      <div class="upload-box" :style="{ width, height }">
        <video v-if="modelValue" :src="modelValue" class="preview" controls />
        <el-icon v-else class="plus"><VideoPlay /></el-icon>
        <div v-if="uploading" class="mask">上传中…</div>
      </div>
    </el-upload>
    <div class="side">
      <el-button v-if="modelValue" link type="danger" @click.stop="clear">清除</el-button>
      <span v-if="tip" class="tip">{{ tip }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoPlay } from '@element-plus/icons-vue'
import request from '@/api/request'

const props = defineProps({
  modelValue: { type: String, default: '' },
  width: { type: String, default: '160px' },
  height: { type: String, default: '96px' },
  tip: { type: String, default: '支持 MP4/MOV/WebM/AVI，最大 200MB' }
})
const emit = defineEmits(['update:modelValue'])

const uploading = ref(false)

function beforeUpload(file) {
  const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
  const ok = allowed.includes(file.type)
  if (!ok) ElMessage.error('仅支持 MP4/MOV/WebM/AVI 格式')
  return ok
}

async function doUpload({ file }) {
  const data = new FormData()
  data.append('video', file)
  uploading.value = true
  try {
    const res = await request.post('/cms/upload/video', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    emit('update:modelValue', res.data.url)
    ElMessage.success('上传成功')
  } catch (e) {
    // 错误提示由响应拦截器统一弹出
  } finally {
    uploading.value = false
  }
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.video-upload {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.upload-box {
  position: relative;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: #fafafa;
}
.upload-box:hover {
  border-color: #8ebb77;
}
.preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.plus {
  font-size: 22px;
  color: #909399;
}
.mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #606266;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tip {
  font-size: 12px;
  color: #909399;
}
</style>
