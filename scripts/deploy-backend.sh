#!/bin/bash
# ============================================================
# ⚠️ 已废弃（2026-09-09）：git 部署流程停用，服务器 /opt/jianfeidazi 的 .git 已改名保留。
# 唯一部署流程为 rsync：./scripts/sync-backend-prod.sh（自动含数据库备份）
# 本脚本保留仅为历史参考，执行会直接退出。
# ============================================================
echo "❌ deploy-backend.sh 已废弃。请使用：./scripts/sync-backend-prod.sh"
exit 1
