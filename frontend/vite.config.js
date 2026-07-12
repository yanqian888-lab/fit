import { defineConfig, loadEnv } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig(({ mode }) => {
  // 加载 .env / .env.{mode} / .env.{mode}.local 中的变量
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [uni()],
    base: env.VITE_H5_BASE || (mode === 'production' ? '/h5/' : '/'),
  };
});
