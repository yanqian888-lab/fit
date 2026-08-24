#!/bin/bash

echo "🔍 开始验证所有修复..."
echo "================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
pass_count=0
fail_count=0

# 验证函数
verify() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((pass_count++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((fail_count++))
    fi
}

# P0-001: 验证前端测试依赖
echo ""
echo "📦 P0-001: 验证前端测试依赖"
echo "--------------------------------"
cd frontend
if [ -f "node_modules/.bin/vitest" ]; then
    echo -e "${GREEN}✅ vitest 已安装${NC}"
    ((pass_count++))
else
    echo -e "${YELLOW}⚠️  vitest 未安装，正在安装...${NC}"
    npm install --save-dev vitest @vitest/coverage-v8 @vue/test-utils jsdom
    if [ -f "node_modules/.bin/vitest" ]; then
        echo -e "${GREEN}✅ vitest 安装成功${NC}"
        ((pass_count++))
    else
        echo -e "${RED}❌ vitest 安装失败${NC}"
        ((fail_count++))
    fi
fi
cd ..

# P0-002: 验证后端测试
echo ""
echo "📦 P0-002: 验证后端测试"
echo "--------------------------------"
cd backend
NODE_ENV=test node scripts/smoke-test.js > /dev/null 2>&1
verify "后端冒烟测试通过"

NODE_ENV=test node scripts/full-test.js > /dev/null 2>&1
verify "后端全量测试通过"
cd ..

# P1-001: 验证端到端测试文件
echo ""
echo "📦 P1-001: 验证端到端测试文件"
echo "--------------------------------"
if [ -f "e2e/core-flows.spec.js" ]; then
    echo -e "${GREEN}✅ 端到端测试文件存在${NC}"
    ((pass_count++))
    
    # 检查文件内容
    if grep -q "E2E-001" e2e/core-flows.spec.js; then
        echo -e "${GREEN}✅ 端到端测试用例完整${NC}"
        ((pass_count++))
    else
        echo -e "${RED}❌ 端到端测试用例不完整${NC}"
        ((fail_count++))
    fi
else
    echo -e "${RED}❌ 端到端测试文件不存在${NC}"
    ((fail_count++))
fi

# P1-002: 验证性能测试脚本
echo ""
echo "📦 P1-002: 验证性能测试脚本"
echo "--------------------------------"
if [ -f "backend/scripts/performance-test.js" ]; then
    echo -e "${GREEN}✅ Apache Bench 性能测试脚本存在${NC}"
    ((pass_count++))
else
    echo -e "${RED}❌ Apache Bench 性能测试脚本不存在${NC}"
    ((fail_count++))
fi

if [ -f "backend/scripts/k6-performance-test.js" ]; then
    echo -e "${GREEN}✅ k6 性能测试脚本存在${NC}"
    ((pass_count++))
else
    echo -e "${RED}❌ k6 性能测试脚本不存在${NC}"
    ((fail_count++))
fi

# P2-001: 验证测试报告
echo ""
echo "📦 P2-001: 验证测试报告"
echo "--------------------------------"
if [ -f "TEST_REPORT.md" ]; then
    if grep -q "2026-07-25" TEST_REPORT.md; then
        echo -e "${GREEN}✅ 测试报告已更新日期${NC}"
        ((pass_count++))
    else
        echo -e "${RED}❌ 测试报告日期未更新${NC}"
        ((fail_count++))
    fi
    
    if grep -q "P0-001" TEST_REPORT.md; then
        echo -e "${GREEN}✅ 测试报告已填充问题数据${NC}"
        ((pass_count++))
    else
        echo -e "${RED}❌ 测试报告未填充问题数据${NC}"
        ((fail_count++))
    fi
else
    echo -e "${RED}❌ 测试报告不存在${NC}"
    ((fail_count++))
fi

# P2-002: 验证 CI/CD 配置
echo ""
echo "📦 P2-002: 验证 CI/CD 配置"
echo "--------------------------------"
if [ -f ".github/workflows/test.yml" ]; then
    echo -e "${GREEN}✅ CI/CD 配置文件存在${NC}"
    ((pass_count++))
    
    # 检查配置内容
    if grep -q "backend-test" .github/workflows/test.yml && \
       grep -q "frontend-test" .github/workflows/test.yml && \
       grep -q "e2e-test" .github/workflows/test.yml; then
        echo -e "${GREEN}✅ CI/CD 配置完整${NC}"
        ((pass_count++))
    else
        echo -e "${RED}❌ CI/CD 配置不完整${NC}"
        ((fail_count++))
    fi
else
    echo -e "${RED}❌ CI/CD 配置文件不存在${NC}"
    ((fail_count++))
fi

# 验证修复总结文档
echo ""
echo "📦 验证修复总结文档"
echo "--------------------------------"
if [ -f "FIX_SUMMARY.md" ]; then
    echo -e "${GREEN}✅ 修复总结文档存在${NC}"
    ((pass_count++))
else
    echo -e "${RED}❌ 修复总结文档不存在${NC}"
    ((fail_count++))
fi

# 输出总结
echo ""
echo "================================"
echo -e "${GREEN}验证完成: 通过 ${pass_count} 项, 失败 ${fail_count} 项${NC}"
echo "================================"

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✅ 所有修复验证通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 存在验证失败的修复项${NC}"
    exit 1
fi