import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { runsApi } from '../../api/runs'
import type { RunSummary } from '../../api/types'
import Button     from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { StatusBadge } from '../../components/ui/StatusBadge'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

type StatusFilter = 'all' | 'pending' | 'running' | 'success' | 'failed'

/* ── localStorage cache helpers ───────────────────────────────────────────── */

const RUNS_CACHE_KEY = 'all_runs_cache'
const RUNS_CACHE_TTL = 60 * 1000 // 1 分钟

interface RunsCache {
  runs:      RunSummary[]
  total:     number
  active:    number
  completed: number
  filter:    StatusFilter
  ts:        number
}

function readRunsCache(filter: StatusFilter): RunsCache | null {
  try {
    const raw = localStorage.getItem(RUNS_CACHE_KEY)
    if (!raw) return null
    const cache: RunsCache = JSON.parse(raw)
    if (cache.filter !== filter) return null
    if (Date.now() - cache.ts > RUNS_CACHE_TTL) return null
    return cache
  } catch {
    return null
  }
}

function writeRunsCache(data: Omit<RunsCache, 'ts'>) {
  try {
    localStorage.setItem(RUNS_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
  } catch { /* ignore */ }
}

/* ── Refresh icon ─────────────────────────────────────────────────────────── */

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`mr-1 ${spinning ? 'animate-spin' : ''}`}>
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function AllRunsPage() {
  const navigate = useNavigate()
  const [runs,       setRuns]       = useState<RunSummary[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats,      setStats]      = useState({ total: 0, active: 0, completed: 0 })
  const [filter,     setFilter]     = useState<StatusFilter>('all')

  // Load runs — tries cache first, then API
  const load = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true)
    } else {
      // Try cache first on initial/filter load
      const cached = readRunsCache(filter)
      if (cached) {
        setRuns(cached.runs)
        setStats({ total: cached.total, active: cached.active, completed: cached.completed })
        setLoading(false)
        return
      }
    }

    try {
      const d = await runsApi.list(filter !== 'all' ? { status: filter } : undefined)
      setRuns(d.runs)
      setStats({ total: d.total, active: d.active, completed: d.completed })
      writeRunsCache({ runs: d.runs, total: d.total, active: d.active, completed: d.completed, filter })
    } catch {
      /* silently ignore */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  // Load on mount and when filter changes
  useEffect(() => {
    setLoading(true)
    load(false)
  }, [load])

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all',     label: `全部 (${stats.total})` },
    { key: 'running', label: `进行中 (${stats.active})` },
    { key: 'success', label: '成功' },
    { key: 'failed',  label: '失败' },
  ]

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">运行记录</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            全部 {stats.total} 条 · 进行中 {stats.active} 条
          </p>
        </div>
        <Button variant="ghost" size="sm" loading={refreshing} onClick={() => load(true)}>
          <RefreshIcon spinning={refreshing} />
          刷新
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '总计',   val: stats.total,     cls: 'text-gray-300' },
          { label: '进行中', val: stats.active,    cls: 'text-blue-400' },
          { label: '已完成', val: stats.completed, cls: 'text-green-400' },
        ].map((s) => (
          <div key={s.label} className="bg-surface-1 border border-border rounded-lg px-4 py-3">
            <p className="text-[11px] text-gray-500">{s.label}</p>
            <p className={`text-xl font-semibold mt-0.5 ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === f.key
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface-1 rounded-lg h-16 animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="暂无运行记录"
          description={filter === 'all' ? '还没有任何 AI 编码任务运行过' : `没有状态为「${filter}」的记录`}
        />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const dur = run.finished_at
              ? dayjs(run.finished_at).diff(dayjs(run.started_at), 'second')
              : null
            return (
              <div
                key={run.run_id}
                className="group bg-surface-1 border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-brand-600/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/runs/${run.run_id}`)}
              >
                <StatusBadge status={run.status} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-200 font-medium truncate">{run.project_name}</span>
                    <span className="text-[11px] text-gray-500 truncate">{run.solution_name}</span>
                    <span className="text-[11px] text-gray-600 bg-surface-3 px-1.5 py-0.5 rounded shrink-0">
                      {typeLabel[run.run_type] ?? run.run_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                    <span className="font-mono">{run.run_id.slice(0, 8)}</span>
                    <span>{dayjs(run.started_at).fromNow()}</span>
                    {dur !== null && <span>{dur}s</span>}
                    <span>{run.events_count} 事件</span>
                  </div>
                  {run.error && (
                    <p className="text-[11px] text-red-400 mt-0.5 truncate max-w-lg">{run.error}</p>
                  )}
                </div>

                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-gray-600 opacity-0 group-hover:opacity-100 shrink-0">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
