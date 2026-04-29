// File: pages/projects/components/RunMonitor.tsx
/**
 * RunMonitor — 运行监控面板（重新设计 v2.2）
 *
 * 布局（双栏）：
 * ┌─────────────────────────────────────────────────────┐
 * │ 状态栏                               [刷新]          │
 * ├──────────────────────┬──────────────────────────────┤
 * │  执行进度             │  实时日志                     │
 * │  step_start 等流程   │  info/warn/error + logger    │
 * │  控制事件             │  字段（API v2.2）             │
 * └──────────────────────┴──────────────────────────────┘
 *
 * v2.2 分类规则：
 *   isLogEvent  → data.logger 存在 → 路由到"实时日志"栏
 *   其余事件    → 路由到"执行进度"栏
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useRunEvents } from '../../../hooks/useRunEvents'
import type { CIOEvent, SSEEventType } from '../../../api/types'

/* ── Classify ────────────────────────────────────────────────────────────── */

function isLogEvent(e: CIOEvent): boolean {
  return (
    (e.type === 'info' || e.type === 'warn' || e.type === 'error') &&
    typeof e.data.logger === 'string'
  )
}

/* ── Style maps ─────────────────────────────────────────────────────────── */

const FLOW_STYLE: Partial<Record<SSEEventType, { icon: string; color: string }>> = {
  step_start:        { icon: '▶', color: 'text-blue-400' },
  step_complete:     { icon: '✓', color: 'text-green-400' },
  agent_send:        { icon: '↑', color: 'text-purple-400' },
  agent_recv:        { icon: '↓', color: 'text-purple-300' },
  cio_decision:      { icon: '⊕', color: 'text-teal-400' },
  info:              { icon: 'ℹ', color: 'text-gray-400' },
  warn:              { icon: '⚠', color: 'text-amber-400' },
  error:             { icon: '✗', color: 'text-red-400' },
  workflow_complete: { icon: '🎉', color: 'text-green-300' },
  workflow_failed:   { icon: '💥', color: 'text-red-300' },
  run_result:        { icon: '📋', color: 'text-gray-300' },
}

const LOG_CFG: Record<string, { badge: string; text: string; row: string; label: string }> = {
  info:    { badge: 'text-blue-400  bg-blue-400/10  border-blue-400/20',  text: 'text-gray-300',  row: '',                 label: 'INFO' },
  warning: { badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20', text: 'text-amber-300', row: 'bg-amber-400/5',  label: 'WARN' },
  error:   { badge: 'text-red-400   bg-red-400/10   border-red-400/20',   text: 'text-red-300',   row: 'bg-red-400/5',    label: 'ERR' },
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false })
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={spinning ? 'animate-spin' : ''}>
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

/* ── Status banner ──────────────────────────────────────────────────────── */

function StatusBanner({ status, duration, loading }: {
  status: string; duration?: number; loading: boolean
}) {
  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-400">
        <span>🎉</span>
        <span className="font-medium">执行成功</span>
        {duration !== undefined && <span className="text-green-600 ml-1">· {duration.toFixed(1)}s</span>}
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
        <span>💥</span>
        <span className="font-medium">执行失败</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400">
      {loading
        ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
        : <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse shrink-0" />}
      <span className="font-medium">{status === 'pending' ? '等待启动…' : '运行中'}</span>
      <span className="text-blue-600">· 实时订阅</span>
    </div>
  )
}

/* ── Flow event row ─────────────────────────────────────────────────────── */

function FlowRow({ event, idx }: { event: CIOEvent; idx: number }) {
  const s   = FLOW_STYLE[event.type] ?? { icon: '·', color: 'text-gray-600' }
  const msg = event.data.message
    ?? (event.data.preview ? String(event.data.preview) : null)
    ?? JSON.stringify(event.data).slice(0, 120)

  return (
    <div className={`flex gap-2 py-1 px-2 text-xs rounded hover:bg-surface-3/40 transition-colors ${idx % 2 === 1 ? 'bg-surface-3/10' : ''}`}>
      <span className="text-gray-700 shrink-0 font-mono text-[10px] w-16 text-right">{fmt(event.timestamp)}</span>
      <span className={`shrink-0 font-mono text-[10px] w-[72px] ${s.color}`}>
        {s.icon} {event.type}
      </span>
      <span className="text-gray-300 break-all leading-relaxed min-w-0 flex-1">{msg}</span>
    </div>
  )
}

/* ── Flow panel ─────────────────────────────────────────────────────────── */

type FlowFilter = 'all' | 'steps' | 'agent' | 'warn'

