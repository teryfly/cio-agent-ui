import { apiClient } from './client'
import type { GlobalConfig } from './types'

export const configApi = {
  get: () =>
    apiClient.get<GlobalConfig>('/config/').then((r) => r.data),

  update: (data: Partial<GlobalConfig>) =>
    apiClient.put<{ success: boolean; message: string }>('/config/', data).then((r) => r.data),

  validate: (data: Partial<GlobalConfig>) =>
    apiClient.post<{ valid: boolean; errors: string[] }>('/config/validate', data).then((r) => r.data),

  getAliases: () =>
    apiClient.get<{ aliases: string[] }>('/config/claude-aliases').then((r) => r.data),

  getS4C: () =>
    apiClient.get('/config/s4c').then((r) => r.data),

  listUsers: () =>
    apiClient.get<{ users: import('./types').User[]; total: number }>('/users/').then((r) => r.data),

  updateUserRole: (userId: string, role: import('./types').UserRole) =>
    apiClient.put(`/users/${userId}/role`, { role }).then((r) => r.data),
}