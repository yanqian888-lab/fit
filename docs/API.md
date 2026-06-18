# 减肥搭子 APP —— 核心 API 接口设计

> RESTful 风格，JSON 数据格式，统一返回结构。所有业务接口需携带 JWT Token（除登录外）。

---

## 1. 统一返回结构

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | int | 0 成功，非 0 失败 |
| message | string | 提示信息 |
| data | any | 业务数据 |

### 常见状态码

| code | 含义 |
|------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未登录或 Token 失效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 1001 | AI 服务调用失败 |
| 1002 | 沉淀提取失败 |

---

## 2. 认证相关

### 2.1 微信小程序登录

```
POST /api/auth/wechat-login
```

**请求参数：**

```json
{
  "code": "微信登录临时 code"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 604800,
    "is_new_user": true,
    "user": {
      "id": 1,
      "nickname": "减肥搭子用户",
      "avatar_url": null
    }
  }
}
```

### 2.2 刷新 Token

```
POST /api/auth/refresh
```

**请求头：** `Authorization: Bearer <token>`

**响应：**

```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 604800
  }
}
```

---

## 3. 用户模块

### 3.1 获取当前用户信息

```
GET /api/users/me
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "nickname": "小明",
    "avatar_url": "https://...",
    "gender": 2,
    "age": 25,
    "height": 165,
    "profile": {
      "initial_weight": 65,
      "current_weight": 62.5,
      "target_weight": 55,
      "target_date": "2026-09-01",
      "bmr": 1350,
      "daily_calorie_target": 1500,
      "calorie_deficit": 500
    },
    "partner": {
      "name": "瘦瘦",
      "mode": "gentle",
      "status": "eating",
      "status_text": "正在吃午饭"
    }
  }
}
```

### 3.2 更新用户资料

```
PUT /api/users/me
```

**请求参数：**

```json
{
  "nickname": "小明",
  "avatar_url": "https://...",
  "gender": 2,
  "age": 25,
  "height": 165
}
```

### 3.3 更新减肥目标

```
PUT /api/users/profile
```

**请求参数：**

```json
{
  "initial_weight": 65,
  "target_weight": 55,
  "target_date": "2026-09-01",
  "calorie_deficit": 500,
  "dietary_taboos": "海鲜,花生",
  "preferences": "川菜,面食"
}
```

---

## 4. 搭子模块

### 4.1 获取搭子设置

```
GET /api/partners
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "name": "瘦瘦",
    "gender": 2,
    "mode": "gentle",
    "voice_speed": 5,
    "strictness": 5,
    "humor": 5,
    "status": "awake",
    "status_text": "刚刚起床"
  }
}
```

### 4.2 更新搭子设置

```
PUT /api/partners
```

**请求参数：**

```json
{
  "name": "阿瘦",
  "mode": "tease",
  "voice_speed": 6,
  "strictness": 8,
  "humor": 7
}
```

### 4.3 切换搭子模式

```
POST /api/partners/switch-mode
```

**请求参数：**

```json
{
  "mode": "strict"
}
```

---

## 5. 聊天模块

### 5.1 发送消息（核心接口）

```
POST /api/chat/send
```

**请求参数：**

```json
{
  "content": "今天中午吃了一碗牛肉面和一个鸡蛋",
  "content_type": "text"
}
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "user_message": {
      "id": 1001,
      "role": "user",
      "content": "今天中午吃了一碗牛肉面和一个鸡蛋",
      "created_at": "2026-06-18T12:30:00Z",
      "precipitation_status": 0
    },
    "partner_message": {
      "id": 1002,
      "role": "partner",
      "content": "收到！我帮你记下来啦～今天午餐热量大概 570 千卡，记得晚上稍微控制一下哦",
      "created_at": "2026-06-18T12:30:01Z",
      "precipitation_status": 1,
      "precipitation_info": {
        "type": "diet_record",
        "confidence": 0.96,
        "status": "confirmed"
      }
    }
  }
}
```

**说明：**

- 该接口会立即返回搭子回复
- 沉淀处理为异步，前端可通过 WebSocket 或轮询获取沉淀状态更新

### 5.2 获取聊天记录

```
GET /api/chat/messages?page=1&size=20
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1002,
        "role": "partner",
        "content": "收到！我帮你记下来啦～",
        "content_type": "text",
        "precipitation_status": 1,
        "created_at": "2026-06-18T12:30:01Z"
      },
      {
        "id": 1001,
        "role": "user",
        "content": "今天中午吃了一碗牛肉面和一个鸡蛋",
        "content_type": "text",
        "precipitation_status": 1,
        "created_at": "2026-06-18T12:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 156,
      "has_more": true
    }
  }
}
```

### 5.3 确认待确认沉淀

```
POST /api/chat/confirm-precipitation
```

**请求参数：**

```json
{
  "precipitation_id": 5001,
  "confirmed": true,
  "modified_data": {
    "meal_time": "lunch",
    "foods": [
      { "name": "牛肉面", "weight": 200, "calorie": 500 }
    ]
  }
}
```

### 5.4 上传图片/语音

```
POST /api/chat/upload
```

**请求参数：** `multipart/form-data`

| 字段 | 说明 |
|------|------|
| file | 文件 |
| type | image / voice |

**响应：**

```json
{
  "code": 0,
  "data": {
    "url": "https://cos.xxx.com/chat/1001/xxx.jpg"
  }
}
```

---

## 6. 记录中心模块

### 6.1 获取今日概览

```
GET /api/records/today
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "date": "2026-06-18",
    "intake": 1200,
    "burned": 400,
    "remaining": 300,
    "status": "green",
    "current_weight": 62.5,
    "weight_change": -0.3,
    "protein_ratio": 25,
    "carb_ratio": 50,
    "fat_ratio": 25,
    "exercise_duration": 45,
    "pending_count": 2
  }
}
```

