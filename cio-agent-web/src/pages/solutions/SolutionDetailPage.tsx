import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import toast from 'react-hot-toast'
import { solutionsApi } from '../../api/solutions'
import { projectsApi  } from '../../api/projects'
import { knowledgeApi } from '../../api/knowledge'
import { useDataCache  } from '../../hooks/useDataCache'
import type {
  SolutionDetail, Project, KnowledgeDocument,
  SolutionPermission, ProjectType,
} from '../../api/types'
import Button        from '../../components/ui/Button'
import Modal         from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState    from '../../components/ui/EmptyState'
import PageHeader    from '../../components/ui/PageHeader'
import { StatusBadge, TypeBadge, VisibilityBadge } from '../../components/ui/StatusBadge'
import NewRunModal        from './components/NewRunModal'
import OrchestrationModal from './components/OrchestrationModal'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/* ── Refresh Icon ─────────────────────────────────────────────────────────── */

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      className={spinning ? 'animate-spin' : ''}
    >
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

/* ── New Project Modal ──────────────────────────────────────────────────── */

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

/* ── Projects Tab ─────────────────────────────────────────────────────────── */

function ProjectsTab({
  projects, solutionId, loading, onNew, onDelete, onOrchestrate,
}: {
  projects: Project[]; solutionId: string; loading: boolean
  onNew: () => void; onDelete: (p: Project) => void; onOrchestrate: () => void
}) {
  const navigate = useNavigate()
  const [runModal, setRunModal] = useState<{ project: Project; variant: 'new' | 'secondary' } | null>(null)

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface-2 rounded-lg h-16 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button variant="primary" size="sm" icon="+" onClick={onNew}>New Project</Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon="🗃️" title="还没有 Project"
          description="每个 Project 对应一个代码工程，拥有独立的 AI 工作流"
          action={<Button variant="primary" size="sm" icon="+" onClick={onNew}>创建 Project</Button>}
        />
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id}
              className="group bg-surface-2 border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-brand-600/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-100 truncate">{p.name}</span>
                  <TypeBadge type={p.type} />
                  <StatusBadge status={p.status as 'idle' | 'running' | 'success' | 'failed'} />
                </div>
                {p.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>}
                {p.last_run_at && (
                  <p className="text-[11px] text-gray-600 mt-0.5">上次运行 {dayjs(p.last_run_at).fromNow()}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button variant="primary" size="xs" icon="▶" onClick={() => setRunModal({ project: p, variant: 'new' })}>Run</Button>
                <Button variant="ghost" size="xs" icon="↺" onClick={() => setRunModal({ project: p, variant: 'secondary' })}>Secondary</Button>
                <Button variant="ghost" size="xs" onClick={() => navigate(`/solutions/${solutionId}/projects/${p.id}/config`)}>⚙</Button>
                <Button variant="ghost" size="xs" onClick={() => navigate(`/solutions/${solutionId}/projects/${p.id}`)}>详情</Button>
                <button onClick={() => onDelete(p)} className="p-1 text-gray-600 hover:text-red-400 transition-colors" title="删除">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6" /><path d="M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {projects.length > 1 && (
        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-medium text-gray-400">跨项目编排</p>
            <p className="text-[11px] text-gray-600 mt-0.5">同时协调多个 Project 完成复杂需求</p>
          </div>
          <Button variant="secondary" size="sm" icon="🔀" onClick={onOrchestrate}>Launch Orchestration</Button>
        </div>
      )}

      {runModal && (
        <NewRunModal
          open={!!runModal} onClose={() => setRunModal(null)}
          solutionId={solutionId} projectId={runModal.project.id}
          projectName={runModal.project.name} variant={runModal.variant}
        />
      )}
    </div>
  )
}

/* ── Knowledge Tab ────────────────────────────────────────────────────────── */

