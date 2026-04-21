import { apiClient } from './client'
import type { RunSummary, RunDetail, NewRunRequest, RunResponse, UUID } from './types'

export const runsApi = {
  list: (params?: { status?: string; solution_id?: UUID; project_id?: UUID }) => {
    // The API expects no 'status' param (or valid values), 'all' may not be accepted
    const cleanParams: Record<string, string | undefined> = {}
    if (params?.status && params.status !== 'all') {
      cleanParams.status = params.status
    }
    if (params?.solution_id) cleanParams.solution_id = params.solution_id
    if (params?.project_id) cleanParams.project_id = params.project_id

    return apiClient
      .get<{ runs: RunSummary[]; total: number; active: number; completed: number }>(
        '/runs/',
        { params: Object.keys(cleanParams).length ? cleanParams : undefined }
      )
      .then((r) => r.data)
  },

  get: (runId: string) =>
    apiClient.get<RunDetail>(`/runs/${runId}`).then((r) => r.data),

  newRun: (sid: UUID, pid: UUID, data: NewRunRequest) =>
    apiClient
      .post<RunResponse>(`/solutions/${sid}/projects/${pid}/runs/new`, data)
      .then((r) => r.data),

  secondaryRun: (sid: UUID, pid: UUID, data: NewRunRequest) =>
    apiClient
      .post<RunResponse>(`/solutions/${sid}/projects/${pid}/runs/secondary`, data)
      .then((r) => r.data),

  /**
   * v2.1: Auto-routing run — server decides new vs secondary based on project.last_run_at.
   * Recommended for UI "Run" buttons that don't need to distinguish first vs subsequent runs.
   */
  autoRun: (sid: UUID, pid: UUID, data: NewRunRequest) =>
    apiClient
      .post<RunResponse>(`/solutions/${sid}/projects/${pid}/runs/auto`, data)
      .then((r) => r.data),

  validateRun: (
    sid: UUID,
    pid: UUID,
    data: { fix_rounds?: number; step_filter?: string[]; log_level?: string }
  ) =>
    apiClient
      .post<RunResponse>(`/solutions/${sid}/projects/${pid}/runs/validate`, data)
      .then((r) => r.data),
}
