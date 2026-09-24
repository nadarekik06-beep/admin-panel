'use client'

import { useEffect } from 'react'
import clsx from 'clsx'
import { CheckCircle, XCircle, Leaf, Flame, Crown } from 'lucide-react'
import type { CommissionSource, SubStatus } from '@/types/subscriptions'

export const formatDT = (v: number | string | null | undefined, digits = 3) =>
  v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(digits)} DT`

export const pct = (v: number) => `${Number.isInteger(v) ? v : Number(v).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`

const TIER_ICON = { free: Leaf, red: Flame, black: Crown }

/** Plan pill in the plan's own badge colour. */
export function PlanBadge({ name, color, tierKey, muted }: { name: string; color: string; tierKey?: 'free' | 'red' | 'black'; muted?: boolean }) {
  const Icon = TIER_ICON[tierKey ?? 'free']
  return (
    <span
      className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap', muted && 'opacity-60')}
      style={{ color, background: `${color}1f`, borderColor: `${color}4d` }}
    >
      <Icon size={10} /> {name}
    </span>
  )
}

const STATUS_CLS: Record<string, string> = {
  active:       'bg-accent-green/15 text-accent-green border-accent-green/30',
  trial:        'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
  grace_period: 'bg-accent-orange/15 text-accent-orange border-accent-orange/30',
  past_due:     'bg-accent-orange/15 text-accent-orange border-accent-orange/30',
  canceled:     'bg-text-muted/15 text-text-secondary border-text-muted/30',
  expired:      'bg-accent-red/15 text-accent-red border-accent-red/30',
  suspended:    'bg-accent-pink/15 text-accent-pink border-accent-pink/30',
}

export const STATUS_LABEL: Record<SubStatus, string> = {
  active: 'Active', trial: 'Trial', grace_period: 'Grace period', past_due: 'Past due',
  canceled: 'Cancelled', expired: 'Expired', suspended: 'Suspended',
}

export function StatusBadge({ status }: { status: SubStatus }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap', STATUS_CLS[status] ?? STATUS_CLS.canceled)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function SourceBadge({ source }: { source: CommissionSource }) {
  const cls = {
    override: 'bg-accent-purple/15 text-accent-purple-light border-accent-purple/40',
    plan:     'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
    default:  'bg-bg-hover text-text-secondary border-border',
  }[source]
  const label = { override: 'Seller override', plan: 'Plan', default: 'Platform default' }[source]
  return <span className={clsx('inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wide', cls)}>{label}</span>
}

export function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={clsx(
      'fixed bottom-5 right-5 z-[300] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-md',
      type === 'success' ? 'bg-accent-green' : 'bg-accent-red'
    )}>
      {type === 'success' ? <CheckCircle size={16} className="flex-shrink-0" /> : <XCircle size={16} className="flex-shrink-0" />}
      {message}
    </div>
  )
}

export const inputCls =
  'w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors disabled:opacity-50'

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
        {label} {required && <span className="text-accent-red">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-text-muted mt-1">{hint}</span>}
    </label>
  )
}

/** Reason textarea used by every admin action (min 5 chars on the backend). */
export function ReasonField({ value, onChange, placeholder = 'Why? The seller sees this in their notification.' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <Field label="Reason" required hint={value.trim().length > 0 && value.trim().length < 5 ? 'At least 5 characters.' : undefined}>
      <textarea rows={2} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={clsx(inputCls, 'resize-none')} />
    </Field>
  )
}

export const reasonOk = (r: string) => r.trim().length >= 5

export function Btn({ children, onClick, disabled, variant = 'ghost', type = 'button', title, className }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string; className?: string
  variant?: 'ghost' | 'primary' | 'danger' | 'success' | 'warning'; type?: 'button' | 'submit'
}) {
  const cls = {
    ghost:   'border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary',
    primary: 'bg-accent-purple hover:bg-accent-purple/90 text-white',
    danger:  'bg-accent-red hover:bg-accent-red/90 text-white',
    success: 'bg-accent-green hover:bg-accent-green/90 text-white',
    warning: 'bg-accent-orange hover:bg-accent-orange/90 text-white',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={clsx('inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap', cls, className)}>
      {children}
    </button>
  )
}
