import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore   } from '../../store/appStore'
import { useAuthStore  } from '../../store/authStore'
import { useRunStore   } from '../../store/runStore'
import { useDataCache  } from '../../hooks/useDataCache'
import { solutionsApi } from '../../api/solutions'
import { runsApi      } from '../../api/runs'
import type { Solution } from '../../api/types'

function NavItem({
  to, icon, label, badge, end,
}: { to: string; icon: string; label: string; badge?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          isActive
            ? 'bg-brand-600/20 text-brand-400'
            : 'text-gray-400 hover:text-gray-200 hover:bg-surface-3'
        }`
      }
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-medium">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

/* ── Solution tree item ─────────────────────────────────────────────────── */

function SolutionTreeItem({ sol }: { sol: Solution }) {
  const { solutionId } = useParams()
  const navigate = useNavigate()
  const isActive = solutionId === sol.id

  return (
    <div>
      <button
        onClick={() => navigate(`/solutions/${sol.id}`)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
          isActive
            ? 'bg-brand-600/20 text-brand-400'
            : 'text-gray-300 hover:bg-surface-3'
        }`}
      >
        <span className={`text-[10px] transition-transform ${isActive ? 'text-brand-400' : 'text-gray-600'}`}>
          {isActive ? '▼' : '▸'}
        </span>
        <span className="flex-1 text-left truncate text-xs">{sol.name}</span>
        {sol.visibility === 'shared' && (
          <span className="text-[9px] text-teal-500 shrink-0">shared</span>
        )}
      </button>
    </div>
  )
}

/* ── Main Sidebar ─────────────────────────────────────────────────────────── */

export default function Sidebar() {
  const collapsed      = useAppStore((s) => s.sidebarCollapsed)
  const solutions      = useAppStore((s) => s.solutions)
  const setSolutions   = useAppStore((s) => s.setSolutions)
  const isAdmin        = useAuthStore((s) => s.isAdmin())
  const activeSessions = useRunStore((s) => s.activeSessions)
  const navigate       = useNavigate()

  // 使用 useDataCache 的缓存接口，与其他页面共用同一套缓存键
  const { getSolutionsListCache, setSolutionsListCache } = useDataCache()

  // Active run count fetched once on mount from server
  const [serverActiveCount, setServerActiveCount] = useState(0)

  const fetchActiveCount = useCallback(() => {
    runsApi.list({ status: 'running' })
      .then((d) => setServerActiveCount(d.active ?? 0))
      .catch(() => {})
  }, [])

  /**
   * 加载 solutions：
   * 1. 优先从 zustand store 取（已有数据则直接用，无需任何网络请求）
   * 2. store 为空时读 localStorage 缓存（getSolutionsListCache）
   * 3. 缓存也没有时才请求后端 API，并将结果写入缓存
   *
   * 手动刷新由各页面的"刷新缓存"按钮触发（clearSolutionsListCache + fetchFromApi），
   * Sidebar 本身不提供刷新入口，始终遵循缓存优先策略。
   */
  useEffect(() => {
    // zustand store 已有数据（来自上次会话持久化或其他页面写入）
    if (solutions.length > 0) return

    // 尝试读页面级缓存（与 SolutionsPage 共用同一个键）
    const cached = getSolutionsListCache()
    if (cached && cached.solutions.length > 0) {
      setSolutions(cached.solutions)
      return
    }

    // 缓存没有，回退到 API（冷启动或缓存过期场景）
    solutionsApi.list()
      .then((d) => {
        setSolutions(d.solutions)
        // 写入缓存（只写 solutions，projectsMap 留给各页面自行填充）
        const existingCache = getSolutionsListCache()
        setSolutionsListCache({
          solutions: d.solutions,
          projectsMap: existingCache?.projectsMap ?? {},
        })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch active count once on mount only — no auto-refresh
  useEffect(() => {
    fetchActiveCount()
  }, [fetchActiveCount])

  // Also count from local store (reflects launches during this session)
  const localActive = Object.values(activeSessions).filter(
    (s) => s.status === 'pending' || s.status === 'running'
  ).length
  const totalActive = Math.max(serverActiveCount, localActive)

  if (collapsed) return null

  return (
    <aside className="w-56 bg-surface-1 border-r border-border flex flex-col shrink-0 overflow-y-auto">
      <div className="flex-1 py-3 px-2 space-y-0.5">

        {/* Solutions header */}
        <div className="px-3 py-1.5 mb-0.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            Solutions
          </span>
        </div>

        {solutions.map((sol: Solution) => (
          <SolutionTreeItem key={sol.id} sol={sol} />
        ))}

        <button
          onClick={() => navigate('/solutions')}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:text-brand-400 hover:bg-surface-3 rounded-md transition-colors"
        >
          <span>＋</span>
          <span>新建 Solution</span>
        </button>

        <div className="my-2 border-t border-border" />

        <NavItem to="/solutions" icon="⊞" label="所有 Solutions" end />
        <NavItem to="/knowledge" icon="📚" label="知识库" />
        <NavItem to="/runs"      icon="⚡" label="运行记录" badge={totalActive} />

        {isAdmin && (
          <>
            <div className="my-2 border-t border-border" />
            <div className="px-3 py-1.5 mb-0.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Admin
              </span>
            </div>
            <NavItem to="/admin/users"       icon="👥" label="用户管理" />
            <NavItem to="/admin/config"      icon="⚙" label="系统配置" />
            <NavItem to="/admin/logs"        icon="📋" label="日志" />
            <NavItem to="/admin/workspace"   icon="📁" label="工作区" />
            <NavItem to="/admin/cdts"        icon="📑" label="CDT 文档" />
            <NavItem to="/admin/checkpoints" icon="🔖" label="检查点" />
            <NavItem to="/admin/history"     icon="📜" label="运行历史" />
            <NavItem to="/admin/summary"     icon="📝" label="执行摘要" />
            <NavItem to="/admin/validation"  icon="✅" label="验证报告" />
            <NavItem to="/admin/cicd"        icon="🚀" label="CI/CD" />
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-gray-600">cio-agent-ui v0.1.0</p>
      </div>
    </aside>
  )
}
