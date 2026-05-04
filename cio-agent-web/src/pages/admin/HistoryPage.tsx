import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface HistoryProject {
  project_name:  string
  entries_count: number
  size_bytes:    number
  modified:      string
}

interface HistoryEntry {
  timestamp:      string
  correlation_id: string
  requirement:    string
  ctd_text:       string
  mode:           string
  success:        boolean
}

/* ── Project row ─────────────────────────────────────────────────────────── */

function ProjectRow({
  item, active, onClick,
}: { item: HistoryProject; active: boolean; onClick: () => void }) {
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
        {item.entries_count} 次运行 · {date}
      </p>
    </button>
  )
}

/* ── History entry card ──────────────────────────────────────────────────── */

function EntryCard({ entry, index }: { entry: HistoryEntry; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const time = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString('zh-CN', { hour12: false })
    : '—'

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 transition-colors text-left"
      >
        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
          entry.success
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {entry.success ? '✓' : '✗'}
        </span>
        <span className="text-xs text-gray-500 font-mono shrink-0 w-36">{time}</span>
        <span className="flex-1 text-xs text-gray-300 truncate">{entry.requirement || '(无需求记录)'}</span>
        <span className="text-[11px] text-gray-600 shrink-0">{entry.mode || ''}</span>
        <span className="text-gray-600 shrink-0 text-[11px]">{expanded ? '▴' : '▾'}</span>
      </button>
      {expanded && (
        <div className="px-4 py-3 text-xs space-y-2 bg-surface-0">
          <div className="flex gap-2">
            <span className="text-gray-600 w-24 shrink-0">Correlation ID</span>
            <span className="text-gray-400 font-mono">{entry.correlation_id || '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-600 w-24 shrink-0">模式</span>
            <span className="text-gray-400">{entry.mode || '—'}</span>
          </div>
          {entry.requirement && (
            <div>
              <p className="text-gray-600 mb-1">需求</p>
              <pre className="text-gray-400 whitespace-pre-wrap break-all leading-relaxed bg-surface-1 rounded p-2 text-[11px]">
                {entry.requirement}
              </pre>
            </div>
          )}
          {entry.ctd_text && (
            <div>
              <p className="text-gray-600 mb-1">CTD 摘要</p>
              <pre className="text-gray-400 whitespace-pre-wrap break-all leading-relaxed bg-surface-1 rounded p-2 text-[11px] max-h-48 overflow-y-auto">
                {entry.ctd_text}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function HistoryPage() {
  const [projects, setProjects]     = useState<HistoryProject[]>([])
  const [loading,  setLoading]      = useState(true)
  const [selected, setSelected]     = useState<string | null>(null)
  const [entries,  setEntries]      = useState<HistoryEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [filter,   setFilter]       = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient.get<{ history: HistoryProject[] }>('/cio/history')
      .then((r) => setProjects(r.data.history))
      .catch(() => toast.error('加载运行历史列表失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (name: string) => {
    setSelected(name)
    setEntriesLoading(true)
    setEntries([])
    apiClient.get<{ entries: HistoryEntry[] }>(`/cio/history/${encodeURIComponent(name)}`)
      .then((r) => setEntries(r.data.entries.slice().reverse()))
      .catch(() => toast.error('加载运行历史失败'))
      .finally(() => setEntriesLoading(false))
  }

  const filtered = filter
    ? projects.filter((p) => p.project_name.toLowerCase().includes(filter.toLowerCase()))
    : projects

  const successCount = entries.filter((e) => e.success).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">运行历史</h1>
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
              <EmptyState icon="📜" title="暂无运行历史" />
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

        {/* Right: history entries */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface-1 border border-border rounded-xl overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="📜" title="选择左侧项目以查看运行历史" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-2 shrink-0">
                <span className="text-xs text-brand-400 font-medium">{selected}</span>
                {entries.length > 0 && (
                  <span className="text-[11px] text-gray-600 ml-auto">
                    {successCount} 成功 / {entries.length - successCount} 失败 · 共 {entries.length} 次
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {entriesLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-500">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
                    加载中…
                  </div>
                ) : entries.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-600">
                    无历史记录
                  </div>
                ) : (
                  entries.map((entry, i) => (
                    <EntryCard key={i} entry={entry} index={i} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
