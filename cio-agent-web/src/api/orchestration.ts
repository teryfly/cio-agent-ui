import { apiClient } from './client'
import type { OrchestrationRequest, OrchestrationRun, UUID } from './types'

export const orchestrationApi = {
  start: (sid: UUID, data: OrchestrationRequest) =>
    apiClient.post<{ run_id: string; orchestration_run_id: UUID; status: string; total_projects: number }>(
      `/solutions/${sid}/orchestration/`, data
    ).then((r) => r.data),

  list: (sid: UUID) =>
    apiClient.get<{ runs: OrchestrationRun[]; total: number }>(`/solutions/${sid}/orchestration/`).then((r) => r.data),

  get: (sid: UUID, oid: UUID) =>
    apiClient.get(`/solutions/${sid}/orchestration/${oid}`).then((r) => r.data),
}