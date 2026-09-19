<template>
  <div class="page-container">
    <div class="card">
      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="食物名称" clearable style="width:220px;" />
        <el-select v-model="query.category" placeholder="分类" clearable style="width:160px;">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="query.source" placeholder="来源" clearable style="width:180px;">
          <el-option v-for="s in sources" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'food_lib:write'">新增</el-button>
      </div>
      <el-table :data="list" v-loading="loading" border empty-text="暂无内容" @filter-change="handleFilterChange">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="food_name" label="名称" />
        <el-table-column label="别名" min-width="200">
          <template #default="{ row }">
            <template v-if="parseAliases(row.aliases).length">
              <el-tag v-for="a in parseAliases(row.aliases)" :key="a" size="small" class="alias-tag">{{ a }}</el-tag>
            </template>
            <span v-else class="alias-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="category"
          label="分类"
          width="140"
          column-key="category"
          :filters="categoryFilters"
          :filter-multiple="false"
        />
        <el-table-column prop="calories_per_100g" label="热量/100g" width="120" />
        <el-table-column prop="protein_per_100g" label="蛋白质" width="90" />
        <el-table-column prop="carb_per_100g" label="碳水" width="90" />
        <el-table-column prop="fat_per_100g" label="脂肪" width="90" />
        <el-table-column label="来源" width="150">
          <template #default="{ row }">
            <el-tag size="small">{{ sourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'food_lib:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'food_lib:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑食物' : '新增食物'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称"><el-input v-model="form.food_name" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="form.category" /></el-form-item>
        <el-form-item label="子分类"><el-input v-model="form.sub_category" /></el-form-item>
        <el-form-item label="别名">
          <el-select v-model="form.aliases" multiple filterable allow-create default-first-option placeholder="输入别名后回车添加">
            <el-option v-for="a in form.aliases" :key="a" :label="a" :value="a" />
          </el-select>
          <div class="form-tip">用户口语可能用这些别名匹配到此食物</div>
        </el-form-item>
        <el-form-item label="热量/100g"><el-input-number v-model="form.calories_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="蛋白质"><el-input-number v-model="form.protein_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="碳水"><el-input-number v-model="form.carb_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="脂肪"><el-input-number v-model="form.fat_per_100g" :precision="2" /></el-form-item>
        <el-form-item label="常见单位"><el-input v-model="form.common_unit" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsFoodApi } from '@/api/cms'
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
const categories = ref([])
const sources = ref([])
const query = ref({ keyword: '', category: '', source: '', page: 1, size: 20 })
const dialogVisible = ref(false)
const form = ref({ food_name: '', category: '', sub_category: '', calories_per_100g: 0, protein_per_100g: 0, carb_per_100g: 0, fat_per_100g: 0, common_unit: '', remark: '', aliases: [] })

onMounted(load)

const categoryFilters = computed(() => categories.value.map(c => ({ text: c, value: c })))

async function load() {
  loading.value = true
  try {
    const res = await cmsFoodApi.list(query.value)
    list.value = res.data.list
    total.value = res.data.pagination.total
    categories.value = res.data.categories || []
    sources.value = res.data.sources || []
  } finally {
    loading.value = false
  }
}

/**
 * 来源值 → 展示文本（与后端 SOURCE_LABELS 保持一致）
 * @param {string} source - 数据库 source 字段值，如 'cnfood6'、'来自网络ai选取'
 * @returns {string} 展示文本，未匹配的中文值原样返回，空值兜底为「本身」
 */
function sourceLabel(source) {
  const labels = {
    builtin: '本身',
    legacy: '本身',
    cnfood6: '中国食物成分表第6版',
    'cn-brands': '品牌官方数据',
    user: '用户创建',
    web_learned: '网络学习'
  }
  if (!source) return '本身'
  return labels[source] || source
}

function handleFilterChange(filters) {
  if (filters.category) {
    query.value.category = filters.category[0] || ''
  }
  query.value.page = 1
  load()
}

function reset() {
  query.value = { keyword: '', category: '', source: '', page: 1, size: 20 }
  load()
}

/**
 * 解析数据库 aliases JSON 字段为数组
 * @param {string|null} raw - 数据库存储的 JSON 字符串，如 '["青岛经典"]'
 * @returns {string[]} 别名数组，解析失败或空时返回空数组
 */
function parseAliases(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch {
    return []
  }
}

function openDialog(row = null) {
  if (row) {
    form.value = { ...row, aliases: parseAliases(row.aliases) }
  } else {
    form.value = { food_name: '', category: '', sub_category: '', calories_per_100g: 0, protein_per_100g: 0, carb_per_100g: 0, fat_per_100g: 0, common_unit: '', remark: '', aliases: [] }
  }
  dialogVisible.value = true
}

async function save() {
  try {
    if (form.value.id) {
      await cmsFoodApi.update(form.value.id, form.value)
    } else {
      await cmsFoodApi.create(form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    await cmsFoodApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}
</script>

<style scoped>
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.alias-tag {
  margin-right: 4px;
  margin-bottom: 2px;
}
.alias-empty {
  color: #c0c4cc;
  font-size: 12px;
}
.form-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
  margin-top: 4px;
}
</style>
