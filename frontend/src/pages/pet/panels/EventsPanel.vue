<template>
  <view class="overlay-mask">
    <view class="overlay-backdrop" @click="$emit('close')"></view>
    <view class="overlay-panel">
      <view class="overlay-header">
        <text class="overlay-title">事件相册</text>
        <view class="overlay-close" @click="$emit('close')">✕</view>
      </view>

      <!-- 集合 tab -->
      <view class="collection-tabs" v-if="collections.length > 0">
        <view
          v-for="col in collections"
          :key="col.key"
          class="tab-item"
          :class="{ active: activeKey === col.key }"
          @click="activeKey = col.key"
        >
          <text>{{ col.name }}</text>
        </view>
      </view>

      <!-- 解锁进度 -->
      <text class="progress-tip" v-if="activeCollection">已解锁 {{ activeCollection.unlocked_count }}/{{ activeCollection.total }}</text>

      <scroll-view class="overlay-scroll" scroll-y>
        <view v-if="!activeCollection || activeCollection.slots.length === 0" class="empty-state">
          <image class="empty-img" src="/static/image/icon/quesheng01.png" mode="aspectFit" />
          <text class="empty-text">{{ activeCollection ? '这个集合还没有配置事件' : '还没有配置事件集' }}</text>
        </view>
        <view v-else class="slot-grid">
          <!-- 已解锁槽位 -->
          <view
            v-for="slot in activeCollection.slots"
            :key="slot.unlocked ? slot.user_event_id : `lock_${slot.event_id}_${slot.rarity}_${activeCollection.slots.indexOf(slot)}`"
            class="slot-cell"
            @click="onSlotClick(slot)"
          >
            <view class="slot-frame" :class="{ locked: !slot.unlocked }">
              <image class="slot-img" :src="slot.unlocked ? resolveStaticUrl(slot.image_url) : '/static/image/icon/event_default.jpg'" mode="aspectFill" />
              <view v-if="slot.unlocked && slot.is_new" class="slot-badge">NEW</view>
            </view>
            <text class="slot-title">{{ slot.unlocked ? slot.title : '未解锁' }}</text>
          </view>
        </view>
        <view class="bottom-safe"></view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { petApi } from '../../../api';
import { resolveStaticUrl } from '../../../utils/environment';

const emit = defineEmits(['close', 'selectEvent']);

const collections = ref([]);
const activeKey = ref('');

const activeCollection = computed(() =>
  collections.value.find(c => c.key === activeKey.value) || null
);

async function load() {
  try {
    const res = await petApi.getEventAlbum();
    collections.value = res.data?.collections || [];
    if (collections.value.length > 0 && !activeKey.value) {
      activeKey.value = collections.value[0].key;
    }
  } catch (e) {}
}

function onSlotClick(slot) {
  if (!slot.unlocked) return;
  // 标记已读（消 NEW 角标）
  if (slot.is_new) {
    petApi.markEventRead(slot.user_event_id).then(() => {
      slot.is_new = false;
    }).catch(() => {});
  }
  emit('selectEvent', slot);
}

defineExpose({ reload: load });
onMounted(load);
</script>

<style lang="scss" scoped>
.overlay-mask {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.overlay-backdrop {
  position: absolute;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
}
.overlay-panel {
  position: relative;
  width: 100%;
  height: 82vh;
  background: #F8FBF4;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.overlay-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx 32rpx 8rpx;
  position: relative;
}
.overlay-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #563E22;
}
.overlay-close {
  position: absolute;
  right: 32rpx;
  top: 24rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #999;
}

.collection-tabs {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 32rpx 8rpx;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: none;
}
.collection-tabs::-webkit-scrollbar {
  display: none;
}
.tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  padding: 0 32rpx;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #999999;
  white-space: nowrap;
  flex-shrink: 0;
}
.tab-item.active {
  background: #DDF3D2;
  color: #8EBB77;
  font-weight: 700;
}

.progress-tip {
  display: block;
  padding: 4rpx 32rpx 8rpx;
  font-size: 24rpx;
  color: #8EBB77;
}

.overlay-scroll {
  flex: 1;
  height: 0;
  padding: 8rpx 32rpx 0;
  box-sizing: border-box;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}
.empty-img {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
}

.slot-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 32rpx 24rpx;
}
.slot-cell {
  width: 320rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.slot-frame {
  position: relative;
  width: 320rpx;
  height: 320rpx;
  border-radius: 24rpx;
  overflow: hidden;
  background: #FFFFFF;
  border: 4rpx solid #F0E6C8;
}
.slot-frame.locked {
  background: #EFEFEF;
  border-color: #E0E0E0;
}
.slot-img {
  width: 100%;
  height: 100%;
}
.slot-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.slot-q {
  font-size: 96rpx;
  color: #CCCCCC;
  font-weight: 700;
}
.slot-badge {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
}
.slot-title {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #563E22;
  max-width: 320rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bottom-safe {
  height: calc(24rpx + env(safe-area-inset-bottom));
}
</style>
