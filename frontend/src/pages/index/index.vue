<template>
  <view class="partner-page">
    <!-- 系统状态栏占位 -->
    <view class="status-bar"></view>

    <!-- 顶部搭子信息 -->
    <view class="header">
      <view class="header-inner">
        <image class="header-avatar" src="/static/image/icon/liaoliao01@3x.png" mode="aspectFit" />
        <view class="header-title-wrap">
          <text class="header-title">搭搭</text>
          <text class="header-subtitle">👋 我是你的掉秤搭搭～</text>
        </view>
        <view class="header-actions">
          <view class="header-setting" @click="goUser">
            <image class="header-setting-icon" src="/static/image/icon/setting@3x.png" mode="aspectFit" />
          </view>
        </view>
      </view>
    </view>

    <!-- 顶部公告栏 -->
    <AnnouncementBar position="home" :max="2" />

    <!-- 消息列表 -->
    <scroll-view
      class="message-list"
      scroll-y
      :scroll-top="scrollTop"
      :scroll-into-view="scrollIntoView"
      scroll-with-animation
      @scrolltoupper="loadMore"
      :upper-threshold="50"
      @scroll="onListScroll"
    >
      <view class="date-wrap">
        <view class="date-pill">
          <text>{{ todayLabel }}</text>
        </view>
      </view>

      <view
        v-for="msg in displayMessages"
        :key="msg.id"
        :id="'msg-' + msg.id"
        class="message-row"
        :class="msg.role"
      >
        <view v-if="msg.role === 'partner'" class="user-column partner-column">
          <view
            v-if="msg.displayContent !== undefined ? msg.displayContent : msg.content"
            class="bubble partner-bubble"
            @touchstart="handleTouchStart($event, msg)"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @touchcancel="handleTouchEnd"
          >
            <text class="ai-generated-label">AI 生成</text>
            <text class="bubble-text">{{ msg.displayContent !== undefined ? msg.displayContent : msg.content }}</text>
          </view>
          <!-- 搭搭回复沉淀出的内容（如食谱）也走「待确认/已记录」标签 -->
          <view
            v-if="showRecordTag(msg)"
            class="record-tag"
            @click="onConfirmedTag(msg)"
          >
            <text class="record-tag-text">已记录</text>
            <image class="record-tag-icon" src="/static/image/icon/xiugai.png" />
          </view>
          <view
            v-else-if="showPendingTag(msg)"
            class="record-tag pending"
            @click="onPendingTag(msg)"
          >
            <text class="record-tag-text">待确认 · 点我查看</text>
          </view>
        </view>

        <view v-else class="user-column">
          <view
            class="bubble user-bubble"
            @touchstart="handleTouchStart($event, msg)"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @touchcancel="handleTouchEnd"
          >
            <text class="bubble-text">{{ msg.content }}</text>
          </view>
          <view
            v-if="showRecordTag(msg)"
            class="record-tag"
            @click="onConfirmedTag(msg)"
          >
            <text class="record-tag-text">已记录</text>
            <image class="record-tag-icon" src="/static/image/icon/xiugai.png" />
          </view>
          <view
            v-else-if="showPendingTag(msg)"
            class="record-tag pending"
            @click="onPendingTag(msg)"
          >
            <text class="record-tag-text">待确认 · 点我查看</text>
          </view>
        </view>

        <!-- 聊天沉淀出的方法/感悟/食谱等待确认卡片 -->
        <PendingAssetCard
          v-if="pendingAssetsMap[msg.id]?.length"
          :assets="pendingAssetsMap[msg.id]"
          @save="onAssetSaved(msg.id, $event)"
          @discard="onAssetDiscarded(msg.id, $event)"
        />
      </view>

      <view v-if="loading" class="loading-tip">
        <text>搭子正在输入...</text>
      </view>

      <!-- 底部占位，配合 padding-bottom 保证最后一条消息能滚动到可视区 -->
      <view id="msg-bottom-spacer" style="height: 20rpx;"></view>
    </scroll-view>

    <!-- 底部输入区 -->
    <view class="input-area">
      <view class="input-bar">
        <input
          v-model="inputText"
          class="chat-input"
          type="text"
          placeholder="和搭子聊聊今天吃了什么..."
          confirm-type="send"
          @confirm="sendMessage"
        />
        <view class="send-btn-wrap" @click="sendMessage">
          <image class="send-btn" src="/static/image/icon/send@3x.png" />
        </view>
      </view>
    </view>

    <!-- 沉淀记录编辑/确认弹窗 -->
    <view v-if="showEditModal" class="panel-overlay show" @click="closeEditModal"></view>
    <view class="edit-panel" :class="{ show: showEditModal }">
      <view class="panel-header">
        <text class="panel-title">{{ editMode === 'confirm' ? '确认记录' : '修改记录' }}</text>
        <text class="panel-close" @click="closeEditModal">✕</text>
      </view>

      <view class="panel-body">
        <!-- 饮食记录编辑 -->
        <template v-if="editRecordType === 'diet'">
          <view class="form-item">
            <text class="form-label">餐别</text>
            <view class="meal-selector">
              <view
                v-for="opt in mealOptions"
                :key="opt.value"
                class="meal-option"
                :class="{ active: editMealTime === opt.value }"
                @click="editMealTime = opt.value"
              >
                <text>{{ opt.label }}</text>
              </view>
            </view>
          </view>

          <view class="form-item">
            <view class="form-label-row">
              <text class="form-label">食物</text>
            </view>
            <view class="food-list">
              <view v-for="(food, index) in editFoods" :key="index" class="food-row">
                <input v-model="food.name" class="food-name-input" placeholder="食物名称" />
                <text class="food-calorie-text">{{ computedFoodCalorie(food) }} 千卡</text>
                <view class="food-meta-row">
                  <view v-if="food.unit !== 'g' && food.unit !== '克'" class="food-quantity-wrap">
                    <input v-model="food.quantity" class="food-weight-input" placeholder="数量" type="digit" />
                    <text class="food-unit">{{ food.unit || '个' }}</text>
                  </view>
                  <view class="food-quantity-wrap">
                    <input v-model="food.weight" class="food-weight-input" placeholder="克" type="digit" />
                    <text class="food-unit">g</text>
                  </view>
                  <text class="food-remove" @click="removeFoodRow(index)">✕</text>
                </view>
              </view>
            </view>
          </view>
        </template>

        <!-- 身体数据 -->
        <template v-if="editRecordType === 'body'">
          <view v-for="(item, index) in editBodyData" :key="index" class="form-item">
            <text class="form-label">{{ bodyTypeLabelMap[item.type] || item.type }}</text>
            <view class="body-input-row">
              <input v-model="item.value" class="body-value-input" placeholder="请输入数值" type="digit" />
              <text class="body-unit">{{ item.unit }}</text>
            </view>
          </view>
        </template>

        <!-- 运动记录 -->
        <template v-if="editRecordType === 'exercise'">
          <view v-for="(ex, index) in editExercises" :key="index" class="form-item">
            <text class="form-label">{{ ex.name }}</text>
            <view class="exercise-row">
              <view class="exercise-field">
                <text class="exercise-field-label">时长</text>
                <input v-model="ex.duration" class="exercise-field-input" placeholder="分钟" type="digit" @input="onExerciseDurationInput(index)" />
                <text class="exercise-field-unit">分钟</text>
              </view>
              <view class="exercise-field">
                <text class="exercise-field-label">消耗</text>
                <input v-model="ex.calorie" class="exercise-field-input" placeholder="千卡" type="digit" @input="onExerciseCalorieInput(index)" />
                <text class="exercise-field-unit">千卡</text>
              </view>
              <view class="exercise-field">
                <text class="exercise-field-label">距离</text>
                <input v-model="ex.distance" class="exercise-field-input" placeholder="公里" type="digit" />
                <text class="exercise-field-unit">公里</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 习惯记录 -->
        <template v-if="editRecordType === 'habit'">
          <view class="form-item">
            <text class="form-label">记录类型</text>
            <view class="habit-type-selector">
              <view
                v-for="opt in habitTypeOptions"
                :key="opt.value"
                class="habit-type-option"
                :class="{ active: editHabitData.type === opt.value }"
                @click="editHabitData.type = opt.value; editHabitData.unit = opt.unit"
              >
                <text>{{ opt.label }}</text>
              </view>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">{{ habitTypeLabelMap[editHabitData.type] || editHabitData.type }}</text>
            <view class="body-input-row">
              <input v-model="editHabitData.value" class="body-value-input" :placeholder="'请输入' + (habitTypeLabelMap[editHabitData.type] || editHabitData.type)" type="digit" />
              <text class="body-unit">{{ editHabitData.unit }}</text>
            </view>
          </view>
        </template>

        <!-- 个人资产类（食谱/方法/踩坑/感悟/金句） -->
        <template v-if="editRecordType === 'asset'">
          <view class="form-item">
            <text class="form-label">类型</text>
            <text class="asset-type-text">{{ assetTypeLabelMap[editAssetData.type] || editAssetData.type }}</text>
          </view>
          <view class="form-item">
            <text class="form-label">标题</text>
            <input v-model="editAssetData.title" class="body-value-input" placeholder="标题" />
          </view>
          <view class="form-item">
            <text class="form-label">内容</text>
            <textarea v-model="editAssetData.content" class="asset-content-input" placeholder="内容" :auto-height="true" />
          </view>

          <!-- 食谱扩展字段 -->
          <template v-if="editAssetData.type === 'recipe'">
            <view class="form-item">
              <text class="form-label">食材（每行一个）</text>
              <textarea v-model="editAssetData.ingredients" class="asset-content-input" placeholder="例如：鸡胸肉 200g" :auto-height="true" />
            </view>
            <view class="form-item">
              <text class="form-label">步骤</text>
              <textarea v-model="editAssetData.steps" class="asset-content-input" placeholder="请输入制作步骤" :auto-height="true" />
            </view>
            <view class="form-item">
              <text class="form-label">小贴士</text>
              <input v-model="editAssetData.tip" class="body-value-input" placeholder="可选" />
            </view>
          </template>
        </template>
      </view>

      <view class="panel-actions">
        <button class="btn-cancel" @click="rejectEdit">{{ editMode === 'confirm' ? '忽略' : '取消' }}</button>
        <button class="btn-save" @click="saveEdit">{{ editMode === 'confirm' ? '确认记录' : '保存' }}</button>
      </view>
    </view>

    <!-- 全屏食物选择弹层 -->
    <view v-if="showFoodPicker" class="food-picker-overlay" @click="showFoodPicker = false"></view>
    <view v-if="showFoodPicker" class="food-picker-modal" :class="{ show: showFoodPicker }">
      <view class="food-picker-modal-header">
        <text class="food-picker-back" @click="showFoodPicker = false">←</text>
        <view class="food-picker-modal-title">
          <text class="food-picker-meal-label">{{ mealOptions.find(m => m.value === editMealTime)?.label || '午餐' }}</text>
        </view>
        <view style="width: 60rpx;"></view>
      </view>

      <view class="food-picker-modal-search">
        <text class="food-picker-modal-search-icon">🔍</text>
        <input
          v-model="foodKeyword"
          class="food-picker-modal-search-input"
          placeholder="请输入食物名称"
          confirm-type="search"
          @confirm="searchFoods"
        />
      </view>

      <view class="food-picker-modal-body">
        <scroll-view class="food-picker-modal-categories" scroll-y>
          <view
            v-for="cat in foodCategories"
            :key="cat.key"
            class="food-picker-modal-category"
            :class="{ active: currentFoodCategory === cat.key }"
            @click="switchFoodCategory(cat.key)"
          >
            <text>{{ cat.label }}</text>
          </view>
        </scroll-view>

        <scroll-view class="food-picker-modal-foods" scroll-y>
          <view v-if="foodSearchResults.length > 0" class="food-picker-modal-food-list">
            <view v-for="food in foodSearchResults" :key="food.id" class="food-picker-modal-food-item" @click="selectFoodFromPicker(food)">
              <view class="food-picker-modal-food-image">
                <text>{{ food.name.slice(0, 1) }}</text>
              </view>
              <view class="food-picker-modal-food-info">
                <text class="food-picker-modal-food-name">{{ food.name }}</text>
                <view class="food-picker-modal-food-calorie">
                  <text class="calorie-num">{{ food.calorie_per_100g }}</text>
                  <text class="calorie-unit"> 千卡/{{ food.unit || '100克' }}</text>
                </view>
              </view>
              <view class="food-picker-modal-add-icon">
                <text>+</text>
              </view>
            </view>
          </view>
          <view v-else class="food-picker-modal-empty">
            <text>搜索或选择分类查看食物</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 授权引导弹窗 -->
    <AuthPopup ref="authPopupRef" />

    <!-- 长按消息操作菜单 -->
    <view v-if="showMsgActions" class="msg-action-overlay" @click="closeMsgActionMenu">
      <view
        class="msg-action-menu"
        :style="{ left: actionMenuX + 'px', top: actionMenuY + 'px' }"
        @click.stop
      >
        <view class="msg-action-item" @click="onMenuCopy">
          <text class="msg-action-text">复制</text>
        </view>
        <view class="msg-action-divider"></view>
        <view class="msg-action-item" @click="onMenuReport">
          <text class="msg-action-text">举报</text>
        </view>
      </view>
    </view>

    <!-- 已自动记录提示弹框（单按钮） -->
    <AppModal
      v-model:visible="showAutoRecordedModal"
      icon="none"
      title="已自动记录"
      text="这条消息已帮你记入今日记录，可以在「今日记录」中查看或修改哦～"
      confirmText="知道了"
      :showCancel="false"
    />
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '../../store';
import { chatApi, partnerApi, recordApi, precipitationApi, systemApi, voiceApi } from '../../api';
import { showRewardToast } from '../../utils/rewardToast.js';
import { formatDate } from '../../utils/date';
import { checkPermission, reportCount } from '../../utils/trial.js';
import AuthPopup from '../../components/AuthPopup.vue';
import PendingAssetCard from '../../components/PendingAssetCard.vue';
import AnnouncementBar from '../../components/AnnouncementBar.vue';
import AppModal from '../../components/AppModal.vue';

