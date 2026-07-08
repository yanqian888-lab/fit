<template>
  <AppPage fixed>
    <view class="page-bg"></view>
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
    <view class="page-header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="page-title">注销协议</text>
      <view class="header-right"></view>
    </view>
    <scroll-view class="content-scroll" scroll-y>
      <view class="content-wrapper">
        <view class="content-card">
          <text v-for="(paragraph, index) in paragraphs" :key="index" class="paragraph">
            {{ paragraph }}
          </text>
        </view>
      </view>
    </scroll-view>
    <view class="bottom-actions">
      <button class="agree-btn" :loading="loading" @click="onAgree">我已阅读并同意注销</button>
    </view>
  </AppPage>
</template>

<script setup>
import { ref, computed } from 'vue';
import AppPage from '../../components/AppPage.vue';
import { userApi } from '../../api';
import { useUserStore } from '../../store';
import popupManager from '../../utils/popupManager';
import { goBack } from '../../utils/navigate';

const userStore = useUserStore();
const loading = ref(false);

const statusBarHeight = ref(44);
try {
  statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 44;
} catch (e) {}

const agreementText = `注销账号协议

尊敬的用户：

在您申请注销减肥搭子 APP（以下简称“本应用”）账号之前，请仔细阅读并充分理解本协议的全部内容。本协议构成您与本应用运营方之间关于账号注销的具有法律约束力的协议。一旦您点击“同意并注销”，即视为您已充分阅读、理解并接受本协议所有条款。

一、账号注销的定义
账号注销是指您主动终止本应用向您提供的全部服务，并永久删除您在本应用中的账号及与该账号相关的全部数据。注销完成后，您将无法再以该账号登录本应用，也无法恢复任何历史数据。

二、注销前的提示
1. 账号注销是不可逆操作。注销完成后，您的账号信息、个人资料、减肥记录、饮食记录、运动记录、体重数据、聊天记录、搭子设置、博物馆内容（包括金句、感悟、食谱、方法、踩坑、照片等）、里程碑、收藏内容、习惯打卡记录及其他全部数据将被永久删除或匿名化处理，无法恢复。
2. 您在本应用中产生的所有历史数据、成就、连续打卡记录等将不再保留，请谨慎操作。
3. 注销账号不会影响您已依法享有的合法权益，也不会免除您依法应承担的责任。

三、注销条件
为保障账号安全及您的合法权益，您申请注销的账号需同时满足以下条件：
1. 该账号为您本人注册并使用，账号处于正常状态，不存在被盗、被封禁、被限制使用等异常情形。
2. 该账号内不存在未完成的交易、未处理的纠纷或其他可能影响您或第三方权益的事项。
3. 您已自行备份您认为需要保留的数据和信息。

四、数据处理方式
1. 账号注销后，我们将依据法律法规及本协议约定，对您的个人信息进行删除或匿名化处理，使其不再能够识别或关联到您本人。
2. 您的账号（包括账号 ID、用户名）、绑定的手机号、微信 openid 等关键标识将从本应用的用户数据库中移除。
3. 绑定的手机号将在注销完成后被释放，您可以使用该手机号重新注册一个新的账号。新账号与本账号相互独立，不继承任何历史数据、权益或记录。
4. 根据相关法律法规规定，我们可能需要在一定期限内保留部分必要信息（如日志信息），但仅用于履行法律义务、解决争议或防止欺诈，不会用于其他目的。

五、注销后的影响
1. 您将无法使用原账号登录本应用，原账号下的所有数据、设置、权益、虚拟财产（如有）将同时失效。
2. 使用原账号绑定的手机号重新注册的新账号，将视为全新的独立账号，拥有新的用户 ID，不包含原账号的任何历史信息。
3. 注销完成后，本应用不再为您提供与原账号相关的任何服务或支持。

六、其他
1. 如您对本协议或账号注销流程有任何疑问，可通过“意见反馈”功能与我们联系。
2. 本协议的成立、生效、履行、解释及争议解决均适用中华人民共和国法律。
3. 本协议未尽事宜，参照《用户协议》及《隐私政策》执行。

请您再次确认：注销账号后，所有数据将无法恢复，绑定的手机号可用于注册新账号，新账号与原账号完全独立。`;

const paragraphs = computed(() => {
  return agreementText
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
});

function onAgree() {
  uni.showModal({
    title: '二次确认',
    content: '注销后所有数据将无法恢复，绑定的手机号可重新注册新账号。确定要注销吗？',
    confirmColor: '#E57373',
    confirmText: '确定注销',
    success: async (res) => {
      if (!res.confirm) return;
      await doDeleteAccount();
    }
  });
}

async function doDeleteAccount() {
  if (loading.value) return;
  loading.value = true;
  try {
    await userApi.deleteAccount();
    uni.showToast({ title: '账号已注销', icon: 'success' });
    userStore.logout();
    popupManager.clearCache();
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/index' });
    }, 1000);
  } catch (err) {
    console.error('注销账号失败:', err);
    uni.showToast({ title: err.message || '注销失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #DDF2D2 0%, #F7FbF4 360rpx, #F7FbF4 100%);
  z-index: 0;
}

.status-bar {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.page-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 32rpx 24rpx;
  flex-shrink: 0;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 48rpx;
  color: #27282D;
  font-weight: 700;
  line-height: 1;
  margin-left: -4rpx;
}

.page-title {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  font-weight: 700;
  color: #27282D;
  line-height: 40rpx;
}

.content-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  padding: $spacing-md $spacing-md calc(220rpx + env(safe-area-inset-bottom));
}

.content-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-lg;
  box-shadow: $shadow-card;
}

.paragraph {
  display: block;
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.8;
  margin-bottom: $spacing-md;
}

.paragraph:last-child {
  margin-bottom: 0;
}

.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  padding: $spacing-md calc(32rpx + env(safe-area-inset-bottom));
  padding-bottom: calc($spacing-md + env(safe-area-inset-bottom));
  background: rgba($bg-page, 0.95);
  backdrop-filter: blur(8rpx);
}

.agree-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background: #E57373;
  color: $white;
  font-size: $text-lg;
  font-weight: $font-semibold;
  border-radius: $radius-lg;
  border: none;
}

.agree-btn::after {
  border: none;
}
</style>
