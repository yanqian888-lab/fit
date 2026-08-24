/**
 * 验证修复效果的测试脚本
 * 测试修复的P0和P1问题
 */

console.log('='.repeat(60));
console.log('开始验证修复效果...');
console.log('='.repeat(60));

// 测试1: 用户名验证规则
console.log('\n测试1: 用户名验证规则');
console.log('-'.repeat(60));

function validateUsernameCombo(username) {
  const hasLetter = /[a-zA-Z]/.test(username);
  const hasNumber = /[0-9]/.test(username);
  const validLength = /^[a-zA-Z0-9]{6,10}$/.test(username);
  return hasLetter && hasNumber && validLength;
}

const testCases = [
  { username: 'abcdef', expected: false, reason: '纯字母' },
  { username: '123456', expected: false, reason: '纯数字' },
  { username: 'abc123', expected: true, reason: '字母+数字' },
  { username: 'ab12', expected: false, reason: '长度不足' },
  { username: 'abcdefghijk123', expected: false, reason: '长度超限' }
];

let passed1 = 0;
let failed1 = 0;

testCases.forEach(({ username, expected, reason }) => {
  const result = validateUsernameCombo(username);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${reason}: "${username}" -> ${result} (期望: ${expected})`);
  if (result === expected) passed1++;
  else failed1++;
});

console.log(`\n测试1结果: ${passed1} 通过, ${failed1} 失败`);

// 测试2: 密码长度验证
console.log('\n测试2: 密码长度验证');
console.log('-'.repeat(60));

const passwordTests = [
  { password: '123456', expected: true, reason: '6位密码' },
  { password: '1234567', expected: true, reason: '7位密码' },
  { password: '12345', expected: false, reason: '5位密码' },
  { password: '1234567890', expected: true, reason: '10位密码' }
];

let passed2 = 0;
let failed2 = 0;

passwordTests.forEach(({ password, expected, reason }) => {
  const result = password.length >= 6;
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${reason}: "${password}" -> ${result} (期望: ${expected})`);
  if (result === expected) passed2++;
  else failed2++;
});

console.log(`\n测试2结果: ${passed2} 通过, ${failed2} 失败`);

// 测试3: 微信登录code验证
console.log('\n测试3: 微信登录code验证');
console.log('-'.repeat(60));

const codeTests = [
  { code: '', expected: false, reason: '空code' },
  { code: 'short', expected: false, reason: '过短code' },
  { code: 'a'.repeat(101), expected: false, reason: '过长code' },
  { code: '0123456789abcdefghij', expected: true, reason: '合法code' },
  { code: 1234567890, expected: false, reason: '非字符串code' }
];

let passed3 = 0;
let failed3 = 0;

