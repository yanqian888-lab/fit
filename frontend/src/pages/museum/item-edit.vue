<template>
  <AppPage :showHeader="true" title="编辑">
  <view class="edit-page">
    <scroll-view class="content-scroll" scroll-y>
      <view class="content-wrapper">
        <view class="form-card">
          <view v-if="!isRecipe && !isInsight && !isMethod" class="form-item">
            <text class="input-label">类型</text>
            <picker mode="selector" :range="typeLabels" :value="typeIndex" @change="onTypeChange">
              <view class="picker">{{ typeLabels[typeIndex] }}</view>
            </picker>
          </view>
          <view v-if="!isRecipe" class="form-item">
            <text class="input-label">小标题（可选）</text>
            <input v-model="form.sub_type" placeholder="请输入标题" maxlength="20" />
          </view>
          <view v-if="!isRecipe" class="form-item">
            <text class="input-label">内容</text>
            <textarea v-model="form.content" placeholder="写下你想收藏的内容..." :auto-height="true" maxlength="1000" />
          </view>
          <view v-if="!isRecipe && !isInsight" class="form-item">
            <text class="input-label">配图（可选）</text>
            <view class="recipe-image-upload disabled">
              <image v-if="image" :src="image" mode="aspectFill" />
              <text v-else class="upload-hint">配图上传功能暂未开放</text>
            </view>
          </view>
          <template v-if="isRecipe">
            <view class="form-item">
              <text class="input-label">食谱标题</text>
              <input v-model="recipe.title" placeholder="如：10分钟快手减脂午餐" />
            </view>

            <view class="form-item">
              <text class="input-label">配图</text>
              <view class="recipe-image-upload disabled">
                <image v-if="recipe.image" :src="recipe.image" mode="aspectFill" />
                <text v-else class="upload-hint">配图上传功能暂未开放</text>
              </view>
            </view>

            <view class="form-item">
              <text class="input-label">食材</text>
              <view v-for="(item, idx) in recipe.ingredients" :key="idx" class="ingredient-row">
                <input v-model="item.name" class="ingredient-name" placeholder="食材名" />
                <input v-model="item.amount" class="ingredient-amount" placeholder="用量" />
                <text class="ingredient-remove" @click="removeIngredient(idx)">✕</text>
              </view>
              <text class="add-link" @click="addIngredient">+ 添加食材</text>
            </view>

            <view class="form-item">
              <text class="input-label">做法步骤</text>
              <textarea v-model="recipe.steps" placeholder="请输入做法步骤，换行分隔" :auto-height="true" maxlength="500" />
            </view>

            <view class="form-item">
              <text class="input-label">小贴士</text>
              <textarea v-model="recipe.tip" placeholder="可选" :auto-height="true" maxlength="500" />
            </view>
          </template>

          <view v-if="!isRecipe && !isMethod" class="form-item">
            <template v-if="isInsight">
              <text class="input-label">心情标签（最多选3个）</text>
              <view class="emotion-tags">
                <view
                  v-for="tag in moodTags"
                  :key="tag"
                  class="emotion-tag"
                  :class="{ active: selectedEmotions.includes(tag) }"
                  @click="toggleEmotion(tag)"
                >
                  <text>{{ tag }}</text>
                </view>
              </view>
              <text class="emotion-hint">已选 {{ selectedEmotions.length }}/3</text>
            </template>
            <template v-else>
              <text class="input-label">心情 / 标签（可选）</text>
              <input v-model="form.emotion" placeholder="如：开心、治愈" />
            </template>
          </view>
        </view>

        <view class="bottom-placeholder"></view>
      </view>
    </scroll-view>

    <view class="save-btn" @click="save">{{ saveBtnText }}</view>
  </view>
  </AppPage>
</template>

<script setup>
import AppPage from '../../components/AppPage.vue';
import { ref, computed, onMounted } from 'vue';
import { museumApi } from '../../api';

const types = [
  { label: '金句', value: 'quote' },
  { label: '食谱', value: 'recipe' },
  { label: '感悟', value: 'insight' },
  { label: '方法', value: 'method' },
  { label: '踩坑', value: 'pitfall' }
];

const form = ref({
  type: 'quote',
  sub_type: '',
  content: '',
  emotion: ''
});
const isEdit = ref(false);
const image = ref('');
const extractedData = ref({});
const itemId = ref(null);

