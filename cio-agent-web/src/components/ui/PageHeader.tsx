import { useNavigate } from 'react-router-dom'

interface Crumb { label: string; to?: string }

interface PageHeaderProps {
  crumbs: Crumb[]
  title?: string
  actions?: React.ReactNode
}

export default function PageHeader({ crumbs, actions }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between mb-6">
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-600">›</span>}
            {c.to ? (
              <button
                onClick={() => navigate(c.to!)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                {c.label}
              </button>
            ) : (
              <span className="text-gray-100 font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
