<template>
  <view class="blank-page"></view>
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app';

/**
 * 小程序 switchTab 基础库 bug 的桥接页：
 * - main.js patch 中当 switchTab 命中基础库 bug 时，直接 redirectTo 本页并带 ?tabTarget=xxx
 * - 本页 onLoad 中立即 switchTab 到目标 tab（避免整页重启导致 1s 白屏）
 * - 【最后一道防线，切断死循环】：本页 switchTab 再失败，**直接 reLaunch 一次性兜底**，
 *   不再走 patch 的 redirectTo blank 链（否则会在 blank 自己身上反复 redirectTo 卡死）
 * - 无参数时作为用户拒绝隐私政策/调试占位空白页使用，不做任何跳转
 */
onLoad((query) => {
  if (query && query.tabTarget) {
    const target = decodeURIComponent(query.tabTarget);
    const tabUrl = '/' + target;
    uni.switchTab({
      url: tabUrl,
      fail(err) {
        // 最后兜底：桥接后仍命中基础库 bug → 直接 reLaunch，彻底切断任何死循环可能
        console.warn('[blank桥接] switchTab 再次失败，兜底 reLaunch:', err?.errMsg || err);
        uni.reLaunch({ url: tabUrl });
      }
    });
  }
});
</script>

<style lang="scss" scoped>
.blank-page {
  height: 100vh;
  background: #F7FbF4;
}
</style>
