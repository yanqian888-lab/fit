/**
 * 配置安全检查脚本
 * 检查配置文件中的安全问题
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('='.repeat(60));
console.log('配置安全检查');
console.log('='.repeat(60));

const issues = [];

// 1. 检查.env文件是否存在
console.log('\n1. 检查.env文件...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env文件存在');
  
  // 检查是否在.gitignore中
  const gitignorePath = path.join(__dirname, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (gitignore.includes('.env')) {
      console.log('✅ .env已在.gitignore中');
    } else {
      issues.push('❌ .env未在.gitignore中，可能泄露敏感信息');
      console.log('❌ .env未在.gitignore中');
    }
  }
  
  // 检查.env内容
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // 检查JWT密钥
  if (envContent.includes('JWT_SECRET=your-super-secret-jwt-key-change-in-production')) {
    issues.push('⚠️  JWT_SECRET使用默认值，生产环境必须更换');
    console.log('⚠️  JWT_SECRET使用默认值');
  }
  
  // 检查API密钥是否泄露
  if (envContent.includes('ark-af14644e-8b7b-4f3d-a157-0107e128dc27')) {
    issues.push('🔴 API密钥已泄露，请立即更换！');
    console.log('🔴 API密钥已泄露');
  }
  
  // 检查微信密钥
  if (envContent.includes('WECHAT_SECRET=your-wechat-secret')) {
    issues.push('⚠️  WECHAT_SECRET使用默认值，生产环境必须更换');
    console.log('⚠️  WECHAT_SECRET使用默认值');
  }
  
} else {
  console.log('⚠️  .env文件不存在，请从.env.example复制');
}

// 2. 检查.env.example文件
console.log('\n2. 检查.env.example文件...');
const envExamplePath = path.join(__dirname, '.env.example');
if (fs.existsSync(envExamplePath)) {
  console.log('✅ .env.example文件存在');
  
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // 检查是否包含真实密钥
  if (envExampleContent.includes('ark-af14644e-8b7b-4f3d-a157-0107e128dc27')) {
    issues.push('🔴 .env.example包含真实API密钥！');
    console.log('🔴 .env.example包含真实API密钥');
  }
} else {
  issues.push('❌ .env.example文件不存在');
  console.log('❌ .env.example文件不存在');
}

// 3. 检查JWT密钥强度
console.log('\n3. 检查JWT密钥强度...');
const generateStrongKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

console.log('💡 建议使用以下命令生成强密钥：');
console.log(`   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);

// 4. 检查数据库配置
console.log('\n4. 检查数据库配置...');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('DB_PATH=./data/app.db')) {
    console.log('✅ 数据库路径配置正确');
  }
  
  if (envContent.includes('NODE_ENV=production')) {
    if (envContent.includes('DB_PATH=./data/app.db')) {
      issues.push('⚠️  生产环境应使用绝对路径');
      console.log('⚠️  生产环境应使用绝对路径');
    }
  }
}

// 5. 检查环境变量
console.log('\n5. 检查环境变量...');
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`当前环境: ${nodeEnv}`);

if (nodeEnv === 'production') {
  console.log('⚠️  生产环境检查：');
  
  if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
    issues.push('🔴 生产环境使用默认JWT密钥！');
    console.log('🔴 生产环境使用默认JWT密钥');
  }
  
  if (!process.env.DOUBAO_API_KEY && !process.env.DOUBAO_MAIN_AGENT_API_KEY) {
    issues.push('🔴 生产环境缺少API密钥配置');
    console.log('🔴 生产环境缺少API密钥配置');
  }
}

// 6. 生成安全建议
console.log('\n' + '='.repeat(60));
console.log('安全建议');
console.log('='.repeat(60));

console.log('\n1. 敏感信息管理：');
console.log('   - 使用环境变量或密钥管理服务存储敏感信息');
console.log('   - 定期轮换API密钥和JWT密钥');
console.log('   - 使用强随机密钥（至少32字节）');

console.log('\n2. 文件权限：');
console.log('   - 确保.env文件权限为600（仅所有者可读写）');
console.log('   - 确保.gitignore包含.env');

console.log('\n3. 生产环境：');
console.log('   - 使用环境变量而非.env文件');
console.log('   - 启用严格的API密钥验证');
console.log('   - 启用请求日志和异常告警');

// 7. 总结
console.log('\n' + '='.repeat(60));
console.log('检查结果');
console.log('='.repeat(60));

if (issues.length === 0) {
  console.log('\n✅ 未发现严重安全问题');
} else {
  console.log(`\n发现 ${issues.length} 个问题：`);
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue}`);
  });
}

console.log('\n' + '='.repeat(60));

// 返回退出码
process.exit(issues.length > 0 ? 1 : 0);