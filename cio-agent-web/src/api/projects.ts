import { apiClient } from './client'
import type { Project, ProjectConfig, ProjectType, UUID } from './types'

export const projectsApi = {
  list: (sid: UUID) =>
    apiClient
      .get<{ projects: Project[]; total: number }>(`/solutions/${sid}/projects/`)
      .then((r) => r.data),

  get: (sid: UUID, pid: UUID) =>
    apiClient.get<Project>(`/solutions/${sid}/projects/${pid}`).then((r) => r.data),

  create: (sid: UUID, data: { name: string; project_type?: ProjectType; description?: string }) =>
    apiClient.post<Project>(`/solutions/${sid}/projects/`, data).then((r) => r.data),

  update: (sid: UUID, pid: UUID, data: Partial<{ description: string }>) =>
    apiClient.put<Project>(`/solutions/${sid}/projects/${pid}`, data).then((r) => r.data),

  delete: (sid: UUID, pid: UUID) =>
    apiClient
      .delete<{ success: boolean }>(`/solutions/${sid}/projects/${pid}`)
      .then((r) => r.data),

  getLockStatus: (sid: UUID, pid: UUID) =>
    apiClient
      .get<{ locked: boolean; locked_by_user_id?: UUID }>(
        `/solutions/${sid}/projects/${pid}/lock`
      )
      .then((r) => r.data),

  getConfig: (sid: UUID, pid: UUID) =>
    apiClient
      .get<{ project_id: UUID; project_name: string; config: ProjectConfig }>(
        `/solutions/${sid}/projects/${pid}/config`
      )
      .then((r) => r.data),

  patchConfig: (sid: UUID, pid: UUID, patch: Partial<ProjectConfig>) =>
    apiClient
      .patch<{ project_id: UUID; project_name: string; config: ProjectConfig }>(
        `/solutions/${sid}/projects/${pid}/config`,
        patch
      )
      .then((r) => r.data),

  getSummary: (sid: UUID, pid: UUID) =>
    apiClient
      .get<{ project_id: UUID; project_name: string; content: string; exists: boolean }>(
        `/solutions/${sid}/projects/${pid}/summary`
      )
      .then((r) => r.data),
}