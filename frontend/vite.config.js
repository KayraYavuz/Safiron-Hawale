import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 500,
    target: ['es2020', 'chrome90', 'firefox90', 'safari14'],
    cssCodeSplit: true,

    rollupOptions: {
      output: {
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',

        // ── Manuel chunk splitting ─────────────────────────────────────────
        // framer-motion ve recharts büyük kütüphaneler — ayrı chunk'a al
        // Böylece uygulama chunk'u küçük kalır, değişmeyen kütüphaneler cache'lenir
        manualChunks(id) {
          if (id.includes('framer-motion')) return 'framer-motion'
          if (id.includes('recharts') || id.includes('d3-')) return 'recharts'
          if (id.includes('@tanstack')) return 'tanstack-query'
          if (id.includes('node_modules')) return 'vendor'
        },
      }
    },
  },
})
