import { create } from 'zustand'
import type { CIOEvent, RunStatus } from '../api/types'

export interface RunSession {
  runId: string
  projectId: string
  projectName: string
  status: RunStatus
  events: CIOEvent[]
  startedAt: string
}

interface RunState {
  activeSessions: Record<string, RunSession>
  addSession: (s: RunSession) => void
  updateSession: (runId: string, patch: Partial<RunSession>) => void
  appendEvent:  (runId: string, event: CIOEvent) => void
  removeSession: (runId: string) => void
}

export const useRunStore = create<RunState>((set) => ({
  activeSessions: {},

  addSession: (session) =>
    set((s) => ({ activeSessions: { ...s.activeSessions, [session.runId]: session } })),

  updateSession: (runId, patch) =>
    set((s) => ({
      activeSessions: {
        ...s.activeSessions,
        [runId]: { ...s.activeSessions[runId], ...patch },
      },
    })),

  appendEvent: (runId, event) =>
    set((s) => {
      const session = s.activeSessions[runId]
      if (!session) return s
      return {
        activeSessions: {
          ...s.activeSessions,
          [runId]: { ...session, events: [...session.events, event] },
        },
      }
    }),

  removeSession: (runId) =>
    set((s) => {
      const next = { ...s.activeSessions }
      delete next[runId]
      return { activeSessions: next }
    }),
}))