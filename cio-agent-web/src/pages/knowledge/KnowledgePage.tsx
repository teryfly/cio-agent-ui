import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { knowledgeApi } from '../../api/knowledge'
import { solutionsApi } from '../../api/solutions'
import { projectsApi  } from '../../api/projects'
import { useDataCache  } from '../../hooks/useDataCache'
import type {
  KnowledgeDocument, KnowledgeBinding,
  Solution, Project,
  DocType, ScopeType, UUID,
} from '../../api/types'
import Button        from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BindingWithLabel extends KnowledgeBinding {
  label: string
}

type TreeNode =
  | { kind: 'unclassified' }
  | { kind: 'solution'; sol: Solution }
  | { kind: 'project'; sol: Solution; proj: Project }

const DOC_TYPE_ICON: Record<DocType, string>  = { md: '📝', txt: '📄', url: '🔗' }
const DOC_TYPE_LABEL: Record<DocType, string> = { md: 'Markdown', txt: 'Plain Text', url: 'URL' }

// ─── Refresh Icon ─────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={spinning ? 'animate-spin' : ''}>
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

// ─── 左侧树形导航 ─────────────────────────────────────────────────────────────

interface TreeProps {
  solutions:   Solution[]
  projectsMap: Record<UUID, Project[]>
  selected:    TreeNode | null
  onSelect:    (n: TreeNode | null) => void
}

