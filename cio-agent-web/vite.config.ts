import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import http from 'http'

const BACKEND = 'http://cio.fhir.store:1576'

// Shared keep-alive agent: reuses TCP connections across proxy requests,
// preventing connection exhaustion when many requests arrive concurrently.
const backendAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 30,
  keepAliveMsecs: 30_000,
})

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
        target: BACKEND,
        changeOrigin: true,
        agent: backendAgent,
        // Fail fast if backend is unreachable (DNS/TCP), don't hang the browser request.
        timeout: 10_000,
        // Allow up to 2 min for the full request-response cycle (e.g. workflow triggers).
        proxyTimeout: 120_000,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error(`[proxy] ${req.method} ${req.url} → ${err.message}`)
            // Send a proper error response so the browser gets a real HTTP error
            // instead of a connection reset (which shows as a network error with no status).
            if (!res.headersSent) {
              (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' })
              ;(res as import('http').ServerResponse).end(JSON.stringify({ error: 'proxy_error', message: err.message }))
            }
          })
        },
      },
      '/health': {
        target: BACKEND,
        changeOrigin: true,
        agent: backendAgent,
        timeout: 10_000,
        proxyTimeout: 10_000,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error(`[proxy] ${req.method} ${req.url} → ${err.message}`)
            if (!res.headersSent) {
              (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' })
              ;(res as import('http').ServerResponse).end(JSON.stringify({ status: 'unreachable', error: err.message }))
            }
          })
        },
      },
    },
  },
})
