'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Plus, Star, Trash2, Check, X, Ban } from 'lucide-react'
import clsx from 'clsx'
import type { DisplayFeature } from '@/types/subscriptions'
import { DESCRIPTION_MAX, ICONS, LABEL_MAX } from './pricing'
import { inputCls } from './ui'

/** Editor rows carry a stable client key so React keeps focus while reordering. */
export type FeatureRow = DisplayFeature & { _key: string }

let seq = 0
export const toRows = (list: DisplayFeature[]): FeatureRow[] => list.map((f) => ({ ...f, _key: `r${++seq}` }))
export const newRow = (): FeatureRow => ({ _key: `r${++seq}`, label: '', description: null, icon: null, included: true, highlight: false })

export function rowErrors(r: FeatureRow): { label?: string; description?: string } {
  const e: { label?: string; description?: string } = {}
  if (!r.label.trim()) e.label = 'Label required'
  else if (r.label.trim().length > LABEL_MAX) e.label = `Max ${LABEL_MAX} characters`
  if ((r.description ?? '').trim().length > DESCRIPTION_MAX) e.description = `Max ${DESCRIPTION_MAX} characters`
  return e
}

export default function DisplayFeaturesEditor({ rows, onChange, icons, max }: {
  rows: FeatureRow[]
  onChange: (rows: FeatureRow[]) => void
  icons: string[]
  max: number
}) {
  const [dragging, setDragging]   = useState<number | null>(null)
  const [over, setOver]           = useState<number | null>(null)
  const [confirming, setConfirm]  = useState<string | null>(null)
  const [focusKey, setFocusKey]   = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  // Focus the label of a freshly added row, or keep focus on a moved row's arrow
  // (the opposite one once it reaches the top / bottom and its own is disabled).
  useEffect(() => {
    if (!focusKey) return
    listRef.current?.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus()
    setFocusKey(null)
  }, [focusKey, rows])

  const patch = (i: number, p: Partial<FeatureRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return
    const next = rows.slice()
    const [r] = next.splice(from, 1)
    next.splice(to, 0, r)
    onChange(next)
  }
  const add = () => {
    const r = newRow()
    onChange([...rows, r])
    setFocusKey(`${r._key}-label`)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">Marketing bullets under the capabilities. Not enforced — say only what the plan really offers.</p>
        <span className={clsx('text-[11px] tabular-nums', rows.length >= max ? 'text-accent-orange' : 'text-text-muted')}>{rows.length}/{max}</span>
      </div>

      {rows.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-text-muted">
          No features yet. The card shows only limits and capabilities.
        </div>
      )}

      <ol ref={listRef} className="space-y-2" aria-label="Pricing-page features">
        {rows.map((r, i) => {
          const err = rowErrors(r)
          const Icon = r.icon ? ICONS[r.icon] : null
          return (
            <li key={r._key}
              onDragOver={(e) => { if (dragging === null) return; e.preventDefault(); setOver(i) }}
              onDrop={(e) => { e.preventDefault(); if (dragging !== null) move(dragging, i); setDragging(null); setOver(null) }}
              className={clsx('bg-bg-primary border rounded-lg p-2.5 transition-colors',
                over === i && dragging !== null && dragging !== i ? 'border-accent-purple' : 'border-border',
                dragging === i && 'opacity-50')}>
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-0.5 pt-1">
                  <span draggable onDragStart={(e) => { setDragging(i); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDragging(null); setOver(null) }}
                    className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary" title="Drag to reorder" aria-hidden="true">
                    <GripVertical size={14} />
                  </span>
                  <button type="button" data-focus={`${r._key}-up`} onClick={() => { move(i, i - 1); setFocusKey(`${r._key}-${i - 1 === 0 ? 'down' : 'up'}`) }} disabled={i === 0}
                    className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30" aria-label={`Move "${r.label || 'feature'}" up`}>
                    <ChevronUp size={13} />
                  </button>
                  <button type="button" data-focus={`${r._key}-down`} onClick={() => { move(i, i + 1); setFocusKey(`${r._key}-${i + 1 === rows.length - 1 ? 'up' : 'down'}`) }} disabled={i === rows.length - 1}
                    className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30" aria-label={`Move "${r.label || 'feature'}" down`}>
                    <ChevronDown size={13} />
                  </button>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <IconPicker value={r.icon} icons={icons} onChange={(icon) => patch(i, { icon })} />
                    <input data-focus={`${r._key}-label`} value={r.label} maxLength={LABEL_MAX + 20}
                      onChange={(e) => patch(i, { label: e.target.value })}
                      placeholder="e.g. Support prioritaire 7j/7" aria-label="Feature label" aria-invalid={!!err.label}
                      className={clsx(inputCls, 'py-1.5', err.label && 'border-accent-red/60', !r.included && 'line-through text-text-muted')} />
                  </div>
                  <input value={r.description ?? ''} maxLength={DESCRIPTION_MAX + 40}
                    onChange={(e) => patch(i, { description: e.target.value || null })}
                    placeholder="Optional description (small text under the label)" aria-label="Feature description" aria-invalid={!!err.description}
                    className={clsx(inputCls, 'py-1.5 text-xs', err.description && 'border-accent-red/60')} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    {err.label && <span className="text-accent-red">{err.label}</span>}
                    {err.description && <span className="text-accent-red">Description: {err.description}</span>}
                    <span className={clsx('tabular-nums', r.label.trim().length > LABEL_MAX ? 'text-accent-red' : 'text-text-muted')}>{r.label.trim().length}/{LABEL_MAX}</span>
                    {Icon === null && r.icon && <span className="text-accent-orange">Unknown icon</span>}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => patch(i, { included: !r.included })} aria-pressed={r.included}
                      title={r.included ? 'Included (✓) — click to show as not included (✗)' : 'Shown as not included (✗)'}
                      className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border',
                        r.included ? 'border-accent-green/40 bg-accent-green/10 text-accent-green' : 'border-border text-text-muted')}>
                      {r.included ? <><Check size={12} /> Included</> : <><X size={12} /> Not included</>}
                    </button>
                    <button type="button" onClick={() => patch(i, { highlight: !r.highlight })} aria-pressed={r.highlight}
                      title="Highlight as a key selling point"
                      className={clsx('p-1.5 rounded-md border', r.highlight ? 'border-accent-orange/50 bg-accent-orange/15 text-accent-orange' : 'border-border text-text-muted hover:text-text-primary')}
                      aria-label="Highlight">
                      <Star size={13} fill={r.highlight ? 'currentColor' : 'none'} />
                    </button>
                    {confirming === r._key ? null : (
                      <button type="button" onClick={() => setConfirm(r._key)} className="p-1.5 rounded-md border border-border text-text-muted hover:text-accent-red hover:border-accent-red/40" aria-label={`Delete "${r.label || 'feature'}"`}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  {confirming === r._key && (
                    <div className="flex items-center gap-1 text-[11px]" role="alertdialog" aria-label="Confirm delete">
                      <span className="text-text-secondary">Delete?</span>
                      <button type="button" autoFocus onClick={() => { onChange(rows.filter((_, j) => j !== i)); setConfirm(null) }}
                        className="px-2 py-0.5 rounded bg-accent-red text-white font-semibold">Delete</button>
                      <button type="button" onClick={() => setConfirm(null)} className="px-2 py-0.5 rounded border border-border text-text-secondary">Keep</button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <button type="button" onClick={add} disabled={rows.length >= max}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-light disabled:opacity-40 disabled:cursor-not-allowed">
        <Plus size={14} /> {rows.length >= max ? `Maximum ${max} features` : 'Add a feature'}
      </button>
    </div>
  )
}

/** Small fixed icon set (PlanDisplayFeature::ICONS). */
function IconPicker({ value, icons, onChange }: { value: string | null; icons: string[]; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Current = value ? ICONS[value] : null

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true) }
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Icon: ${value ?? 'none'}`}
        className="w-9 h-9 rounded-lg border border-border bg-bg-card flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-light">
        {Current ? <Current size={15} /> : <Ban size={14} className="opacity-40" />}
      </button>
      {open && (
        <div role="listbox" aria-label="Choose an icon" className="absolute z-20 top-10 left-0 w-[212px] p-2 grid grid-cols-6 gap-1 bg-bg-secondary border border-border rounded-lg shadow-card">
          <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(null); setOpen(false) }} title="No icon"
            className={clsx('w-8 h-8 rounded-md flex items-center justify-center hover:bg-bg-hover', !value ? 'bg-bg-hover text-text-primary' : 'text-text-muted')}>
            <Ban size={14} />
          </button>
          {icons.map((key) => {
            const I = ICONS[key]
            if (!I) return null
            return (
              <button key={key} type="button" role="option" aria-selected={value === key} title={key} onClick={() => { onChange(key); setOpen(false) }}
                className={clsx('w-8 h-8 rounded-md flex items-center justify-center hover:bg-bg-hover', value === key ? 'bg-accent-purple/25 text-text-primary' : 'text-text-secondary')}>
                <I size={15} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
