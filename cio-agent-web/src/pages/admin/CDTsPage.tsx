import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../../api/client'
import EmptyState from '../../components/ui/EmptyState'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface CdtDoc {
  doc_id:       string
  project_name: string
  run_id:       string
  size_bytes:   number
}

interface CdtDocDetail {
  doc_id:       string
  project_name: string
  run_id:       string
  content:      string
  file_count:   number | null
}

type GroupedDocs = Record<string, Record<string, CdtDoc[]>>

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function groupDocs(docs: CdtDoc[]): GroupedDocs {
  const grouped: GroupedDocs = {}
  for (const doc of docs) {
    if (!grouped[doc.project_name]) grouped[doc.project_name] = {}
    if (!grouped[doc.project_name][doc.run_id]) grouped[doc.project_name][doc.run_id] = []
    grouped[doc.project_name][doc.run_id].push(doc)
  }
  return grouped
}

function shortRunId(run_id: string): string {
  // 2026-04-17_20-23-52_ebf4823c → 20-23-52 ebf4823c
  const parts = run_id.split('_')
  return parts.length >= 3 ? `${parts[1]} ${parts[2]}` : run_id
}

/* ── Doc tree sidebar ────────────────────────────────────────────────────── */

function DocTree({
  grouped,
  selected,
  onSelect,
}: {
  grouped: GroupedDocs
  selected: { project: string; run: string; doc: string } | null
  onSelect: (project: string, run: string, doc: string) => void
}) {
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())
  const [openRuns, setOpenRuns]         = useState<Set<string>>(new Set())

  const toggleProject = (p: string) =>
    setOpenProjects((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n })

  const toggleRun = (key: string) =>
    setOpenRuns((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  return (
    <div className="space-y-0.5">
      {Object.entries(grouped).map(([project, runs]) => {
        const projOpen = openProjects.has(project)
        return (
          <div key={project}>
            <button
              onClick={() => toggleProject(project)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-300 hover:bg-surface-3 transition-colors"
            >
              <span className="text-gray-600">{projOpen ? '▼' : '▸'}</span>
              <span className="flex-1 text-left truncate font-medium">{project}</span>
              <span className="text-gray-600 text-[10px]">{Object.keys(runs).length} runs</span>
            </button>
            {projOpen && Object.entries(runs).map(([run, docs]) => {
              const runKey = `${project}::${run}`
              const runOpen = openRuns.has(runKey)
              return (
                <div key={run} className="ml-3">
                  <button
                    onClick={() => toggleRun(runKey)}
                    className="w-full flex items-center gap-2 px-3 py-1 rounded-md text-xs text-gray-400 hover:bg-surface-3 transition-colors"
                  >
                    <span className="text-gray-600">{runOpen ? '▼' : '▸'}</span>
                    <span className="flex-1 text-left truncate font-mono text-[11px]">{shortRunId(run)}</span>
                    <span className="text-gray-600 text-[10px]">{docs.length}</span>
                  </button>
                  {runOpen && docs.map((doc) => {
                    const isActive =
                      selected?.project === project &&
                      selected?.run === run &&
                      selected?.doc === doc.doc_id
                    return (
                      <button
                        key={doc.doc_id}
                        onClick={() => onSelect(project, run, doc.doc_id)}
                        className={`ml-3 w-full text-left px-3 py-1 rounded-md text-[11px] transition-colors ${
                          isActive
                            ? 'bg-brand-600/20 text-brand-400'
                            : 'text-gray-500 hover:bg-surface-3 hover:text-gray-300'
                        }`}
                      >
                        📄 {doc.doc_id}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function CDTsPage() {
  const [docs,    setDocs]    = useState<CdtDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ project: string; run: string; doc: string } | null>(null)
  const [detail,  setDetail]  = useState<CdtDocDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    apiClient.get<{ documents: CdtDoc[] }>('/documents', {
      params: projectFilter ? { project_name: projectFilter } : {},
    })
      .then((r) => setDocs(r.data.documents))
      .catch(() => toast.error('加载 CDT 文档列表失败'))
      .finally(() => setLoading(false))
  }, [projectFilter])

  const handleSelect = (project: string, run: string, doc: string) => {
    setSelected({ project, run, doc })
    setDetailLoading(true)
    setDetail(null)
    apiClient.get<CdtDocDetail>(`/documents/${encodeURIComponent(project)}/${encodeURIComponent(run)}/${encodeURIComponent(doc)}`)
      .then((r) => setDetail(r.data))
      .catch(() => toast.error('加载文档内容失败'))
      .finally(() => setDetailLoading(false))
  }

  const grouped = groupDocs(docs)
  const projectCount = Object.keys(grouped).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">CDT 文档</h1>
          <p className="text-xs text-gray-500 mt-0.5">{projectCount} 个项目 · {docs.length} 份文档</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)] min-h-[500px]">

        {/* Left: doc tree */}
        <div className="w-60 shrink-0 flex flex-col gap-2">
          <input
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            placeholder="按项目过滤…"
            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500"
          />
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 bg-surface-2 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : docs.length === 0 ? (
              <EmptyState icon="📂" title="暂无 CDT 文档" />
            ) : (
              <DocTree grouped={grouped} selected={selected} onSelect={handleSelect} />
            )}
          </div>
        </div>

        {/* Right: content viewer */}
        <div className="flex-1 min-w-0 flex flex-col bg-surface-1 border border-border rounded-xl overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="📄" title="从左侧选择文档以查看内容" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-2 shrink-0">
                <span className="text-xs text-gray-400 font-mono">
                  {selected.project} / {shortRunId(selected.run)} /
                  <span className="text-brand-400 ml-1">{selected.doc}</span>
                </span>
                {detail?.file_count != null && (
                  <span className="ml-auto text-[11px] text-gray-600">
                    file_count: {detail.file_count}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto bg-surface-0 p-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center h-32 text-xs text-gray-500">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full mr-2" />
                    加载中…
                  </div>
                ) : detail ? (
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
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
