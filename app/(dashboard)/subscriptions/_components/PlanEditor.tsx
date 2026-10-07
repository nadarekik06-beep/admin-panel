'use client'

import { useMemo, useState } from 'react'
import { X, Eye, EyeOff, Pencil, Info, Settings2, Gauge, ShieldCheck, LayoutTemplate, MonitorSmartphone, Star } from 'lucide-react'
import clsx from 'clsx'
import { plansApi, apiError, type PlanInput } from '@/lib/api/subscriptions'
import type { Plan, PlansPayload, PublicLimitKey } from '@/types/subscriptions'
import BrandLoader from '@/components/brand/BrandLoader'
import { Btn, Field, PlanBadge, inputCls } from './ui'
import { DESCRIPTION_MAX, LABEL_MAX, LIMIT_NAMES, commissionRange } from './pricing'
import DisplayFeaturesEditor, { rowErrors, toRows, type FeatureRow } from './DisplayFeaturesEditor'
import PricingCardPreview from './PricingCardPreview'

const toNum = (v: string) => (v.trim() === '' ? null : Number(v))
const fromNum = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

type Tab = 'general' | 'limits' | 'capabilities' | 'pricing' | 'preview'
const TABS: { key: Tab; label: string; Icon: typeof Settings2; mobileOnly?: boolean }[] = [
  { key: 'general',      label: 'General',      Icon: Settings2 },
  { key: 'limits',       label: 'Limits',       Icon: Gauge },
  { key: 'capabilities', label: 'Capabilities', Icon: ShieldCheck },
  { key: 'pricing',      label: 'Pricing page', Icon: LayoutTemplate },
  { key: 'preview',      label: 'Preview',      Icon: MonitorSmartphone, mobileOnly: true },
]

interface CapState { label: string; description: string; visible: boolean }

