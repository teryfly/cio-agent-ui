// ─── Common ──────────────────────────────────────────────────────────────────

export type UUID = string

export type UserRole = 'admin' | 'user'
export type Permission = 'read' | 'write' | 'admin'
export type Visibility = 'private' | 'shared'
export type ProjectType = 'backend' | 'frontend' | 'library' | 'other'
export type RunStatus = 'pending' | 'running' | 'success' | 'failed'
export type RunType = 'new' | 'secondary' | 'auto' | 'validate' | 'resume' | 'orchestration' | 'cicd'
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'
export type DocType = 'md' | 'txt' | 'url'
export type ScopeType = 'solution' | 'project'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: UUID
  username: string
  role: UserRole
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface RegisterRequest {
  username: string
  password: string
}

// ─── Solution ─────────────────────────────────────────────────────────────────

export interface Solution {
  id: UUID
  name: string
  description: string
  owner_id: UUID
  visibility: Visibility
  project_count: number
  created_at: string
  updated_at: string
}

export interface SolutionDetail extends Solution {
  projects: ProjectSummary[]
}

export interface SolutionPermission {
  user_id: UUID
  username: string
  permission: Permission
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: UUID
  name: string
  type: ProjectType
  status: RunStatus | 'idle'
}

export interface Project {
  id: UUID
  solution_id: UUID
  name: string
  description: string
  type: ProjectType
  status: RunStatus | 'idle'
  last_run_at: string | null
  created_at: string
  config_json?: ProjectConfig
}

export interface ProjectConfig {
  model?: string
  llm_url?: string
  temperature?: number
  max_tokens?: number
  timeout?: number
  validation?: {
    validate_after_run?: boolean
    max_fix_rounds?: number
  }
  git?: {
    enabled?: boolean
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

export interface RunSummary {
  run_id: string
  status: RunStatus
  run_type: RunType
  project_id: UUID
  project_name: string
  solution_id: UUID
  solution_name: string
  error: string | null
  started_at: string
  finished_at: string | null
  events_count: number
}

export interface RunDetail extends RunSummary {
  project_dir: string
  result: RunResult | null
}

export interface RunResult {
  success: boolean
  message: string
  artifacts: Record<string, unknown>
  duration_seconds: number
  validation_report: ValidationReport | null
}

export interface NewRunRequest {
  requirement: string
  validate?: boolean
  fix_rounds?: number | null
  log_level?: LogLevel
  knowledge_doc_ids?: UUID[] | null
}

export interface RunResponse {
  run_id: string
  message: string
  status: RunStatus
  run_type: RunType
  project_id: UUID
  project_name: string
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type SSEEventType =
  | 'step_start' | 'step_complete' | 'agent_send' | 'agent_recv'
  | 'cio_decision' | 'info' | 'warn' | 'error'
  | 'workflow_complete' | 'workflow_failed' | 'run_result'

export interface CIOEvent {
  type: SSEEventType
  data: {
    message?: string
    preview?: string
    success?: boolean
    duration_seconds?: number
    [key: string]: unknown
  }
  timestamp: string
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export interface KnowledgeDocument {
  id: UUID
  title: string
  doc_type: DocType
  owner_id: UUID
  created_at: string
  content?: string
  scope?: ScopeType   // only in project knowledge list
}

export interface KnowledgeBinding {
  id: UUID
  doc_id: UUID
  scope_type: ScopeType
  scope_id: UUID
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export interface OrchestrationRequest {
  requirement: string
  project_ids?: UUID[] | null
  knowledge_doc_ids?: UUID[] | null
  log_level?: LogLevel
}

export interface OrchestrationRun {
  id: UUID
  requirement: string
  status: RunStatus
  total_tasks: number
  successful_tasks: number
  failed_tasks: number
  created_at: string
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type ValidationOutcome = 'pass' | 'skip' | 'fixed' | 'fail' | 'escalate'

export interface ValidationStepResult {
  step_id: string
  outcome: ValidationOutcome
  summary: string
  fix_rounds: number
  stdout_preview: string
  duration_seconds: number
}

export interface ValidationReport {
  project_id: UUID
  project_name: string
  started_at: string
  completed_at: string
  step_results: ValidationStepResult[]
  overall_outcome: ValidationOutcome
  summary: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GlobalConfig {
  model: string
  api_key: string
  file_limit: number
  work_dir: string
  claude_alias: string
  validation: {
    validate_after_run: boolean
    max_fix_rounds: number
  }
}

// ─── API Errors ───────────────────────────────────────────────────────────────

export interface APIError {
  error: string
  message: string
  detail?: Record<string, unknown>
}
