// File: pages/runs/RunDetailPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import toast from 'react-hot-toast'
import { runsApi } from '../../api/runs'
import type { RunDetail, ValidationReport, ValidationOutcome } from '../../api/types'
import Button      from '../../components/ui/Button'
import PageHeader  from '../../components/ui/PageHeader'
import EmptyState  from '../../components/ui/EmptyState'
import { StatusBadge } from '../../components/ui/StatusBadge'
import RunMonitor  from '../projects/components/RunMonitor'
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')
/* ── Validation report viewer ────────────────────────────────────────────── */
const outcomeCls: Record<ValidationOutcome, string> = {
  pass:     'text-green-400 bg-green-400/10 border-green-400/20',
  skip:     'text-gray-400  bg-gray-400/10  border-gray-400/20',
  fixed:    'text-teal-400  bg-teal-400/10  border-teal-400/20',
  fail:     'text-red-400   bg-red-400/10   border-red-400/20',
  escalate: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
}
function ValidationReportView({ report }: { report: ValidationReport }) {
  return (
    <div className="mt-6">
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
/* ── Refresh icon ─────────────────────────────────────────────────────────── */
function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}
/* ── localStorage cache helpers ───────────────────────────────────────────── */
const CACHE_PREFIX = 'run_detail_'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 分钟
function readRunCache(runId: string): RunDetail | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${runId}`)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: RunDetail; ts: number }
    // Only use cache for terminal states (they won't change)
    if (data.status !== 'success' && data.status !== 'failed') {
      if (Date.now() - ts > CACHE_TTL_MS) return null
    }
    return data
  } catch {
    return null
  }
}
function writeRunCache(runId: string, data: RunDetail) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${runId}`, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* ignore */ }
}
/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate  = useNavigate()
  const [run,     setRun]     = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // ✅ 智能轮询：运行中自动刷新
  const loadRun = useCallback(async (isManual = false) => {
    if (!runId) return
    if (isManual) {
      setRefreshing(true)
    }
    // For manual refresh, skip cache
    if (!isManual) {
      const cached = readRunCache(runId)
      if (cached) {
        setRun(cached)
        setLoading(false)
        // 如果缓存的是运行中状态，继续轮询
        if (cached.status === 'pending' || cached.status === 'running') {
          // 继续往下执行，不 return
        } else {
          return // 终态直接返回
        }
      }
    }
    try {
      const data = await runsApi.get(runId)
      setRun(data)
      writeRunCache(runId, data)
    } catch {
      toast.error('加载运行详情失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [runId])
  // ✅ 初始加载
  useEffect(() => {
    loadRun(false)
  }, [loadRun])
  // ✅ 智能轮询：运行中每3秒刷新
  useEffect(() => {
    if (!run || !runId) return
    const isActive = run.status === 'pending' || run.status === 'running'
    if (!isActive) return
    const timer = setInterval(() => {
      loadRun(false)
    }, 3000) // 3秒轮询
    return () => clearInterval(timer)
  }, [run?.status, runId, loadRun])
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-2 rounded animate-pulse" />
        <div className="h-96 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    )
  }
  if (!run) {
    return (
      <EmptyState
        icon="🔍"
        title="Run 不存在"
        action={
          <Button variant="secondary" onClick={() => navigate('/runs')}>返回列表</Button>
        }
      />
    )
  }
  const dur = run.finished_at
    ? dayjs(run.finished_at).diff(dayjs(run.started_at), 'second')
    : null
  const isActive = run.status === 'pending' || run.status === 'running'
  const typeLabel: Record<string, string> = {
    new:           '新建',
    secondary:     '二次开发',
    auto:          '自动',
    validate:      '验证',
    resume:        '恢复',
    orchestration: '编排',
    cicd:          'CI/CD',
  }
  return (
    <div>
      <PageHeader
        crumbs={[
          { label: 'Runs', to: '/runs' },
          { label: run.project_name, to: `/solutions/${run.solution_id}/projects/${run.project_id}` },
          { label: run.run_id.slice(0, 8) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* ✅ 运行中显示自动刷新提示 */}
            {isActive && (
              <span className="text-[11px] text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                自动刷新中
              </span>
            )}
            <Button
              variant="ghost"
              size="xs"
              loading={refreshing}
              onClick={() => loadRun(true)}
            >
              <RefreshIcon />
              刷新
            </Button>
            <Button variant="ghost" size="xs" onClick={() => navigate(-1)}>← 返回</Button>
          </div>
        }
      />
      {/* Run meta card */}
      <div className="bg-surface-1 border border-border rounded-xl p-5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[11px] text-gray-500 mb-1">状态</p>
            <div className="flex items-center gap-2">
              <StatusBadge status={run.status} />
              {isActive && (
                <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                  进行中
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">类型</p>
            <span className="text-gray-300">{typeLabel[run.run_type] ?? run.run_type}</span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">项目</p>
            <button
              className="text-brand-400 hover:text-brand-300 transition-colors text-xs"
              onClick={() => navigate(`/solutions/${run.solution_id}/projects/${run.project_id}`)}
            >
              {run.project_name}
            </button>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">耗时</p>
            <span className="text-gray-300">{dur !== null ? `${dur}s` : '进行中…'}</span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">开始时间</p>
            <span className="text-gray-400 text-xs">
              {dayjs(run.started_at).format('MM-DD HH:mm:ss')}
            </span>
          </div>
          {run.finished_at && (
            <div>
              <p className="text-[11px] text-gray-500 mb-1">结束时间</p>
              <span className="text-gray-400 text-xs">
                {dayjs(run.finished_at).format('MM-DD HH:mm:ss')}
              </span>
            </div>
          )}
          <div>
            <p className="text-[11px] text-gray-500 mb-1">Run ID</p>
            <span className="text-gray-500 font-mono text-[11px]">{run.run_id}</span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">事件数</p>
            <span className="text-gray-400">{run.events_count}</span>
          </div>
        </div>
        {run.error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
            {run.error}
          </div>
        )}
      </div>
      {/* ✅ Event viewer — 使用智能轮询的 RunMonitor */}
      <div className="bg-surface-1 border border-border rounded-xl p-4 mb-4"
        style={{ height: 'calc(100vh - 380px)', minHeight: '400px' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-300">事件记录</h2>
          {isActive && (
            <span className="text-[11px] text-gray-600 bg-surface-3 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              自动更新中
            </span>
          )}
        </div>
        <div style={{ height: 'calc(100% - 32px)' }}>
          <RunMonitor runId={run.run_id} inline />
        </div>
      </div>
      {/* Validation report */}
      {run.result?.validation_report && (
        <div className="bg-surface-1 border border-border rounded-xl p-5">
          <ValidationReportView report={run.result.validation_report} />
        </div>
      )}
    </div>
  )
}