// 感悟心情标签：覆盖日常情绪与状态
const moodTags = [
  '开心', '平静', '治愈', '满足', '感恩', '期待', '兴奋', '放松', '充实', '专注',
  '疲惫', '焦虑', '低落', '烦躁', '愧疚', '迷茫', '孤独', '压力大', '想放弃', '坚持住了',
  '刚运动完', '吃撑了', '没睡好', '元气满满', '佛系', '摆烂中', '自我怀疑', '被鼓励到',
  '豁然开朗', '小确幸', '安心', '无聊', '社交充电中', '独处回血', '电量不足'
];

const selectedEmotions = computed(() => {
  if (!form.value.emotion) return [];
  return form.value.emotion.split(/[,，]/).map(t => t.trim()).filter(Boolean);
});

function toggleEmotion(tag) {
  const set = new Set(selectedEmotions.value);
  if (set.has(tag)) {
    set.delete(tag);
  } else {
    if (set.size >= 3) {
      uni.showToast({ title: '最多选择3个心情标签', icon: 'none' });
      return;
    }
    set.add(tag);
  }
  form.value.emotion = Array.from(set).join('，');
}

// 食谱专用结构化字段
const recipe = ref({
  title: '',
  image: '',
  ingredients: [],
  steps: '',
  tip: ''
});

const typeLabels = types.map(t => t.label);
const typeIndex = computed(() => types.findIndex(t => t.value === form.value.type));
const isRecipe = computed(() => form.value.type === 'recipe');
const isInsight = computed(() => form.value.type === 'insight');
const isMethod = computed(() => form.value.type === 'method');
const typeLabelMap = {
  quote: '金句',
  recipe: '食谱',
  insight: '感悟',
  method: '方法',
  pitfall: '踩坑'
};

const headerTitle = computed(() => {
  const action = isEdit.value ? '编辑' : '新建';
  return `${action}${typeLabelMap[form.value.type] || '收藏'}`;
});

const saveBtnText = computed(() => {
  if (isEdit.value) return '保存修改';
  return `创建${typeLabelMap[form.value.type] || '收藏'}`;
});

onMounted(() => {
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  // 微信端参数在原生 page.options 上，$page?.options 仅作兜底
  const query = cur.options || cur.$page?.options || {};
  if (query.type) form.value.type = query.type;
  if (query.id) {
    isEdit.value = true;
    itemId.value = parseInt(query.id);
    loadItem();
  }
});

async function loadItem() {
  try {
    const res = await museumApi.getItem(itemId.value);
    const item = res.data;
    form.value.type = item.type;
    form.value.sub_type = item.sub_type || '';
    form.value.content = item.content || '';
    form.value.emotion = item.emotion || '';

    const data = item.extracted_data || {};
    extractedData.value = data;
    image.value = data.image || '';
    recipe.value = {
      title: item.title || data.title || item.sub_type || '',
      image: data.image || '',
      ingredients: Array.isArray(data.ingredients) ? data.ingredients.map(i => ({ name: i.name || '', amount: i.amount || '' })) : [],
      steps: data.steps || '',
      tip: data.tip || ''
    };
  } catch (err) {
    console.error(err);
  }
}

function onTypeChange(e) {
  form.value.type = types[parseInt(e.detail.value)].value;
}

/**
 * 博物馆对比记录：上传配图功能暂未开放（提审阶段相机/相册读取权限暂不声明）
 * 后续开放时恢复下面的 uni.chooseImage 调用（原 chooseImage 函数体保留在注释里）
 */
function chooseImage() {
  uni.showToast({ title: '配图上传功能暂未开放', icon: 'none' });
  /*
  uni.chooseImage({
    count: 1,
    success: (res) => {
      if (isRecipe.value) {
        recipe.value.image = res.tempFilePaths[0];
      } else {
        image.value = res.tempFilePaths[0];
      }
    }
  });
  */
}

function addIngredient() {
  recipe.value.ingredients.push({ name: '', amount: '' });
}

function removeIngredient(idx) {
  recipe.value.ingredients.splice(idx, 1);
}

