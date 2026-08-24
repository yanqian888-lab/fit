import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // 加载 .env / .env.{mode} / .env.{mode}.local 中的 VITE_ 变量
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [vue()],
    base: env.VITE_ADMIN_BASE || '/',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/static': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    }
  }
})
