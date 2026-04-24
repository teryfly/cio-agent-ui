import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Solution, Project, ProjectConfig, UUID } from '../api/types'

interface AppState {
  solutions: Solution[]
  projects: Record<UUID, Project[]>
  projectConfigs: Record<UUID, ProjectConfig>
  selectedSolutionId: UUID | null
  sidebarCollapsed: boolean
  /** Timestamp of last full cache warm-up (ms since epoch) */
  cacheWarmUpAt: number

  setSolutions: (s: Solution[]) => void
  setProjects:  (sid: UUID, p: Project[]) => void
  setProjectConfig: (pid: UUID, c: ProjectConfig) => void
  setSelectedSolution: (sid: UUID | null) => void
  toggleSidebar: () => void
  setCacheWarmUpAt: (ts: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      solutions: [],
      projects: {},
      projectConfigs: {},
      selectedSolutionId: null,
      sidebarCollapsed: false,
      cacheWarmUpAt: 0,

      setSolutions: (solutions) => set({ solutions }),
      setProjects:  (sid, projects) =>
        set((s) => ({ projects: { ...s.projects, [sid]: projects } })),
      setProjectConfig: (pid, config) =>
        set((s) => ({ projectConfigs: { ...s.projectConfigs, [pid]: config } })),
      setSelectedSolution: (sid) => set({ selectedSolutionId: sid }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCacheWarmUpAt: (ts) => set({ cacheWarmUpAt: ts }),
    }),
    {
      name: 'cio-app-storage',
      // Persist solutions + projects map so they're available immediately on next load
      partialize: (state) => ({
        solutions: state.solutions,
        projects: state.projects,
        sidebarCollapsed: state.sidebarCollapsed,
        cacheWarmUpAt: state.cacheWarmUpAt,
      }),
    }
  )
)