async function save() {
  if (isRecipe.value) {
    if (!recipe.value.title.trim()) {
      uni.showToast({ title: '请输入食谱标题', icon: 'none' });
      return;
    }
  } else if (isInsight.value) {
    if (!form.value.sub_type.trim() && !form.value.content.trim()) {
      uni.showToast({ title: '请输入小标题或内容', icon: 'none' });
      return;
    }
  } else if (!form.value.content.trim()) {
    uni.showToast({ title: '请输入内容', icon: 'none' });
    return;
  }
  try {
    const payload = {
      type: form.value.type,
      sub_type: form.value.sub_type || null,
      content: form.value.content,
      emotion: form.value.emotion || null
    };

    if (isRecipe.value) {
      const validIngredients = recipe.value.ingredients.filter(i => i.name.trim());
      payload.sub_type = recipe.value.title || '健康食谱';
      payload.content = recipe.value.steps || recipe.value.title;
      payload.emotion = null;
      payload.extracted_data = {
        title: payload.sub_type,
        image: recipe.value.image || '',
        content: payload.content,
        ingredients: validIngredients,
        steps: recipe.value.steps || '',
        tip: recipe.value.tip || ''
      };
    } else if (!isInsight.value) {
      payload.extracted_data = {
        ...extractedData.value,
        image: image.value || ''
      };
    }

    if (isEdit.value) {
      await museumApi.updateItem(itemId.value, payload);
    } else {
      await museumApi.addItem(payload);
    }
    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
      } else {
        uni.switchTab({ url: '/pages/museum/index' });
      }
    }, 800);
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.edit-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #F7FbF4;
}
.content-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.content-wrapper {
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

.form-card {
  background: $bg-card;
  border-radius: 32rpx;
  padding: $spacing-md;
  margin: 48rpx 48rpx 0;
  box-shadow: $shadow-card;
}

.form-item {
  margin-bottom: $spacing-md;

  &:last-child {
    margin-bottom: 0;
  }
}

.input-label {
  display: block;
  font-size: $text-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
  font-weight: $font-medium;
}

.picker {
  height: 88rpx;
  line-height: 88rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  font-size: $text-base;
  color: $text-primary;
}

.form-item input,
.form-item textarea {
  width: 100%;
  background: $gray-50;
  border-radius: $radius-md;
  padding: $spacing-md;
  font-size: $text-base;
  color: $text-primary;
  box-sizing: border-box;
}

.form-item input {
  height: 88rpx;
  padding: 0 $spacing-md;
}

.form-item textarea {
  min-height: 200rpx;
  height: auto;
}

.ingredient-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.ingredient-name {
  flex: 2;
  height: 72rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: 0 $spacing-sm;
  font-size: $text-base;
}

.ingredient-amount {
  flex: 1;
  height: 72rpx;
  background: $gray-50;
  border-radius: $radius-md;
  padding: 0 $spacing-sm;
  font-size: $text-base;
}

.ingredient-remove {
  width: 48rpx;
  text-align: center;
  color: #E57373;
  font-size: 28rpx;
}

.add-link {
  font-size: $text-sm;
  color: $mint-dark;
  margin-top: $spacing-xs;
}

.recipe-image-upload {
  width: 100%;
  height: 360rpx;
  border-radius: $radius-xl;
  background: $gray-50;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  image {
    width: 100%;
    height: 100%;
  }

  &.disabled {
    // 提审阶段：图片上传功能禁用（灰化 + 降低透明度 + 默认鼠标指针，不引导点击）
    pointer-events: none;
    opacity: 0.55;
    filter: grayscale(0.7);
  }
}

.upload-hint {
  font-size: $text-base;
  color: $text-tertiary;
}

.emotion-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.emotion-tag {
  padding: 12rpx 24rpx;
  border-radius: 32rpx;
  background: $gray-100;
  font-size: $text-sm;
  color: $text-secondary;
  transition: all 0.2s ease;

  &.active {
    background: #D4EDDA;
    color: #2E7D32;
  }
}

.emotion-hint {
  font-size: $text-xs;
  color: $text-tertiary;
  margin-top: $spacing-xs;
  display: block;
}

.bottom-placeholder {
  height: 40rpx;
}

.save-btn {
  position: fixed;
  left: 48rpx;
  right: 48rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFE585;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: #27282D;
  z-index: 100;
}
</style>