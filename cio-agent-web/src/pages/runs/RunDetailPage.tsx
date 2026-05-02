// File: pages/runs/RunDetailPage.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import toast from 'react-hot-toast'
import { runsApi } from '../../api/runs'
import { apiClient } from '../../api/client'
import { useRunEvents } from '../../hooks/useRunEvents'
import { useAuthStore } from '../../store/authStore'
import type { RunDetail, ValidationReport, ValidationOutcome, CIOEvent, RunStatus } from '../../api/types'
import Button      from '../../components/ui/Button'
import PageHeader  from '../../components/ui/PageHeader'
import EmptyState  from '../../components/ui/EmptyState'
import Modal       from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false })
}

function isLogEvent(e: CIOEvent): boolean {
  return (
    (e.type === 'info' || e.type === 'warn' || e.type === 'error') &&
    typeof e.data?.logger === 'string'
  )
}

/* ── Validation report ───────────────────────────────────────────────────── */

const outcomeCls: Record<ValidationOutcome, string> = {
  pass:     'text-green-400 bg-green-400/10 border-green-400/20',
  skip:     'text-gray-400  bg-gray-400/10  border-gray-400/20',
  fixed:    'text-teal-400  bg-teal-400/10  border-teal-400/20',
  fail:     'text-red-400   bg-red-400/10   border-red-400/20',
  escalate: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
}

function ValidationReportView({ report }: { report: ValidationReport }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-gray-500 font-medium uppercase tracking-widest">验证报告</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border mb-3 flex-wrap ${outcomeCls[report.overall_outcome]}`}>
        <span className="text-sm font-medium">{report.overall_outcome.toUpperCase()}</span>
        <span className="text-xs opacity-80 flex-1">{report.summary}</span>
        <span className="text-xs opacity-60 shrink-0">
          {dayjs(report.started_at).format('HH:mm:ss')} → {dayjs(report.completed_at).format('HH:mm:ss')}
        </span>
      </div>
      <div className="space-y-2">
        {report.step_results.map((step) => (
          <div key={step.step_id} className="bg-surface-2 border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
              <span className="text-xs font-mono text-gray-500 w-8">{step.step_id}</span>
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${outcomeCls[step.outcome]}`}>
                {step.outcome}
              </span>
              <span className="text-xs text-gray-300 flex-1 min-w-0">{step.summary}</span>
              <span className="text-[11px] text-gray-600 shrink-0">{step.duration_seconds.toFixed(1)}s</span>
              {step.fix_rounds > 0 && (
                <span className="text-[11px] text-amber-400 shrink-0">{step.fix_rounds} fix</span>
              )}
            </div>
            {step.stdout_preview && (
              <pre className="px-4 py-2 text-[11px] font-mono text-gray-500 bg-surface-0 border-t border-border overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                {step.stdout_preview}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── WorkflowProgressAxis ────────────────────────────────────────────────── */

interface ProgressNodeProps {
  label: string
  startedAt: string
  completedAt?: string
  isDone: boolean
  isActive?: boolean
  isTerminal?: boolean
  isFailed?: boolean
}

function ProgressNode({ label, startedAt, completedAt, isDone, isActive, isTerminal, isFailed }: ProgressNodeProps) {
  const iconWrap = isFailed
    ? 'border-red-400/60 bg-red-400/10'
    : isDone
    ? 'border-green-400/60 bg-green-400/10'
    : isActive
    ? 'border-blue-400/60 bg-blue-400/10'
    : 'border-gray-600/40 bg-surface-3'

  const labelCls = isFailed
    ? 'text-red-300'
    : isDone
    ? 'text-gray-200'
    : isActive
    ? 'text-blue-300'
    : 'text-gray-500'

  return (
    <div className="flex gap-3">
      {/* Icon + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${iconWrap}`}>
          {isFailed ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : isDone && isTerminal ? (
            <span className="text-[11px]">★</span>
          ) : isDone ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-400">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          ) : isActive ? (
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse inline-block" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />
          )}
        </div>
        {!isTerminal && <div className="w-px flex-1 bg-border min-h-[20px]" />}
      </div>

      {/* Content */}
      <div className="pb-4 min-w-0 flex-1">
        <p className={`text-sm font-medium leading-tight ${labelCls}`}>{label}</p>
        <p className="text-[11px] text-gray-600 mt-0.5">
          {fmt(startedAt)}
          {completedAt && ` → ${fmt(completedAt)}`}
        </p>
      </div>
    </div>
  )
}

