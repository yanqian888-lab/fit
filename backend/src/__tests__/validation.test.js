/**
 * 输入验证单元测试
 * 校验规则与 recordController.saveDiet / authController.register 保持一致：
 * - 食物名称按字节长度限制（200 字节，中文每字 3 字节）
 * - 单次记录食物数量上限 50 项
 * - 食物重量 0-10000g、热量 0-5000kcal
 * - 用户名需 6-10 位且同时包含字母和数字
 */
import { describe, it, expect } from 'vitest';

// 与 recordController.saveDiet 一致的字节长度校验
const NAME_MAX_BYTES = 200;
function isFoodNameValid(name) {
  if (!name || typeof name !== 'string') return false;
  return Buffer.byteLength(name, 'utf8') <= NAME_MAX_BYTES;
}

describe('输入验证 - 食物名称', () => {
  it('应该使用字节长度而非字符长度', () => {
    // 67 个中文字符 = 201 字节，字符数未超但字节数超限，应拒绝
    const name67 = '红烧肉'.repeat(22) + '红';
    expect(name67.length).toBe(67);
    expect(Buffer.byteLength(name67, 'utf8')).toBe(201);
    expect(isFoodNameValid(name67)).toBe(false);
  });

  it('应该接受合法长度的中文名称', () => {
    expect(isFoodNameValid('红烧肉')).toBe(true);
    expect(isFoodNameValid('')).toBe(false);
    expect(isFoodNameValid(null)).toBe(false);
    expect(isFoodNameValid(123)).toBe(false);
  });

  it('应该拒绝超长的中文名称', () => {
    const longName = '红烧肉'.repeat(100); // 300 字 = 900 字节
    expect(isFoodNameValid(longName)).toBe(false);
  });
});

describe('输入验证 - 食物数值范围', () => {
  // 与 recordController.saveDiet 一致
  const isWeightValid = (w) => !isNaN(parseFloat(w)) && parseFloat(w) >= 0 && parseFloat(w) <= 10000;
  const isCalorieValid = (c) => !isNaN(parseFloat(c)) && parseFloat(c) >= 0 && parseFloat(c) <= 5000;

  it('重量 0-10000g', () => {
    expect(isWeightValid(0)).toBe(true);
    expect(isWeightValid(10000)).toBe(true);
    expect(isWeightValid(-1)).toBe(false);
    expect(isWeightValid(10001)).toBe(false);
    expect(isWeightValid('abc')).toBe(false);
  });

  it('热量 0-5000kcal', () => {
    expect(isCalorieValid(0)).toBe(true);
    expect(isCalorieValid(5000)).toBe(true);
    expect(isCalorieValid(-1)).toBe(false);
    expect(isCalorieValid(5001)).toBe(false);
  });
});

describe('输入验证 - 用户名规则', () => {
  const USERNAME_REGEX = /^[a-zA-Z0-9]{6,10}$/;
  const isCombo = (u) => USERNAME_REGEX.test(u) && /[a-zA-Z]/.test(u) && /[0-9]/.test(u);

  it('拒绝纯字母/纯数字/过短/过长', () => {
    expect(isCombo('abcdef')).toBe(false);
    expect(isCombo('123456')).toBe(false);
    expect(isCombo('ab1')).toBe(false);
    expect(isCombo('abcdefgh12345')).toBe(false);
  });

  it('接受字母+数字组合', () => {
    expect(isCombo('abc123')).toBe(true);
    expect(isCombo('zhanghao11')).toBe(true);
  });
});
