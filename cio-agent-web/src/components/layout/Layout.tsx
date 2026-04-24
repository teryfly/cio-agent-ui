import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import TopBar  from './TopBar'
import Sidebar from './Sidebar'
import { useAppStore  } from '../../store/appStore'
import { useDataCache } from '../../hooks/useDataCache'

export default function Layout() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const { warmUp } = useDataCache()

  // 首次挂载（登录后进入主界面）时预热缓存
  useEffect(() => {
    warmUp().catch(() => {})
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