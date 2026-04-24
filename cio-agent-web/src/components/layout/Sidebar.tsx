import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore   } from '../../store/appStore'
import { useAuthStore  } from '../../store/authStore'
import { useRunStore   } from '../../store/runStore'
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

  // Active run count fetched once on mount from server
  const [serverActiveCount, setServerActiveCount] = useState(0)

  const fetchActiveCount = useCallback(() => {
    runsApi.list({ status: 'running' })
      .then((d) => setServerActiveCount(d.active ?? 0))
      .catch(() => {})
  }, [])

  // Load solutions if store is empty (e.g. hard reload)
  useEffect(() => {
    if (solutions.length === 0) {
      solutionsApi.list()
        .then((d) => setSolutions(d.solutions))
        .catch(() => {})
    }
  }, [solutions.length, setSolutions])

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
            <NavItem to="/admin/users"     icon="👥" label="用户管理" />
            <NavItem to="/admin/config"    icon="⚙" label="系统配置" />
            <NavItem to="/admin/logs"      icon="📋" label="日志" />
            <NavItem to="/admin/workspace" icon="📁" label="工作区" />
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-gray-600">cio-agent-ui v0.1.0</p>
      </div>
    </aside>
  )
}
