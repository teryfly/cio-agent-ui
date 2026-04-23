import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import toast from 'react-hot-toast'
import { projectsApi } from '../../api/projects'
import { runsApi     } from '../../api/runs'
import type { Project, RunSummary } from '../../api/types'
import Button        from '../../components/ui/Button'
import PageHeader    from '../../components/ui/PageHeader'
import EmptyState    from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { StatusBadge, TypeBadge } from '../../components/ui/StatusBadge'
import RunMonitor  from './components/RunMonitor'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/* ── Run row ─────────────────────────────────────────────────────────────── */

function RunRow({ run, onClick }: { run: RunSummary; onClick: () => void }) {
  const dur = run.finished_at
    ? dayjs(run.finished_at).diff(dayjs(run.started_at), 'second')
    : null

  const typeLabel: Record<string, string> = {
    new:          '新建',
    secondary:    '二次开发',
    auto:         '自动',
    validate:     '验证',
    resume:       '恢复',
    orchestration:'编排',
    cicd:         'CI/CD',
  }

  return (
    <div
      className="group bg-surface-2 border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-brand-600/30 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <StatusBadge status={run.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500">{run.run_id.slice(0, 8)}</span>
          <span className="text-[11px] text-gray-600 bg-surface-3 px-1.5 py-0.5 rounded">
            {typeLabel[run.run_type] ?? run.run_type}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {dayjs(run.started_at).fromNow()}
          {dur !== null && <span className="ml-2">· {dur}s</span>}
          <span className="ml-2">· {run.events_count} 个事件</span>
        </p>
      </div>
      {run.error && (
        <span className="text-[11px] text-red-400 max-w-[200px] truncate">{run.error}</span>
      )}
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        className="text-gray-600 opacity-0 group-hover:opacity-100 shrink-0"
      >
        <polyline points="9,18 15,12 9,6" />
      </svg>
    </div>
  )
}

/* ── Project Summary Panel ───────────────────────────────────────────────── */

