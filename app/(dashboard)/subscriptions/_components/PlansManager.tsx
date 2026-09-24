'use client'

import { useState } from 'react'
import { Plus, Pencil, Archive, RotateCcw, Power, Star, Users, Check, Loader2, X } from 'lucide-react'
import clsx from 'clsx'
import { plansApi, apiError, type PlanInput } from '@/lib/api/subscriptions'
import type { Plan, PlansPayload } from '@/types/subscriptions'
import { Btn, Field, PlanBadge, ReasonField, formatDT, inputCls, reasonOk } from './ui'

interface Props {
  data: PlansPayload | null
  showArchived: boolean
  onShowArchived: (v: boolean) => void
  onChanged: (message: string) => void
  onError: (message: string) => void
}

const LIMIT_LABEL = (v: number | null, unit: string) => (v === null ? `Unlimited ${unit}` : `${v} ${unit}`)

export default function PlansManager({ data, showArchived, onShowArchived, onChanged, onError }: Props) {
  const [editing, setEditing]     = useState<Plan | 'new' | null>(null)
  const [archiving, setArchiving] = useState<Plan | null>(null)
  const [busy, setBusy]           = useState<number | null>(null)

  const act = async (id: number, fn: () => Promise<{ message: string }>) => {
    setBusy(id)
    try { onChanged((await fn()).message) } catch (err) { onError(apiError(err)) } finally { setBusy(null) }
  }

  if (!data) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-72 bg-bg-card border border-border rounded-xl animate-pulse" />)}</div>
  }

  const featureLabel = Object.fromEntries(data.features.map((f) => [f.key, f.label]))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">Edits apply immediately to every seller on the plan. Commission changes only affect <b className="text-text-secondary">new</b> orders.</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={showArchived} onChange={(e) => onShowArchived(e.target.checked)} className="accent-[#db142e]" /> Show archived
          </label>
          <Btn variant="danger" onClick={() => setEditing('new')}><Plus size={14} /> New plan</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.plans.map((p) => (
          <div key={p.id} className={clsx('bg-bg-card border rounded-xl p-4 flex flex-col gap-3', p.archived_at ? 'border-border opacity-60' : 'border-border hover:border-border-light')}
            style={{ borderTop: `3px solid ${p.badge_color}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PlanBadge name={p.name} color={p.badge_color} tierKey={p.tier_key} />
                  {p.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green font-semibold">DEFAULT</span>}
                  {!p.is_active && !p.archived_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-muted font-semibold">INACTIVE</span>}
                  {p.archived_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-muted font-semibold">ARCHIVED</span>}
                </div>
                <p className="text-[11px] text-text-muted mt-1 font-mono">{p.slug} · tier {p.tier}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-text-secondary" title={`${p.total_sellers} sellers in total`}>
                <Users size={13} /> {p.active_sellers}
              </span>
            </div>

            <div>
              <p className="text-2xl font-bold text-text-primary tabular-nums">{p.price_monthly > 0 ? formatDT(p.price_monthly, 0) : 'Free'}<span className="text-xs font-normal text-text-muted">{p.price_monthly > 0 ? ' / month' : ''}</span></p>
              <p className="text-xs text-text-muted">
                {p.price_yearly !== null ? `${formatDT(p.price_yearly, 0)} / year` : 'No yearly billing'}
                {p.trial_days > 0 && ` · ${p.trial_days}-day trial`}
              </p>
              {p.description && <p className="text-xs text-text-secondary mt-2">{p.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Commission" value={p.commission_label} />
              <Stat label="Products" value={LIMIT_LABEL(p.max_products, '')} />
              <Stat label="Images / product" value={LIMIT_LABEL(p.max_images_per_product, '')} />
              <Stat label="Sponsored at once" value={LIMIT_LABEL(p.max_sponsored_products, '')} />
            </div>

            <ul className="space-y-1 text-xs flex-1">
              {data.features.map((f) => (
                <li key={f.key} className={clsx('flex items-start gap-1.5', p.features?.[f.key] ? 'text-text-secondary' : 'text-text-muted line-through opacity-60')}>
                  {p.features?.[f.key] ? <Check size={12} className="text-accent-green mt-0.5 flex-shrink-0" /> : <X size={12} className="mt-0.5 flex-shrink-0" />}
                  {featureLabel[f.key]}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
              {p.archived_at ? (
                <Btn onClick={() => act(p.id, () => plansApi.restore(p.id))} disabled={busy === p.id}><RotateCcw size={13} /> Restore</Btn>
              ) : (
                <>
                  <Btn onClick={() => setEditing(p)}><Pencil size={13} /> Edit</Btn>
                  {!p.is_default && (
                    <Btn onClick={() => act(p.id, () => plansApi.toggle(p.id))} disabled={busy === p.id} title={p.is_active ? 'Hide from sellers' : 'Offer to sellers'}>
                      <Power size={13} /> {p.is_active ? 'Deactivate' : 'Activate'}
                    </Btn>
                  )}
                  {!p.is_default && p.is_active && (
                    <Btn onClick={() => act(p.id, () => plansApi.makeDefault(p.id))} disabled={busy === p.id} title="Fallback plan after expiry / cancellation">
                      <Star size={13} /> Make default
                    </Btn>
                  )}
                  {!p.is_default && (
                    <Btn onClick={() => setArchiving(p)} className="text-accent-red"><Archive size={13} /> Archive</Btn>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <PlanEditor
          plan={editing === 'new' ? null : editing}
          features={data.features}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); onChanged(msg) }}
          onError={onError}
        />
      )}

      {archiving && (
        <ArchiveDialog plan={archiving} onClose={() => setArchiving(null)}
          onDone={(msg) => { setArchiving(null); onChanged(msg) }} onError={onError} />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-primary border border-border rounded-md px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-widest text-text-muted">{label}</p>
      <p className="text-text-primary">{value}</p>
    </div>
  )
}

// ── Editor ────────────────────────────────────────────────────────────────────

const toNum = (v: string) => (v.trim() === '' ? null : Number(v))
const fromNum = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

function PlanEditor({ plan, features, onClose, onSaved, onError }: {
  plan: Plan | null
  features: { key: string; label: string }[]
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const creating = !plan
  const [f, setF] = useState({
    slug: '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    badge_color: plan?.badge_color ?? '#db142e',
    display_order: fromNum(plan?.display_order),
    tier: plan?.tier ?? 1,
    price_monthly: fromNum(plan?.price_monthly ?? 0),
    price_yearly: fromNum(plan?.price_yearly),
    trial_days: fromNum(plan?.trial_days ?? 0),
    commission_mode: plan?.commission_rate !== null && plan?.commission_rate !== undefined ? 'flat' : 'tiers',
    commission_rate: fromNum(plan?.commission_rate),
    commission_reduction: fromNum(plan?.commission_reduction ?? 0),
    max_products: fromNum(plan?.max_products),
    max_images_per_product: fromNum(plan?.max_images_per_product),
    max_sponsored_products: fromNum(plan?.max_sponsored_products),
    features: { ...Object.fromEntries(features.map((x) => [x.key, false])), ...(plan?.features ?? {}) } as Record<string, boolean>,
    is_active: plan?.is_active ?? true,
    reason: '',
  })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  const yearlyDiscount = f.price_yearly && Number(f.price_monthly) > 0
    ? Math.round((1 - Number(f.price_yearly) / (Number(f.price_monthly) * 12)) * 100) : null

  const save = async () => {
    setSaving(true)
    const body: PlanInput & { slug?: string } = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      badge_color: f.badge_color,
      tier: Number(f.tier) as 0 | 1 | 2,
      price_monthly: Number(f.price_monthly || 0),
      price_yearly: toNum(f.price_yearly),
      trial_days: Number(f.trial_days || 0),
      commission_rate: f.commission_mode === 'flat' ? toNum(f.commission_rate) : null,
      commission_reduction: f.commission_mode === 'tiers' ? Number(f.commission_reduction || 0) : 0,
      max_products: toNum(f.max_products),
      max_images_per_product: toNum(f.max_images_per_product),
      max_sponsored_products: toNum(f.max_sponsored_products),
      features: f.features,
      is_active: f.is_active,
      reason: f.reason.trim() || undefined,
      ...(f.display_order !== '' ? { display_order: Number(f.display_order) } : {}),
    }
    try {
      const res = creating
        ? await plansApi.create({ ...body, slug: f.slug.trim() })
        : await plansApi.update(plan!.id, body)
      onSaved(res.message)
    } catch (err) {
      onError(apiError(err, 'Could not save the plan.'))
    } finally {
      setSaving(false)
    }
  }

  const section = 'text-[10px] font-bold uppercase tracking-widest text-text-secondary border-b border-border pb-1.5 mb-3'

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-bg-card border border-border rounded-xl shadow-card animate-fade-in">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-card">
          <h2 className="text-base font-semibold text-text-primary">{creating ? 'New plan' : `Edit ${plan!.name}`}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <p className={section}>Identity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name" required><input value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. Gold Pepper" /></Field>
              {creating ? (
                <Field label="Slug" required hint="Lowercase, permanent — stored on subscriptions & orders.">
                  <input value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className={clsx(inputCls, 'font-mono')} placeholder="gold" />
                </Field>
              ) : (
                <Field label="Slug"><input value={plan!.slug} disabled className={clsx(inputCls, 'font-mono')} /></Field>
              )}
              <Field label="Description"><input value={f.description} onChange={(e) => set('description', e.target.value)} className={inputCls} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Badge colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={f.badge_color} onChange={(e) => set('badge_color', e.target.value)} className="w-9 h-9 rounded border border-border bg-transparent cursor-pointer" />
                    <PlanBadge name={f.name || 'Plan'} color={f.badge_color} />
                  </div>
                </Field>
                <Field label="Order"><input type="number" min={0} value={f.display_order} onChange={(e) => set('display_order', e.target.value)} className={inputCls} /></Field>
                <Field label="Tier" hint="Dashboard look">
                  <select value={f.tier} onChange={(e) => set('tier', Number(e.target.value) as 0 | 1 | 2)} className={inputCls}>
                    <option value={0}>0 · Green</option><option value={1}>1 · Red</option><option value={2}>2 · Black</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>

          <div>
            <p className={section}>Pricing & billing</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Monthly price (DT)" required><input type="number" min={0} step="0.001" value={f.price_monthly} onChange={(e) => set('price_monthly', e.target.value)} className={inputCls} /></Field>
              <Field label="Yearly price (DT)" hint={yearlyDiscount !== null ? `${yearlyDiscount}% off vs monthly` : 'Empty = monthly only'}>
                <input type="number" min={0} step="0.001" value={f.price_yearly} onChange={(e) => set('price_yearly', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Default trial days" hint="Used when an admin starts a trial"><input type="number" min={0} max={90} value={f.trial_days} onChange={(e) => set('trial_days', e.target.value)} className={inputCls} /></Field>
            </div>
          </div>

          <div>
            <p className={section}>Commission</p>
            <div className="inline-flex rounded-lg border border-border p-0.5 mb-3">
              {([['tiers', 'Platform tiers − reduction'], ['flat', 'Flat rate']] as const).map(([k, l]) => (
                <button key={k} onClick={() => set('commission_mode', k)} className={clsx('px-3 py-1.5 rounded-md text-xs font-medium', f.commission_mode === k ? 'bg-bg-hover text-text-primary' : 'text-text-muted')}>{l}</button>
              ))}
            </div>
            {f.commission_mode === 'flat' ? (
              <Field label="Flat commission (%)" required hint="Same rate at every price.">
                <input type="number" min={0} max={100} step="0.5" value={f.commission_rate} onChange={(e) => set('commission_rate', e.target.value)} className={clsx(inputCls, 'max-w-[160px]')} />
              </Field>
            ) : (
              <Field label="Reduction (points)" hint="Subtracted from the platform default tier rate, never below the floor.">
                <input type="number" min={0} max={100} step="0.5" value={f.commission_reduction} onChange={(e) => set('commission_reduction', e.target.value)} className={clsx(inputCls, 'max-w-[160px]')} />
              </Field>
            )}
            <p className="text-[11px] text-text-muted mt-2">Per-category rates aren't supported yet — use a seller override for special cases.</p>
          </div>

          <div>
            <p className={section}>Limits (empty = unlimited)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Max products"><input type="number" min={1} value={f.max_products} onChange={(e) => set('max_products', e.target.value)} className={inputCls} placeholder="∞" /></Field>
              <Field label="Max images / product"><input type="number" min={1} max={100} value={f.max_images_per_product} onChange={(e) => set('max_images_per_product', e.target.value)} className={inputCls} placeholder="∞" /></Field>
              <Field label="Max sponsored at once"><input type="number" min={0} value={f.max_sponsored_products} onChange={(e) => set('max_sponsored_products', e.target.value)} className={inputCls} placeholder="∞" /></Field>
            </div>
          </div>

          <div>
            <p className={section}>Features (enforced by the API)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {features.map((x) => (
                <label key={x.key} className={clsx('flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                  f.features[x.key] ? 'border-accent-green/40 bg-accent-green/5' : 'border-border hover:border-border-light')}>
                  <input type="checkbox" checked={!!f.features[x.key]} onChange={(e) => set('features', { ...f.features, [x.key]: e.target.checked })} className="mt-0.5 accent-[#198f41]" />
                  <span className="text-sm text-text-primary">{x.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={f.is_active} disabled={plan?.is_default} onChange={(e) => set('is_active', e.target.checked)} className="accent-[#198f41]" />
              Offered to sellers (active)
            </label>
            <Field label="Change note" hint="Optional — kept in the audit log">
              <input value={f.reason} onChange={(e) => set('reason', e.target.value)} className={inputCls} placeholder="e.g. Ramadan pricing" />
            </Field>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t border-border bg-bg-card">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" onClick={save} disabled={saving || !f.name.trim() || (creating && !f.slug) || (f.commission_mode === 'flat' && f.commission_rate === '') || (!!f.reason && f.reason.trim().length < 5)}>
            {saving && <Loader2 size={13} className="animate-spin" />} {creating ? 'Create plan' : 'Save changes'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

function ArchiveDialog({ plan, onClose, onDone, onError }: {
  plan: Plan; onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy]     = useState(false)
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-card border border-border rounded-xl p-5 space-y-4 animate-fade-in">
        <h2 className="text-base font-semibold text-text-primary">Archive {plan.name}?</h2>
        <p className="text-sm text-text-secondary">
          {plan.total_sellers > 0
            ? `${plan.total_sellers} seller(s) are on this plan. They keep it until you move them; nobody new can join. The plan is archived, never deleted.`
            : 'This plan has no sellers. If it was never used it is deleted, otherwise archived.'}
        </p>
        <ReasonField value={reason} onChange={setReason} placeholder="Why is this plan retired?" />
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" disabled={busy || !reasonOk(reason)} onClick={async () => {
            setBusy(true)
            try { onDone((await plansApi.archive(plan.id, reason)).message) } catch (err) { onError(apiError(err)) } finally { setBusy(false) }
          }}>
            {busy && <Loader2 size={13} className="animate-spin" />} Archive
          </Btn>
        </div>
      </div>
    </div>
  )
}
