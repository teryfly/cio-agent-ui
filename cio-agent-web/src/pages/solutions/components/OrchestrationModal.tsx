import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { projectsApi }     from '../../../api/projects'
import { knowledgeApi }    from '../../../api/knowledge'
import { orchestrationApi } from '../../../api/orchestration'
import { useDraftCache }   from '../../../hooks/useDraftCache'
import type { Project, KnowledgeDocument, LogLevel, UUID } from '../../../api/types'
import Modal  from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'

type KnowledgeMode = 'all' | 'whitelist' | 'skip'

interface Props {
  open:         boolean
  onClose:      () => void
  solutionId:   UUID
  solutionName: string
}

/* ── Project Selector ───────────────────────────────────────────────────── */

function ProjectSelector({
  projects,
  selected,
  onToggle,
}: {
  projects: Project[]
  selected: Set<UUID>
  onToggle: (id: UUID) => void
}) {
  const statusDot: Record<string, { dot: string; cls: string }> = {
    idle:    { dot: '○', cls: 'text-gray-500' },
    running: { dot: '●', cls: 'text-blue-400 animate-pulse' },
    success: { dot: '✓', cls: 'text-green-400' },
    failed:  { dot: '✗', cls: 'text-red-400' },
  }

  const typeCls: Record<string, string> = {
    backend:  'text-purple-400 bg-purple-400/10 border-purple-400/20',
    frontend: 'text-cyan-400   bg-cyan-400/10   border-cyan-400/20',
    library:  'text-amber-400  bg-amber-400/10  border-amber-400/20',
    other:    'text-gray-400   bg-gray-400/10   border-gray-400/20',
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[24px_1fr_80px_64px] gap-2 px-3 py-1.5 bg-surface-3 text-[11px] text-gray-500 font-medium border-b border-border">
        <span />
        <span>项目名称</span>
        <span>类型</span>
        <span>状态</span>
      </div>
      <div className="divide-y divide-border max-h-44 overflow-y-auto">
        {projects.map((p) => {
          const dot = statusDot[p.status] ?? statusDot.idle
          return (
            <label
              key={p.id}
              className="grid grid-cols-[24px_1fr_80px_64px] gap-2 px-3 py-2.5 items-center cursor-pointer hover:bg-surface-3 transition-colors"
            >
              <input
                type="checkbox"
                className="accent-brand-500 w-3.5 h-3.5"
                checked={selected.has(p.id)}
                onChange={() => onToggle(p.id)}
              />
              <span className="text-xs text-gray-200 truncate">{p.name}</span>
              <span className={`text-[10px] font-medium px-1 py-0.5 rounded border w-fit ${typeCls[p.type]}`}>
                {p.type}
              </span>
              <span className={`text-[11px] ${dot.cls}`}>{dot.dot} {p.status}</span>
            </label>
          )
        })}
      </div>
      <div className="px-3 py-1.5 bg-surface-3 text-[11px] text-gray-500 border-t border-border">
        已选 {selected.size} / {projects.length} 个项目
      </div>
    </div>
  )
}

/* ── Inline Knowledge Selector (shared with NewRunModal) ────────────────── */

