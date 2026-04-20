import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!/^\w{3,50}$/.test(form.username)) e.username = '3-50位字母、数字或下划线'
    if (form.password.length < 8)          e.password = '至少8个字符'
    if (form.password !== form.confirm)    e.confirm  = '两次密码不一致'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      // 1. Register
      await authApi.register({ username: form.username, password: form.password })

      // 2. Auto-login after registration
      try {
        const { access_token } = await authApi.login({
          username: form.username,
          password: form.password,
        })
        setToken(access_token)
        const user = await authApi.me()
        setUser(user)
        toast.success('注册成功，欢迎使用！')
        navigate('/solutions', { replace: true })
      } catch {
        // Auto-login failed, fallback to manual login
        toast.success('注册成功，请登录')
        navigate('/login')
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (code === 'username_taken') toast.error('用户名已存在')
      else toast.error('注册失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  const field = (key: 'username' | 'password' | 'confirm') => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

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
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-600/30 mb-4">
              <span className="text-2xl text-brand-400">⬡</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-100">创建账号</h1>
            <p className="text-sm text-gray-500 mt-1">AI Autonomous Coding Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(
              [
                { key: 'username', label: '用户名', type: 'text',     placeholder: '3-50位字母数字下划线' },
                { key: 'password', label: '密码',   type: 'password', placeholder: '至少8个字符' },
                { key: 'confirm',  label: '确认密码', type: 'password', placeholder: '再输入一次密码' },
              ] as const
            ).map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  autoComplete={key === 'username' ? 'username' : key === 'password' ? 'new-password' : 'new-password'}
                  className={`w-full bg-surface-2 border rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 transition-colors ${
                    errors[key]
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                      : 'border-border focus:border-brand-500 focus:ring-brand-500/50'
                  }`}
                  {...field(key)}
                />
                {errors[key] && (
                  <p className="text-xs text-red-400 mt-1">{errors[key]}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  注册中…
                </span>
              ) : '注册'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            已有账号？{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
