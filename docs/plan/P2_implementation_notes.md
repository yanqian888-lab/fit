# P2 功能落地实现说明

## 一、数据模型变更

### 1.1 新增表

- `workout_lib`：陪你动课程库，字段包括 `workout_key / name / category / video_url / cover_url / duration_seconds / calorie_per_session / required_equipment_key / description / sort_order / status`。

### 1.2 表字段扩展

- `user_profiles`：新增 `water_goal`（默认 2000ml）。
- `exercise_records`：新增 `is_workout / source / workout_key / video_url`，用于承载跟练来源。

### 1.3 种子数据更新

- `template_configs`：补全 `water` 类型模板（gentle/strict/tease），支持 `{drank}/{goal}/{remaining}` 占位符。
- `achievements`：新增「连续 7 天完成轻断食」「每周完成 2 天 5:2 轻断食」。
- `workout_lib`：新增 5 门默认课程，其中跳绳/瑜伽垫课程与商城器材解锁关联。

## 二、后端 API 变更

### 2.1 系统设置

- `GET /settings`：返回中增加 `water_goal`（来自 `user_profiles`）。
- `PUT /settings`：增加 `water_goal` 字段，同步更新 `user_profiles`。

### 2.2 模板消息

- `templateMessageService.isInQuietHours` 改从 `settings.dnd_start / dnd_end` 读取勿扰时段。
- 发送前按 `settings.notification_enabled` 总开关、`reminder_water`、`reminder_exercise` 细分开关过滤。
- 新增 `water` 发送时段（14:00-14:30），发送时读取今日饮水量与目标，达标后不再发送。

### 2.3 心情日记

- `GET /museum/moods/stats?month=`：返回心情分布、平均分、每日趋势。
- `GET /ai/diary` 生成分析时优先读取 `museum_items.sub_type='mood'` 的心情记录。

### 2.4 轻断食

- `GET /records/fasting/stats`：返回本周完成天数、5:2 完成天数、最长连续天数、累计完成天数。
- `fastingService.planFasting` 已支持 `5:2 / OMAD / 自定义` 模式。
- `achievementService.checkSpecial` 支持 `fasting_streak_7`、`fasting_5_2_week` 成就。

### 2.5 每日分析详情

- 复用已有 `GET /ai/diary/:id`、`DELETE /ai/diary/:id`、`POST /ai/diary/:id/favorite`。

### 2.6 陪你动

- `GET /workouts`：课程列表，带 `is_unlocked` 解锁状态。
- `GET /workouts/:key`：课程详情。
- `POST /workouts/:key/start`：开始跟练校验。
- `POST /workouts/:key/complete`：完成打卡，写入 `exercise_records` 并发放 `record_exercise` 奖励。

## 三、前端页面

- `pages/user/notifications.vue`：重写，对接 `/settings`，支持通知总开关、喝水/运动/体重提醒、饮水目标、勿扰时段。
- `pages/museum/mood-history.vue`：心情历史列表 + 分布/趋势统计。
- `pages/museum/diary-detail.vue`：每日分析详情，支持收藏、删除、重新生成、分享文本。
- `pages/museum/diary.vue`：点击日记卡片进入详情页。
- `pages/museum/index.vue`：新增「心情历史」入口。
- `pages/workout/index.vue`：陪你动课程列表。
- `pages/workout/session.vue`：视频播放 + 计时 + 完成打卡。
- `pages/record/index.vue`：新增「陪你动」快捷入口；轻断食支持 `5:2 / OMAD / 自定义` 与本周进度。
- `pages/record/exercise-detail.vue`：底部新增「开始跟练」入口。

## 四、验证结果

- `backend npm run init-db` 成功。
- `backend node -e "require('./src/app.js')"` 启动成功（无语法/依赖错误）。
- `admin npm run build` 成功。
- `frontend npm run build:h5:test` 成功。
