'use client'

/**
 * VariantBuilder.tsx — admin brand products
 *
 * Exact copy of seller VariantBuilder with dark theme colours.
 * No logic changes — only CSS values adapted to admin dark theme.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Info, AlertCircle, Plus, Trash2 } from 'lucide-react'
import type { Attribute } from '@/components/types'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface VariantRow {
  id?: number
  option_ids: number[]
  stock: number
  price_override: string
  sku: string
  is_active: boolean
}

export function normalizeVariantRow(
  raw: Partial<VariantRow> & { sku?: string | null; price_override?: string | number | null }
): VariantRow {
  return {
    id:             raw.id,
    option_ids:     raw.option_ids ?? [],
    stock:          raw.stock ?? 0,
    price_override: raw.price_override != null ? String(raw.price_override) : '',
    sku:            raw.sku ?? '',
    is_active:      raw.is_active ?? true,
  }
}

export function calculateTotalStock(variants: VariantRow[]): number {
  return variants.reduce((sum, row) => sum + (Number(row.stock) || 0), 0)
}

export function validateVariantStocks(variants: VariantRow[]): Record<number, string> {
  const errors: Record<number, string> = {}
  variants.forEach((row, idx) => {
    const val = row.stock
    if (val === null || val === undefined || String(val) === '') {
      errors[idx] = 'Stock is required.'
    } else if (!Number.isInteger(Number(val)) || Number(val) < 0) {
      errors[idx] = 'Must be a whole number ≥ 0.'
    }
  })
  return errors
}

interface ColorGroup { id: string; colorOptionIds: number[] }

const MAX_COLORS_PER_GROUP = 5
const MAX_COLOR_GROUPS     = 10

interface Props {
  axes: Attribute[]
  existingVariants?: VariantRow[]
  onChange: (variants: VariantRow[]) => void
  basePrice: string
  disabled?: boolean
  externalStockErrors?: Record<number, string>
}

function cartesian(arrays: number[][]): number[][] {
  return arrays.reduce<number[][]>((acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])), [[]])
}
function comboKey(ids: number[]) { return ids.slice().sort((a, b) => a - b).join('-') }
function makeGroupId() { return Math.random().toString(36).slice(2, 9) }

function hydrateColorGroups(existingVariants: VariantRow[], colorAxis: Attribute | null): ColorGroup[] {
  if (!colorAxis || existingVariants.length === 0) return []
  const seen = new Map<string, ColorGroup>()
  for (const row of existingVariants) {
    const colorIds = row.option_ids.filter(id => colorAxis.options.some(o => o.id === id)).sort((a, b) => a - b)
    if (colorIds.length === 0) continue
    const key = colorIds.join('|')
    if (!seen.has(key)) seen.set(key, { id: makeGroupId(), colorOptionIds: colorIds })
  }
  return Array.from(seen.values())
}

export default function VariantBuilder({
  axes, existingVariants = [], onChange, basePrice, disabled = false, externalStockErrors = {},
}: Props) {
  const colorAxis    = useMemo(() => axes.find(a => a.type === 'color') ?? null, [axes])
  const nonColorAxes = useMemo(() => axes.filter(a => a.type !== 'color'), [axes])

  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(() => hydrateColorGroups(existingVariants, colorAxis))

  const [nonColorSelected, setNonColorSelected] = useState<number[][]>(() => {
    if (existingVariants.length === 0 || nonColorAxes.length === 0) return nonColorAxes.map(() => [])
    const perAxis: Set<number>[] = nonColorAxes.map(() => new Set())
    existingVariants.forEach(row => {
      row.option_ids.forEach(optId => {
        nonColorAxes.forEach((axis, axisIdx) => {
          if (axis.options.some(o => o.id === optId)) perAxis[axisIdx].add(optId)
        })
      })
    })
    return perAxis.map(s => Array.from(s))
  })

  const [rows, setRows] = useState<VariantRow[]>(() => existingVariants.map(normalizeVariantRow))
  const [stockErrors, setStockErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    onChange(rows)
    setStockErrors(validateVariantStocks(rows))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  useEffect(() => {
    if (axes.length === 0) return
    if (!colorAxis) {
      if (nonColorSelected.some(sel => sel.length === 0)) { setRows([]); return }
      const combos = cartesian(nonColorSelected)
      setRows(prev => {
        const map = new Map(prev.map(r => [comboKey(r.option_ids), r]))
        return combos.map(combo => {
          const existing = map.get(comboKey(combo))
          return existing ? { ...existing, option_ids: combo } : normalizeVariantRow({ option_ids: combo })
        })
      })
      return
    }
    const validGroups = colorGroups.filter(g => g.colorOptionIds.length > 0)
    if (validGroups.length === 0) { setRows([]); return }
    if (nonColorAxes.length > 0 && nonColorSelected.some(sel => sel.length === 0)) { setRows([]); return }
    const COLOR_SEP = '|'
    const allCombos: number[][] = validGroups.flatMap(group => {
      const colorToken = group.colorOptionIds.join(COLOR_SEP)
      const slotArrays: (number | string)[][] = nonColorAxes.length > 0 ? [[colorToken], ...nonColorSelected] : [[colorToken]]
      return cartesian(slotArrays as number[][]).map(combo =>
        combo.flatMap((token, slotIdx) => slotIdx === 0 ? String(token).split(COLOR_SEP).map(Number) : [Number(token)])
      )
    })
    setRows(prev => {
      const map = new Map(prev.map(r => [comboKey(r.option_ids), r]))
      return allCombos.map(combo => {
        const existing = map.get(comboKey(combo))
        return existing ? { ...existing, option_ids: combo } : normalizeVariantRow({ option_ids: combo })
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorGroups, nonColorSelected])

  const addGroup    = useCallback(() => setColorGroups(prev => [...prev, { id: makeGroupId(), colorOptionIds: [] }]), [])
  const removeGroup = useCallback((id: string) => setColorGroups(prev => prev.filter(g => g.id !== id)), [])
  const toggleColorInGroup = useCallback((groupId: string, optId: number) => {
    setColorGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g
      const pos = g.colorOptionIds.indexOf(optId)
      if (pos === -1) {
        if (g.colorOptionIds.length >= MAX_COLORS_PER_GROUP) return g
        return { ...g, colorOptionIds: [...g.colorOptionIds, optId] }
      }
      return { ...g, colorOptionIds: g.colorOptionIds.filter(id => id !== optId) }
    }))
  }, [])
  const toggleNonColor = useCallback((axisIdx: number, optId: number) => {
    setNonColorSelected(prev => {
      const copy = prev.map(a => [...a])
      const pos = copy[axisIdx].indexOf(optId)
      copy[axisIdx] = pos === -1 ? [...copy[axisIdx], optId] : copy[axisIdx].filter(id => id !== optId)
      return copy
    })
  }, [])
  const updateRow = useCallback((idx: number, field: 'stock' | 'price_override' | 'sku' | 'is_active', value: number | string | boolean) => {
    setRows(prev => { const copy = [...prev]; copy[idx] = { ...copy[idx], [field]: value }; return copy })
  }, [])

  const mergedErrors: Record<number, string> = { ...stockErrors, ...externalStockErrors }
  const totalStock = calculateTotalStock(rows)
  const hasErrors  = Object.keys(mergedErrors).length > 0

  if (axes.length === 0) return null

  // Dark-theme input style
  const iStyle = (hasErr?: boolean): React.CSSProperties => ({
    width: '100%', border: `1px solid ${hasErr ? '#fca5a5' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 8, padding: '6px 10px', fontSize: 13,
    background: hasErr ? 'rgba(239,68,68,0.1)' : '#0d1117',
    color: '#fff', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
  })

  const dim  = 'rgba(255,255,255,0.35)'
  const dim2 = 'rgba(255,255,255,0.08)'
  const dim3 = 'rgba(255,255,255,0.04)'

  return (
    <div>
      {/* ── STEP 1 ── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: dim, margin: '0 0 12px' }}>
          Step 1 — Select available options per attribute
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {colorAxis && (
            <div style={{ background: dim3, border: `1px solid ${dim2}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  {colorAxis.name}
                  <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', padding: '1px 6px', borderRadius: 4, textTransform: 'none', letterSpacing: 0 }}>
                    multi-group · max {MAX_COLORS_PER_GROUP} per group
                  </span>
                </p>
                <button type="button" disabled={disabled || colorGroups.length >= MAX_COLOR_GROUPS} onClick={addGroup}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#db142e', background: 'rgba(219,20,46,0.08)', border: '1px solid rgba(219,20,46,0.2)', borderRadius: 6, padding: '4px 10px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  <Plus size={11} /> Add group
                </button>
              </div>

              {colorGroups.length === 0 && (
                <div style={{ border: `1px dashed ${dim2}`, borderRadius: 8, padding: 12, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                  No color groups yet. Click <strong>Add group</strong> to create one.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colorGroups.map((group, groupIdx) => {
                  const selected = group.colorOptionIds
                  return (
                    <div key={group.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${dim2}`, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(219,20,46,0.1)', color: '#db142e', border: '1px solid rgba(219,20,46,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                          Group {groupIdx + 1} <span style={{ fontWeight: 500, color: dim }}>({selected.length}/{MAX_COLORS_PER_GROUP})</span>
                        </span>
                        <button type="button" disabled={disabled} onClick={() => removeGroup(group.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: dim, background: 'transparent', border: `1px solid ${dim2}`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <Trash2 size={9} /> Remove
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {colorAxis.options.map(opt => {
                          const isSel = selected.includes(opt.id)
                          const atMax = !isSel && selected.length >= MAX_COLORS_PER_GROUP
                          return (
                            <button key={opt.id} type="button" disabled={disabled || atMax} onClick={() => toggleColorInGroup(group.id, opt.id)} title={opt.value}
                              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', padding: 0, cursor: (disabled || atMax) ? 'not-allowed' : 'pointer', border: isSel ? '2.5px solid #db142e' : `2px solid ${dim2}`, background: opt.color_hex ?? '#e5e7eb', opacity: atMax ? 0.35 : 1, outline: isSel ? '2px solid rgba(219,20,46,0.3)' : 'none', outlineOffset: 1, transition: 'all 0.15s', fontFamily: 'inherit', flexShrink: 0 }}>
                              {isSel && (
                                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff', textShadow: '0 0 3px rgba(0,0,0,0.7)', pointerEvents: 'none' }}>
                                  {selected.indexOf(opt.id) + 1}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {selected.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                          {selected.map((id, pos) => {
                            const opt = colorAxis.options.find(o => o.id === id)
                            return opt ? (
                              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: 'rgba(219,20,46,0.08)', border: '1px solid rgba(219,20,46,0.2)', color: '#db142e', padding: '3px 8px', borderRadius: 999 }}>
                                <span style={{ fontSize: 9, fontWeight: 900, background: '#db142e', color: '#fff', borderRadius: '50%', width: 13, height: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{pos + 1}</span>
                                {opt.color_hex && <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.color_hex, border: '1px solid rgba(0,0,0,0.15)', display: 'inline-block', flexShrink: 0 }} />}
                                {opt.value}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {nonColorAxes.map((axis, axisIdx) => {
            const selected = nonColorSelected[axisIdx] ?? []
            return (
              <div key={axis.id} style={{ background: dim3, border: `1px solid ${dim2}`, borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
                  {axis.name} <span style={{ fontWeight: 500, color: dim, textTransform: 'none', letterSpacing: 0 }}>({selected.length} selected)</span>
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {axis.options.map(opt => {
                    const isSel = selected.includes(opt.id)
                    return (
                      <button key={opt.id} type="button" disabled={disabled} onClick={() => toggleNonColor(axisIdx, opt.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', border: isSel ? '2.5px solid #db142e' : `1.5px solid ${dim2}`, background: isSel ? 'rgba(219,20,46,0.1)' : 'rgba(255,255,255,0.03)', color: isSel ? '#db142e' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: isSel ? 700 : 500, transition: 'all 0.15s', fontFamily: 'inherit', flexShrink: 0 }}>
                        {opt.value}{isSel && <span style={{ fontSize: 10, color: '#db142e' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {rows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '8px 12px' }}>
            <Info size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#93c5fd', margin: 0 }}>{rows.length} combination{rows.length !== 1 ? 's' : ''} generated.</p>
          </div>
        )}
        {rows.length === 0 && (colorGroups.length > 0 || nonColorAxes.some((_, i) => nonColorSelected[i]?.length > 0)) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '8px 12px' }}>
            <Info size={13} style={{ color: '#d97706', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#fcd34d', margin: 0 }}>{colorAxis ? 'Add at least one color group with colors, and select options for every other attribute.' : 'Select at least one option for every attribute.'}</p>
          </div>
        )}
      </div>

      {/* ── STEP 2 ── */}
      {rows.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: dim, margin: 0 }}>
              Step 2 — Set stock & price ({rows.length} variants)
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: hasErrors ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${hasErrors ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`, borderRadius: 8, padding: '4px 10px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: hasErrors ? '#ef4444' : '#10b981' }}>{totalStock}</span>
            </div>
          </div>
          {hasErrors && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
              <AlertCircle size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#fca5a5', margin: 0, fontWeight: 600 }}>All variant stocks are required and must be whole numbers ≥ 0.</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 120px 80px', gap: 8, padding: '6px 12px', background: dim3, borderRadius: '8px 8px 0 0', border: `1px solid ${dim2}`, borderBottom: 'none' }}>
            {['Combination', 'Stock *', 'Price (TND)', 'SKU', 'Active'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: h === 'Stock *' ? '#db142e' : dim }}>{h}</span>
            ))}
          </div>

          {rows.map((row, rowIdx) => {
            const colorOptIds = colorAxis ? row.option_ids.filter(id => colorAxis.options.some(o => o.id === id)) : []
            const otherOptIds = colorAxis ? row.option_ids.filter(id => !colorAxis.options.some(o => o.id === id)) : row.option_ids
            const colorLabel  = colorOptIds.map(id => colorAxis?.options.find(o => o.id === id)?.value ?? '?').join('+')
            const otherLabel  = otherOptIds.map(id => { for (const axis of axes) { const opt = axis.options.find(o => o.id === id); if (opt) return opt.value } return '?' }).join(' / ')
            const label       = [colorLabel, otherLabel].filter(Boolean).join(' / ')
            const isLast      = rowIdx === rows.length - 1
            const stockErr    = mergedErrors[rowIdx]
            return (
              <div key={row.option_ids.join('-')} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 120px 80px', gap: 8, padding: '8px 12px', background: row.is_active ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)', border: `1px solid ${dim2}`, borderTop: 'none', borderRadius: isLast ? '0 0 8px 8px' : 0, alignItems: 'start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, paddingTop: 6 }}>
                  {colorAxis && colorOptIds.map(id => { const opt = colorAxis.options.find(o => o.id === id); if (!opt?.color_hex) return null; return <span key={id} title={opt.value} style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: opt.color_hex, border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} /> })}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                <div>
                  <input type="number" min="0" step="1" required value={row.stock ?? ''} onChange={e => { const raw = e.target.value; updateRow(rowIdx, 'stock', raw === '' ? 0 : Math.max(0, Math.floor(Number(raw)))) }} onBlur={e => { if (e.target.value === '') updateRow(rowIdx, 'stock', 0) }} disabled={disabled} placeholder="0" style={iStyle(!!stockErr)} />
                  {stockErr && <p style={{ fontSize: 10, color: '#ef4444', margin: '3px 0 0', fontWeight: 600 }}>{stockErr}</p>}
                </div>
                <input type="number" min="0" step="0.001" value={row.price_override ?? ''} onChange={e => updateRow(rowIdx, 'price_override', e.target.value)} placeholder={basePrice || 'base'} disabled={disabled} style={iStyle()} />
                <input type="text" value={row.sku ?? ''} onChange={e => updateRow(rowIdx, 'sku', e.target.value)} placeholder="optional" disabled={disabled} style={iStyle()} />
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
                  <input type="checkbox" checked={row.is_active} onChange={e => updateRow(rowIdx, 'is_active', e.target.checked)} disabled={disabled} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#db142e' }} />
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: dim, fontWeight: 600 }}>Quick fill:</span>
            <button type="button" disabled={disabled} onClick={() => { const s = prompt('Set stock for ALL variants:'); if (s === null) return; const stock = Math.max(0, Math.floor(Number(s))) || 0; setRows(prev => prev.map(r => ({ ...r, stock }))) }} style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Set all stock</button>
            <button type="button" disabled={disabled} onClick={() => setRows(prev => prev.map(r => ({ ...r, is_active: true })))} style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Enable all</button>
            <button type="button" disabled={disabled} onClick={() => setRows(prev => prev.map(r => ({ ...r, is_active: false })))} style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Disable all</button>
          </div>
        </div>
      )}

      {rows.length === 0 && colorGroups.length === 0 && nonColorSelected.every(a => a.length === 0) && (
        <div style={{ background: dim3, border: `1px dashed ${dim2}`, borderRadius: 10, padding: 16, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          {colorAxis ? 'Add a color group and select sizes to generate variant combinations automatically.' : 'Select options above to generate variant combinations automatically.'}
        </div>
      )}
    </div>
  )
}