function KnowledgeTab({
  docs, loading, onNavigate,
}: { docs: KnowledgeDocument[]; loading: boolean; onNavigate: () => void }) {
  const typeIcon: Record<string, string> = { md: '📝', txt: '📄', url: '🔗' }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => <div key={i} className="bg-surface-2 rounded h-12 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button variant="secondary" size="sm" onClick={onNavigate}>管理知识库 →</Button>
      </div>
      {docs.length === 0 ? (
        <EmptyState icon="📚" title="未绑定任何文档"
          description="将知识文档绑定到 Solution 后，AI 执行时可自动注入上下文" />
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-surface-2 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-base shrink-0">{typeIcon[doc.doc_type] ?? '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{doc.title}</p>
                <p className="text-[11px] text-gray-500">{doc.doc_type.toUpperCase()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Members Tab ──────────────────────────────────────────────────────────── */

function MembersTab({
  permissions, solutionId, onRefresh,
}: { permissions: SolutionPermission[]; solutionId: string; onRefresh: () => void }) {
  const [revokeTarget,  setRevokeTarget]  = useState<SolutionPermission | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setRevokeLoading(true)
    try {
      await solutionsApi.removePermission(solutionId, revokeTarget.user_id)
      toast.success('已撤销权限')
      setRevokeTarget(null)
      onRefresh()
    } catch {
      toast.error('操作失败')
    } finally {
      setRevokeLoading(false)
    }
  }

  const permCls: Record<string, string> = {
    read:  'text-gray-400 bg-gray-400/10 border-gray-400/20',
    write: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  }

  return (
    <div>
      {permissions.length === 0 ? (
        <EmptyState icon="👥" title="暂无协作成员" description="此 Solution 目前仅有 owner 可访问" />
      ) : (
        <div className="space-y-2">
          {permissions.map((p) => (
            <div key={p.user_id}
              className="group bg-surface-2 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-xs font-medium text-brand-400 shrink-0">
                {p.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-200 flex-1 truncate">{p.username}</span>
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${permCls[p.permission]}`}>
                {p.permission}
              </span>
              <button onClick={() => setRevokeTarget(p)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1" title="撤销权限">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!revokeTarget} onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke} title="撤销权限"
        message={`确定要撤销「${revokeTarget?.username}」对此 Solution 的访问权限吗？`}
        confirmLabel="撤销" danger loading={revokeLoading}
      />
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

type Tab = 'projects' | 'knowledge' | 'members'

export default function SolutionDetailPage() {
  const { solutionId } = useParams<{ solutionId: string }>()
  const navigate = useNavigate()
  const {
    getSolutionDetailCache, setSolutionDetailCache, clearSolutionDetailCache,
  } = useDataCache()

  const [solution,    setSolution]    = useState<SolutionDetail | null>(null)
  const [projects,    setProjects]    = useState<Project[]>([])
  const [docs,        setDocs]        = useState<KnowledgeDocument[]>([])
  const [permissions, setPermissions] = useState<SolutionPermission[]>([])
  const [tab,         setTab]         = useState<Tab>('projects')
  const [loadingMain, setLoadingMain] = useState(true)
  const [loadingTab,  setLoadingTab]  = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)
  const [newProjOpen, setNewProjOpen] = useState(false)
  const [orchOpen,    setOrchOpen]    = useState(false)
  const [delProject,  setDelProject]  = useState<Project | null>(null)
  const [delLoading,  setDelLoading]  = useState(false)

  const sid = solutionId!

  /** 从 API 拉取主数据（solution + projects） */
  const fetchMainFromApi = useCallback(async () => {
    const [sol, proj] = await Promise.all([solutionsApi.get(sid), projectsApi.list(sid)])
    setSolution(sol)
    setProjects(proj.projects)
    setSolutionDetailCache(sid, { solution: sol, projects: proj.projects })
    return { solution: sol, projects: proj.projects }
  }, [sid, setSolutionDetailCache])

  /** 首次加载：读缓存 → 无缓存时拉 API */
  useEffect(() => {
    if (!sid) return
    setLoadingMain(true)
    const cached = getSolutionDetailCache(sid)
    if (cached) {
      setSolution(cached.solution)
      setProjects(cached.projects)
      setLoadingMain(false)
      return
    }
    fetchMainFromApi()
      .catch(() => toast.error('加载失败'))
      .finally(() => setLoadingMain(false))
  }, [sid]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 手动刷新 */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    clearSolutionDetailCache(sid)
    try {
      await fetchMainFromApi()
      // 若当前在非 projects tab，同步刷新该 tab 数据
      if (tab === 'knowledge') {
        const d = await knowledgeApi.listBySolution(sid)
        setDocs(d.documents)
      } else if (tab === 'members') {
        const d = await solutionsApi.getPermissions(sid)
        setPermissions(d.permissions)
      }
      toast.success('数据已更新')
    } catch {
      toast.error('刷新失败')
    } finally {
      setRefreshing(false)
    }
  }, [sid, tab, clearSolutionDetailCache, fetchMainFromApi])

  /** Tab 切换时按需加载（不缓存 knowledge/members，量小且变化频繁） */
  useEffect(() => {
    if (!sid) return
    if (tab === 'knowledge') {
      setLoadingTab(true)
      knowledgeApi.listBySolution(sid)
        .then((d) => setDocs(d.documents))
        .catch(() => {})
        .finally(() => setLoadingTab(false))
    }
    if (tab === 'members') {
      setLoadingTab(true)
      solutionsApi.getPermissions(sid)
        .then((d) => setPermissions(d.permissions))
        .catch(() => {})
        .finally(() => setLoadingTab(false))
    }
  }, [sid, tab])

  const reloadProjects = useCallback(() => {
    clearSolutionDetailCache(sid)
    projectsApi.list(sid)
      .then((d) => {
        setProjects(d.projects)
        if (solution) setSolutionDetailCache(sid, { solution, projects: d.projects })
      })
      .catch(() => {})
  }, [sid, solution, clearSolutionDetailCache, setSolutionDetailCache])

  const handleDeleteProject = async () => {
    if (!delProject) return
    setDelLoading(true)
    try {
      await projectsApi.delete(sid, delProject.id)
      toast.success('已删除')
      setDelProject(null)
      reloadProjects()
    } catch {
      toast.error('删除失败')
    } finally {
      setDelLoading(false)
    }
  }

  if (loadingMain) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-surface-2 rounded animate-pulse" />
        <div className="h-32 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!solution) {
    return (
      <EmptyState icon="🔍" title="Solution 不存在"
        action={<Button variant="secondary" onClick={() => navigate('/solutions')}>返回列表</Button>} />
    )
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'projects',  label: 'Projects',  count: projects.length },
    { key: 'knowledge', label: 'Knowledge' },
    { key: 'members',   label: 'Members',   count: permissions.length || undefined },
  ]

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Solutions', to: '/solutions' }, { label: solution.name }]}
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="刷新数据缓存"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 disabled:opacity-40 transition-colors px-2 py-1.5 rounded-lg hover:bg-surface-3 border border-transparent hover:border-border"
          >
            <RefreshIcon spinning={refreshing} />
            <span className="hidden sm:inline">刷新缓存</span>
          </button>
        }
      />

      <div className="bg-surface-1 border border-border rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-gray-100">{solution.name}</h1>
              <VisibilityBadge visibility={solution.visibility} />
            </div>
            {solution.description && <p className="text-sm text-gray-400 mt-1">{solution.description}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5 gap-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-[11px] px-1 py-0.5 rounded bg-surface-3 text-gray-500">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'projects' && (
        <ProjectsTab
          projects={projects} solutionId={sid} loading={false}
          onNew={() => setNewProjOpen(true)}
          onDelete={setDelProject}
          onOrchestrate={() => setOrchOpen(true)}
        />
      )}
      {tab === 'knowledge' && (
        <KnowledgeTab
          docs={docs} loading={loadingTab}
          onNavigate={() => navigate('/knowledge')}
        />
      )}
      {tab === 'members' && (
        <MembersTab
          permissions={permissions} solutionId={sid}
          onRefresh={() => solutionsApi.getPermissions(sid).then((d) => setPermissions(d.permissions))}
        />
      )}

      <NewProjectModal
        open={newProjOpen} onClose={() => setNewProjOpen(false)}
        solutionId={sid} onSaved={reloadProjects}
      />

      <OrchestrationModal
        open={orchOpen} onClose={() => setOrchOpen(false)}
        solutionId={sid} solutionName={solution.name}
      />

      <ConfirmDialog
        open={!!delProject} onClose={() => setDelProject(null)}
        onConfirm={handleDeleteProject} title="删除 Project"
        message={`确定要删除「${delProject?.name}」吗？将级联删除工作区目录，不可恢复。`}
        confirmLabel="删除" danger loading={delLoading}
      />
    </div>
  )
}
