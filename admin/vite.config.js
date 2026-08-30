import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  // 加载 .env / .env.{mode} / .env.{mode}.local 中的 VITE_ 变量
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const isAnalyze = env.VITE_ANALYZE === 'true' || mode === 'analyze'

  const plugins = [
    vue(),
    // Element Plus 组件自动导入 + 样式按需引入
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts'
    }),
    // Element Plus 组合式 API（ElMessage / ElMessageBox 等）自动导入
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts'
    })
  ]

  if (isAnalyze) {
    plugins.push(
      visualizer({
        open: false,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/stats.html'
      })
    )
  }

  return {
    plugins,
    base: env.VITE_ADMIN_BASE || '/',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('element-plus') && !id.includes('@element-plus/icons-vue')) {
                return 'vendor-element-plus'
              }
              if (id.includes('@element-plus/icons-vue')) {
                return 'vendor-ep-icons'
              }
              if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
                return 'vendor-vue'
              }
              return 'vendor-other'
            }
          }
        }
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
