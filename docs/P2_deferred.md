# P2 暂缓事项清单

> 2026-09-09 上线前走查产出。以下为已确认「暂不处理 / 后续再做」的问题，按决定记录。
> 本轮已修的 P0/P1/P2 不在此表。

## 待处理（已决定方案，择机执行）

| # | 事项 | 来源 | 用户决定 |
|---|------|------|----------|
| 1 | 宠物页弱网失败体验（无缓存时搭搭形象消失、无提示） | 前端走查 | 方案已给（骨架屏 + 节流 toast），暂不做，后续再做 |
| 2 | 安全硬化（CORS 白名单、登录限流、安全响应头） | 后端走查 | 方案已给，当前流量小，后续再做 |
| 3 | sync-backend-prod.sh 增加 npm install 步骤 | 联调走查 | 方案已给，暂不做 |
| 4 | nginx 静态资源 immutable 缓存头 | 联调走查 | 放最后做 |
| 5 | 弱网空窗体验统一（shop/inventory/tasks/museum 子页失败伪装成真空；index 历史消息无重试；user 协议页空白） | 弱网走查（截图：tmp/weaknet-audit/） | 待用户决定 |

## 明确不做 / 忽略

| # | 事项 | 原因 |
|---|------|------|
| 6 | Dashboard 低权限角色连环 403 | 暂不开低权限账号 |
| 7 | 任务中心加载失败静默 | 不管 |
| 8 | 沉淀 Agent 超时 / 主 Agent 偶发空响应 | 有兜底文案，观察中 |
| 9 | /cms/upload/image 权限绑死 popup_config:write | 不管 |
| 10 | configMonitorService 告警未接入 | 不管 |
| 11 | pm2 历史重启 1324 次、开发机 nodemon 僵尸进程 | 当前稳定 |
| 12 | 死配置/死代码清理（VITE_STATIC_CDN、COS_*、DB_BACKUP_KEEP_DAYS、isAdmin、photos CRUD、store 401 死代码、helper prompt 编号重复） | 不影响运行 |
| 13 | webview 页自身不做域名校验 | 现有调用方均做了白名单 |
| 14 | 35 条启用事件无配图 | 用户确认：故意关闭的，不要动 |
| 15 | store 401 死代码、popup 无效 id 500 等小项 | 无实际用户影响 |
| 16 | 微信订阅消息（notification_channels.wechat_sub） | 暂无需求，后面再加 |
| 17 | 试用灰度开关（global_enabled/grayscale_percent） | 是可用功能，勿动 |

## 本轮已修但需观察

- 沉淀 Agent 超时频率（生产日志）：如兜底频率升高需复查
- 主 Agent 空响应率：本地 2/6，生产近 2 万行日志 0 次
