import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { configApi } from '../../api/config'
import { useAuthStore } from '../../store/authStore'
import type { User, UserRole } from '../../api/types'
import Button        from '../../components/ui/Button'
import Modal         from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState    from '../../components/ui/EmptyState'

/* ── Role change modal ───────────────────────────────────────────────────── */

function RoleModal({
  open, onClose, target, onChanged,
}: {
  open: boolean
  onClose: () => void
  target: User | null
  onChanged: () => void
}) {
  const [role,    setRole]    = useState<UserRole>('user')
  const [loading, setLoading] = useState(false)
  const currentUser = useAuthStore((s) => s.user)

  useEffect(() => {
    if (target) setRole(target.role)
  }, [target])

  const handleSave = async () => {
    if (!target) return
    if (target.id === currentUser?.id && role !== 'admin') {
      toast.error('不能降低自己的权限')
      return
    }
    setLoading(true)
    try {
      await configApi.updateUserRole(target.id, role)
      toast.success('角色已更新')
      onChanged()
      onClose()
    } catch {
      toast.error('更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="修改用户角色" width="sm">
      <div className="px-5 py-4 space-y-4">
        {target && (
          <div className="bg-surface-2 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-gray-400">用户：</span>
            <span className="text-gray-100 font-medium ml-1">{target.username}</span>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">新角色</label>
          <div className="space-y-2">
            {(
              [
                { val: 'user',  label: 'User',  desc: '普通用户，可管理自己的 Solution' },
                { val: 'admin', label: 'Admin', desc: '管理员，拥有全部权限和系统配置入口' },
              ] as { val: UserRole; label: string; desc: string }[]
            ).map(({ val, label, desc }) => (
              <label
                key={val}
                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer border transition-colors ${
                  role === val
                    ? 'border-brand-600/50 bg-brand-600/10'
                    : 'border-transparent hover:bg-surface-3'
                }`}
              >
                <input
                  type="radio"
                  className="accent-brand-500 mt-0.5"
                  checked={role === val}
                  onChange={() => setRole(val)}
                />
                <div>
                  <p className="text-sm text-gray-200">{label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" loading={loading} onClick={handleSave}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ── User row ────────────────────────────────────────────────────────────── */

function UserRow({
  user,
  isSelf,
  onChangeRole,
}: {
  user: User
  isSelf: boolean
  onChangeRole: (u: User) => void
}) {
  const roleCls: Record<UserRole, string> = {
    admin: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    user:  'text-gray-400   bg-gray-400/10   border-gray-400/20',
  }

  const initials = user.username.slice(0, 2).toUpperCase()

  return (
    <div className="group bg-surface-1 border border-border rounded-lg px-4 py-3 flex items-center gap-3 hover:border-brand-600/20 transition-colors">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-xs font-semibold text-brand-400 shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-100">{user.username}</span>
          {isSelf && (
            <span className="text-[10px] text-gray-500 bg-surface-3 px-1.5 py-0.5 rounded">me</span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{user.id.slice(0, 16)}…</p>
      </div>

      {/* Role badge */}
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${roleCls[user.role]}`}>
        {user.role}
      </span>

      {/* Created at */}
      <span className="text-[11px] text-gray-600 hidden sm:block w-28 text-right">
        {new Date(user.created_at).toLocaleDateString('zh-CN')}
      </span>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onChangeRole(user)}
        >
          改变角色
        </Button>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [users,     setUsers]     = useState<User[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [roleModal, setRoleModal] = useState<User | null>(null)
  const [total,     setTotal]     = useState(0)

  const load = () => {
    setLoading(true)
    configApi.listUsers()
      .then((d) => { setUsers(d.users); setTotal(d.total) })
      .catch(() => toast.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  const adminCount = users.filter((u) => u.role === 'admin').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">用户管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            共 {total} 个用户 · {adminCount} 个管理员
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
            <polyline points="23,4 23,10 17,10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          刷新
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: '总用户数', val: total,          cls: 'text-gray-300' },
          { label: '管理员',   val: adminCount,      cls: 'text-purple-400' },
          { label: '普通用户', val: total - adminCount, cls: 'text-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-surface-1 border border-border rounded-lg px-4 py-3">
            <p className="text-[11px] text-gray-500">{s.label}</p>
            <p className={`text-2xl font-semibold mt-0.5 ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户名…"
            className="w-full bg-surface-1 border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50"
          />
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[32px_1fr_80px_120px_80px] gap-3 px-4 py-1.5 mb-1 text-[11px] text-gray-500 font-medium uppercase tracking-wider">
        <span />
        <span>用户名</span>
        <span>角色</span>
        <span className="hidden sm:block text-right">注册时间</span>
        <span />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface-1 rounded-lg h-14 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="👥" title={search ? '没有匹配的用户' : '暂无用户'} />
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUser?.id}
              onChangeRole={setRoleModal}
            />
          ))}
        </div>
      )}

      <RoleModal
        open={!!roleModal}
        onClose={() => setRoleModal(null)}
        target={roleModal}
        onChanged={load}
      />
    </div>
  )
}
