# P1 功能落地实现说明

## 一、数据模型变更

### 1.1 新增表

- `fasting_records`：轻断食记录，字段包括 `mode / target_hours / eating_window_start / eating_window_end / status / started_at / actual_hours / note`。

### 1.2 表字段扩展

- `museum_items`：新增 `title`、`record_date`，用于心情日记与每日分析历史按日期查询。
- `user_profiles`：新增 `quiet_hours_start`、`quiet_hours_end`，默认 `22:00` / `08:00`。

### 1.3 种子数据更新

- `currency_rules`：自动合并新增 `sources`（`record_water / record_sleep / record_mood / record_fasting_complete / explore_complete / shop_buy / use_item / generate_analysis / share / favorite / upload_photo / complete_profile / drink_water_goal`）。
- `tasks`：新增每日/常驻任务 19 个。
- `achievements`：新增 `duration / habit / body / measure / special` 类成就。
- `seedCms.js`：超级管理员/管理员角色补充陪伴系统权限。

## 二、后端 API 变更

### 2.1 记录中心

- `POST /records/habit`：修复 `water_ml` 同步与 action 映射（`water / sleep / defecation / mood / habit`）。
- `DELETE /records/habit/:id`：新增。
- `GET /records/fasting`：今日轻断食状态。
- `POST /records/fasting`：计划/开始/结束/取消轻断食。

### 2.2 博物馆

- `POST /museum/mood`：保存心情日记。
- `GET /museum/moods?month=&page=&size=`：心情日记列表。
- `POST /museum/items/:id/share`：触发分享任务。

### 2.3 AI 每日分析

- `GET /ai/diary`：生成前扣除 `analysis_cost`（50 浆果/5 鲜花），余额不足返回 400。
- `GET /ai/diary/history?month=&page=&size=`：结构化历史列表。
- `GET /ai/diary/:id`、`DELETE /ai/diary/:id`、`POST /ai/diary/:id/favorite`。

### 2.4 任务/成就触发点

- `record_diet / record_exercise / record_body / record_water / record_sleep / record_mood / record_fasting_complete`
- `chat / interact_touch / feed / explore_complete / shop_buy / use_item / generate_analysis / share / favorite / upload_photo / complete_profile / drink_water_goal`

## 三、前端页面

- `pages/record/mood.vue`：心情记录。
- `pages/tasks/index.vue`：任务中心（签到 + 任务列表 + 领取）。
- `pages/record/index.vue`：新增心情、任务快捷入口；轻断食卡片与服务端同步。
- `pages/museum/diary.vue`：改调 `/ai/diary/history`。
- `pages/user/achievement.vue`：改调后端 `/achievements`。

## 四、消息提醒

- `templateMessageService` 改从 `template_configs` 读取启用模板，内存常量作 fallback。
- 新增勿扰时段过滤。

## 五、验证结果

- `backend npm run init-db` 成功。
- `backend node src/app.js` 启动成功。
- `admin npm run build` 成功。
- `frontend npm run build:h5:test` 成功。
- 接口联调：注册 → 记喝水 → 饮水任务/饮水达标任务完成 → 记心情 → 轻断食计划/开始/结束 → 成就列表查询。
