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

    // esbuild minification — fast, produces small output
    minify: 'esbuild',

    // Warn if any chunk exceeds 300 kB
    chunkSizeWarningLimit: 300,

    rollupOptions: {
      output: {
        // Content-hash filenames — enables aggressive (immutable) browser caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },

    // Per-page CSS code splitting
    cssCodeSplit: true,

    // Modern target — no legacy polyfills, smaller bundle
    target: ['es2020', 'chrome90', 'firefox90', 'safari14'],
  },
})
