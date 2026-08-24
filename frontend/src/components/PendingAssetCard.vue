<template>
  <view class="pending-asset-card">
    <AppTabs
      v-if="tabs.length > 1"
      v-model="activeId"
      :tabs="tabs"
      class="asset-tabs"
    />
    <view class="asset-body">
      <!-- 预览模式 -->
      <template v-if="!isEditing">
        <text class="asset-type-tag">{{ typeLabel }}</text>
        <text class="asset-title">{{ currentAsset.sub_type || '未命名' }}</text>
        <text class="asset-content">{{ currentAsset.content }}</text>

        <!-- 食谱扩展信息 -->
        <template v-if="currentAsset.type === 'recipe'">
          <view v-if="currentExtracted.ingredients?.length" class="section">
            <text class="section-title">食材</text>
            <text
              v-for="(ing, idx) in currentExtracted.ingredients"
              :key="'ing-' + idx"
              class="section-item"
            >{{ typeof ing === 'string' ? ing : ing.name }}</text>
          </view>
          <view v-if="currentExtracted.steps" class="section">
            <text class="section-title">步骤</text>
            <text class="section-text">{{ currentExtracted.steps }}</text>
          </view>
          <view v-if="currentExtracted.tip" class="section">
            <text class="section-title">小贴士</text>
            <text class="section-text">{{ currentExtracted.tip }}</text>
          </view>
        </template>

        <view class="actions">
          <text class="btn btn-edit" @click="startEdit">编辑</text>
          <text class="btn btn-discard" @click="onDiscard">舍弃</text>
          <text class="btn btn-save" @click="onSave">保存</text>
        </view>
      </template>

      <!-- 编辑模式 -->
      <template v-else>
        <view class="edit-form">
          <text class="edit-label">标题</text>
          <input v-model="editForm.sub_type" class="edit-input" placeholder="请输入标题" />

          <text class="edit-label">内容</text>
          <textarea
            v-model="editForm.content"
            class="edit-textarea"
            placeholder="请输入内容"
            :maxlength="2000"
          />

          <template v-if="currentAsset.type === 'recipe'">
            <text class="edit-label">食材（每行一个）</text>
            <textarea
              v-model="editForm.ingredientsText"
              class="edit-textarea"
              placeholder="例如：鸡胸肉 200g"
              :maxlength="1000"
            />

            <text class="edit-label">步骤</text>
            <textarea
              v-model="editForm.steps"
              class="edit-textarea"
              placeholder="请输入制作步骤"
              :maxlength="2000"
            />

            <text class="edit-label">小贴士</text>
            <input v-model="editForm.tip" class="edit-input" placeholder="可选" />
          </template>

          <view class="actions">
            <text class="btn btn-discard" @click="cancelEdit">取消</text>
            <text class="btn btn-save" @click="confirmEdit">确认修改</text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { museumApi } from '@/api/index';
import AppTabs from './AppTabs.vue';

const props = defineProps({
  assets: { type: Array, default: () => [] }
});
const emit = defineEmits(['save', 'discard', 'change']);

const typeLabels = {
  recipe: '食谱',
  method: '方法',
  insight: '感悟',
  quote: '金句',
  pitfall: '踩坑'
};

const activeId = ref('');
const isEditing = ref(false);
const editForm = ref({});

const tabs = computed(() => {
  return props.assets.map(a => ({
    label: a.sub_type || typeLabels[a.type] || '待确认',
    value: String(a.id)
  }));
});

const currentAsset = computed(() => {
  return props.assets.find(a => String(a.id) === activeId.value) || props.assets[0] || {};
});

const currentExtracted = computed(() => {
  return currentAsset.value.extracted_data || {};
});

const typeLabel = computed(() => typeLabels[currentAsset.value.type] || '待确认');

watch(
  () => props.assets,
  (list) => {
    if (list.length && !list.find(a => String(a.id) === activeId.value)) {
      activeId.value = String(list[0].id);
      isEditing.value = false;
    }
  },
  { immediate: true, deep: true }
);

function startEdit() {
  const asset = currentAsset.value;
  const ext = asset.extracted_data || {};
  const ingredients = Array.isArray(ext.ingredients)
    ? ext.ingredients.map(i => (typeof i === 'string' ? i : i.name)).join('\n')
    : '';
  editForm.value = {
    sub_type: asset.sub_type || '',
    content: asset.content || '',
    ingredientsText: ingredients,
    steps: ext.steps || '',
    tip: ext.tip || ''
  };
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
}

function buildModifiedData() {
  const data = {
    sub_type: editForm.value.sub_type,
    content: editForm.value.content
  };
  if (currentAsset.value.type === 'recipe') {
    const ingredients = editForm.value.ingredientsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    data.ingredients = ingredients;
    data.steps = editForm.value.steps;
    data.tip = editForm.value.tip;
  }
  return data;
}

async function confirmEdit() {
  try {
    const modified = buildModifiedData();
    await museumApi.confirmItem(currentAsset.value.id, { modified_data: modified });
    uni.showToast({ title: '已保存', icon: 'success' });
    isEditing.value = false;
    emit('save', currentAsset.value.id);
  } catch (e) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' });
  }
}

async function onSave() {
  try {
    await museumApi.confirmItem(currentAsset.value.id, {});
    uni.showToast({ title: '已保存', icon: 'success' });
    emit('save', currentAsset.value.id);
  } catch (e) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' });
  }
}

async function onDiscard() {
  try {
    await museumApi.discardItem(currentAsset.value.id);
    uni.showToast({ title: '已舍弃', icon: 'none' });
    emit('discard', currentAsset.value.id);
  } catch (e) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.pending-asset-card {
  margin-top: 16rpx;
  width: 100%;
  box-sizing: border-box;
  background: $white;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.asset-tabs {
  margin: 16rpx;
}

.asset-body {
  padding: 24rpx;
}

.asset-type-tag {
  display: inline-block;
  font-size: $text-xs;
  color: $mint;
  background: rgba($mint, 0.1);
  padding: 4rpx 16rpx;
  border-radius: $radius-pill;
  margin-bottom: 16rpx;
}

.asset-title {
  display: block;
  font-size: $text-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  margin-bottom: 12rpx;
  line-height: 1.4;
}

.asset-content {
  display: block;
  font-size: $text-base;
  color: $text-secondary;
  line-height: 1.6;
  margin-bottom: 16rpx;
}

.section {
  margin-bottom: 16rpx;
}

.section-title {
  display: block;
  font-size: $text-sm;
  font-weight: $font-medium;
  color: $text-primary;
  margin-bottom: 8rpx;
}

.section-item,
.section-text {
  display: block;
  font-size: $text-sm;
  color: $text-secondary;
  line-height: 1.5;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 20rpx;
}

.btn {
  padding: 12rpx 28rpx;
  border-radius: $radius-pill;
  font-size: $text-sm;
  font-weight: $font-medium;
}

.btn-edit {
  color: $text-secondary;
  background: $gray-100;
}

.btn-discard {
  color: $danger;
  background: $danger-bg;
}

.btn-save {
  color: $white;
  background: $mint;
}

.edit-form {
  display: flex;
  flex-direction: column;
}

.edit-label {
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: 8rpx;
  margin-top: 16rpx;
}

.edit-input,
.edit-textarea {
  background: $gray-50;
  border-radius: $radius-md;
  padding: 16rpx;
  font-size: $text-base;
  color: $text-primary;
}

.edit-input {
  min-height: 80rpx;
  line-height: 1.5;
}

.edit-textarea {
  min-height: 120rpx;
}
</style>