const userStore = useUserStore();

// 已自动记录提示弹框
const showAutoRecordedModal = ref(false);

const messages = ref([]);
const pendingAssetsMap = ref({}); // key: chat_message_id, value: pending museum_items
const welcomeMessage = computed(() => {
  if (messages.value.length > 0) return null;
  return {
    id: 'welcome',
    role: 'partner',
    content: '你好呀，我是你的专属掉秤搭搭～\n从今天开始，我会陪你一起记录饮食、运动、体重，一起瘦下来！有什么想聊的，随时告诉我吧～',
    precipitation_status: 0,
    precipitation_type: null
  };
});
const displayMessages = computed(() => welcomeMessage.value ? [welcomeMessage.value, ...messages.value] : messages.value);

/**
 * 剔除「身体评估」消息中的计算过程段落（计算明细/校验/修正分配/安全线校验/算式推导等）
 * 保证「身体数据评估」和「饮食执行方案」两个模块只展示结论
 * 该函数直接在 msg 对象上写入 displayContent（不破坏原始 content，方便调试）
 */
function sanitizePartnerMessage(msg) {
  if (!msg || msg.role !== 'partner' || !msg.content || msg.displayContent !== undefined) return msg;
  const text = String(msg.content);

  // 没有计算过程特征的直接跳过，不做无谓清洗
  const hasCalcSigns = /计算明细[:：]|校验[:：]|修正分配[:：]|安全线校验|BMR\s*=\s*10×|TDEE\s*=\s*.*?\s×\s|缺口取\d+|×体重|×身高|×年龄|交叉核对|实际输出取整|缺口补至/.test(text);
  if (!hasCalcSigns) return msg;

  // 1) 删除「计算明细：」开头，到下一行以「## 二、」「## 三、」或空行+行首非空白+数字点 或空行+行首"- " 列表项之间的整段内容
  let sanitized = text
    .replace(/\n?计算明细[：:].*?(?=\n## 二、|\n## 三、|\n## 四、|\n## 五、|\n\d+\. |\n- |\n\d+[.、] |$)/sg, '')
    // 2) 删除「（校验：...）」整段，或「校验:」「校验：」开头直到下一个 1.2.3. / - 列表项 / ## 标题或双空行
    .replace(/\n?[（(]?校验[：:].*?(?=\n\d+[.、] |\n- |\n## |\n\s*\n|$)/sg, '')
    // 3) 删除「修正分配：」开头直到下一个 1.2.3. / - / ## 或空行
    .replace(/\n?修正分配[：:].*?(?=\n\d+[.、] |\n- |\n## |\n\s*\n|$)/sg, '')
    // 4) 删除包含算式特征的独立单行（以空白开始或非列表项单独行；包含 = + - × / 和数字，或出现 10× 6.25× 5× 这类系数乘）
    .replace(/^[ \t\u3000]*[^#\-\n]*?(?:BMR\s*=|TDEE\s*=|10×|6\.25×|5×|缺口=|摄入\s*=|≥BMR|女性不低于|安全线(?:为|[:：])|故调整为|四舍五入)[^\n]*\n?/gm, '')
    // 5) 折叠连续空行（清洗后产生的多余空行）
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 只有清洗后确实变化了才写 displayContent，保证不无故改动
  if (sanitized && sanitized.length > 0 && sanitized !== text.trim()) {
    msg.displayContent = sanitized;
  }
  return msg;
}

const inputText = ref('');
const loading = ref(false);
const scrollTop = ref(0);
// 用户是否停留在消息列表底部附近：false 时不再强制滚到底，避免打断翻看历史
const userNearBottom = ref(true);
// 历史消息加载中标记，防止 scrolltoupper 连续触发重复加载
const loadingMore = ref(false);

// 消息队列：支持用户在搭搭回复时继续发送消息
const pendingMessages = ref([]); // 待发送消息队列
const isProcessing = ref(false); // 是否正在处理消息
const scrollIntoView = ref('');
const page = ref(1);
const avatarLoaded = ref(false);
const avatarLoadError = ref(false);

// 长按复制手势状态
const longPressTimer = ref(null);
const longPressMsg = ref(null);
let longPressStartX = 0;
let longPressStartY = 0;
const LONG_PRESS_DELAY = 600;
const MOVE_THRESHOLD = 10;

// 长按消息操作菜单
const showMsgActions = ref(false);
const actionMsg = ref(null);
const actionMenuX = ref(0);
const actionMenuY = ref(0);
const hasMore = ref(true);
const todayStats = ref({ intake: 0, burned: 0, remaining: 0, status: 'green' });
const authPopupRef = ref(null);

// 语音输入状态
const recording = ref(false);
const recordingSeconds = ref(0);
let recorderManager = null;
let voiceTimer = null;
let voiceTempFilePath = '';

// 编辑弹窗状态
const showEditModal = ref(false);
const editRecord = ref(null);
const editMealTime = ref('lunch');
const editFoods = ref([]);
const editMode = ref('edit'); // 'edit' | 'confirm'
const editTargetMsg = ref(null);
// 待确认记录队列：同一条消息可能沉淀多条（如一条回复含多个食谱），逐个确认
const pendingQueue = ref([]);
const showFoodPicker = ref(false);
const foodKeyword = ref('');
const foodSearchResults = ref([]);
const currentFoodCategory = ref('all');
const foodCategories = [
  { key: 'all', label: '全部' },
  { key: 'staple', label: '主食' },
  { key: 'vegetable', label: '蔬果' },
  { key: 'meat', label: '肉蛋奶' },
  { key: 'bean', label: '豆类坚果' },
  { key: 'snack', label: '零食饮料' },
  { key: 'dish', label: '中式菜肴' }
];

// 记录类型相关
const editRecordType = ref('diet'); // diet | body | exercise | habit | asset
const editBodyData = ref([]);
const editExercises = ref([]);
const editHabitData = ref({ type: 'water', value: '' });
const editAssetData = ref({ type: '', title: '', content: '', ingredients: '', steps: '', tip: '' });

const ASSET_TYPES = ['recipe', 'method', 'pitfall', 'insight', 'quote'];
const RECORD_TYPES = ['diet_record', 'exercise_record', 'body_data', 'habit'];
const assetTypeLabelMap = {
  recipe: '食谱',
  method: '方法',
  pitfall: '踩坑',
  insight: '感悟',
  quote: '金句'
};

const mealOptions = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '加餐' }
];

// 标签映射
const bodyTypeLabelMap = {
  weight: '体重',
  body_fat: '体脂',
  waist: '腰围',
  hip: '臀围',
  chest: '胸围',
  arm: '手臂围',
  thigh: '大腿围',
  calf: '小腿围'
};

const bodyTypeCodeMap = Object.fromEntries(
  Object.entries(bodyTypeLabelMap).map(([code, label]) => [label, code])
);

function normalizeBodyType(type) {
  return bodyTypeCodeMap[type] || type || 'weight';
}

const habitTypeLabelMap = {
  water: '饮水量'
};

const habitTypeOptions = [
  { label: '饮水', value: 'water', unit: 'ml' }
];

const modes = [
  { label: '温柔', value: 'gentle' },
  { label: '严格', value: 'strict' },
  { label: '毒舌', value: 'tease' }
];

// 搭子名字固定为「搭搭」，不可修改
const partnerName = computed(() => '搭搭');
const currentMode = computed(() => userStore.userInfo?.partner?.mode || 'gentle');
const partnerAvatarUrl = computed(() => {
  if (avatarLoadError.value) {
    return '/static/image/icon/rou.png';
  }
  const map = {
    gentle: '/static/image/icon/rou.png',
    strict: '/static/image/icon/zhuan.png',
    tease: '/static/image/icon/sun.png'
  };
  return map[currentMode.value] || '/static/image/icon/rou.png';
});

function onAvatarLoad() {
  avatarLoaded.value = true;
  if (messages.value.length > 0) {
    scrollToBottom();
  }
}

function onAvatarError() {
  avatarLoadError.value = true;
  avatarLoaded.value = true;
  if (messages.value.length > 0) {
    scrollToBottom();
  }
}
const partnerStatus = computed(() => userStore.userInfo?.partner?.status || 'awake');
const partnerStatusText = computed(() => userStore.userInfo?.partner?.status_text || '刚刚起床');

const todayLabel = computed(() => formatDate(new Date(), 'YYYY年M月D日'));

function isAssetType(type) {
  return ASSET_TYPES.includes(type);
}

function isRecordType(type) {
  return RECORD_TYPES.includes(type);
}

function showRecordTag(msg) {
  // 给业务记录（饮食/运动/身体/习惯）以及食谱显示"已记录"
  // 且必须有 precipitation_id，否则点击后无法编辑
  const recordTypes = [...RECORD_TYPES, 'recipe'];
  return Number(msg.precipitation_status) === 1 && recordTypes.includes(msg.precipitation_type) && !!msg.precipitation_id;
}

function showPendingTag(msg) {
  const recordTypes = [...RECORD_TYPES, 'recipe'];
  return Number(msg.precipitation_status) === 2 && recordTypes.includes(msg.precipitation_type);
}

function getMessageText(msg) {
  if (!msg) return '';
  return msg.displayContent !== undefined ? msg.displayContent : msg.content;
}

function copyMessage(msg) {
  const text = getMessageText(msg);
  if (!text) return;
  uni.setClipboardData({
    data: text,
    success: () => {
      uni.showToast({ title: '复制成功', icon: 'none' });
    },
    fail: () => {
      uni.showToast({ title: '复制失败', icon: 'none' });
    }
  });
}

function gotoReportMessage(msg) {
  const text = getMessageText(msg);
  const url = `/pages/user/feedback?tab=report&content=${encodeURIComponent(text)}`;
  uni.navigateTo({ url });
}

function openMsgActionMenu(msg) {
  actionMsg.value = msg;
  showMsgActions.value = true;
}

function closeMsgActionMenu() {
  showMsgActions.value = false;
  actionMsg.value = null;
}

function goSettings() {
  uni.navigateTo({ url: '/pages/chat/settings' });
}

function goUser() {
  uni.navigateTo({ url: '/pages/user/index' });
}

function onMenuCopy() {
  if (actionMsg.value) {
    copyMessage(actionMsg.value);
  }
  closeMsgActionMenu();
}

function onMenuReport() {
  if (actionMsg.value) {
    gotoReportMessage(actionMsg.value);
  }
  closeMsgActionMenu();
}

function clearLongPressTimer() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
  longPressMsg.value = null;
}

function handleTouchStart(e, msg) {
  const touch = e.touches?.[0];
  if (!touch) return;
  longPressStartX = touch.clientX;
  longPressStartY = touch.clientY;
  longPressMsg.value = msg;
  longPressTimer.value = setTimeout(() => {
    longPressTimer.value = null;
    if (longPressMsg.value) {
      if (longPressMsg.value.role === 'partner') {
        actionMenuX.value = longPressStartX;
        actionMenuY.value = longPressStartY;
        openMsgActionMenu(longPressMsg.value);
      } else {
        copyMessage(longPressMsg.value);
      }
      longPressMsg.value = null;
    }
  }, LONG_PRESS_DELAY);
}

function handleTouchMove(e) {
  const touch = e.touches?.[0];
  if (!touch || !longPressTimer.value) return;
  const dx = Math.abs(touch.clientX - longPressStartX);
  const dy = Math.abs(touch.clientY - longPressStartY);
  if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
    clearLongPressTimer();
  }
}

function handleTouchEnd() {
  clearLongPressTimer();
}

// 搭子心情池（按时间段分组，每次随机选取）
const moodPool = {
  morning: [    // 6-9点
    { emoji: '😊', text: '元气满满' },
    { emoji: '☀️', text: '阳光正好' },
    { emoji: '🌅', text: '早起打卡' },
    { emoji: '✨', text: '精神百倍' },
    { emoji: '🥰', text: '心情不错' },
    { emoji: '🌻', text: '充满能量' }
  ],
  forenoon: [   // 9-12点
    { emoji: '💪', text: '干劲十足' },
    { emoji: '🎯', text: '专注模式' },
    { emoji: '☕', text: '咖啡续命中' },
    { emoji: '🔥', text: '火力全开' },
    { emoji: '🚀', text: '效率拉满' },
    { emoji: '🤓', text: '认真工作' }
  ],
  noon: [       // 12-14点
    { emoji: '😋', text: '干饭时间' },
    { emoji: '🍱', text: '准备干饭' },
    { emoji: '🥗', text: '健康饮食' },
    { emoji: '🍜', text: '美食诱惑' },
    { emoji: '🤤', text: '有点饿了' },
    { emoji: '🍽️', text: '午餐时间' }
  ],
  afternoon: [  // 14-17点
    { emoji: '😌', text: '佛系摸鱼' },
    { emoji: '🍵', text: '下午茶时间' },
    { emoji: '🥱', text: '微微犯困' },
    { emoji: '🐟', text: '摸鱼中' },
    { emoji: '🌤️', text: '悠闲时光' },
    { emoji: '😎', text: '轻松一刻' }
  ],
  evening: [    // 17-19点
    { emoji: '🎉', text: '下班快乐' },
    { emoji: '🏠', text: '准备回家' },
    { emoji: '🌇', text: '晚霞很美' },
    { emoji: '🥳', text: '解放啦' },
    { emoji: '✌️', text: '今日收工' },
    { emoji: '🎶', text: '心情轻快' }
  ],
  night: [      // 19-21点
    { emoji: '🏃', text: '运动时间' },
    { emoji: '🧘', text: '放松身心' },
    { emoji: '📺', text: '追剧模式' },
    { emoji: '🛁', text: '准备洗漱' },
    { emoji: '🌙', text: '夜晚宁静' },
    { emoji: '💆', text: '享受当下' }
  ],
  lateNight: [  // 21-23点
    { emoji: '😴', text: '有点困了' },
    { emoji: '🛌', text: '准备睡觉' },
    { emoji: '💤', text: '哈欠连天' },
    { emoji: '🌃', text: '夜色温柔' },
    { emoji: '📖', text: '睡前阅读' },
    { emoji: '😪', text: '眼皮打架' }
  ],
  midnight: [   // 23-6点
    { emoji: '😴', text: '睡觉中' },
    { emoji: '💤', text: '梦乡里' },
    { emoji: '🌌', text: '深夜静谧' },
    { emoji: '⭐', text: '星星伴眠' },
    { emoji: '🛌', text: '休息中' },
    { emoji: '🌛', text: '月亮不睡' }
  ]
};

function getRandomMood(hour) {
  let pool;
  if (hour >= 6 && hour < 9) pool = moodPool.morning;
  else if (hour >= 9 && hour < 12) pool = moodPool.forenoon;
  else if (hour >= 12 && hour < 14) pool = moodPool.noon;
  else if (hour >= 14 && hour < 17) pool = moodPool.afternoon;
  else if (hour >= 17 && hour < 19) pool = moodPool.evening;
  else if (hour >= 19 && hour < 21) pool = moodPool.night;
  else if (hour >= 21 && hour < 23) pool = moodPool.lateNight;
  else pool = moodPool.midnight;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 缓存当前小时的心情，避免频繁切换
let cachedMood = null;
let cachedHour = -1;

const partnerMood = computed(() => {
  const hour = new Date().getHours();
  if (cachedHour !== hour || !cachedMood) {
    cachedHour = hour;
    cachedMood = getRandomMood(hour);
  }
  return cachedMood;
});

const partnerMoodEmoji = computed(() => partnerMood.value.emoji);
const partnerMoodText = computed(() => partnerMood.value.text);

onMounted(() => {
  preloadAvatarImages();
  // 先完成首帧渲染（欢迎消息立即可见），再异步加载数据，防止白屏
  nextTick(() => {
    if (userStore.isLoggedIn) {
      userStore.fetchUserInfo();
      loadMessages(true);
      loadTodayStats();
      checkWakeupMessage();
    }
    // 量取列表可视高度（判断用户是否在底部附近用，小程序无 DOM 走 SelectorQuery）
    setTimeout(initScrollMetrics, 300);
  });
});

/**
 * 预加载头像图片，减少 AI 对话时图片闪烁
 */
function preloadAvatarImages() {
  if (typeof Image === 'undefined') return;
  const paths = [
    '/static/image/icon/rou.png',
    '/static/image/icon/zhuan.png',
    '/static/image/icon/sun.png'
  ];
  paths.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

onShow(() => {
  // 消息已在内存中，直接滚动到底部（不再重新加载）
  if (messages.value.length > 0) {
    // 延迟一次滚动，给页面渲染留出时间，避免白屏
    requestAnimationFrame ? requestAnimationFrame(() => scrollToBottom(true)) : setTimeout(() => scrollToBottom(true), 50);
  }
  if (userStore.isLoggedIn) {
    // 延迟检查建议消息，避免阻塞首帧渲染
    nextTick(() => checkAdviceMessage());
  }
});

// 检查减重建议（后端通过 advice_pending 标记幂等，无待生成时返回空）
let checkingAdvice = false;
async function checkAdviceMessage() {
  if (checkingAdvice) return;
  checkingAdvice = true;
  try {
    const res = await chatApi.getAdvice();
    const msg = res.code === 0 && res.data ? res.data.message : null;
    if (msg && !messages.value.some(m => m.id === msg.id)) {
      const chatMsg = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        content_type: msg.content_type,
        created_at: msg.created_at,
        precipitation_status: 0
      };
      sanitizePartnerMessage(chatMsg);
      messages.value.push(chatMsg);
      if (msg.content && msg.content.length > 60) {
        startTypeWriter(chatMsg);
      }
      scrollToBottom();
    }
  } catch (err) {
    console.error('获取减重建议失败:', err);
  } finally {
    checkingAdvice = false;
  }
}

// 检查冷启动唤醒消息
async function checkWakeupMessage() {
  try {
    const res = await chatApi.getChatStats();
    if (res.code === 0 && res.data) {
      const stats = res.data;
      if (stats.consecutive_unread >= 5) {
        const wakeupRes = await chatApi.sendWakeupMessage();
        if (wakeupRes.code === 0 && wakeupRes.data) {
          const msg = wakeupRes.data.message;
          const pushObj = {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            content_type: msg.content_type,
            created_at: msg.created_at,
            precipitation_status: 0,
            is_template: true
          };
          sanitizePartnerMessage(pushObj);
          messages.value.push(pushObj);
          scrollToBottom();
        }
      }
    }
  } catch (err) {
    console.error('检查唤醒消息失败:', err);
  }
}

// 加载聊天记录
async function loadMessages(reset = false) {
  if (reset) {
    page.value = 1;
  }
  if (!hasMore.value && !reset) return;

  try {
    const res = await chatApi.getMessages({ page: page.value, size: 20 });
    let list = res.data.list || [];

    list = list.map(msg => ({
      ...msg,
      precipitation_status: Number(msg.precipitation_status) || 0,
      precipitation_id: msg.precipitation_id || null,
      precipitation_type: msg.precipitation_type || null
    })).map(m => sanitizePartnerMessage(m));

    if (reset) {
      messages.value = list;
      scrollToBottom(true);
      // 图片/气泡布局可能还没完成，延迟再滚几次兜底
      [500, 1500, 2500].forEach(delay => setTimeout(() => scrollToBottom(true), delay));
    } else {
      const oldHeight = await getScrollHeight();
      messages.value = [...list, ...messages.value];
      nextTick(async () => {
        const newHeight = await getScrollHeight();
        scrollTop.value = newHeight - oldHeight + 1;
      });
    }

    hasMore.value = res.data.pagination.has_more;
    page.value++;

    // 加载这些消息关联的待确认资产
    const messageIds = list.map(m => m.id).filter(Boolean);
    if (messageIds.length) {
      loadPendingAssets(messageIds);
    }
  } catch (err) {
    console.error('加载消息失败:', err);
  }
}

function onAssetSaved(messageId, assetId) {
  const list = pendingAssetsMap.value[messageId] || [];
  pendingAssetsMap.value[messageId] = list.filter(a => a.id !== assetId);
}

function onAssetDiscarded(messageId, assetId) {
  const list = pendingAssetsMap.value[messageId] || [];
  pendingAssetsMap.value[messageId] = list.filter(a => a.id !== assetId);
}

// 批量查询聊天消息关联的待确认资产
async function loadPendingAssets(messageIds) {
  try {
    const res = await chatApi.getPendingAssets(messageIds);
    const items = res.data.list || [];
    for (const item of items) {
      const key = item.chat_message_id;
      if (!key) continue;
      const existing = pendingAssetsMap.value[key] || [];
      if (!existing.find(a => a.id === item.id)) {
        pendingAssetsMap.value[key] = [...existing, item];
      }
    }
  } catch (e) {
    console.error('加载待确认资产失败:', e);
  }
}

// H5 专用：uni-app H5 中 scroll-view 的可滚动区域是内部的 .uni-scroll-view（小程序无 DOM，返回 null）
function getScrollContainer() {
  // #ifdef H5
  return document.querySelector('.message-list .uni-scroll-view') ||
         document.querySelector('.message-list') ||
         document.querySelector('uni-scroll-view .uni-scroll-view');
  // #endif
  return null;
}

// 列表可视高度：H5 读 DOM；小程序用 SelectorQuery 量一次缓存（用于判断是否在底部附近）
const listClientHeight = ref(0);
function initScrollMetrics() {
  // #ifdef H5
  const el = getScrollContainer();
  if (el) listClientHeight.value = el.clientHeight;
  // #endif
  // #ifndef H5
  uni.createSelectorQuery().select('.message-list').boundingClientRect((rect) => {
    if (rect && rect.height) listClientHeight.value = rect.height;
  }).exec();
  // #endif
}

// 获取 scroll-view 滚动高度
function getScrollHeight() {
  return new Promise((resolve) => {
    nextTick(() => {
      // #ifdef H5
      const scrollView = getScrollContainer();
      resolve(scrollView ? scrollView.scrollHeight : 0);
      // #endif
      // #ifndef H5
      uni.createSelectorQuery().select('.message-list').fields({ scrollOffset: true }, (res) => {
        resolve(res && typeof res.scrollHeight === 'number' ? res.scrollHeight : 0);
      }).exec();
      // #endif
    });
  });
}

async function loadMore() {
  if (loadingMore.value) return;
  loadingMore.value = true;
  try {
    await loadMessages(false);
  } finally {
    loadingMore.value = false;
  }
}

// 跟踪用户滚动位置：离开底部超过阈值后，新消息/打字机不再强制拉回底部
function onListScroll(e) {
  const d = e.detail || {};
  if (typeof d.scrollTop !== 'number' || typeof d.scrollHeight !== 'number') return;
  // 小程序滚动事件 detail 自带 scrollHeight；可视高度用 initScrollMetrics 的缓存
  const clientH = listClientHeight.value;
  if (!clientH) return;
  userNearBottom.value = (d.scrollHeight - d.scrollTop - clientH) < 200;
}

// 加载今日概览
async function loadTodayStats() {
  try {
    const res = await recordApi.getToday();
    todayStats.value = res.data;
  } catch (err) {
    console.error('加载今日概览失败:', err);
  }
}

/**
 * 发送消息（支持消息队列，允许用户在搭搭回复时继续发送）
 * 核心逻辑：
 * 1. 用户消息立即显示到UI，不等待AI回复
 * 2. 所有待发送消息进入队列，顺序处理
 * 3. 当前消息处理完成后，自动处理队列中的下一条
 */
async function sendMessage() {
  const content = inputText.value.trim();
  if (!content) return;
  if (!userStore.requireAuth()) return;

  // 立即清空输入框，让用户可以继续输入
  inputText.value = '';

  // 试用权限校验（只在第一条消息或首次使用时校验）
  if (!isProcessing.value && pendingMessages.value.length === 0) {
    const perm = await checkPermission('ai_chat');
    if (!perm.allow_use) {
      if (perm.show_popup && authPopupRef.value) {
        authPopupRef.value.show(perm.popup_config);
      }
      inputText.value = content; // 恢复用户输入
      return;
    }
  }

  // 立即在UI上显示用户消息
  const tempId = Date.now();
  messages.value.push({
    id: tempId,
    role: 'user',
    content,
    precipitation_status: 0,
    created_at: new Date().toISOString()
  });
  scrollToBottom(true);

  // 将消息加入待处理队列
  pendingMessages.value.push({
    content,
    tempId,
    status: 'pending' // pending, processing, done, failed
  });

  console.log(`[sendMessage] 消息已加入队列，当前队列长度: ${pendingMessages.value.length}`);

  // 如果当前没有正在处理的消息，开始处理队列
  if (!isProcessing.value) {
    processMessageQueue();
  }
}

/**
 * 顺序处理消息队列
 * 确保同一时间只有一条消息在进行API调用和轮询
 */
async function processMessageQueue() {
  if (isProcessing.value) return; // 已经在处理队列
  if (pendingMessages.value.length === 0) return; // 队列为空

  isProcessing.value = true;
  loading.value = true; // 显示"搭子正在输入..."

  while (pendingMessages.value.length > 0) {
    const currentMsg = pendingMessages.value[0];
    currentMsg.status = 'processing';

    console.log(`[processMessageQueue] 处理第 ${pendingMessages.value.indexOf(currentMsg) + 1} 条消息: ${currentMsg.content.substring(0, 20)}...`);

    try {
      await processOneMessage(currentMsg.content, currentMsg.tempId);
      currentMsg.status = 'done';
    } catch (err) {
      console.error('[processMessageQueue] 消息处理失败:', err);
      currentMsg.status = 'failed';
      // 失败时恢复用户输入
      const idx = messages.value.findIndex(m => m.id === currentMsg.tempId);
      if (idx > -1) messages.value.splice(idx, 1);
      inputText.value = currentMsg.content;
      uni.showToast({ title: '发送失败，请重试', icon: 'none' });
    }

    // 从队列中移除已处理的消息
    pendingMessages.value.shift();
  }

  // 队列处理完成
  isProcessing.value = false;
  loading.value = false;
  console.log('[processMessageQueue] 消息队列处理完成');
}

/**
 * 处理单条消息的API调用和轮询逻辑
 * @param {string} content - 消息内容
 * @param {number} tempId - 临时消息ID
 */
async function processOneMessage(content, tempId) {
  const res = await chatApi.send(content);
  const data = res.data;

  if (!data || !data.user_message || !data.partner_message) {
    console.error('[processOneMessage] 后端返回结构异常:', data);
    throw new Error('后端返回结构异常');
  }

  console.log('[processOneMessage] 后端返回:', data.user_message.id, '沉淀状态:', data.user_message.precipitation_status);

  // 替换用户临时消息为服务器确认的消息
  const userMsgIndex = messages.value.findIndex(m => m.id === tempId);
  if (userMsgIndex > -1) {
    const userMsg = {
      ...data.user_message,
      precipitation_status: Number(data.user_message.precipitation_status) || 0,
      precipitation_id: data.user_message.precipitation_id || null,
      precipitation_type: data.user_message.precipitation_type || null
    };
    messages.value[userMsgIndex] = userMsg;
    console.log('[processOneMessage] 已替换用户消息，新ID:', userMsg.id);
  }

  // 添加搭搭的回复
  sanitizePartnerMessage(data.partner_message);
  messages.value.push(data.partner_message);
  if (data.partner_message?.role === 'partner' && data.partner_message?.content?.length > 60) {
    startTypeWriter(data.partner_message);
  }

  // 延迟拉取待确认资产
  setTimeout(() => {
    if (data.partner_message?.id) {
      loadPendingAssets([data.partner_message.id]);
    }
  }, 2500);
  setTimeout(() => {
    if (data.partner_message?.id) {
      loadPendingAssets([data.partner_message.id]);
    }
  }, 6000);

  // 如果需要异步helper，等待其回复完成
  if (data.async_helper) {
    await waitForAsyncHelper(data.partner_message.id, data.user_message.id);
  }

  loadTodayStats();
  reportCount('ai_chat');

  setTimeout(() => {
    refreshMessages();
  }, 3000);
}

/**
 * 等待异步helper回复完成
 * @param {number} partnerMessageId - 搭搭第一条回复ID（轮询基线）
 * @param {number} userMessageId - 用户消息ID（用于更新沉淀状态）
 */
function waitForAsyncHelper(partnerMessageId, userMessageId) {
  return new Promise((resolve, reject) => {
    console.log('[waitForAsyncHelper] 开始轮询异步helper，基线消息ID:', partnerMessageId);

    let pollCount = 0;
    let pollErrors = 0;
    const maxPolls = 120;
    const maxPollErrors = 5;

    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        const res = await chatApi.getMessages({ page: 1, size: 20 });
        const list = res.data.list || [];

        // 查找新的partner消息（排除基线）
        const newMessages = list.filter(m =>
          m.role === 'partner' &&
          m.id > partnerMessageId &&
          !messages.value.some(existing => existing.id === m.id)
        );

        if (newMessages.length > 0) {
          newMessages.forEach(msg => {
            sanitizePartnerMessage(msg);
            messages.value.push(msg);
            if (msg.role === 'partner' && msg.content && msg.content.length > 60) {
              startTypeWriter(msg);
            }
          });
          console.log('[waitForAsyncHelper] 获取到新消息:', newMessages.length);
          loadPendingAssets(newMessages.map(m => m.id));
          setTimeout(() => {
            loadPendingAssets(newMessages.map(m => m.id));
          }, 5000);
          clearInterval(pollInterval);
          resolve();
          return;
        }

        // 更新用户消息的沉淀状态
        const userMsgIndex = messages.value.findIndex(m => m.id === userMessageId);
        if (userMsgIndex > -1) {
          const latestUserMsg = list.find(m => m.id === userMessageId);
          if (latestUserMsg && latestUserMsg.precipitation_status > 0) {
            messages.value[userMsgIndex].precipitation_status = latestUserMsg.precipitation_status;
            messages.value[userMsgIndex].precipitation_id = latestUserMsg.precipitation_id;
            messages.value[userMsgIndex].precipitation_type = latestUserMsg.precipitation_type;
          }
        }

        // 轮询超时
        if (pollCount >= maxPolls) {
          console.log('[waitForAsyncHelper] 轮询超时');
          clearInterval(pollInterval);
          resolve(); // 超时也继续，不阻塞后续消息
        }
      } catch (e) {
        pollErrors++;
        if (pollErrors >= maxPollErrors) {
          console.log('[waitForAsyncHelper] 轮询连续失败过多');
          clearInterval(pollInterval);
          resolve();
        }
      }
    }, 1000);
  });
}

// 打字机效果：长回复逐字显示，避免内容一下子全部弹出
function startTypeWriter(msg, speed) {
  if (!msg || !msg.content) return;
  const full = msg.content;
  // 根据长度动态调整速度，长文更快、短文更自然
  // #ifdef MP-WEIXIN
  // 小程序端降低 setData 频率（每次数据更新都要过 JS↔Native 桥）：约 40 次更新完成
  const step = Math.max(1, Math.ceil(full.length / 40));
  const interval = speed ?? 60;
  // #endif
  // #ifndef MP-WEIXIN
  const step = full.length > 500 ? 3 : full.length > 200 ? 2 : 1;
  const interval = speed ?? (full.length > 400 ? 10 : full.length > 150 ? 15 : 20);
  // #endif
  // 直接以第一段起笔，避免出现只有标签没有内容的空气泡
  msg.displayContent = full.slice(0, step);
  let i = step;
  const timer = setInterval(() => {
    if (i < full.length) {
      i = Math.min(full.length, i + step);
      msg.displayContent = full.slice(0, i);
      scrollToBottom();
    } else {
      clearInterval(timer);
      msg.displayContent = full;
    }
  }, interval);
}

// 刷新消息列表（获取沉淀状态更新）
async function refreshMessages() {
  try {
    console.log('[refreshMessages] 开始刷新...');
    const res = await chatApi.getMessages({ page: 1, size: 20 });
    const list = res.data.list || [];
    console.log('[refreshMessages] 获取到消息数:', list.length);

    const statusMap = new Map();
    for (const msg of list) {
      if (msg.precipitation_status > 0) {
        statusMap.set(msg.id, {
          precipitation_status: msg.precipitation_status,
          precipitation_id: msg.precipitation_id,
          precipitation_type: msg.precipitation_type
        });
        console.log('[refreshMessages] 沉淀状态:', msg.id, msg.precipitation_status, msg.precipitation_id, msg.precipitation_type);
      }
    }
    console.log('[refreshMessages] statusMap大小:', statusMap.size);

    let hasUpdate = false;
    for (let i = 0; i < messages.value.length; i++) {
      const msg = messages.value[i];
      if (msg.role === 'user' && statusMap.has(msg.id)) {
        const newStatus = statusMap.get(msg.id);
        const currentStatus = Number(msg.precipitation_status) || 0;
        const targetStatus = Number(newStatus.precipitation_status) || 0;
        console.log('[refreshMessages] 匹配消息:', msg.id, '当前状态:', currentStatus, '新状态:', targetStatus);
        if (currentStatus !== targetStatus) {
          messages.value[i] = {
            ...msg,
            precipitation_status: targetStatus,
            precipitation_id: newStatus.precipitation_id,
            precipitation_type: newStatus.precipitation_type || msg.precipitation_type
          };
          hasUpdate = true;
          console.log('[refreshMessages] 已更新消息:', msg.id, '新状态:', targetStatus);
        }
      }
    }

    if (hasUpdate) {
      messages.value = [...messages.value];
      console.log('[refreshMessages] 强制刷新完成');
    } else {
      console.log('[refreshMessages] 无需更新');
    }

    // 同时刷新待确认资产
    loadPendingAssets(list.map(m => m.id));
  } catch (err) {
    console.error('刷新消息失败:', err);
  }
}

// 语音输入
function initRecorder() {
  try {
    recorderManager = uni.getRecorderManager();
    recorderManager.onStop((res) => {
      voiceTempFilePath = res.tempFilePath;
      if (recording.value) {
        uploadVoice(voiceTempFilePath);
      }
      recording.value = false;
      stopVoiceTimer();
    });
    recorderManager.onError((err) => {
      console.error('录音失败:', err);
      recording.value = false;
      stopVoiceTimer();
      uni.showToast({ title: '录音失败', icon: 'none' });
    });
  } catch (e) {
    console.error('初始化录音失败:', e);
  }
}

function startVoiceRecord() {
  if (!recorderManager) initRecorder();
  if (!recorderManager) {
    uni.showToast({ title: '当前环境不支持录音', icon: 'none' });
    return;
  }
  recording.value = true;
  recordingSeconds.value = 0;
  voiceTimer = setInterval(() => {
    recordingSeconds.value++;
    if (recordingSeconds.value >= 60) stopVoiceRecord();
  }, 1000);
  try {
    recorderManager.start({ duration: 60000, format: 'mp3' });
  } catch (e) {
    console.error(e);
  }
}

function stopVoiceRecord() {
  if (!recording.value) return;
  if (recorderManager) {
    try {
      recorderManager.stop();
    } catch (e) {
      recording.value = false;
      stopVoiceTimer();
    }
  }
}

function stopVoiceTimer() {
  if (voiceTimer) {
    clearInterval(voiceTimer);
    voiceTimer = null;
  }
}

async function uploadVoice(filePath) {
  if (!filePath) return;
  try {
    uni.showLoading({ title: '识别中...' });
    const res = await voiceApi.transcribe(filePath);
    uni.hideLoading();
    const text = res.data?.text || '';
    if (text) {
      inputText.value = text;
      sendMessage();
    } else {
      uni.showToast({ title: '未识别到语音，请重试', icon: 'none' });
    }
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '识别失败', icon: 'none' });
  }
}

// 跳转到记录页面
function goToRecord(type) {
  const urls = {
    diet: '/pages/record/diet-detail',
    exercise: '/pages/record/exercise-detail',
    weight: '/pages/record/body-data',
    water: '/pages/record/habit'
  };
  uni.navigateTo({ url: urls[type] || '/pages/record/index' });
}

// 滚动到底部；force=false 时若用户已上翻阅读历史则不打断
function scrollToBottom(force = false) {
  if (!force && !userNearBottom.value) return;
  userNearBottom.value = true;
  nextTick(() => {
    // scroll-into-view 各端通用（H5/小程序/App 的 scroll-view 都支持）
    scrollIntoView.value = 'msg-bottom-spacer';
    // #ifdef H5
    nextTick(() => {
      // 关键：uni-app H5 的可滚动容器是 .message-list 内部的 .uni-scroll-view，
      // 必须把 scrollTop 同步到这个容器上，否则页面会停留在顶部。
      const scrollView = getScrollContainer();
      if (scrollView) {
        scrollTop.value = scrollView.scrollHeight + 9999;
      }
    });
    // #endif
    setTimeout(() => {
      scrollIntoView.value = '';
    }, 300);
  });
}

// 打开编辑弹窗
function openEditModal(record, mode = 'edit', targetMsg = null) {
  editRecord.value = record;
  editMode.value = mode;
  editTargetMsg.value = targetMsg;
  const data = record.extracted_data || {};
  const recordType = record.type || 'diet_record';

  switch (recordType) {
    case 'diet_record': {
      const validMeals = ['breakfast', 'lunch', 'dinner', 'snack'];
      editMealTime.value = validMeals.includes(data.meal_time) ? data.meal_time : 'lunch';
      editFoods.value = (data.foods || []).map(f => {
        const weight = parseFloat(f.weight) || 0;
        const calorie = parseFloat(f.calorie) || 0;
        return {
          name: f.name || '',
          weight: f.weight || '',
          quantity: f.quantity || '',
          unit: f.unit || '个',
          calorie,
          calorie_per_100g: weight > 0 ? (calorie / weight) * 100 : calorie || 0,
          protein: f.protein || 0,
          carb: f.carb || 0,
          fat: f.fat || 0
        };
      });
      if (editFoods.value.length === 0) {
        editFoods.value.push({ name: '', weight: '', quantity: '', unit: '个', calorie: 0, calorie_per_100g: 0, protein: 0, carb: 0, fat: 0 });
      }
      editRecordType.value = 'diet';
      break;
    }
    case 'body_data': {
      // 支持的所有身体数据类型
      const allBodyTypes = [
        { type: 'weight', unit: 'kg' },
        { type: 'body_fat', unit: '%' },
        { type: 'waist', unit: 'cm' },
        { type: 'hip', unit: 'cm' },
        { type: 'chest', unit: 'cm' },
        { type: 'arm', unit: 'cm' },
        { type: 'thigh', unit: 'cm' },
        { type: 'calf', unit: 'cm' }
      ];

      // 汇总已有数据
      const existingMap = {};
      const mainSubType = normalizeBodyType(data.sub_type || record.sub_type);
      if (mainSubType && data.value !== undefined && data.value !== null && data.value !== '') {
        existingMap[mainSubType] = String(data.value);
      }
      if (data.body_items && Array.isArray(data.body_items)) {
        for (const item of data.body_items) {
          if (item.value !== undefined && item.value !== null && item.value !== '') {
            existingMap[normalizeBodyType(item.sub_type)] = String(item.value);
          }
        }
      }

      editBodyData.value = allBodyTypes.map(t => ({
        type: t.type,
        value: existingMap[t.type] || '',
        unit: t.unit
      }));
      editRecordType.value = 'body';
      break;
    }
    case 'exercise_record': {
      editExercises.value = (data.exercises || []).map(e => ({
        name: e.name || '',
        duration: String(e.duration || ''),
        intensity: e.intensity || 'moderate',
        calorie: String(e.calorie || ''),
        distance: e.distance ? String(e.distance) : ''
      }));
      if (editExercises.value.length === 0) {
        editExercises.value.push({ name: '', duration: '', intensity: 'moderate', calorie: '', distance: '' });
      }
      initExerciseCalorieRates();
      editRecordType.value = 'exercise';
      break;
    }
    case 'habit': {
      const habitValue = data.value || '';
      const numericValue = String(habitValue).replace(/[^0-9.]/g, '');
      editHabitData.value = {
        type: 'water',
        value: numericValue,
        unit: data.unit || 'ml'
      };
      editRecordType.value = 'habit';
      break;
    }
    default: {
      if (isAssetType(recordType)) {
        const ext = data || {};
        const ingredients = Array.isArray(ext.ingredients)
          ? ext.ingredients.map(i => (typeof i === 'string' ? i : i.name)).join('\n')
          : '';
        editAssetData.value = {
          type: recordType,
          title: data.title || data.name || assetTypeLabelMap[recordType] || recordType,
          content: data.content || record.content || '',
          ingredients,
          steps: ext.steps || '',
          tip: ext.tip || ''
        };
        editRecordType.value = 'asset';
      } else {
        editRecordType.value = 'diet';
      }
      break;
    }
  }

  showEditModal.value = true;
}

// 关闭编辑弹窗
function closeEditModal() {
  showEditModal.value = false;
  editRecord.value = null;
  editMode.value = 'edit';
  editTargetMsg.value = null;
  editRecordType.value = 'diet';
  editAssetData.value = { type: '', title: '', content: '', ingredients: '', steps: '', tip: '' };
  pendingQueue.value = [];
}

// 同一条消息可能沉淀多条记录（如一条回复含多个食谱），确认/忽略后推进到下一条
// 返回 true 表示还有下一条并已直接打开（调用方不再关闭弹窗）
function advancePendingQueue() {
  if (pendingQueue.value.length === 0) return false;
  pendingQueue.value.shift();
  if (pendingQueue.value.length === 0) return false;
  openEditModal(pendingQueue.value[0], 'confirm', editTargetMsg.value);
  return true;
}

// 忽略/取消编辑弹窗
async function rejectEdit() {
  if (editMode.value === 'confirm' && editRecord.value) {
    try {
      await chatApi.confirmPrecipitation({ precipitation_id: editRecord.value.id, confirmed: false });
      uni.showToast({ title: '已忽略', icon: 'none' });
      // 同一条消息还有下一条待确认记录时直接继续
      if (advancePendingQueue()) return;
      if (editTargetMsg.value) {
        editTargetMsg.value.precipitation_status = 3;
      }
      refreshMessages();
    } catch (err) {
      console.error(err);
      uni.showToast({ title: '操作失败', icon: 'none' });
    }
  }
  closeEditModal();
}

// 计算弹窗内某个食物的实时热量
function computedFoodCalorie(food) {
  const weight = parseFloat(food.weight) || 0;
  if (weight <= 0) return 0;
  const per100g = parseFloat(food.calorie_per_100g) || 0;
  if (per100g > 0) return Math.round(per100g * weight / 100);
  return Math.round(parseFloat(food.calorie) || 0);
}

// 添加食物行
function addFoodRow() {
  editFoods.value.push({ name: '', weight: '', quantity: '', unit: '个', calorie: 0, calorie_per_100g: 0, protein: 0, carb: 0, fat: 0 });
}

// 打开食物选择面板
async function openFoodPicker() {
  showFoodPicker.value = true;
  foodKeyword.value = '';
  await searchFoods();
}

// 搜索食物
async function searchFoods() {
  try {
    const params = { page: 1, size: 50 };
    if (foodKeyword.value.trim()) params.keyword = foodKeyword.value;
    if (currentFoodCategory.value !== 'all') params.category = currentFoodCategory.value;
    const res = await systemApi.getFoods(params);
    foodSearchResults.value = res.data?.list || [];
  } catch (err) {
    console.error('搜索食物失败:', err);
    foodSearchResults.value = [];
  }
}

// 切换食物分类
async function switchFoodCategory(key) {
  currentFoodCategory.value = key;
  await searchFoods();
}

// 从选择器添加食物
function selectFoodFromPicker(food) {
  const unitWeight = parseFloat(food.unit_weight) || 100;
  const unit = food.unit || 'g';
  const per100g = parseFloat(food.calorie_per_100g) || 0;
  editFoods.value.push({
    name: food.name,
    quantity: 1,
    unit: unit,
    weight: unitWeight,
    calorie: Math.round(per100g * unitWeight / 100),
    calorie_per_100g: per100g,
    protein: parseFloat(food.protein_per_100g) || 0,
    carb: parseFloat(food.carb_per_100g) || 0,
    fat: parseFloat(food.fat_per_100g) || 0
  });
  showFoodPicker.value = false;
  uni.showToast({ title: '已添加', icon: 'success' });
}

// 删除食物行
function removeFoodRow(index) {
  editFoods.value.splice(index, 1);
  if (editFoods.value.length === 0) {
    editFoods.value.push({ name: '', weight: '', quantity: '', unit: '个', calorie: 0, calorie_per_100g: 0, protein: 0, carb: 0, fat: 0 });
  }
}

// 初始化每项运动的“每分钟热量”并同步一次热量显示
function initExerciseCalorieRates() {
  editExercises.value.forEach(ex => {
    const duration = parseFloat(ex.duration) || 0;
    const calorie = parseFloat(ex.calorie) || 0;
    ex._caloriePerMinute = duration > 0 ? calorie / duration : 0;
    if (duration > 0 && ex._caloriePerMinute) {
      ex.calorie = String(Math.round(duration * ex._caloriePerMinute));
    }
  });
}

// 时长变化时按分钟热量同步更新消耗
function onExerciseDurationInput(index) {
  const ex = editExercises.value[index];
  const duration = parseFloat(ex.duration) || 0;
  if (duration > 0 && ex._caloriePerMinute) {
    ex.calorie = String(Math.round(duration * ex._caloriePerMinute));
  }
}

// 用户手动修改热量时更新“每分钟热量”比例
function onExerciseCalorieInput(index) {
  const ex = editExercises.value[index];
  const duration = parseFloat(ex.duration) || 0;
  const calorie = parseFloat(ex.calorie) || 0;
  if (duration > 0) {
    ex._caloriePerMinute = calorie / duration;
  }
}

// 删除运动行
function removeExerciseRow(index) {
  editExercises.value.splice(index, 1);
  if (editExercises.value.length === 0) {
    editExercises.value.push({ name: '', duration: '', intensity: 'moderate', calorie: 0 });
  }
}

// 添加运动行
function addExerciseRow() {
  editExercises.value.push({ name: '', duration: '', intensity: 'moderate', calorie: 0 });
}

// 保存编辑
async function saveEdit() {
  if (!editRecord.value) return;

  const recordType = editRecord.value.type || 'diet_record';
  let extractedData = {};
  let updateType = recordType;
  let updateSubType = '';

  try {
    switch (recordType) {
      case 'diet_record': {
        const validFoods = editFoods.value.filter(f => f.name.trim());
        if (validFoods.length === 0) {
          uni.showToast({ title: '请至少填写一种食物', icon: 'none' });
          return;
        }
        const totalCalorie = validFoods.reduce((sum, f) => sum + (parseFloat(f.calorie) || 0), 0);
        const totalProtein = validFoods.reduce((sum, f) => sum + (parseFloat(f.protein) || 0), 0);
        const totalCarb = validFoods.reduce((sum, f) => sum + (parseFloat(f.carb) || 0), 0);
        const totalFat = validFoods.reduce((sum, f) => sum + (parseFloat(f.fat) || 0), 0);
        extractedData = {
          meal_time: editMealTime.value,
          foods: validFoods.map(f => ({
            name: f.name.trim(),
            weight: parseFloat(f.weight) || 0,
            quantity: parseFloat(f.quantity) || 1,
            unit: f.unit || 'g',
            calorie: parseFloat(f.calorie) || 0,
            protein: parseFloat(f.protein) || 0,
            carb: parseFloat(f.carb) || 0,
            fat: parseFloat(f.fat) || 0
          })),
          total_calorie: totalCalorie,
          total_protein: totalProtein,
          total_carb: totalCarb,
          total_fat: totalFat
        };
        updateSubType = editMealTime.value;
        break;
      }
      case 'body_data': {
        const validBodyItems = editBodyData.value.filter(item => item.value !== '' && item.value !== null && item.value !== undefined);
        if (validBodyItems.length === 0) {
          uni.showToast({ title: '请输入至少一项数值', icon: 'none' });
          return;
        }
        const firstItem = validBodyItems[0];
        extractedData = {
          sub_type: firstItem.type,
          value: parseFloat(firstItem.value) || 0,
          unit: firstItem.unit,
          body_items: validBodyItems.map(item => ({
            sub_type: item.type,
            value: parseFloat(item.value) || 0,
            unit: item.unit
          }))
        };
        updateSubType = firstItem.type;
        break;
      }
      case 'exercise_record': {
        const validExercises = editExercises.value.filter(e => e.name.trim());
        if (validExercises.length === 0) {
          uni.showToast({ title: '请至少填写一项运动', icon: 'none' });
          return;
        }
        // 保存前再按当前比例校准一次热量，避免只改时长未触发联动
        validExercises.forEach(e => {
          const duration = parseFloat(e.duration) || 0;
          if (duration > 0 && e._caloriePerMinute) {
            e.calorie = String(Math.round(duration * e._caloriePerMinute));
          }
        });
        extractedData = {
          exercises: validExercises.map(e => ({
            name: e.name.trim(),
            duration: parseFloat(e.duration) || 0,
            intensity: e.intensity || 'moderate',
            calorie: parseFloat(e.calorie) || 0,
            ...(e.distance ? { distance: parseFloat(e.distance) } : {})
          }))
        };
        updateSubType = 'exercise';
        break;
      }
      case 'habit': {
        if (!editHabitData.value.value) {
          uni.showToast({ title: '请输入数值', icon: 'none' });
          return;
        }
        extractedData = {
          sub_type: '喝水',
          value: parseFloat(editHabitData.value.value) || 0,
          unit: editHabitData.value.unit || 'ml'
        };
        updateSubType = '喝水';
        break;
      }
      case 'recipe': {
        const ingredients = (editAssetData.value.ingredients || '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean);
        extractedData = {
          title: editAssetData.value.title || assetTypeLabelMap[recordType] || recordType,
          content: editAssetData.value.content || '',
          ingredients,
          steps: editAssetData.value.steps || '',
          tip: editAssetData.value.tip || ''
        };
        updateSubType = recordType;
        break;
      }
      case 'method':
      case 'pitfall':
      case 'insight':
      case 'quote': {
        extractedData = {
          title: editAssetData.value.title || assetTypeLabelMap[recordType] || recordType,
          content: editAssetData.value.content || ''
        };
        updateSubType = recordType;
        break;
      }
    }

    if (editMode.value === 'confirm') {
      // 统一走确认沉淀接口，确保奖励、任务、聊天消息状态同步更新
      const res = await chatApi.confirmPrecipitation({
        precipitation_id: editRecord.value.id,
        confirmed: true,
        modified_data: extractedData
      });
      showRewardToast(res.data?.reward_messages || [], '已确认记录');
      // 同一条消息还有下一条待确认记录（如多个食谱）时直接继续，不翻转消息状态
      if (advancePendingQueue()) {
        loadTodayStats();
        return;
      }
      if (editTargetMsg.value) {
        editTargetMsg.value.precipitation_status = 1;
      }
    } else {
      await precipitationApi.update(editRecord.value.id, {
        type: updateType,
        sub_type: updateSubType,
        extracted_data: extractedData
      });
      uni.showToast({ title: '修改成功', icon: 'success' });
    }
    closeEditModal();
    loadTodayStats();
    refreshMessages();
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}

// 已记录标签点击
async function onConfirmedTag(msg) {
  if (!msg.precipitation_id) {
    showAutoRecordedModal.value = true;
    return;
  }

  try {
    const res = await precipitationApi.getList({ page: 1, size: 50 });
    const list = res.data.list || [];
    const record = list.find(r => r.id === msg.precipitation_id);
    if (!record) {
      uni.showToast({ title: '记录未找到', icon: 'none' });
      return;
    }
    openEditModal(record, 'edit', msg);
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
}

// 待确认标签点击
async function onPendingTag(msg) {
  try {
    let queue = [];
    if (!msg.precipitation_id) {
      //  preliminary 标签还没有沉淀记录，先创建一条待确认记录
      const createRes = await precipitationApi.create({
        chat_id: msg.id,
        content: msg.content,
        type: msg.precipitation_type
      });
      const record = createRes.data;
      msg.precipitation_id = record.id;
      queue = [record];
    } else {
      const res = await precipitationApi.getList({ page: 1, size: 50 });
      const list = res.data.list || [];
      // 同一消息的所有待确认记录一起排入队列（如一条回复提取出多个食谱）
      queue = list.filter(r => r.chat_id === msg.id && Number(r.status) === 0);
      if (queue.length === 0) {
        const record = list.find(r => r.id === msg.precipitation_id);
        if (record) queue = [record];
      }
    }
    if (queue.length === 0) {
      uni.showToast({ title: '记录未找到', icon: 'none' });
      return;
    }
    pendingQueue.value = queue;
    openEditModal(queue[0], 'confirm', msg);
  } catch (err) {
    console.error(err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
}
</script>
<style lang="scss" scoped>
.partner-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* 统一页面背景为浅绿色，与 status-bar、header 保持一致 */
  background: $green-light;
  overflow: hidden;
}

.status-bar {
  /*
   * 兜底第一行：iPhone 刘海屏基准高度（44px status-bar + 44px 胶囊让位 88rpx ≈ 44px）
   * 兜底第二行：优先取 uni-app 注入的 var(--status-bar-height)；
   * 关键：当 var 尚未注入（navigateTo 转场重排的前几个 frame），不会退化为 0，
   * 而是取 fallback 值 44px → 前后高度差仅 0~3px，不会出现肉眼可感的"下坠"。
   */
  height: calc(44px + 88rpx);
  height: calc(var(--status-bar-height, 44px) + 88rpx);
  flex-shrink: 0;
  background: $green-light; /* 与 header 背景一致，形成统一顶部绿色背景 */
}

.header {
  flex-shrink: 0;
  /* 与 status-bar 统一背景色，避免顶部出现分割线 */
  background: $green-light;
  /* 底部 padding 减少 8px（16rpx），让绿色底高度更紧凑 */
  padding: 20rpx 28rpx 8rpx;
}

.header-inner {
  display: flex;
  align-items: center;
}

.header-avatar {
  width: 220rpx;
  height: 126rpx;
  margin-right: 24rpx;
  margin-top: -12rpx;
  flex-shrink: 0;
}

.header-title-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: -12rpx;
  min-width: 0;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #563E22;
  line-height: 1.3;
}

.header-subtitle {
  font-size: 26rpx;
  color: #8DBB77;
  margin-top: 6rpx;
  line-height: 1.3;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.header-setting {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #8DBB77;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-setting-icon {
  width: 40rpx;
  height: 40rpx;
}

/* 消息列表 */
.message-list {
  flex: 1;
  min-height: 0;
  padding: 20rpx 40rpx;
  /*
   * 底部预留空间：
   * 输入区(input-area)总高约 100rpx（input-bar 72rpx + 上下 padding 28rpx），
   * 要求输入框上方只保留 8rpx（4px）浅绿色间距，
   * 所以 padding-bottom = 100rpx + 8rpx + 安全区。
   */
  padding-bottom: calc(108rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: #F7FBF4;
}

.date-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 32rpx;
}

.date-pill {
  display: inline-flex;
  align-items: center;
  background: transparent;
  padding: 0;
  font-size: 24rpx;
  color: #999999;
}

.date-pill::before,
.date-pill::after {
  content: '';
  display: inline-block;
  width: 100rpx;
  height: 1rpx;
  background: #E5E7EB;
}

.date-pill::before {
  margin-right: 24rpx;
}

.date-pill::after {
  margin-left: 24rpx;
}

.message-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 24rpx;
  gap: 20rpx;
}

.message-row.partner {
  align-items: flex-start;
}

.message-row.user {
  align-items: flex-end;
}

.bubble {
  max-width: 84%;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.partner-bubble {
  background: #FFFFFF;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.04);
}

.user-bubble {
  background: #B2EBF2;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 24rpx rgba(178, 235, 242, 0.4);
}

.ai-generated-label {
  font-size: 20rpx;
  color: #8DBB77;
  margin-bottom: 8rpx;
  display: block;
  line-height: 1;
}

.bubble-text {
  font-size: 28rpx;
  color: #1F2937;
}

.user-column {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: calc(84% + 100rpx);
}

.partner-column {
  align-items: flex-start;
}

.user-column .bubble {
  max-width: 100%;
}

.record-tag {
  display: inline-flex;
  align-items: center;
  background: rgba(254, 243, 199, 0.85);
  border-radius: 24rpx;
  padding: 8rpx 18rpx;
  margin-top: 12rpx;
}

.record-tag.pending {
  background: rgba(229, 231, 235, 0.85);
}

.record-tag-text {
  font-size: 22rpx;
  color: #6B7280;
}

.record-tag-icon {
  width: 22rpx;
  height: 22rpx;
  margin-left: 8rpx;
}

.loading-tip {
  text-align: center;
  font-size: 24rpx;
  color: #9CA3AF;
  padding: 20rpx 0;
}

/* 底部输入区 */
.input-area {
  position: fixed;
  left: 0;
  right: 0;
  /* native tabBar 页面 bottom:0 对齐 tabBar 顶部，16rpx 底部内边距使输入框与 tabBar 保持 8px 间距 */
  bottom: 0;
  padding: 12rpx 32rpx 16rpx;
  background: #F7FBF4;
  z-index: 10;
}

.input-bar {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 88rpx;
  padding: 8rpx 8rpx 8rpx 28rpx;
  box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.05);
}

.chat-input {
  flex: 1;
  height: 56rpx;
  font-size: 28rpx;
  color: #1A1A1A;
}

.send-btn-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #8DBB77;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.send-btn {
  width: 40rpx;
  height: 40rpx;
}

.voice-btn {
  width: 64rpx;
  height: 64rpx;
  margin-left: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.voice-btn.recording {
  background: #FEE2E2;
}

.voice-icon {
  font-size: 36rpx;
}

.voice-recording-tip {
  text-align: center;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #8DBB77;
}

/* 编辑弹窗 */
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  z-index: 1000;
}

.panel-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.edit-panel {
  position: fixed;
  top: 50%;
  left: 32rpx;
  right: 32rpx;
  max-height: 80vh;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 32rpx;
  transform: translateY(-50%) scale(0.95);
  transition: opacity 0.3s, transform 0.3s;
  z-index: 1001;
  overflow-y: auto;
  opacity: 0;
  pointer-events: none;
}

.edit-panel.show {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) scale(1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1F2937;
}

.panel-close {
  font-size: 36rpx;
  color: #9CA3AF;
  padding: 8rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #374151;
  margin-bottom: 12rpx;
}

.meal-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.meal-option {
  padding: 12rpx 24rpx;
  border-radius: 28rpx;
  background: #F3F4F6;
  font-size: 26rpx;
  color: #6B7280;
}

.meal-option.active {
  background: #BFE8B0;
  color: #1F2937;
}

.habit-type-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.habit-type-option {
  padding: 12rpx 24rpx;
  border-radius: 28rpx;
  background: #F3F4F6;
  font-size: 26rpx;
  color: #6B7280;
}

.habit-type-option.active {
  background: #BFE8B0;
  color: #1F2937;
}

.food-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.food-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16rpx;
  padding: 20rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
}

.food-name-input {
  width: 100%;
  background: #F3F4F6;
  border-radius: 12rpx;
  padding: 18rpx 16rpx;
  font-size: 30rpx;
  line-height: 1.5;
  color: #1F2937;
  min-height: 72rpx;
}

.food-calorie-text {
  font-size: 26rpx;
  color: #8DBB77;
  font-weight: 600;
  margin-top: -8rpx;
}

.food-meta-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.food-quantity-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  background: #F3F4F6;
  border-radius: 12rpx;
  padding: 0 16rpx;
  min-height: 72rpx;
}

.food-weight-input {
  flex: 1;
  min-width: 80rpx;
  background: transparent;
  padding: 18rpx 0;
  font-size: 28rpx;
  line-height: 1.5;
  text-align: left;
  color: #1F2937;
  min-height: 72rpx;
}

.food-unit {
  font-size: 26rpx;
  color: #6B7280;
  margin-left: 8rpx;
  flex-shrink: 0;
}

.food-remove {
  color: #9CA3AF;
  font-size: 34rpx;
  padding: 12rpx;
  flex-shrink: 0;
}

.body-input-row {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border: 2rpx solid #E5E7EB;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
  min-height: 96rpx;
}

.body-value-input {
  flex: 1;
  padding: 12rpx 0;
  font-size: 34rpx;
  line-height: 1.5;
  color: #1F2937;
  background: transparent;
  min-height: 60rpx;
}

.body-unit {
  font-size: 30rpx;
  color: #6B7280;
  margin-left: 16rpx;
  white-space: nowrap;
}

.exercise-row {
  display: flex;
  gap: 20rpx;
}

.exercise-field {
  flex: 1;
  background: #F3F4F6;
  border-radius: 12rpx;
  padding: 16rpx;
}

.exercise-field-label {
  display: block;
  font-size: 24rpx;
  color: #9CA3AF;
  margin-bottom: 8rpx;
}

.exercise-field-input {
  width: 100%;
  font-size: 28rpx;
  color: #1F2937;
  background: transparent;
  padding: 4rpx 0;
}

.exercise-field-unit {
  font-size: 24rpx;
  color: #6B7280;
}

.asset-type-text {
  font-size: 28rpx;
  color: #1F2937;
  font-weight: 500;
}

.asset-content-input {
  width: 100%;
  min-height: 120rpx;
  background: #F3F4F6;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  color: #1F2937;
  line-height: 1.6;
}

.panel-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.btn-cancel,
.btn-save {
  flex: 1;
  padding: 20rpx 0;
  border-radius: 999rpx;
  font-size: 28rpx;
  border: none;
  outline: none;
  box-shadow: none;
  line-height: 1.5;
}

.btn-cancel::after,
.btn-save::after {
  border: none;
}

.btn-cancel {
  background: #F3F4F6;
  color: #6B7280;
}

.btn-save {
  background: #8DBB77;
  color: #FFFFFF;
}

/* 食物选择器 */
.food-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
}

