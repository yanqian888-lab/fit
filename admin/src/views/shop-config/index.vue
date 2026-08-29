<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="商品名称" clearable style="width:220px;" />
        <el-select v-model="query.category" placeholder="分类" clearable style="width:140px;">
          <el-option v-for="cat in categories" :key="cat" :label="categoryLabel(cat)" :value="cat" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable style="width:120px;">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'shop_config:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="分类" width="110">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="price_berries" label="浆果价格" />
        <el-table-column prop="price_flowers" label="花朵价格" />
        <el-table-column prop="stock" label="库存" />
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }"><el-tag :type="row.status ? 'success' : 'info'">{{ row.status ? '启用' : '停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'shop_config:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'shop_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑商品' : '新增商品'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="分类">
          <el-select v-model="form.category" placeholder="请选择或输入新分类" filterable allow-create default-first-option>
            <el-option v-for="cat in categories" :key="cat" :label="categoryLabel(cat)" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="图标"><ImageUpload v-model="form.icon_url" /></el-form-item>
        <el-form-item label="浆果价格"><el-input-number v-model="form.price_berries" :min="0" /></el-form-item>
        <el-form-item label="花朵价格"><el-input-number v-model="form.price_flowers" :min="0" /></el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="form.stock" :min="-1" />
          <span class="form-tip" style="margin-left:12px;">-1 表示无限库存</span>
        </el-form-item>
        <el-form-item v-if="form.category === 'food'" label="掉落食谱">
          <el-switch v-model="effectForm.has_recipe" active-text="喂食可能掉落食谱" />
        </el-form-item>
        <template v-if="form.category === 'food' && effectForm.has_recipe">
          <el-form-item label="食谱标题"><el-input v-model="effectForm.recipe_title" /></el-form-item>
          <el-form-item label="食谱内容"><el-input v-model="effectForm.recipe_content" type="textarea" :rows="4" /></el-form-item>
        </template>
        <el-form-item v-if="form.category === 'equipment'" label="解锁跟练">
          <el-select v-model="effectForm.unlock_workout" placeholder="请选择跟练课程" clearable style="width:100%;">
            <el-option
              v-for="w in workouts"
              :key="w.workout_key"
              :label="w.name + (w.required_equipment_key ? '（需器材：' + w.required_equipment_key + '）' : '')"
              :value="w.workout_key"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.category === 'skin'" label="皮肤ID">
          <el-input v-model="effectForm.skin_id" placeholder="对应皮肤配置的 skin_id" />
        </el-form-item>
        <template v-if="form.category === 'prop'">
          <el-form-item label="缩短外出（分钟）"><el-input-number v-model="effectForm.reduce_explore_minutes" :min="0" /></el-form-item>
          <el-form-item label="提高稀有掉落"><el-input-number v-model="effectForm.increase_rare_drop" :min="0" :max="1" :precision="2" :step="0.05" /></el-form-item>
        </template>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.status" active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsShopConfigApi, cmsWorkoutConfigApi } from '@/api/cms'
import ImageUpload from '@/components/ImageUpload.vue'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const loading = ref(false)
const list = ref([])
const total = ref(0)
const categories = ref(['food', 'equipment', 'prop', 'skin'])
const query = ref({ keyword: '', category: '', status: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref({ category: '', name: '', description: '', icon_url: '', price_berries: 0, price_flowers: 0, stock: -1, sort_order: 0, status: true })
const emptyEffect = () => ({ has_recipe: false, recipe_title: '', recipe_content: '', unlock_workout: '', skin_id: '', reduce_explore_minutes: 0, increase_rare_drop: 0 })
const effectForm = ref(emptyEffect())
const workouts = ref([])

async function loadWorkouts() {
  try {
    const res = await cmsWorkoutConfigApi.list({ page: 1, size: 1000, status: '1' })
    workouts.value = (res.data.list || []).filter(w => w.status === 1 || w.status === '1')
  } catch (e) { console.error(e) }
}

// 把结构化效果字段组装成后端存储的 effect_json
function buildEffectJson() {
  const e = effectForm.value
  const cat = form.value.category
  if (cat === 'food') {
    const out = {}
    if (e.has_recipe && e.recipe_title) out.recipe = { title: e.recipe_title, content: e.recipe_content || '' }
    return out
  }
  if (cat === 'equipment') return e.unlock_workout ? { unlock_workout: e.unlock_workout } : {}
  if (cat === 'skin') return e.skin_id ? { skin_id: e.skin_id } : {}
  if (cat === 'prop') {
    const out = {}
    if (e.reduce_explore_minutes) out.reduce_explore_seconds = e.reduce_explore_minutes * 60
    if (e.increase_rare_drop) out.increase_rare_drop = e.increase_rare_drop
    return out
  }
  return {}
}

function parseEffect(json) {
  const e = emptyEffect()
  let data = {}
  // 后端返回的 effect_json 是 JSON 字符串，需要先解析
  if (typeof json === 'string') {
    try { data = JSON.parse(json) } catch (_) { data = {} }
  } else if (json && typeof json === 'object') {
    data = json
  }
  if (data.recipe) {
    e.has_recipe = true
    e.recipe_title = data.recipe.title || ''
    e.recipe_content = data.recipe.content || ''
  }
  e.unlock_workout = data.unlock_workout || ''
  e.skin_id = data.skin_id || ''
  e.reduce_explore_minutes = data.reduce_explore_seconds ? Math.round(data.reduce_explore_seconds / 60) : 0
  e.increase_rare_drop = data.increase_rare_drop || 0
  return e
}

const CATEGORY_LABELS = {
  food: '食物',
  equipment: '运动器材',
  prop: '道具',
  skin: '皮肤'
}

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || cat
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await cmsShopConfigApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
    categories.value = res.data.categories || ['food', 'equipment', 'prop', 'skin']
  } finally { loading.value = false }
}

function reset() {
  query.value = { keyword: '', category: '', status: '', page: 1, size: 20 }
  load()
}

function openDialog(row = null) {
  if (row) {
    form.value = { ...row, status: Boolean(row.status) }
    effectForm.value = parseEffect(row.effect_json)
  } else {
    form.value = { category: '', name: '', description: '', icon_url: '', price_berries: 0, price_flowers: 0, stock: -1, sort_order: 0, status: true }
    effectForm.value = emptyEffect()
  }
  loadWorkouts()
  dialogVisible.value = true
}

async function save() {
  try {
    const data = { ...form.value, status: form.value.status ? 1 : 0, effect_json: buildEffectJson() }
    if (data.id) await cmsShopConfigApi.update(data.id, data)
    else await cmsShopConfigApi.create(data)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) {
    console.error(e)
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsShopConfigApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}
</script>

<style scoped>
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
