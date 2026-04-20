import { useEffect, useState } from 'react'
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

      {/* Overall */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border mb-3 flex-wrap ${outcomeCls[report.overall_outcome]}`}>
        <span className="text-sm font-medium">{report.overall_outcome.toUpperCase()}</span>
        <span className="text-xs opacity-80 flex-1">{report.summary}</span>
        <span className="text-xs opacity-60 shrink-0">
          {dayjs(report.started_at).format('HH:mm:ss')} → {dayjs(report.completed_at).format('HH:mm:ss')}
        </span>
      </div>

      {/* Steps */}
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

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate  = useNavigate()

  const [run,     setRun]     = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId) return
    runsApi.get(runId)
      .then(setRun)
      .catch(() => toast.error('加载运行详情失败'))
      .finally(() => setLoading(false))
  }, [runId])

  // Periodically refresh until terminal state
  useEffect(() => {
    if (!runId || !run) return
    if (run.status === 'success' || run.status === 'failed') return
    const t = setInterval(() => {
      runsApi.get(runId).then(setRun).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [runId, run])

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

  const typeLabel: Record<string, string> = {
    new:           '新建',
    secondary:     '二次开发',
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
          <Button variant="ghost" size="xs" onClick={() => navigate(-1)}>← 返回</Button>
        }
      />

      {/* Run meta card */}
      <div className="bg-surface-1 border border-border rounded-xl p-5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[11px] text-gray-500 mb-1">状态</p>
            <StatusBadge status={run.status} />
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

      {/* SSE Event Stream */}
      <div className="bg-surface-1 border border-border rounded-xl p-4 mb-4" style={{ height: '520px' }}>
        <h2 className="text-sm font-medium text-gray-300 mb-3">事件流</h2>
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