import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { solutionsApi } from '../../api/solutions'
import { projectsApi  } from '../../api/projects'
import { runsApi      } from '../../api/runs'
import { useAppStore } from '../../store/appStore'
import { useDataCache } from '../../hooks/useDataCache'
import type { Solution, Project, Visibility, ProjectType } from '../../api/types'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { StatusBadge, TypeBadge, VisibilityBadge } from '../../components/ui/StatusBadge'

/* ── Refresh Icon ─────────────────────────────────────────────────────────── */

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      className={spinning ? 'animate-spin' : ''}
    >
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

/* ── New/Edit Solution Modal ──────────────────────────────────────────────── */
function SolutionFormModal({
  open, onClose, existing, onSaved,
}: {
  open: boolean; onClose: () => void; existing: Solution | null; onSaved: () => void
}) {
  const [name, setName]       = useState('')
  const [desc, setDesc]       = useState('')
  const [vis, setVis]         = useState<Visibility>('private')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDesc(existing.description)
      setVis(existing.visibility)
    } else {
      setName('')
      setDesc('')
      setVis('private')
    }
  }, [existing, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      if (existing) {
        await solutionsApi.update(existing.id, { name, description: desc, visibility: vis })
        toast.success('Solution 已更新')
      } else {
        await solutionsApi.create({ name, description: desc, visibility: vis })
        toast.success('Solution 已创建')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (code === 'solution_already_exists') toast.error('名称已存在')
      else toast.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? '编辑 Solution' : '新建 Solution'} width="sm">
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">名称 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-solution"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">描述</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="可选说明"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">可见性</label>
          <select value={vis} onChange={(e) => setVis(e.target.value as Visibility)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
            <option value="private">Private（仅自己和授权成员）</option>
            <option value="shared">Shared（团队可见）</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>取消</Button>
          <Button variant="primary" type="submit" loading={loading}>{existing ? '保存' : '创建'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── New Project Modal ────────────────────────────────────────────────────── */
function NewProjectModal({
  open, onClose, solutionId, onSaved,
}: { open: boolean; onClose: () => void; solutionId: string; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', type: 'backend' as ProjectType, description: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: '', type: 'backend', description: '' })
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    try {
      await projectsApi.create(solutionId, {
        name: form.name,
        project_type: form.type,
        description: form.description,
      })
      toast.success('Project 已创建')
      onSaved()
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (code === 'project_already_exists') toast.error('项目名称已存在')
      else toast.error('创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="新建 Project" width="sm">
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">项目名称 *</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="backend-api" autoFocus
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">类型</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ProjectType }))}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500">
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
            <option value="library">Library</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">描述</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2} placeholder="可选"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>取消</Button>
          <Button variant="primary" type="submit" loading={loading}>创建</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Project mini-row ─────────────────────────────────────────────────────── */
function ProjectMiniRow({
  project, solutionId, onValidate,
}: {
  project: Project; solutionId: string; onValidate: (pid: string) => void
}) {
  const navigate = useNavigate()

  const statusIcon: Record<string, string> = {
    idle: '○', pending: '○', running: '●', success: '✓', failed: '✗',
  }
  const statusColor: Record<string, string> = {
    idle: 'text-gray-500', pending: 'text-gray-500',
    running: 'text-blue-400 animate-pulse', success: 'text-green-400', failed: 'text-red-400',
  }

  return (
    <div className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-surface-3 transition-colors group/row">
      <span className={`text-[10px] shrink-0 w-4 text-center ${statusColor[project.status]}`}>
        {statusIcon[project.status] ?? '○'}
      </span>
      <TypeBadge type={project.type} />
      <button
        className="text-xs text-gray-300 flex-1 truncate text-left group-hover/row:text-gray-100 transition-colors"
        onClick={(e) => { e.stopPropagation(); navigate(`/solutions/${solutionId}/projects/${project.id}`) }}
      >
        {project.name}
      </button>
      <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
        <button
          title="Auto Run"
          onClick={(e) => { e.stopPropagation(); navigate(`/solutions/${solutionId}/projects/${project.id}/run?variant=auto`) }}
          className="text-[10px] px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-400 hover:bg-brand-600/40 transition-colors border border-brand-600/30"
        >
          ▶ Run
        </button>
        <button
          title="验证"
          onClick={(e) => { e.stopPropagation(); onValidate(project.id) }}
          className="text-[10px] px-1.5 py-0.5 rounded bg-surface-4 text-gray-400 hover:text-green-400 hover:bg-green-400/10 transition-colors border border-border"
        >
          ✓
        </button>
      </div>
    </div>
  )
}

/* ── Solution Card ────────────────────────────────────────────────────────── */
function SolutionCard({
  sol, projects, projectsLoading, onEdit, onDelete, onAddProject, onValidateProject,
}: {
  sol: Solution; projects: Project[]; projectsLoading: boolean
  onEdit: (s: Solution) => void; onDelete: (s: Solution) => void
  onAddProject: (sol: Solution) => void
  onValidateProject: (sid: string, pid: string) => void
}) {
  const navigate = useNavigate()

  return (
    <div className="group bg-surface-1 border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-brand-600/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-100 truncate">{sol.name}</h3>
            <VisibilityBadge visibility={sol.visibility} />
          </div>
          {sol.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sol.description}</p>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onAddProject(sol) }}
            className="p-1.5 text-gray-500 hover:text-brand-400 transition-colors rounded hover:bg-brand-600/10" title="新建 Project">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(sol) }}
            className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors rounded hover:bg-surface-3" title="编辑">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(sol) }}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded hover:bg-red-400/10" title="删除">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6" />
              <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {projectsLoading ? (
          <div className="space-y-1">
            {[...Array(Math.min(sol.project_count || 2, 3))].map((_, i) => (
              <div key={i} className="h-6 bg-surface-3 rounded animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <button onClick={() => onAddProject(sol)}
            className="w-full text-xs text-gray-600 hover:text-brand-400 py-2 text-left transition-colors">
            ＋ 添加第一个项目
          </button>
        ) : (
          <div className="space-y-0 max-h-40 overflow-y-auto">
            {projects.map((p) => (
              <ProjectMiniRow
                key={p.id} project={p} solutionId={sol.id}
                onValidate={(pid) => onValidateProject(sol.id, pid)}
              />
            ))}
          </div>
        )}
      </div>

      <Button variant="secondary" size="sm" className="w-full justify-center mt-auto"
        onClick={() => navigate(`/solutions/${sol.id}`)}>
        进入 →
      </Button>
    </div>
  )
}

/* ── Validate confirm ─────────────────────────────────────────────────────── */
interface ValidateTarget { solutionId: string; projectId: string }

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SolutionsPage() {
  const { solutions, setSolutions } = useAppStore()
  const {
    getSolutionsListCache, setSolutionsListCache, clearSolutionsListCache,
  } = useDataCache()
  const navigate = useNavigate()

  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<Solution | null>(null)
  const [delTarget,  setDelTarget]  = useState<Solution | null>(null)
  const [delLoading, setDelLoading] = useState(false)
  const [newProjSol, setNewProjSol] = useState<Solution | null>(null)

  const [projectsMap,     setProjectsMap]     = useState<Record<string, Project[]>>({})
  const [projectsLoading, setProjectsLoading] = useState(false)

  const [validateTarget,  setValidateTarget]  = useState<ValidateTarget | null>(null)
  const [validateLoading, setValidateLoading] = useState(false)

  /** 从缓存中读取数据并更新状态 */
  const applyCache = useCallback((cached: { solutions: Solution[]; projectsMap: Record<string, Project[]> }) => {
    setSolutions(cached.solutions)
    setProjectsMap(cached.projectsMap)
  }, [setSolutions])

  /** 从 API 拉取完整数据，写入缓存，刷新视图 */
  const fetchFromApi = useCallback(async () => {
    const { solutions: sols } = await solutionsApi.list()
    setSolutions(sols)

    const results = await Promise.allSettled(
      sols.map((sol) =>
        projectsApi.list(sol.id).then((r) => ({ id: sol.id, projects: r.projects }))
      )
    )
    const map: Record<string, Project[]> = {}
    for (const result of results) {
      if (result.status === 'fulfilled') map[result.value.id] = result.value.projects
    }
    setProjectsMap(map)

    // 写入页面级缓存
    setSolutionsListCache({ solutions: sols, projectsMap: map })
    return { solutions: sols, projectsMap: map }
  }, [setSolutions, setSolutionsListCache])

  /** 首次加载：优先读缓存，无缓存再拉 API */
  const initialLoad = useCallback(async () => {
    setLoading(true)
    try {
      const cached = getSolutionsListCache()
      if (cached) {
        applyCache(cached)
        setLoading(false)
        return
      }
      await fetchFromApi()
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [getSolutionsListCache, applyCache, fetchFromApi])

  /** 手动刷新：清缓存，强制重新拉 API */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    clearSolutionsListCache()
    try {
      await fetchFromApi()
      toast.success('数据已更新')
    } catch {
      toast.error('刷新失败')
    } finally {
      setRefreshing(false)
    }
  }, [clearSolutionsListCache, fetchFromApi])

  useEffect(() => {
    initialLoad()
  }, [initialLoad])

  /** 写操作后调用：清缓存并重新拉取 */
  const load = useCallback(async () => {
    setProjectsLoading(true)
    clearSolutionsListCache()
    try {
      await fetchFromApi()
    } catch {
      toast.error('加载失败')
    } finally {
      setProjectsLoading(false)
    }
  }, [clearSolutionsListCache, fetchFromApi])

  const handleDelete = async () => {
    if (!delTarget) return
    setDelLoading(true)
    try {
      await solutionsApi.delete(delTarget.id)
      toast.success('已删除')
      setDelTarget(null)
      load()
    } catch {
      toast.error('删除失败')
    } finally {
      setDelLoading(false)
    }
  }

  const handleValidate = async () => {
    if (!validateTarget) return
    setValidateLoading(true)
    try {
      const res = await runsApi.validateRun(validateTarget.solutionId, validateTarget.projectId, { fix_rounds: 3 })
      toast.success('验证已启动')
      setValidateTarget(null)
      navigate(`/runs/${res.run_id}`)
    } catch {
      toast.error('启动验证失败')
    } finally {
      setValidateLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">My Solutions</h1>
          <p className="text-xs text-gray-500 mt-0.5">{solutions.length} 个 Solution</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 手动刷新缓存按钮 */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="刷新数据缓存"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 disabled:opacity-40 transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-3 border border-transparent hover:border-border"
          >
            <RefreshIcon spinning={refreshing} />
            <span className="hidden sm:inline">刷新缓存</span>
          </button>
          <Button variant="primary" size="sm" icon="+"
            onClick={() => { setEditing(null); setModalOpen(true) }}>
            New Solution
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface-1 border border-border rounded-xl p-5 h-52 animate-pulse" />
          ))}
        </div>
      ) : solutions.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="还没有 Solution"
          description="Solution 是项目组的顶层容器，包含多个子项目和知识库"
          action={
            <Button variant="primary" size="sm" icon="+" onClick={() => setModalOpen(true)}>
              创建第一个 Solution
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {solutions.map((sol) => (
            <SolutionCard
              key={sol.id}
              sol={sol}
              projects={projectsMap[sol.id] ?? []}
              projectsLoading={projectsLoading && !(sol.id in projectsMap)}
              onEdit={(s) => { setEditing(s); setModalOpen(true) }}
              onDelete={setDelTarget}
              onAddProject={(s) => setNewProjSol(s)}
              onValidateProject={(sid, pid) => setValidateTarget({ solutionId: sid, projectId: pid })}
            />
          ))}
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="bg-surface-1/50 border border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-gray-400 hover:border-brand-600/50 transition-colors min-h-[140px]"
          >
            <span className="text-2xl">＋</span>
            <span className="text-xs">新建 Solution</span>
          </button>
        </div>
      )}

      <SolutionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existing={editing}
        onSaved={load}
      />

      <NewProjectModal
        open={!!newProjSol}
        onClose={() => setNewProjSol(null)}
        solutionId={newProjSol?.id ?? ''}
        onSaved={() => { load(); setNewProjSol(null) }}
      />

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
        title="删除 Solution"
        message={`确定要删除「${delTarget?.name}」吗？此操作将级联删除所有子项目和工作区目录，不可恢复。`}
        confirmLabel="删除"
        danger
        loading={delLoading}
      />

      <ConfirmDialog
        open={!!validateTarget}
        onClose={() => setValidateTarget(null)}
        onConfirm={handleValidate}
        title="启动代码验证"
        message="将对当前工作区代码执行全流程验证（安装依赖 → 测试 → Lint），是否继续？"
        confirmLabel="开始验证"
        loading={validateLoading}
      />
    </div>
  )
}
