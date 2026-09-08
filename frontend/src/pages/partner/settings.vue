<template>
  <AppPage :showHeader="true" title="搭子设置">
    <view class="partner-settings">
      <view class="partner-card">
        <image class="partner-avatar" :src="partnerAvatarUrl" mode="aspectFill" />
        <view class="partner-info">
          <view class="name-edit-row">
            <!-- 搭子名字固定为「搭搭」，不提供修改入口 -->
            <text class="partner-name-text">搭搭</text>
          </view>
          <text class="partner-mode">当前模式：{{ modeLabel }}</text>
        </view>
      </view>

      <view class="mode-card">
        <text class="card-title">切换搭子模式</text>
        <view class="mode-list">
          <view
            v-for="mode in modes"
            :key="mode.value"
            class="mode-item"
            :class="{ active: currentMode === mode.value }"
            @click="selectMode(mode.value)"
          >
            <image class="mode-icon" :src="mode.avatar" mode="aspectFill" />
            <view class="mode-text">
              <text class="mode-name">{{ mode.label }}</text>
              <text class="mode-desc">{{ mode.desc }}</text>
            </view>
            <text v-if="currentMode === mode.value" class="check">✓</text>
          </view>
        </view>
      </view>


    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { partnerApi } from '../../api';
import { request } from '../../utils/request';
import AppPage from '../../components/AppPage.vue';
import { resolveStaticUrl } from '../../utils/environment.js';

const partner = ref({});
const currentMode = ref('gentle');

/** storage 缓存 key（快速兜底，让页面毫秒级打开） */
const PARTNER_CACHE_KEY = 'partner_settings_cache';

/** 模式头像：改为远程 CDN 加载以减小小程序包体积 */
const modeAvatarMap = {
  gentle: resolveStaticUrl('/static/image/icon/rou.png'),
  strict: resolveStaticUrl('/static/image/icon/zhuan.png'),
  tease: resolveStaticUrl('/static/image/icon/sun.png')
};
const defaultModeAvatar = resolveStaticUrl('/static/image/icon/rou.png');

const modes = [
  { value: 'gentle', label: '温柔模式', icon: '🌸', avatar: modeAvatarMap.gentle, desc: '像朋友一样鼓励你，适合需要陪伴感' },
  { value: 'strict', label: '严格模式', icon: '💪', avatar: modeAvatarMap.strict, desc: '目标导向，监督打卡不手软' },
  { value: 'tease', label: '毒舌模式', icon: '😏', avatar: modeAvatarMap.tease, desc: '直接犀利不留情面，扎心但有效' }
];

const partnerAvatarUrl = computed(() => {
  return modeAvatarMap[currentMode.value] || defaultModeAvatar;
});

const modeLabel = computed(() => {
  const m = modes.find(item => item.value === currentMode.value);
  return m ? m.label : currentMode.value;
});

onMounted(async () => {
  /*
   * 秒开策略：
   * 1. 先读本地 storage 缓存（毫秒级），页面先渲染缓存数据
   * 2. 再异步请求网络（关闭全局 loading 遮罩，不挡用户）
   * 3. 网络返回后覆盖 ref，写回缓存
   */
  try {
    const cached = uni.getStorageSync(PARTNER_CACHE_KEY);
    if (cached && typeof cached === 'object') {
      partner.value = cached;
      if (cached.mode) currentMode.value = cached.mode;
    }
  } catch (_) {}

  try {
    // 用 request 绕过 partnerApi.getPartner（后者不支持透传 loading:false）
    // 不传 loading 选项 → 默认 true，但我们把 loadingMask 关掉，避免遮罩挡整页
    const res = await request({
      url: '/partners',
      method: 'GET',
      loading: false,
      loadingMask: false
    });
    const data = res.data || {};
    partner.value = data;
    if (data.mode) currentMode.value = data.mode;
    try { uni.setStorageSync(PARTNER_CACHE_KEY, data); } catch (_) {}
  } catch (err) {
    console.error('[partner/settings] getPartner 失败:', err?.message || err);
  }
});

/**
 * 切换搭子模式
 * 主动操作，保留轻量 loading 提示
 */
async function selectMode(mode) {
  if (mode === currentMode.value) return;
  try {
    const res = await request({
      url: '/partners/switch-mode',
      method: 'POST',
      data: { mode },
      loading: '切换中...',
      loadingMask: false
    });
    currentMode.value = mode;
    try {
      const cached = uni.getStorageSync(PARTNER_CACHE_KEY) || {};
      cached.mode = mode;
      uni.setStorageSync(PARTNER_CACHE_KEY, cached);
    } catch (_) {}
    uni.showToast({ title: '切换成功', icon: 'success' });
  } catch (err) {
    uni.showToast({ title: '切换失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.partner-settings {
  position: relative;
  z-index: 1;
  padding-top: $spacing-md;
}
.partner-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  display: flex;
  align-items: center;
  margin: 0 $spacing-md $spacing-md;
  box-shadow: $shadow-card;
  color: $text-primary;
}

.partner-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: $spacing-md;
  background: $mint-light;
}

.name-edit-row {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.partner-name-text {
  font-size: $text-xl;
  font-weight: $font-bold;
  color: $text-primary;
}

.partner-mode {
  font-size: $text-sm;
  color: $text-secondary;
  font-weight: $font-light;
}

.mode-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin: 0 $spacing-md $spacing-md;
  box-shadow: $shadow-card;
}

.card-title {
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-md;
}

.mode-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.mode-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-radius: $radius-lg;
  background: $gray-50;
  border: 2rpx solid transparent;
}

.mode-item.active {
  background: $mint-light;
  border-color: $mint;
}

.mode-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: $gray-100;
  margin-right: $spacing-md;
  flex-shrink: 0;
}

.mode-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mode-name {
  font-size: $text-base;
  font-weight: $font-semibold;
  color: $text-primary;
  margin-bottom: 6rpx;
}

.mode-desc {
  font-size: $text-xs;
  color: $text-secondary;
}

.check {
  color: $mint-dark;
  font-size: $text-lg;
  font-weight: $font-bold;
}


</style>
