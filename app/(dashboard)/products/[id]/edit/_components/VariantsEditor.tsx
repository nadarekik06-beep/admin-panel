'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Check, Copy, Layers, Plus, Trash2 } from 'lucide-react'
import type { Attribute } from '@/components/types'
import ImageSetManager from './ImageSetManager'
import { Card, inputCls, Toggle } from './ui'
import {
  type EditorState, type Errors, type ImgItem, type VariantRow,
  activeColorGroups, colorIdsOf, groupKey, isColorAxis, uid, variantLabel,
} from './editorModel'
import BrandLoader from '@/components/brand/BrandLoader'

interface Props {
  state: EditorState
  setState: (fn: (s: EditorState) => EditorState) => void
  axes: Attribute[]
  axesLoading: boolean
  hasSubcategory: boolean
  errors: Errors
  limits: { set_max: number; max_colors_per_group: number; max_file_kb: number }
  notify: (msg: string) => void
}

export default function VariantsEditor({ state, setState, axes, axesLoading, hasSubcategory, errors, limits, notify }: Props) {
  const colorAxis    = useMemo(() => axes.find(isColorAxis) ?? null, [axes])
  const otherAxes    = useMemo(() => axes.filter((a) => !isColorAxis(a)), [axes])
  const rows         = state.variants
  const groups       = useMemo(() => activeColorGroups(rows, colorAxis), [rows, colorAxis])
  const orphanGroups = Object.keys(state.colorImages).filter((k) => state.colorImages[k].length > 0 && !groups.includes(k))

  const totalStock  = rows.reduce((n, r) => n + (parseInt(r.stock, 10) || 0), 0)
  const activeCount = rows.filter((r) => r.is_active).length

  const setRows = (fn: (rows: VariantRow[]) => VariantRow[]) => setState((s) => ({ ...s, variants: fn(s.variants) }))
  const patchRow = (key: string, patch: Partial<VariantRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addRow = (optionIds: number[] = []) => setRows((rs) => [...rs, {
    key: uid('new_'), id: null, option_ids: optionIds, stock: '0', price_override: '', sku: '', is_active: true, has_orders: false,
  }])

  // Keeps the color, clears the other axes so the copy isn't an exact duplicate
  const duplicateRow = (row: VariantRow) => setRows((rs) => [...rs, {
    ...row, key: uid('new_'), id: null, option_ids: colorIdsOf(row, colorAxis), sku: '', has_orders: false,
  }])

  const removeRow = (row: VariantRow) => setState((s) => {
    return { ...s, variants: s.variants.filter((r) => r.key !== row.key) }
  })

  const setColorImages = (key: string, items: ImgItem[]) => setState((s) => ({ ...s, colorImages: { ...s.colorImages, [key]: items } }))

  const moveOrphan = (from: string, to: string) => setState((s) => {
    const target = [...(s.colorImages[to] ?? []), ...(s.colorImages[from] ?? [])]
    if (target.length > limits.set_max) notify(`Only the first ${limits.set_max} images were kept in the target group.`)
    return { ...s, colorImages: { ...s.colorImages, [from]: [], [to]: target.slice(0, limits.set_max) } }
  })

  const colorName = (key: string) => key.split('|').map((id) => colorAxis?.options.find((o) => o.id === Number(id))?.value ?? `#${id}`).join(' + ')

  if (!hasSubcategory) {
    return <EmptyNote>Choose a subcategory in <b>General</b> to manage variants — variant attributes (color, size…) come from the subcategory.</EmptyNote>
  }
  if (axesLoading) return <BrandLoader variant="section" size="sm" label="Loading variant attributes…" />
  if (axes.length === 0 && rows.length === 0) {
    return <EmptyNote>This subcategory has no variant attributes, so the product is sold as a single item. Stock and price are set in <b>Pricing &amp; Stock</b>.</EmptyNote>
  }

  const table = (list: { row: VariantRow; index: number }[], showColor: boolean) => (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-text-muted text-left">
            <th className="font-bold py-2 pr-2 w-8">#</th>
            {showColor && colorAxis && <th className="font-bold py-2 pr-2">{colorAxis.name}</th>}
            {otherAxes.map((a) => <th key={a.id} className="font-bold py-2 pr-2">{a.name}</th>)}
            <th className="font-bold py-2 pr-2 w-28">Price (TND)</th>
            <th className="font-bold py-2 pr-2 w-24">Stock <span className="text-[#db142e]">*</span></th>
            <th className="font-bold py-2 pr-2 w-32">SKU</th>
            <th className="font-bold py-2 pr-2 w-16">Active</th>
            <th className="font-bold py-2 w-28 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ row, index }) => {
            const optErr = errors[`variants.${index}.option_ids`]
            return (
              <FragmentRow key={row.key}>
                <tr className={clsx('border-t border-border align-top', !row.is_active && 'opacity-60')}>
                  <td className="py-2 pr-2 text-xs text-text-muted pt-4">{index + 1}</td>
                  {showColor && colorAxis && (
                    <td className="py-2 pr-2">
                      <ColorPicker
                        axis={colorAxis}
                        value={colorIdsOf(row, colorAxis)}
                        max={limits.max_colors_per_group}
                        error={!!optErr && colorIdsOf(row, colorAxis).length === 0}
                        onChange={(ids) => patchRow(row.key, { option_ids: [...row.option_ids.filter((id) => !colorAxis.options.some((o) => o.id === id)), ...ids] })}
                      />
                    </td>
                  )}
                  {otherAxes.map((axis) => {
                    const current = axis.options.find((o) => row.option_ids.includes(o.id))?.id ?? ''
                    return (
                      <td key={axis.id} className="py-2 pr-2">
                        <select
                          value={current}
                          onChange={(e) => {
                            const others = row.option_ids.filter((id) => !axis.options.some((o) => o.id === id))
                            patchRow(row.key, { option_ids: e.target.value ? [...others, Number(e.target.value)] : others })
                          }}
                          className={inputCls(!!optErr && current === '')}
                          aria-label={axis.name}
                        >
                          <option value="">Select…</option>
                          {axis.options.map((o) => <option key={o.id} value={o.id}>{o.value}</option>)}
                        </select>
                      </td>
                    )
                  })}
                  <td className="py-2 pr-2">
                    <input
                      type="number" min={0} step="0.001" inputMode="decimal" value={row.price_override}
                      placeholder={state.price || 'Base'} aria-label="Variant price"
                      onChange={(e) => patchRow(row.key, { price_override: e.target.value })}
                      className={inputCls(!!errors[`variants.${index}.price_override`])}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number" min={0} step={1} inputMode="numeric" value={row.stock} aria-label="Variant stock"
                      onChange={(e) => patchRow(row.key, { stock: e.target.value.replace(/[^\d]/g, '') })}
                      className={inputCls(!!errors[`variants.${index}.stock`])}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={row.sku} placeholder="Optional" aria-label="Variant SKU" maxLength={100}
                      onChange={(e) => patchRow(row.key, { sku: e.target.value })}
                      className={inputCls(!!errors[`variants.${index}.sku`])}
                    />
                  </td>
                  <td className="py-2 pr-2 pt-3.5"><Toggle checked={row.is_active} onChange={(v) => patchRow(row.key, { is_active: v })} ariaLabel={`${variantLabel(row, axes)} active`} /></td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-0.5 pt-1">
                      <RowBtn title="Duplicate" onClick={() => duplicateRow(row)}><Copy size={14} /></RowBtn>
                      <DeleteBtn row={row} onConfirm={() => removeRow(row)} />
                    </div>
                  </td>
                </tr>
                {(optErr || errors[`variants.${index}.stock`] || errors[`variants.${index}.price_override`] || row.has_orders) && (
                  <tr>
                    <td />
                    <td colSpan={20} className="pb-2 -mt-1">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        {optErr && <span className="text-[#f87171]">{optErr}</span>}
                        {errors[`variants.${index}.stock`] && <span className="text-[#f87171]">Stock: {errors[`variants.${index}.stock`]}</span>}
                        {errors[`variants.${index}.price_override`] && <span className="text-[#f87171]">Price: {errors[`variants.${index}.price_override`]}</span>}
                        {row.has_orders && <span className="text-text-muted">Has past orders — deleting keeps the order history label.</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </FragmentRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const indexed = rows.map((row, index) => ({ row, index }))
  const unassigned = colorAxis ? indexed.filter(({ row }) => colorIdsOf(row, colorAxis).length === 0) : []

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-bg-card border border-border rounded-xl p-3">
        <button type="button" onClick={() => addRow()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#db142e] hover:bg-[#b80f25] text-white text-xs font-bold transition-colors">
          <Plus size={14} /> Add variant
        </button>
        <BulkStock onApply={(v) => setRows((rs) => rs.map((r) => ({ ...r, stock: v })))} disabled={!rows.length} />
        <button type="button" disabled={!rows.length} onClick={() => setRows((rs) => rs.map((r) => ({ ...r, is_active: true })))} className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-40">Enable all</button>
        <button type="button" disabled={!rows.length} onClick={() => setRows((rs) => rs.map((r) => ({ ...r, is_active: false })))} className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-40">Disable all</button>
        <div className="ml-auto flex items-center gap-4 text-xs text-text-muted">
          <span><b className="text-text-primary">{rows.length}</b> variants</span>
          <span><b className="text-[#34d399]">{activeCount}</b> active</span>
          <span>Total stock <b className="text-text-primary">{totalStock}</b></span>
        </div>
      </div>

      {rows.length === 0 && (
        <EmptyNote>No variants — the product is sold as a single item. Click <b>Add variant</b> to sell it in several {axes.map((a) => a.name.toLowerCase()).join(' / ')} options.</EmptyNote>
      )}
      {rows.length > 0 && activeCount === 0 && (
        <div className="flex items-center gap-2 text-xs text-[#fbbf24] bg-[#f59e0b]/10 border border-[#f59e0b]/25 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> Every variant is disabled — the product will be hidden from the storefront.
        </div>
      )}

      {colorAxis ? (
        <>
          {groups.map((key) => {
            const list = indexed.filter(({ row }) => groupKey(colorIdsOf(row, colorAxis)) === key)
            const ids = key.split('|').map(Number)
            return (
              <Card
                key={key}
                title={<span className="flex items-center gap-2"><Swatches axis={colorAxis} ids={ids} /> {colorName(key)}</span>}
                description={`${list.length} variant${list.length === 1 ? '' : 's'} · photos below are shared by every variant of this color group`}
                actions={
                  otherAxes.length > 0 && (
                    <button type="button" onClick={() => addRow(ids)} className="inline-flex items-center gap-1 text-xs font-bold text-[#db142e] hover:underline">
                      <Plus size={12} /> Add {otherAxes.map((a) => a.name.toLowerCase()).join(' / ')}
                    </button>
                  )
                }
              >
                <div id={`color-group-${key}`} className="mb-4 rounded-lg bg-bg-primary/50 border border-border p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5"><Layers size={11} /> Color group photos</p>
                  <ImageSetManager
                    compact items={state.colorImages[key] ?? []} max={limits.set_max} maxFileKb={limits.max_file_kb}
                    onChange={(items) => setColorImages(key, items)} onNotify={notify}
                    error={errors[`images.color.${key}`]}
                    emptyHint="No photos for this color yet — the storefront falls back to the main gallery."
                  />
                </div>
                {table(list, true)}
              </Card>
            )
          })}

          {unassigned.length > 0 && (
            <Card title="New variants — pick a color" description="These rows need a color before they can be saved.">
              {table(unassigned, true)}
            </Card>
          )}

          {orphanGroups.map((key) => (
            <Card
              key={key}
              className="border-[#f59e0b]/40"
              title={<span className="flex items-center gap-2 text-[#fbbf24]"><AlertTriangle size={14} /> Unused color group: <Swatches axis={colorAxis} ids={key.split('|').map(Number)} /> {colorName(key)}</span>}
              description="No variant uses these colors anymore. Move the photos to another color group or remove them before saving."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {groups.length > 0 && (
                    <select defaultValue="" onChange={(e) => e.target.value && moveOrphan(key, e.target.value)} className={clsx(inputCls(), 'w-auto py-1.5 text-xs')} aria-label="Move photos to">
                      <option value="">Move photos to…</option>
                      {groups.map((g) => <option key={g} value={g}>{colorName(g)}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => setColorImages(key, [])} className="px-3 py-1.5 rounded-lg border border-[#db142e]/40 text-[#f87171] text-xs font-bold hover:bg-[#db142e]/10">Remove photos</button>
                </div>
              }
            >
              <ImageSetManager compact items={state.colorImages[key]} max={limits.set_max} maxFileKb={limits.max_file_kb} onChange={(items) => setColorImages(key, items)} onNotify={notify} error={errors[`images.color.${key}`]} />
            </Card>
          ))}
        </>
      ) : (
        rows.length > 0 && <Card title="Variants">{table(indexed, false)}</Card>
      )}
    </div>
  )
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</> }

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-text-secondary bg-bg-card border border-dashed border-border rounded-xl p-6 text-center">{children}</div>
}

function Swatches({ axis, ids }: { axis: Attribute; ids: number[] }) {
  return (
    <span className="inline-flex -space-x-1">
      {ids.map((id) => {
        const o = axis.options.find((x) => x.id === id)
        return <span key={id} title={o?.value} className="w-4 h-4 rounded-full border-2 border-bg-card inline-block" style={{ background: o?.color_hex ?? '#888' }} />
      })}
    </span>
  )
}

function RowBtn({ children, title, onClick, active }: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={clsx('inline-flex items-center gap-1 p-1.5 rounded-md transition-colors', active ? 'text-[#34d399] hover:bg-[#198f41]/15' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover')}>
      {children}
    </button>
  )
}

/** Two-step delete: first click arms it for a few seconds. */
function DeleteBtn({ row, onConfirm }: { row: VariantRow; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return armed ? (
    <button type="button" onClick={onConfirm} className="px-2 py-1 rounded-md bg-[#db142e] text-white text-[11px] font-bold">Delete?</button>
  ) : (
    <button type="button" title={row.has_orders ? 'Delete (variant has past orders)' : 'Delete variant'} aria-label="Delete variant" onClick={() => setArmed(true)}
      className="p-1.5 rounded-md text-text-muted hover:text-[#f87171] hover:bg-[#db142e]/10 transition-colors">
      <Trash2 size={14} />
    </button>
  )
}

function BulkStock({ onApply, disabled }: { onApply: (v: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex items-center gap-1">
      <input
        value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))} placeholder="Stock"
        inputMode="numeric" aria-label="Stock for all variants" disabled={disabled}
        className={clsx(inputCls(), 'w-20 py-2 text-xs')}
      />
      <button type="button" disabled={disabled || value === ''} onClick={() => { onApply(value); setValue('') }}
        className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-40">
        Set for all
      </button>
    </div>
  )
}

function ColorPicker({ axis, value, onChange, max, error }: {
  axis: Attribute; value: number[]; onChange: (ids: number[]) => void; max: number; error?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = (id: number) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else if (value.length < max) onChange([...value, id])
  }
  const names = value.map((id) => axis.options.find((o) => o.id === id)?.value).filter(Boolean).join(' + ')

  return (
    <div ref={ref} className="relative min-w-[140px]">
      <button type="button" onClick={() => setOpen((v) => !v)} className={clsx(inputCls(error), 'flex items-center gap-2 text-left')} aria-haspopup="listbox" aria-expanded={open}>
        {value.length ? <><Swatches axis={axis} ids={value} /><span className="truncate text-xs">{names}</span></> : <span className="text-text-muted text-xs">Pick color…</span>}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 w-64 bg-bg-secondary border border-border-light rounded-xl shadow-2xl p-3" role="listbox" aria-multiselectable>
          <p className="text-[10px] text-text-muted mb-2">Up to {max} colors — several colors make a multi-color variant.</p>
          <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto">
            {axis.options.map((o) => {
              const on = value.includes(o.id)
              const full = !on && value.length >= max
              return (
                <button key={o.id} type="button" disabled={full} onClick={() => toggle(o.id)} role="option" aria-selected={on}
                  className={clsx('flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors disabled:opacity-30',
                    on ? 'bg-[#db142e]/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover')}>
                  <span className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" style={{ background: o.color_hex ?? '#888' }} />
                  <span className="truncate flex-1">{o.value}</span>
                  {on && <Check size={12} className="text-[#db142e]" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
