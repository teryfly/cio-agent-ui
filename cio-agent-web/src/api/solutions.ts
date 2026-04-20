import { apiClient } from './client'
import type {
  Solution, SolutionDetail, SolutionPermission,
  UUID, Visibility, Permission,
} from './types'

export const solutionsApi = {
  list: () =>
    apiClient.get<{ solutions: Solution[]; total: number }>('/solutions/').then((r) => r.data),

  get: (sid: UUID) =>
    apiClient.get<SolutionDetail>(`/solutions/${sid}`).then((r) => r.data),

  create: (data: { name: string; description?: string; visibility?: Visibility }) =>
    apiClient.post<Solution>('/solutions/', data).then((r) => r.data),

  update: (sid: UUID, data: Partial<{ name: string; description: string; visibility: Visibility }>) =>
    apiClient.put<Solution>(`/solutions/${sid}`, data).then((r) => r.data),

  delete: (sid: UUID) =>
    apiClient.delete<{ success: boolean }>(`/solutions/${sid}`).then((r) => r.data),

  getPermissions: (sid: UUID) =>
    apiClient.get<{ permissions: SolutionPermission[] }>(`/solutions/${sid}/permissions`).then((r) => r.data),

  addPermission: (sid: UUID, data: { user_id: UUID; permission: Permission }) =>
    apiClient.post(`/solutions/${sid}/permissions`, data).then((r) => r.data),

  removePermission: (sid: UUID, targetUserId: UUID) =>
    apiClient.delete(`/solutions/${sid}/permissions/${targetUserId}`).then((r) => r.data),
}