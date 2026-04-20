type Status = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'locked'
type ProjectType = 'backend' | 'frontend' | 'library' | 'other'

/* ── Run / Project status badge ─────────────────────────────────────────── */

const statusConfig: Record<Status, { label: string; dot: string; cls: string }> = {
  idle:    { label: 'idle',    dot: '○', cls: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  pending: { label: 'pending', dot: '○', cls: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  running: { label: 'running', dot: '●', cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  success: { label: 'success', dot: '✓', cls: 'text-green-400 bg-green-400/10 border-green-400/20' },
  failed:  { label: 'failed',  dot: '✗', cls: 'text-red-400  bg-red-400/10  border-red-400/20' },
  locked:  { label: 'locked',  dot: '🔒', cls: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
}

export function StatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status] ?? statusConfig.idle
  return (
    <span
      className={`
        inline-flex items-center gap-1 text-[11px] font-medium
        px-1.5 py-0.5 rounded border ${cfg.cls}
      `}
    >
      <span
        className={status === 'running' ? 'animate-pulse' : ''}
        style={{ fontSize: '8px', lineHeight: 1 }}
      >
        {cfg.dot}
      </span>
      {cfg.label}
    </span>
  )
}

/* ── Project type badge ──────────────────────────────────────────────────── */

const typeConfig: Record<ProjectType, { label: string; cls: string }> = {
  backend:  { label: 'backend',  cls: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  frontend: { label: 'frontend', cls: 'text-cyan-400   bg-cyan-400/10   border-cyan-400/20' },
  library:  { label: 'library',  cls: 'text-amber-400  bg-amber-400/10  border-amber-400/20' },
  other:    { label: 'other',    cls: 'text-gray-400   bg-gray-400/10   border-gray-400/20' },
}

export function TypeBadge({ type }: { type: ProjectType }) {
  const cfg = typeConfig[type] ?? typeConfig.other
  return (
    <span className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

/* ── Visibility badge ────────────────────────────────────────────────────── */

export function VisibilityBadge({ visibility }: { visibility: 'private' | 'shared' }) {
  return visibility === 'shared' ? (
    <span className="inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded border text-teal-400 bg-teal-400/10 border-teal-400/20">
      shared
    </span>
  ) : null
}