function TreeNav({ solutions, projectsMap, selected, onSelect }: TreeProps) {
  const [expanded, setExpanded] = useState<Set<UUID>>(new Set())

  const toggleExpand = (id: UUID) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const isSelected = (node: TreeNode): boolean => {
    if (!selected) return false
    if (selected.kind !== node.kind) return false
    if (node.kind === 'unclassified') return true
    if (node.kind === 'solution' && selected.kind === 'solution') return selected.sol.id === node.sol.id
    if (node.kind === 'project' && selected.kind === 'project') return selected.proj.id === node.proj.id
    return false
  }

  const rowCls = (active: boolean) =>
    `w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
      active ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:text-gray-200 hover:bg-surface-3'
    }`

  return (
    <div className="space-y-0.5">
      <button className={rowCls(!selected)} onClick={() => onSelect(null)}>
        <span className="text-sm">📚</span><span>全部文档</span>
      </button>
      <button className={rowCls(isSelected({ kind: 'unclassified' }))}
        onClick={() => onSelect({ kind: 'unclassified' })}>
        <span className="text-sm">📂</span><span>未绑定</span>
      </button>

      <div className="my-1.5 border-t border-border" />

      {solutions.map((sol) => {
        const projs      = projectsMap[sol.id] ?? []
        const isExpanded = expanded.has(sol.id)
        const solActive  = isSelected({ kind: 'solution', sol })

        return (
          <div key={sol.id}>
            <div className="flex items-center">
              <button onClick={() => toggleExpand(sol.id)}
                className="p-1 text-gray-600 hover:text-gray-400 shrink-0">
                <span className="text-[10px]">{isExpanded ? '▼' : '▸'}</span>
              </button>
              <button
                className={`flex-1 flex items-center gap-1.5 px-1 py-1.5 rounded-md text-xs transition-colors text-left ${
                  solActive ? 'bg-brand-600/20 text-brand-400' : 'text-gray-300 hover:text-gray-100 hover:bg-surface-3'
                }`}
                onClick={() => onSelect({ kind: 'solution', sol })}
              >
                <span>⊞</span>
                <span className="truncate flex-1">{sol.name}</span>
                {sol.visibility === 'shared' && <span className="text-[9px] text-teal-500 shrink-0">shared</span>}
              </button>
            </div>

            {isExpanded && projs.map((proj) => (
              <button key={proj.id}
                className={`w-full flex items-center gap-1.5 pl-7 pr-2 py-1.5 rounded-md text-[11px] transition-colors text-left ${
                  isSelected({ kind: 'project', sol, proj })
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-surface-3'
                }`}
                onClick={() => onSelect({ kind: 'project', sol, proj })}>
                <span>·</span><span className="truncate flex-1">{proj.name}</span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── 文档列表行 ───────────────────────────────────────────────────────────────

function DocListItem({
  doc, active, onClick,
}: { doc: KnowledgeDocument; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-3 border-b border-border/50 transition-colors text-left ${
        active ? 'bg-brand-600/10 border-l-2 border-l-brand-500' : 'hover:bg-surface-3/50'
      }`}>
      <span className="text-base shrink-0 mt-0.5">{DOC_TYPE_ICON[doc.doc_type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{doc.title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {DOC_TYPE_LABEL[doc.doc_type]} · {new Date(doc.created_at).toLocaleDateString('zh-CN')}
        </p>
      </div>
    </button>
  )
}

// ─── 右侧：文档详情面板 ───────────────────────────────────────────────────────

interface DocDetailPanelProps {
  doc:         KnowledgeDocument | null
  solutions:   Solution[]
  projectsMap: Record<UUID, Project[]>
  onSaved:     () => void
  onDeleted:   () => void
}

function DocDetailPanel({ doc, solutions, projectsMap, onSaved, onDeleted }: DocDetailPanelProps) {
  const [editMode,    setEditMode]    = useState(false)
  const [editTitle,   setEditTitle]   = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [bindings,        setBindings]        = useState<BindingWithLabel[]>([])
  const [bindingsLoading, setBindingsLoading] = useState(false)
  const [bindType,   setBindType]   = useState<ScopeType>('solution')
  const [bindSolId,  setBindSolId]  = useState<UUID>('')
  const [bindProjId, setBindProjId] = useState<UUID>('')
  const [binding,    setBinding]    = useState(false)
  const [delConfirm,   setDelConfirm]   = useState(false)
  const [delLoading,   setDelLoading]   = useState(false)
  const [unbindTarget, setUnbindTarget] = useState<BindingWithLabel | null>(null)
  const [unbinding,    setUnbinding]    = useState(false)

  useEffect(() => {
    if (!doc) { setBindings([]); return }
    setEditTitle(doc.title)
    setEditContent(doc.content ?? '')
    setEditMode(false)
    setBindSolId('')
    setBindProjId('')
    setBindType('solution')
    loadBindings(doc.id)
  }, [doc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadBindings = useCallback(async (docId: UUID) => {
    setBindingsLoading(true)
    const found: BindingWithLabel[] = []
    try {
      await Promise.allSettled(
        solutions.map(async (sol) => {
          try {
            const res = await knowledgeApi.listBySolution(sol.id)
            if (res.documents.some((d) => d.id === docId)) {
              found.push({ id: `sol::${sol.id}`, doc_id: docId, scope_type: 'solution', scope_id: sol.id, label: `Solution: ${sol.name}` })
            }
          } catch { /* ignore */ }
          const projs = projectsMap[sol.id] ?? []
          await Promise.allSettled(
            projs.map(async (proj) => {
              try {
                const res = await knowledgeApi.listByProject(sol.id, proj.id, false)
                if (res.documents.some((d) => d.id === docId)) {
                  found.push({ id: `proj::${proj.id}`, doc_id: docId, scope_type: 'project', scope_id: proj.id, label: `${sol.name} / ${proj.name}` })
                }
              } catch { /* ignore */ }
            })
          )
        })
      )
    } finally {
      setBindings(found)
      setBindingsLoading(false)
    }
  }, [solutions, projectsMap])

  const handleSave = async () => {
    if (!doc || !editTitle.trim()) return
    setSaving(true)
    try {
      await knowledgeApi.update(doc.id, { title: editTitle, content: editContent })
      toast.success('已保存')
      setEditMode(false)
      onSaved()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!doc) return
    setDelLoading(true)
    try {
      await knowledgeApi.delete(doc.id)
      toast.success('已删除')
      setDelConfirm(false)
      onDeleted()
    } catch { toast.error('删除失败') }
    finally { setDelLoading(false) }
  }

  const handleBind = async () => {
    if (!doc) return
    const scopeId = bindType === 'solution' ? bindSolId : bindProjId
    if (!scopeId) { toast.error('请选择绑定目标'); return }
    setBinding(true)
    try {
      await knowledgeApi.bind(doc.id, { scope_type: bindType, scope_id: scopeId })
      toast.success('绑定成功')
      setBindSolId('')
      setBindProjId('')
      loadBindings(doc.id)
    } catch { toast.error('绑定失败（可能已绑定）') }
    finally { setBinding(false) }
  }

  const handleUnbind = async () => {
    if (!unbindTarget || !doc) return
    setUnbinding(true)
    try {
      const record = await knowledgeApi.bind(doc.id, { scope_type: unbindTarget.scope_type, scope_id: unbindTarget.scope_id })
      await knowledgeApi.unbind(record.id)
      toast.success('已解除绑定')
      setUnbindTarget(null)
      loadBindings(doc.id)
    } catch { toast.error('解绑失败，请刷新后重试'); setUnbindTarget(null) }
    finally { setUnbinding(false) }
  }

  const bindableProjects = bindSolId ? (projectsMap[bindSolId] ?? []) : []

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <span className="text-5xl mb-4 opacity-20">📄</span>
        <p className="text-sm text-gray-500">点击中间列表中的文档查看详情</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg shrink-0">{DOC_TYPE_ICON[doc.doc_type]}</span>
            {editMode ? (
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 bg-surface-3 border border-border rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-brand-500 min-w-0" />
            ) : (
              <h3 className="text-sm font-semibold text-gray-100 truncate">{doc.title}</h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {editMode ? (
              <>
                <Button variant="ghost" size="xs" onClick={() => { setEditMode(false); setEditTitle(doc.title); setEditContent(doc.content ?? '') }} disabled={saving}>取消</Button>
                <Button variant="primary" size="xs" loading={saving} onClick={handleSave}>保存</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="xs" onClick={() => setEditMode(true)}>编辑</Button>
                <button onClick={() => setDelConfirm(true)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="删除文档">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-500">
          <span>{DOC_TYPE_LABEL[doc.doc_type]}</span>
          <span>·</span>
          <span>创建于 {new Date(doc.created_at).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {doc.doc_type === 'url' ? 'URL' : '内容预览'}
          </p>
          {editMode ? (
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={9}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-brand-500 resize-none font-mono leading-relaxed" />
          ) : (
            <pre className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap break-words max-h-44 overflow-y-auto font-mono bg-surface-2 rounded-lg px-3 py-2">
              {doc.content ?? '（无内容）'}
            </pre>
          )}
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">已绑定的 Solution / Project</p>
          {bindingsLoading ? (
            <div className="space-y-1.5">{[...Array(2)].map((_, i) => <div key={i} className="h-7 bg-surface-3 rounded animate-pulse" />)}</div>
          ) : bindings.length === 0 ? (
            <p className="text-xs text-gray-600 italic">未绑定任何 Solution / Project</p>
          ) : (
            <div className="space-y-1.5">
              {bindings.map((b) => (
                <div key={b.id} className="group flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 rounded-lg border border-border">
                  <span className={`text-[10px] font-medium px-1 py-0.5 rounded border shrink-0 ${b.scope_type === 'solution' ? 'text-teal-400 bg-teal-400/10 border-teal-400/20' : 'text-purple-400 bg-purple-400/10 border-purple-400/20'}`}>
                    {b.scope_type === 'solution' ? 'sol' : 'proj'}
                  </span>
                  <span className="text-xs text-gray-300 flex-1 truncate">{b.label}</span>
                  <button onClick={() => setUnbindTarget(b)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5" title="解除绑定">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">添加绑定</p>
          <div className="space-y-2.5">
            <div className="flex gap-4">
              {(['solution', 'project'] as ScopeType[]).map((val) => (
                <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" className="accent-brand-500" checked={bindType === val} onChange={() => { setBindType(val); setBindProjId('') }} />
                  <span className="text-xs text-gray-300 capitalize">{val}</span>
                </label>
              ))}
            </div>
            <select value={bindSolId} onChange={(e) => { setBindSolId(e.target.value); setBindProjId('') }}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-brand-500">
              <option value="">— 选择 Solution —</option>
              {solutions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {bindType === 'project' && (
              <select value={bindProjId} onChange={(e) => setBindProjId(e.target.value)} disabled={!bindSolId}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-brand-500 disabled:opacity-40">
                <option value="">— 选择 Project —</option>
                {bindableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <Button variant="secondary" size="xs" onClick={handleBind} loading={binding}
              disabled={!bindSolId || (bindType === 'project' && !bindProjId)} icon="🔗">
              绑定
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog open={delConfirm} onClose={() => setDelConfirm(false)} onConfirm={handleDelete}
        title="删除文档" message={`确定要删除「${doc.title}」吗？将同时解除所有绑定，不可恢复。`}
        confirmLabel="删除" danger loading={delLoading} />
      <ConfirmDialog open={!!unbindTarget} onClose={() => setUnbindTarget(null)} onConfirm={handleUnbind}
        title="解除绑定" message={`确定要解除文档与「${unbindTarget?.label ?? ''}」的绑定吗？`}
        confirmLabel="解除绑定" danger loading={unbinding} />
    </div>
  )
}

// ─── 新建文档弹窗 ─────────────────────────────────────────────────────────────

function NewDocModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form,    setForm]    = useState({ title: '', content: '', doc_type: 'md' as DocType })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setForm({ title: '', content: '', doc_type: 'md' })
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setLoading(true)
    try {
      await knowledgeApi.create(form)
      toast.success('文档已创建')
      onSaved()
      onClose()
    } catch { toast.error('创建失败') }
    finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-1 border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        style={{ animation: 'modalIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-gray-100">新建知识文档</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">标题 *</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="API 设计规范" autoFocus
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50" />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">类型</label>
              <select value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value as DocType }))}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
                <option value="md">Markdown</option>
                <option value="txt">Plain Text</option>
                <option value="url">URL</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              {form.doc_type === 'url' ? 'URL *' : '内容 *'}
            </label>
            <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={10}
              placeholder={form.doc_type === 'url' ? 'https://…' : '# 标题\n\n文档内容…'}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono text-xs leading-relaxed" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>取消</Button>
            <Button variant="primary" type="submit" loading={loading}>创建</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const {
    getCache, warmUp,
    getKnowledgeListCache, setKnowledgeListCache, clearKnowledgeListCache,
    getKnowledgeBindingCache, setKnowledgeBindingCache,
  } = useDataCache()

  const [docs,       setDocs]       = useState<KnowledgeDocument[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<KnowledgeDocument | null>(null)
  const [treeNode,   setTreeNode]   = useState<TreeNode | null>(null)
  const [newDocOpen, setNewDocOpen] = useState(false)

  const [solutions,   setSolutions]   = useState<Solution[]>([])
  const [projectsMap, setProjectsMap] = useState<Record<UUID, Project[]>>({})
  const [treeLoading, setTreeLoading] = useState(true)

  // bindingIndex: docId -> { solutionIds: Set, projectIds: Set }
  const [bindingIndex, setBindingIndex] = useState<Map<UUID, { solutionIds: Set<UUID>; projectIds: Set<UUID> }>>(new Map())
  const bindingIndexBuilt = useRef(false)

  /** 从序列化缓存恢复 bindingIndex Map */
  const restoreBindingIndex = useCallback((cache: Record<UUID, { solutionIds: UUID[]; projectIds: UUID[] }>) => {
    const map = new Map<UUID, { solutionIds: Set<UUID>; projectIds: Set<UUID> }>()
    for (const [docId, val] of Object.entries(cache)) {
      map.set(docId, { solutionIds: new Set(val.solutionIds), projectIds: new Set(val.projectIds) })
    }
    setBindingIndex(map)
    bindingIndexBuilt.current = true
  }, [])

  /** 序列化 bindingIndex 并写入缓存 */
  const persistBindingIndex = useCallback((
    map: Map<UUID, { solutionIds: Set<UUID>; projectIds: Set<UUID> }>
  ) => {
    const serialized: Record<UUID, { solutionIds: UUID[]; projectIds: UUID[] }> = {}
    for (const [docId, val] of map.entries()) {
      serialized[docId] = { solutionIds: Array.from(val.solutionIds), projectIds: Array.from(val.projectIds) }
    }
    setKnowledgeBindingCache({ index: serialized })
  }, [setKnowledgeBindingCache])

  /** 从 API 构建 bindingIndex */
  const buildBindingIndex = useCallback(async (
    sols: Solution[], projMap: Record<UUID, Project[]>
  ) => {
    const index = new Map<UUID, { solutionIds: Set<UUID>; projectIds: Set<UUID> }>()
    const getOrCreate = (docId: UUID) => {
      if (!index.has(docId)) index.set(docId, { solutionIds: new Set(), projectIds: new Set() })
      return index.get(docId)!
    }

    await Promise.allSettled(
      sols.map(async (sol) => {
        try {
          const { documents } = await knowledgeApi.listBySolution(sol.id)
          for (const doc of documents) getOrCreate(doc.id).solutionIds.add(sol.id)
        } catch { /* ignore */ }

        const projs = projMap[sol.id] ?? []
        await Promise.allSettled(
          projs.map(async (proj) => {
            try {
              const { documents } = await knowledgeApi.listByProject(sol.id, proj.id, false)
              for (const doc of documents) getOrCreate(doc.id).projectIds.add(proj.id)
            } catch { /* ignore */ }
          })
        )
      })
    )

    setBindingIndex(index)
    bindingIndexBuilt.current = true
    persistBindingIndex(index)
  }, [persistBindingIndex])

  /** 首次加载 docs：读缓存 → 无缓存时拉 API */
  const loadDocs = useCallback(async (forceApi = false) => {
    if (!forceApi) {
      const cached = getKnowledgeListCache()
      if (cached) {
        setDocs(cached.docs)
        return
      }
    }
    const d = await knowledgeApi.list()
    setDocs(d.documents)
    setKnowledgeListCache({ docs: d.documents })
  }, [getKnowledgeListCache, setKnowledgeListCache])

  /** 首次加载树形数据：读缓存 → 无缓存时拉 API */
  const loadTree = useCallback(async (forceApi = false) => {
    setTreeLoading(true)
    try {
      // 1. 尝试从 binding cache 直接恢复（最快路径）
      if (!forceApi) {
        const bindCache = getKnowledgeBindingCache()
        const mainCache = getCache()
        if (bindCache && mainCache && mainCache.solutions.length > 0) {
          setSolutions(mainCache.solutions)
          setProjectsMap(mainCache.projectsMap)
          restoreBindingIndex(bindCache.index)
          setTreeLoading(false)
          return
        }
      }

      // 2. 读主缓存获取 solution/project 树
      let sols: Solution[] = []
      let projMap: Record<UUID, Project[]> = {}
      const mainCache = forceApi ? null : getCache()

      if (mainCache && mainCache.solutions.length > 0) {
        sols = mainCache.solutions
        projMap = mainCache.projectsMap
      } else {
        const cacheData = await warmUp()
        if (cacheData) {
          sols = cacheData.solutions
          projMap = cacheData.projectsMap
        } else {
          const { solutions: s } = await solutionsApi.list()
          sols = s
          const results = await Promise.allSettled(
            s.map((sol) => projectsApi.list(sol.id).then((r) => ({ id: sol.id, projects: r.projects })))
          )
          for (const r of results) {
            if (r.status === 'fulfilled') projMap[r.value.id] = r.value.projects
          }
        }
      }

      setSolutions(sols)
      setProjectsMap(projMap)

      // 3. 重新构建 binding index（后台，不阻塞树渲染）
      buildBindingIndex(sols, projMap)
    } catch { /* ignore */ }
    finally { setTreeLoading(false) }
  }, [getCache, warmUp, getKnowledgeBindingCache, restoreBindingIndex, buildBindingIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    Promise.all([loadDocs(), loadTree()])
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** 手动刷新：清所有 knowledge 相关缓存，重新拉取 */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    clearKnowledgeListCache()
    bindingIndexBuilt.current = false
    try {
      await Promise.all([loadDocs(true), loadTree(true)])
      toast.success('数据已更新')
    } catch {
      toast.error('刷新失败')
    } finally {
      setRefreshing(false)
    }
  }, [clearKnowledgeListCache, loadDocs, loadTree])

  const handleDocDeleted = () => {
    setSelected(null)
    clearKnowledgeListCache()
    loadDocs(true)
  }

  const handleDocSaved = () => {
    clearKnowledgeListCache()
    loadDocs(true)
    if (selected) {
      knowledgeApi.get(selected.id).then(setSelected).catch(() => {})
    }
  }

  /** 树形过滤 */
  const filterByTree = useCallback((doc: KnowledgeDocument): boolean => {
    if (!treeNode) return true
    const binding = bindingIndex.get(doc.id)
    if (treeNode.kind === 'unclassified') {
      if (!binding) return true
      return binding.solutionIds.size === 0 && binding.projectIds.size === 0
    }
    if (treeNode.kind === 'solution') return !!(binding?.solutionIds.has(treeNode.sol.id))
    if (treeNode.kind === 'project')  return !!(binding?.projectIds.has(treeNode.proj.id))
    return true
  }, [treeNode, bindingIndex])

  const filtered = docs
    .filter(filterByTree)
    .filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))

  const treeLabel = (() => {
    if (!treeNode) return '全部文档'
    if (treeNode.kind === 'unclassified') return '未绑定'
    if (treeNode.kind === 'solution')     return treeNode.sol.name
    if (treeNode.kind === 'project')      return treeNode.proj.name
    return ''
  })()

  return (
    <div className="flex h-[calc(100vh-112px)] min-h-[500px] -mx-6 -mb-6">

      {/* ── 左侧：树形分类 ──────────────────────────────────────────────── */}
      <div className="w-52 shrink-0 border-r border-border flex flex-col bg-surface-1">
        <div className="px-3 pt-3 pb-1 shrink-0 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">分类</p>
          {/* 手动刷新缓存 */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="刷新数据缓存"
            className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-40 transition-colors rounded"
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {treeLoading && !solutions.length ? (
            <div className="space-y-1.5 px-1">
              {[...Array(5)].map((_, i) => <div key={i} className="h-6 bg-surface-3 rounded animate-pulse" />)}
            </div>
          ) : (
            <TreeNav
              solutions={solutions} projectsMap={projectsMap}
              selected={treeNode}
              onSelect={(node) => { setTreeNode(node); setSelected(null) }}
            />
          )}
        </div>
      </div>

      {/* ── 中间：文档列表 ──────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-surface-0">
        <div className="px-3 py-3 border-b border-border bg-surface-1 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-300 truncate">
              {treeLabel}
              <span className="ml-1.5 text-[11px] font-normal text-gray-500">({filtered.length})</span>
            </p>
            <Button variant="primary" size="xs" icon="+" onClick={() => setNewDocOpen(true)}>新建</Button>
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索文档…"
              className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div>{[...Array(6)].map((_, i) => <div key={i} className="h-14 border-b border-border/50 animate-pulse bg-surface-2/30" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <span className="text-3xl mb-3 opacity-30">📭</span>
              <p className="text-xs text-gray-500">{search ? '没有匹配的文档' : '此分类下暂无文档'}</p>
            </div>
          ) : (
            filtered.map((doc) => (
              <DocListItem key={doc.id} doc={doc} active={selected?.id === doc.id} onClick={() => setSelected(doc)} />
            ))
          )}
        </div>
      </div>

      {/* ── 右侧：文档详情 ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden bg-surface-1">
        <DocDetailPanel
          doc={selected}
          solutions={solutions}
          projectsMap={projectsMap}
          onSaved={handleDocSaved}
          onDeleted={handleDocDeleted}
        />
      </div>

      <NewDocModal
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        onSaved={() => {
          clearKnowledgeListCache()
          loadDocs(true)
        }}
      />
    </div>
  )
}
