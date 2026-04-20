import axios, { AxiosError } from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach token ────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: handle errors ──────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error: string; message: string }>) => {
    const status = err.response?.status
    const code   = err.response?.data?.error

    // 401 errors on auth endpoints should not trigger logout
    const isAuthEndpoint = err.config?.url?.includes('/auth/')

    if (status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      toast.error('登录已过期，请重新登录')
      return Promise.reject(err)
    }

    if (status === 403) {
      toast.error('权限不足')
      return Promise.reject(err)
    }

    if (status === 423) {
      toast.error('该项目正在执行中，请稍后再试')
      return Promise.reject(err)
    }

    if (status === 500) {
      toast.error('服务器错误，请联系管理员')
      return Promise.reject(err)
    }

    // 404 config_not_found is handled by the caller, don't toast
    if (code === 'config_not_found') {
      return Promise.reject(err)
    }

    return Promise.reject(err)
  }
)

/** Helper to get SSE URL with token embedded as query param
 *  (EventSource does not support custom headers, so token goes in URL)
 */
export function sseUrl(path: string): string {
  const token = useAuthStore.getState().token
  const base  = '/api/v1'
  const sep   = path.includes('?') ? '&' : '?'
  return `${base}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`
}
