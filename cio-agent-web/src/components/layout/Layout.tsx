import { Outlet } from 'react-router-dom'
import TopBar  from './TopBar'
import Sidebar from './Sidebar'
import { useAppStore } from '../../store/appStore'

export default function Layout() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)

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