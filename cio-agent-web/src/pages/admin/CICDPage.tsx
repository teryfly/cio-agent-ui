import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface CICDItem {
  project_name: string
  status:       string
  pipeline_id:  number
  branch:       string
  recorded_at:  string
  modified:     string
}

interface CICDDetail {
  project_name: string
  has_pipeline: boolean
  pipeline_id:  number
  pipeline_url: string
  branch:       string
  mr_iid:       number
  mr_url:       string
  status:       string
  recorded_at:  string
}

/* ── Status badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const cls =
    s === 'success' || s === 'passed'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : s === 'failed' || s === 'error'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : s === 'running' || s === 'pending'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return (
    <span className={`text-[11px] border px-2 py-0.5 rounded-full ${cls}`}>
      {status || '—'}
    </span>
  )
}

/* ── Project row ─────────────────────────────────────────────────────────── */

function ItemRow({
  item, active, onClick,
}: { item: CICDItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border ${
        active
          ? 'border-brand-600/50 bg-brand-600/10 text-brand-400'
          : 'border-transparent hover:bg-surface-3 text-gray-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium truncate flex-1">{item.project_name}</p>
        {item.status && <StatusBadge status={item.status} />}
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {item.branch ? `${item.branch} · ` : ''}
        {item.pipeline_id > 0 ? `#${item.pipeline_id}` : '无流水线'}
      </p>
    </button>
  )
}

/* ── Detail field ────────────────────────────────────────────────────────── */

function DetailField({ label, value, isLink }: { label: string; value: unknown; isLink?: boolean }) {
  const display = String(value ?? '')
  if (!display) return null
  return (
    <div className="flex gap-3 py-2 border-b border-border/30 text-xs">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      {isLink && display.startsWith('http') ? (
        <a
          href={display}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:underline break-all"
        >
          {display}
        </a>
      ) : (
        <span className="text-gray-300 break-all">{display}</span>
      )}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function CICDPage() {
  const [items,   setItems]   = useState<CICDItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail,  setDetail]  = useState<CICDDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filter,  setFilter]  = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient.get<{ cicd: CICDItem[] }>('/cio/cicd')
      .then((r) => setItems(r.data.cicd))
      .catch(() => toast.error('加载 CI/CD 列表失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (name: string) => {
    setSelected(name)
    setDetailLoading(true)
    setDetail(null)
    apiClient.get<CICDDetail>(`/cio/cicd/${encodeURIComponent(name)}`)
      .then((r) => setDetail(r.data))
      .catch(() => toast.error('加载 CI/CD 状态失败'))
      .finally(() => setDetailLoading(false))
  }

  const filtered = filter
    ? items.filter((i) => i.project_name.toLowerCase().includes(filter.toLowerCase()))
    : items

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">CI/CD 状态</h1>
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
              <EmptyState icon="🚀" title="暂无 CI/CD 数据" />
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
              <EmptyState icon="🚀" title="选择左侧项目以查看 CI/CD 状态" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-2 shrink-0">
                <span className="text-xs text-brand-400 font-medium">{selected}</span>
                {detail && <StatusBadge status={detail.status} />}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-500">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
                    加载中…
                  </div>
                ) : detail ? (
                  detail.has_pipeline ? (
                    <div>
                      <DetailField label="流水线 ID"   value={detail.pipeline_id} />
                      <DetailField label="流水线链接"  value={detail.pipeline_url} isLink />
                      <DetailField label="分支"        value={detail.branch} />
                      <DetailField label="MR ID"       value={detail.mr_iid > 0 ? `!${detail.mr_iid}` : ''} />
                      <DetailField label="MR 链接"     value={detail.mr_url} isLink />
                      <DetailField label="状态"        value={detail.status} />
                      <DetailField label="记录时间"    value={
                        detail.recorded_at
                          ? new Date(detail.recorded_at).toLocaleString('zh-CN', { hour12: false })
                          : ''
                      } />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-xs text-gray-600">
                      该项目尚未执行 CI/CD 流水线
                    </div>
                  )
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