.food-picker-modal {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  top: 20vh;
  background: #FFFFFF;
  border-radius: 40rpx 40rpx 0 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s;
}

.food-picker-modal.show {
  transform: translateY(0);
}

.food-picker-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
}

.food-picker-back {
  font-size: 36rpx;
  color: #1F2937;
  width: 60rpx;
}

.food-picker-modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1F2937;
  text-align: center;
  flex: 1;
}

.food-picker-meal-label {
  font-size: 32rpx;
  font-weight: 600;
}

.food-picker-modal-search {
  display: flex;
  align-items: center;
  background: #F3F4F6;
  margin: 0 32rpx 20rpx;
  border-radius: 32rpx;
  padding: 16rpx 24rpx;
}

.food-picker-modal-search-input {
  flex: 1;
  margin-left: 12rpx;
  font-size: 28rpx;
  color: #1F2937;
  background: transparent;
}

.food-picker-modal-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.food-picker-modal-categories {
  width: 180rpx;
  height: 100%;
  background: #F7FAF5;
}

.food-picker-modal-category {
  padding: 28rpx 20rpx;
  font-size: 26rpx;
  color: #6B7280;
  text-align: center;
}

.food-picker-modal-category.active {
  background: #FFFFFF;
  color: #1F2937;
  font-weight: 600;
}

