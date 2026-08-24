/**
 * 综合用户场景测试脚本
 * 模拟不同类型用户的使用流程
 */

const http = require('http');
const { db } = require('./src/db');

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

class UserSimulator {
  constructor(userType) {
    this.userType = userType;
    this.userId = null;
    this.token = null;
    this.deviceId = this.generateDeviceId();
    this.testResults = [];
  }

  generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.userType}] ${message}`);
    this.testResults.push({ timestamp, userType: this.userType, message });
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
            resolve({ status: res.statusCode, data: result });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
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

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async simulateNewUser() {
    this.log('=== 开始模拟新用户流程 ===');
    
    try {
      this.log('1. 用户注册');
      const registerRes = await this.request('POST', `${API_URL}/auth/register`, {
        username: `test_${Date.now()}`,
        password: 'test123456',
        nickname: `测试用户_${this.userType}`
      });
      
      if (registerRes.status === 200 || registerRes.status === 201) {
        this.log('✅ 注册成功');
        this.token = registerRes.data.data?.token;
        this.userId = registerRes.data.data?.user?.id;
      } else {
        this.log('⚠️ 注册失败，尝试登录');
      }

      this.log('2. 获取试用配置');
      const configRes = await this.request('GET', `${API_URL}/trial/get-config`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (configRes.status === 200) {
        this.log('✅ 获取配置成功');
        this.log(`配置版本: ${configRes.data.data?._version || '无'}`);
      }

      this.log('3. 检查试用权限');
      const permissionRes = await this.request('POST', `${API_URL}/trial/check-permission`, {
        feature_type: 'ai_chat'
      }, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (permissionRes.status === 200) {
        this.log('✅ 权限检查成功');
        this.log(`AI聊天权限: ${permissionRes.data.data?.allowed ? '允许' : '不允许'}`);
      }

      this.log('4. 创建第一条记录');
      const recordRes = await this.request('POST', `${API_URL}/record`, {
        type: 'weight',
        value: 65.5,
        unit: 'kg',
        note: '新用户第一条记录'
      }, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (recordRes.status === 200 || recordRes.status === 201) {
        this.log('✅ 创建记录成功');
      }

      this.log('5. 使用AI聊天功能');
      const chatRes = await this.request('POST', `${API_URL}/ai/chat`, {
        message: '你好，我是新用户',
        context: {}
      }, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (chatRes.status === 200) {
        this.log('✅ AI聊天成功');
      } else {
        this.log(`⚠️ AI聊天失败: ${chatRes.data.message || '未知错误'}`);
      }

      this.log('=== 新用户流程测试完成 ===\n');
      
    } catch (error) {
      this.log(`❌ 测试失败: ${error.message}`);
    }
  }

  async simulateOldUser() {
    this.log('=== 开始模拟老用户流程 ===');
    
    try {
      this.log('1. 用户登录');
      const loginRes = await this.request('POST', `${API_URL}/auth/login`, {
        username: 'old_user_test',
        password: 'test123456'
      });
      
      if (loginRes.status === 200) {
        this.log('✅ 登录成功');
        this.token = loginRes.data.data?.token;
        this.userId = loginRes.data.data?.user?.id;
      } else {
        this.log('⚠️ 登录失败，创建新用户');
        await this.simulateNewUser();
        return;
      }

      this.log('2. 获取用户信息');
      const userRes = await this.request('GET', `${API_URL}/user/profile`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (userRes.status === 200) {
        this.log('✅ 获取用户信息成功');
      }

      this.log('3. 查看历史记录');
      const recordsRes = await this.request('GET', `${API_URL}/record/list`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (recordsRes.status === 200) {
        this.log('✅ 获取历史记录成功');
        this.log(`记录数量: ${recordsRes.data.data?.length || 0}`);
      }

      this.log('4. 检查试用使用情况');
      const usageRes = await this.request('GET', `${API_URL}/trial/usage`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (usageRes.status === 200) {
        this.log('✅ 获取使用情况成功');
      }

      this.log('5. 更新用户设置');
      const settingsRes = await this.request('PUT', `${API_URL}/user/settings`, {
        theme: 'dark',
        notifications: true
      }, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (settingsRes.status === 200) {
        this.log('✅ 更新设置成功');
      }

      this.log('=== 老用户流程测试完成 ===\n');
      
    } catch (error) {
      this.log(`❌ 测试失败: ${error.message}`);
    }
  }

  async simulateHeavyChatUser() {
    this.log('=== 开始模拟重度聊聊用户流程 ===');
    
    try {
      await this.simulateNewUser();
      
      this.log('开始高频使用AI聊天功能...');
      
      for (let i = 0; i < 10; i++) {
        this.log(`第 ${i + 1} 次AI聊天`);
        
        const chatRes = await this.request('POST', `${API_URL}/ai/chat`, {
          message: `测试消息 ${i + 1}`,
          context: { conversationId: `conv_${i}` }
        }, {
          'Authorization': `Bearer ${this.token}`
        });
        
        if (chatRes.status === 200) {
          this.log(`✅ 第 ${i + 1} 次聊天成功`);
        } else {
          this.log(`⚠️ 第 ${i + 1} 次聊天失败: ${chatRes.data.message}`);
        }
        
        await this.sleep(100);
      }

      this.log('检查试用次数使用情况');
      const usageRes = await this.request('GET', `${API_URL}/trial/usage`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (usageRes.status === 200) {
        this.log('✅ 获取使用情况成功');
        this.log(`AI聊天使用次数: ${usageRes.data.data?.ai_chat_count || 0}`);
      }

      this.log('=== 重度聊聊用户流程测试完成 ===\n');
      
    } catch (error) {
      this.log(`❌ 测试失败: ${error.message}`);
    }
  }

  async simulateHeavyDiaryUser() {
    this.log('=== 开始模拟重度搭搭用户流程 ===');
    
    try {
      await this.simulateNewUser();
      
      this.log('开始高频使用日记功能...');
      
      for (let i = 0; i < 10; i++) {
        this.log(`第 ${i + 1} 次创建日记`);
        
        const diaryRes = await this.request('POST', `${API_URL}/diary`, {
          title: `日记 ${i + 1}`,
          content: `这是第 ${i + 1} 篇日记内容`,
          mood: 'happy',
          tags: ['test', 'diary']
        }, {
          'Authorization': `Bearer ${this.token}`
        });
        
        if (diaryRes.status === 200 || diaryRes.status === 201) {
          this.log(`✅ 第 ${i + 1} 篇日记创建成功`);
        } else {
          this.log(`⚠️ 第 ${i + 1} 篇日记创建失败`);
        }
        
        await this.sleep(100);
      }

      this.log('检查日记列表');
      const listRes = await this.request('GET', `${API_URL}/diary/list`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (listRes.status === 200) {
        this.log('✅ 获取日记列表成功');
        this.log(`日记数量: ${listRes.data.data?.length || 0}`);
      }

      this.log('=== 重度搭搭用户流程测试完成 ===\n');
      
    } catch (error) {
      this.log(`❌ 测试失败: ${error.message}`);
    }
  }

  async simulateHeavyManualRecordUser() {
    this.log('=== 开始模拟重度手动记录用户流程 ===');
    
    try {
      await this.simulateNewUser();
      
      this.log('开始高频手动记录...');
      
      const recordTypes = ['weight', 'calories', 'exercise', 'water', 'sleep'];
      
      for (let i = 0; i < 20; i++) {
        const type = recordTypes[i % recordTypes.length];
        this.log(`第 ${i + 1} 次记录: ${type}`);
        
        const recordRes = await this.request('POST', `${API_URL}/record`, {
          type,
          value: Math.random() * 100,
          unit: type === 'weight' ? 'kg' : type === 'calories' ? 'kcal' : 'count',
          note: `手动记录 ${i + 1}`
        }, {
          'Authorization': `Bearer ${this.token}`
        });
        
        if (recordRes.status === 200 || recordRes.status === 201) {
          this.log(`✅ 第 ${i + 1} 次记录成功`);
        } else {
          this.log(`⚠️ 第 ${i + 1} 次记录失败`);
        }
        
        await this.sleep(50);
      }

      this.log('查看统计信息');
      const statsRes = await this.request('GET', `${API_URL}/record/stats`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (statsRes.status === 200) {
        this.log('✅ 获取统计信息成功');
      }

      this.log('导出记录');
      const exportRes = await this.request('GET', `${API_URL}/record/export`, null, {
        'Authorization': `Bearer ${this.token}`
      });
      
      if (exportRes.status === 200) {
        this.log('✅ 导出记录成功');
      }

      this.log('=== 重度手动记录用户流程测试完成 ===\n');
      
    } catch (error) {
      this.log(`❌ 测试失败: ${error.message}`);
    }
  }

  getTestResults() {
    return this.testResults;
  }
}

async function runComprehensiveTests() {
  console.log('========================================');
  console.log('  开始综合用户场景测试');
  console.log('========================================\n');

  const testResults = {
    startTime: new Date().toISOString(),
    scenarios: []
  };

  try {
    console.log('测试1: 新用户流程');
    const newUser = new UserSimulator('新用户');
    await newUser.simulateNewUser();
    testResults.scenarios.push({
      userType: '新用户',
      results: newUser.getTestResults()
    });

    await sleep(1000);

    console.log('\n测试2: 老用户流程');
    const oldUser = new UserSimulator('老用户');
    await oldUser.simulateOldUser();
    testResults.scenarios.push({
      userType: '老用户',
      results: oldUser.getTestResults()
    });

    await sleep(1000);

    console.log('\n测试3: 重度聊聊用户流程');
    const heavyChatUser = new UserSimulator('重度聊聊用户');
    await heavyChatUser.simulateHeavyChatUser();
    testResults.scenarios.push({
      userType: '重度聊聊用户',
      results: heavyChatUser.getTestResults()
    });

    await sleep(1000);

    console.log('\n测试4: 重度搭搭用户流程');
    const heavyDiaryUser = new UserSimulator('重度搭搭用户');
    await heavyDiaryUser.simulateHeavyDiaryUser();
    testResults.scenarios.push({
      userType: '重度搭搭用户',
      results: heavyDiaryUser.getTestResults()
    });

    await sleep(1000);

    console.log('\n测试5: 重度手动记录用户流程');
    const heavyRecordUser = new UserSimulator('重度手动记录用户');
    await heavyRecordUser.simulateHeavyManualRecordUser();
    testResults.scenarios.push({
      userType: '重度手动记录用户',
      results: heavyRecordUser.getTestResults()
    });

  } catch (error) {
    console.error('测试执行失败:', error);
  }

  testResults.endTime = new Date().toISOString();
  
  console.log('\n========================================');
  console.log('  测试完成');
  console.log('========================================');
  
  return testResults;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    const results = await runComprehensiveTests();
    
    console.log('\n📊 测试结果汇总:');
    console.log(`开始时间: ${results.startTime}`);
    console.log(`结束时间: ${results.endTime}`);
    console.log(`测试场景数: ${results.scenarios.length}`);
    
    results.scenarios.forEach(scenario => {
      console.log(`\n${scenario.userType}:`);
      const successCount = scenario.results.filter(r => r.message.includes('✅')).length;
      const failCount = scenario.results.filter(r => r.message.includes('❌')).length;
      const warnCount = scenario.results.filter(r => r.message.includes('⚠️')).length;
      console.log(`  成功: ${successCount}, 失败: ${failCount}, 警告: ${warnCount}`);
    });
    
  } catch (error) {
    console.error('主测试流程失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  UserSimulator,
  runComprehensiveTests
};