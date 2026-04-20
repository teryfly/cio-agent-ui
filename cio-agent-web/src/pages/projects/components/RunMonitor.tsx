import { useEffect, useRef, useState } from 'react'
import { useRunEvents } from '../../../hooks/useRunEvents'
import type { CIOEvent, SSEEventType } from '../../../api/types'

/* ── Event row styling ──────────────────────────────────────────────────── */

const eventStyle: Partial<Record<SSEEventType, { icon: string; cls: string }>> = {
  step_start:        { icon: '▶', cls: 'text-blue-400' },
  step_complete:     { icon: '✓', cls: 'text-green-400' },
  agent_send:        { icon: '→', cls: 'text-purple-400' },
  agent_recv:        { icon: '←', cls: 'text-purple-300' },
  cio_decision:      { icon: '⊕', cls: 'text-teal-400' },
  info:              { icon: 'ℹ', cls: 'text-gray-400' },
  warn:              { icon: '⚠', cls: 'text-amber-400' },
  error:             { icon: '✗', cls: 'text-red-400' },
  workflow_complete: { icon: '🎉', cls: 'text-green-300' },
  workflow_failed:   { icon: '💥', cls: 'text-red-300' },
  run_result:        { icon: '📋', cls: 'text-gray-300' },
}

/* ── Single event row ───────────────────────────────────────────────────── */

function EventRow({ event, index }: { event: CIOEvent; index: number }) {
  const style = eventStyle[event.type] ?? { icon: '·', cls: 'text-gray-500' }
  const time  = new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour12: false })

  return (
    <div
      className={`flex gap-2 py-1.5 px-2 rounded text-xs font-mono group hover:bg-surface-3/50 transition-colors ${
        index % 2 === 0 ? '' : 'bg-surface-3/20'
      }`}
    >
      {/* Time */}
      <span className="text-gray-600 shrink-0 w-20 text-right">{time}</span>

      {/* Icon + type */}
      <span className={`shrink-0 w-20 ${style.cls}`}>
        <span className="mr-1">{style.icon}</span>
        <span className="text-[10px]">{event.type}</span>
      </span>

      {/* Message */}
      <span className="text-gray-300 break-all leading-relaxed">
        {event.data.message ?? JSON.stringify(event.data).slice(0, 200)}
        {event.data.preview && (
          <span className="text-gray-600 ml-2">— {String(event.data.preview).slice(0, 80)}</span>
        )}
      </span>
    </div>
  )
}

/* ── Status banner ──────────────────────────────────────────────────────── */

function StatusBanner({ status, duration }: { status: string; duration?: number }) {
  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2.5 text-xs text-green-400">
        <span>🎉</span>
        <span>工作流执行成功{duration !== undefined ? `，耗时 ${duration.toFixed(1)}s` : ''}</span>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-xs text-red-400">
        <span>💥</span>
        <span>工作流执行失败</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2.5 text-xs text-blue-400">
      <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full" />
      <span>正在执行…</span>
    </div>
  )
}

/* ── Filter bar ─────────────────────────────────────────────────────────── */

type FilterMode = 'all' | 'steps' | 'agent' | 'errors'

function filterEvents(events: CIOEvent[], mode: FilterMode): CIOEvent[] {
  switch (mode) {
    case 'steps':  return events.filter((e) => e.type.startsWith('step') || e.type.startsWith('workflow'))
    case 'agent':  return events.filter((e) => e.type.startsWith('agent') || e.type === 'cio_decision')
    case 'errors': return events.filter((e) => e.type === 'error' || e.type === 'warn' || e.type === 'workflow_failed')
    default:       return events
  }
}

/* ── Main Component ─────────────────────────────────────────────────────── */

interface RunMonitorProps {
  runId: string
  /** If provided, renders in inline mode (no own container chrome) */
  inline?: boolean
}

export default function RunMonitor({ runId, inline = false }: RunMonitorProps) {
  const { events, status } = useRunEvents(runId)
  const [filter,    setFilter]    = useState<FilterMode>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [duration,   setDuration]   = useState<number | undefined>()

  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, autoScroll])

  // Extract duration from workflow_complete event
  useEffect(() => {
    const completeEvent = events.find((e) => e.type === 'workflow_complete')
    if (completeEvent?.data.duration_seconds !== undefined) {
      setDuration(completeEvent.data.duration_seconds as number)
    }
  }, [events])

  const visible = filterEvents(events, filter)

  const filters: { key: FilterMode; label: string }[] = [
    { key: 'all',    label: `全部 (${events.length})` },
    { key: 'steps',  label: '步骤' },
    { key: 'agent',  label: 'Agent' },
    { key: 'errors', label: '错误/警告' },
  ]

  const content = (
    <div className="flex flex-col h-full">
      {/* Status */}
      <div className="mb-3">
        <StatusBanner status={status} duration={duration} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] px-2 py-1 rounded transition-colors ${
                filter === f.key
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            className="accent-brand-500 w-3 h-3"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          自动滚动
        </label>
      </div>

      {/* Event log */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-surface-0 rounded-lg border border-border p-2">
        {visible.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-600">
            {status === 'pending' ? '等待任务开始…' : '暂无事件'}
          </div>
        ) : (
          <>
            {visible.map((e, i) => (
              <EventRow key={i} event={e} index={i} />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-600">
        <span>Run ID: <span className="font-mono">{runId}</span></span>
        <span>{events.length} 个事件</span>
      </div>
    </div>
  )

  if (inline) return content

  return (
    <div className="h-[600px] flex flex-col">
      {content}
    </div>
  )
}
