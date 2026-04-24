// File: pages/projects/components/RunMonitor.tsx
/**
 * RunMonitor — 运行事件监控面板（智能轮询版）
 * 
 * ✅ 运行中自动刷新（3秒间隔）
 * ✅ 完成后停止刷新
 * ✅ 提供手动刷新按钮
 */
import { useState, useRef, useEffect } from 'react'
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
      <span className="text-gray-600 shrink-0 w-20 text-right">{time}</span>
      <span className={`shrink-0 w-20 ${style.cls}`}>
        <span className="mr-1">{style.icon}</span>
        <span className="text-[10px]">{event.type}</span>
      </span>
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
      <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
      <span>运行中 — 自动刷新中（3秒间隔）</span>
    </div>
  )
}
/* ── Filter ─────────────────────────────────────────────────────────────── */
type FilterMode = 'all' | 'steps' | 'agent' | 'errors'
function filterEvents(events: CIOEvent[], mode: FilterMode): CIOEvent[] {
  switch (mode) {
    case 'steps':  return events.filter((e) => e.type.startsWith('step') || e.type.startsWith('workflow'))
    case 'agent':  return events.filter((e) => e.type.startsWith('agent') || e.type === 'cio_decision')
    case 'errors': return events.filter((e) => e.type === 'error' || e.type === 'warn' || e.type === 'workflow_failed')
    default:       return events
  }
}
/* ── Refresh icon ───────────────────────────────────────────────────────── */
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={spinning ? 'animate-spin' : ''}>
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}
/* ── Main Component ─────────────────────────────────────────────────────── */
interface RunMonitorProps {
  runId:   string
  inline?: boolean
}
export default function RunMonitor({ runId, inline = false }: RunMonitorProps) {
  // ✅ 使用智能轮询 hook
  const { events, status, loading, refresh } = useRunEvents(runId)
  const [filter, setFilter] = useState<FilterMode>('all')
  const bottomRef = useRef<HTMLDivElement>(null)
  // ✅ 新事件到达时自动滚动到底部
  useEffect(() => {
    if (events.length > 0) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [events.length])
  const completeEvent = events.find((e) => e.type === 'workflow_complete')
  const duration = completeEvent?.data.duration_seconds as number | undefined
  const visible = filterEvents(events, filter)
  const filters: { key: FilterMode; label: string }[] = [
    { key: 'all',    label: `全部 (${events.length})` },
    { key: 'steps',  label: '步骤' },
    { key: 'agent',  label: 'Agent' },
    { key: 'errors', label: '错误/警告' },
  ]
  const isActive = status === 'pending' || status === 'running'
  const content = (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <StatusBanner status={status} duration={duration} />
      </div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-[11px] px-2 py-1 rounded transition-colors ${
                filter === f.key ? 'bg-brand-600/20 text-brand-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* ✅ 运行中显示自动刷新状态 */}
          {isActive && (
            <span className="text-[11px] text-gray-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              自动更新
            </span>
          )}
          <button onClick={refresh} disabled={loading} title="手动刷新"
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-200 disabled:opacity-40 transition-colors px-2 py-1 rounded hover:bg-surface-3">
            <RefreshIcon spinning={loading} />
            <span>刷新</span>
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-surface-0 rounded-lg border border-border p-2">
        {loading && events.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-600">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
            加载中…
          </div>
        ) : visible.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-600">
            {status === 'pending' ? '任务等待中，正在自动刷新…' : '暂无事件'}
          </div>
        ) : (
          <>
            {visible.map((e, i) => <EventRow key={i} event={e} index={i} />)}
            <div ref={bottomRef} />
          </>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-600">
        <span>Run ID: <span className="font-mono">{runId}</span></span>
        <span>{events.length} 个事件</span>
      </div>
    </div>
  )
  if (inline) return content
  return <div className="h-[600px] flex flex-col">{content}</div>
}