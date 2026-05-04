import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import TopBar  from './TopBar'
import Sidebar from './Sidebar'
import { useAppStore  } from '../../store/appStore'
import { useDataCache } from '../../hooks/useDataCache'
import { getS4CInfoCached } from '../../api/config'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

export default function Layout() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const { warmUp } = useDataCache()
  const setToken = useAuthStore((s) => s.setToken)

  // 首次挂载（登录后进入主界面）时预热缓存（solutions/projects/knowledge + S4C）
  useEffect(() => {
    warmUp().catch(() => {})
    // Warm up S4C cache in background — result stored in localStorage for
    // use by ProjectConfigPage's "Copy config JSON" feature.
    getS4CInfoCached().catch(() => {})
    // 刷新页面时若 token 未过期则自动续期（重置后端登录时间）
    authApi.refresh().then((res) => setToken(res.access_token)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-0">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className={`flex-1 overflow-y-auto transition-all duration-200 ${
            collapsed ? 'ml-0' : ''
          }`}
        >
          <div className="min-h-full p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
