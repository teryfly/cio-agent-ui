import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface CheckpointItem {
  project_name: string
  size_bytes:   number
  modified:     string
}

interface CheckpointDetail {
  project_name:     string
  exists:           boolean
  data:             Record<string, unknown>
}

/* ── Checkpoint item row ─────────────────────────────────────────────────── */

function ItemRow({
  item, active, onClick,
}: { item: CheckpointItem; active: boolean; onClick: () => void }) {
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

/* ── Checkpoint detail viewer ────────────────────────────────────────────── */

function DetailField({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === '') return null
  const display =
    typeof value === 'boolean'
      ? value ? '✓ 是' : '✗ 否'
      : Array.isArray(value)
      ? value.join(', ') || '(空)'
      : String(value)
  return (
    <div className="flex gap-3 py-1.5 border-b border-border/30 text-xs">
      <span className="w-36 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-300 break-all">{display}</span>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function CheckpointsPage() {
  const [items,   setItems]   = useState<CheckpointItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail,  setDetail]  = useState<CheckpointDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filter,  setFilter]  = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient.get<{ checkpoints: CheckpointItem[] }>('/cio/checkpoints')
      .then((r) => setItems(r.data.checkpoints))
      .catch(() => toast.error('加载检查点列表失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (name: string) => {
    setSelected(name)
    setDetailLoading(true)
    setDetail(null)
    apiClient.get<CheckpointDetail>(`/cio/checkpoints/${encodeURIComponent(name)}`)
      .then((r) => setDetail(r.data))
      .catch(() => toast.error('加载检查点详情失败'))
      .finally(() => setDetailLoading(false))
  }

  const filtered = filter
    ? items.filter((i) => i.project_name.toLowerCase().includes(filter.toLowerCase()))
    : items

  const cp = detail?.data

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">检查点</h1>
          <p className="text-xs text-gray-500 mt-0.5">{items.length} 个项目有检查点</p>
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
              <EmptyState icon="🔖" title="暂无检查点" />
            ) : (
              filtered.map((item) => (
                <ItemRow
                  key={item.project_name}
                  item={item}
                  active={selected === item.project_name}
                  onClick={() => handleSelect(item.project_name)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface-1 border border-border rounded-xl overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="🔖" title="选择左侧项目以查看检查点" />
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-border bg-surface-2 shrink-0">
                <span className="text-xs text-brand-400 font-medium">{selected}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-500">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
                    加载中…
                  </div>
                ) : cp ? (
                  <div>
                    <DetailField label="项目名称"         value={cp.project_name as string} />
                    <DetailField label="关联 ID"          value={cp.correlation_id as string} />
                    <DetailField label="当前步骤"         value={cp.current_step as string} />
                    <DetailField label="失败步骤"         value={cp.failed_step as string} />
                    <DetailField label="已完成阶段"       value={cp.completed_phases as string[]} />
                    <DetailField label="最后失败阶段"     value={cp.last_failed_phase as string} />
                    <DetailField label="需求"             value={cp.requirement as string} />
                    <DetailField label="项目目录"         value={cp.project_dir as string} />
                    <DetailField label="A-CTD 可用"       value={cp.a_ctd_available as boolean} />
                    <DetailField label="B-CTD 数量"       value={cp.b_ctd_count as number} />
                    <div className="mt-4">
                      <p className="text-[11px] text-gray-600 mb-2">原始数据</p>
                      <pre className="text-[11px] text-gray-500 bg-surface-0 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(cp, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
