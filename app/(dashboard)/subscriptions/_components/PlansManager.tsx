'use client'

import { useState } from 'react'
import { Plus, Pencil, Archive, RotateCcw, Power, Star, Users, Check, X, Award, LayoutTemplate } from 'lucide-react'
import clsx from 'clsx'
import { plansApi, apiError } from '@/lib/api/subscriptions'
import type { Plan, PlansPayload } from '@/types/subscriptions'
import { Btn, PlanBadge, ReasonField, formatDT, reasonOk } from './ui'
import PlanEditor from './PlanEditor'

import BrandLoader from '@/components/brand/BrandLoader'
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
                  {p.is_recommended && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-orange/15 text-accent-orange font-semibold">RECOMMENDED</span>}
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
              {p.tagline && <p className="text-xs text-text-secondary mt-2">“{p.tagline}”</p>}
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

            <p className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
              <LayoutTemplate size={12} />
              {p.display_features?.length ? `${p.display_features.length} pricing-page feature${p.display_features.length > 1 ? 's' : ''}` : 'No pricing-page features'}
              {(p.hidden_limits?.length ?? 0) + Object.values(p.capability_display ?? {}).filter((c) => c.visible === false).length > 0 && ' · some items hidden'}
            </p>

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
                  {p.is_active && (
                    <Btn onClick={() => act(p.id, () => plansApi.recommend(p.id))} disabled={busy === p.id} title={p.is_recommended ? 'Remove the “Populaire” badge' : 'Show the “Populaire” badge on the pricing page'}>
                      <Award size={13} /> {p.is_recommended ? 'Unrecommend' : 'Recommend'}
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
          data={data}
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
            {busy && <BrandLoader variant="inline" size={13} />} Archive
          </Btn>
        </div>
      </div>
    </div>
  )
}
