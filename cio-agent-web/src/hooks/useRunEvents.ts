import { useEffect, useState, useRef, useCallback } from 'react'
import { sseUrl } from '../api/client'
import { useRunStore } from '../store/runStore'
import type { CIOEvent, RunStatus } from '../api/types'

export function useRunEvents(runId: string | null) {
  const { appendEvent, updateSession } = useRunStore()
  const [events, setEvents] = useState<CIOEvent[]>([])
  const [status, setStatus] = useState<RunStatus>('pending')
  const lastEventIdRef = useRef(0)
  const isTerminalRef  = useRef(false)

  const handleEvent = useCallback((event: CIOEvent, runId: string) => {
    setEvents((prev) => [...prev, event])
    appendEvent(runId, event)

    if (event.type === 'workflow_complete') {
      setStatus('success')
      updateSession(runId, { status: 'success' })
      isTerminalRef.current = true
    }
    if (event.type === 'workflow_failed') {
      setStatus('failed')
      updateSession(runId, { status: 'failed' })
      isTerminalRef.current = true
    }
  }, [appendEvent, updateSession])

  useEffect(() => {
    if (!runId) return

    // Reset state when runId changes
    setEvents([])
    setStatus('pending')
    lastEventIdRef.current = 0
    isTerminalRef.current = false

    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout>
    let closed = false
    let retryDelay = 3000

    const connect = () => {
      if (closed) return

      const url = sseUrl(`/runs/${runId}/events?last_event_id=${lastEventIdRef.current}`)
      es = new EventSource(url)

      es.onmessage = (e: MessageEvent) => {
        if (e.lastEventId) {
          const parsed = parseInt(e.lastEventId, 10)
          if (!isNaN(parsed)) {
            lastEventIdRef.current = parsed
          }
        }

        let event: CIOEvent
        try {
          event = JSON.parse(e.data) as CIOEvent
        } catch {
          return
        }

        handleEvent(event, runId)

        if (event.type === 'run_result') {
          es?.close()
          closed = true
        }

        // Reset retry delay on success
        retryDelay = 3000
      }

      es.onerror = () => {
        es?.close()
        if (!closed && !isTerminalRef.current) {
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 1.5, 30000)
            connect()
          }, retryDelay)
        }
      }
    }

    connect()

    return () => {
      closed = true
      clearTimeout(retryTimer)
      es?.close()
    }
  }, [runId, handleEvent])

  return { events, status }
}
