'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Layers, ListChecks, FileText, Wallet, Truck, Store, History, ImageOff, ExternalLink,
  CheckCircle2, XCircle, MessageSquareWarning, Send, Star, EyeOff, RotateCcw, RefreshCw, Package,
} from 'lucide-react'
import clsx from 'clsx'
import Badge from '@/components/ui/Badge'
import type { ProductReview, ReviewHistoryEvent } from '@/types/productReview'
import { AVAILABILITY_META, planStyle, formatDT } from '../../reviewUtils'
import type { GalleryFilter } from './MediaGallery'

type TabKey = 'variants' | 'specs' | 'description' | 'pricing' | 'shipping' | 'seller' | 'history'

interface Props {
  product: ProductReview
  onShowVariantImages: (f: GalleryFilter) => void
}

export default function ReviewTabs({ product, onShowVariantImages }: Props) {
  const [tab, setTab] = useState<TabKey>('variants')

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'variants',    label: 'Variants',             icon: <Layers size={14} />,     count: product.variants.length },
    { key: 'specs',       label: 'Specifications',       icon: <ListChecks size={14} />, count: product.specifications.length },
    { key: 'description', label: 'Description',          icon: <FileText size={14} /> },
    { key: 'pricing',     label: 'Pricing & Commission', icon: <Wallet size={14} /> },
    { key: 'shipping',    label: 'Shipping',             icon: <Truck size={14} /> },
    { key: 'seller',      label: 'Seller',               icon: <Store size={14} /> },
    { key: 'history',     label: 'History',              icon: <History size={14} />,    count: product.history.length },
  ]

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div role="tablist" className="flex overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-accent-red text-text-primary font-medium'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary tabular-nums">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4" role="tabpanel">
        {tab === 'variants'    && <VariantsTab product={product} onShowImages={onShowVariantImages} />}
        {tab === 'specs'       && <SpecsTab product={product} />}
        {tab === 'description' && <DescriptionTab product={product} />}
        {tab === 'pricing'     && <PricingTab product={product} />}
        {tab === 'shipping'    && <ShippingTab product={product} />}
        {tab === 'seller'      && <SellerTab product={product} />}
        {tab === 'history'     && <HistoryTab product={product} />}
      </div>
    </div>
  )
}

// ── Variants ──────────────────────────────────────────────────────────────────

