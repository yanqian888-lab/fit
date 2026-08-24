<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="课程标识/名称/描述" clearable style="width:220px;" />
        <el-select v-model="query.category" placeholder="分类" clearable style="width:140px;">
          <el-option label="有氧" value="aerobic" />
          <el-option label="拉伸" value="stretch" />
          <el-option label="力量" value="strength" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable style="width:120px;">
          <el-option label="已上架" value="1" />
          <el-option label="已下架" value="0" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'workout_config:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="workout_key" label="课程标识" show-overflow-tooltip />
        <el-table-column prop="name" label="课程名称" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="90">
          <template #default="{ row }"><el-tag>{{ categoryLabel(row.category) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="时长" width="130">
          <template #default="{ row }">
            <span v-if="row.duration_mode === 'unlimited'">不限时长</span>
            <span v-else>{{ row.set_minutes }}分钟 × {{ row.sets_count || 1 }}组<template v-if="row.rest_seconds">（休{{ row.rest_seconds }}秒）</template></span>
          </template>
        </el-table-column>
        <el-table-column label="消耗" width="120">
          <template #default="{ row }">{{ row.calorie_per_hour || 0 }} 千卡/小时</template>
        </el-table-column>
        <el-table-column label="所需器材" width="120">
          <template #default="{ row }">{{ equipmentName(row.required_item_id) }}</template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }"><el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '已上架' : '已下架' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'workout_config:write'">编辑</el-button>
            <el-button link :type="row.status ? 'warning' : 'success'" @click="toggle(row)" v-perm="'workout_config:write'">{{ row.status ? '下架' : '上架' }}</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'workout_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑课程' : '新增课程'" width="600px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="课程标识" required><el-input v-model="form.workout_key" placeholder="唯一标识，如 hiit_beginner_01" /></el-form-item>
        <el-form-item label="课程名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="请选择">
            <el-option label="有氧" value="aerobic" />
            <el-option label="拉伸" value="stretch" />
            <el-option label="力量" value="strength" />
          </el-select>
        </el-form-item>
        <el-form-item label="视频"><VideoUpload v-model="form.video_url" /></el-form-item>
        <el-form-item label="封面"><ImageUpload v-model="form.cover_url" /></el-form-item>
        <el-form-item label="时长模式" required>
          <el-radio-group v-model="form.duration_mode">
            <el-radio label="unlimited">不限时长</el-radio>
            <el-radio label="sets">定时分组</el-radio>
          </el-radio-group>
          <div style="color:#909399;font-size:12px;line-height:1.6;">不限时长：用户手动开始/结束，秒表正计时，不支持多组配置</div>
        </el-form-item>
        <template v-if="form.duration_mode === 'sets'">
          <el-form-item label="每组时长" required>
            <el-select v-model="form.set_minutes" style="width:160px;">
              <el-option v-for="m in [1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60]" :key="m" :label="`${m} 分钟`" :value="m" />
            </el-select>
          </el-form-item>
          <el-form-item label="组数" required>
            <el-input-number v-model="form.sets_count" :min="1" :max="20" />
          </el-form-item>
          <el-form-item label="组间休息">
            <el-input-number v-model="form.rest_seconds" :min="0" :max="600" />
            <span style="margin-left:8px;color:#909399;font-size:12px;">秒</span>
          </el-form-item>
        </template>
        <el-form-item label="消耗" required>
          <el-input-number v-model="form.calorie_per_hour" :min="0" :max="2000" />
          <span style="margin-left:8px;color:#909399;font-size:12px;">千卡/小时，按实际跟练时长折算</span>
        </el-form-item>
        <el-form-item label="关联运动">
          <el-select v-model="form.exercise_id" placeholder="不关联" clearable filterable style="width:100%;">
            <el-option v-for="ex in exerciseOptions" :key="ex.id" :label="`${ex.exercise_name}（${ex.calorie_per_hour} 千卡/小时）`" :value="ex.id" />
          </el-select>
          <div style="color:#909399;font-size:12px;line-height:1.6;">从运动库选择；关联后跟练记录的消耗按该运动的每小时消耗计算，上方「消耗」作为未关联时的兜底</div>
        </el-form-item>
        <el-form-item label="所需器材">
          <el-select v-model="form.required_item_id" placeholder="无（所有用户可跟练）" clearable style="width:100%;">
            <el-option v-for="item in equipmentItems" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <div style="color:#909399;font-size:12px;line-height:1.6;">从商店「运动器材」商品中选择，用户购买该器材后自动解锁此运动和跟练</div>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="上架"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsWorkoutConfigApi, cmsShopConfigApi, cmsExerciseApi } from '@/api/cms'
