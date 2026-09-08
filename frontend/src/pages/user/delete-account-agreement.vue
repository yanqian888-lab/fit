<template>
  <AppPage fixed :showHeader="true" title="注销协议">
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

    <!-- 注销二次确认弹框 -->
    <AppModal
      v-model:visible="showConfirmModal"
      icon="none"
      title="二次确认"
      text="注销后所有数据将无法恢复，绑定的手机号可重新注册新账号。确定要注销吗？"
      confirmText="确定注销"
      confirmDanger
      cancelText="取消"
      @confirm="confirmDeleteAccount"
    />
  </AppPage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppPage from '../../components/AppPage.vue';
import AppModal from '../../components/AppModal.vue';
import { userApi, configApi } from '../../api';
import { useUserStore } from '../../store';
import popupManager from '../../utils/popupManager';

const userStore = useUserStore();
const loading = ref(false);

// 注销二次确认弹框状态
const showConfirmModal = ref(false);

// 默认文案（后台协议配置未配置注销协议时使用，与后端 policies.js 保持一致）
const defaultAgreementText = `《掉秤搭搭账号注销协议》

尊敬的用户：

在您申请注销掉秤搭搭（以下简称“本应用”）账号之前，请仔细阅读并充分理解本协议的全部内容。本协议由您与北京绵言科技发展中心（个体工商户）（以下简称“我们”）共同缔结，是您行使账号注销权利的重要依据。请您在确认已充分知晓注销后果后再进行操作；一旦您点击“我已阅读并同意注销”并完成二次确认，即视为您已充分阅读、理解并接受本协议全部条款。

一、账号注销的定义
账号注销是您主动终止本应用向您提供的全部服务的操作。注销完成后，您的账号将被永久删除，您将无法再以该账号登录本应用，账号下的全部数据将无法找回、无法恢复。

二、注销路径与流程
1. 注销入口：打开本应用，进入“我的”页面，点击“注销账号”进入本协议页面。
2. 阅读协议：请完整阅读本注销协议，阅读后点击“我已阅读并同意注销”。
3. 二次确认：系统将弹出确认窗口，再次提示注销后果，您点击“确定注销”后注销立即生效。
4. 为防止误操作，注销前请您务必确认已备份需要保留的信息；注销操作不设冷静期，确认后即时完成且不可撤销。

三、注销条件
为保障账号安全及您的合法权益，您申请注销的账号需同时满足以下条件：
1. 该账号为您本人注册并使用，账号处于正常状态，不存在被盗、被封禁、被限制使用等异常情形；
2. 该账号不存在未完成的交易、未处理完毕的投诉、举报或纠纷，不存在可能影响您或第三方合法权益的事项；
3. 您已自行备份您认为需要保留的全部数据和信息。

四、注销后的数据处理
1. 账号注销完成后，我们将对您的个人信息进行删除或匿名化处理，使其不再能够识别或关联到您本人，包括但不限于：
（1）您的账号信息（账号 ID、用户名、头像、绑定的手机号、微信 openid 等注册与登录标识）；
（2）您的减脂记录：饮食记录、运动记录、体重与围度数据、饮水记录、习惯打卡、心情日记等；
（3）您的个人资产：博物馆内容（金句、感悟、食谱、方法、踩坑、照片等）、里程碑、成就徽章、收藏内容、宠物小窝数据等；
（4）您与 AI 搭子的聊天记录、搭子设置及其他个性化配置；
（5）您上传的头像、反馈配图等文件。
2. 您与微信之间的授权登录关系将随注销同步解除。
3. 您绑定的手机号将在注销完成后释放，您可使用该手机号重新注册新账号；新账号与原账号完全独立，不继承任何历史数据、权益或记录。
4. 为履行法律法规规定的审计、争议解决与安全防范义务，我们会将注销时间及账号关键标识（用户名、手机号、openid）以注销审计记录的形式留存；该记录仅用于合规审计与纠纷核查，不用于任何业务或营销目的，除法律法规另有规定外不向任何第三方提供。
5. 根据《中华人民共和国网络安全法》等法律法规要求，我们可能需在法定期限内保留网络日志等必要信息，该等信息将严格依法保密，超出法定期限后删除或匿名化。

五、注销后的影响
1. 注销完成后，您将无法使用原账号登录本应用，原账号下的所有数据、设置、权益、虚拟财产（如有）将同时失效且无法恢复；
2. 注销不影响您在注销前已依法享有的合法权益，也不免除您依法应承担的责任；
3. 注销完成后，我们不再为您提供与原账号相关的任何服务或支持。

六、其他
1. 如您对本协议或账号注销流程有任何疑问、意见或投诉，可通过应用内“我的 → 意见反馈”功能联系我们，或发送邮件至 support@mianyan.xin；
2. 本协议的成立、生效、履行、解释及争议解决均适用中华人民共和国法律；
3. 本协议未尽事宜，参照《掉秤搭搭用户协议》及《隐私政策》执行；本协议与上述协议就注销事项约定不一致的，以本协议为准。

请您再次确认：账号注销为即时生效、不可恢复的操作，注销后全部数据将被永久删除，绑定的手机号可用于注册新账号，新账号与原账号完全独立。

生效日期：2026 年 9 月 6 日`;

// 后台协议配置可覆盖默认文案
const agreementText = ref(defaultAgreementText);
onMounted(async () => {
  try {
    const res = await configApi.getAppConfig();
    const custom = res.data?.delete_account_agreement;
    if (custom && String(custom).trim()) {
      agreementText.value = custom;
    }
  } catch (e) {}
});

const paragraphs = computed(() => {
  return agreementText.value
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
});

function onAgree() {
  showConfirmModal.value = true;
}

/**
 * 确认执行账号注销
 */
async function confirmDeleteAccount() {
  showConfirmModal.value = false;
  await doDeleteAccount();
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
      // 注销后回到首页 tab，以游客身份浏览
      uni.reLaunch({ url: '/pages/index/index' });
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