### 6.2 获取饮食记录

```
GET /api/records/diet?date=2026-06-18
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "date": "2026-06-18",
    "total_calorie": 1200,
    "meals": {
      "breakfast": [],
      "lunch": [
        {
          "id": 1,
          "foods": [{ "name": "牛肉面", "weight": 200, "calorie": 500 }],
          "total_calorie": 500,
          "status": 1,
          "tags": "外卖"
        }
      ],
      "dinner": [],
      "snack": []
    }
  }
}
```

### 6.3 添加/编辑饮食记录

```
POST /api/records/diet
PUT /api/records/diet/:id
```

**请求参数：**

```json
{
  "record_date": "2026-06-18",
  "meal_time": "lunch",
  "foods": [
    { "name": "牛肉面", "weight": 200, "calorie": 500, "protein": 20, "carb": 60, "fat": 15 }
  ],
  "tags": "外卖",
  "remark": "有点咸"
}
```

### 6.4 删除饮食记录

```
DELETE /api/records/diet/:id
```

### 6.5 获取运动记录

```
GET /api/records/exercise?date=2026-06-18
```

### 6.6 添加/编辑运动记录

```
POST /api/records/exercise
PUT /api/records/exercise/:id
```

**请求参数：**

```json
{
  "record_date": "2026-06-18",
  "exercise_type": "aerobic",
  "exercises": [
    { "name": "跑步", "duration": 30, "intensity": "moderate", "calorie": 300 }
  ],
  "remark": "跑得有点累"
}
```

### 6.7 获取身体数据记录

```
GET /api/records/body?type=weight&days=7
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "type": "weight",
    "unit": "kg",
    "target": 55,
    "list": [
      { "date": "2026-06-18", "value": 62.5, "change": -0.3 },
      { "date": "2026-06-17", "value": 62.8, "change": -0.2 },
      { "date": "2026-06-16", "value": 63.0, "change": 0 }
    ]
  }
}
```

### 6.8 添加身体数据

```
POST /api/records/body
```

**请求参数：**

```json
{
  "record_date": "2026-06-18",
  "type": "weight",
  "value": 62.5,
  "unit": "kg"
}
```

---

## 7. 博物馆模块

### 7.1 获取博物馆总览

```
GET /api/museum/overview
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "lost_weight": 2.5,
    "used_days": 30,
    "target_weight": 55,
    "completion_rate": 29.4,
    "remaining_days": 75,
    "total_checkin_days": 28,
    "total_exercise_minutes": 560,
    "total_burned_calorie": 3200,
    "next_milestone": {
      "title": "减重 5 斤",
      "remaining": 2.5
    }
  }
}
```

### 7.2 获取时间轴

```
GET /api/museum/timeline?filter=all&date=2026-06
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "event_type": "weight",
        "title": "体重 62.5kg",
        "content": "比昨天减少 0.3kg",
        "event_date": "2026-06-18",
        "is_important": 0
      },
      {
        "id": 2,
        "event_type": "quote",
        "title": "金句",
        "content": "只要坚持，就没有瘦不下来的胖子",
        "event_date": "2026-06-17",
        "is_important": 1
      }
    ]
  }
}
```

### 7.3 获取博物馆内容列表

```
GET /api/museum/items?type=quote&page=1&size=20
```

**type 可选值：** `quote` 金句, `insight` 感悟, `recipe` 食谱, `method` 方法, `pitfall` 踩坑

**响应：**

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "type": "quote",
        "content": "只要坚持，就没有瘦不下来的胖子",
        "author": "user",
        "emotion": "positive",
        "is_favorite": 1,
        "created_at": "2026-06-17T20:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 12,
      "has_more": false
    }
  }
}
```

### 7.4 添加博物馆内容

```
POST /api/museum/items
```

**请求参数：**

```json
{
  "type": "quote",
  "content": "减肥就是管住嘴迈开腿",
  "author": "user",
  "tags": "励志"
}
```

### 7.5 更新博物馆内容

```
PUT /api/museum/items/:id
```

### 7.6 删除博物馆内容

```
DELETE /api/museum/items/:id
```

---

## 8. 数据与设置模块

### 8.1 获取用户设置

```
GET /api/settings
```

### 8.2 更新用户设置

```
PUT /api/settings
```

### 8.3 导出数据

```
POST /api/data/export
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "download_url": "https://cos.xxx.com/export/1001/data.xlsx",
    "expires_at": "2026-06-18T13:00:00Z"
  }
}
```

### 8.4 清空所有数据

```
POST /api/data/clear
```

### 8.5 注销账号

```
POST /api/data/delete-account
```

---

## 9. 系统模块

### 9.1 获取食物数据库

```
GET /api/foods?keyword=牛肉&page=1&size=20
```

### 9.2 获取运动数据库

```
GET /api/exercises?keyword=跑步&page=1&size=20
```

### 9.3 获取搭子状态（定时刷新）

```
GET /api/partners/status
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "status": "eating",
    "status_text": "正在吃午饭",
    "updated_at": "2026-06-18T12:00:00Z"
  }
}
```

---

## 10. 接口安全

### 10.1 认证方式

所有业务接口在请求头中携带：

```
Authorization: Bearer <jwt_token>
```

### 10.2 限流策略

| 接口 | 限流 |
|------|------|
| /api/chat/send | 每分钟 30 次 |
| /api/auth/* | 每分钟 10 次 |
| 其他接口 | 每分钟 120 次 |

### 10.3 文件上传限制

| 类型 | 大小限制 | 格式限制 |
|------|----------|----------|
| image | 5MB | jpg, png, gif, webp |
| voice | 2MB | mp3, m4a |
