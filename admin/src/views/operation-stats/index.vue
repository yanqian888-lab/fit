<template>
  <div class="page-container">
    <h2 class="page-title">运营数据看板</h2>

    <!-- 降级提示：任何一块数据加载异常都显示，提醒用户当前可能是默认值 -->
    <el-alert v-if="degraded" type="warning" :closable="true" style="margin-bottom: 16px;"
      title="部分数据加载失败，已显示默认值/空列表"
      description="请稍后点击上方「查询」按钮重试；若持续异常，请查看服务端日志排查具体的表/字段错误。"
      show-icon />

    <div class="card">
      <div class="search-bar">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="~"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          @change="loadAll"
        />
        <el-button type="primary" @click="loadAll">查询</el-button>
      </div>

      <h3>核心指标</h3>
      <div class="dashboard-cards">
        <div class="dashboard-card">
          <div class="dashboard-label">总用户数</div>
          <div class="dashboard-value">{{ dashboard.overview?.total_users ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">{{ isRange ? '期间新增' : '今日新增' }}</div>
          <div class="dashboard-value">{{ dashboard.overview?.today_new_users ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">{{ isRange ? '期间活跃' : '今日活跃(DAU)' }}</div>
          <div class="dashboard-value">{{ dashboard.overview?.today_active_users ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">{{ isRange ? '上周期活跃' : '昨日活跃' }}</div>
          <div class="dashboard-value">{{ dashboard.overview?.yesterday_active_users ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">{{ isRange ? '环比变化' : 'DAU 变化' }}</div>
          <div class="dashboard-value">{{ dashboard.overview?.dau_change_rate ?? 0 }}%</div>
        </div>
      </div>

      <h3 style="margin-top: 20px;">行为指标</h3>
      <div class="dashboard-cards">
        <div class="dashboard-card">
          <div class="dashboard-label">{{ isRange ? '期间签到人数' : '今日签到人数' }}</div>
          <div class="dashboard-value">{{ dashboard.overview?.today_checkin_users ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">签到率</div>
          <div class="dashboard-value">{{ dashboard.overview?.checkin_rate ?? 0 }}%</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">{{ isRange ? '期间记录人数' : '今日记录人数' }}</div>
          <div class="dashboard-value">{{ dashboard.overview?.today_record_users ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">记录率</div>
          <div class="dashboard-value">{{ dashboard.overview?.record_rate ?? 0 }}%</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">{{ isRange ? '期间互动人数' : '宠物互动人数' }}</div>
          <div class="dashboard-value">{{ dashboard.overview?.today_pet_interact_users ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">互动率</div>
          <div class="dashboard-value">{{ dashboard.overview?.pet_interact_rate ?? 0 }}%</div>
        </div>
      </div>

      <h3 style="margin-top: 20px;">公告漏斗</h3>
      <div class="dashboard-cards">
        <div class="dashboard-card">
          <div class="dashboard-label">总曝光</div>
          <div class="dashboard-value">{{ dashboard.announcement?.total_show ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">总点击</div>
          <div class="dashboard-value">{{ dashboard.announcement?.total_click ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">已读数</div>
          <div class="dashboard-value">{{ dashboard.announcement?.total_read ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">点击率</div>
          <div class="dashboard-value">{{ dashboard.announcement?.ctr ?? 0 }}%</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">读后率</div>
          <div class="dashboard-value">{{ dashboard.announcement?.read_rate ?? 0 }}%</div>
        </div>
      </div>

      <h3>弹窗漏斗</h3>
      <div class="dashboard-cards">
        <div class="dashboard-card">
          <div class="dashboard-label">总曝光</div>
          <div class="dashboard-value">{{ dashboard.popup?.total_show ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">总点击</div>
          <div class="dashboard-value">{{ dashboard.popup?.total_click ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">总关闭</div>
          <div class="dashboard-value">{{ dashboard.popup?.total_close ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">点击率</div>
          <div class="dashboard-value">{{ dashboard.popup?.ctr ?? 0 }}%</div>
        </div>
      </div>

      <h3>模板消息漏斗</h3>
      <div class="dashboard-cards">
        <div class="dashboard-card">
          <div class="dashboard-label">总发送</div>
          <div class="dashboard-value">{{ dashboard.template?.total_sent ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">已读数</div>
          <div class="dashboard-value">{{ dashboard.template?.total_read ?? 0 }}</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-label">读后率</div>
          <div class="dashboard-value">{{ dashboard.template?.read_rate ?? 0 }}%</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 20px;">
      <h3>公告明细</h3>
      <el-table :data="announcementList" border v-loading="loading.announcement">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="position" label="位置" width="120" />
        <el-table-column prop="show_count" label="曝光" width="90" />
        <el-table-column prop="click_count" label="点击" width="90" />
        <el-table-column prop="read_count" label="已读" width="90" />
        <el-table-column label="点击率" width="100">
          <template #default="{ row }">{{ row.ctr }}%</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="announcementQuery.page"
        v-model:page-size="announcementQuery.size"
        :total="announcementTotal"
        layout="total, prev, pager, next"
        @change="loadAnnouncements"
        style="margin-top: 16px;"
      />
    </div>

    <div class="card" style="margin-top: 20px;">
      <h3>弹窗明细</h3>
      <el-table :data="popupList" border v-loading="loading.popup">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="弹窗名称" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="show_count" label="曝光" width="90" />
        <el-table-column prop="click_count" label="点击" width="90" />
        <el-table-column prop="close_count" label="关闭" width="90" />
        <el-table-column label="点击率" width="100">
          <template #default="{ row }">{{ row.ctr }}%</template>
        </el-table-column>
        <el-table-column label="关闭渠道" width="220">
          <template #default="{ row }">
            按钮{{ row.close_btn }} / 蒙层{{ row.mask }} / 返回{{ row.back }} / 滑动{{ row.swipe }}
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="popupQuery.page"
        v-model:page-size="popupQuery.size"
        :total="popupTotal"
        layout="total, prev, pager, next"
        @change="loadPopups"
        style="margin-top: 16px;"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cmsOperationStatsApi } from '../../api/cms'

const dateRange = ref([])

/**
 * 默认的 dashboard 数据结构（API 未返回的字段用默认值兜底，避免 undefined 报错）
 */
const DEFAULT_DASHBOARD = {
  overview: {
    total_users: 0,
    today_new_users: 0,
    today_active_users: 0,
    yesterday_active_users: 0,
    dau_change_rate: 0,
    today_checkin_users: 0,
    checkin_rate: 0,
    today_record_users: 0,
    record_rate: 0,
    today_pet_interact_users: 0,
    pet_interact_rate: 0
  },
  announcement: { total_show: 0, total_click: 0, total_read: 0, ctr: 0, read_rate: 0 },
  popup: { total_show: 0, total_click: 0, total_close: 0, ctr: 0 },
  template: { total_sent: 0, total_read: 0, read_rate: 0 }
}

const dashboard = ref({ ...DEFAULT_DASHBOARD })

// 是否处于后端异常降级（已用默认值填充），true 时页面顶部给一条友好提示
const degraded = ref(false)

const loading = reactive({ announcement: false, popup: false })

const announcementList = ref([])
const announcementTotal = ref(0)
const announcementQuery = reactive({ page: 1, size: 10 })

const popupList = ref([])
const popupTotal = ref(0)
const popupQuery = reactive({ page: 1, size: 10 })

// 是否处于日期范围筛选（切换卡片文案：今日→期间，昨日→上周期）
const isRange = computed(() => !!(dateRange.value && dateRange.value.length === 2))

function dateParams() {
  if (!dateRange.value || dateRange.value.length !== 2) return {}
  return { start_date: dateRange.value[0], end_date: dateRange.value[1] }
}

/**
 * 合并默认数据与 API 返回数据，确保所有层级字段都存在
 */
function mergeDashboard(apiData = {}) {
  return {
    overview: { ...DEFAULT_DASHBOARD.overview, ...(apiData.overview || {}) },
    announcement: { ...DEFAULT_DASHBOARD.announcement, ...(apiData.announcement || {}) },
    popup: { ...DEFAULT_DASHBOARD.popup, ...(apiData.popup || {}) },
    template: { ...DEFAULT_DASHBOARD.template, ...(apiData.template || {}) }
  }
}

/**
 * 格式化错误消息，避免 axios 错误对象直接 toString 出现 [object Object]
 */
function formatErrMsg(e, fallback = '数据加载失败，已显示默认值') {
  if (!e) return fallback
  if (typeof e === 'string') return e
  return e?.message || e?.msg || fallback
}

async function loadDashboard() {
  try {
    const res = await cmsOperationStatsApi.dashboard(dateParams())
    // 再做一层防御：res 可能是 { code, data, message }，也可能因为 request 拦截器解包方式不同略有差异
    const payload = res?.data !== undefined ? res.data : res
    dashboard.value = mergeDashboard(payload || {})
  } catch (e) {
    console.error('[运营数据] 加载看板失败:', e)
    dashboard.value = mergeDashboard({})
    degraded.value = true
    ElMessage.warning('核心指标加载异常：' + formatErrMsg(e, '已显示默认 0 值，请稍后重试'))
  }
}

async function loadAnnouncements() {
  loading.announcement = true
  try {
    const res = await cmsOperationStatsApi.announcements({ ...dateParams(), ...announcementQuery })
    const payload = res?.data !== undefined ? res.data : res
    announcementList.value = payload?.list || []
    announcementTotal.value = payload?.pagination?.total ?? 0
  } catch (e) {
    console.error('[运营数据] 加载公告明细失败:', e)
    announcementList.value = []
    announcementTotal.value = 0
    degraded.value = true
    ElMessage.warning('公告明细加载异常：' + formatErrMsg(e, '已显示空列表'))
  } finally {
    loading.announcement = false
  }
}

async function loadPopups() {
  loading.popup = true
  try {
    const res = await cmsOperationStatsApi.popups({ ...dateParams(), ...popupQuery })
    const payload = res?.data !== undefined ? res.data : res
    popupList.value = payload?.list || []
    popupTotal.value = payload?.pagination?.total ?? 0
  } catch (e) {
    console.error('[运营数据] 加载弹窗明细失败:', e)
    popupList.value = []
    popupTotal.value = 0
    degraded.value = true
    ElMessage.warning('弹窗明细加载异常：' + formatErrMsg(e, '已显示空列表'))
  } finally {
    loading.popup = false
  }
}

function loadAll() {
  degraded.value = false
  announcementQuery.page = 1
  popupQuery.page = 1
  loadDashboard()
  loadAnnouncements()
  loadPopups()
}

onMounted(loadAll)
</script>

<style scoped>
.page-container {
  padding: 20px;
}
.page-title {
  margin-bottom: 16px;
  font-size: 20px;
  font-weight: 600;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  margin: 16px 0 24px;
}
.dashboard-card {
  background: #f7f9fc;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.dashboard-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}
.dashboard-value {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}
h3 {
  margin: 16px 0 8px;
  font-size: 16px;
  font-weight: 600;
}
</style>