function WorkflowProgressAxis({ events, status }: { events: CIOEvent[]; status: RunStatus }) {
  const flowEvents = useMemo(() => events.filter((e) => !isLogEvent(e)), [events])

  const stepStarts   = useMemo(() => flowEvents.filter((e) => e.type === 'step_start'),    [flowEvents])
  const stepCompletes = useMemo(() => flowEvents.filter((e) => e.type === 'step_complete'), [flowEvents])
  const workflowDone  = useMemo(() =>
    flowEvents.find((e) => e.type === 'workflow_complete' || e.type === 'workflow_failed' || e.type === 'run_result'),
  [flowEvents])

  const isActive = status === 'pending' || status === 'running'

  if (stepStarts.length === 0 && !workflowDone) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-2">
        {isActive ? (
          <>
            <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-blue-400">等待任务启动…</span>
          </>
        ) : (
          <>
            <span className="text-2xl opacity-20">⏳</span>
            <span className="text-xs">暂无执行记录</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="py-2">
      {stepStarts.map((start, idx) => {
        const complete     = stepCompletes[idx]
        const isDone       = !!complete
        const isFailed     = !isDone && !!workflowDone && workflowDone.type === 'workflow_failed'
        const isCurrentStep = !isDone && idx === stepStarts.length - 1 && isActive

        return (
          <ProgressNode
            key={idx}
            label={String(start.data?.message ?? `步骤 ${idx + 1}`)}
            startedAt={start.timestamp}
            completedAt={complete?.timestamp}
            isDone={isDone}
            isActive={isCurrentStep}
            isFailed={isFailed}
          />
        )
      })}

      {workflowDone && (
        <ProgressNode
          label={workflowDone.type === 'workflow_failed' ? '任务失败' : '任务完成'}
          startedAt={workflowDone.timestamp}
          completedAt={workflowDone.data?.duration_seconds ? workflowDone.timestamp : undefined}
          isDone
          isTerminal
          isFailed={workflowDone.type === 'workflow_failed'}
        />
      )}
    </div>
  )
}

/* ── LogViewerModal ──────────────────────────────────────────────────────── */

interface LogFile {
  filename:      string
  size_bytes:    number
  modified:      string
  entries_count: number
  project_name?: string
}

interface LogEntry {
  timestamp: string
  level:     string
  message:   string
  run_id?:   string
  extra?:    Record<string, unknown>
}

const logLevelCls: Record<string, string> = {
  DEBUG:   'text-gray-500',
  INFO:    'text-blue-400',
  WARNING: 'text-amber-400',
  ERROR:   'text-red-400',
}

function LogViewerModal({ open, onClose, projectName }: {
  open:        boolean
  onClose:     () => void
  projectName: string
}) {
  const [files,          setFiles]          = useState<LogFile[]>([])
  const [selectedFile,   setSelectedFile]   = useState<string | null>(null)
  const [entries,        setEntries]        = useState<LogEntry[]>([])
  const [filesLoading,   setFilesLoading]   = useState(false)
  const [contentLoading, setContentLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Fetch file list when modal opens
  useEffect(() => {
    if (!open) return
    setFiles([])
    setSelectedFile(null)
    setEntries([])
    setFilesLoading(true)
    apiClient
      .get<{ logs: LogFile[] }>('/logs/', { params: { project_name: projectName } })
      .then((r) => {
        setFiles(r.data.logs)
        if (r.data.logs.length > 0) setSelectedFile(r.data.logs[0].filename)
      })
      .catch(() => toast.error('无法加载日志文件列表'))
      .finally(() => setFilesLoading(false))
  }, [open, projectName])

  // Fetch entries when selected file changes
  useEffect(() => {
    if (!selectedFile) return
    setContentLoading(true)
    apiClient
      .get<{ entries: LogEntry[] }>(`/logs/${selectedFile}`, { params: { limit: 1000 } })
      .then((r) => {
        setEntries(r.data.entries)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .catch(() => toast.error('无法加载日志内容'))
      .finally(() => setContentLoading(false))
  }, [selectedFile])

  return (
    <Modal open={open} onClose={onClose} title={`完整日志 — ${projectName}`} width="xl">
      <div className="flex h-[70vh] min-h-[400px]">
        {/* File list */}
        <div className="w-48 shrink-0 border-r border-border overflow-y-auto p-2 space-y-1">
          {filesLoading ? (
            <div className="space-y-1 pt-1">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-surface-2 rounded animate-pulse" />)}
            </div>
          ) : files.length === 0 ? (
            <p className="text-xs text-gray-600 p-2">暂无日志文件</p>
          ) : (
            files.map((f) => (
              <button
                key={f.filename}
                onClick={() => setSelectedFile(f.filename)}
                className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                  selectedFile === f.filename
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-600/40'
                    : 'text-gray-400 hover:bg-surface-3 hover:text-gray-200 border border-transparent'
                }`}
              >
                <p className="truncate font-medium">{f.filename}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {f.entries_count} 条 · {(f.size_bytes / 1024).toFixed(1)} KB
                </p>
              </button>
            ))
          )}
        </div>

        {/* Log content */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-surface-0">
          {!selectedFile ? (
            <div className="flex items-center justify-center h-full text-xs text-gray-600">
              选择左侧文件以查看内容
            </div>
          ) : contentLoading ? (
            <div className="flex items-center justify-center h-full text-xs text-gray-500 gap-2">
              <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              加载中…
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-gray-600">暂无日志内容</div>
          ) : (
            entries.map((entry, i) => {
              const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false })
              return (
                <div key={i} className="flex gap-2 px-3 py-1 text-[11px] font-mono border-b border-border/20 hover:bg-surface-3/20">
                  <span className="text-gray-600 shrink-0 w-20 text-right">{time}</span>
                  <span className={`shrink-0 w-16 font-semibold ${logLevelCls[entry.level] ?? 'text-gray-400'}`}>
                    {entry.level}
                  </span>
                  {entry.run_id && (
                    <span className="text-gray-700 shrink-0">[{entry.run_id.slice(0, 8)}]</span>
                  )}
                  <span className="text-gray-300 break-all leading-relaxed flex-1">{entry.message}</span>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </Modal>
  )
}

/* ── Cache helpers ───────────────────────────────────────────────────────── */

const CACHE_PREFIX = 'run_detail_'
const CACHE_TTL_MS = 5 * 60 * 1000

function readRunCache(runId: string): RunDetail | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${runId}`)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: RunDetail; ts: number }
    if (data.status !== 'success' && data.status !== 'failed') {
      if (Date.now() - ts > CACHE_TTL_MS) return null
    }
    return data
  } catch { return null }
}

function writeRunCache(runId: string, data: RunDetail) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${runId}`, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* ignore */ }
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate  = useNavigate()
  const isAdmin   = useAuthStore((s) => s.isAdmin())

  const [run,        setRun]        = useState<RunDetail | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError,   setApiError]   = useState(false)
  const [showLogs,   setShowLogs]   = useState(false)

  // Live event subscription
  const { events, status: liveStatus, loading: eventsLoading, refresh: refreshEvents } = useRunEvents(runId ?? null)

  const loadRun = useCallback(async (isManual = false) => {
    if (!runId) return
    if (isManual) setRefreshing(true)

    if (!isManual) {
      const cached = readRunCache(runId)
      if (cached) {
        setRun(cached)
        setLoading(false)
        if (cached.status !== 'pending' && cached.status !== 'running') return
      }
    }

    try {
      const data = await runsApi.get(runId)
      setRun(data)
      setApiError(false)
      writeRunCache(runId, data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (!status || (status !== 500 && status !== 503)) {
        toast.error('加载运行详情失败')
      }
      setApiError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [runId])

  useEffect(() => { loadRun(false) }, [loadRun])

  // Poll metadata while active
  useEffect(() => {
    if (!run || !runId) return
    if (run.status !== 'pending' && run.status !== 'running') return
    const t = setInterval(() => loadRun(false), 5_000)
    return () => clearInterval(t)
  }, [run?.status, runId, loadRun])

  const handleRefresh = useCallback(() => {
    loadRun(true)
    refreshEvents()
  }, [loadRun, refreshEvents])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-2 rounded animate-pulse" />
        <div className="h-96 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!run) {
    if (apiError && runId) {
      return (
        <div className="flex flex-col h-full gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded">
              无法加载运行元数据
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="xs" loading={refreshing} onClick={() => loadRun(true)}>重试</Button>
              <Button variant="ghost" size="xs" onClick={() => navigate('/runs')}>← 返回列表</Button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <EmptyState icon="🔍" title="Run 不存在"
        action={<Button variant="secondary" onClick={() => navigate('/runs')}>返回列表</Button>} />
    )
  }

  const dur = run.finished_at
    ? dayjs(run.finished_at).diff(dayjs(run.started_at), 'second')
    : null
  const isActive = run.status === 'pending' || run.status === 'running'
  const displayStatus = isActive ? liveStatus : run.status

  const typeLabel: Record<string, string> = {
    new: '新建', secondary: '二次开发', auto: '自动',
    validate: '验证', resume: '恢复', orchestration: '编排', cicd: 'CI/CD',
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        crumbs={[
          { label: 'Runs', to: '/runs' },
          { label: run.project_name, to: `/solutions/${run.solution_id}/projects/${run.project_id}` },
          { label: run.run_id.slice(0, 8) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="text-[11px] text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                运行中
              </span>
            )}
            <Button variant="ghost" size="xs" loading={refreshing} onClick={handleRefresh}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                <polyline points="23,4 23,10 17,10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              刷新
            </Button>
            <Button variant="ghost" size="xs" onClick={() => navigate(-1)}>← 返回</Button>
          </div>
        }
      />

      {/* Meta card */}
      <div className="bg-surface-1 border border-border rounded-xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[11px] text-gray-500 mb-1">状态</p>
            <StatusBadge status={displayStatus} />
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">类型</p>
            <span className="text-gray-300 text-xs">{typeLabel[run.run_type] ?? run.run_type}</span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">项目</p>
            <button className="text-brand-400 hover:text-brand-300 text-xs transition-colors"
              onClick={() => navigate(`/solutions/${run.solution_id}/projects/${run.project_id}`)}>
              {run.project_name}
            </button>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">Solution</p>
            <span className="text-gray-400 text-xs">{run.solution_name}</span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">耗时</p>
            <span className="text-gray-300 text-xs">{dur !== null ? `${dur}s` : '进行中…'}</span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">开始时间</p>
            <span className="text-gray-400 text-xs">{dayjs(run.started_at).format('MM-DD HH:mm:ss')}</span>
          </div>
          {run.finished_at && (
            <div>
              <p className="text-[11px] text-gray-500 mb-1">结束时间</p>
              <span className="text-gray-400 text-xs">{dayjs(run.finished_at).format('MM-DD HH:mm:ss')}</span>
            </div>
          )}
          <div>
            <p className="text-[11px] text-gray-500 mb-1">Run ID</p>
            <span className="text-gray-500 font-mono text-[11px]">{run.run_id}</span>
          </div>
        </div>
        {run.error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
            {run.error}
          </div>
        )}
      </div>

      {/* Progress axis */}
      <div className="bg-surface-1 border border-border rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">执行进度</span>
            <span className="text-[11px] text-gray-600">{events.filter((e) => !isLogEvent(e)).filter((e) => e.type === 'step_start').length} 个步骤</span>
            {eventsLoading && (
              <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowLogs(true)}
              className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
              查看完整日志
            </button>
          )}
        </div>

        {/* Timeline */}
        <div className="px-5 py-3">
          <WorkflowProgressAxis events={events} status={displayStatus} />
        </div>
      </div>

      {/* Validation report */}
      {run.result?.validation_report && (
        <div className="bg-surface-1 border border-border rounded-xl p-5">
          <ValidationReportView report={run.result.validation_report} />
        </div>
      )}

      {/* Log viewer modal (admin only) */}
      {isAdmin && (
        <LogViewerModal
          open={showLogs}
          onClose={() => setShowLogs(false)}
          projectName={run.project_name}
        />
      )}
    </div>
  )
}
