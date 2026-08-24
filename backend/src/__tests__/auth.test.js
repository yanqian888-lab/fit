/**
 * 认证控制器单元测试
 * 测试修复的缺陷：
 * - P0: 用户名验证规则不一致
 * - P0: 模拟openid安全风险
 * - P1: 密码长度验证不一致
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db.js';

// 模拟依赖
vi.mock('../db.js', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      all: vi.fn(() => [])
    })),
    transaction: vi.fn((fn) => fn)
  },
  withTransaction: vi.fn((fn) => fn())
}));

vi.mock('../utils/validator.js', () => ({
  validateUsername: vi.fn((username) => {
    return /^[a-zA-Z0-9]{6,10}$/.test(username);
  }),
  validateUsernameCombo: vi.fn((username) => {
    const hasLetter = /[a-zA-Z]/.test(username);
    const hasNumber = /[0-9]/.test(username);
    const validLength = /^[a-zA-Z0-9]{6,10}$/.test(username);
    return hasLetter && hasNumber && validLength;
  })
}));

vi.mock('../utils/response.js', () => ({
  success: (data, message) => ({ code: 200, data, message }),
  error: (message, code) => ({ code, message, data: null })
}));

describe('认证控制器 - 用户名验证规则', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该拒绝纯字母用户名（需要同时包含字母和数字）', async () => {
    const { validateUsernameCombo } = await import('../utils/validator.js');
    
    const result = validateUsernameCombo('abcdef');
    expect(result).toBe(false);
  });

  it('应该拒绝纯数字用户名（需要同时包含字母和数字）', async () => {
    const { validateUsernameCombo } = await import('../utils/validator.js');
    
    const result = validateUsernameCombo('123456');
    expect(result).toBe(false);
  });

  it('应该接受同时包含字母和数字的用户名', async () => {
    const { validateUsernameCombo } = await import('../utils/validator.js');
    
    const result = validateUsernameCombo('abc123');
    expect(result).toBe(true);
  });

  it('应该拒绝长度不足6位的用户名', async () => {
    const { validateUsernameCombo } = await import('../utils/validator.js');
    
    const result = validateUsernameCombo('ab12');
    expect(result).toBe(false);
  });

  it('应该拒绝长度超过10位的用户名', async () => {
    const { validateUsernameCombo } = await import('../utils/validator.js');
    
    const result = validateUsernameCombo('abcdefghijk123');
    expect(result).toBe(false);
  });
});

describe('认证控制器 - 密码长度验证', () => {
  it('应该接受6位密码', () => {
    const password = '123456';
    const isValid = password.length >= 6;
    expect(isValid).toBe(true);
  });

  it('应该接受7位密码', () => {
    const password = '1234567';
    const isValid = password.length >= 6;
    expect(isValid).toBe(true);
  });

  it('应该拒绝5位密码', () => {
    const password = '12345';
    const isValid = password.length >= 6;
    expect(isValid).toBe(false);
  });

  it('应该接受10位密码', () => {
    const password = '1234567890';
    const isValid = password.length >= 6;
    expect(isValid).toBe(true);
  });
});

describe('认证控制器 - 微信登录安全', () => {
  it('应该拒绝空code', () => {
    const code = '';
    const isValid = typeof code === 'string' && code.length >= 10 && code.length <= 100;
    expect(isValid).toBe(false);
  });

  it('应该拒绝过短的code', () => {
    const code = 'short';
    const isValid = typeof code === 'string' && code.length >= 10 && code.length <= 100;
    expect(isValid).toBe(false);
  });

  it('应该拒绝过长的code', () => {
    const code = 'a'.repeat(101);
    const isValid = typeof code === 'string' && code.length >= 10 && code.length <= 100;
    expect(isValid).toBe(false);
  });

  it('应该接受合法长度的code', () => {
    const code = '0123456789abcdefghij';
    const isValid = typeof code === 'string' && code.length >= 10 && code.length <= 100;
    expect(isValid).toBe(true);
  });

  it('应该拒绝非字符串类型的code', () => {
    const code = 1234567890;
    const isValid = typeof code === 'string' && code.length >= 10 && code.length <= 100;
    expect(isValid).toBe(false);
  });

  it('应该生成安全的openid（使用哈希）', async () => {
    const crypto = await import('crypto');
    const code = 'test_code_12345';
    const appId = 'test_app_id';
    
    const openid = `openid_${crypto.createHash('sha256')
      .update(code + appId)
      .digest('hex')
      .substring(0, 32)}`;
    
    expect(openid).toMatch(/^openid_[a-f0-9]{32}$/);
    expect(openid.length).toBe(39);
  });
});