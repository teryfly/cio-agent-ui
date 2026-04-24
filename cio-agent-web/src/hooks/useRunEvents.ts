// File: hooks/useRunEvents.ts
/**
 * useRunEvents — 智能轮询运行事件
 * 
 * 功能：
 * 1. 挂载时立即加载
 * 2. 运行中自动轮询（3秒间隔）
 * 3. 完成/失败后停止轮询
 * 4. 提供手动刷新接口
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { runsApi } from '../api/runs'
import { apiClient } from '../api/client'
import type { CIOEvent, RunStatus } from '../api/types'
interface UseRunEventsResult {
  events:  CIOEvent[]
  status:  RunStatus
  loading: boolean
  refresh: () => void
}
const POLL_INTERVAL_MS = 3000 // 3秒轮询间隔
export function useRunEvents(runId: string | null): UseRunEventsResult {
  const [events,  setEvents]  = useState<CIOEvent[]>([])
  const [status,  setStatus]  = useState<RunStatus>('pending')
  const [loading, setLoading] = useState(false)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const fetchData = useCallback(async () => {
    if (!runId || !isMountedRef.current) return
    setLoading(true)
    try {
      // 1. 获取 run 状态
      const run = await runsApi.get(runId)
      if (!isMountedRef.current) return
      setStatus(run.status)
      // 2. 尝试获取事件列表（后端若支持 GET /runs/{id}/events?format=list）
      try {
        const res = await apiClient.get<{ events: CIOEvent[] }>(
          `/runs/${runId}/events`,
          { params: { format: 'list' } }
        )
        if (isMountedRef.current && Array.isArray(res.data?.events)) {
          setEvents(res.data.events)
        }
      } catch {
        // 端点不支持 list 格式时静默忽略
      }
    } catch {
      // run 本身不存在时保持当前状态
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [runId])
  // 智能轮询逻辑
  useEffect(() => {
    if (!runId) {
      setEvents([])
      setStatus('pending')
      return
    }
    // 立即执行第一次加载
    fetchData()
    // 启动轮询定时器
    const startPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
      pollTimerRef.current = setInterval(() => {
        fetchData()
      }, POLL_INTERVAL_MS)
    }
    startPolling()
    // 清理函数
    return () => {
      isMountedRef.current = false
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [runId, fetchData])
  // 当状态变为终态时停止轮询
  useEffect(() => {
    const isTerminal = status === 'success' || status === 'failed'
    if (isTerminal && pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [status])
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }
  }, [])
  return { 
    events, 
    status, 
    loading, 
    refresh: fetchData 
  }
}