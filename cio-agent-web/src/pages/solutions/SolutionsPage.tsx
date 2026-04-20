import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { solutionsApi } from '../../api/solutions'
import { projectsApi  } from '../../api/projects'
import { useAppStore } from '../../store/appStore'
import type { Solution, Project, Visibility } from '../../api/types'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { StatusBadge, TypeBadge, VisibilityBadge } from '../../components/ui/StatusBadge'

/* ── New/Edit Solution Modal ──────────────────────────────────────────────── */
function SolutionFormModal({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  existing: Solution | null
  onSaved: () => void
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
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? '编辑 Solution' : '新建 Solution'}
      width="sm"
    >
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">名称 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-solution"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">描述</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="可选说明"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">可见性</label>
          <select
            value={vis}
            onChange={(e) => setVis(e.target.value as Visibility)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
          >
            <option value="private">Private（仅自己和授权成员）</option>
            <option value="shared">Shared（团队可见）</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>取消</Button>
          <Button variant="primary" type="submit" loading={loading}>
            {existing ? '保存' : '创建'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Project mini-row inside card ─────────────────────────────────────────── */
function ProjectMiniRow({
  project,
  solutionId,
}: {
  project: Project
  solutionId: string
}) {
  const navigate = useNavigate()
  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-3 cursor-pointer transition-colors group"
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/solutions/${solutionId}/projects/${project.id}`)
      }}
    >
      <StatusBadge status={project.status as 'idle' | 'running' | 'success' | 'failed'} />
      <TypeBadge type={project.type} />
      <span className="text-xs text-gray-300 flex-1 truncate group-hover:text-gray-100 transition-colors">
        {project.name}
      </span>
    </div>
  )
}

/* ── Solution Card ────────────────────────────────────────────────────────── */
function SolutionCard({
  sol,
  projects,
  projectsLoading,
  onEdit,
  onDelete,
}: {
  sol: Solution
  projects: Project[]
  projectsLoading: boolean
  onEdit: (s: Solution) => void
  onDelete: (s: Solution) => void
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
        {/* Actions – visible on hover */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(sol) }}
            className="p-1 text-gray-500 hover:text-gray-200 transition-colors"
            title="编辑"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(sol) }}
            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
            title="删除"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Project list ───────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {projectsLoading ? (
          <div className="space-y-1">
            {[...Array(Math.min(sol.project_count || 2, 3))].map((_, i) => (
              <div key={i} className="h-6 bg-surface-3 rounded animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-gray-600 py-1">暂无项目</p>
        ) : (
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {projects.map((p) => (
              <ProjectMiniRow key={p.id} project={p} solutionId={sol.id} />
            ))}
          </div>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-center mt-auto"
        onClick={() => navigate(`/solutions/${sol.id}`)}
      >
        进入 →
      </Button>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SolutionsPage() {
  const { solutions, setSolutions } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Solution | null>(null)
  const [delTarget, setDelTarget] = useState<Solution | null>(null)
  const [delLoading, setDelLoading] = useState(false)

  /**
   * projectsMap: solutionId → Project[]
   * Populated by fetching GET /solutions/{sid}/projects/ for every solution
   * in parallel after the solution list loads.
   */
  const [projectsMap,     setProjectsMap]     = useState<Record<string, Project[]>>({})
  const [projectsLoading, setProjectsLoading] = useState(false)

  const load = () => {
    setLoading(true)
    solutionsApi.list()
      .then((d) => {
        setSolutions(d.solutions)
        return d.solutions
      })
      .then((sols) => {
        // After the solution list is ready, concurrently fetch each solution's projects
        if (sols.length === 0) return
        setProjectsLoading(true)
        Promise.allSettled(
          sols.map((sol) =>
            projectsApi.list(sol.id).then((r) => ({ id: sol.id, projects: r.projects }))
          )
        ).then((results) => {
          const map: Record<string, Project[]> = {}
          for (const result of results) {
            if (result.status === 'fulfilled') {
              map[result.value.id] = result.value.projects
            }
          }
          setProjectsMap(map)
        }).finally(() => setProjectsLoading(false))
      })
      .catch(() => toast.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">My Solutions</h1>
          <p className="text-xs text-gray-500 mt-0.5">{solutions.length} 个 Solution</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon="+"
          onClick={() => { setEditing(null); setModalOpen(true) }}
        >
          New Solution
        </Button>
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
            />
          ))}
          {/* New card */}
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="bg-surface-1/50 border border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-gray-400 hover:border-brand-600/50 transition-colors min-h-[140px]"
          >
            <span className="text-2xl">＋</span>
            <span className="text-xs">新建 Solution</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <SolutionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existing={editing}
        onSaved={load}
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
    </div>
  )
}
