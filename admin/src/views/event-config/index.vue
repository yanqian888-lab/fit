<template>
  <div class="page-container">
    <div class="card">
      <div class="coll-bar">
        <el-tabs v-model="activeColl" @tab-change="onCollChange">
          <el-tab-pane v-for="c in collections" :key="c.coll_key" :label="c.name" :name="c.coll_key" />
        </el-tabs>
        <div class="coll-actions">
          <el-button size="small" type="success" @click="openCollDialog()" v-perm="'event_config:write'">+ 新建事件集</el-button>
          <template v-if="currentCollection">
            <el-button size="small" @click="openCollDialog(currentCollection)" v-perm="'event_config:write'">编辑事件集</el-button>
            <el-button size="small" type="danger" @click="removeCollection" v-perm="'event_config:write'">删除事件集</el-button>
          </template>
        </div>
      </div>

      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="标题/标识" clearable style="width:200px;" @change="load" />
        <el-select v-model="query.location" placeholder="发生地点" clearable style="width:140px;" @change="load">
          <el-option label="居家" value="home" />
          <el-option label="外出" value="explore" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button type="success" @click="openDialog()" v-perm="'event_config:write'">新增事件</el-button>
      </div>

      <el-table :data="list" v-loading="loading" border empty-text="该事件集下暂无事件">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="event_key" label="标识" width="130" show-overflow-tooltip />
        <el-table-column prop="title" label="标题" show-overflow-tooltip />
        <el-table-column prop="content" label="说明" show-overflow-tooltip />
        <el-table-column label="图片" width="70">
          <template #default="{ row }">
            <el-image v-if="row.first_photo || row.image_url" :src="row.first_photo || row.image_url" fit="cover" style="width:44px;height:44px;border-radius:6px;" :preview-src-list="[row.first_photo || row.image_url]" preview-teleported />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="weight" label="概率权重" width="90">
          <template #default="{ row }">{{ row.weight ?? 1 }}</template>
        </el-table-column>
        <el-table-column label="必要条件" width="130">
          <template #default="{ row }">{{ row.required_item_name || '无' }}</template>
        </el-table-column>
        <el-table-column label="优先掉落" width="160">
          <template #default="{ row }">
            <el-tag v-if="row.priority_start_date" type="danger">{{ row.priority_start_date }} ~ {{ row.priority_end_date || row.priority_start_date }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="发生地点" width="100">
          <template #default="{ row }">
            <el-tag :type="row.location === 'home' ? 'success' : 'warning'">{{ row.location === 'home' ? '居家' : '外出' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="外出时长" width="90">
          <template #default="{ row }">{{ row.location === 'explore' ? (row.explore_minutes ? row.explore_minutes + '分钟' : '-') : '-' }}</template>
        </el-table-column>
        <el-table-column prop="is_enabled" label="启用" width="80">
          <template #default="{ row }"><el-tag :type="row.is_enabled ? 'success' : 'info'">{{ row.is_enabled ? '是' : '否' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" v-perm="'event_config:write'">编辑</el-button>
            <el-button link type="danger" @click="remove(row)" v-perm="'event_config:write'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="total, prev, pager, next" class="pagination" @change="load" />
    </div>

    <!-- 事件编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑事件' : '新增事件'" width="640px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="事件标识"><el-input v-model="form.event_key" placeholder="如 sunset_cloud" :disabled="!!form.id" /></el-form-item>
        <el-form-item label="事件集">
          <el-select v-model="form.type" style="width:240px;">
            <el-option v-for="c in collections" :key="c.coll_key" :label="c.name" :value="c.coll_key" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.content" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="事件照片">
          <div class="photo-list">
            <div v-for="(p, idx) in form.photos" :key="p.id || p.photo_url || idx" class="photo-item">
              <el-image :src="p.photo_url" fit="cover" style="width:64px;height:64px;border-radius:6px;" />
              <div class="photo-fields">
                <el-input v-model="p.photo_url" placeholder="照片地址" size="small" />
                <div class="photo-actions">
                  <el-input-number v-model="p.sort_order" :min="0" size="small" style="width:90px;" />
                  <el-switch v-model="p.is_enabled" :active-value="1" :inactive-value="0" active-text="启用" />
                  <el-button link type="danger" size="small" @click="removePhoto(idx)">删除</el-button>
                </div>
              </div>
            </div>
            <div class="photo-add">
              <ImageUpload v-model="pendingPhotoUrl" width="64px" height="64px" />
              <el-button type="primary" size="small" :disabled="!pendingPhotoUrl" @click="addPhoto">添加照片</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="概率权重">
          <el-input-number v-model="form.weight" :min="0" :max="10" />
          <span class="form-tip">0-10，数字越大概率越大；相同数字跨事件集随机</span>
        </el-form-item>
        <el-form-item label="必要条件">
          <el-select v-model="form.required_item_id" placeholder="无（默认所有用户可掉落）" clearable filterable style="width:280px;">
            <el-option v-for="item in shopItems" :key="item.id" :label="`${item.name}（${SHOP_CATEGORY_LABELS[item.category] || item.category}）`" :value="item.id" />
          </el-select>
          <span class="form-tip">选择后，用户背包持有该物品才可掉落</span>
        </el-form-item>
        <el-form-item label="优先掉落日期">
          <el-date-picker
            v-model="priorityRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            clearable
            style="width:280px;"
          />
          <span class="form-tip">有效期内用户进搭搭页必优先掉落（占每日掉落额度），留空则不参与</span>
        </el-form-item>
        <el-form-item label="发生地点">
          <el-radio-group v-model="form.location">
            <el-radio label="home">居家</el-radio>
            <el-radio label="explore">外出</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.location === 'explore'" label="外出时长" required>
          <el-input-number v-model="form.explore_minutes" :min="1" :max="1440" />
          <span class="form-tip">分钟，用户宠物外出到掉落该事件的时长</span>
        </el-form-item>
        <el-form-item label="掉落奖励">
          <span style="margin-right:8px;">浆果</span>
          <el-input-number v-model="rewardBerries" :min="0" style="width:110px;" />
          <span style="margin:0 8px;">鲜花</span>
          <el-input-number v-model="rewardFlowers" :min="0" style="width:110px;" />
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.is_enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 事件集编辑弹窗 -->
    <el-dialog v-model="collDialogVisible" :title="collForm.id ? '编辑事件集' : '新建事件集'" width="480px">
      <el-form :model="collForm" label-width="90px">
        <el-form-item label="标识 key"><el-input v-model="collForm.coll_key" placeholder="如 dopamine" :disabled="!!collForm.id" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="collForm.name" placeholder="如 消除多巴胺" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="collForm.sort_order" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="collDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCollection">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cmsEventConfigApi, cmsShopConfigApi } from '@/api/cms'
import ImageUpload from '@/components/ImageUpload.vue'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

// ==================== 事件集 ====================
const collections = ref([])
const activeColl = ref('')
const collDialogVisible = ref(false)
const collForm = ref({ coll_key: '', name: '', sort_order: 0 })

const currentCollection = computed(() => collections.value.find(c => c.coll_key === activeColl.value) || null)

async function loadCollections() {
  try {
    const res = await cmsEventConfigApi.getCollections()
    collections.value = res.data.list || []
    if (!activeColl.value && collections.value.length > 0) {
      activeColl.value = collections.value[0].coll_key
    }
  } catch (e) { console.error(e) }
}

function openCollDialog(row = null) {
  collForm.value = row ? { ...row } : { coll_key: '', name: '', sort_order: 0 }
  collDialogVisible.value = true
}

async function saveCollection() {
  const f = collForm.value
  if (!f.coll_key || !f.name) return ElMessage.error('请填写事件集标识和名称')
  try {
    if (f.id) await cmsEventConfigApi.updateCollection(f.id, f)
    else await cmsEventConfigApi.createCollection(f)
    ElMessage.success('保存成功')
    collDialogVisible.value = false
    const prev = activeColl.value
    await loadCollections()
    if (!f.id) activeColl.value = f.coll_key
    else activeColl.value = prev
    load()
  } catch (e) { console.error(e) }
}

async function removeCollection() {
  const c = currentCollection.value
  if (!c) return
  try {
    await ElMessageBox.confirm(`确认删除事件集「${c.name}」？集合下有事件时无法删除`, '提示', { type: 'warning' })
    await cmsEventConfigApi.removeCollection(c.id)
    ElMessage.success('删除成功')
    activeColl.value = ''
    await loadCollections()
    load()
  } catch (e) {}
}

// ==================== 事件 ====================
const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = ref({ keyword: '', location: '', page: 1, size: 20 })
const shopItems = ref([])
const SHOP_CATEGORY_LABELS = { food: '食物', equipment: '运动器材', prop: '道具', skin: '皮肤' }

const dialogVisible = ref(false)
const form = ref(emptyForm())
// 优先掉落日期范围（daterange 组件绑定，保存时拆成 priority_start_date/priority_end_date）
const priorityRange = ref([])
const rewardBerries = ref(0)
const rewardFlowers = ref(0)
const pendingPhotoUrl = ref('')

function emptyForm() {
  return { event_key: '', type: activeColl.value || '', title: '', content: '', photos: [], weight: 1, required_item_id: null, location: 'explore', explore_minutes: 120, priority_start_date: null, priority_end_date: null, is_enabled: true }
}

onMounted(async () => {
  await loadCollections()
  load()
  loadShopItems()
})

function onCollChange() {
  query.value.page = 1
  load()
}

async function loadShopItems() {
  // 后端单页上限 100，分页拉全量，保证道具/皮肤等所有条目都能被检索绑定
  try {
    const all = []
    let page = 1
    while (true) {
      const res = await cmsShopConfigApi.list({ page, size: 100 })
      const list = res.data.list || []
      all.push(...list)
      if (!res.data.pagination || !res.data.pagination.has_more) break
      page++
    }
    shopItems.value = all
  } catch (e) { console.error(e) }
}

async function load() {
  loading.value = true
  try {
    const res = await cmsEventConfigApi.list({ ...query.value, type: activeColl.value })
    list.value = res.data.list
    total.value = res.data.pagination.total
  } finally { loading.value = false }
}

function parseRewardJson(row) {
  let reward = {}
  if (row.reward_json) {
    reward = typeof row.reward_json === 'object' ? row.reward_json : JSON.parse(row.reward_json)
  }
  return reward || {}
}

async function openDialog(row = null) {
  pendingPhotoUrl.value = ''
  if (row) {
    try {
      const res = await cmsEventConfigApi.getById(row.id)
      const detail = res.data
      form.value = {
        ...detail,
        weight: detail.weight ?? 1,
        location: detail.location || 'explore',
        explore_minutes: detail.explore_minutes || 30,
        is_enabled: !!detail.is_enabled,
        photos: Array.isArray(detail.photos) ? detail.photos.map(p => ({ ...p, is_enabled: Number(p.is_enabled) })) : []
      }
      priorityRange.value = detail.priority_start_date ? [detail.priority_start_date, detail.priority_end_date || detail.priority_start_date] : []
      const reward = parseRewardJson(detail)
      rewardBerries.value = reward.berries || 0
      rewardFlowers.value = reward.flowers || 0
    } catch (e) {
      console.error(e)
      ElMessage.error('加载事件详情失败')
    }
  } else {
    form.value = emptyForm()
    priorityRange.value = []
    rewardBerries.value = 1
    rewardFlowers.value = 0
  }
  dialogVisible.value = true
}

function addPhoto() {
  if (!pendingPhotoUrl.value) return
  form.value.photos.push({
    photo_url: pendingPhotoUrl.value,
    sort_order: form.value.photos.length,
    is_enabled: 1
  })
  pendingPhotoUrl.value = ''
}

function removePhoto(idx) {
  form.value.photos.splice(idx, 1)
}

async function save() {
  const f = form.value
  if (!f.event_key || !f.title) return ElMessage.error('请填写事件标识和标题')
  if (!f.type) return ElMessage.error('请选择事件集')
  if (f.location === 'explore' && (!f.explore_minutes || f.explore_minutes <= 0)) return ElMessage.error('外出事件必须配置外出时长')
  // 已上传但没点「添加照片」的图，保存时自动收进照片列表，避免丢失
  if (pendingPhotoUrl.value) {
    f.photos.push({ photo_url: pendingPhotoUrl.value, sort_order: f.photos.length, is_enabled: 1 })
    pendingPhotoUrl.value = ''
  }
  const reward_json = {}
  if (rewardBerries.value) reward_json.berries = rewardBerries.value
  if (rewardFlowers.value) reward_json.flowers = rewardFlowers.value
  // 优先掉落日期范围拆为起止字段；清空则不参与优先掉落
  f.priority_start_date = priorityRange.value && priorityRange.value[0] ? priorityRange.value[0] : null
  f.priority_end_date = priorityRange.value && priorityRange.value[1] ? priorityRange.value[1] : (f.priority_start_date || null)
  try {
    const data = { ...f, reward_json }
    if (f.id) await cmsEventConfigApi.update(f.id, data)
    else await cmsEventConfigApi.create(data)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } catch (e) { console.error(e) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除该事件？', '提示', { type: 'warning' })
    await cmsEventConfigApi.remove(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {}
}
</script>

<style scoped>
.coll-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.coll-bar :deep(.el-tabs) {
  flex: 1;
}
.coll-bar :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.coll-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}
.form-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
.pagination { margin-top: 16px; justify-content: flex-end; }
.photo-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.photo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
}
.photo-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.photo-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.photo-add {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