function InlineKnowledgeSelector({
  solutionId,
  mode,
  onModeChange,
  selected,
  onSelectedChange,
}: {
  solutionId:       UUID
  mode:             KnowledgeMode
  onModeChange:     (m: KnowledgeMode) => void
  selected:         Set<UUID>
  onSelectedChange: (s: Set<UUID>) => void
}) {
  const [docs,    setDocs]    = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'whitelist') return
    setLoading(true)
    knowledgeApi.listBySolution(solutionId)
      .then((d) => {
        setDocs(d.documents)
        onSelectedChange(new Set(d.documents.map((doc) => doc.id)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [mode, solutionId]) // eslint-disable-line

  const toggleDoc = (id: UUID) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else              next.add(id)
    onSelectedChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        {(
          [
            { val: 'all',       label: '全量模式', desc: '自动聚合所有绑定文档' },
            { val: 'whitelist', label: '白名单模式', desc: '手动勾选，所有子任务共享' },
            { val: 'skip',      label: '跳过' },
          ] as { val: KnowledgeMode; label: string; desc?: string }[]
        ).map(({ val, label, desc }) => (
          <label key={val} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              className="accent-brand-500"
              checked={mode === val}
              onChange={() => onModeChange(val)}
            />
            <span className="text-sm text-gray-300">{label}</span>
            {desc && <span className="text-[11px] text-gray-600 hidden sm:inline">（{desc}）</span>}
          </label>
        ))}
      </div>

      {mode === 'whitelist' && (
        <div className="border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-3 text-center text-xs text-gray-500">加载中…</div>
          ) : docs.length === 0 ? (
            <div className="p-3 text-center text-xs text-gray-500">此 Solution 暂无绑定文档</div>
          ) : (
            <div className="divide-y divide-border max-h-36 overflow-y-auto">
              {docs.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-3 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="accent-brand-500 w-3.5 h-3.5"
                    checked={selected.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                  />
                  <span className="text-xs text-gray-200 flex-1 truncate">{doc.title}</span>
                  <span className="text-[10px] text-gray-500">{doc.doc_type.toUpperCase()}</span>
                </label>
              ))}
            </div>
          )}
          <div className="px-3 py-1 bg-surface-3 text-[11px] text-gray-500 border-t border-border">
            已选 {selected.size} / {docs.length} 个文档
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Modal ─────────────────────────────────────────────────────────── */

export default function OrchestrationModal({ open, onClose, solutionId, solutionName }: Props) {
  const navigate = useNavigate()
  const cacheKey = `draft_orch_${solutionId}`
  const { draft, updateDraft, clearDraft, isRestored } = useDraftCache(cacheKey)

  const [projects,     setProjects]     = useState<Project[]>([])
  const [selectedProj, setSelectedProj] = useState<Set<UUID>>(new Set())
  const [userAdjusted, setUserAdjusted] = useState(false)  // true → send explicit array

  const [kMode,        setKMode]        = useState<KnowledgeMode>('all')
  const [selectedDocs, setSelectedDocs] = useState<Set<UUID>>(new Set())
  const [logLevel,     setLogLevel]     = useState<LogLevel>('INFO')
  const [loading,      setLoading]      = useState(false)
  const [projLoading,  setProjLoading]  = useState(false)

  // Load projects when modal opens
  useEffect(() => {
    if (!open) return
    setProjLoading(true)
    projectsApi.list(solutionId)
      .then((d) => {
        setProjects(d.projects)
        setSelectedProj(new Set(d.projects.map((p) => p.id)))
        setUserAdjusted(false)
      })
      .catch(() => {})
      .finally(() => setProjLoading(false))
  }, [open, solutionId])

  const handleToggleProject = (id: UUID) => {
    const next = new Set(selectedProj)
    if (next.has(id)) next.delete(id)
    else              next.add(id)
    setSelectedProj(next)
    setUserAdjusted(true)
  }

  const resolveProjectIds = (): UUID[] | null => {
    if (!userAdjusted) return null
    return Array.from(selectedProj)
  }

  const resolveKnowledgeDocIds = (): UUID[] | null => {
    if (kMode === 'all')       return null
    if (kMode === 'skip')      return []
    return Array.from(selectedDocs)
  }

  const handleSubmit = async () => {
    if (!draft.trim()) {
      toast.error('请输入整体需求描述')
      return
    }
    if (selectedProj.size === 0) {
      toast.error('至少选择 1 个参与项目')
      return
    }
    setLoading(true)
    try {
      const res = await orchestrationApi.start(solutionId, {
        requirement:       draft.trim(),
        project_ids:       resolveProjectIds(),
        knowledge_doc_ids: resolveKnowledgeDocIds(),
        log_level:         logLevel,
      })
      clearDraft()
      toast.success(`编排任务已启动，共 ${res.total_projects} 个项目`)
      onClose()
      navigate(`/runs/${res.run_id}`)
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (code === 'project_locked') toast.error('有项目正在执行中，请稍后再试')
      else toast.error('启动失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`🔀 跨项目编排 — ${solutionName}`} width="lg" persistent={loading}>
      <div className="px-5 py-4 space-y-5">

        {/* Requirement */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            整体需求 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            rows={5}
            placeholder="描述需要跨多个项目协同完成的需求，例如：&#10;实现完整的用户认证功能：&#10;- 后端：JWT 接口&#10;- 前端：登录/注册页面"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none font-mono leading-relaxed"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-gray-600">{draft.length.toLocaleString()} / 50,000</span>
            {isRestored && (
              <span className="text-[11px] text-amber-400">💾 已恢复上次未发送的草稿</span>
            )}
          </div>
        </div>

        {/* Project selector */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-widest">参与项目</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-xs text-gray-500 mb-2">选择参与本次编排的项目（至少选 1 个）：</p>

          {projLoading ? (
            <div className="border border-border rounded-lg h-20 animate-pulse bg-surface-2" />
          ) : (
            <ProjectSelector
              projects={projects}
              selected={selectedProj}
              onToggle={handleToggleProject}
            />
          )}

          {userAdjusted && (
            <p className="text-[11px] text-teal-400 mt-1.5">
              ⚠ 显式勾选的项目不受服务端 max_projects 限制
            </p>
          )}
        </div>

        {/* Knowledge selector */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-widest">知识上下文</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <InlineKnowledgeSelector
            solutionId={solutionId}
            mode={kMode}
            onModeChange={setKMode}
            selected={selectedDocs}
            onSelectedChange={setSelectedDocs}
          />
        </div>

        {/* Log level */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">日志级别</label>
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value as LogLevel)}
            className="bg-surface-2 border border-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
          >
            {(['DEBUG', 'INFO', 'WARNING', 'ERROR'] as LogLevel[]).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={loading}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={!draft.trim() || selectedProj.size === 0}
            icon="🔀"
          >
            启动编排
          </Button>
        </div>
      </div>
    </Modal>
  )
}
