import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

export default function InitPage() {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const [form, setForm]     = useState({ username: 'admin', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('密码至少8位')
      return
    }
    setLoading(true)
    try {
      await authApi.init(form)
      toast.success('初始化成功！正在自动登录…')

      // Auto-login after init
      try {
        const { access_token } = await authApi.login({
          username: form.username,
          password: form.password,
        })
        setToken(access_token)
        const user = await authApi.me()
        setUser(user)
        navigate('/solutions', { replace: true })
      } catch {
        navigate('/login')
      }
    } catch {
      toast.error('初始化失败，系统可能已存在管理员')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm z-10">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/20 to-transparent pointer-events-none" />

        <div className="relative bg-surface-1 border border-border rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-600/30 mb-4">
              <span className="text-2xl text-brand-400">⬡</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-100">系统初始化</h1>
            <p className="text-sm text-gray-400 mt-1">创建第一个管理员账号</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-5 text-xs text-amber-400">
            首次部署时才可执行，系统检测到当前无用户。
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">管理员用户名</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">密码</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="至少8个字符"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  初始化中…
                </span>
              ) : '创建管理员账号'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
