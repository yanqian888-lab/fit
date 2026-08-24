/**
 * 测试环境设置
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.PORT = '3001';

// 模拟 console.log 以减少测试输出噪音
if (process.env.SILENT_TESTS === 'true') {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}