function VariantsTab({ product, onShowImages }: { product: ProductReview; onShowImages: (f: GalleryFilter) => void }) {
  const { variants } = product

  // One column per non-color attribute present across variants (size, material…)
  const attrCols = useMemo(() => {
    const seen = new Map<string, string>()
    variants.forEach((v) => v.options.forEach((o) => {
      if (o.attribute_slug && o.attribute_slug !== 'color' && !seen.has(o.attribute_slug)) {
        seen.set(o.attribute_slug, o.attribute ?? o.attribute_slug)
      }
    }))
    return Array.from(seen, ([slug, name]) => ({ slug, name }))
  }, [variants])
  const hasColor = variants.some((v) => v.options.some((o) => o.attribute_slug === 'color'))

  if (variants.length === 0) {
    return (
      <Empty icon={<Package size={22} />} title="No variants — simple product">
        Stock {product.inventory.total_stock} units · price {formatDT(product.pricing.base_price)}
        {product.sku && <> · SKU <span className="font-mono">{product.sku}</span></>}
      </Empty>
    )
  }

  const th = 'text-left text-[10px] font-bold uppercase tracking-widest text-text-muted px-3 py-2'
  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Image</th>
            {hasColor && <th className={th}>Color</th>}
            {attrCols.map((c) => <th key={c.slug} className={th}>{c.name}</th>)}
            <th className={th}>SKU</th>
            <th className={clsx(th, 'text-right')}>Price</th>
            <th className={clsx(th, 'text-right')}>Stock</th>
            <th className={th}>Availability</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => {
            const colors = v.options.filter((o) => o.attribute_slug === 'color')
            const avail  = AVAILABILITY_META[v.availability]
            return (
              <tr
                key={v.id}
                className={clsx(
                  'border-b border-border last:border-0 border-l-2',
                  v.availability === 'out_of_stock' ? 'bg-accent-red/[0.06] border-l-accent-red'
                    : v.availability === 'low_stock' ? 'bg-accent-orange/[0.06] border-l-accent-orange'
                    : v.availability === 'inactive' ? 'opacity-60 border-l-transparent'
                    : 'border-l-transparent'
                )}
              >
                <td className="px-3 py-2">
                  {v.image_urls[0] ? (
                    <button
                      onClick={() => { onShowImages({ kind: 'variant', id: v.id }); window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="relative w-10 h-10 rounded-md overflow-hidden border border-border hover:border-accent-purple block"
                      title="Show this variant's images in the gallery"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.image_urls[0]} alt="" className="w-full h-full object-cover" />
                      {v.image_urls.length > 1 && (
                        <span className="absolute bottom-0 right-0 text-[9px] bg-black/70 text-white px-1 rounded-tl">{v.image_urls.length}</span>
                      )}
                    </button>
                  ) : (
                    <span className="w-10 h-10 rounded-md border border-dashed border-accent-orange/50 flex items-center justify-center text-accent-orange" title="No images for this variant">
                      <ImageOff size={14} />
                    </span>
                  )}
                </td>
                {hasColor && (
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {colors.map((c) => (
                        <span
                          key={c.id}
                          className="w-4 h-4 rounded-full border border-white/25 flex-shrink-0"
                          style={{ background: c.color_hex ?? '#475569' }}
                          title={c.color_hex ?? 'No hex'}
                        />
                      ))}
                      <span className="text-text-primary">{colors.map((c) => c.value).join(' + ') || '—'}</span>
                    </span>
                  </td>
                )}
                {attrCols.map((c) => (
                  <td key={c.slug} className="px-3 py-2 text-text-primary">
                    {v.options.filter((o) => o.attribute_slug === c.slug).map((o) => o.value).join(', ') || '—'}
                  </td>
                ))}
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">{v.sku || <span className="text-text-muted italic font-sans">none</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className={v.price_override !== null ? 'text-accent-purple-light font-medium' : 'text-text-primary'}>
                    {formatDT(v.price)}
                  </span>
                  {v.price_override !== null && <p className="text-[10px] text-text-muted">override</p>}
                </td>
                <td className={clsx(
                  'px-3 py-2 text-right tabular-nums font-medium',
                  v.availability === 'out_of_stock' ? 'text-accent-red' : v.availability === 'low_stock' ? 'text-accent-orange' : 'text-text-primary'
                )}>
                  {v.stock}
                </td>
                <td className="px-3 py-2"><Badge variant={avail.badge}>{avail.label}</Badge></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Specifications ────────────────────────────────────────────────────────────

function SpecsTab({ product }: { product: ProductReview }) {
  const specs = product.specifications
  if (specs.length === 0) {
    return <Empty icon={<ListChecks size={22} />} title="No specifications">The seller didn't fill any additional attributes.</Empty>
  }
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
      {specs.map((s) => (
        <div key={s.slug} className="flex justify-between gap-4 py-2.5 border-b border-border">
          <dt className="text-sm text-text-muted">{s.name}</dt>
          <dd className="text-sm text-text-primary text-right inline-flex items-center gap-1.5 justify-end flex-wrap">
            {s.color_hexes.map((h) => (
              <span key={h} className="w-3.5 h-3.5 rounded-full border border-white/25" style={{ background: h }} />
            ))}
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ── Description ───────────────────────────────────────────────────────────────

function DescriptionTab({ product }: { product: ProductReview }) {
  const len = (product.description ?? '').trim().length
  if (!product.description && !product.short_description) {
    return <Empty icon={<FileText size={22} />} title="No description">The seller didn't write a description.</Empty>
  }
  return (
    <div className="space-y-4">
      {product.short_description && (
        <div className="p-3 rounded-lg bg-bg-primary border border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Short description</p>
          <p className="text-sm text-text-primary">{product.short_description}</p>
        </div>
      )}
      {product.description ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
            Full description <span className="normal-case font-normal">· {len} characters</span>
          </p>
          {/* Plain text, same as the storefront renders it */}
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line max-w-3xl">{product.description}</p>
        </div>
      ) : (
        <p className="text-sm text-text-muted italic">No full description.</p>
      )}
    </div>
  )
}

// ── Pricing & Commission ──────────────────────────────────────────────────────

function PricingTab({ product }: { product: ProductReview }) {
  const { pricing } = product
  const c = pricing.commission
  const plan = planStyle(c.plan, c.plan_name)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Prices">
        <KV label="Base price" value={formatDT(pricing.base_price)} />
        {pricing.min_price !== pricing.max_price && (
          <KV label="Variant price range" value={`${formatDT(pricing.min_price)} – ${formatDT(pricing.max_price)}`} />
        )}
        <KV label="Active discount" value={pricing.discount_amount > 0 ? `− ${formatDT(pricing.discount_amount)}` : 'None'} />
        <KV label="Customer pays (base)" value={formatDT(pricing.effective_price)} strong />
        <KV label="Delivery fee" value={pricing.delivery.is_free ? 'Free' : formatDT(pricing.delivery.fee)} />
      </Section>

      <Section title={<>Commission <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: plan.color, background: plan.bg, border: `1px solid ${plan.border}` }}>{c.plan_name}</span></>}>
        <KV label={`Tier rate (on ${formatDT(c.on_price)})`} value={`${c.base_rate}%`} />
        <KV label="Plan reduction" value={c.plan_reduction > 0 ? `− ${c.plan_reduction} pts` : '—'} />
        <KV label="Rate applied" value={`${c.rate}%`} />
        <KV label="Platform commission" value={formatDT(c.commission_amount)} />
        <KV label="Estimated seller payout" value={formatDT(c.seller_payout)} strong accent />
        {c.payout_range && (
          <KV label="Payout across variants" value={`${formatDT(c.payout_range.min)} – ${formatDT(c.payout_range.max)}`} />
        )}
        <p className="text-[10px] text-text-muted pt-2">Per unit, before coupons. Calculated with the same rules as checkout.</p>
      </Section>

      <Section title="Promotions" className="lg:col-span-2">
        {pricing.promotions.length === 0 ? (
          <p className="text-sm text-text-muted">No active or scheduled promotions.</p>
        ) : (
          <div className="space-y-2">
            {pricing.promotions.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-bg-primary border border-border">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    {p.name}
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-text-muted">{p.type.replace('_', ' ')}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {p.starts_at && format(new Date(p.starts_at), 'MMM d, HH:mm')} → {p.ends_at && format(new Date(p.ends_at), 'MMM d, HH:mm')}
                    {p.flash_stock_remaining !== null && ` · ${p.flash_stock_remaining} flash units left`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-accent-red">
                    {p.discount_type === 'percentage' ? `${p.discount_value}% off` : `${formatDT(p.discount_value)} off`}
                  </span>
                  <Badge variant={p.is_active_now ? 'active' : 'info'}>{p.is_active_now ? 'live' : p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        {pricing.coupons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pricing.coupons.map((cp) => (
              <span key={cp.id} className="text-xs font-mono px-2 py-1 rounded-md border border-dashed border-accent-green/40 text-accent-green">
                {cp.code} · {cp.label}{cp.min_order_amount ? ` · min ${formatDT(cp.min_order_amount)}` : ''}
              </span>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Shipping ──────────────────────────────────────────────────────────────────

function ShippingTab({ product }: { product: ProductReview }) {
  const s = product.shipping
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Delivery">
        <KV
          label="Delivery fee"
          value={s.is_free_delivery ? 'Free (seller-funded)' : formatDT(s.delivery_fee)}
          strong
        />
        <KV label="Source" value={s.uses_platform_default ? 'Platform default' : 'Set by seller'} />
      </Section>
      <Section title="Package details">
        {s.fields.length === 0 ? (
          <p className="text-sm text-text-muted">Weight and dimensions weren't provided for this product.</p>
        ) : (
          s.fields.map((f) => <KV key={f.label} label={f.label} value={f.value} />)
        )}
      </Section>
    </div>
  )
}

// ── Seller ────────────────────────────────────────────────────────────────────

function SellerTab({ product }: { product: ProductReview }) {
  const s = product.seller
  if (!s) {
    return (
      <Empty icon={<Store size={22} />} title={product.is_platform_product ? 'Platform product' : 'No seller'}>
        This product isn't attached to a seller account.
      </Empty>
    )
  }
  const plan = planStyle(s.plan, s.plan_name, s.plan_color)
  const age = s.account_age_days
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-bg-primary border border-border">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-bg-hover flex items-center justify-center text-lg font-bold text-text-secondary flex-shrink-0">
          {s.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={s.avatar} alt="" className="w-full h-full object-cover" />
            : s.store_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-text-primary">{s.store_name}</p>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ color: plan.color, background: plan.bg, border: `1px solid ${plan.border}` }}>
              🌶 {s.plan_name}
            </span>
            <Badge variant={!s.is_active ? 'banned' : s.is_approved ? 'approved' : 'pending'}>
              {!s.is_active ? 'Inactive' : s.is_approved ? 'Verified seller' : 'Not approved'}
            </Badge>
            {s.subscription_status && s.subscription_status !== 'active' && (
              <Badge variant="warning">Subscription: {s.subscription_status.replace('_', ' ')}</Badge>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">
            {s.name} · {s.email}{s.location && ` · ${s.location}`}
          </p>
          <p className="text-xs text-text-muted">
            Seller #{s.id} · joined {s.joined_at ? format(new Date(s.joined_at), 'MMM d, yyyy') : '—'}
            {age !== null && ` (${age < 30 ? `${age} days` : age < 365 ? `${Math.floor(age / 30)} months` : `${(age / 365).toFixed(1)} years`} ago)`}
            {age !== null && age < 14 && <span className="ml-1 text-accent-orange">· new account</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/sellers?view=${s.id}`} className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
            Seller profile
          </Link>
          <a href={s.storefront_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors inline-flex items-center gap-1">
            Storefront <ExternalLink size={11} />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniStat label="Products" value={s.stats.total_products} />
        <MiniStat label="Approved" value={s.stats.approved_products} tone="green" />
        <MiniStat label="Pending"  value={s.stats.pending_products}  tone="orange" />
        <MiniStat label="Rejected" value={s.stats.rejected_products} tone={s.stats.rejected_products > 0 ? 'red' : undefined} />
        <MiniStat label="Rating"   value={s.stats.rating_avg !== null ? `${s.stats.rating_avg.toFixed(1)} ★` : '—'} />
        <MiniStat label="Reviews"  value={s.stats.review_count} />
      </div>
    </div>
  )
}

// ── History ───────────────────────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  submitted:         { label: 'Submitted for review',  icon: <Send size={13} />,                 color: 'text-accent-purple-light bg-accent-purple/15' },
  resubmitted:       { label: 'Resubmitted by seller', icon: <RefreshCw size={13} />,            color: 'text-accent-purple-light bg-accent-purple/15' },
  approved:          { label: 'Approved',              icon: <CheckCircle2 size={13} />,         color: 'text-accent-green bg-accent-green/15' },
  rejected:          { label: 'Rejected',              icon: <XCircle size={13} />,              color: 'text-accent-red bg-accent-red/15' },
  changes_requested: { label: 'Changes requested',     icon: <MessageSquareWarning size={13} />, color: 'text-accent-cyan bg-accent-cyan/15' },
  featured:          { label: 'Marked as featured',    icon: <Star size={13} />,                 color: 'text-accent-orange bg-accent-orange/15' },
  unfeatured:        { label: 'Removed from featured', icon: <Star size={13} />,                 color: 'text-text-muted bg-bg-hover' },
  disabled:          { label: 'Disabled',              icon: <EyeOff size={13} />,               color: 'text-text-muted bg-bg-hover' },
  restored:          { label: 'Restored to pending',   icon: <RotateCcw size={13} />,            color: 'text-accent-green bg-accent-green/15' },
}

function HistoryTab({ product }: { product: ProductReview }) {
  return (
    <ol className="relative space-y-5 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-border">
      {product.history.map((e: ReviewHistoryEvent, i) => {
        const meta = EVENT_META[e.action] ?? { label: e.action, icon: <History size={13} />, color: 'text-text-muted bg-bg-hover' }
        return (
          <li key={e.id ?? `s-${i}`} className="relative flex gap-3">
            <span className={clsx('relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-bg-card', meta.color)}>
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-text-primary">
                <span className="font-medium">{meta.label}</span>
                {e.actor.name && (
                  <span className="text-text-muted"> by {e.actor.name}{e.actor.role === 'admin' ? ' (admin)' : ''}</span>
                )}
              </p>
              <p className="text-xs text-text-muted" title={e.created_at ?? undefined}>
                {e.created_at ? `${format(new Date(e.created_at), 'MMM d, yyyy · HH:mm')} · ${formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}` : '—'}
                {e.synthetic && ' · from creation date'}
              </p>
              {e.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {e.reasons.map((r) => (
                    <span key={r} className="text-[11px] px-2 py-0.5 rounded-md bg-bg-primary border border-border text-text-secondary">{r}</span>
                  ))}
                </div>
              )}
              {e.note && (
                <p className="mt-1.5 text-sm text-text-secondary bg-bg-primary border border-border rounded-lg px-3 py-2 whitespace-pre-line">{e.note}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function Section({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('p-4 rounded-xl bg-bg-primary border border-border', className)}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2 flex items-center">{title}</p>
      {children}
    </div>
  )
}

function KV({ label, value, strong, accent }: { label: string; value: React.ReactNode; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-sm text-text-muted">{label}</span>
      <span className={clsx('text-sm tabular-nums text-right', strong ? 'font-semibold' : '', accent ? 'text-accent-green' : 'text-text-primary')}>{value}</span>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'green' | 'orange' | 'red' }) {
  return (
    <div className="p-3 rounded-lg bg-bg-primary border border-border">
      <p className={clsx(
        'text-lg font-semibold tabular-nums',
        tone === 'green' ? 'text-accent-green' : tone === 'orange' ? 'text-accent-orange' : tone === 'red' ? 'text-accent-red' : 'text-text-primary'
      )}>{value}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
    </div>
  )
}

function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <span className="w-11 h-11 rounded-full bg-bg-hover flex items-center justify-center text-text-muted">{icon}</span>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {children && <p className="text-xs text-text-muted max-w-sm">{children}</p>}
    </div>
  )
}
