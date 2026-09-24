'use client'

import { format } from 'date-fns'
import { CheckCircle2, AlertTriangle, MinusCircle, ChevronRight, Eye, ShoppingBag, Star, Zap, Tag } from 'lucide-react'
import clsx from 'clsx'
import Badge from '@/components/ui/Badge'
import type { ProductReview } from '@/types/productReview'
import { AVAILABILITY_META, formatDT } from '../../reviewUtils'

function fmtDate(value: string | null) {
  return value ? format(new Date(value), 'MMM d, yyyy · HH:mm') : '—'
}

export default function SummaryPanel({ product }: { product: ProductReview }) {
  const { pricing, inventory } = product
  const avail  = AVAILABILITY_META[inventory.availability]
  const promo  = pricing.active_promotion
  const ranged = pricing.min_price !== pricing.max_price
  const showPerformance =
    product.performance &&
    (product.status === 'approved' || product.status === 'disabled' ||
      product.performance.units_sold > 0 || product.performance.views > 0)

  return (
    <div className="space-y-4">
      {/* Price */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Price</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold text-text-primary tabular-nums">
            {ranged ? `${formatDT(pricing.min_price)} – ${formatDT(pricing.max_price)}` : formatDT(pricing.effective_price)}
          </span>
          {pricing.discount_amount > 0 && !ranged && (
            <span className="text-sm text-text-muted line-through tabular-nums">{formatDT(pricing.base_price)}</span>
          )}
        </div>
        {ranged && (
          <p className="text-xs text-text-muted mt-1">Base price {formatDT(pricing.base_price)} · variants override the price</p>
        )}
        {promo && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-accent-red/10 text-accent-red border border-accent-red/25">
            {promo.type === 'flash_sale' ? <Zap size={12} /> : <Tag size={12} />}
            {promo.name} · {promo.discount_type === 'percentage' ? `${promo.discount_value}% off` : `${formatDT(promo.discount_value)} off`}
            {promo.ends_at && <span className="text-accent-red/70">· ends {format(new Date(promo.ends_at), 'MMM d')}</span>}
          </p>
        )}
      </div>

      {/* Key facts */}
      <div className="bg-bg-card border border-border rounded-xl divide-y divide-border">
        <Row label="Category">
          {product.category_path.length ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              {product.category_path.map((c, i) => (
                <span key={c} className="inline-flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} className="text-text-muted" />}
                  {c}
                </span>
              ))}
            </span>
          ) : <Missing />}
        </Row>
        <Row label="Brand">{product.brand ?? <Missing text="Not specified" />}</Row>
        <Row label="Condition">{product.condition ?? <Missing text="Not specified" />}</Row>
        <Row label="Stock">
          <span className="inline-flex items-center gap-2">
            <span className="tabular-nums">{inventory.total_stock} units</span>
            <Badge variant={avail.badge}>{avail.label}</Badge>
          </span>
        </Row>
        {inventory.has_variants && (
          <Row label="Variants">
            <span className="tabular-nums">
              {inventory.variant_count}
              {inventory.out_of_stock_variants > 0 && <span className="text-accent-red"> · {inventory.out_of_stock_variants} out</span>}
              {inventory.low_stock_variants > 0 && <span className="text-accent-orange"> · {inventory.low_stock_variants} low (≤{inventory.low_stock_threshold})</span>}
            </span>
          </Row>
        )}
        <Row label="Delivery">
          {pricing.delivery.is_free ? <span className="text-accent-green">Free delivery</span>
            : `${formatDT(pricing.delivery.fee)}${pricing.delivery.is_default ? ' (platform default)' : ''}`}
        </Row>
        <Row label="Featured">{product.featured ? <span className="text-accent-orange">★ Featured</span> : 'No'}</Row>
        {product.seasons.length > 0 && (
          <Row label="Seasons">{product.seasons.map((s) => s.label).join(', ')}</Row>
        )}
        {(product.is_pack || product.is_sponsored) && (
          <Row label="Flags">
            {[product.is_pack && 'Pack', product.is_sponsored && 'Sponsored'].filter(Boolean).join(' · ')}
          </Row>
        )}
        <Row label="Submitted">{fmtDate(product.submitted_at)}</Row>
        <Row label="Created">{fmtDate(product.created_at)}</Row>
        <Row label="Last update">{fmtDate(product.updated_at)}</Row>
      </div>

      {showPerformance && product.performance && (
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">Performance</p>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<Eye size={14} />} label="Views" value={product.performance.views.toLocaleString()} />
            <Stat icon={<ShoppingBag size={14} />} label="Units sold" value={product.performance.units_sold.toLocaleString()} />
            <Stat
              icon={<Star size={14} />}
              label={`${product.performance.review_count} reviews`}
              value={product.performance.rating_avg !== null ? product.performance.rating_avg.toFixed(1) : '—'}
            />
          </div>
          {product.performance.revenue > 0 && (
            <p className="text-xs text-text-muted mt-3">Revenue: <span className="text-text-secondary">{formatDT(product.performance.revenue)}</span> · {product.performance.orders_count} orders</p>
          )}
        </div>
      )}

      <Checklist product={product} />
    </div>
  )
}

function Checklist({ product }: { product: ProductReview }) {
  const applicable = product.checks.filter((c) => !c.na)
  const passed     = applicable.filter((c) => c.ok).length

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Quality checks</p>
        <span className={clsx(
          'text-xs font-semibold tabular-nums',
          passed === applicable.length ? 'text-accent-green' : 'text-accent-orange'
        )}>
          {passed}/{applicable.length} passed
        </span>
      </div>
      <ul className="space-y-2">
        {product.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2.5">
            {c.na ? (
              <MinusCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
            ) : c.ok ? (
              <CheckCircle2 size={16} className="text-accent-green flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-accent-orange flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className={clsx('text-sm', c.na ? 'text-text-muted' : 'text-text-primary')}>{c.label}</p>
              <p className="text-xs text-text-muted break-words">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-text-muted mt-3">Informational only — the decision is yours.</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-text-muted flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-text-primary text-right min-w-0 break-words">{children}</span>
    </div>
  )
}

function Missing({ text = 'Missing' }: { text?: string }) {
  return <span className="text-text-muted italic">{text}</span>
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-bg-primary border border-border rounded-lg p-2.5">
      <span className="text-text-muted">{icon}</span>
      <p className="text-base font-semibold text-text-primary tabular-nums mt-1">{value}</p>
      <p className="text-[10px] text-text-muted">{label}</p>
    </div>
  )
}
