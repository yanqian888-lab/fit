/**
 * 生成强随机密钥
 * 用于JWT_SECRET等敏感配置
 */

const crypto = require('crypto');

console.log('='.repeat(60));
console.log('生成强随机密钥');
console.log('='.repeat(60));

console.log('\nJWT密钥（64字符）:');
console.log(crypto.randomBytes(32).toString('hex'));

console.log('\nAPI密钥（32字符）:');
console.log(crypto.randomBytes(16).toString('hex'));

console.log('\nUUID:');
console.log(crypto.randomUUID());

console.log('\n' + '='.repeat(60));
console.log('使用说明：');
console.log('='.repeat(60));
console.log('\n1. 将生成的JWT密钥复制到.env文件的JWT_SECRET');
console.log('2. 确保不要将真实密钥提交到Git');
console.log('3. 定期更换密钥（建议每3-6个月）');
console.log('\n' + '='.repeat(60));