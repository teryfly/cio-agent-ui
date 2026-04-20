import { apiClient } from './client'
import type { KnowledgeDocument, KnowledgeBinding, DocType, ScopeType, UUID } from './types'

export const knowledgeApi = {
  list: () =>
    apiClient.get<{ documents: KnowledgeDocument[]; total: number }>('/knowledge/').then((r) => r.data),

  get: (docId: UUID) =>
    apiClient.get<KnowledgeDocument>(`/knowledge/${docId}`).then((r) => r.data),

  create: (data: { title: string; content: string; doc_type?: DocType }) =>
    apiClient.post<KnowledgeDocument>('/knowledge/', data).then((r) => r.data),

  update: (docId: UUID, data: Partial<{ title: string; content: string }>) =>
    apiClient.put<KnowledgeDocument>(`/knowledge/${docId}`, data).then((r) => r.data),

  delete: (docId: UUID) =>
    apiClient.delete(`/knowledge/${docId}`).then((r) => r.data),

  bind: (docId: UUID, data: { scope_type: ScopeType; scope_id: UUID }) =>
    apiClient.post<KnowledgeBinding>(`/knowledge/${docId}/bind`, data).then((r) => r.data),

  unbind: (bindingId: UUID) =>
    apiClient.delete(`/knowledge/bindings/${bindingId}`).then((r) => r.data),

  listBySolution: (sid: UUID) =>
    apiClient.get<{ documents: KnowledgeDocument[]; total: number }>(`/solutions/${sid}/knowledge/`).then((r) => r.data),

  listByProject: (sid: UUID, pid: UUID, includesolution = true) =>
    apiClient.get<{ documents: KnowledgeDocument[]; total: number }>(
      `/solutions/${sid}/projects/${pid}/knowledge/`,
      { params: { include_solution: includesolution } }
    ).then((r) => r.data),
}