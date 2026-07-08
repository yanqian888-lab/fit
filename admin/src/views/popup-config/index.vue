<template>
  <div class="page-container">
    <h2 class="page-title">弹窗广告管理</h2>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 弹窗管理 -->
      <el-tab-pane label="弹窗管理" name="popup">
        <div class="card">
          <div class="search-bar">
            <el-input v-model="popupQuery.keyword" placeholder="弹窗名称/关键词" clearable style="width: 220px;" />
            <el-select v-model="popupQuery.type" placeholder="广告类型" clearable style="width: 120px;">
              <el-option label="系统通知" value="system" />
              <el-option label="运营广告" value="operational" />
              <el-option label="版本提醒" value="version" />
              <el-option label="活动公告" value="activity" />
            </el-select>
            <el-select v-model="popupQuery.status" placeholder="状态" clearable style="width: 120px;">
              <el-option label="草稿" value="draft" />
              <el-option label="已启用" value="enabled" />
              <el-option label="已停用" value="disabled" />
            </el-select>
            <el-button type="primary" @click="loadPopups">查询</el-button>
            <el-button v-perm="'popup_config:write'" type="success" @click="openPopupDialog()">新增弹窗</el-button>
          </div>

          <el-table :data="popupList" border v-loading="popupLoading" @selection-change="handlePopupSelectionChange">
            <el-table-column type="selection" width="55" v-perm="'popup_config:write'" />
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="name" label="弹窗名称" show-overflow-tooltip />
            <el-table-column prop="style" label="样式" width="90">
              <template #default="{ row }">
                {{ row.style === 'center' ? '居中弹窗' : '顶部弹窗' }}
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                {{ { system: '系统通知', operational: '运营广告', version: '版本提醒', activity: '活动公告' }[row.type] }}
              </template>
            </el-table-column>
            <el-table-column prop="effective_status" label="运行状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.effective_status)">
                  {{ { draft: '草稿', enabled: '已启用', disabled: '已停用', expired: '已过期', pending: '待生效' }[row.effective_status] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="生效时间" width="320">
              <template #default="{ row }">
                {{ row.start_time }} ~ {{ row.end_time }}
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" />
            <el-table-column prop="priority" label="优先级" width="80" />
            <el-table-column prop="target_user_count" label="定向用户" width="100">
              <template #default="{ row }">
                {{ row.target_user_count > 0 ? row.target_user_count + '人' : '全部' }}
              </template>
            </el-table-column>
            <el-table-column prop="created_by" label="创建人" width="120" />
            <el-table-column label="操作" width="260">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="openPopupDialog(row)">编辑</el-button>
                <el-button type="warning" size="small" @click="copyPopup(row.id)">复制</el-button>
                <el-button v-perm="'popup_config:write'" type="danger" size="small" @click="removePopup(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="batch-actions" v-perm="'popup_config:write'">
            <el-button type="primary" size="small" :disabled="!selectedPopupIds.length" @click="batchStatus('enabled')">批量启用</el-button>
            <el-button type="warning" size="small" :disabled="!selectedPopupIds.length" @click="batchStatus('disabled')">批量停用</el-button>
            <el-button type="danger" size="small" :disabled="!selectedPopupIds.length" @click="batchDelete">批量删除</el-button>
          </div>

          <el-pagination
            v-model:current-page="popupQuery.page"
            v-model:page-size="popupQuery.size"
            :total="popupTotal"
            layout="total, prev, pager, next"
            @change="loadPopups"
            style="margin-top: 16px;"
          />
        </div>
      </el-tab-pane>

      <!-- H5 白名单 -->
      <el-tab-pane label="H5 白名单" name="whitelist">
        <div class="card">
          <div class="search-bar">
            <el-select v-model="whitelistQuery.status" placeholder="状态" clearable style="width: 120px;">
              <el-option label="启用" value="enabled" />
              <el-option label="停用" value="disabled" />
            </el-select>
            <el-button type="primary" @click="loadWhitelist">查询</el-button>
            <el-button v-perm="'popup_whitelist:write'" type="success" @click="openWhitelistDialog()">新增域名</el-button>
          </div>

          <el-table :data="whitelistList" border v-loading="whitelistLoading">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="domain" label="域名" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ row.status === 'enabled' ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updated_at" label="更新时间" width="180" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button v-perm="'popup_whitelist:write'" type="primary" size="small" @click="openWhitelistDialog(row)">编辑</el-button>
                <el-button v-perm="'popup_whitelist:write'" type="danger" size="small" @click="removeWhitelist(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="whitelistQuery.page"
            v-model:page-size="whitelistQuery.size"
            :total="whitelistTotal"
            layout="total, prev, pager, next"
            @change="loadWhitelist"
            style="margin-top: 16px;"
          />
        </div>
      </el-tab-pane>

      <!-- 站内路由 -->
      <el-tab-pane label="站内路由" name="route">
        <div class="card">
          <div class="search-bar">
            <el-select v-model="routeQuery.status" placeholder="状态" clearable style="width: 120px;">
              <el-option label="启用" value="enabled" />
              <el-option label="停用" value="disabled" />
            </el-select>
            <el-button type="primary" @click="loadRoutes">查询</el-button>
            <el-button v-perm="'popup_route:write'" type="success" @click="openRouteDialog()">新增路由</el-button>
          </div>

          <el-table :data="routeList" border v-loading="routeLoading">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="route_key" label="路由标识" />
            <el-table-column prop="route_name" label="路由名称" />
            <el-table-column prop="path" label="页面路径" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ row.status === 'enabled' ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button v-perm="'popup_route:write'" type="primary" size="small" @click="openRouteDialog(row)">编辑</el-button>
                <el-button v-perm="'popup_route:write'" type="danger" size="small" @click="removeRoute(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="routeQuery.page"
            v-model:page-size="routeQuery.size"
            :total="routeTotal"
            layout="total, prev, pager, next"
            @change="loadRoutes"
            style="margin-top: 16px;"
          />
        </div>
      </el-tab-pane>

      <!-- 数据统计 -->
      <el-tab-pane label="数据统计" name="stats">
        <div class="card">
          <div class="search-bar">
            <el-date-picker v-model="statsDateRange" type="daterange" range-separator="~" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
            <el-select v-model="statsQuery.popup_id" placeholder="选择弹窗" clearable style="width: 220px;">
              <el-option v-for="p in allPopups" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-button type="primary" @click="loadStats">查询</el-button>
            <el-button type="success" plain @click="exportEvents">导出原始数据</el-button>
          </div>

          <div class="dashboard-cards">
            <div class="dashboard-card">
              <div class="dashboard-label">总曝光</div>
              <div class="dashboard-value">{{ dashboard.total_show }}</div>
            </div>
            <div class="dashboard-card">
              <div class="dashboard-label">总点击</div>
              <div class="dashboard-value">{{ dashboard.total_click }}</div>
            </div>
            <div class="dashboard-card">
              <div class="dashboard-label">总关闭</div>
              <div class="dashboard-value">{{ dashboard.total_close }}</div>
            </div>
            <div class="dashboard-card">
              <div class="dashboard-label">点击率</div>
              <div class="dashboard-value">{{ dashboard.ctr }}%</div>
            </div>
          </div>

          <h4 style="margin: 20px 0 12px;">关闭渠道分布</h4>
          <div class="dashboard-cards">
            <div class="dashboard-card"><div class="dashboard-label">关闭按钮</div><div class="dashboard-value">{{ closeChannels.close_btn || 0 }}</div></div>
            <div class="dashboard-card"><div class="dashboard-label">点击蒙层</div><div class="dashboard-value">{{ closeChannels.mask || 0 }}</div></div>
            <div class="dashboard-card"><div class="dashboard-label">返回键</div><div class="dashboard-value">{{ closeChannels.back || 0 }}</div></div>
            <div class="dashboard-card"><div class="dashboard-label">下滑关闭</div><div class="dashboard-value">{{ closeChannels.swipe || 0 }}</div></div>
          </div>

          <h4 style="margin: 20px 0 12px;">按日明细</h4>
          <el-table :data="statsList" border v-loading="statsLoading">
            <el-table-column prop="date" label="日期" width="120" />
            <el-table-column prop="popup_name" label="弹窗名称" />
            <el-table-column prop="shows" label="曝光" width="100" />
            <el-table-column prop="clicks" label="点击" width="100" />
            <el-table-column prop="closes" label="关闭" width="100" />
            <el-table-column label="点击率" width="100">
              <template #default="{ row }">
                {{ row.shows ? ((row.clicks / row.shows) * 100).toFixed(2) : '0.00' }}%
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="statsQuery.page"
            v-model:page-size="statsQuery.size"
            :total="statsTotal"
            layout="total, prev, pager, next"
            @change="loadStats"
            style="margin-top: 16px;"
          />
        </div>
      </el-tab-pane>

      <!-- 全局设置 -->
      <el-tab-pane label="全局设置" name="global">
        <div class="card">
          <el-form :model="globalConfig" label-width="140px">
            <el-form-item label="弹窗总开关">
              <el-switch v-model="globalConfig.popup_global_enabled" active-text="开启" inactive-text="关闭" />
              <div class="form-tip">关闭后 C 端不再弹出任何广告弹窗</div>
            </el-form-item>
            <el-form-item label="用户日弹窗上限">
              <el-input-number v-model="globalConfig.popup_daily_limit" :min="1" :max="100" />
              <div class="form-tip">单用户单日最多弹出的弹窗数量，默认 3 次</div>
            </el-form-item>
            <el-form-item v-perm="'popup_global:write'">
              <el-button type="primary" @click="saveGlobalConfig">保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 弹窗表单 -->
    <el-dialog v-model="popupDialogVisible" :title="popupForm.id ? '编辑弹窗' : '新增弹窗'" width="760px" :close-on-click-modal="false">
      <el-form :model="popupForm" label-width="120px" :rules="popupRules" ref="popupFormRef">
        <el-divider>基础信息</el-divider>
        <el-form-item label="弹窗名称" prop="name">
          <el-input v-model="popupForm.name" maxlength="64" show-word-limit style="width: 400px;" />
        </el-form-item>
        <el-form-item label="广告类型" prop="type">
          <el-select v-model="popupForm.type" style="width: 200px;">
            <el-option label="系统通知" value="system" />
            <el-option label="运营广告" value="operational" />
            <el-option label="版本提醒" value="version" />
            <el-option label="活动公告" value="activity" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效时间" prop="timeRange">
          <el-date-picker v-model="popupForm.timeRange" type="datetimerange" range-separator="~" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-slider v-model="popupForm.priority" :min="1" :max="10" show-input style="width: 400px;" />
        </el-form-item>
        <el-form-item label="保存状态" prop="status">
          <el-radio-group v-model="popupForm.status">
            <el-radio label="enabled">直接启用</el-radio>
            <el-radio label="draft">保存草稿</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="定向用户">
          <el-input
            v-model="targetUsersText"
            type="textarea"
            :rows="3"
            style="width: 400px;"
            placeholder="留空=全部用户；每行一个用户ID，或用逗号分隔"
          />
          <div class="form-tip">仅列出的用户能看到该弹窗；支持 6 位字母+数字用户ID</div>
        </el-form-item>

        <el-divider>弹窗样式</el-divider>
        <el-form-item label="弹窗样式" prop="style">
          <el-radio-group v-model="popupForm.style">
            <el-radio label="center">居中弹窗</el-radio>
            <el-radio label="top">顶部弹窗</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="弹窗主图" prop="image_url">
          <el-upload
            class="popup-image-uploader"
            :http-request="uploadImage"
            :show-file-list="false"
            accept="image/png,image/jpeg"
            :before-upload="beforeImageUpload"
          >
            <img v-if="popupForm.image_url" :src="popupForm.image_url" class="preview-img" />
            <el-icon v-else class="uploader-icon"><Plus /></el-icon>
          </el-upload>
          <div class="form-tip">建议：居中 750*900px，顶部 750*300px，仅 png/jpg</div>
        </el-form-item>
        <el-form-item label="显示关闭按钮">
          <el-switch v-model="popupForm.show_close_button" />
        </el-form-item>
        <el-form-item label="点击蒙层关闭">
          <el-switch v-model="popupForm.mask_closeable" />
          <span class="form-tip" style="margin-left: 12px;">顶部弹窗无蒙层，此配置自动失效</span>
        </el-form-item>

        <el-divider>跳转链路</el-divider>
        <el-form-item label="跳转类型" prop="jump_type">
          <el-radio-group v-model="popupForm.jump_type">
            <el-radio label="none">无跳转</el-radio>
            <el-radio label="internal">跳转站内页面</el-radio>
            <el-radio label="h5">内嵌外部 H5</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="popupForm.jump_type === 'internal'" label="选择路由" prop="jump_route_id">
          <el-select v-model="popupForm.jump_route_id" filterable style="width: 300px;">
            <el-option v-for="r in routeListAll" :key="r.id" :label="r.route_name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="popupForm.jump_type === 'internal'" label="跳转参数">
          <el-input v-model="jumpParamsText" type="textarea" :rows="3" style="width: 400px;" placeholder='{"id": 1}' />
        </el-form-item>
        <el-form-item v-if="popupForm.jump_type === 'h5'" label="H5 链接" prop="jump_url">
          <el-input v-model="popupForm.jump_url" style="width: 400px;" placeholder="https://" />
        </el-form-item>

        <el-divider>弹出时机与防重</el-divider>
        <el-form-item label="弹出范围" prop="scope_type">
          <el-radio-group v-model="popupForm.scope_type">
            <el-radio label="global">全局弹出</el-radio>
            <el-radio label="specific">指定页面</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="popupForm.scope_type === 'specific'" label="指定页面">
          <el-select v-model="popupForm.scope_pages" multiple filterable style="width: 400px;">
            <el-option v-for="r in routeListAll" :key="r.route_key" :label="r.route_name" :value="r.route_key" />
          </el-select>
        </el-form-item>
        <el-form-item label="排除页面">
          <el-select v-model="popupForm.excluded_pages" multiple filterable style="width: 400px;">
            <el-option v-for="r in routeListAll" :key="r.route_key" :label="r.route_name" :value="r.route_key" />
          </el-select>
        </el-form-item>
        <el-form-item label="触发时机" prop="trigger_type">
          <el-select v-model="popupForm.trigger_type" style="width: 200px;">
            <el-option label="进入页面立即弹出" value="immediate" />
            <el-option label="页面停留 N 秒弹出" value="duration" />
            <el-option label="页面返回弹出" value="back" />
            <el-option label="APP 冷启动弹出" value="cold_start" />
            <el-option label="业务操作完成弹出" value="operation" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="popupForm.trigger_type === 'duration'" label="延迟秒数">
          <el-input-number v-model="popupForm.trigger_delay_seconds" :min="1" :max="300" />
        </el-form-item>
        <el-form-item label="仅 WiFi 展示">
          <el-switch v-model="popupForm.wifi_only" />
        </el-form-item>

        <el-divider>频次管控</el-divider>
        <el-form-item label="频次周期" prop="frequency_period">
          <el-radio-group v-model="popupForm.frequency_period">
            <el-radio label="day">自然日</el-radio>
            <el-radio label="week">自然周</el-radio>
            <el-radio label="forever">永久累计</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="周期最大曝光">
          <el-input-number v-model="popupForm.frequency_max" :min="1" :max="10000" />
        </el-form-item>
        <el-form-item label="一次性弹窗">
          <el-switch v-model="popupForm.one_time" />
          <span class="form-tip" style="margin-left: 12px;">勾选后用户全局仅展示一次，所有频次规则失效</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="popupDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPopup">保存</el-button>
      </template>
    </el-dialog>

    <!-- 白名单表单 -->
    <el-dialog v-model="whitelistDialogVisible" :title="whitelistForm.id ? '编辑白名单' : '新增白名单'" width="420px">
      <el-form :model="whitelistForm" label-width="80px">
        <el-form-item label="域名">
          <el-input v-model="whitelistForm.domain" placeholder="example.com 或 *.example.com" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="whitelistForm.status">
            <el-radio label="enabled">启用</el-radio>
            <el-radio label="disabled">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="whitelistDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitWhitelist">保存</el-button>
      </template>
    </el-dialog>

    <!-- 路由表单 -->
    <el-dialog v-model="routeDialogVisible" :title="routeForm.id ? '编辑路由' : '新增路由'" width="520px">
      <el-form :model="routeForm" label-width="100px">
        <el-form-item label="路由标识">
          <el-input v-model="routeForm.route_key" placeholder="如 pages/index/index" />
        </el-form-item>
        <el-form-item label="路由名称">
          <el-input v-model="routeForm.route_name" placeholder="首页" />
        </el-form-item>
        <el-form-item label="页面路径">
          <el-input v-model="routeForm.path" placeholder="/pages/index/index" />
        </el-form-item>
        <el-form-item label="参数 Schema">
          <el-input v-model="routeForm.params_schema_text" type="textarea" :rows="3" placeholder='{"id": "number"}' />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="routeForm.status">
            <el-radio label="enabled">启用</el-radio>
            <el-radio label="disabled">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="routeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRoute">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import {
  cmsPopupApi,
  cmsPopupWhitelistApi,
  cmsPopupRouteApi,
  cmsPopupStatsApi,
  cmsPopupGlobalApi
} from '@/api/cms'
import request from '@/api/request'

const auth = useAuthStore()
const vPerm = {
  mounted(el, binding) {
    if (!auth.hasPermission(binding.value)) el.remove()
  }
}

const activeTab = ref('popup')

// ==================== 弹窗管理 ====================
const popupQuery = reactive({ page: 1, size: 20, keyword: '', type: '', status: '' })
const popupList = ref([])
const popupTotal = ref(0)
const popupLoading = ref(false)
const selectedPopupIds = ref([])
const popupDialogVisible = ref(false)
const popupFormRef = ref(null)
const routeListAll = ref([])
const allPopups = ref([])

const defaultPopupForm = {
  id: null,
  name: '',
  style: 'center',
  target_users: [],
  type: 'operational',
  status: 'draft',
  timeRange: [],
  priority: 5,
  image_url: '',
  title: '',
  content: '',
  show_close_button: true,
  mask_closeable: true,
  jump_type: 'none',
  jump_route_id: null,
  jump_url: '',
  jump_params: {},
  scope_type: 'global',
  scope_pages: [],
  excluded_pages: [],
  trigger_type: 'immediate',
  trigger_delay_seconds: 3,
  frequency_period: 'day',
  frequency_max: 1,
  one_time: false,
  wifi_only: false
}

const popupForm = reactive({ ...defaultPopupForm })
const targetUsersText = computed({
  get: () => (popupForm.target_users || []).join('\n'),
  set: (val) => {
    popupForm.target_users = String(val || '')
      .split(/[,，\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
})
const jumpParamsText = computed({
  get: () => JSON.stringify(popupForm.jump_params || {}, null, 2),
  set: (val) => {
    try {
      popupForm.jump_params = JSON.parse(val || '{}')
    } catch (e) {
      popupForm.jump_params = {}
    }
  }
})

const popupRules = {
  name: [{ required: true, message: '请输入弹窗名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择广告类型', trigger: 'change' }],
  timeRange: [{ required: true, message: '请选择生效时间', trigger: 'change' }],
  style: [{ required: true, message: '请选择弹窗样式', trigger: 'change' }],
  image_url: [{ required: true, message: '请上传弹窗主图', trigger: 'change' }],
  jump_type: [{ required: true, message: '请选择跳转类型', trigger: 'change' }],
  scope_type: [{ required: true, message: '请选择弹出范围', trigger: 'change' }],
  trigger_type: [{ required: true, message: '请选择触发时机', trigger: 'change' }],
  frequency_period: [{ required: true, message: '请选择频次周期', trigger: 'change' }]
}

function statusTagType(status) {
  const map = { draft: 'info', enabled: 'success', disabled: 'warning', expired: 'danger', pending: '' }
  return map[status] || ''
}

async function loadPopups() {
  popupLoading.value = true
  try {
    const res = await cmsPopupApi.list({ ...popupQuery })
    popupList.value = res.data.list || []
    popupTotal.value = res.data.pagination.total || 0
  } catch (e) {}
  popupLoading.value = false
}

async function loadAllRoutes() {
  try {
    const res = await cmsPopupRouteApi.list({ page: 1, size: 1000, status: 'enabled' })
    routeListAll.value = res.data.list || []
  } catch (e) {}
}

async function loadAllPopups() {
  try {
    const res = await cmsPopupApi.list({ page: 1, size: 1000 })
    allPopups.value = res.data.list || []
  } catch (e) {}
}

function openPopupDialog(row = null) {
  if (row && row.id) {
    Object.assign(popupForm, {
      ...row,
      timeRange: [row.start_time, row.end_time],
      show_close_button: row.show_close_button === 1 || row.show_close_button === true,
      mask_closeable: row.mask_closeable === 1 || row.mask_closeable === true,
      one_time: row.one_time === 1 || row.one_time === true,
      wifi_only: row.wifi_only === 1 || row.wifi_only === true,
      jump_params: row.jump_params || {},
      scope_pages: Array.isArray(row.scope_pages) ? row.scope_pages : [],
      excluded_pages: Array.isArray(row.excluded_pages) ? row.excluded_pages : []
    })
  } else {
    Object.assign(popupForm, {
      ...defaultPopupForm,
      timeRange: ['', ''],
      scope_pages: [],
      excluded_pages: [],
      jump_params: {}
    })
  }
  popupDialogVisible.value = true
}

async function submitPopup() {
  popupFormRef.value?.validate(async (valid) => {
    if (!valid) return
    if (!popupForm.timeRange || popupForm.timeRange.length < 2) {
      return ElMessage.error('请选择生效时间')
    }
    const payload = {
      ...popupForm,
      start_time: popupForm.timeRange[0],
      end_time: popupForm.timeRange[1]
    }
    try {
      if (popupForm.id) {
        await cmsPopupApi.update(popupForm.id, payload)
      } else {
        await cmsPopupApi.create(payload)
      }
      ElMessage.success('保存成功')
      popupDialogVisible.value = false
      loadPopups()
      loadAllPopups()
    } catch (e) {}
  })
}

async function copyPopup(id) {
  try {
    await cmsPopupApi.copy(id)
    ElMessage.success('复制成功')
    loadPopups()
  } catch (e) {}
}

async function removePopup(id) {
  try {
    await ElMessageBox.confirm('确定删除该弹窗？', '提示', { type: 'warning' })
    await cmsPopupApi.remove(id)
    ElMessage.success('删除成功')
    loadPopups()
  } catch (e) {}
}

function handlePopupSelectionChange(selection) {
  selectedPopupIds.value = selection.map(s => s.id)
}

async function batchStatus(status) {
  if (!selectedPopupIds.value.length) return
  try {
    await cmsPopupApi.batchStatus({ ids: selectedPopupIds.value, status })
    ElMessage.success('批量更新成功')
    loadPopups()
  } catch (e) {}
}

async function batchDelete() {
  if (!selectedPopupIds.value.length) return
  try {
    await ElMessageBox.confirm('确定批量删除选中的弹窗？', '提示', { type: 'warning' })
    await cmsPopupApi.batchDelete({ ids: selectedPopupIds.value })
    ElMessage.success('批量删除成功')
    loadPopups()
  } catch (e) {}
}

async function uploadImage({ file }) {
  const data = new FormData()
  data.append('image', file)
  try {
    const res = await request.post('/upload/image', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    popupForm.image_url = res.data.url
    ElMessage.success('上传成功')
  } catch (e) {}
}

function beforeImageUpload(file) {
  const isJpg = file.type === 'image/jpeg' || file.type === 'image/png'
  if (!isJpg) ElMessage.error('仅支持 JPG/PNG 格式')
  return isJpg
}

// ==================== 白名单 ====================
const whitelistQuery = reactive({ page: 1, size: 20, status: '' })
const whitelistList = ref([])
const whitelistTotal = ref(0)
const whitelistLoading = ref(false)
const whitelistDialogVisible = ref(false)
const whitelistForm = reactive({ id: null, domain: '', status: 'enabled' })

async function loadWhitelist() {
  whitelistLoading.value = true
  try {
    const res = await cmsPopupWhitelistApi.list({ ...whitelistQuery })
    whitelistList.value = res.data.list || []
    whitelistTotal.value = res.data.pagination.total || 0
  } catch (e) {}
  whitelistLoading.value = false
}

function openWhitelistDialog(row = null) {
  if (row && row.id) {
    Object.assign(whitelistForm, { ...row })
  } else {
    Object.assign(whitelistForm, { id: null, domain: '', status: 'enabled' })
  }
  whitelistDialogVisible.value = true
}

async function submitWhitelist() {
  try {
    if (whitelistForm.id) {
      await cmsPopupWhitelistApi.update(whitelistForm.id, whitelistForm)
    } else {
      await cmsPopupWhitelistApi.create(whitelistForm)
    }
    ElMessage.success('保存成功')
    whitelistDialogVisible.value = false
    loadWhitelist()
  } catch (e) {}
}

async function removeWhitelist(id) {
  try {
    await ElMessageBox.confirm('确定删除该白名单？', '提示', { type: 'warning' })
    await cmsPopupWhitelistApi.remove(id)
    ElMessage.success('删除成功')
    loadWhitelist()
  } catch (e) {}
}

// ==================== 站内路由 ====================
const routeQuery = reactive({ page: 1, size: 20, status: '' })
const routeList = ref([])
const routeTotal = ref(0)
const routeLoading = ref(false)
const routeDialogVisible = ref(false)
const routeForm = reactive({ id: null, route_key: '', route_name: '', path: '', params_schema_text: '{}', status: 'enabled' })

async function loadRoutes() {
  routeLoading.value = true
  try {
    const res = await cmsPopupRouteApi.list({ ...routeQuery })
    routeList.value = res.data.list || []
    routeTotal.value = res.data.pagination.total || 0
  } catch (e) {}
  routeLoading.value = false
}

function openRouteDialog(row = null) {
  if (row && row.id) {
    Object.assign(routeForm, {
      ...row,
      params_schema_text: JSON.stringify(row.params_schema || {}, null, 2)
    })
  } else {
    Object.assign(routeForm, { id: null, route_key: '', route_name: '', path: '', params_schema_text: '{}', status: 'enabled' })
  }
  routeDialogVisible.value = true
}

async function submitRoute() {
  try {
    const payload = { ...routeForm, params_schema: JSON.parse(routeForm.params_schema_text || '{}') }
    if (routeForm.id) {
      await cmsPopupRouteApi.update(routeForm.id, payload)
    } else {
      await cmsPopupRouteApi.create(payload)
    }
    ElMessage.success('保存成功')
    routeDialogVisible.value = false
    loadRoutes()
    loadAllRoutes()
  } catch (e) {}
}

async function removeRoute(id) {
  try {
    await ElMessageBox.confirm('确定删除该路由？', '提示', { type: 'warning' })
    await cmsPopupRouteApi.remove(id)
    ElMessage.success('删除成功')
    loadRoutes()
    loadAllRoutes()
  } catch (e) {}
}

// ==================== 统计 ====================
const statsDateRange = ref([])
const statsQuery = reactive({ page: 1, size: 30, popup_id: '' })
const statsList = ref([])
const statsTotal = ref(0)
const statsLoading = ref(false)
const dashboard = reactive({ total_show: 0, total_click: 0, total_close: 0, ctr: '0.00' })
const closeChannels = reactive({ close_btn: 0, mask: 0, back: 0, swipe: 0 })

async function loadStats() {
  statsLoading.value = true
  const [start_date, end_date] = statsDateRange.value || ['', '']
  const params = { ...statsQuery, start_date, end_date }
  try {
    const dash = await cmsPopupStatsApi.dashboard(params)
    Object.assign(dashboard, dash.data)
    const detail = await cmsPopupStatsApi.detail(params)
    statsList.value = detail.data.list || []
    statsTotal.value = detail.data.pagination.total || 0
    Object.assign(closeChannels, detail.data.close_channels || {})
  } catch (e) {}
  statsLoading.value = false
}

async function exportEvents() {
  const [start_date, end_date] = statsDateRange.value || ['', '']
  const params = { popup_id: statsQuery.popup_id, start_date, end_date }
  try {
    const res = await cmsPopupStatsApi.export(params)
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `popup-events-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  } catch (e) {}
}

// ==================== 全局设置 ====================
const globalConfig = reactive({ popup_global_enabled: true, popup_daily_limit: 3 })

async function loadGlobalConfig() {
  try {
    const res = await cmsPopupGlobalApi.get()
    Object.assign(globalConfig, res.data)
  } catch (e) {}
}

async function saveGlobalConfig() {
  try {
    await cmsPopupGlobalApi.update(globalConfig)
    ElMessage.success('保存成功')
  } catch (e) {}
}

onMounted(() => {
  loadPopups()
  loadAllRoutes()
  loadAllPopups()
  loadWhitelist()
  loadRoutes()
  loadStats()
  loadGlobalConfig()
})
</script>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.batch-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.dashboard-card {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.dashboard-label {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}
.dashboard-value {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}
.form-tip {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}
.popup-image-uploader {
  width: 180px;
  height: 120px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.uploader-icon {
  font-size: 28px;
  color: #8c939d;
}
</style>
