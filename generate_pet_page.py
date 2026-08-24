import json
import os

LAYOUT = '/Users/yanqian/Desktop/练习项目/fit/dada_layout.json'
OUT = '/Users/yanqian/Desktop/练习项目/fit/frontend/src/pages/pet/index.vue'

with open(LAYOUT, 'r') as f:
    layout = json.load(f)

def px2rpx(v):
    try:
        return round(float(v) * 2)
    except (ValueError, TypeError):
        return v

# Asset mapping
svg_map = {}
for item in layout:
    if item.get('svg'):
        svg_map[item['name']] = item['svg']

# Build template elements
parts = []

# Skip list
skip = {'BODY-9598844', '矩形 16', '5dc4029042ffeac729c5d58507231853', 'image', '组 7', '组 12'}

# Track which plus/circle we are on
plus_index = 0
circle_index = 0
img_exp_index = 0

for item in layout:
    name = item['name']
    ntype = item['type']
    x = px2rpx(item['x'])
    y = px2rpx(item['y'])
    w = px2rpx(item['width'])
    h = px2rpx(item['height'])
    bg = item['background']
    radius = item['borderRadius']
    border = item['border']
    color = item['color']
    font_size = item['fontSize']
    weight = item['fontWeight']
    content = item['content']
    svg = item['svg']

    if name in skip:
        continue

    if name == 'sayhi':
        parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        parts.append(f'<image class="abs-icon" src="/static/image/icon/sayhi@3x.png" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" @click="onInteract(\'touch\')" />')
        continue
    if name == 'baobao':
        parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        parts.append(f'<image class="abs-icon" src="/static/image/icon/baobao@3x.png" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" @click="onInteract(\'hug\')" />')
        continue
    if name == 'zuoguilian':
        parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        parts.append(f'<image class="abs-icon" src="/static/image/icon/zuoguilian@3x.png" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" @click="goMood" />')
        continue
    if name == '组 17':
        # Status pill background
        parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        continue
    if name == '组 8':
        # Bottom menu background
        parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        continue
    if name == 'dada01':
        parts.append(f'<image class="abs" src="/static/image/icon/dada01@3x.png" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        continue
    if name == 'tanhao':
        # Only show when hungry
        parts.append(f'<image v-if="showHungryCta" class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        continue
    if name in ('renwu', 'beibao', 'shijian', 'shangdian'):
        # Bottom menu icons
        click = {'renwu': 'goTasks', 'beibao': 'openBag', 'shijian': 'openEventsPanel', 'shangdian': 'goShop'}[name]
        parts.append(f'<image class="abs-icon" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" @click="{click}" />')
        continue
    if name == '圆形 6':
        # Currency pill background
        circle_index += 1
        if circle_index == 1:
            parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        else:
            parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        continue
    if name == '图片扩图生成 (7)':
        # Currency icon
        img_exp_index += 1
        icon = 'jiangguo@3x.png' if img_exp_index == 1 else 'xianhua@3x.png'
        x_offset = 4  # slightly inset to match design
        # Use the item position/size from JSON
        parts.append(f'<image class="abs" src="/static/image/icon/{icon}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" />')
        continue
    if name == '+':
        plus_index += 1
        click = 'goShop'
        # The plus SVG is small 10x10 at x,y. Place a clickable plus button.
        parts.append(f'<image class="abs" src="{svg_map[name]}" mode="aspectFit" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;" @click="{click}" />')
        continue
    if ntype == 'TEXT':
        # Dynamic values for status and currency
        text = content
        if content == '60/100':
            text = '{{ state.mood || 0 }}/100'
        elif content == '88/100':
            text = '{{ state.satiety || 0 }}/100'
        elif content == '123':
            # There are two 123 texts. First is berries, second is flowers.
            # We can determine by x position: first at x=186, second at x=299
            if item['x'] < 200:
                text = '{{ currency.berries || 0 }}'
            else:
                text = '{{ currency.flowers || 0 }}'
        elif content in ('任务', '背包', '事件', '商店'):
            pass
        # Build text style
        styles = [f'left:{x}rpx', f'top:{y}rpx']
        if color:
            styles.append(f'color:{color}')
        if font_size:
            styles.append(f'font-size:{px2rpx(font_size)}rpx')
        if weight:
            styles.append(f'font-weight:{weight}')
        style_str = ';'.join(styles)
        parts.append(f'<text class="abs-text" style="{style_str}">{text}</text>')
        continue
    if ntype == 'RECTANGLE':
        # Progress bars
        if name in ('矩形 29', '矩形 32'):
            # Gray track
            parts.append(f'<view class="abs-bar" style="left:{x}rpx;top:{y}rpx;width:{w}rpx;height:{h}rpx;background:#E7E7E7;border-radius:{px2rpx(radius)}rpx;"></view>')
            continue
        if name == '矩形 30':
            # Mood fill
            parts.append(f'<view class="abs-bar" :style="{{ left: \'{x}rpx\', top: \'{y}rpx\', width: ((state.mood || 0) / 100 * {w}) + \'rpx\', height: \'{h}rpx\', background: \'#8DBB77\', borderRadius: \'{px2rpx(radius)}rpx\' }}"></view>')
            continue
        if name == '矩形 31':
            # Satiety fill
            parts.append(f'<view class="abs-bar" :style="{{ left: \'{x}rpx\', top: \'{y}rpx\', width: ((state.satiety || 0) / 100 * {w}) + \'rpx\', height: \'{h}rpx\', background: \'#8DBB77\', borderRadius: \'{px2rpx(radius)}rpx\' }}"></view>')
            continue

# Generate template
stage_elements = '\n      '.join(parts)

template = f'''<!-- 此页面由搭搭json.json 自动生成，坐标按设计稿 1px=2rpx 还原 -->
<template>
  <view class="pet-page">
    <image class="bg-image" src="/static/image/icon/dada_bg.jpg" mode="aspectFill" />

    <view class="stage">
      {stage_elements}

      <!-- 饥饿状态气泡与 CTA，来自 dada02.json 场景 -->
      <view v-if="showBubble" class="bubble-hungry">
        <view class="bubble">
          <text class="bubble-text">{{ bubbleText }}</text>
        </view>
        <view v-if="showHungryCta" class="bubble-cta" @click="openBag">去找食物</view>
      </view>

      <view v-if="state.location === 'away'" class="away-tag">
        <text class="away-text">外出中 {{ remainingTime }}</text>
      </view>
    </view>

    <CustomTabBar />

    <view v-if="feedPanelVisible" class="feed-mask" @click="feedPanelVisible = false">
      <view class="feed-panel" @click.stop>
        <text class="panel-title">我的背包</text>
        <view v-if="foods.length === 0" class="empty-tip">
          <text>背包里没有食物，</text>
          <text class="link" @click="goShop">去商城买点吧</text>
        </view>
        <view v-else class="food-list">
          <view v-for="food in foods" :key="food.id" class="food-item" @click="onFeed(food.id)">
            <image class="food-icon" src="/static/image/icon/jinri.png" mode="aspectFit" />
            <view class="food-info">
              <text class="food-name">{{ food.name }}</text>
              <text class="food-effect">{{ foodEffectText(food.effect_json) }}</text>
            </view>
            <text class="food-count">x{{ food.quantity }}</text>
          </view>
        </view>
        <view class="panel-close" @click="feedPanelVisible = false">关闭</view>
      </view>
    </view>

    <view v-if="eventPanelVisible" class="feed-mask" @click="eventPanelVisible = false">
      <view class="feed-panel" @click.stop>
        <text class="panel-title">事件相册</text>
        <view v-if="events.length === 0" class="empty-tip">
          <text>搭搭还没遇到新鲜事，送他出去逛逛吧～</text>
        </view>
        <view v-else class="event-list">
          <view v-for="item in events" :key="item.id" class="event-item" :class="{{ new: item.is_new }}">
            <image class="event-img" src="/static/image/icon/bowuguan.png" mode="aspectFit" />
            <view class="event-info">
              <text class="event-title">{{ item.title }}</text>
              <text class="event-content">{{ item.content }}</text>
            </view>
          </view>
        </view>
        <view class="panel-close" @click="eventPanelVisible = false">关闭</view>
      </view>
    </view>
  </view>
</template>
'''

# Read existing script
with open(OUT, 'r') as f:
    old = f.read()

script_start = old.find('<script setup>')
style_start = old.find('<style lang="scss" scoped>')
script = old[script_start:style_start]

# New styles
styles = '''<style lang="scss" scoped>
.pet-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
}

.bg-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
}

.stage {
  position: fixed;
  top: 0;
  left: 0;
  width: 750rpx;
  height: 1716rpx;
  z-index: 1;
}

.abs {
  position: absolute;
  z-index: 2;
}

.abs-icon {
  position: absolute;
  z-index: 3;
}

.abs-text {
  position: absolute;
  z-index: 3;
  line-height: 1.2;
}

.abs-bar {
  position: absolute;
  z-index: 3;
}

.bubble-hungry {
  position: absolute;
  left: 186rpx;
  top: 644rpx;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bubble {
  width: 510rpx;
  background: #E8F6D7;
  border: 2rpx solid #563E22;
  border-radius: 28rpx;
  padding: 24rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 16rpx;
}

.bubble-text {
  font-size: 28rpx;
  color: #563E22;
  line-height: 1.4;
  text-align: center;
  font-weight: 700;
}

.bubble-cta {
  background: #E8F6D7;
  color: #563E22;
  font-size: 28rpx;
  font-weight: 700;
  border: 2rpx solid #563E22;
  border-radius: 40rpx;
  padding: 16rpx 72rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.away-tag {
  position: absolute;
  left: 50%;
  top: 420rpx;
  transform: translateX(-50%);
  z-index: 20;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 20rpx;
  padding: 8rpx 20rpx;
}

.away-text {
  font-size: 22rpx;
  color: #F59E0B;
  font-weight: 500;
}

.feed-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.feed-panel {
  width: 100%;
  background: #FFFFFF;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.panel-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 24rpx;
}

.empty-tip {
  padding: 40rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #9CA3AF;
}

.empty-tip .link {
  color: #8DBB77;
}

.food-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  max-height: 600rpx;
  overflow-y: auto;
}

.food-item {
  display: flex;
  align-items: center;
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 20rpx;
  gap: 16rpx;
}

.food-icon {
  width: 64rpx;
  height: 64rpx;
}

.food-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.food-name {
  font-size: 28rpx;
  color: #1A1A1A;
}

.food-effect {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

.food-count {
  font-size: 28rpx;
  color: #8DBB77;
  font-weight: 500;
}

.panel-close {
  margin-top: 24rpx;
  text-align: center;
  font-size: 28rpx;
  color: #6B7280;
  padding: 20rpx 0;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.event-item {
  display: flex;
  align-items: center;
  background: #F9FAFB;
  border-radius: 16rpx;
  padding: 16rpx;
  gap: 16rpx;
}

.event-item.new {
  border: 2rpx solid #FBBF24;
}

.event-img {
  width: 80rpx;
  height: 80rpx;
}

.event-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.event-title {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 500;
}

.event-content {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 4rpx;
}
</style>
'''

full = template + script + styles

with open(OUT, 'w') as f:
    f.write(full)

print(f'Generated {OUT}')
print(f'Total elements: {len(parts)}')
