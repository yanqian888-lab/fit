/**
 * 性能测试脚本
 * 使用 Apache Bench (ab) 进行压力测试
 * 
 * 用法：
 *   chmod +x scripts/performance-test.sh
 *   ./scripts/performance-test.sh
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENT_USERS = [10, 50, 100];
const REQUESTS_PER_USER = 100;

const endpoints = [
  { name: '健康检查', path: '/api/health', method: 'GET' },
  { name: '用户信息', path: '/api/users/me', method: 'GET', auth: true },
  { name: '今日数据', path: '/api/records/today', method: 'GET', auth: true },
  { name: '博物馆概览', path: '/api/museum/overview', method: 'GET', auth: true },
  { name: '宠物状态', path: '/api/pet', method: 'GET', auth: true },
];

const results = [];

function runAbTest(url, concurrency, requests) {
  return new Promise((resolve, reject) => {
    const ab = spawn('ab', [
      '-n', requests.toString(),
      '-c', concurrency.toString(),
      '-H', 'Authorization: Bearer test_token',
      url
    ]);

    let output = '';
    let errorOutput = '';

    ab.stdout.on('data', (data) => {
      output += data.toString();
    });

    ab.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ab.on('close', (code) => {
      if (code !== 0 && !output.includes('Complete requests')) {
        reject(new Error(`ab 命令失败: ${errorOutput}`));
        return;
      }

      // 解析结果
      const result = {
        url,
        concurrency,
        requests,
        success: true,
        metrics: parseAbOutput(output)
      };

      resolve(result);
    });
  });
}

function parseAbOutput(output) {
  const metrics = {};

  // 提取关键指标
  const completeMatch = output.match(/Complete requests:\s*(\d+)/);
  const failedMatch = output.match(/Failed requests:\s*(\d+)/);
  const timePerRequestMatch = output.match(/Time per request:\s*([\d.]+)\s*\[ms\]/);
  const requestsPerSecondMatch = output.match(/Requests per second:\s*([\d.]+)/);
  const transferRateMatch = output.match(/Transfer rate:\s*([\d.]+)/);

  if (completeMatch) metrics.completeRequests = parseInt(completeMatch[1]);
  if (failedMatch) metrics.failedRequests = parseInt(failedMatch[1]);
  if (timePerRequestMatch) metrics.timePerRequest = parseFloat(timePerRequestMatch[1]);
  if (requestsPerSecondMatch) metrics.requestsPerSecond = parseFloat(requestsPerSecondMatch[1]);
  if (transferRateMatch) metrics.transferRate = parseFloat(transferRateMatch[1]);

  return metrics;
}

async function runPerformanceTests() {
  console.log('\n⚡ 开始性能测试\n');
  console.log(`目标服务器: ${BASE_URL}`);
  console.log(`并发用户数: ${CONCURRENT_USERS.join(', ')}`);
  console.log(`每用户请求数: ${REQUESTS_PER_USER}\n`);

  for (const endpoint of endpoints) {
    console.log(`\n📦 测试接口: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
    console.log('-'.repeat(60));

    for (const concurrency of CONCURRENT_USERS) {
      try {
        console.log(`  并发 ${concurrency} 用户...`);
        const url = `${BASE_URL}${endpoint.path}`;
        const result = await runAbTest(url, concurrency, REQUESTS_PER_USER);
        
        results.push({
          endpoint: endpoint.name,
          path: endpoint.path,
          concurrency,
          ...result.metrics
        });

        console.log(`    ✅ 完成: ${result.metrics.completeRequests || 0} 请求`);
        console.log(`    ⏱️  平均响应时间: ${result.metrics.timePerRequest || 0} ms`);
        console.log(`    📊 QPS: ${result.metrics.requestsPerSecond || 0}`);
        
        if (result.metrics.failedRequests > 0) {
          console.log(`    ⚠️  失败请求: ${result.metrics.failedRequests}`);
        }
      } catch (error) {
        console.log(`    ❌ 测试失败: ${error.message}`);
        results.push({
          endpoint: endpoint.name,
          path: endpoint.path,
          concurrency,
          success: false,
          error: error.message
        });
      }
    }
  }

  // 生成报告
  generateReport();
}

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 性能测试报告');
  console.log('='.repeat(60) + '\n');

  // 按接口分组
  const groupedResults = {};
  results.forEach(result => {
    if (!groupedResults[result.endpoint]) {
      groupedResults[result.endpoint] = [];
    }
    groupedResults[result.endpoint].push(result);
  });

  // 输出每个接口的结果
  Object.entries(groupedResults).forEach(([endpoint, tests]) => {
    console.log(`\n${endpoint}:`);
    console.log('-'.repeat(40));
    
    tests.forEach(test => {
      if (test.success) {
        const status = test.timePerRequest < 500 ? '✅' : (test.timePerRequest < 1000 ? '⚠️' : '❌');
        console.log(`  ${status} 并发 ${test.concurrency}: ${test.timePerRequest} ms, QPS: ${test.requestsPerSecond}`);
      } else {
        console.log(`  ❌ 并发 ${test.concurrency}: ${test.error}`);
      }
    });
  });

  // 性能评估
  console.log('\n' + '='.repeat(60));
  console.log('🎯 性能评估');
  console.log('='.repeat(60) + '\n');

  const avgResponseTime = results
    .filter(r => r.success && r.timePerRequest)
    .reduce((sum, r) => sum + r.timePerRequest, 0) / results.filter(r => r.success).length;

  const maxResponseTime = Math.max(...results.filter(r => r.success && r.timePerRequest).map(r => r.timePerRequest));

  console.log(`平均响应时间: ${avgResponseTime.toFixed(2)} ms`);
  console.log(`最大响应时间: ${maxResponseTime.toFixed(2)} ms`);
  
  if (avgResponseTime < 500) {
    console.log('✅ 性能优秀（P95 < 500ms）');
  } else if (avgResponseTime < 1000) {
    console.log('⚠️ 性能良好（P95 < 1000ms）');
  } else {
    console.log('❌ 性能需要优化（P95 > 1000ms）');
  }

  // 保存详细报告
  const reportPath = path.join(__dirname, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    results,
    summary: {
      avgResponseTime,
      maxResponseTime,
      totalTests: results.length,
      successTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length
    }
  }, null, 2));

  console.log(`\n📄 详细报告已保存: ${reportPath}\n`);
}

// 检查 ab 命令是否可用
function checkAbAvailable() {
  return new Promise((resolve) => {
    const ab = spawn('ab', ['-V']);
    ab.on('close', (code) => {
      resolve(code === 0);
    });
    ab.on('error', () => {
      resolve(false);
    });
  });
}

// 主函数
async function main() {
  const abAvailable = await checkAbAvailable();
  
  if (!abAvailable) {
    console.log('❌ Apache Bench (ab) 未安装');
    console.log('\n安装方法:');
    console.log('  macOS: brew install ab');
    console.log('  Ubuntu: sudo apt-get install apache2-utils');
    console.log('  CentOS: sudo yum install httpd-tools');
    console.log('\n或使用 k6 进行性能测试:');
    console.log('  npm install -g k6');
    console.log('  k6 run scripts/k6-performance-test.js');
    process.exit(1);
  }

  await runPerformanceTests();
}

main().catch(console.error);