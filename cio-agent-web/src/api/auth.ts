import { apiClient } from './client'
import type { User, LoginRequest, LoginResponse, RegisterRequest } from './types'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    apiClient.post<User>('/auth/register', data).then((r) => r.data),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),

  refresh: () =>
    apiClient.post<LoginResponse>('/auth/refresh').then((r) => r.data),

  init: (data: RegisterRequest) =>
    apiClient.post<User & { message: string }>('/admin/init', data).then((r) => r.data),

  health: async (): Promise<{ status: string; db: string }> => {
    // Use native fetch (not apiClient) since /health is outside /api/v1 prefix.
    // Apply a 5 s timeout so a hung backend doesn't block the UI indefinitely.
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 5_000)
    try {
      const r = await fetch('/health', { signal: controller.signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    } finally {
      clearTimeout(id)
    }
  },
}