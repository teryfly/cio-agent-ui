import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { knowledgeApi } from '../../api/knowledge'
import { solutionsApi } from '../../api/solutions'
import { projectsApi  } from '../../api/projects'
import type { KnowledgeDocument, Solution, Project, DocType, ScopeType, UUID } from '../../api/types'
import Button        from '../../components/ui/Button'
import Modal         from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState    from '../../components/ui/EmptyState'

/* ── Create / Edit document modal ─────────────────────────────────────────── */

function DocFormModal({
  open, onClose, existing, onSaved,
}: {
  open: boolean
  onClose: () => void
  existing: KnowledgeDocument | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({ title: '', content: '', doc_type: 'md' as DocType })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (existing) setForm({ title: existing.title, content: existing.content ?? '', doc_type: existing.doc_type })
    else          setForm({ title: '', content: '', doc_type: 'md' })
  }, [existing, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setLoading(true)
    try {
      if (existing) {
        await knowledgeApi.update(existing.id, { title: form.title, content: form.content })
        toast.success('文档已更新')
      } else {
        await knowledgeApi.create(form)
        toast.success('文档已创建')
      }
      onSaved()
      onClose()
    } catch { toast.error('操作失败') }
    finally  { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? '编辑文档' : '新建知识文档'} width="lg">
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">标题 *</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="API 设计规范"
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
          <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={10}
            placeholder={form.doc_type === 'url' ? 'https://…' : '# 标题\n\n文档内容…'}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono text-xs leading-relaxed" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>取消</Button>
          <Button variant="primary" type="submit" loading={loading}>{existing ? '保存' : '创建'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Bind document modal ──────────────────────────────────────────────────── */

function BindModal({
  open, onClose, docId, onBound,
}: {
  open: boolean; onClose: () => void; docId: UUID; onBound: () => void
}) {
  const [solutions,    setSolutions]    = useState<Solution[]>([])
  const [projects,     setProjects]     = useState<Project[]>([])
  const [scopeType,    setScopeType]    = useState<ScopeType>('solution')
  const [scopeId,      setScopeId]      = useState<UUID>('')
  const [selectedSol,  setSelectedSol]  = useState<UUID>('')
  const [loading,      setLoading]      = useState(false)
  const [loadingData,  setLoadingData]  = useState(true)

  useEffect(() => {
    if (!open) return
    setLoadingData(true)
    setScopeType('solution')
    setScopeId('')
    setSelectedSol('')
    setProjects([])

    solutionsApi.list()
      .then((d) => {
        setSolutions(d.solutions)
        if (d.solutions[0]) {
          setSelectedSol(d.solutions[0].id)
          // If scopeType is solution, auto-set scopeId to first solution
          setScopeId(d.solutions[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [open])

  // Load projects when selectedSol changes
  useEffect(() => {
    if (!selectedSol) return
    projectsApi.list(selectedSol)
      .then((d) => setProjects(d.projects))
      .catch(() => {})
  }, [selectedSol])

  // Keep scopeId in sync when scopeType is 'solution' and selectedSol changes
  useEffect(() => {
    if (scopeType === 'solution' && selectedSol) {
      setScopeId(selectedSol)
    }
  }, [scopeType, selectedSol])

  const handleScopeTypeChange = (newType: ScopeType) => {
    setScopeType(newType)
    if (newType === 'solution') {
      setScopeId(selectedSol)
    } else {
      setScopeId('')
    }
  }

  const handleSolChange = (newSolId: UUID) => {
    setSelectedSol(newSolId)
    if (scopeType === 'solution') {
      setScopeId(newSolId)
    } else {
      setScopeId('')
    }
  }

  const handleBind = async () => {
    if (!scopeId) { toast.error('请选择绑定目标'); return }
    setLoading(true)
    try {
      await knowledgeApi.bind(docId, { scope_type: scopeType, scope_id: scopeId })
      toast.success('绑定成功')
      onBound()
      onClose()
    } catch { toast.error('绑定失败') }
    finally  { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="绑定文档到 Solution / Project" width="sm">
      <div className="px-5 py-4 space-y-4">
        {loadingData ? (
          <div className="h-20 animate-pulse bg-surface-2 rounded-lg" />
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">绑定类型</label>
              <div className="flex gap-3">
                {([['solution', 'Solution'], ['project', 'Project']] as [ScopeType, string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      className="accent-brand-500"
                      checked={scopeType === val}
                      onChange={() => handleScopeTypeChange(val)}
                    />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">选择 Solution</label>
              <select
                value={selectedSol}
                onChange={(e) => handleSolChange(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
              >
                <option value="">— 选择 Solution —</option>
                {solutions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {scopeType === 'project' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">选择 Project</label>
                <select
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="">— 选择 Project —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={handleBind} loading={loading} disabled={!scopeId}>绑定</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Document row ─────────────────────────────────────────────────────────── */

function DocRow({
  doc,
  onEdit, onDelete, onBind,
}: {
  doc: KnowledgeDocument
  onEdit:   (d: KnowledgeDocument) => void
  onDelete: (d: KnowledgeDocument) => void
  onBind:   (d: KnowledgeDocument) => void
}) {
  const typeIcon: Record<DocType, string> = { md: '📝', txt: '📄', url: '🔗' }

  return (
    <div className="group bg-surface-1 border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-brand-600/30 transition-colors">
      <span className="text-xl shrink-0">{typeIcon[doc.doc_type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{doc.title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {doc.doc_type.toUpperCase()}
          · 创建于 {new Date(doc.created_at).toLocaleDateString('zh-CN')}
        </p>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="xs" onClick={() => onBind(doc)} icon="🔗">绑定</Button>
        <Button variant="ghost" size="xs" onClick={() => onEdit(doc)}>编辑</Button>
        <button onClick={() => onDelete(doc)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function KnowledgePage() {
  const [docs,       setDocs]       = useState<KnowledgeDocument[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [formOpen,   setFormOpen]   = useState(false)
  const [editing,    setEditing]    = useState<KnowledgeDocument | null>(null)
  const [delTarget,  setDelTarget]  = useState<KnowledgeDocument | null>(null)
  const [delLoading, setDelLoading] = useState(false)
  const [bindDoc,    setBindDoc]    = useState<KnowledgeDocument | null>(null)

  const load = () => {
    setLoading(true)
    knowledgeApi.list()
      .then((d) => setDocs(d.documents))
      .catch(() => toast.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    if (!delTarget) return
    setDelLoading(true)
    try {
      await knowledgeApi.delete(delTarget.id)
      toast.success('已删除')
      setDelTarget(null)
      load()
    } catch { toast.error('删除失败') }
    finally  { setDelLoading(false) }
  }

  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">知识库</h1>
          <p className="text-xs text-gray-500 mt-0.5">{docs.length} 个文档</p>
        </div>
        <Button variant="primary" size="sm" icon="+" onClick={() => { setEditing(null); setFormOpen(true) }}>
          新建文档
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文档…"
            className="w-full bg-surface-1 border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-surface-1 rounded-lg h-16 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📚"
          title={search ? '没有匹配的文档' : '还没有知识文档'}
          description={search ? '尝试其他关键词' : '创建 Markdown / 纯文本文档，或绑定外部 URL，在 AI 执行时自动注入上下文'}
          action={!search ? (
            <Button variant="primary" size="sm" icon="+" onClick={() => { setEditing(null); setFormOpen(true) }}>
              创建第一个文档
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              onEdit={(d) => { setEditing(d); setFormOpen(true) }}
              onDelete={setDelTarget}
              onBind={setBindDoc}
            />
          ))}
        </div>
      )}

      <DocFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        existing={editing}
        onSaved={load}
      />
      <BindModal
        open={!!bindDoc}
        onClose={() => setBindDoc(null)}
        docId={bindDoc?.id ?? ''}
        onBound={load}
      />
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
        title="删除文档"
        message={`确定要删除「${delTarget?.title}」吗？将同时解除所有绑定，不可恢复。`}
        confirmLabel="删除"
        danger
        loading={delLoading}
      />
    </div>
  )
}
