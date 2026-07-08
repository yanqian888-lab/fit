<template>
  <view class="app-tabs">
    <text
      v-for="tab in tabs"
      :key="tab.value"
      class="tab-item"
      :class="{ active: modelValue === tab.value }"
      @click="onSelect(tab.value)"
    >{{ tab.label }}</text>
  </view>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  tabs: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'change']);

function onSelect(value) {
  emit('update:modelValue', value);
  emit('change', value);
}
</script>

<style lang="scss" scoped>
.app-tabs {
  display: flex;
  background: $white;
  border-radius: $radius-pill;
  padding: 8rpx;
  box-shadow: $shadow-card;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: $text-base;
  color: $text-secondary;
  border-radius: $radius-pill;
  transition: all 0.2s ease;
}

.tab-item.active {
  background: $mint;
  color: $white;
  font-weight: $font-medium;
  box-shadow: $shadow-soft;
}
</style>
