/**
 * 端到端测试 - 核心业务流程
 * 使用 Playwright 进行自动化测试
 * 
 * 用法：
 *   npx playwright test e2e/core-flows.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('核心业务流程测试', () => {
  
  test.beforeEach(async ({ page }) => {
    // 设置超时时间
    test.setTimeout(60000);
  });

  test('E2E-001: 新用户注册完整流程', async ({ page }) => {
    // 1. 访问首页
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/减肥搭子/);
    
    // 2. 点击注册按钮
    await page.click('text=注册');
    
    // 3. 填写注册信息
    const phone = '138' + Math.random().toString().slice(2, 11);
    await page.fill('input[placeholder="请输入手机号"]', phone);
    await page.fill('input[placeholder="请输入密码"]', 'test123abc');
    await page.fill('input[placeholder="请确认密码"]', 'test123abc');
    
    // 4. 提交注册
    await page.click('button:has-text("注册")');
    
    // 5. 验证注册成功
    await expect(page.locator('.toast')).toContainText('注册成功');
    
    // 6. 验证跳转到首页
    await page.waitForURL('**/pages/index/index');
    await expect(page.locator('.message-list')).toBeVisible();
  });

  test('E2E-010: 聊天自动记录饮食', async ({ page }) => {
    // 1. 登录
    await page.goto(BASE_URL + '/pages/login/index');
    await page.fill('input[placeholder="请输入手机号"]', '13800000001');
    await page.fill('input[placeholder="请输入密码"]', 'test123abc');
    await page.click('button:has-text("登录")');
    
    // 2. 等待进入首页
    await page.waitForURL('**/pages/index/index');
    
    // 3. 发送消息
    const messageInput = page.locator('.message-input');
    await messageInput.fill('中午吃了碗牛肉面');
    await page.click('button:has-text("发送")');
    
    // 4. 等待 AI 回复
    await page.waitForSelector('.message-row.partner', { timeout: 10000 });
    
    // 5. 验证沉淀卡片出现
    await expect(page.locator('.pending-card')).toBeVisible();
    
    // 6. 点击确认
    await page.click('.pending-card button:has-text("确认")');
    
    // 7. 验证记录成功
    await expect(page.locator('.record-tag')).toContainText('已记录');
    
    // 8. 进入工具箱查看
    await page.click('.tab-item:has-text("工具箱")');
    await expect(page.locator('.intake-card')).toBeVisible();
  });

  test('E2E-030: 宠物喂食完整流程', async ({ page }) => {
    // 1. 登录并进入陪伴页
    await page.goto(BASE_URL + '/pages/login/index');
    await page.fill('input[placeholder="请输入手机号"]', '13800000002');
    await page.fill('input[placeholder="请输入密码"]', 'test123abc');
    await page.click('button:has-text("登录")');
    
    await page.waitForURL('**/pages/index/index');
    await page.click('.tab-item:has-text("陪伴")');
    
    // 2. 查看宠物状态
    await expect(page.locator('.pet-image')).toBeVisible();
    const initialSatiety = await page.locator('.status-value').first().textContent();
    
    // 3. 点击喂食
    await page.click('.action-ring:has-text("喂食")');
    
    // 4. 如果背包无食物，跳转商城
    const hasNoFood = await page.locator('.empty-backpack').isVisible();
    if (hasNoFood) {
      await page.click('button:has-text("去商城")');
      
      // 购买食物
      await page.click('.shop-item:has-text("狗粮") button:has-text("购买")');
      await page.click('button:has-text("确认购买")');
      
      // 返回陪伴页
      await page.goBack();
      await page.goBack();
      
      // 再次点击喂食
      await page.click('.action-ring:has-text("喂食")');
    }
    
    // 5. 选择食物喂食
    await page.click('.inventory-item:first-child button:has-text("使用")');
    
    // 6. 验证饱食度上升
    await page.waitForTimeout(1000);
    const finalSatiety = await page.locator('.status-value').first().textContent();
    expect(parseInt(finalSatiety)).toBeGreaterThan(parseInt(initialSatiety));
  });

  test('E2E-040: 博物馆内容管理', async ({ page }) => {
    // 1. 登录并进入博物馆
    await page.goto(BASE_URL + '/pages/login/index');
    await page.fill('input[placeholder="请输入手机号"]', '13800000003');
    await page.fill('input[placeholder="请输入密码"]', 'test123abc');
    await page.click('button:has-text("登录")');
    
    await page.waitForURL('**/pages/index/index');
    await page.click('.tab-item:has-text("博物馆")');
    
    // 2. 添加金句
    await page.click('button:has-text("添加内容")');
    await page.click('text=金句');
    await page.fill('textarea[placeholder="输入金句内容"]', '坚持就是胜利');
    await page.click('button:has-text("保存")');
    
    // 3. 验证添加成功
    await expect(page.locator('.museum-item')).toContainText('坚持就是胜利');
    
    // 4. 编辑金句
    await page.click('.museum-item:has-text("坚持就是胜利") .edit-btn');
    await page.fill('textarea', '自律给我自由');
    await page.click('button:has-text("保存")');
    
    // 5. 验证编辑成功
    await expect(page.locator('.museum-item')).toContainText('自律给我自由');
    
    // 6. 删除金句
    await page.click('.museum-item:has-text("自律给我自由") .delete-btn');
    await page.click('button:has-text("确认删除")');
    
    // 7. 验证删除成功
    await expect(page.locator('.museum-item:has-text("自律给我自由")')).not.toBeVisible();
  });

  test('E2E-050: AI 对话试用权限', async ({ page }) => {
    // 1. 新用户登录
    const phone = '139' + Math.random().toString().slice(2, 11);
    await page.goto(BASE_URL + '/pages/register/index');
    await page.fill('input[placeholder="请输入手机号"]', phone);
    await page.fill('input[placeholder="请输入密码"]', 'test123abc');
    await page.fill('input[placeholder="请确认密码"]', 'test123abc');
    await page.click('button:has-text("注册")');
    
    await page.waitForURL('**/pages/index/index');
    
    // 2. 发送 30 条消息（试用限制）
    for (let i = 0; i < 30; i++) {
      await page.fill('.message-input', `测试消息 ${i + 1}`);
      await page.click('button:has-text("发送")');
      await page.waitForTimeout(500);
    }
    
    // 3. 第 31 条消息触发弹窗
    await page.fill('.message-input', '第31条消息');
    await page.click('button:has-text("发送")');
    
    // 4. 验证弹窗出现
    await expect(page.locator('.trial-popup')).toBeVisible();
    await expect(page.locator('.trial-popup')).toContainText('试用次数已用完');
    
    // 5. 点击复制客服微信
    await page.click('button:has-text("复制客服微信")');
    await expect(page.locator('.toast')).toContainText('已复制');
  });

  test('E2E-060: 数据导出', async ({ page }) => {
    // 1. 登录
    await page.goto(BASE_URL + '/pages/login/index');
    await page.fill('input[placeholder="请输入手机号"]', '13800000004');
    await page.fill('input[placeholder="请输入密码"]', 'test123abc');
    await page.click('button:has-text("登录")');
    
    // 2. 进入我的页面
    await page.click('.tab-item:has-text("我的")');
    
    // 3. 点击数据管理
    await page.click('text=数据管理');
    
    // 4. 点击导出数据
    await page.click('button:has-text("导出数据")');
    
    // 5. 等待下载
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("确认导出")')
    ]);
    
    // 6. 验证下载文件
    expect(download.suggestedFilename()).toContain('用户数据');
    
    // 7. 验证文件内容
    const path = await download.path();
    const fs = require('fs');
    const content = fs.readFileSync(path, 'utf-8');
    const data = JSON.parse(content);
    
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('diet_records');
    expect(data).toHaveProperty('exercise_records');
  });
});

