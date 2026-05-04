import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface SummaryItem {
  project_name: string
  size_bytes:   number
  modified:     string
}

interface SummaryDetail {
  project_name: string
  content:      string
  size_bytes:   number
}

/* ── Project row ─────────────────────────────────────────────────────────── */

function ProjectRow({
  item, active, onClick,
}: { item: SummaryItem; active: boolean; onClick: () => void }) {
  const kb   = (item.size_bytes / 1024).toFixed(1)
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
      <p className="text-[11px] text-gray-500 mt-0.5">{kb} KB · {date}</p>
    </button>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function SummaryPage() {
  const [items,   setItems]   = useState<SummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail,  setDetail]  = useState<SummaryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filter,  setFilter]  = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient.get<{ summaries: SummaryItem[] }>('/cio/summary')
      .then((r) => setItems(r.data.summaries))
      .catch(() => toast.error('加载摘要列表失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (name: string) => {
    setSelected(name)
    setDetailLoading(true)
    setDetail(null)
    apiClient.get<SummaryDetail>(`/cio/summary/${encodeURIComponent(name)}`)
      .then((r) => setDetail(r.data))
      .catch(() => toast.error('加载摘要内容失败'))
      .finally(() => setDetailLoading(false))
  }

  const filtered = filter
    ? items.filter((i) => i.project_name.toLowerCase().includes(filter.toLowerCase()))
    : items

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">执行摘要</h1>
          <p className="text-xs text-gray-500 mt-0.5">{items.length} 个项目</p>
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
              <EmptyState icon="📝" title="暂无执行摘要" />
            ) : (
              filtered.map((item) => (
                <ProjectRow
                  key={item.project_name}
                  item={item}
                  active={selected === item.project_name}
                  onClick={() => handleSelect(item.project_name)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: markdown content viewer */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface-1 border border-border rounded-xl overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="📝" title="选择左侧项目以查看执行摘要" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-2 shrink-0">
                <span className="text-xs text-brand-400 font-medium">{selected}</span>
                {detail && (
                  <span className="text-[11px] text-gray-600 ml-auto">
                    {(detail.size_bytes / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-surface-0">
                {detailLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-500">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
                    加载中…
                  </div>
                ) : detail ? (
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {detail.content}
                  </pre>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
