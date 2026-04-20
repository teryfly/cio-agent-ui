import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 1577,
    proxy: {
      '/api': {
        target: 'http://cio.fhir.store:1576',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://cio.fhir.store:1576',
        changeOrigin: true,
      },
    },
  },
})
