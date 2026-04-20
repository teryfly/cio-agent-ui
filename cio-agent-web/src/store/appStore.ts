import { create } from 'zustand'
import type { Solution, Project, ProjectConfig, UUID } from '../api/types'

interface AppState {
  solutions: Solution[]
  projects: Record<UUID, Project[]>
  projectConfigs: Record<UUID, ProjectConfig>
  selectedSolutionId: UUID | null
  sidebarCollapsed: boolean

  setSolutions: (s: Solution[]) => void
  setProjects:  (sid: UUID, p: Project[]) => void
  setProjectConfig: (pid: UUID, c: ProjectConfig) => void
  setSelectedSolution: (sid: UUID | null) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  solutions: [],
  projects: {},
  projectConfigs: {},
  selectedSolutionId: null,
  sidebarCollapsed: false,

  setSolutions: (solutions) => set({ solutions }),
  setProjects:  (sid, projects) =>
    set((s) => ({ projects: { ...s.projects, [sid]: projects } })),
  setProjectConfig: (pid, config) =>
    set((s) => ({ projectConfigs: { ...s.projectConfigs, [pid]: config } })),
  setSelectedSolution: (sid) => set({ selectedSolutionId: sid }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))