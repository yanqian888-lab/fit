# 减肥搭子 APP

> 基于 3 个 AI Agent 协作的聊天式减肥陪伴 APP。

## 项目简介

「减肥搭子」是一款让用户像和真实朋友聊天一样完成减肥记录的 AI 应用。核心特色：

- **聊天即记录**：和搭子聊天，饮食、运动、体重自动沉淀
- **有温度的陪伴**：三种性格模式（温柔/严格/损友），像真实减肥伙伴
- **个人减肥博物馆**：自动整理金句、感悟、食谱、里程碑
- **极致低成本**：MVP 阶段零成本启动，优先使用豆包免费模型

## 项目结构

```
fit/
├── backend/                # Node.js + Express 后端
│   ├── src/
│   │   ├── app.js          # 服务入口
│   │   ├── controllers/    # 控制器
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # 路由
│   │   ├── services/agents/# 三 Agent 实现
│   │   └── db.js           # SQLite 数据库
│   ├── package.json
│   └── .env.example
├── frontend/               # UniApp 前端
│   ├── src/pages/          # 页面
│   │   ├── index/          # 首页聊天
│   │   ├── record/         # 记录中心
│   │   ├── museum/         # 减肥博物馆
│   │   └── mine/           # 我的
│   ├── src/api/            # API 封装
│   ├── src/store/          # Pinia 状态管理
│   ├── src/utils/          # 工具函数
│   └── package.json
├── docs/                   # 项目文档
│   ├── PRD.md              # 产品需求文档
│   ├── TECH.md             # 技术架构文档
│   ├── DATABASE.md         # 数据库设计
│   ├── API.md              # 接口文档
│   ├── DEPLOY.md           # 部署教程
│   └── 手动准备工作指南.md  # 手动准备清单
└── word/                   # 原始需求文档
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | UniApp + Vue3 |
| 后端 | Node.js + Express |
| 数据库 | SQLite（本地）+ MySQL（云端备份） |
| AI | 豆包开放平台 API |
| 部署 | 轻量应用服务器 + PM2 + Nginx |

## 快速开始

### 后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 填写豆包 API Key 等配置
npm install
npm run init-db
npm run dev
```

### 前端

```bash
cd frontend
npm install
# 使用 HBuilderX 打开项目并运行到微信小程序模拟器
```

## 三 Agent 协作

| Agent | 角色 | 模型 | 职责 |
|-------|------|------|------|
| 主协调 Agent | 大脑 + 感性层 | doubao-seed-2.0-lite | 对话、意图识别、共情回复 |
| 信息沉淀 Agent | 独立后台 | doubao-lite-32k | 聊天记录提取、置信度计算 |
| 全能助手 Agent | 理性层 | doubao-seed-2.0-lite | 计算、营养评估、专业建议 |

## 文档索引

- [产品需求文档](docs/PRD.md)
- [技术架构文档](docs/TECH.md)
- [数据库设计](docs/DATABASE.md)
- [接口文档](docs/API.md)
- [部署教程](docs/DEPLOY.md)
- [手动准备工作指南](docs/手动准备工作指南.md)

## 开源协议

MIT
