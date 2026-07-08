<template>
  <view class="app-input-wrap">
    <text v-if="label" class="input-label">{{ label }}</text>
    <view class="input-row">
      <input
        class="app-input"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        @input="onInput"
      />
      <text v-if="suffix" class="input-suffix">{{ suffix }}</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  suffix: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);

function onInput(e) {
  emit('update:modelValue', e.detail.value);
}
</script>

<style lang="scss" scoped>
.app-input-wrap {
  margin-bottom: $spacing-sm;
}

.input-label {
  display: block;
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
  font-weight: $font-medium;
}

.input-row {
  display: flex;
  align-items: center;
  background: $gray-50;
  border-radius: $radius-md;
  padding-right: $spacing-md;
}

.app-input {
  flex: 1;
  height: 88rpx;
  background: transparent;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  font-size: $text-base;
  color: $text-primary;
}

.input-suffix {
  font-size: $text-sm;
  color: $text-tertiary;
  margin-left: 8rpx;
  font-weight: $font-medium;
}

.app-input::placeholder {
  color: $text-tertiary;
}
</style>
