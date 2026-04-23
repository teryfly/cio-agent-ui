import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Layout from '../components/layout/Layout'

// Auth pages
import LoginPage    from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import InitPage     from '../pages/auth/InitPage'

// Main pages
import SolutionsPage      from '../pages/solutions/SolutionsPage'
import SolutionDetailPage from '../pages/solutions/SolutionDetailPage'
import ProjectDetailPage  from '../pages/projects/ProjectDetailPage'
import ProjectConfigPage  from '../pages/projects/ProjectConfigPage'
import KnowledgePage      from '../pages/knowledge/KnowledgePage'
import AllRunsPage        from '../pages/runs/AllRunsPage'
import RunDetailPage      from '../pages/runs/RunDetailPage'
import NewRunPage         from '../pages/runs/NewRunPage'
import UsersPage          from '../pages/admin/UsersPage'
import ConfigPage         from '../pages/admin/ConfigPage'
import LogsPage           from '../pages/admin/LogsPage'
import WorkspacePage      from '../pages/admin/WorkspacePage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const isTokenValid = useAuthStore((s) => s.isTokenValid)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!isTokenValid()) {
    useAuthStore.getState().logout()
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin())
  if (!isAdmin) return <Navigate to="/solutions" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  { path: '/login',    element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/init',     element: <InitPage /> },

  // Full-screen run page — outside Layout (no sidebar/topbar)
  {
    path: '/solutions/:solutionId/projects/:projectId/run',
    element: <RequireAuth><NewRunPage /></RequireAuth>,
  },

  {
    path: '/',
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/solutions" replace /> },
      { path: 'solutions', element: <SolutionsPage /> },
      { path: 'solutions/:solutionId', element: <SolutionDetailPage /> },
      { path: 'solutions/:solutionId/projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'solutions/:solutionId/projects/:projectId/config', element: <ProjectConfigPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'runs', element: <AllRunsPage /> },
      { path: 'runs/:runId', element: <RunDetailPage /> },
      {
        path: 'admin',
        element: <RequireAdmin><Navigate to="/admin/users" replace /></RequireAdmin>,
      },
      { path: 'admin/users',     element: <RequireAdmin><UsersPage /></RequireAdmin> },
      { path: 'admin/config',    element: <RequireAdmin><ConfigPage /></RequireAdmin> },
      { path: 'admin/logs',      element: <RequireAdmin><LogsPage /></RequireAdmin> },
      { path: 'admin/workspace', element: <RequireAdmin><WorkspacePage /></RequireAdmin> },
    ],
  },

  { path: '*', element: <Navigate to="/solutions" replace /> },
])