.food-picker-modal-foods {
  flex: 1;
  height: 100%;
  padding: 20rpx;
}

.food-picker-modal-food-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.food-picker-modal-food-item {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #F9FAFB;
  border-radius: 16rpx;
}

.food-picker-modal-food-image {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  background: #E8F4FC;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 28rpx;
  color: #1F2937;
}

.food-picker-modal-food-info {
  flex: 1;
}

.food-picker-modal-food-name {
  font-size: 28rpx;
  color: #1F2937;
  margin-bottom: 6rpx;
}

.food-picker-modal-food-calorie {
  font-size: 24rpx;
  color: #9CA3AF;
}

.calorie-num {
  color: #6B7280;
}

.food-picker-modal-add-icon {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #BFE8B0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1F2937;
  font-size: 32rpx;
}

.food-picker-modal-empty {
  text-align: center;
  padding: 80rpx 0;
  font-size: 26rpx;
  color: #9CA3AF;
}

/* 长按消息操作菜单 */
.msg-action-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.35);
}

.msg-action-menu {
  position: absolute;
  transform: translate(-50%, -120%);
  min-width: 180rpx;
  background: rgba(50, 50, 50, 0.95);
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.25);
}

.msg-action-item {
  padding: 24rpx 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.msg-action-text {
  font-size: 30rpx;
  color: #FFFFFF;
  line-height: 1;
}

.msg-action-divider {
  height: 1rpx;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 20rpx;
}
</style>