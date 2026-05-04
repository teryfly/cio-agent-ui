import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface ValidationProject {
  project_name:  string
  entries_count: number
  size_bytes:    number
  modified:      string
}

type ValidationReport = Record<string, unknown>

/* ── Outcome badge ───────────────────────────────────────────────────────── */

function OutcomeBadge({ outcome }: { outcome: unknown }) {
  const s = String(outcome ?? '').toLowerCase()
  const cls =
    s === 'pass' || s === 'passed'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : s === 'fail' || s === 'failed'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return (
    <span className={`text-[11px] border px-2 py-0.5 rounded-full ${cls}`}>
      {String(outcome ?? '—')}
    </span>
  )
}

/* ── Report card ─────────────────────────────────────────────────────────── */

function ReportCard({ report }: { report: ValidationReport }) {
  const [expanded, setExpanded] = useState(false)
  const savedAt = report.saved_at as string | undefined
  const outcome = report.overall_outcome ?? report.outcome ?? report.status
  const passed  = report.passed_tests ?? report.passed_steps ?? report.passed
  const failed  = report.failed_tests ?? report.failed_steps ?? report.failed
  const total   = report.total_tests  ?? report.total_steps  ?? report.total

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 transition-colors text-left"
      >
        <OutcomeBadge outcome={outcome} />
        <span className="text-xs text-gray-500 font-mono">
          {savedAt ? new Date(savedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
        </span>
        {(passed !== undefined || failed !== undefined || total !== undefined) && (
          <span className="text-[11px] text-gray-500 ml-1">
            {passed !== undefined && <span className="text-green-400">{String(passed)} 通过</span>}
            {failed !== undefined && <span className="text-red-400 ml-1">{String(failed)} 失败</span>}
            {total  !== undefined && <span className="text-gray-600 ml-1">/ {String(total)}</span>}
          </span>
        )}
        <span className="ml-auto text-gray-600 text-[11px]">{expanded ? '▴' : '▾'}</span>
      </button>
      {expanded && (
        <pre className="px-4 py-3 text-[11px] text-gray-500 bg-surface-0 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  )
}

/* ── Project row ─────────────────────────────────────────────────────────── */

function ProjectRow({
  item, active, onClick,
}: { item: ValidationProject; active: boolean; onClick: () => void }) {
  const date = new Date(item.modified).toLocaleDateString('zh-CN')
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border ${
        active
          ? 'border-brand-600/50 bg-brand-600/10 text-brand-400'
          : 'border-transparent hover:bg-surface-3 text-gray-300'
      }`}
    >
      <p className="text-xs font-medium truncate">{item.project_name}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {item.entries_count} 次验证 · {date}
      </p>
    </button>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function ValidationPage() {
  const [projects, setProjects]         = useState<ValidationProject[]>([])
  const [loading,  setLoading]          = useState(true)
  const [selected, setSelected]         = useState<string | null>(null)
  const [reports,  setReports]          = useState<ValidationReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [filter,   setFilter]           = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient.get<{ validations: ValidationProject[] }>('/cio/validation')
      .then((r) => setProjects(r.data.validations))
      .catch(() => toast.error('加载验证报告列表失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (name: string) => {
    setSelected(name)
    setReportsLoading(true)
    setReports([])
    apiClient.get<{ reports: ValidationReport[] }>(`/cio/validation/${encodeURIComponent(name)}`)
      .then((r) => setReports(r.data.reports))
      .catch(() => toast.error('加载验证报告失败'))
      .finally(() => setReportsLoading(false))
  }

  const filtered = filter
    ? projects.filter((p) => p.project_name.toLowerCase().includes(filter.toLowerCase()))
    : projects

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">验证报告</h1>
          <p className="text-xs text-gray-500 mt-0.5">{projects.length} 个项目</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)] min-h-[500px]">

        {/* Left: project list */}
        <div className="w-60 shrink-0 flex flex-col gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="过滤项目…"
            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500"
          />
          <div className="flex-1 overflow-y-auto space-y-1">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-2 rounded-lg animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <EmptyState icon="✅" title="暂无验证报告" />
            ) : (
              filtered.map((p) => (
                <ProjectRow
                  key={p.project_name}
                  item={p}
                  active={selected === p.project_name}
                  onClick={() => handleSelect(p.project_name)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: reports */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface-1 border border-border rounded-xl overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="✅" title="选择左侧项目以查看验证报告" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-2 shrink-0">
                <span className="text-xs text-brand-400 font-medium">{selected}</span>
                {reports.length > 0 && (
                  <span className="text-[11px] text-gray-600 ml-auto">
                    {reports.length} 条记录
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {reportsLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-500">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
                    加载中…
                  </div>
                ) : reports.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-600">
                    无验证记录
                  </div>
                ) : (
                  reports.map((r, i) => <ReportCard key={i} report={r} />)
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