function ProjectSummaryPanel({ solutionId, projectId }: { solutionId: string; projectId: string }) {
  const [content, setContent] = useState<string>('')
  const [exists,  setExists]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    projectsApi.getSummary(solutionId, projectId)
      .then((d) => {
        setContent(d.content)
        setExists(d.exists)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [solutionId, projectId])

  if (loading) {
    return <div className="h-12 bg-surface-2 rounded-lg animate-pulse" />
  }

  if (!exists || !content) return null

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className="text-sm font-medium text-gray-300">项目摘要（Documenter）</span>
        </div>
        <span className="text-gray-500 text-xs transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          <pre className="mt-3 text-xs text-gray-400 leading-relaxed whitespace-pre-wrap break-words font-sans max-h-64 overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function ProjectDetailPage() {
  const { solutionId, projectId } = useParams<{ solutionId: string; projectId: string }>()
  const navigate = useNavigate()

  const [project,         setProject]         = useState<Project | null>(null)
  const [runs,            setRuns]            = useState<RunSummary[]>([])
  const [loading,         setLoading]         = useState(true)
  const [runsLoading,     setRunsLoading]     = useState(true)
  const [validateConfirm, setValidateConfirm] = useState(false)
  const [validateLoading, setValidateLoading] = useState(false)
  const [statusFilter,    setStatusFilter]    = useState<string>('all')

  // Inline monitor for a just-launched run
  const [monitorRunId, setMonitorRunId] = useState<string | null>(null)

  const sid = solutionId!
  const pid = projectId!

  const loadProject = useCallback(() => {
    setLoading(true)
    projectsApi.get(sid, pid)
      .then(setProject)
      .catch(() => toast.error('加载项目失败'))
      .finally(() => setLoading(false))
  }, [sid, pid])

  const loadRuns = useCallback(() => {
    setRunsLoading(true)
    runsApi.list({ project_id: pid, ...(statusFilter !== 'all' ? { status: statusFilter } : {}) })
      .then((d) => setRuns(d.runs))
      .catch(() => {})
      .finally(() => setRunsLoading(false))
  }, [pid, statusFilter])

  useEffect(() => { loadProject() }, [loadProject])
  useEffect(() => { loadRuns() },    [loadRuns])

  // Navigate to full-screen run page
  const goToRunPage = (variant: 'auto' | 'new' | 'secondary') => {
    navigate(`/solutions/${sid}/projects/${pid}/run?variant=${variant}`)
  }

  const handleValidate = async () => {
    setValidateLoading(true)
    try {
      const res = await runsApi.validateRun(sid, pid, { fix_rounds: 3 })
      toast.success('验证任务已启动')
      setValidateConfirm(false)
      setMonitorRunId(res.run_id)
      loadRuns()
    } catch {
      toast.error('启动验证失败')
    } finally {
      setValidateLoading(false)
    }
  }

  const filteredRuns = statusFilter === 'all'
    ? runs
    : runs.filter((r) => r.status === statusFilter)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-2 rounded animate-pulse" />
        <div className="h-28 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!project) {
    return (
      <EmptyState
        icon="🔍"
        title="Project 不存在"
        action={
          <Button variant="secondary" onClick={() => navigate(`/solutions/${sid}`)}>
            返回 Solution
          </Button>
        }
      />
    )
  }

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: 'Solutions',    to: '/solutions' },
          { label: project.name,   to: `/solutions/${sid}` },
          { label: project.name },
        ]}
        actions={
          <Button
            variant="ghost"
            size="xs"
            icon="⚙"
            onClick={() => navigate(`/solutions/${sid}/projects/${pid}/config`)}
          >
            配置
          </Button>
        }
      />

      {/* Project header */}
      <div className="bg-surface-1 border border-border rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-gray-100">{project.name}</h1>
              <TypeBadge   type={project.type} />
              <StatusBadge status={project.status as 'idle' | 'running' | 'success' | 'failed'} />
            </div>
            {project.description && (
              <p className="text-sm text-gray-400 mt-1">{project.description}</p>
            )}
            {project.last_run_at && (
              <p className="text-xs text-gray-500 mt-1.5">
                上次运行 {dayjs(project.last_run_at).fromNow()}
              </p>
            )}
          </div>
          {/* Run buttons — navigate to full-screen page */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary"   size="sm" icon="⚡" onClick={() => goToRunPage('auto')}>
              Auto Run
            </Button>
            <Button variant="secondary" size="sm" icon="▶" onClick={() => goToRunPage('new')}>
              New Run
            </Button>
            <Button variant="secondary" size="sm" icon="↺" onClick={() => goToRunPage('secondary')}>
              Secondary
            </Button>
            <Button variant="secondary" size="sm" icon="✓" onClick={() => setValidateConfirm(true)}>
              Validate
            </Button>
          </div>
        </div>
      </div>

      {/* Inline run monitor (appears after launching validate from this page) */}
      {monitorRunId && (
        <div className="mb-5 bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">实时监控</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="xs" onClick={() => navigate(`/runs/${monitorRunId}`)}>
                全屏查看
              </Button>
              <Button variant="ghost" size="xs" onClick={() => { setMonitorRunId(null); loadRuns() }}>
                收起
              </Button>
            </div>
          </div>
          <div className="h-72">
            <RunMonitor runId={monitorRunId} inline />
          </div>
        </div>
      )}

      {/* Project summary (Documenter) */}
      <div className="mb-5">
        <ProjectSummaryPanel solutionId={sid} projectId={pid} />
      </div>

      {/* Run history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-300">运行历史</h2>
          <div className="flex items-center gap-1">
            {(['all', 'running', 'success', 'failed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[11px] px-2 py-1 rounded transition-colors ${
                  statusFilter === s
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {s === 'all' ? '全部' : s}
              </button>
            ))}
            <button
              onClick={loadRuns}
              className="ml-2 text-gray-500 hover:text-gray-300 transition-colors p-1"
              title="刷新"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,4 23,10 17,10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        {runsLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface-2 rounded-lg h-14 animate-pulse" />
            ))}
          </div>
        ) : filteredRuns.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="暂无运行记录"
            description="点击「Auto Run」开始 AI 编码任务"
          />
        ) : (
          <div className="space-y-2">
            {filteredRuns.map((run) => (
              <RunRow
                key={run.run_id}
                run={run}
                onClick={() => navigate(`/runs/${run.run_id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={validateConfirm}
        onClose={() => setValidateConfirm(false)}
        onConfirm={handleValidate}
        title="启动代码验证"
        message="将对当前工作区代码执行全流程验证（安装依赖 → 测试 → Lint），是否继续？"
        confirmLabel="开始验证"
        loading={validateLoading}
      />
    </div>
  )
}
