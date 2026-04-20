import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size    = 'xs' | 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: string
}

const variantCls: Record<Variant, string> = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white border-transparent',
  secondary: 'bg-surface-3 hover:bg-surface-4 text-gray-200 border-border',
  ghost:     'bg-transparent hover:bg-surface-3 text-gray-400 hover:text-gray-200 border-transparent',
  danger:    'bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-600/40',
  success:   'bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/40',
}

const sizeCls: Record<Size, string> = {
  xs: 'text-xs px-2 py-1 gap-1',
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
}

export default function Button({
  variant = 'secondary',
  size = 'sm',
  loading = false,
  icon,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg border
        transition-all duration-150 select-none
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variantCls[variant]} ${sizeCls[size]} ${className}
      `}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="leading-none">{icon}</span>
      )}
      {children}
    </button>
  )
}
