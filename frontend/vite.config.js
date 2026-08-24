import { defineConfig, loadEnv } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { fileURLToPath, URL } from 'node:url';

// 小程序包体受限（主包 2MB），静态图片不打入包内，改走 CDN（后端 /static/appstatic/ 提供）
// 仅在编译 mp-weixin 时把 '/static/image/' '/static/tabbar/' 字符串路径改写为 CDN 绝对地址
function mpStaticCdn(cdnBase) {
  return {
    name: 'mp-static-cdn',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.(vue|js|ts)$/.test(id)) return null;
      if (!code.includes('/static/')) return null;
      const out = code
        .replaceAll('/static/image/', `${cdnBase}/image/`)
        .replaceAll('/static/tabbar/', `${cdnBase}/tabbar/`);
      return out === code ? null : { code: out, map: null };
    }
  };
}

/**
 * Vite 构建配置
 * - 环境变量通过 .env.{mode} 注入：VITE_SERVER_URL / VITE_APP_ENV / VITE_H5_BASE
 * - 编译 mp-weixin 时启用 mpStaticCdn，把本地静态图片路径改写到 CDN
 */
export default defineConfig(({ mode }) => {
  // 加载 .env / .env.{mode} / .env.{mode}.local 中的变量
  const env = loadEnv(mode, process.cwd(), '');

  const isMp = process.env.UNI_PLATFORM === 'mp-weixin';
  // 静态资源 CDN 基址：优先显式配置的 VITE_STATIC_CDN（.local 覆盖 VITE_SERVER_URL 时不被带偏），否则跟随 API 地址
  const cdnBase = env.VITE_STATIC_CDN || (env.VITE_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '') + '/static/appstatic';

  return {
    plugins: [uni(), ...(isMp ? [mpStaticCdn(cdnBase)] : [])],
    base: env.VITE_H5_BASE || (mode === 'production' ? '/h5/' : '/'),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_SERVER_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
