import clsx from 'clsx'

type BadgeVariant =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'delivered'
  | 'completed'
  | 'processing'
  | 'canceled'
  | 'cancelled'
  | 'active'
  | 'banned'
  | 'disabled'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'paid'
  | 'unpaid'
  | 'refunded'

const variantClasses: Record<BadgeVariant, string> = {
  // ── Green (success states) ─────────────────────────────
  approved:   'bg-accent-green/15 text-accent-green border-accent-green/30',
  active:     'bg-accent-green/15 text-accent-green border-accent-green/30',
  delivered:  'bg-accent-green/15 text-accent-green border-accent-green/30',
  completed:  'bg-accent-green/15 text-accent-green border-accent-green/30',
  success:    'bg-accent-green/15 text-accent-green border-accent-green/30',
  paid:       'bg-accent-green/15 text-accent-green border-accent-green/30',

  // ── Red (error / danger states) ───────────────────────
  rejected:   'bg-accent-red/15 text-accent-red border-accent-red/30',
  canceled:   'bg-accent-red/15 text-accent-red border-accent-red/30',
  cancelled:  'bg-accent-red/15 text-accent-red border-accent-red/30',
  banned:     'bg-accent-red/15 text-accent-red border-accent-red/30',
  error:      'bg-accent-red/15 text-accent-red border-accent-red/30',
  unpaid:     'bg-accent-red/15 text-accent-red border-accent-red/30',

  // ── Orange (warning / pending states) ─────────────────
  pending:    'bg-accent-orange/15 text-accent-orange border-accent-orange/30',
  warning:    'bg-accent-orange/15 text-accent-orange border-accent-orange/30',
  refunded:   'bg-accent-orange/15 text-accent-orange border-accent-orange/30',

  // ── Cyan (in-progress states) ─────────────────────────
  processing: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
  info:       'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',

  // ── Pink (suspended) ──────────────────────────────────
  suspended:  'bg-accent-pink/15 text-accent-pink border-accent-pink/30',

  // ── Gray (inactive / disabled) ────────────────────────
  disabled:   'bg-text-muted/15 text-text-muted border-text-muted/30',
}

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        variantClasses[variant] ?? variantClasses.info,
        className
      )}
    >
      {children}
    </span>
  )
}