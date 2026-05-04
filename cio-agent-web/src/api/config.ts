import { apiClient } from './client'
import type { GlobalConfig, ProjectConfig } from './types'

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
// ─── Project config defaults ──────────────────────────────────────────────────

export function emptyProjectConfig(): ProjectConfig {
  return {
    model: 'Minimax-M2.7',
    llm_url: 'https://api.poe.com',
    claude_alias: 'haiku',
    programmer: 'claude',
    temperature: 0.05,
    max_tokens: 4096,
    timeout: 300,
    file_limit: 30,
    architect_prompt: 'default',
    engineer_prompt: 'default',
    models: {
      cio_naming_model: 'default',
      cio_decision_model: 'default',
      cio_executor_model: 'default',
      architect_model: 'default',
      engineer_model: 'default',
      documenter_model: 'default',
    },
    validation: {
      validate_after_run: false,
      max_fix_rounds: 3,
      model: 'default',
      step_filter: ['V3'],
      stdout_preview_limit: 60000,
      target_coverage: 60,
    },
    claude_md: { enabled: true, model: 'Minimax-M2.7', memory_model: 'default' },
    git: {
      enabled: true,
      user: { name: 'CIO-Agent2', email: 'cio@noreply.local' },
      gitlab: {
        token: 'glpat-hsssW3dIfgvp3uhP3C5ky2M6MQpvOjEKdTpnY3J6OA8.01.171fk7rxk',
        base_url: 'https://gitlab.com',
        namespace: 'EastAI',
        branch: 'main',
      },
      push_strategy: 'on_complete',
      branch_strategy: 'feature_branch',
      feature_branch_prefix: 'cio',
      init_on_new_project: true,
      commit_on_phase: true,
      tag_on_validate: true,
      gitignore_cio_logs: true,
    },
    execution_context_max_turns: 10,
    execution_context_content_limit: 500,
  }
}

export function buildDefaultsFromGlobal(global: GlobalConfig): ProjectConfig {
  const base = emptyProjectConfig()
  return {
    model:        global.model         ?? base.model,
    llm_url:      global.llm_url       ?? base.llm_url,
    claude_alias: global.claude_alias  ?? base.claude_alias,
    programmer:   global.programmer    ?? base.programmer,
    temperature:  base.temperature,
    max_tokens:   base.max_tokens,
    timeout:      base.timeout,
    file_limit:   global.file_limit    ?? base.file_limit,
    architect_prompt: global.architect_prompt ?? base.architect_prompt,
    engineer_prompt:  global.engineer_prompt  ?? base.engineer_prompt,
    models: global.models ?? base.models,
    validation: {
      validate_after_run:   global.validation?.validate_after_run   ?? base.validation!.validate_after_run,
      max_fix_rounds:       global.validation?.max_fix_rounds       ?? base.validation!.max_fix_rounds,
      model:                global.validation?.model                ?? base.validation!.model,
      step_filter:          global.validation?.step_filter          ?? base.validation!.step_filter,
      stdout_preview_limit: global.validation?.stdout_preview_limit ?? base.validation!.stdout_preview_limit,
      target_coverage:      global.validation?.target_coverage      ?? base.validation!.target_coverage,
    },
    claude_md: {
      enabled:      global.claude_md?.enabled      ?? base.claude_md!.enabled,
      model:        global.claude_md?.model        ?? base.claude_md!.model,
      memory_model: global.claude_md?.memory_model ?? base.claude_md!.memory_model,
    },
    git: global.git ?? base.git,
    execution_context_max_turns:
      global.execution_context_max_turns     ?? base.execution_context_max_turns,
    execution_context_content_limit:
      global.execution_context_content_limit ?? base.execution_context_content_limit,
  }
}

export async function getGlobalConfigCached(): Promise<GlobalConfig> {
  const cached = readGlobalConfigCache()
  if (cached) return cached
  const fresh = await configApi.get()
  writeGlobalConfigCache(fresh)
  return fresh
}

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