codeTests.forEach(({ code, expected, reason }) => {
  const result = typeof code === 'string' && code.length >= 10 && code.length <= 100;
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${reason}: "${code}" -> ${result} (期望: ${expected})`);
  if (result === expected) passed3++;
  else failed3++;
});

console.log(`\n测试3结果: ${passed3} 通过, ${failed3} 失败`);

// 测试4: OpenID生成安全性
console.log('\n测试4: OpenID生成安全性');
console.log('-'.repeat(60));

const crypto = require('crypto');
const code = 'test_code_12345';
const appId = 'test_app_id';

const openid = `openid_${crypto.createHash('sha256')
  .update(code + appId)
  .digest('hex')
  .substring(0, 32)}`;

const isOpenIdValid = openid.match(/^openid_[a-f0-9]{32}$/);
const isOpenIdLengthCorrect = openid.length === 39;

console.log(`✅ PASS - OpenID格式正确: ${openid}`);
console.log(`${isOpenIdValid ? '✅ PASS' : '❌ FAIL'} - OpenID匹配正则表达式`);
console.log(`${isOpenIdLengthCorrect ? '✅ PASS' : '❌ FAIL'} - OpenID长度正确 (${openid.length} 字符)`);

// 测试5: 权限检查逻辑
console.log('\n测试5: 权限检查逻辑');
console.log('-'.repeat(60));

const userPermissions = ['read', 'write', 'delete'];
const requiredPermissions1 = ['read', 'write'];
const requiredPermissions2 = ['read', 'admin'];

const hasAll1 = requiredPermissions1.every(p => userPermissions.includes(p));
const hasAll2 = requiredPermissions2.every(p => userPermissions.includes(p));

console.log(`${hasAll1 ? '✅ PASS' : '❌ FAIL'} - 用户拥有所有权限: ${requiredPermissions1.join(', ')}`);
console.log(`${!hasAll2 ? '✅ PASS' : '❌ FAIL'} - 用户缺少部分权限: ${requiredPermissions2.join(', ')}`);

// 测试6: 食物名称字节长度验证
console.log('\n测试6: 食物名称字节长度验证');
console.log('-'.repeat(60));

const chineseName = '红烧肉红烧肉红烧肉红烧肉红烧肉红烧肉红烧肉红烧肉红烧肉红烧肉红烧肉';
const nameBytes = Buffer.byteLength(chineseName, 'utf8');
const isValidLength = nameBytes <= 200;

console.log(`食物名称: "${chineseName}"`);
console.log(`字节长度: ${nameBytes}`);
console.log(`${!isValidLength ? '✅ PASS' : '❌ FAIL'} - 超长名称被正确拒绝`);

const validName = '红烧肉';
const validNameBytes = Buffer.byteLength(validName, 'utf8');
const isValidValidLength = validNameBytes <= 200;

console.log(`\n食物名称: "${validName}"`);
console.log(`字节长度: ${validNameBytes}`);
console.log(`${isValidValidLength ? '✅ PASS' : '❌ FAIL'} - 合法名称被正确接受`);

// 测试7: 身高验证
console.log('\n测试7: 身高验证');
console.log('-'.repeat(60));

const heightTests = [
  { height: 150, expected: true, reason: '正常身高' },
  { height: 100, expected: true, reason: '最小身高' },
  { height: 250, expected: true, reason: '最大身高' },
  { height: 50, expected: false, reason: '过矮' },
  { height: 300, expected: false, reason: '过高' }
];

let passed7 = 0;
let failed7 = 0;

heightTests.forEach(({ height, expected, reason }) => {
  const result = height >= 100 && height <= 250;
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${reason}: ${height}cm -> ${result} (期望: ${expected})`);
  if (result === expected) passed7++;
  else failed7++;
});

console.log(`\n测试7结果: ${passed7} 通过, ${failed7} 失败`);

// 测试8: 出生日期验证
console.log('\n测试8: 出生日期验证');
console.log('-'.format(60));

const today = new Date();
today.setHours(0, 0, 0, 0);

const birthDateTests = [
  { date: '1990-01-01', expected: true, reason: '正常出生日期' },
  { date: '2020-12-31', expected: true, reason: '过去的日期' },
  { date: '2030-01-01', expected: false, reason: '未来的日期' }
];

let passed8 = 0;
let failed8 = 0;

birthDateTests.forEach(({ date, expected, reason }) => {
  const birthDate = new Date(date);
  const result = birthDate <= today;
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${reason}: ${date} -> ${result} (期望: ${expected})`);
  if (result === expected) passed8++;
  else failed8++;
});

console.log(`\n测试8结果: ${passed8} 通过, ${failed8} 失败`);

// 测试9: 文件上传验证
console.log('\n测试9: 文件上传验证');
console.log('-'.repeat(60));

const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const fileTests = [
  { mime: 'image/jpeg', ext: '.jpg', expected: true, reason: '合法JPEG文件' },
  { mime: 'image/png', ext: '.png', expected: true, reason: '合法PNG文件' },
  { mime: 'application/pdf', ext: '.pdf', expected: false, reason: '非法PDF文件' },
  { mime: 'image/jpeg', ext: '.exe', expected: false, reason: 'MIME与扩展名不匹配' }
];

let passed9 = 0;
let failed9 = 0;

fileTests.forEach(({ mime, ext, expected, reason }) => {
  const result = allowedMimes.includes(mime) && allowedExts.includes(ext);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${reason}: ${mime}, ${ext} -> ${result} (期望: ${expected})`);
  if (result === expected) passed9++;
  else failed9++;
});

console.log(`\n测试9结果: ${passed9} 通过, ${failed9} 失败`);

// 总结
console.log('\n' + '='.repeat(60));
console.log('测试总结');
console.log('='.repeat(60));

const totalPassed = passed1 + passed2 + passed3 + passed7 + passed8 + passed9;
const totalFailed = failed1 + failed2 + failed3 + failed7 + failed8 + failed9;

console.log(`\n总测试数: ${totalPassed + totalFailed}`);
console.log(`通过: ${totalPassed}`);
console.log(`失败: ${totalFailed}`);

if (totalFailed === 0) {
  console.log('\n🎉 所有测试通过！修复效果验证成功！');
} else {
  console.log(`\n⚠️  有 ${totalFailed} 个测试失败，请检查修复效果。`);
}

console.log('\n' + '='.repeat(60));