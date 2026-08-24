<template>
  <div class="page-container">
    <div class="card">
      <div class="detail-header">
        <el-button link type="primary" @click="$router.push('/app-users')">‹ 返回用户列表</el-button>
        <span class="detail-title">用户详情{{ user ? `：${user.nickname || user.username}（ID ${user.id}）` : '' }}</span>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="info">
          <el-descriptions v-if="user" :column="3" border>
            <el-descriptions-item label="用户ID">{{ user.id }}</el-descriptions-item>
            <el-descriptions-item label="账号">{{ user.username || '-' }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ user.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item label="OpenID">{{ user.openid || '-' }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ user.phone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="注册方式">
              <el-tag :type="user.source === 'wechat' ? 'success' : user.source === 'cms' ? 'warning' : 'info'">
                {{ user.source === 'wechat' ? '微信登录' : user.source === 'cms' ? '后台创建' : 'App注册' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="性别">{{ user.gender === 1 ? '男' : user.gender === 2 ? '女' : '未知' }}</el-descriptions-item>
            <el-descriptions-item label="年龄">{{ user.age || '-' }}</el-descriptions-item>
            <el-descriptions-item label="身高">{{ user.height ? user.height + ' cm' : '-' }}</el-descriptions-item>
            <el-descriptions-item label="当前体重">{{ user.current_weight ? user.current_weight + ' kg' : '-' }}</el-descriptions-item>
            <el-descriptions-item label="目标体重">{{ user.target_weight ? user.target_weight + ' kg' : '-' }}</el-descriptions-item>
            <el-descriptions-item label="BMR">{{ user.bmr || '-' }}</el-descriptions-item>
            <el-descriptions-item label="TDEE">{{ user.tdee || '-' }}</el-descriptions-item>
            <el-descriptions-item label="每日热量目标">{{ user.daily_calorie_target || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="user.status ? 'success' : 'info'">{{ user.status ? '正常' : '禁用' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ user.created_at }}</el-descriptions-item>
            <el-descriptions-item label="最近登录">{{ user.last_login_at || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="记录概览" name="records">
          <el-descriptions v-if="records" :column="3" border>
            <el-descriptions-item label="饮食记录">{{ records.counts.diet }}</el-descriptions-item>
            <el-descriptions-item label="运动记录">{{ records.counts.exercise }}</el-descriptions-item>
            <el-descriptions-item label="身体记录">{{ records.counts.body }}</el-descriptions-item>
            <el-descriptions-item label="习惯记录">{{ records.counts.habit }}</el-descriptions-item>
            <el-descriptions-item label="聊天消息">{{ records.counts.chat }}</el-descriptions-item>
            <el-descriptions-item label="反馈">{{ records.counts.feedback }}</el-descriptions-item>
            <el-descriptions-item label="最近记录日期">{{ records.latest_record_date || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="货币流水" name="transactions">
          <div class="search-bar">
            <el-select v-model="txQuery.currency_type" placeholder="货币类型" clearable style="width:140px;">
              <el-option label="浆果" value="berries" />
              <el-option label="鲜花" value="flowers" />
            </el-select>
            <el-input v-model="txQuery.type" placeholder="变动类型" clearable style="width:140px;" />
            <el-input v-model="txQuery.source" placeholder="来源" clearable style="width:140px;" />
            <el-button type="primary" @click="loadTransactions">查询</el-button>
            <el-button @click="resetTransactions">重置</el-button>
          </div>
          <el-table :data="txList" v-loading="txLoading" border empty-text="暂无流水">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="currency_type" label="货币类型" width="110" />
            <el-table-column prop="type" label="变动类型" width="110" />
            <el-table-column prop="amount" label="变动数量" width="110" />
            <el-table-column prop="balance_after" label="变动后余额" width="120" />
            <el-table-column prop="source" label="来源" />
            <el-table-column prop="created_at" label="时间" width="180" />
          </el-table>
          <el-pagination v-model:current-page="txQuery.page" v-model:page-size="txQuery.size" :total="txTotal" layout="total, prev, pager, next" class="pagination" @change="loadTransactions" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { cmsAppUserApi, cmsCurrencyConfigApi } from '@/api/cms'

const route = useRoute()
const userId = route.params.id

const activeTab = ref('info')
const user = ref(null)
const records = ref(null)

const txList = ref([])
const txTotal = ref(0)
const txLoading = ref(false)
const txQuery = ref({ user_id: userId, currency_type: '', type: '', source: '', page: 1, size: 20 })

onMounted(async () => {
  try {
    const res = await cmsAppUserApi.detail(userId)
    user.value = res.data
  } catch (e) { console.error(e) }
  try {
    const res = await cmsAppUserApi.records(userId)
    records.value = res.data
  } catch (e) { console.error(e) }
  loadTransactions()
})

async function loadTransactions() {
  txLoading.value = true
  try {
    const res = await cmsCurrencyConfigApi.listTransactions(txQuery.value)
    txList.value = res.data.list
    txTotal.value = res.data.pagination.total
  } finally {
    txLoading.value = false
  }
}

function resetTransactions() {
  txQuery.value = { user_id: userId, currency_type: '', type: '', source: '', page: 1, size: 20 }
  loadTransactions()
}
</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 16px;
  font-weight: 600;
}
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
