/**
 * runStore — 追踪已知运行会话的状态快照
 *
 * 移除了原来 SSE 驱动的 appendEvent 流式写入逻辑，
 * 改为仅在 API 响应后整体更新 session 数据。
 */
import { create } from 'zustand'
import type { CIOEvent, RunStatus } from '../api/types'

export interface RunSession {
  runId:       string
  projectId:   string
  projectName: string
  status:      RunStatus
  events:      CIOEvent[]
  startedAt:   string
}

interface RunState {
  activeSessions: Record<string, RunSession>
  addSession:    (s: RunSession) => void
  updateSession: (runId: string, patch: Partial<RunSession>) => void
  removeSession: (runId: string) => void
}

export const useRunStore = create<RunState>((set) => ({
  activeSessions: {},

  addSession: (session) =>
    set((s) => ({
      activeSessions: { ...s.activeSessions, [session.runId]: session },
    })),

  updateSession: (runId, patch) =>
    set((s) => ({
      activeSessions: {
        ...s.activeSessions,
        [runId]: { ...s.activeSessions[runId], ...patch },
      },
    })),

  removeSession: (runId) =>
    set((s) => {
      const next = { ...s.activeSessions }
      delete next[runId]
      return { activeSessions: next }
    }),
}))
