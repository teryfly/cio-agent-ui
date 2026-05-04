import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import http from 'http'

// Backend runs on the same host — use loopback to avoid hairpin-NAT through
// the public IP (cio.fhir.store → 43.132.224.225), which causes unreliable
// packet ordering and intermittent "socket hang up" errors.
const BACKEND = 'http://127.0.0.1:1576'

// Shared keep-alive agent: reuses TCP connections across proxy requests.
// Free sockets are destroyed after 3 s so the pool always evicts them before
// the backend's own TCP idle-timeout fires, preventing ECONNRESET on reuse.
const backendAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 30,
  maxFreeSockets: 10,
  keepAliveMsecs: 1_000,
})

// Track which sockets have already been instrumented to avoid adding
// duplicate error listeners on keep-alive socket reuse (would trigger
// MaxListenersExceededWarning after 10 reuses of the same socket).
const instrumentedSockets = new WeakSet<import('net').Socket>()

// Destroy free sockets after 3 s. Node's http.Agent has no built-in
// freeSocketTimeout — without this, idle sockets live forever in the pool
// and trigger ECONNRESET when the backend closes them on its side first.
backendAgent.on('free', (socket: import('net').Socket) => {
  const t = setTimeout(() => socket.destroy(), 3_000)
  socket.once('close', () => clearTimeout(t))
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
            // Retry once on stale keepalive socket errors (socket hang up / ECONNRESET).
            // These happen when the backend closes an idle connection just as the proxy
            // reuses it — the retry opens a fresh socket and always succeeds.
            const isStaleSocket =
              err.message === 'socket hang up' ||
              (err as NodeJS.ErrnoException).code === 'ECONNRESET'
            if (isStaleSocket && !(req as any)._proxyRetried && !res.headersSent) {
              ;(req as any)._proxyRetried = true
              proxy.web(req, res)
              return
            }

            console.error(`[proxy] ${req.method} ${req.url} → ${err.message}`)
            // Send a proper error response so the browser gets a real HTTP error
            // instead of a connection reset (which shows as a network error with no status).
            if (!res.headersSent) {
              (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' })
              ;(res as import('http').ServerResponse).end(JSON.stringify({ error: 'proxy_error', message: err.message }))
            }
          })
          // Destroy stale keep-alive sockets on ECONNRESET so the agent drops
          // them from the pool instead of reusing them for the next request.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.on('socket', (socket) => {
              if (!instrumentedSockets.has(socket)) {
                instrumentedSockets.add(socket)
                socket.on('error', () => socket.destroy())
              }
            })
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
