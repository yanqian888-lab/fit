// k6 性能测试脚本
// 用法: k6 run scripts/k6-performance-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// 测试配置
export let options = {
  stages: [
    { duration: '30s', target: 10 },  // 30秒内增加到10个虚拟用户
    { duration: '1m', target: 50 },   // 1分钟内增加到50个虚拟用户
    { duration: '1m', target: 100 },  // 1分钟内增加到100个虚拟用户
    { duration: '30s', target: 0 },   // 30秒内降到0个虚拟用户
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%的请求响应时间小于500ms
    errors: ['rate<0.1'],              // 错误率小于10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// 测试数据
const testUsers = [
  { phone: '13800000001', password: 'test123abc' },
  { phone: '13800000002', password: 'test123abc' },
  { phone: '13800000003', password: 'test123abc' },
];

export default function () {
  // 1. 健康检查
  let healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    '健康检查状态码为200': (r) => r.status === 200,
    '健康检查响应时间<200ms': (r) => r.timings.duration < 200,
  });
  
  errorRate.add(healthRes.status !== 200);
  responseTime.add(healthRes.timings.duration);

  sleep(1);

  // 2. 用户登录
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  let loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    phone: user.phone,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    '登录状态码为200': (r) => r.status === 200,
    '登录返回token': (r) => r.json('data.token') !== undefined,
  });

  errorRate.add(loginRes.status !== 200);
  responseTime.add(loginRes.timings.duration);

  if (loginRes.status !== 200) {
    return;
  }

  const token = loginRes.json('data.token');
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  sleep(1);

  // 3. 获取用户信息
  let userRes = http.get(`${BASE_URL}/api/users/me`, authHeaders);
  check(userRes, {
    '获取用户信息状态码为200': (r) => r.status === 200,
    '用户信息响应时间<300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(userRes.status !== 200);
  responseTime.add(userRes.timings.duration);

  sleep(1);

  // 4. 获取今日数据
  let todayRes = http.get(`${BASE_URL}/api/records/today`, authHeaders);
  check(todayRes, {
    '获取今日数据状态码为200': (r) => r.status === 200,
    '今日数据响应时间<500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(todayRes.status !== 200);
  responseTime.add(todayRes.timings.duration);

  sleep(1);

  // 5. 获取博物馆概览
  let museumRes = http.get(`${BASE_URL}/api/museum/overview`, authHeaders);
  check(museumRes, {
    '博物馆概览状态码为200': (r) => r.status === 200,
    '博物馆概览响应时间<500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(museumRes.status !== 200);
  responseTime.add(museumRes.timings.duration);

  sleep(1);

  // 6. 获取宠物状态
  let petRes = http.get(`${BASE_URL}/api/pet`, authHeaders);
  check(petRes, {
    '宠物状态状态码为200': (r) => r.status === 200,
    '宠物状态响应时间<300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(petRes.status !== 200);
  responseTime.add(petRes.timings.duration);

  sleep(1);

  // 7. 发送聊天消息
  let chatRes = http.post(`${BASE_URL}/api/chat/send`, JSON.stringify({
    message: '测试消息',
  }), authHeaders);
  
  check(chatRes, {
    '发送消息状态码为200': (r) => r.status === 200,
    '发送消息响应时间<1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(chatRes.status !== 200);
  responseTime.add(chatRes.timings.duration);

  sleep(2);

  // 8. 记录饮食
  let dietRes = http.post(`${BASE_URL}/api/records/diet`, JSON.stringify({
    meal_time: 'lunch',
    foods: [{ name: '测试食物', weight: 100, calorie: 200 }],
    total_calorie: 200,
    record_date: new Date().toISOString().split('T')[0],
  }), authHeaders);

  check(dietRes, {
    '记录饮食状态码为200': (r) => r.status === 200,
    '记录饮食响应时间<500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(dietRes.status !== 200);
  responseTime.add(dietRes.timings.duration);

  sleep(1);

  // 9. 记录运动
  let exerciseRes = http.post(`${BASE_URL}/api/records/exercise`, JSON.stringify({
    exercises: [{ name: '跑步', duration: 30, calorie: 300 }],
    total_duration: 30,
    total_calorie: 300,
    record_date: new Date().toISOString().split('T')[0],
  }), authHeaders);

  check(exerciseRes, {
    '记录运动状态码为200': (r) => r.status === 200,
    '记录运动响应时间<500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(exerciseRes.status !== 200);
  responseTime.add(exerciseRes.timings.duration);

  sleep(1);

  // 10. 博物馆添加内容
  let museumItemRes = http.post(`${BASE_URL}/api/museum/items`, JSON.stringify({
    type: 'quote',
    content: '测试金句',
  }), authHeaders);

  check(museumItemRes, {
    '添加博物馆内容状态码为200': (r) => r.status === 200,
    '添加内容响应时间<500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(museumItemRes.status !== 200);
  responseTime.add(museumItemRes.timings.duration);

  sleep(2);
}

// 测试结束后的清理
export function teardown(data) {
  console.log('性能测试完成');
}