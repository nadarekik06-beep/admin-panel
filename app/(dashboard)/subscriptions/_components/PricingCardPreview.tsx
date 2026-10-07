'use client'

import { Check, X, Percent, Leaf, Flame, Crown } from 'lucide-react'
import clsx from 'clsx'
import type { Capability } from '@/types/subscriptions'
import { ICONS, fmtPct, previewLines, type PreviewInput } from './pricing'

const TIER_ICON = [Leaf, Flame, Crown] as const

/**
 * Live preview of the plan's card on /become-a-vendor, built from the editor's
 * unsaved state with the same rules as the public API.
 */
export default function PricingCardPreview({ input, capabilities, active }: { input: PreviewInput; capabilities: Capability[]; active: boolean }) {
  const dark   = input.tier === 2
  const accent = input.badge_color || '#db142e'
  const Icon   = TIER_ICON[input.tier] ?? Leaf
  const lines  = previewLines(input, capabilities)
  const free   = input.price_monthly <= 0
  const range  = input.commission
  const price  = free ? 'Gratuit' : `${Number.isInteger(input.price_monthly) ? input.price_monthly : input.price_monthly.toFixed(1)} DT`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Live preview · /become-a-vendor</p>
        {!active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-orange/15 text-accent-orange font-semibold">Hidden: plan inactive</span>}
      </div>

      <div className="rounded-2xl p-3" style={{ background: '#f7f7f5' }}>
        <article
          aria-label={`Preview of ${input.name || 'the plan'} card`}
          className={clsx('relative overflow-hidden rounded-[22px] px-5 pt-6 pb-5 flex flex-col', dark ? 'text-white' : 'text-[#111]')}
          style={{
            background: dark ? 'linear-gradient(160deg, #111827 0%, #0b1220 100%)' : '#fff',
            boxShadow: input.is_recommended
              ? `0 0 0 2px ${accent}, 0 22px 44px -26px ${accent}`
              : `inset 0 0 0 1.5px ${accent}38, 0 18px 44px -30px rgba(17,17,17,.35)`,
          }}
        >
          {input.is_recommended && (
            <span className="absolute top-4 -right-10 w-36 py-1 rotate-45 text-center text-[10px] font-black uppercase tracking-[.14em] text-white"
              style={{ background: `linear-gradient(90deg, ${accent}, ${accent}cc)` }}>Populaire</span>
          )}

          <header className="flex items-center gap-3 pr-10">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}1f`, color: accent }}>
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-black leading-tight truncate">{input.name || 'Nom du plan'}</h3>
              {input.tagline.trim() && <p className={clsx('text-[11px] font-semibold mt-0.5', dark ? 'text-white/55' : 'text-gray-500')}>{input.tagline}</p>}
            </div>
          </header>

          <div className="flex items-baseline gap-1.5 mt-4">
            <span className="text-4xl font-black tracking-tight leading-none">{price}</span>
            <span className={clsx('text-xs font-semibold', dark ? 'text-white/55' : 'text-gray-500')}>/{free ? 'à vie' : 'mois'}</span>
          </div>

          <div className={clsx('mt-3 pb-3 border-b border-dashed', dark ? 'border-white/15' : 'border-black/10')}>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold"
              style={dark ? { background: 'rgba(245,158,11,.14)', color: '#f59e0b' } : { background: `${accent}1c`, color: accent }}>
              <Percent size={11} />
              {range ? (range.min === range.max ? fmtPct(range.min) : `${fmtPct(range.min)} – ${fmtPct(range.max)}`) : '…'} de commission
            </span>
          </div>

          <ul className="flex flex-col gap-2 mt-3 mb-4">
            {lines.length === 0 && <li className="text-xs text-gray-400 italic">Aucun élément affiché</li>}
            {lines.map((l) => {
              const LineIcon = l.icon ? ICONS[l.icon] : undefined
              const on = l.included
              return (
                <li key={l.key} title={l.title ?? undefined}
                  className={clsx('flex items-start gap-2 text-[13px] leading-snug',
                    on ? (dark ? 'text-white/90 font-semibold' : 'text-gray-800 font-semibold') : (dark ? 'text-white/40' : 'text-gray-400'),
                    l.highlight && on && 'font-extrabold -mx-1.5 px-1.5 py-1 rounded-lg')}
                  style={l.highlight && on ? { background: dark ? 'rgba(245,158,11,.14)' : `${accent}1a` } : undefined}>
                  <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-px"
                    style={on ? { background: accent, color: dark ? '#111' : '#fff' } : { background: dark ? 'rgba(255,255,255,.08)' : 'rgba(17,17,17,.06)' }}>
                    {on ? <Check size={11} /> : <X size={11} />}
                  </span>
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-1.5">
                      {LineIcon && l.kind === 'feature' && <LineIcon size={13} style={on ? { color: accent } : undefined} />}
                      {l.label}
                    </span>
                    {l.description && <span className={clsx('block text-[11px] font-medium mt-0.5', dark ? 'text-white/55' : 'text-gray-500')}>{l.description}</span>}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-auto rounded-xl py-3 text-center text-[11px] font-extrabold uppercase tracking-[.07em]"
            style={dark ? { background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#111' } : { background: input.tier === 0 ? '#198f41' : accent, color: '#fff' }}>
            {free ? 'Commencer gratuitement' : `Choisir ${input.name || 'ce plan'}`}
          </div>
          <p className={clsx('mt-2 text-center text-[10px] font-semibold', dark ? 'text-white/50' : 'text-gray-500')}>
            {free ? 'Sans carte bancaire' : 'Disponible après validation'}
          </p>
        </article>
      </div>
      <p className="text-[11px] text-text-muted">Hover a capability to see its description. Card order: limits, capabilities, then your features.</p>
    </div>
  )
}