function FlowPanel({ events }: { events: CIOEvent[] }) {
  const [filter, setFilter] = useState<FlowFilter>('all')
  const bottomRef = useRef<HTMLDivElement>(null)
  const flowEvents = useMemo(() => events.filter((e) => !isLogEvent(e)), [events])

  const visible = useMemo(() => {
    switch (filter) {
      case 'steps': return flowEvents.filter((e) =>
        e.type.startsWith('step') || e.type.startsWith('workflow') || e.type === 'run_result')
      case 'agent': return flowEvents.filter((e) =>
        e.type.startsWith('agent') || e.type === 'cio_decision')
      case 'warn':  return flowEvents.filter((e) => e.type === 'warn' || e.type === 'error')
      default:      return flowEvents
    }
  }, [flowEvents, filter])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [flowEvents.length])

  const tabs: { key: FlowFilter; label: string }[] = [
    { key: 'all',   label: `全部(${flowEvents.length})` },
    { key: 'steps', label: '步骤' },
    { key: 'agent', label: 'Agent' },
    { key: 'warn',  label: '警告' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-surface-2 border-b border-border shrink-0">
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mr-1">执行进度</span>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              filter === t.key ? 'bg-brand-600/20 text-brand-400' : 'text-gray-600 hover:text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-1">
            <span className="text-xl opacity-20">⏳</span>
            <span className="text-[11px]">等待事件…</span>
          </div>
        ) : (
          <>
            {visible.map((e, i) => <FlowRow key={i} event={e} idx={i} />)}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}

/* ── Log row ────────────────────────────────────────────────────────────── */

function LogRow({ event, idx }: { event: CIOEvent; idx: number }) {
  const level  = String(event.data.level ?? 'info')
  const logger = String(event.data.logger ?? '')
  const msg    = String(event.data.message ?? '')
  const cfg    = LOG_CFG[level] ?? LOG_CFG.info
  const clean  = msg.startsWith(logger + ': ') ? msg.slice(logger.length + 2) : msg

  return (
    <div className={`flex gap-1.5 py-1 px-2 text-[11px] font-mono rounded hover:bg-surface-3/40 transition-colors ${cfg.row} ${idx % 2 === 1 ? 'bg-surface-3/5' : ''}`}>
      <span className="text-gray-700 shrink-0 text-[10px] w-16 text-right">{fmt(event.timestamp)}</span>
      <span className={`text-[9px] font-semibold px-1 rounded border shrink-0 self-start mt-0.5 ${cfg.badge}`}>
        {cfg.label}
      </span>
      <span className="text-gray-600 shrink-0 max-w-[100px] truncate text-[10px]" title={logger}>{logger}</span>
      <span className={`break-all leading-relaxed flex-1 min-w-0 ${cfg.text}`}>{clean}</span>
    </div>
  )
}

/* ── Log panel ──────────────────────────────────────────────────────────── */

type LogFilter = 'all' | 'info' | 'warn' | 'error'

function LogPanel({ events }: { events: CIOEvent[] }) {
  const [filter, setFilter] = useState<LogFilter>('all')
  const bottomRef = useRef<HTMLDivElement>(null)
  const logEvents = useMemo(() => events.filter(isLogEvent), [events])

  const warnCnt  = useMemo(() => logEvents.filter((e) => String(e.data.level) === 'warning').length, [logEvents])
  const errorCnt = useMemo(() => logEvents.filter((e) => String(e.data.level) === 'error').length, [logEvents])

  const visible = useMemo(() => {
    switch (filter) {
      case 'info':  return logEvents.filter((e) => String(e.data.level) === 'info')
      case 'warn':  return logEvents.filter((e) => String(e.data.level) === 'warning')
      case 'error': return logEvents.filter((e) => String(e.data.level) === 'error')
      default:      return logEvents
    }
  }, [logEvents, filter])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [logEvents.length])

  const tabs: { key: LogFilter; label: string }[] = [
    { key: 'all',   label: `全部(${logEvents.length})` },
    { key: 'info',  label: 'INFO' },
    { key: 'warn',  label: `WARN${warnCnt ? `(${warnCnt})` : ''}` },
    { key: 'error', label: `ERR${errorCnt ? `(${errorCnt})` : ''}` },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-surface-2 border-b border-border shrink-0">
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mr-1">实时日志</span>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              filter === t.key ? 'bg-brand-600/20 text-brand-400' : 'text-gray-600 hover:text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        {warnCnt > 0 && (
          <span className="text-[9px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1 rounded">
            ⚠{warnCnt}
          </span>
        )}
        {errorCnt > 0 && (
          <span className="text-[9px] text-red-400 bg-red-400/10 border border-red-400/20 px-1 rounded ml-0.5">
            ✗{errorCnt}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {logEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-1">
            <span className="text-xl opacity-20">📋</span>
            <span className="text-[11px]">暂无日志</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[11px] text-gray-600">无匹配</div>
        ) : (
          <>
            {visible.map((e, i) => <LogRow key={i} event={e} idx={i} />)}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────────── */

interface RunMonitorProps {
  runId:   string
  inline?: boolean
}

export default function RunMonitor({ runId, inline = false }: RunMonitorProps) {
  const { events, status, loading, refresh } = useRunEvents(runId)

  const doneEvt  = events.find((e) => e.type === 'workflow_complete' || e.type === 'run_result')
  const duration = doneEvt?.data.duration_seconds as number | undefined

  const flowCount = useMemo(() => events.filter((e) => !isLogEvent(e)).length, [events])
  const logCount  = useMemo(() => events.filter(isLogEvent).length, [events])
  const isActive  = status === 'pending' || status === 'running'

  const inner = (
    <div className="flex flex-col h-full gap-2">
      {/* Top bar */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <StatusBanner status={status} duration={duration} loading={loading} />
        </div>
        <button onClick={refresh} disabled={loading} title="刷新"
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-200 disabled:opacity-40 transition-colors px-2 py-1.5 rounded border border-border hover:bg-surface-3 shrink-0">
          <RefreshIcon spinning={loading} />
          <span>刷新</span>
        </button>
      </div>

      {/* Dual-panel */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
        <div className="bg-surface-0 border border-border rounded-lg overflow-hidden flex flex-col">
          <FlowPanel events={events} />
        </div>
        <div className="bg-surface-0 border border-border rounded-lg overflow-hidden flex flex-col">
          <LogPanel events={events} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between shrink-0 text-[10px] text-gray-600">
        <span className="font-mono truncate max-w-[200px]">{runId}</span>
        <span className="flex items-center gap-2">
          <span>{flowCount} 进度事件 · {logCount} 日志</span>
          {isActive && (
            <span className="flex items-center gap-1 text-blue-500">
              <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
              实时
            </span>
          )}
        </span>
      </div>
    </div>
  )

  if (inline) return inner
  return <div className="h-[600px]">{inner}</div>
}