import ImageUpload from '@/components/ImageUpload.vue'
import VideoUpload from '@/components/VideoUpload.vue'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const CATEGORY_MAP = { aerobic: '有氧', stretch: '拉伸', strength: '力量' }
const defaultForm = () => ({
  workout_key: '', name: '', category: 'aerobic', video_url: '', cover_url: '',
  duration_mode: 'sets', set_minutes: 5, sets_count: 1, rest_seconds: 30, calorie_per_hour: 0,
  required_item_id: null, exercise_id: null, description: '', sort_order: 0, status: 1
})

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const query = ref({ keyword: '', category: '', status: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref(defaultForm())
const equipmentItems = ref([])
const exerciseOptions = ref([])

onMounted(() => {
  load()
  loadEquipment()
  loadExerciseOptions()
})

async function loadEquipment() {
  try {
    const res = await cmsShopConfigApi.list({ page: 1, size: 100, category: 'equipment' })
    equipmentItems.value = res.data.list || []
  } catch (e) { console.error(e) }
}

async function loadExerciseOptions() {
  try {
    const res = await cmsExerciseApi.list({ page: 1, size: 500 })
    exerciseOptions.value = res.data.list || []
  } catch (e) { console.error(e) }
}

function categoryLabel(c) {
  return CATEGORY_MAP[c] || c
}

function equipmentName(itemId) {
  if (!itemId) return '无'
  const hit = equipmentItems.value.find(i => i.id === itemId)
  return hit ? hit.name : `#${itemId}`
}

async function load() {
  loading.value = true
  try {
    const res = await cmsWorkoutConfigApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally { loading.value = false }
}

function reset() {
  query.value = { keyword: '', category: '', status: '', page: 1, size: 20 }
  load()
}

async function openDialog(row = null) {
  if (!row) {
    form.value = defaultForm()
    dialogVisible.value = true
    return
  }
  try {
    const res = await cmsWorkoutConfigApi.detail(row.id)
    form.value = { ...defaultForm(), ...res.data }
    dialogVisible.value = true
  } catch (e) { console.error(e) }
}

async function save() {
  if (!form.value.workout_key || !form.value.workout_key.trim()) {
    ElMessage.warning('课程标识不能为空')
    return
  }
  if (!form.value.name || !form.value.name.trim()) {
    ElMessage.warning('课程名称不能为空')
    return
  }
  if (form.value.duration_mode === 'sets' && (!form.value.set_minutes || !form.value.sets_count)) {
    ElMessage.warning('定时分组课程必须配置每组时长和组数')
    return
  }
  saving.value = true
  try {
    const data = { ...form.value }
    if (data.id) await cmsWorkoutConfigApi.update(data.id, data)
    else await cmsWorkoutConfigApi.create(data)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) {
    console.error(e)
  } finally { saving.value = false }
}

async function toggle(row) {
  try {
    const res = await cmsWorkoutConfigApi.toggleStatus(row.id)
    ElMessage.success(res.message || (row.status ? '已下架' : '已上架'))
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除课程「${row.name}」？`, '提示', { type: 'warning' })
    await cmsWorkoutConfigApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}
</script>

<style scoped>
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
