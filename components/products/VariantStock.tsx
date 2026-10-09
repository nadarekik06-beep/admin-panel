'use client'

/**
 * Per-variant stock of a product (admin): the list used on the product page and
 * the hover/focus breakdown of the Stock column in the product list.
 * Data: stock_breakdown from GET /api/admin/products(/{id}) and /review —
 * total = active variants, low = at/below the threshold (product override or shop setting).
 */

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Layers } from 'lucide-react'
import type { StockBreakdown, StockBreakdownVariant, StockState } from '@/types/productReview'
import { formatDT } from '@/app/(dashboard)/products/reviewUtils'

const STATE: Record<StockState, { label: string; row: string; num: string; badge: string }> = {
  out:      { label: 'Out of stock', row: 'border-l-accent-red bg-accent-red/[0.06]',       num: 'text-accent-red',    badge: 'bg-accent-red/10 text-accent-red border-accent-red/25' },
  low:      { label: 'Low',          row: 'border-l-accent-orange bg-accent-orange/[0.06]', num: 'text-accent-orange', badge: 'bg-accent-orange/10 text-accent-orange border-accent-orange/25' },
  ok:       { label: 'In stock',     row: 'border-l-transparent',                           num: 'text-text-primary',  badge: 'bg-accent-green/10 text-accent-green border-accent-green/25' },
  inactive: { label: 'Inactive',     row: 'border-l-transparent opacity-50',                num: 'text-text-muted',    badge: 'bg-bg-primary text-text-muted border-border' },
}

export const stockStateClass = (s: StockState) =>
  s === 'out' ? 'text-accent-red' : s === 'low' ? 'text-accent-orange' : 'text-text-secondary'

function Swatches({ v, size = 18 }: { v: StockBreakdownVariant; size?: number }) {
  const colors = v.options.filter((o) => o.attribute === 'color')
  if (!colors.length) {
    return (
      <span className="rounded-md bg-bg-primary border border-border flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
        <Layers size={size * 0.55} className="text-text-muted" />
      </span>
    )
  }
  return (
    <span className="flex -space-x-1 flex-shrink-0">
      {colors.map((c, i) => (
        <span key={i} title={c.value} className="rounded-full border border-border ring-1 ring-bg-card"
          style={{ width: size, height: size, background: c.color_hex ?? '#94a3b8' }} />
      ))}
    </span>
  )
}

/** One row per variant: swatch/label, SKU, price if different, stock + state. */
export function VariantStockList({ breakdown, compact = false }: { breakdown: StockBreakdown; compact?: boolean }) {
  return (
    <div>
      <ul className={clsx(compact ? 'space-y-1' : 'space-y-1.5')}>
        {breakdown.variants.map((v) => {
          const st = STATE[v.state]
          return (
            <li key={v.id} className={clsx('flex items-center gap-2.5 rounded-lg border border-border border-l-[3px]', compact ? 'px-2 py-1' : 'px-2.5 py-1.5', st.row)}>
              <Swatches v={v} size={compact ? 14 : 18} />
              <div className="flex-1 min-w-0">
                <p className={clsx('text-text-primary truncate', compact ? 'text-xs' : 'text-sm', !v.is_active && 'line-through')}>{v.label || `#${v.id}`}</p>
                {!compact && (v.sku || v.price !== null) && (
                  <p className="text-[10px] text-text-muted truncate">
                    {v.sku && <span className="font-mono">{v.sku}</span>}
                    {v.sku && v.price !== null && ' · '}
                    {v.price !== null && formatDT(v.price)}
                  </p>
                )}
              </div>
              <span className={clsx('font-semibold tabular-nums', compact ? 'text-xs' : 'text-sm', st.num)}>{v.stock}</span>
              {!compact && (
                <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap', st.badge)}>{st.label}</span>
              )}
            </li>
          )
        })}
      </ul>
      <div className={clsx('flex items-center justify-between gap-3 text-text-muted', compact ? 'mt-1.5 text-[10px]' : 'mt-2.5 text-xs')}>
        <span>Low ≤ {breakdown.threshold} ({breakdown.threshold_source === 'product' ? 'product' : 'shop'})</span>
        <span>Total (active): <span className="font-semibold text-text-primary tabular-nums">{breakdown.total}</span></span>
      </div>
    </div>
  )
}

/** Stock column of the product list: total + state, per-variant breakdown on hover/focus. */
export function StockCell({ stock, breakdown }: { stock: number; breakdown?: StockBreakdown }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)

  const total = breakdown?.total ?? stock
  const state: StockState = breakdown?.state ?? (stock <= 0 ? 'out' : stock <= 2 ? 'low' : 'ok')
  const hasVariants = !!breakdown?.has_variants

  const open = () => {
    if (!hasVariants || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const above = r.bottom + 260 > window.innerHeight
    setPos({ top: above ? r.top - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - 300), above })
  }

  return (
    <span
      ref={ref}
      tabIndex={hasVariants ? 0 : undefined}
      onMouseEnter={open} onMouseLeave={() => setPos(null)} onFocus={open} onBlur={() => setPos(null)}
      className={clsx('inline-flex items-center gap-1.5 text-sm font-medium outline-none', stockStateClass(state), hasVariants && 'cursor-help')}
      aria-label={hasVariants ? `Stock ${total}, ${breakdown!.variants.length} variants` : undefined}
    >
      {total}
      {state === 'out' && <span className="text-xs">(Out)</span>}
      {state === 'low' && <span className="text-xs">(Low)</span>}
      {hasVariants && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted border border-border rounded px-1">
          <Layers size={10} /> {breakdown!.variants.length}
          {(breakdown!.out_count + breakdown!.low_count) > 0 && (
            <span className={breakdown!.out_count ? 'text-accent-red' : 'text-accent-orange'}>· {breakdown!.out_count + breakdown!.low_count}!</span>
          )}
        </span>
      )}
      {pos && hasVariants && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          className="fixed z-[100] w-72 max-w-[calc(100vw-16px)] bg-bg-card border border-border rounded-xl shadow-xl p-3 pointer-events-none"
          style={{ top: pos.top, left: Math.max(8, pos.left), transform: pos.above ? 'translateY(-100%)' : undefined }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Stock by variant</p>
          <VariantStockList breakdown={breakdown!} compact />
        </div>,
        document.body,
      )}
    </span>
  )
}
