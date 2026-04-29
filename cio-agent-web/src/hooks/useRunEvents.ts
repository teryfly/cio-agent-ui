/**
 * useRunEvents — SSE 实时订阅运行事件
 *
 * 修复：原实现用 axios 轮询 /events 端点，该端点是 text/event-stream，
 * 无法用 JSON 方式消费，导致事件始终为空。
 *
 * 现改为：
 * 1. 用原生 EventSource（或 fetch 流）订阅 SSE，实时追加事件
 * 2. 终态（success/failed）时自动关闭连接
 * 3. 网络中断时指数退避重连
 * 4. 同时轮询 GET /runs/{id} 以同步 run 元数据（status、result 等）
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { runsApi } from '../api/runs'
import { sseUrl }  from '../api/client'
import type { CIOEvent, RunStatus } from '../api/types'

export interface UseRunEventsResult {
  events:  CIOEvent[]
  status:  RunStatus
  loading: boolean
  refresh: () => void
}

const TERMINAL_STATUSES: RunStatus[] = ['success', 'failed']
const META_POLL_MS   = 5_000   // poll run metadata every 5s while active
const RECONNECT_BASE = 2_000   // base reconnect delay
const RECONNECT_MAX  = 30_000  // max reconnect delay

/** Parse a raw SSE "data: ..." line into a CIOEvent, or null if unparseable */
function parseSseLine(data: string): CIOEvent | null {
  if (!data || data === ':keepalive' || data.startsWith(':')) return null
  try {
    const parsed = JSON.parse(data)
    // Validate minimal shape
    if (parsed && typeof parsed.type === 'string' && parsed.timestamp) {
      return parsed as CIOEvent
    }
    return null
  } catch {
    return null
  }
}

export function useRunEvents(runId: string | null): UseRunEventsResult {
  const [events,  setEvents]  = useState<CIOEvent[]>([])
  const [status,  setStatus]  = useState<RunStatus>('pending')
  const [loading, setLoading] = useState(false)

  const esRef          = useRef<EventSource | null>(null)
  const readerRef      = useRef<ReadableStreamDefaultReader | null>(null)
  const abortRef       = useRef<AbortController | null>(null)
  const metaPollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef   = useRef(true)
  const retryCountRef  = useRef(0)
  const isTerminalRef  = useRef(false)

  /** Append a single event, deduplicating by timestamp+type */
  const appendEvent = useCallback((evt: CIOEvent) => {
    if (!isMountedRef.current) return
    setEvents((prev) => {
      // Avoid duplicates on reconnect (simple check by last item)
      if (prev.length > 0) {
        const last = prev[prev.length - 1]
        if (last.type === evt.type && last.timestamp === evt.timestamp) return prev
      }
      return [...prev, evt]
    })

    // Detect terminal events
    if (evt.type === 'workflow_complete' || evt.type === 'run_result') {
      if (!isMountedRef.current) return
      setStatus('success')
      isTerminalRef.current = true
    }
    if (evt.type === 'workflow_failed') {
      if (!isMountedRef.current) return
      setStatus('failed')
      isTerminalRef.current = true
    }
  }, [])

  /** Poll run metadata to sync status */
  const syncMeta = useCallback(async () => {
    if (!runId || !isMountedRef.current) return
    try {
      const run = await runsApi.get(runId)
      if (!isMountedRef.current) return
      setStatus(run.status)
      if (TERMINAL_STATUSES.includes(run.status)) {
        isTerminalRef.current = true
      }
    } catch {
      // ignore — SSE is primary source
    }
  }, [runId])

  /** Close all active connections */
  const closeAll = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {})
      readerRef.current = null
    }
    if (metaPollRef.current) {
      clearInterval(metaPollRef.current)
      metaPollRef.current = null
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
  }, [])

  /**
   * Connect via fetch + ReadableStream (more reliable than EventSource
   * for custom headers / token-in-URL scenarios with reconnect control).
   */
  const connect = useCallback(() => {
    if (!runId || !isMountedRef.current || isTerminalRef.current) return

    closeAll()
    setLoading(true)

    const url = sseUrl(`/runs/${runId}/events`)
    const abort = new AbortController()
    abortRef.current = abort

    ;(async () => {
      try {
        const response = await fetch(url, {
          signal: abort.signal,
          headers: { Accept: 'text/event-stream' },
        })

        if (!response.ok || !response.body) {
          throw new Error(`SSE connect failed: ${response.status}`)
        }

        if (!isMountedRef.current) return
        setLoading(false)
        retryCountRef.current = 0

        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader()
        readerRef.current = reader

        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done || !isMountedRef.current) break

          buffer += value
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          let dataLine = ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              dataLine = line.slice(6).trim()
            } else if (line === '' && dataLine) {
              // End of one SSE event block
              const evt = parseSseLine(dataLine)
              if (evt) appendEvent(evt)
              dataLine = ''

              // Stop reading if terminal
              if (isTerminalRef.current) break
            }
          }

          if (isTerminalRef.current) break
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return
        const isAbort = (err instanceof Error && err.name === 'AbortError')
        if (isAbort || isTerminalRef.current) return

        setLoading(false)

        // Exponential backoff reconnect
        const delay = Math.min(
          RECONNECT_BASE * Math.pow(2, retryCountRef.current),
          RECONNECT_MAX
        )
        retryCountRef.current += 1
        reconnectRef.current = setTimeout(() => {
          if (isMountedRef.current && !isTerminalRef.current) connect()
        }, delay)
      }
    })()
  }, [runId, appendEvent, closeAll])

  /** Manual refresh: re-sync meta and, if still active, reconnect SSE */
  const refresh = useCallback(() => {
    syncMeta()
    if (!isTerminalRef.current) {
      connect()
    }
  }, [syncMeta, connect])

  // Main effect: start SSE + meta polling when runId changes
  useEffect(() => {
    isMountedRef.current = true
    isTerminalRef.current = false

    if (!runId) {
      setEvents([])
      setStatus('pending')
      return
    }

    // Reset state for new run
    setEvents([])
    setStatus('pending')
    retryCountRef.current = 0

    // Initial meta fetch to get current status
    syncMeta()

    // Connect SSE
    connect()

    // Periodic meta poll (catches status if SSE misses terminal event)
    metaPollRef.current = setInterval(() => {
      if (isTerminalRef.current) {
        if (metaPollRef.current) clearInterval(metaPollRef.current)
        return
      }
      syncMeta()
    }, META_POLL_MS)

    return () => {
      isMountedRef.current = false
      closeAll()
    }
  }, [runId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop SSE once terminal status is confirmed
  useEffect(() => {
    if (TERMINAL_STATUSES.includes(status)) {
      isTerminalRef.current = true
      closeAll()
    }
  }, [status, closeAll])

  return { events, status, loading, refresh }
}