test.describe('性能测试', () => {
  
  test('PERF-001: 首页加载性能', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(BASE_URL + '/pages/index/index');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // 验证首屏加载时间 < 3秒
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`首页加载时间: ${loadTime}ms`);
  });

  test('PERF-002: 消息发送响应时间', async ({ page }) => {
    await page.goto(BASE_URL + '/pages/login/index');
    await page.fill('input[placeholder="请输入手机号"]', '13800000005');
    await page.fill('input[placeholder="请输入密码"]', 'test123abc');
    await page.click('button:has-text("登录")');
    
    await page.waitForURL('**/pages/index/index');
    
    const startTime = Date.now();
    await page.fill('.message-input', '测试消息');
    await page.click('button:has-text("发送")');
    await page.waitForSelector('.message-row.partner');
    
    const responseTime = Date.now() - startTime;
    
    // 验证响应时间 < 2秒
    expect(responseTime).toBeLessThan(2000);
    
    console.log(`消息响应时间: ${responseTime}ms`);
  });
});

test.describe('兼容性测试', () => {
  
  test('COMP-001: iOS 设备适配', async ({ page, browserName }) => {
    // 设置 iOS 视口
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto(BASE_URL);
    
    // 验证布局正常
    await expect(page.locator('.tab-bar')).toBeVisible();
    await expect(page.locator('.status-bar')).toBeVisible();
  });

  test('COMP-002: Android 设备适配', async ({ page }) => {
    // 设置 Android 视口
    await page.setViewportSize({ width: 360, height: 640 });
    
    await page.goto(BASE_URL);
    
    // 验证布局正常
    await expect(page.locator('.tab-bar')).toBeVisible();
  });
});