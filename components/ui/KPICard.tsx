import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  gradient: 'purple' | 'cyan' | 'green' | 'orange'
  trend?: { value: number; label: string }
}

const gradients = {
  purple: 'bg-gradient-purple shadow-glow',
  cyan:   'bg-gradient-cyan',
  green:  'bg-gradient-green',
  orange: 'bg-gradient-orange',
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
}: KPICardProps) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-5 hover:border-border-light transition-all duration-200 shadow-card group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-text-muted text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
          {subtitle && (
            <p className="text-text-muted text-xs mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={clsx(
                  'text-xs font-medium',
                  trend.value > 0 ? 'text-accent-green' : 'text-accent-red'
                )}
              >
                {trend.value > 0 ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-text-muted text-xs">{trend.label}</span>
            </div>
          )}
        </div>
        <div
          className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            gradients[gradient]
          )}
        >
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )
}