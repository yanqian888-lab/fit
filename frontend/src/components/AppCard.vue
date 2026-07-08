<template>
  <view class="app-card" :class="{ flat: variant === 'flat' }">
    <slot></slot>
  </view>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'default' }
});
</script>

<style lang="scss" scoped>
.app-card {
  background: $bg-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  box-shadow: $shadow-card;
}

.app-card.flat {
  box-shadow: none;
  background: transparent;
}
</style>
