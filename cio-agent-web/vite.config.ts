import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import http from 'http'

// Backend runs on the same host — use loopback to avoid going through the
// public IP (cio.fhir.store → 43.132.224.225) and any associated NAT.
const BACKEND = 'http://127.0.0.1:1576'

// No keepalive: uvicorn closes connections immediately after responding, which
// causes "socket hang up" when Node tries to reuse a pooled socket that the
// backend has already shut down. On loopback, each TCP handshake is < 1 ms so
// there is no meaningful cost to creating a fresh connection per request.
const backendAgent = new http.Agent({ keepAlive: false })

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
        // Fail fast on unreachable backend.
        timeout: 10_000,
        // Allow up to 2 min for long-running requests (e.g. workflow triggers).
        proxyTimeout: 120_000,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error(`[proxy] ${req.method} ${req.url} → ${err.message}`)
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