export default function PlanEditor({ plan, data, onClose, onSaved, onError }: {
  plan: Plan | null
  data: PlansPayload
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const creating     = !plan
  const capabilities = data.features
  const pricing      = data.pricing_page ?? { icons: [], limits: ['max_products', 'max_images_per_product', 'max_sponsored_products'] as PublicLimitKey[], max_display_features: 15 }

  const [tab, setTab] = useState<Tab>('general')
  const [f, setF] = useState({
    slug: '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    tagline: plan?.tagline ?? '',
    badge_color: plan?.badge_color ?? '#db142e',
    display_order: fromNum(plan?.display_order),
    tier: plan?.tier ?? 1,
    price_monthly: fromNum(plan?.price_monthly ?? 0),
    price_yearly: fromNum(plan?.price_yearly),
    trial_days: fromNum(plan?.trial_days ?? 0),
    commission_mode: (plan?.commission_rate !== null && plan?.commission_rate !== undefined ? 'flat' : 'tiers') as 'flat' | 'tiers',
    commission_rate: fromNum(plan?.commission_rate),
    commission_reduction: fromNum(plan?.commission_reduction ?? 0),
    max_products: fromNum(plan?.max_products),
    max_images_per_product: fromNum(plan?.max_images_per_product),
    max_sponsored_products: fromNum(plan?.max_sponsored_products),
    features: { ...Object.fromEntries(capabilities.map((x) => [x.key, false])), ...(plan?.features ?? {}) } as Record<string, boolean>,
    capability_display: Object.fromEntries(capabilities.map((c) => {
      const o = plan?.capability_display?.[c.key] ?? {}
      return [c.key, { label: o.label ?? '', description: o.description ?? '', visible: o.visible !== false }]
    })) as Record<string, CapState>,
    hidden_limits: (plan?.hidden_limits ?? []) as PublicLimitKey[],
    is_active: plan?.is_active ?? true,
    is_recommended: plan?.is_recommended ?? false,
    reason: '',
  })
  const [rows, setRows]       = useState<FeatureRow[]>(() => toRows(plan?.display_features ?? []))
  const [editingCap, setEditingCap] = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))
  const setCap = (key: string, p: Partial<CapState>) => setF((s) => ({ ...s, capability_display: { ...s.capability_display, [key]: { ...s.capability_display[key], ...p } } }))

  const yearlyDiscount = f.price_yearly && Number(f.price_monthly) > 0
    ? Math.round((1 - Number(f.price_yearly) / (Number(f.price_monthly) * 12)) * 100) : null

  // ── Validation (mirrors PlanRequest) ────────────────────────────────────
  const featureErrors = rows.some((r) => Object.keys(rowErrors(r)).length > 0) || rows.length > pricing.max_display_features
  const capErrors = Object.values(f.capability_display).some((c) => c.label.trim().length > LABEL_MAX || c.description.trim().length > DESCRIPTION_MAX)
  const generalErrors = !f.name.trim() || (creating && !f.slug) || (f.commission_mode === 'flat' && f.commission_rate === '')
  const tabError: Partial<Record<Tab, boolean>> = { general: generalErrors, capabilities: capErrors, pricing: featureErrors || f.tagline.length > 120 }
  const reasonBad = !!f.reason && f.reason.trim().length < 5
  const invalid = generalErrors || capErrors || featureErrors || f.tagline.length > 120 || reasonBad

  // ── Live preview input ──────────────────────────────────────────────────
  const preview = useMemo(() => ({
    name: f.name.trim(),
    tagline: f.tagline,
    badge_color: f.badge_color,
    tier: Number(f.tier) as 0 | 1 | 2,
    price_monthly: Number(f.price_monthly || 0),
    commission: commissionRange(data.commission_default ?? null, f.commission_mode, toNum(f.commission_rate), Number(f.commission_reduction || 0)),
    is_recommended: f.is_recommended,
    limits: {
      max_products: toNum(f.max_products),
      max_images_per_product: toNum(f.max_images_per_product),
      max_sponsored_products: toNum(f.max_sponsored_products),
    },
    hidden_limits: f.hidden_limits,
    features: f.features,
    capability_display: f.capability_display,
    display_features: rows,
  }), [f, rows, data.commission_default])

  const save = async () => {
    setSaving(true)
    const body: PlanInput & { slug?: string } = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      tagline: f.tagline.trim() || null,
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
      capability_display: Object.fromEntries(Object.entries(f.capability_display).map(([k, c]) => [k, {
        label: c.label.trim() || null, description: c.description.trim() || null, visible: c.visible,
      }])),
      hidden_limits: f.hidden_limits,
      display_features: rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        label: r.label.trim(), description: r.description?.trim() || null,
        icon: r.icon, included: r.included, highlight: r.highlight,
      })),
      is_active: f.is_active,
      is_recommended: f.is_recommended,
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
  const toggleLimit = (k: PublicLimitKey, show: boolean) =>
    set('hidden_limits', show ? f.hidden_limits.filter((x) => x !== k) : [...f.hidden_limits, k])

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="plan-editor-title"
        className="relative w-full max-w-6xl h-[90vh] flex flex-col bg-bg-card border border-border rounded-xl shadow-card animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="plan-editor-title" className="text-base font-semibold text-text-primary flex items-center gap-2">
            {creating ? 'New plan' : `Edit ${plan!.name}`}
            {f.name && <PlanBadge name={f.name} color={f.badge_color} tierKey={(['free', 'red', 'black'] as const)[Number(f.tier)]} />}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover"><X size={18} /></button>
        </div>

        <div role="tablist" aria-label="Plan settings" className="flex gap-1 px-5 pt-3 border-b border-border overflow-x-auto">
          {TABS.map(({ key, label, Icon, mobileOnly }) => (
            <button key={key} role="tab" type="button" aria-selected={tab === key} aria-controls={`plan-tab-${key}`} onClick={() => setTab(key)}
              className={clsx('relative inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                mobileOnly && 'lg:hidden',
                tab === key ? 'border-accent-red text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary')}>
              <Icon size={14} /> {label}
              {tabError[key] && <span className="w-1.5 h-1.5 rounded-full bg-accent-red" aria-label="has errors" />}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 flex">
          <div id={`plan-tab-${tab}`} role="tabpanel" className="flex-1 min-w-0 overflow-y-auto p-5 space-y-6">
            {tab === 'general' && (
              <>
                <div>
                  <p className={section}>Identity</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Name" required><input value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. Gold Pepper" maxLength={80} /></Field>
                    {creating ? (
                      <Field label="Slug" required hint="Lowercase, permanent — stored on subscriptions & orders.">
                        <input value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} className={clsx(inputCls, 'font-mono')} placeholder="gold" />
                      </Field>
                    ) : (
                      <Field label="Slug"><input value={plan!.slug} disabled className={clsx(inputCls, 'font-mono')} /></Field>
                    )}
                    <Field label="Internal description" hint="Admin only — the public card uses the tagline (Pricing page tab).">
                      <input value={f.description} onChange={(e) => set('description', e.target.value)} className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Badge colour">
                        <input type="color" value={f.badge_color} onChange={(e) => set('badge_color', e.target.value)} className="w-9 h-9 rounded border border-border bg-transparent cursor-pointer" />
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
                      <button key={k} type="button" onClick={() => set('commission_mode', k)} className={clsx('px-3 py-1.5 rounded-md text-xs font-medium', f.commission_mode === k ? 'bg-bg-hover text-text-primary' : 'text-text-muted')}>{l}</button>
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
                  <p className="text-[11px] text-text-muted mt-2">Per-category rates aren&apos;t supported yet — use a seller override for special cases.</p>
                </div>

                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={f.is_active} disabled={plan?.is_default} onChange={(e) => set('is_active', e.target.checked)} className="accent-[#198f41]" />
                  Offered to sellers (active) — only active plans appear on the pricing page
                </label>
              </>
            )}

            {tab === 'limits' && (
              <div>
                <p className={section}>Limits (empty = unlimited)</p>
                <div className="space-y-3">
                  {(Object.keys(LIMIT_NAMES) as PublicLimitKey[]).map((k) => {
                    const shown = !f.hidden_limits.includes(k)
                    const min = k === 'max_sponsored_products' ? 0 : 1
                    return (
                      <div key={k} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end bg-bg-primary border border-border rounded-lg p-3">
                        <Field label={LIMIT_NAMES[k]} hint={k === 'max_sponsored_products' && !f.features.sponsorships ? 'Not shown publicly: the plan has no sponsoring capability.' : undefined}>
                          <input type="number" min={min} max={k === 'max_images_per_product' ? 100 : undefined} value={f[k]} onChange={(e) => set(k, e.target.value)} className={inputCls} placeholder="∞" />
                        </Field>
                        <label className="flex items-center gap-2 text-xs text-text-secondary pb-2.5">
                          <input type="checkbox" checked={shown} onChange={(e) => toggleLimit(k, e.target.checked)} className="accent-[#198f41]" />
                          Show on pricing page
                        </label>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-text-muted mt-3">The card shows them as e.g. “30 produits” or “Produits illimités”. Hiding a limit only affects the card — it stays enforced.</p>
              </div>
            )}

            {tab === 'capabilities' && (
              <div>
                <p className={section}>Capabilities (enforced by the API)</p>
                <div className="flex items-start gap-2 mb-3 p-2.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 text-xs text-text-secondary">
                  <Info size={14} className="text-accent-cyan mt-0.5 flex-shrink-0" />
                  <span>Les nouvelles fonctionnalités techniques nécessitent une mise à jour du code. Here you can switch them per plan and change how they are worded on the pricing page.</span>
                </div>
                <div className="space-y-2">
                  {capabilities.map((c) => {
                    const d = f.capability_display[c.key]
                    const on = !!f.features[c.key]
                    const editing = editingCap === c.key
                    return (
                      <div key={c.key} className={clsx('rounded-lg border p-2.5', on ? 'border-accent-green/40 bg-accent-green/5' : 'border-border')}>
                        <div className="flex items-start gap-2">
                          <input id={`cap-${c.key}`} type="checkbox" checked={on} onChange={(e) => set('features', { ...f.features, [c.key]: e.target.checked })} className="mt-1 accent-[#198f41]" />
                          <label htmlFor={`cap-${c.key}`} className="flex-1 min-w-0 cursor-pointer">
                            <span className="block text-sm text-text-primary">{c.label}</span>
                            <span className="block text-[11px] text-text-muted">
                              Public: “{d.label.trim() || c.public_label}”{!d.visible && ' · hidden from the pricing page'}
                            </span>
                          </label>
                          <button type="button" onClick={() => setCap(c.key, { visible: !d.visible })} aria-pressed={d.visible}
                            title={d.visible ? 'Shown on the pricing page' : 'Hidden from the pricing page'}
                            className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border', d.visible ? 'border-border text-text-secondary' : 'border-accent-orange/40 text-accent-orange bg-accent-orange/10')}>
                            {d.visible ? <Eye size={12} /> : <EyeOff size={12} />} {d.visible ? 'Shown' : 'Hidden'}
                          </button>
                          <button type="button" onClick={() => setEditingCap(editing ? null : c.key)} aria-expanded={editing} aria-label={`Edit public label of ${c.public_label}`}
                            className={clsx('p-1.5 rounded-md border', editing ? 'border-accent-purple text-text-primary' : 'border-border text-text-muted hover:text-text-primary')}>
                            <Pencil size={12} />
                          </button>
                        </div>
                        {editing && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pl-6">
                            <Field label="Public label" hint={`${d.label.trim().length}/${LABEL_MAX} · empty = default`}>
                              <input value={d.label} onChange={(e) => setCap(c.key, { label: e.target.value })} placeholder={c.public_label} className={clsx(inputCls, d.label.trim().length > LABEL_MAX && 'border-accent-red/60')} />
                            </Field>
                            <Field label="Public description" hint={`${d.description.trim().length}/${DESCRIPTION_MAX} · tooltip on the card`}>
                              <input value={d.description} onChange={(e) => setCap(c.key, { description: e.target.value })} placeholder={c.public_description} className={clsx(inputCls, d.description.trim().length > DESCRIPTION_MAX && 'border-accent-red/60')} />
                            </Field>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {tab === 'pricing' && (
              <>
                <div>
                  <p className={section}>Card header</p>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <Field label="Tagline (French)" hint={`${f.tagline.length}/120 · line under the plan name, e.g. “Idéal pour débuter”`}>
                      <input value={f.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={120} className={inputCls} placeholder="Idéal pour débuter" />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-text-secondary pb-2.5">
                      <input type="checkbox" checked={f.is_recommended} onChange={(e) => set('is_recommended', e.target.checked)} className="accent-[#f59e0b]" />
                      <Star size={13} className="text-accent-orange" /> Recommended (“Populaire” badge)
                    </label>
                  </div>
                  {f.is_recommended && <p className="text-[11px] text-text-muted mt-1">Only one plan carries the badge — saving removes it from the others.</p>}
                </div>
                <div>
                  <p className={section}>Features shown on the pricing page</p>
                  <DisplayFeaturesEditor rows={rows} onChange={setRows} icons={pricing.icons} max={pricing.max_display_features} />
                </div>
              </>
            )}

            {tab === 'preview' && (
              <div className="lg:hidden max-w-sm mx-auto">
                <PricingCardPreview input={preview} capabilities={capabilities} active={f.is_active} />
              </div>
            )}
          </div>

          <aside className="hidden lg:block w-[360px] flex-shrink-0 border-l border-border overflow-y-auto p-5 bg-bg-secondary/40" aria-label="Live preview">
            <PricingCardPreview input={preview} capabilities={capabilities} active={f.is_active} />
          </aside>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 px-5 py-4 border-t border-border bg-bg-card rounded-b-xl">
          <div className="flex-1">
            <Field label="Change note" hint={reasonBad ? 'At least 5 characters.' : 'Optional — kept in the audit log with the before / after'}>
              <input value={f.reason} onChange={(e) => set('reason', e.target.value)} className={inputCls} placeholder="e.g. Ramadan pricing" maxLength={500} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="danger" onClick={save} disabled={saving || invalid}>
              {saving && <BrandLoader variant="inline" size={13} />} {creating ? 'Create plan' : 'Save changes'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
