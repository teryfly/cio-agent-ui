import { apiClient } from './client'
import type { GlobalConfig } from './types'

export const configApi = {
  get: () =>
    apiClient.get<GlobalConfig>('/config/').then((r) => r.data),

  update: (data: Partial<GlobalConfig>) =>
    apiClient.put<{ success: boolean; message: string }>('/config/', data).then((r) => r.data),

  validate: (data: Partial<GlobalConfig>) =>
    apiClient.post<{ valid: boolean; errors: string[] }>('/config/validate', data).then((r) => r.data),

  getS4C: () =>
    apiClient.get('/config/s4c').then((r) => r.data),

  listUsers: () =>
    apiClient.get<{ users: import('./types').User[]; total: number }>('/users/').then((r) => r.data),

  updateUserRole: (userId: string, role: import('./types').UserRole) =>
    apiClient.put(`/users/${userId}/role`, { role }).then((r) => r.data),
}

// ─── Global config localStorage cache ─────────────────────────────────────────

const GLOBAL_CONFIG_CACHE_KEY = 'cio_global_config_cache'
const GLOBAL_CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface GlobalConfigCache {
  config: GlobalConfig
  ts: number
}

export function readGlobalConfigCache(): GlobalConfig | null {
  try {
    const raw = localStorage.getItem(GLOBAL_CONFIG_CACHE_KEY)
    if (!raw) return null
    const { config, ts }: GlobalConfigCache = JSON.parse(raw)
    if (Date.now() - ts > GLOBAL_CONFIG_CACHE_TTL) return null
    return config
  } catch {
    return null
  }
}

export function writeGlobalConfigCache(config: GlobalConfig): void {
  try {
    const payload: GlobalConfigCache = { config, ts: Date.now() }
    localStorage.setItem(GLOBAL_CONFIG_CACHE_KEY, JSON.stringify(payload))
  } catch { /* ignore */ }
}

export function clearGlobalConfigCache(): void {
  try {
    localStorage.removeItem(GLOBAL_CONFIG_CACHE_KEY)
  } catch { /* ignore */ }
}

// ─── S4C info localStorage cache ───────────────────────────────────────────────

const S4C_CACHE_KEY = 'cio_s4c_cache'
const S4C_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export interface S4CInfo {
  /** Root working directory for solution4cio (e.g. /workspace/solutions) */
  solution_dir?: string
  database_url?: string
  lock_timeout?: number
  heartbeat_interval?: number
  orchestrator_max_projects?: number
  db_status?: string
  [key: string]: unknown
}

export interface S4CCache {
  data: S4CInfo
  ts: number
}

export function readS4CCache(): S4CInfo | null {
  try {
    const raw = localStorage.getItem(S4C_CACHE_KEY)
    if (!raw) return null
    const { data, ts }: S4CCache = JSON.parse(raw)
    if (Date.now() - ts > S4C_CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

export function writeS4CCache(data: S4CInfo): void {
  try {
    const payload: S4CCache = { data, ts: Date.now() }
    localStorage.setItem(S4C_CACHE_KEY, JSON.stringify(payload))
  } catch { /* ignore */ }
}

export function clearS4CCache(): void {
  try {
    localStorage.removeItem(S4C_CACHE_KEY)
  } catch { /* ignore */ }
}

/**
 * Get S4C info: prefer cache, fall back to API and cache the result.
 * Never throws — returns null on failure.
 */
export async function getS4CInfoCached(): Promise<S4CInfo | null> {
  const cached = readS4CCache()
  if (cached) return cached
  try {
    const data = await configApi.getS4C()
    writeS4CCache(data)
    return data
  } catch {
    return null
  }
}
