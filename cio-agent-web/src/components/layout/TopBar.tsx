// ⚠️ This file REPLACES src/components/layout/TopBar.tsx from Phase 1.
// Adds dynamic breadcrumb from URL and active-run notification dot.

import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useAppStore  } from '../../store/appStore'
import { useRunStore  } from '../../store/runStore'

export default function TopBar() {
  const { user, logout }    = useAuthStore()
  const toggleSidebar       = useAppStore((s) => s.toggleSidebar)
  const activeSessions      = useRunStore((s) => s.activeSessions)
  const navigate            = useNavigate()
  const location            = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Count locally-tracked active runs for notification dot
  const activeCount = Object.values(activeSessions).filter(
    (s) => s.status === 'pending' || s.status === 'running'
  ).length

  // Simple breadcrumb from URL segments
  const segments = location.pathname.split('/').filter(Boolean)
  const readableSegment = (s: string): string => {
    if (s === 'solutions')  return 'Solutions'
    if (s === 'knowledge')  return '知识库'
    if (s === 'runs')       return '运行记录'
    if (s === 'admin')      return 'Admin'
    if (s === 'users')      return '用户'
    if (s === 'config')     return '配置'
    if (s === 'logs')       return '日志'
    if (s === 'workspace')  return '工作区'
    if (s === 'projects')   return 'Projects'
    if (s.length === 36 && s.includes('-')) return s.slice(0, 8) + '…'   // UUID
    return s
  }

  const crumbs = segments.map(readableSegment)

  return (
    <header className="h-12 bg-surface-1 border-b border-border flex items-center px-4 gap-3 shrink-0 z-30">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="text-gray-500 hover:text-gray-300 transition-colors p-1 shrink-0"
        aria-label="Toggle sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6"  x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Logo */}
      <button
        onClick={() => navigate('/solutions')}
        className="flex items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity"
      >
        <span className="text-brand-500 text-lg leading-none">⬡</span>
        <span className="font-semibold text-sm text-gray-100 tracking-wide hidden sm:block">cio-agent</span>
      </button>

      {/* Breadcrumb */}
      {crumbs.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-500 min-w-0 overflow-hidden">
          <span className="hidden sm:block text-gray-700">›</span>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <span className="text-gray-700 shrink-0">›</span>}
              <span className={`truncate ${i === crumbs.length - 1 ? 'text-gray-300' : 'text-gray-500'}`}>
                {c}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Active run indicator */}
      {activeCount > 0 && (
        <button
          onClick={() => navigate('/runs')}
          className="flex items-center gap-1.5 text-[11px] text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded-md hover:bg-blue-400/20 transition-colors"
        >
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          {activeCount} 个任务运行中
        </button>
      )}

      {/* User info */}
      <div className="flex items-center gap-3 shrink-0">
        {user && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-[10px] font-semibold text-brand-400">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-gray-400 hidden sm:block">{user.username}</span>
            </div>
            {user.role === 'admin' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-500 border border-brand-600/30">
                ADMIN
              </span>
            )}
          </>
        )}
        <button
          onClick={handleLogout}
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
        >
          退出
        </button>
      </div>
    </header>
  )
}
