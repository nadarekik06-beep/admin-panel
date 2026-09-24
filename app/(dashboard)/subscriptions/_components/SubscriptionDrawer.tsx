'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, formatDistanceToNow } from 'date-fns'
import {
  X, Loader2, ArrowRightLeft, CalendarDays, FlaskConical, Percent, ShieldAlert,
  History, CreditCard, Bot, UserCog, AlertTriangle, Store,
} from 'lucide-react'
import clsx from 'clsx'
import { subscriptionsApi, apiError } from '@/lib/api/subscriptions'
import type { HistoryEvent, Plan, SellerSubscriptionRow } from '@/types/subscriptions'
import { Btn, Field, PlanBadge, ReasonField, SourceBadge, StatusBadge, formatDT, inputCls, reasonOk } from './ui'

type Tab = 'plan' | 'dates' | 'trial' | 'commission' | 'status'

interface Props {
  sellerId: number | null
  plans: Plan[]
  onClose: () => void
  onChanged: (message: string) => void
  onError: (message: string) => void
}

export default function SubscriptionDrawer({ sellerId, plans, onClose, onChanged, onError }: Props) {
  const [sub, setSub]         = useState<SellerSubscriptionRow | null>(null)
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab]         = useState<Tab>('plan')

  const load = useCallback(async () => {
    if (!sellerId) return
    setLoading(true)
    try {
      const d = await subscriptionsApi.get(sellerId)
      setSub(d.subscription)
      setHistory(d.history)
    } catch (err) {
      onError(apiError(err, 'Could not load this subscription.'))
      onClose()
    } finally {
      setLoading(false)
    }
  }, [sellerId, onClose, onError])

  useEffect(() => { setSub(null); setHistory([]); setTab('plan'); load() }, [load])

  useEffect(() => {
    if (!sellerId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sellerId, onClose])

  /** Run an action, then refresh drawer + parent. */
  const run = async (fn: () => Promise<{ message: string; data: SellerSubscriptionRow }>) => {
    try {
      const res = await fn()
      setSub(res.data)
      onChanged(res.message)
      const d = await subscriptionsApi.get(sellerId!)
      setSub(d.subscription)
      setHistory(d.history)
      return true
    } catch (err) {
      onError(apiError(err))
      return false
    }
  }

  if (!sellerId) return null

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'plan', label: 'Plan', icon: ArrowRightLeft },
    { key: 'dates', label: 'Dates', icon: CalendarDays },
    { key: 'trial', label: 'Trial', icon: FlaskConical },
    { key: 'commission', label: 'Commission', icon: Percent },
    { key: 'status', label: 'Status', icon: ShieldAlert },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full bg-bg-secondary border-l border-border flex flex-col shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            {sub ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-text-primary truncate">{sub.business_name || sub.seller_name}</h2>
                  <PlanBadge name={sub.plan.name} color={sub.plan.color} tierKey={sub.plan.tier_key} />
                  <StatusBadge status={sub.status} />
                </div>
                <p className="text-xs text-text-muted mt-0.5">{sub.seller_name} · {sub.seller_email} · seller #{sub.user_id}</p>
              </>
            ) : <div className="h-10 w-64 rounded bg-bg-hover animate-pulse" />}
          </div>
          <div className="flex items-center gap-1">
            {sub && (
              <a href={`/sellers?view=${sub.user_id}`} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover" title="Seller profile">
                <Store size={16} />
              </a>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!sub || loading && !sub ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-text-muted" /></div>
          ) : (
            <div className="p-5 space-y-5">
              <Overview sub={sub} />

              {/* Actions */}
              <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex overflow-x-auto border-b border-border">
                  {tabs.map((t) => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
                        tab === t.key ? 'border-accent-red text-text-primary font-medium' : 'border-transparent text-text-muted hover:text-text-secondary')}>
                      <t.icon size={14} /> {t.label}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {tab === 'plan'       && <PlanAction key={sub.id + sub.current_plan} sub={sub} plans={plans} run={run} />}
                  {tab === 'dates'      && <DatesAction key={sub.id + String(sub.billing_cycle_end)} sub={sub} run={run} />}
                  {tab === 'trial'      && <TrialAction key={sub.id + sub.status} sub={sub} plans={plans} run={run} />}
                  {tab === 'commission' && <CommissionAction key={sub.id + String(sub.commission.override)} sub={sub} run={run} />}
                  {tab === 'status'     && <StatusAction key={sub.id + sub.status} sub={sub} run={run} />}
                </div>
              </div>

              <Timeline events={history} />
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ sub }: { sub: SellerSubscriptionRow }) {
  const d = (v: string | null) => (v ? format(new Date(v), 'dd MMM yyyy') : '—')
  const cells: [string, React.ReactNode][] = [
    ['Billing', sub.plan.is_free ? 'Free plan' : sub.billing_period === 'yearly' ? 'Yearly' : 'Monthly'],
    ['Current period', sub.billing_cycle_end ? `${sub.billing_cycle_start ?? '—'} → ${sub.billing_cycle_end}` : 'No end date'],
    ['Days left', sub.billing_cycle_end ? `${sub.days_remaining} days` : '—'],
    ['Products', <span key="p">{sub.products?.visible ?? '—'} / {sub.max_products ?? '∞'}{(sub.products?.hidden ?? 0) > 0 && <span className="text-accent-orange"> · {sub.products!.hidden} hidden</span>}</span>],
    ['Last payment', d(sub.last_payment_at)],
    [sub.status === 'trial' ? 'Trial ends' : sub.status === 'grace_period' ? 'Grace ends' : 'Next plan',
      sub.status === 'trial' ? d(sub.trial_ends_at) : sub.status === 'grace_period' ? d(sub.grace_period_ends_at) : (sub.pending?.name ?? '—')],
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cells.map(([label, value]) => (
          <div key={label} className="bg-bg-card border border-border rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
            <p className="text-sm text-text-primary mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-bg-card border border-border rounded-lg px-3 py-2.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Effective commission (new orders)</p>
          <p className="text-sm text-text-primary mt-0.5">{sub.commission.label}</p>
          {sub.commission.override_active && sub.commission.override_expires_at && (
            <p className="text-[11px] text-text-muted">Override until {format(new Date(sub.commission.override_expires_at), 'dd MMM yyyy')}</p>
          )}
        </div>
        <SourceBadge source={sub.commission.source} />
      </div>

      {(sub.status === 'suspended' || sub.cancel_reason || sub.admin_note) && (
        <div className={clsx('flex items-start gap-2 rounded-lg px-3 py-2 border text-sm',
          sub.status === 'suspended' ? 'bg-accent-pink/5 border-accent-pink/30 text-accent-pink' : 'bg-bg-card border-border text-text-secondary')}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{sub.status === 'suspended' ? 'Suspended: ' : sub.cancel_reason ? 'Cancelled: ' : 'Admin note: '}{sub.cancel_reason && sub.status !== 'suspended' ? sub.cancel_reason : sub.admin_note}</span>
        </div>
      )}
    </div>
  )
}

// ── Actions ───────────────────────────────────────────────────────────────────

type Run = (fn: () => Promise<{ message: string; data: SellerSubscriptionRow }>) => Promise<boolean>

function useBusy() {
  const [busy, setBusy] = useState(false)
  const wrap = (fn: () => Promise<unknown>) => async () => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  return [busy, wrap] as const
}

function PlanAction({ sub, plans, run }: { sub: SellerSubscriptionRow; plans: Plan[]; run: Run }) {
  const usable = plans.filter((p) => !p.archived_at)
  const [plan, setPlan]     = useState(usable.find((p) => p.slug !== sub.current_plan)?.slug ?? sub.current_plan)
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [endDate, setEnd]   = useState('')
  const [reason, setReason] = useState('')
  const [busy, wrap]        = useBusy()
  const target = usable.find((p) => p.slug === plan)
  const current = plans.find((p) => p.slug === sub.current_plan)
  const direction = target && current
    ? (target.tier - current.tier || target.price_monthly - current.price_monthly) > 0 ? 'Upgrade' : 'Downgrade'
    : 'Change'

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">Takes effect immediately. Downgrades hide products above the new limit (never deleted) and pause what the plan no longer includes.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="New plan" required>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>
            {usable.map((p) => <option key={p.slug} value={p.slug}>{p.name} — {p.price_monthly > 0 ? `${p.price_monthly} DT/mo` : 'free'}{p.slug === sub.current_plan ? ' (current)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Billing">
          <select value={period} onChange={(e) => setPeriod(e.target.value as 'monthly' | 'yearly')} className={inputCls} disabled={!target || target.price_monthly <= 0}>
            <option value="monthly">Monthly</option>
            <option value="yearly" disabled={target?.price_yearly == null}>Yearly{target?.price_yearly == null ? ' (not offered)' : ''}</option>
          </select>
        </Field>
        <Field label="Custom end date" hint="Optional — defaults to one period">
          <input type="date" value={endDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setEnd(e.target.value)} className={inputCls} disabled={!target || target.price_monthly <= 0} />
        </Field>
      </div>
      <ReasonField value={reason} onChange={setReason} />
      <div className="flex justify-end">
        <Btn variant="primary" disabled={busy || !reasonOk(reason) || (plan === sub.current_plan && !endDate && period === sub.billing_period)}
          onClick={wrap(() => run(() => subscriptionsApi.assignPlan(sub.user_id, { plan, billing_period: period, end_date: endDate || null, reason })))}>
          {busy && <Loader2 size={13} className="animate-spin" />} {direction} to {target?.name ?? plan}
        </Btn>
      </div>
    </div>
  )
}

function DatesAction({ sub, run }: { sub: SellerSubscriptionRow; run: Run }) {
  const [mode, setMode]     = useState<'end' | 'days'>('days')
  const [endDate, setEnd]   = useState(sub.billing_cycle_end ?? '')
  const [days, setDays]     = useState(7)
  const [reason, setReason] = useState('')
  const [busy, wrap]        = useBusy()
  const canEdit = !sub.plan.is_free || sub.status === 'trial'

  if (!canEdit) {
    return <p className="text-sm text-text-muted">This seller is on a free plan — there is no period to extend. Assign a paid plan or start a trial first.</p>
  }
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-border p-0.5">
        {([['days', 'Grant free days'], ['end', 'Set end date']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={clsx('px-3 py-1.5 rounded-md text-xs font-medium', mode === k ? 'bg-bg-hover text-text-primary' : 'text-text-muted')}>{l}</button>
        ))}
      </div>
      {mode === 'days' ? (
        <Field label="Days to add" hint={`Current end: ${sub.billing_cycle_end ?? '—'}`}>
          <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className={clsx(inputCls, 'max-w-[140px]')} />
        </Field>
      ) : (
        <Field label="New end date" hint="Extend or shorten the current period. Can't be in the past.">
          <input type="date" value={endDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setEnd(e.target.value)} className={clsx(inputCls, 'max-w-[200px]')} />
        </Field>
      )}
      <ReasonField value={reason} onChange={setReason} />
      <div className="flex justify-end">
        <Btn variant="primary" disabled={busy || !reasonOk(reason) || (mode === 'days' ? days < 1 : !endDate)}
          onClick={wrap(() => run(() => mode === 'days'
            ? subscriptionsApi.grantFreeDays(sub.user_id, { days, reason })
            : subscriptionsApi.changeEndDate(sub.user_id, { end_date: endDate, reason })))}>
          {busy && <Loader2 size={13} className="animate-spin" />} {mode === 'days' ? `Add ${days} days` : 'Update end date'}
        </Btn>
      </div>
    </div>
  )
}

function TrialAction({ sub, plans, run }: { sub: SellerSubscriptionRow; plans: Plan[]; run: Run }) {
  const paid = plans.filter((p) => !p.archived_at && p.price_monthly > 0)
  const [plan, setPlan]     = useState(paid[0]?.slug ?? '')
  const target              = paid.find((p) => p.slug === plan)
  const [days, setDays]     = useState(target?.trial_days || 14)
  const [reason, setReason] = useState('')
  const [busy, wrap]        = useBusy()

  if (sub.status === 'suspended') return <p className="text-sm text-text-muted">Reactivate the subscription before starting a trial.</p>
  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">The seller gets the plan's features for free. When the trial ends without payment they return to the default plan (reminders are sent 7 and 1 day before).</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plan" required>
          <select value={plan} onChange={(e) => { setPlan(e.target.value); setDays(paid.find((p) => p.slug === e.target.value)?.trial_days || 14) }} className={inputCls}>
            {paid.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Trial length (days)" required>
          <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls} />
        </Field>
      </div>
      <ReasonField value={reason} onChange={setReason} />
      <div className="flex justify-end">
        <Btn variant="primary" disabled={busy || !plan || days < 1 || !reasonOk(reason)}
          onClick={wrap(() => run(() => subscriptionsApi.startTrial(sub.user_id, { plan, days, reason })))}>
          {busy && <Loader2 size={13} className="animate-spin" />} Start {days}-day trial
        </Btn>
      </div>
    </div>
  )
}

function CommissionAction({ sub, run }: { sub: SellerSubscriptionRow; run: Run }) {
  const [rate, setRate]       = useState<string>(sub.commission.override !== null ? String(sub.commission.override) : '')
  const [expires, setExpires] = useState(sub.commission.override_expires_at?.slice(0, 10) ?? '')
  const [reason, setReason]   = useState('')
  const [busy, wrap]          = useBusy()
  const rateNum = Number(rate)
  const validRate = rate !== '' && rateNum >= 0 && rateNum <= 100

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Priority: <b className="text-text-secondary">seller override</b> → plan rate → platform default. Changes apply to <b className="text-text-secondary">new orders only</b> — existing orders and settlements keep the rate they were placed with.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Override rate (%)" required>
          <input type="number" min={0} max={100} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 5" className={inputCls} />
        </Field>
        <Field label="Expires on" hint="Optional — empty = no expiry">
          <input type="date" value={expires} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpires(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <ReasonField value={reason} onChange={setReason} placeholder="e.g. Launch partner deal agreed on …" />
      <div className="flex justify-end gap-2">
        {sub.commission.override !== null && (
          <Btn variant="ghost" disabled={busy || !reasonOk(reason)}
            onClick={wrap(() => run(() => subscriptionsApi.removeCommissionOverride(sub.user_id, reason)))}>
            Remove override
          </Btn>
        )}
        <Btn variant="primary" disabled={busy || !validRate || !reasonOk(reason)}
          onClick={wrap(() => run(() => subscriptionsApi.setCommissionOverride(sub.user_id, { rate: rateNum, expires_at: expires || null, reason })))}>
          {busy && <Loader2 size={13} className="animate-spin" />} {sub.commission.override !== null ? 'Update override' : 'Set override'}
        </Btn>
      </div>
    </div>
  )
}

function StatusAction({ sub, run }: { sub: SellerSubscriptionRow; run: Run }) {
  const [reason, setReason]       = useState('')
  const [immediate, setImmediate] = useState(false)
  const [busy, wrap]              = useBusy()
  const suspended = sub.status === 'suspended'

  return (
    <div className="space-y-4">
      <ReasonField value={reason} onChange={setReason} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-border bg-bg-primary space-y-2">
          <p className="text-sm font-medium text-text-primary">{suspended ? 'Reactivate' : 'Suspend'}</p>
          <p className="text-xs text-text-muted">{suspended
            ? 'Restores plan features and paused sponsorships.'
            : 'Blocks every plan feature immediately and pauses sponsorships. The plan itself is kept.'}</p>
          <Btn variant={suspended ? 'success' : 'warning'} disabled={busy || !reasonOk(reason)} className="w-full"
            onClick={wrap(() => run(() => suspended ? subscriptionsApi.reinstate(sub.user_id, reason) : subscriptionsApi.suspend(sub.user_id, reason)))}>
            {suspended ? 'Reactivate subscription' : 'Suspend subscription'}
          </Btn>
        </div>
        <div className="p-3 rounded-lg border border-accent-red/30 bg-accent-red/[0.04] space-y-2">
          <p className="text-sm font-medium text-text-primary">Cancel</p>
          <p className="text-xs text-text-muted">Moves the seller to the default plan — at the end of the current period, or now.</p>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} className="accent-[#db142e]" />
            Cancel immediately
          </label>
          <Btn variant="danger" disabled={busy || !reasonOk(reason) || (sub.plan.is_free && sub.status !== 'trial')} className="w-full"
            onClick={wrap(() => run(() => subscriptionsApi.cancel(sub.user_id, reason, immediate)))}>
            {immediate ? 'Cancel now' : 'Cancel at period end'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── History ───────────────────────────────────────────────────────────────────

function Timeline({ events }: { events: HistoryEvent[] }) {
  const icon = (e: HistoryEvent) =>
    e.kind === 'payment' ? CreditCard : e.actor.role === 'system' ? Bot : e.actor.role === 'admin' ? UserCog : History
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-1.5"><History size={12} /> History</p>
      {events.length === 0 ? (
        <p className="text-sm text-text-muted">No history yet.</p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-border">
          {events.map((e, i) => {
            const Icon = icon(e)
            return (
              <li key={i} className="relative flex gap-3">
                <span className={clsx('relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-bg-secondary',
                  e.kind === 'payment' ? 'bg-accent-green/15 text-accent-green' : e.actor.role === 'admin' ? 'bg-accent-purple/15 text-accent-purple-light' : 'bg-bg-hover text-text-muted')}>
                  <Icon size={13} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm text-text-primary">
                    <span className="font-medium">{e.label}</span>
                    {e.amount ? <span className="text-accent-green"> · {formatDT(e.amount)}</span> : null}
                    <span className="text-text-muted"> — {e.actor.name ?? 'System'}{e.actor.role !== 'system' ? ` (${e.actor.role})` : ''}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {e.at ? `${format(new Date(e.at), 'dd MMM yyyy · HH:mm')} · ${formatDistanceToNow(new Date(e.at), { addSuffix: true })}` : '—'}
                  </p>
                  {e.reason && <p className="mt-1 text-xs text-text-secondary bg-bg-card border border-border rounded-md px-2 py-1">{e.reason}</p>}
                  <Diff before={e.before} after={e.after} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

const DIFF_LABELS: Record<string, string> = {
  plan: 'Plan', pending_plan: 'Next plan', status: 'Status', billing_period: 'Billing',
  billing_cycle_end: 'Period end', trial_ends_at: 'Trial end', commission_override: 'Override %',
  commission_override_expires_at: 'Override expiry',
}

/** Compact "field: old → new" list for audit entries. */
function Diff({ before, after }: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }) {
  if (!before || !after) return null
  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v).replace(/T.*$/, ''))
  const changes = Object.keys(DIFF_LABELS).filter((k) => fmt(before[k]) !== fmt(after[k]))
  if (!changes.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
      {changes.map((k) => (
        <span key={k}>{DIFF_LABELS[k]}: <span className="line-through">{fmt(before[k])}</span> → <span className="text-text-secondary">{fmt(after[k])}</span></span>
      ))}
    </div>
  )
}
