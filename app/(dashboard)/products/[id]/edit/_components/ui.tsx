'use client'

import { useEffect } from 'react'
import clsx from 'clsx'
import { AlertCircle, CheckCircle, X } from 'lucide-react'

export const BRAND_RED   = '#db142e'
export const BRAND_GREEN = '#198f41'

export const inputCls = (err?: boolean) => clsx(
  'w-full rounded-lg border px-3 py-2 text-sm bg-bg-primary text-text-primary placeholder:text-text-muted outline-none transition',
  'focus:border-[#db142e] focus:ring-2 focus:ring-[#db142e]/20 disabled:opacity-50',
  err ? 'border-[#db142e] bg-[#db142e]/5' : 'border-border',
)

export function Field({ label, error, hint, required, counter, children, htmlFor }: {
  label: string
  error?: string
  hint?: React.ReactNode
  required?: boolean
  counter?: { value: number; max: number }
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={htmlFor} className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary">
          {label} {required && <span className="text-[#db142e]">*</span>}
        </label>
        {counter && (
          <span className={clsx('text-[10px] tabular-nums', counter.value > counter.max ? 'text-[#f87171]' : 'text-text-muted')}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {error
        ? <p className="flex items-center gap-1 text-[11px] text-[#f87171] mt-1" data-field-error><AlertCircle size={11} /> {error}</p>
        : hint && <p className="text-[11px] text-text-muted mt-1">{hint}</p>}
    </div>
  )
}

export function Card({ title, description, actions, children, className }: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <section className={clsx('bg-bg-card border border-border rounded-xl p-4 sm:p-5', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="text-sm font-bold text-text-primary">{title}</h3>}
            {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Toggle({ checked, onChange, label, description, disabled, ariaLabel }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string; disabled?: boolean; ariaLabel?: string
}) {
  return (
    <label className={clsx('flex items-start gap-3 select-none', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={ariaLabel ?? label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative mt-0.5 w-9 h-5 rounded-full flex-shrink-0 transition-colors', checked ? 'bg-[#198f41]' : 'bg-border-light')}
      >
        <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm text-text-primary">{label}</span>}
          {description && <span className="block text-[11px] text-text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
}

export interface ToastMsg { id: number; message: string; type: 'success' | 'error' | 'info' }

export function Toasts({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-24 right-4 sm:right-6 z-[120] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} dismiss={dismiss} />)}
    </div>
  )
}

function ToastItem({ toast, dismiss }: { toast: ToastMsg; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.type === 'error' ? 6000 : 3500)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  return (
    <div
      role="status"
      className={clsx(
        'flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium animate-fade-in',
        toast.type === 'success' && 'bg-[#198f41]',
        toast.type === 'error' && 'bg-[#db142e]',
        toast.type === 'info' && 'bg-bg-hover border border-border-light',
      )}
    >
      {toast.type === 'error' ? <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> : <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button type="button" onClick={() => dismiss(toast.id)} className="opacity-70 hover:opacity-100" aria-label="Dismiss"><X size={14} /></button>
    </div>
  )
}
