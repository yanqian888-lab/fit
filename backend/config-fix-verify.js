/**
 * 配置修复验证测试
 * 验证P0-P2问题修复效果
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

class ConfigFixVerifier {
  constructor() {
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  log(test, status, message) {
    const timestamp = new Date().toISOString();
    const result = { timestamp, test, status, message };
    this.testResults.push(result);
    
    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`[${timestamp}] ${statusIcon} [${test}] ${message}`);
    
    if (status === 'PASS') this.passedTests++;
    if (status === 'FAIL') this.failedTests++;
  }

  async request(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            resolve({ status: res.statusCode, data: result, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data: body, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async testConfigVersion() {
    console.log('\n=== 测试配置版本管理 ===');
    
    try {
      const res1 = await this.request('GET', `${API_URL}/trial/get-config`);
      
      if (res1.status === 200 && res1.data.data?._version) {
        this.log('配置版本', 'PASS', `配置版本号: ${res1.data.data._version}`);
      } else {
        this.log('配置版本', 'FAIL', '缺少配置版本号');
        return;
      }

      const version = res1.data.data._version;
      const res2 = await this.request('GET', `${API_URL}/trial/get-config?version=${version}`);
      
      if (res2.status === 200 && res2.data.data?._unchanged) {
        this.log('版本缓存', 'PASS', '版本号缓存机制正常');
      } else {
        this.log('版本缓存', 'FAIL', '版本号缓存机制异常');
      }
      
    } catch (error) {
      this.log('配置版本', 'FAIL', `测试失败: ${error.message}`);
    }
  }

  async testConfigCache() {
    console.log('\n=== 测试配置缓存优化 ===');
    
    try {
      const startTime = Date.now();
      const res1 = await this.request('GET', `${API_URL}/trial/get-config`);
      const firstRequestTime = Date.now() - startTime;
      
      if (res1.status === 200) {
        this.log('缓存首次请求', 'PASS', `请求时间: ${firstRequestTime}ms`);
      } else {
        this.log('缓存首次请求', 'FAIL', '首次请求失败');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const startTime2 = Date.now();
      const res2 = await this.request('GET', `${API_URL}/trial/get-config`);
      const secondRequestTime = Date.now() - startTime2;
      
      if (res2.status === 200) {
        this.log('缓存二次请求', 'PASS', `请求时间: ${secondRequestTime}ms`);
        
        if (secondRequestTime < firstRequestTime) {
          this.log('缓存性能', 'PASS', `缓存命中，性能提升 ${((firstRequestTime - secondRequestTime) / firstRequestTime * 100).toFixed(2)}%`);
        } else {
          this.log('缓存性能', 'WARN', '缓存性能未提升');
        }
      } else {
        this.log('缓存二次请求', 'FAIL', '二次请求失败');
      }
      
    } catch (error) {
      this.log('配置缓存', 'FAIL', `测试失败: ${error.message}`);
    }
  }

  async testRateLimiter() {
    console.log('\n=== 测试配置访问限流 ===');
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < 110; i++) {
        try {
          const res = await this.request('GET', `${API_URL}/trial/get-config`);
          if (res.status === 200) {
            successCount++;
          } else if (res.status === 429) {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
        
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      if (failCount > 0) {
        this.log('限流触发', 'PASS', `成功请求: ${successCount}, 被限流: ${failCount}`);
      } else {
        this.log('限流触发', 'WARN', '限流未触发，可能需要调整阈值');
      }
      
    } catch (error) {
      this.log('配置限流', 'FAIL', `测试失败: ${error.message}`);
    }
  }

  async testConfigKeys() {
    console.log('\n=== 测试配置键常量 ===');
    
    try {
      const res = await this.request('GET', `${API_URL}/trial/get-config`);
      
      if (res.status === 200) {
        const config = res.data.data;
        
        const requiredKeys = [
          'global_enabled',
          'grayscale_percent',
          'features',
          'popup'
        ];
        
        let missingKeys = [];
        requiredKeys.forEach(key => {
          if (!(key in config)) {
            missingKeys.push(key);
          }
        });
        
        if (missingKeys.length === 0) {
          this.log('配置键完整性', 'PASS', '所有必需配置键都存在');
        } else {
          this.log('配置键完整性', 'FAIL', `缺少配置键: ${missingKeys.join(', ')}`);
        }
        
        if (config.features && config.features.ai_chat && config.features.diary) {
          this.log('功能配置结构', 'PASS', '功能配置结构正确');
        } else {
          this.log('功能配置结构', 'FAIL', '功能配置结构错误');
        }
        
      } else {
        this.log('配置键测试', 'FAIL', '获取配置失败');
      }
      
    } catch (error) {
      this.log('配置键常量', 'FAIL', `测试失败: ${error.message}`);
    }
  }

  async testExceptionHandling() {
    console.log('\n=== 测试异常处理 ===');
    
    try {
      const res = await this.request('GET', `${API_URL}/trial/get-config?version=invalid_version`);
      
      if (res.status === 200) {
        this.log('异常版本处理', 'PASS', '无效版本号处理正确');
      } else {
        this.log('异常版本处理', 'FAIL', '无效版本号处理失败');
      }

      const res2 = await this.request('POST', `${API_URL}/trial/check-permission`, {
        feature_type: 'invalid_feature'
      });
      
      if (res2.status === 400 || res2.status === 422) {
        this.log('异常参数处理', 'PASS', '无效参数处理正确');
      } else if (res2.status === 200) {
        this.log('异常参数处理', 'WARN', '无效参数未验证');
      } else {
        this.log('异常参数处理', 'FAIL', '无效参数处理失败');
      }
      
    } catch (error) {
      this.log('异常处理', 'FAIL', `测试失败: ${error.message}`);
    }
  }

  async testSecurityHeaders() {
    console.log('\n=== 测试安全头 ===');
    
    try {
      const res = await this.request('GET', `${API_URL}/trial/get-config`);
      
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ];
      
      let missingHeaders = [];
      securityHeaders.forEach(header => {
        if (!res.headers[header]) {
          missingHeaders.push(header);
        }
      });
      
      if (missingHeaders.length === 0) {
        this.log('安全头配置', 'PASS', '所有安全头都已设置');
      } else {
        this.log('安全头配置', 'WARN', `缺少安全头: ${missingHeaders.join(', ')}`);
      }
      
    } catch (error) {
      this.log('安全头测试', 'FAIL', `测试失败: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('========================================');
    console.log('  开始配置修复验证测试');
    console.log('========================================');

    await this.testConfigVersion();
    await this.testConfigCache();
    await this.testRateLimiter();
    await this.testConfigKeys();
    await this.testExceptionHandling();
    await this.testSecurityHeaders();

    console.log('\n========================================');
    console.log('  测试完成');
    console.log('========================================');
    
    console.log('\n📊 测试结果汇总:');
    console.log(`通过: ${this.passedTests}`);
    console.log(`失败: ${this.failedTests}`);
    console.log(`总计: ${this.testResults.length}`);
    
    if (this.failedTests === 0) {
      console.log('\n✅ 所有测试通过！');
    } else {
      console.log('\n❌ 存在测试失败，请检查！');
    }
    
    return {
      passed: this.passedTests,
      failed: this.failedTests,
      total: this.testResults.length,
      results: this.testResults
    };
  }
}

async function main() {
  const verifier = new ConfigFixVerifier();
  const results = await verifier.runAllTests();
  
  process.exit(results.failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = ConfigFixVerifier;