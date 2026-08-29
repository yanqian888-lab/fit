<template>
  <AppPage :showHeader="true" title="关于我们">
    <view class="about-page">
      <view class="about-card">
        <block v-if="aboutContent">
          <text v-for="(paragraph, index) in paragraphs" :key="index" class="about-text">{{ paragraph }}</text>
        </block>
        <text v-else class="about-text">暂无内容</text>
      </view>

      <!-- 隐藏环境切换触发区：长按 5 秒弹出环境切换 -->
      <view
        class="env-switch-trigger"
        @touchstart="handleEnvTouchStart"
        @touchend="handleEnvTouchEnd"
        @touchcancel="handleEnvTouchEnd"
      ></view>
    </view>

    <!-- 环境切换完成提示弹框（单按钮） -->
    <AppModal
      v-model:visible="showEnvSwitchModal"
      icon="none"
      title="环境已切换"
      :text="envSwitchText"
      confirmText="立即重启"
      :showCancel="false"
      @confirm="confirmRestart"
    />
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppModal from '../../components/AppModal.vue';
import { get } from '../../utils/request';
import { getCurrentEnv, setCurrentEnv, getEnvLabel } from '../../utils/environment.js';

const aboutContent = ref('');
const longPressTimer = ref(null);

// 环境切换完成提示
const showEnvSwitchModal = ref(false);
const envSwitchText = ref('');

const paragraphs = computed(() => {
  return aboutContent.value.split(/\n+/).filter(p => p.trim());
});

onMounted(async () => {
  try {
    const res = await get('/app-config');
    aboutContent.value = res.data?.about_us_content || '';
  } catch (e) {
    console.error('获取关于我们配置失败', e);
  }
});

function handleEnvTouchStart() {
  clearEnvTimer();
  longPressTimer.value = setTimeout(() => {
    showEnvSwitchDialog();
  }, 5000);
}

function handleEnvTouchEnd() {
  clearEnvTimer();
}

function clearEnvTimer() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

function showEnvSwitchDialog() {
  const currentEnv = getCurrentEnv();
  const envList = ['test', 'production'];
  const itemList = envList.map(env => {
    const label = getEnvLabel(env);
    return env === currentEnv ? `${label}（当前）` : `切换到${label}`;
  });

  uni.showActionSheet({
    title: '切换后端环境',
    itemList,
    success: (res) => {
      const selectedEnv = envList[res.tapIndex];
      if (selectedEnv && selectedEnv !== currentEnv) {
        setCurrentEnv(selectedEnv);
        envSwitchText.value = `已切换至 ${getEnvLabel(selectedEnv)}，需要重启应用以生效。`;
        showEnvSwitchModal.value = true;
      }
    }
  });
}

/**
 * 确认重启应用
 */
function confirmRestart() {
  showEnvSwitchModal.value = false;
  uni.reLaunch({ url: '/pages/index/index' });
}
</script>

<style lang="scss" scoped>
.about-page {
  position: relative;
  z-index: 1;
  padding-top: $spacing-md;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.about-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}

.about-text {
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.8;
  display: block;
  margin-bottom: $spacing-md;
}

.about-text:last-child {
  margin-bottom: 0;
}

.env-switch-trigger {
  width: 300px;
  height: 300px;
  align-self: center;
  margin-bottom: 32rpx;
  background: transparent;
}
</style>
