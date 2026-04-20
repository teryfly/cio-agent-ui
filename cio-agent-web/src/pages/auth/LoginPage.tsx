import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setToken, setUser, token, isTokenValid, logout } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  // Already logged in and token valid → redirect
  useEffect(() => {
    if (token) {
      if (isTokenValid()) {
        navigate('/solutions', { replace: true })
      } else {
        // Expired token sitting in storage — clear it
        logout()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if needs init (no users yet)
  useEffect(() => {
    authApi.health().then((h) => {
      if (h.db === 'no_users') navigate('/init', { replace: true })
    }).catch(() => {})
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    setLoading(true)
    try {
      const { access_token } = await authApi.login({
        username: username.trim(),
        password,
      })
      setToken(access_token)
      const user = await authApi.me()
      setUser(user)
      navigate('/solutions', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        toast.error('用户名或密码错误')
      } else {
        toast.error('登录失败，请稍后再试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm z-10">
        {/* Glow border */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/20 to-transparent pointer-events-none" />

        <div className="relative bg-surface-1 border border-border rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-600/30 mb-4">
              <span className="text-2xl text-brand-400">⬡</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-100">cio-agent</h1>
            <p className="text-sm text-gray-500 mt-1">AI Autonomous Coding Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
                autoComplete="username"
                autoFocus
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full mt-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  登录中…
                </span>
              ) : '登录'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            没有账号？{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 transition-colors">
              注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
