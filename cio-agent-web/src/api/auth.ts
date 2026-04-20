import { apiClient } from './client'
import type { User, LoginRequest, LoginResponse, RegisterRequest } from './types'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    apiClient.post<User>('/auth/register', data).then((r) => r.data),

  me: () =>
    apiClient.get<User>('/auth/me').then((r) => r.data),

  init: (data: RegisterRequest) =>
    apiClient.post<User & { message: string }>('/admin/init', data).then((r) => r.data),

  health: () =>
    fetch('/health').then((r) => r.json()) as Promise<{ status: string; db: string }>,
}