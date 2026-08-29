<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="成就名称" clearable style="width:220px;" />
        <el-select v-model="query.category" placeholder="分类" clearable style="width:180px;">
          <el-option-group v-for="g in groupedCategories" :key="g.group" :label="g.group">
            <el-option v-for="c in g.options" :key="c.key" :label="c.label" :value="c.key" />
          </el-option-group>
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'achievement_config:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="category" label="分类" width="130">
          <template #default="{ row }">
            <span>{{ categoryLabel(row.category) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="解锁条件" min-width="180">
          <template #default="{ row }">
            <span>{{ conditionSummary(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="reward_berries" label="浆果奖励" width="90" />
        <el-table-column prop="reward_flowers" label="花朵奖励" width="90" />
        <el-table-column label="徽章图标" width="80">
          <template #default="{ row }">
            <img :src="getFullUrl(row.badge_icon) || getFullUrl(DEFAULT_BADGE_ICON)" class="badge-thumb" />
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="is_enabled" label="启用" width="80">
          <template #default="{ row }"><el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '是' : '否' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'achievement_config:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'achievement_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑成就' : '新增成就'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="请选择成就分类" style="width:100%;" @change="onCategoryChange">
            <el-option-group v-for="g in groupedCategories" :key="g.group" :label="g.group">
              <el-option v-for="c in g.options" :key="c.key" :label="c.label" :value="c.key" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>

        <!-- 解锁条件：按分类渲染结构化表单项 -->
        <el-form-item label="解锁条件">
          <div style="width:100%;">
            <!-- 单阈值类 -->
            <div v-if="conditionType === 'threshold'" class="cond-row">
              <span class="cond-label">{{ thresholdDef.label }} ≥</span>
              <el-input-number v-model="cond.threshold" :min="1" :precision="thresholdDef.precision" />
              <span class="cond-unit">{{ thresholdDef.unit }}</span>
            </div>

            <!-- 达成目标体重 -->
            <div v-else-if="conditionType === 'none'" class="cond-tip">
              用户当前体重 ≤ 目标体重即自动解锁，无需配置条件
            </div>

            <!-- 习惯打卡 -->
            <div v-else-if="conditionType === 'habit'" class="cond-col">
              <div class="cond-row">
                <span class="cond-label">习惯类型</span>
                <el-select v-model="cond.habit_type" placeholder="请选择" style="width:180px;">
                  <el-option v-for="t in habitTypeOptions" :key="t.key" :label="t.label" :value="t.key" />
                </el-select>
              </div>
              <div class="cond-row">
                <span class="cond-label">连续打卡 ≥</span>
                <el-input-number v-model="cond.streak_days" :min="1" />
                <span class="cond-unit">天</span>
              </div>
              <div v-if="cond.habit_type === 'water'" class="cond-row">
                <span class="cond-label">每日饮水达标 ≥</span>
                <el-input-number v-model="cond.goal" :min="1" />
                <span class="cond-unit">ml（当天饮水量达到才算打卡成功）</span>
              </div>
            </div>

            <!-- 身体指标 / 围度变化 -->
            <div v-else-if="conditionType === 'body' || conditionType === 'measure'" class="cond-col">
              <div class="cond-row">
                <span class="cond-label">{{ conditionType === 'body' ? '身体指标' : '围度指标' }}</span>
                <el-select v-model="cond.metric" placeholder="请选择" style="width:180px;">
                  <el-option v-for="m in metricOptions" :key="m.key" :label="m.label" :value="m.key" />
                </el-select>
              </div>
              <div class="cond-row">
                <el-select v-model="cond.direction" style="width:100px;">
                  <el-option label="下降" value="decrease" />
                  <el-option label="上升" value="increase" />
                </el-select>
                <span class="cond-label">≥</span>
                <el-input-number v-model="cond.value" :min="0.1" :precision="1" />
                <span class="cond-unit">{{ conditionType === 'body' ? '%（相对首次记录）' : 'cm（相对首次记录）' }}</span>
              </div>
            </div>

            <!-- 特殊成就 -->
            <div v-else-if="conditionType === 'special'" class="cond-row">
              <span class="cond-label">特殊标识</span>
              <el-select v-model="cond.key" placeholder="请选择" style="width:260px;">
                <el-option v-for="s in specialKeyOptions" :key="s.key" :label="s.label" :value="s.key" />
              </el-select>
            </div>

            <div v-else class="cond-tip">请先选择分类</div>
          </div>
        </el-form-item>

        <el-form-item label="浆果奖励"><el-input-number v-model="form.reward_berries" :min="0" /></el-form-item>
        <el-form-item label="花朵奖励"><el-input-number v-model="form.reward_flowers" :min="0" /></el-form-item>
        <el-form-item label="徽章图标">
          <ImageUpload v-model="form.badge_icon" width="80px" height="80px" tip="建议 120×120px" />
          <div v-if="!form.badge_icon" class="default-badge-tip">未上传时使用默认图标</div>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.is_enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsAchievementConfigApi } from '@/api/cms'
import { useAuthStore } from '@/store/auth'
import ImageUpload from '@/components/ImageUpload.vue'
import { getFullUrl } from '@/config/env'

// 默认徽章图标放在后端静态资源目录，通过 API 域名访问
const DEFAULT_BADGE_ICON = '/static/image/icon/default_badge.png'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

// 旧版后端只下发 key 数组时的兜底中文名
const fallbackCategoryLabels = {
  weight_loss: '减重', weight_goal: '达成目标体重', body: '身体指标变化', measure: '围度变化',
  exercise_count: '累计运动次数', exercise_duration: '累计运动时长', exercise_calorie: '累计运动消耗',
  diet_days: '饮食记录天数', habit: '习惯打卡', streak: '连续签到',
  chat: '对话轮数', duration: '坚持使用天数', event_collection: '事件收集', recipe_collection: '食谱收集',
  special: '特殊成就', collection: '事件收集'
}

// 单阈值类分类的条件定义
const thresholdDefs = {
  weight_loss: { key: 'weight_loss', label: '累计减重', unit: 'kg', precision: 1 },
  streak: { key: 'checkin_streak', label: '连续签到', unit: '天', precision: 0 },
  duration: { key: 'used_days', label: '累计使用', unit: '天', precision: 0 },
  chat: { key: 'chat_count', label: '累计对话', unit: '轮', precision: 0 },
  exercise_count: { key: 'exercise_count', label: '累计运动次数', unit: '次', precision: 0 },
  exercise_duration: { key: 'exercise_duration', label: '累计运动时长', unit: '分钟', precision: 0 },
  exercise_calorie: { key: 'exercise_calorie', label: '累计运动消耗', unit: '千卡', precision: 0 },
  diet_days: { key: 'diet_days', label: '饮食记录', unit: '天', precision: 0 },
  event_collection: { key: 'event_count', label: '累计收集事件', unit: '个', precision: 0 },
  recipe_collection: { key: 'recipe_count', label: '累计收集食谱', unit: '个', precision: 0 }
}

const habitTypeOptions = [
  { key: 'water', label: '饮水' },
  { key: 'sleep', label: '睡眠' },
  { key: 'defecation', label: '排便' },
  { key: 'mood', label: '心情' }
]

const bodyMetricOptions = [
  { key: 'weight', label: '体重' },
  { key: 'body_fat', label: '体脂率' }
]

const measureMetricOptions = [
  { key: 'waist', label: '腰围' },
  { key: 'hip', label: '臀围' },
  { key: 'chest', label: '胸围' },
  { key: 'thigh', label: '大腿围' },
  { key: 'arm', label: '臂围' },
  { key: 'calf', label: '小腿围' }
]

const specialKeyOptions = [
  { key: 'first_fasting', label: '首次完成轻断食' },
  { key: 'fasting_streak_7', label: '连续 7 天完成轻断食' },
  { key: 'fasting_5_2_week', label: '单周完成 2 次 5:2 轻断食' }
]

const loading = ref(false)
const list = ref([])
const total = ref(0)
const categories = ref([]) // [{key, label, group}]
const query = ref({ keyword: '', category: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref({ name: '', category: '', description: '', reward_berries: 0, reward_flowers: 0, badge_icon: '', sort_order: 0, is_enabled: true })
// 结构化条件表单状态
const cond = ref({ threshold: null, habit_type: '', streak_days: null, goal: 2000, metric: '', direction: 'decrease', value: null, key: '' })

// 兼容旧后端（返回 key 字符串数组）与新后端（返回 {key,label,group}）
const normalizedCategories = computed(() =>
  categories.value.map(c => typeof c === 'string'
    ? { key: c, label: fallbackCategoryLabels[c] || c, group: '其他' }
    : c)
)

const groupedCategories = computed(() => {
  const groups = []
  for (const c of normalizedCategories.value) {
    let g = groups.find(item => item.group === c.group)
    if (!g) { g = { group: c.group || '其他', options: [] }; groups.push(g) }
    g.options.push(c)
  }
  return groups
})

function categoryLabel(key) {
  const hit = normalizedCategories.value.find(c => c.key === key)
  return hit ? hit.label : (fallbackCategoryLabels[key] || key)
}

const conditionType = computed(() => {
  const cat = form.value.category
  if (thresholdDefs[cat]) return 'threshold'
  if (cat === 'weight_goal') return 'none'
  if (cat === 'habit') return 'habit'
  if (cat === 'body') return 'body'
  if (cat === 'measure') return 'measure'
  if (cat === 'special') return 'special'
  return ''
})

const thresholdDef = computed(() => thresholdDefs[form.value.category] || {})
const metricOptions = computed(() => conditionType.value === 'body' ? bodyMetricOptions : measureMetricOptions)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsAchievementConfigApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
    categories.value = res.data.categories || []
  } finally { loading.value = false }
}

function reset() {
  query.value = { keyword: '', category: '', page: 1, size: 20 }
  load()
}

function parseConditionJson(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) || {} } catch (e) { return {} }
}

// 列表「解锁条件」列的人类可读摘要
function conditionSummary(row) {
  const c = parseConditionJson(row.condition_json)
  const cat = row.category
  if (thresholdDefs[cat]) {
    const def = thresholdDefs[cat]
    return c[def.key] !== undefined ? `${def.label} ≥ ${c[def.key]} ${def.unit}` : '未配置'
  }
  if (cat === 'weight_goal') return '体重 ≤ 目标体重'
  if (cat === 'habit') {
    const t = habitTypeOptions.find(o => o.key === c.habit_type)
    let s = `${t ? t.label : c.habit_type || '?'} 连续 ≥ ${c.streak_days ?? '?'} 天`
    if (c.habit_type === 'water' && c.goal) s += `（每日 ≥ ${c.goal}ml）`
    return s
  }
  if (cat === 'body' || cat === 'measure') {
    const opts = cat === 'body' ? bodyMetricOptions : measureMetricOptions
    const m = opts.find(o => o.key === c.metric)
    const unit = cat === 'body' ? '%' : 'cm'
    if (c.decrease_pct !== undefined || c.decrease_cm !== undefined) return `${m ? m.label : c.metric} 下降 ≥ ${c.decrease_pct ?? c.decrease_cm}${unit}`
    if (c.increase_pct !== undefined || c.increase_cm !== undefined) return `${m ? m.label : c.metric} 上升 ≥ ${c.increase_pct ?? c.increase_cm}${unit}`
    return '未配置'
  }
  if (cat === 'special') {
    const s = specialKeyOptions.find(o => o.key === c.key)
    return s ? s.label : (c.key || '未配置')
  }
  return '未配置'
}

function resetCond() {
  cond.value = { threshold: null, habit_type: '', streak_days: null, goal: 2000, metric: '', direction: 'decrease', value: null, key: '' }
}

function onCategoryChange() {
  // 切换分类时清空条件表单，避免跨分类残留
  resetCond()
}

function openDialog(row = null) {
  form.value = row
    ? { ...row, is_enabled: !!row.is_enabled }
    : { name: '', category: '', description: '', reward_berries: 0, reward_flowers: 0, badge_icon: '', sort_order: 0, is_enabled: true }
  resetCond()
  if (row) {
    const c = parseConditionJson(row.condition_json)
    const cat = row.category
    if (thresholdDefs[cat]) {
      cond.value.threshold = c[thresholdDefs[cat].key] ?? null
    } else if (cat === 'habit') {
      cond.value.habit_type = c.habit_type || ''
      cond.value.streak_days = c.streak_days ?? null
      cond.value.goal = c.goal ?? 2000
    } else if (cat === 'body' || cat === 'measure') {
      cond.value.metric = c.metric || ''
      if (c.increase_pct !== undefined || c.increase_cm !== undefined) {
        cond.value.direction = 'increase'
        cond.value.value = c.increase_pct ?? c.increase_cm
      } else {
        cond.value.direction = 'decrease'
        cond.value.value = c.decrease_pct ?? c.decrease_cm ?? null
      }
    } else if (cat === 'special') {
      cond.value.key = c.key || ''
    }
  }
  dialogVisible.value = true
}

// 由结构化表单组装 condition_json，返回 null 表示校验失败
function buildCondition() {
  const cat = form.value.category
  const type = conditionType.value
  if (type === 'threshold') {
    if (!cond.value.threshold || cond.value.threshold <= 0) return ElMessage.error(`请填写${thresholdDef.value.label}阈值`), null
    return { [thresholdDef.value.key]: cond.value.threshold }
  }
  if (type === 'none') return { weight_goal: true }
  if (type === 'habit') {
    if (!cond.value.habit_type) return ElMessage.error('请选择习惯类型'), null
    if (!cond.value.streak_days || cond.value.streak_days <= 0) return ElMessage.error('请填写连续打卡天数'), null
    const c = { habit_type: cond.value.habit_type, streak_days: cond.value.streak_days }
    if (cond.value.habit_type === 'water' && cond.value.goal) c.goal = cond.value.goal
    return c
  }
  if (type === 'body' || type === 'measure') {
    if (!cond.value.metric) return ElMessage.error('请选择指标'), null
    if (!cond.value.value || cond.value.value <= 0) return ElMessage.error('请填写变化数值'), null
    const suffix = type === 'body' ? 'pct' : 'cm'
    return { metric: cond.value.metric, [`${cond.value.direction === 'decrease' ? 'decrease' : 'increase'}_${suffix}`]: cond.value.value }
  }
  if (type === 'special') {
    if (!cond.value.key) return ElMessage.error('请选择特殊标识'), null
    return { key: cond.value.key }
  }
  ElMessage.error('请先选择分类')
  return null
}

async function save() {
  if (!form.value.name || !form.value.name.trim()) return ElMessage.error('请填写成就名称')
  if (!form.value.category) return ElMessage.error('请选择分类')
  const condition_json = buildCondition()
  if (!condition_json) return
  try {
    const data = { ...form.value, condition_json }
    if (data.id) await cmsAchievementConfigApi.update(data.id, data)
    else await cmsAchievementConfigApi.create(data)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) {
    const msg = e?.response?.data?.message || '保存失败'
    ElMessage.error(msg)
    console.error(e)
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsAchievementConfigApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}
</script>

<style scoped>
.pagination { margin-top: 16px; justify-content: flex-end; }
.badge-thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 8px;
  background: #f5f5f5;
}
.default-badge-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.cond-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.cond-col {
  display: flex;
  flex-direction: column;
}
.cond-label {
  color: #606266;
  white-space: nowrap;
}
.cond-unit {
  color: #909399;
  font-size: 12px;
  white-space: nowrap;
}
.cond-tip {
  color: #909399;
  font-size: 13px;
}
</style>
