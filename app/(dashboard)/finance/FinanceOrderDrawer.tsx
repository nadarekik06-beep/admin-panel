// admin-panel/app/finance/FinanceOrderDrawer.tsx
// Side drawer for one row of Finance → Orders (one seller's part of an order).
// Data is fetched only when the drawer opens: GET /admin/finance/orders/{id}/details
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  X, Package, User, Store, AlertCircle, RefreshCw, ExternalLink, MapPin, Phone, Mail,
} from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/axios'
import { fmt, SHIPPING_PAYER, PayoutBadge } from './financeShared'
import BrandLoader from '@/components/brand/BrandLoader'

const RED   = '#db142e'
const GREEN = '#198f41'

const PAYMENT_METHODS: Record<string, { label: string; color: string }> = {
  cod:    { label: 'Cash on Delivery', color: GREEN },
  card:   { label: 'Stripe (card)',    color: '#7c3aed' },
  stripe: { label: 'Stripe (card)',    color: '#7c3aed' },
  d17:    { label: 'D17',              color: '#0284c7' },
  wallet: { label: 'Wallet',           color: '#6366f1' },
}

const STATUS_COLORS: Record<string, string> = {
  pending:          '#f59e0b',
  confirmed:        '#3b82f6',
  processing:       '#3b82f6',
  out_for_delivery: '#0284c7',
  completed:        GREEN,
  delivered:        GREEN,
  cancelled:        RED,
  refunded:         '#a78bfa',
}

interface DetailItem {
  id: number
  product_name: string | null
  variant_label: string | null
  variant_options: { name: string; value: string; color_hex?: string | null }[]
  image_url: string | null
  quantity: number
  unit_price: number
  line_total: number
  discount_amount: number
  paid_total: number
  product_deleted: boolean
  variant_deleted: boolean
}

interface Detail {
  id: number
  order_id: number
  order_number: string | null
  created_at: string
  status: string
  order_status: string | null
  payment_method: string | null
  payout_status: string
  coupon_code: string | null
  items_count: number
  seller:   { name: string | null; email: string | null; phone: string | null }
  customer: { name: string | null; email: string | null; phone: string | null; address: string | null; wilaya: string | null }
  items: DetailItem[]
  financials: {
    gross: number
    subtotal_before_coupon: number
    discount_amount: number
    commission_amount: number
    commission_rate: number | null
    delivery_fee: number
    shipping_cost: number
    seller_shipping_charge: number
    shipping_paid_by: string | null
    platform_profit: number
    seller_net_amount: number
  }
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#94a3b8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
      color: '#64748b', margin: '0 0 10px',
    }}>
      {children}
    </p>
  )
}

const card: React.CSSProperties = {
  background: '#161b27', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14, padding: 14,
}

function ContactCard({ icon: Icon, title, name, lines }: {
  icon: any; title: string; name: string | null
  lines: { icon: any; text: string | null }[]
}) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={13} color="#64748b" />
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>
          {title}
        </span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px', wordBreak: 'break-word' }}>
        {name ?? '—'}
      </p>
      {lines.filter(l => l.text).map((l, i) => {
        const LineIcon = l.icon
        return (
          <p key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#94a3b8', margin: '0 0 3px', wordBreak: 'break-word' }}>
            <LineIcon size={11} style={{ marginTop: 2, flexShrink: 0 }} color="#475569" />
            {l.text}
          </p>
        )
      })}
    </div>
  )
}

function ItemThumb({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={alt} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Package size={16} color="#4b5563" />}
    </div>
  )
}

function ItemRow({ item }: { item: DetailItem }) {
  const name       = item.product_name || 'Unnamed product'
  const discounted = item.discount_amount > 0
  const tag = (text: string, color: string) => (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
      background: `${color}18`, color, border: `1px solid ${color}30`, whiteSpace: 'nowrap',
    }}>{text}</span>
  )

  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <ItemThumb src={item.image_url} alt={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: 0, wordBreak: 'break-word' }}>{name}</p>
          {item.product_deleted && tag('Product deleted', '#94a3b8')}
          {item.variant_deleted && tag('Variant deleted', '#94a3b8')}
        </div>

        {item.variant_options.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {item.variant_options.map((o, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
              }}>
                {o.color_hex && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color_hex, border: '1px solid rgba(255,255,255,0.2)' }} />
                )}
                {o.name}: {o.value}
              </span>
            ))}
          </div>
        ) : item.variant_label ? (
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '0 0 6px' }}>{item.variant_label}</p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            {item.quantity} × {fmt(item.unit_price)}
          </span>
          <div style={{ textAlign: 'right' }}>
            {discounted && (
              <p style={{ fontSize: 10, color: '#64748b', margin: 0, textDecoration: 'line-through' }}>
                {fmt(item.line_total)}
              </p>
            )}
            <p style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>{fmt(item.paid_total)}</p>
            {discounted && (
              <p style={{ fontSize: 10, color: '#f59e0b', margin: 0, fontWeight: 700 }}>coupon −{fmt(item.discount_amount)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value, color = '#94a3b8', sub, strong }: {
  label: string; value: string; color?: string; sub?: string | null; strong?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: strong ? 800 : 600, color: strong ? '#f1f5f9' : '#94a3b8', margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      <p style={{ fontSize: strong ? 14 : 12, fontWeight: strong ? 900 : 700, color, margin: 0, whiteSpace: 'nowrap' }}>{value}</p>
    </div>
  )
}

function Skeleton() {
  return <BrandLoader variant="section" label="Loading order details…" minHeight={320} />
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

export default function FinanceOrderDrawer({ sellerOrderId, orderNumber, onClose }: {
  sellerOrderId: number
  orderNumber?: string
  onClose: () => void
}) {
  const [data,    setData]    = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/admin/finance/orders/${sellerOrderId}/details`, { signal })
      setData(res.data.data)
    } catch (e: any) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
      setError(e?.response?.status === 404
        ? 'This order no longer exists.'
        : (e?.response?.data?.message ?? 'Could not load order details.'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [sellerOrderId])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  // ESC closes; lock page scroll while open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const f     = data?.financials
  const payer = f ? (SHIPPING_PAYER[f.shipping_paid_by ?? 'customer'] ?? SHIPPING_PAYER.customer) : null
  const pm    = data?.payment_method ? (PAYMENT_METHODS[data.payment_method] ?? { label: data.payment_method.toUpperCase(), color: '#94a3b8' }) : null
  const shippingCollected = f ? Number(f.delivery_fee) + Number(f.seller_shipping_charge) : 0

  return (
    <>
      {/* Backdrop — click outside closes */}
      <div onClick={onClose} className="fin-drawer-backdrop" style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)', zIndex: 200,
      }} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${data?.order_number ?? orderNumber ?? ''} details`}
        className="fin-drawer"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
          width: '100%', maxWidth: 560,
          background: '#0f1623', borderLeft: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '-24px 0 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', margin: 0 }}>
              Seller order details
            </p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', margin: '2px 0 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {data?.order_number ?? orderNumber ?? '…'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? <Skeleton /> : error ? (
            <div style={{ ...card, textAlign: 'center', padding: '36px 20px' }}>
              <AlertCircle size={28} color={RED} style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>Couldn’t load details</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>{error}</p>
              <button onClick={() => load()} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}>
                <RefreshCw size={13} /> Try again
              </button>
            </div>
          ) : data && f && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Order header */}
              <div style={card}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div>
                    <SectionTitle>Date</SectionTitle>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                      {data.created_at ? format(new Date(data.created_at), 'MMM d, yyyy · HH:mm') : '—'}
                    </p>
                  </div>
                  <div>
                    <SectionTitle>Order status</SectionTitle>
                    <StatusChip status={data.status ?? data.order_status ?? 'pending'} />
                  </div>
                  <div>
                    <SectionTitle>Payment</SectionTitle>
                    {pm ? (
                      <span style={{ fontSize: 12, fontWeight: 800, color: pm.color }}>{pm.label}</span>
                    ) : <span style={{ color: '#475569' }}>—</span>}
                  </div>
                  <div>
                    <SectionTitle>Payout</SectionTitle>
                    <PayoutBadge status={data.payout_status} />
                  </div>
                </div>
              </div>

              {/* Seller & customer */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <ContactCard icon={Store} title="Seller" name={data.seller.name} lines={[
                  { icon: Mail,  text: data.seller.email },
                  { icon: Phone, text: data.seller.phone },
                ]} />
                <ContactCard icon={User} title="Customer" name={data.customer.name} lines={[
                  { icon: Phone,  text: data.customer.phone },
                  { icon: MapPin, text: [data.customer.address, data.customer.wilaya].filter(Boolean).join(', ') || null },
                ]} />
              </div>

              {/* Products */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <SectionTitle>Products · this seller</SectionTitle>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', marginBottom: 10 }}>
                    {data.items_count} {data.items_count === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {data.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                    <Package size={22} style={{ marginBottom: 6 }} />
                    <p style={{ fontSize: 12, margin: 0 }}>No products found for this seller order.</p>
                  </div>
                ) : data.items.map(item => <ItemRow key={item.id} item={item} />)}
              </div>

              {/* Financial breakdown — same frozen values as the table row */}
              <div style={card}>
                <SectionTitle>Financial breakdown</SectionTitle>
                <Line
                  label="Gross"
                  value={fmt(f.gross)}
                  sub={f.discount_amount > 0
                    ? `${fmt(f.subtotal_before_coupon)} before coupon${data.coupon_code ? ` ${data.coupon_code}` : ''} −${fmt(f.discount_amount)}`
                    : null}
                />
                <Line
                  label={`Commission${f.commission_rate != null ? ` (${Number(f.commission_rate).toFixed(2).replace(/\.?0+$/, '')}%)` : ''}`}
                  value={fmt(f.commission_amount)}
                  color={RED}
                />
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', margin: '4px 0' }} />
                <Line
                  label="Shipping"
                  value={Number(f.shipping_cost) > 0 ? `−${fmt(f.shipping_cost)} agency` : Number(f.delivery_fee) > 0 ? fmt(f.delivery_fee) : '—'}
                  color={Number(f.shipping_cost) > 0 ? '#ef4444' : '#3b82f6'}
                  sub={payer ? `Paid by: ${payer.label}${shippingCollected > 0 ? ` · collected +${fmt(shippingCollected)}` : ''}` : null}
                />
                {Number(f.delivery_fee) > 0 && (
                  <Line label="· Delivery fee from customer" value={`+${fmt(f.delivery_fee)}`} color="#3b82f6" />
                )}
                {Number(f.seller_shipping_charge) > 0 && (
                  <Line label="· Charged to seller (free shipping)" value={`+${fmt(f.seller_shipping_charge)}`} color="#f59e0b" />
                )}
                {Number(f.shipping_cost) > 0 && (
                  <Line label="· Paid to delivery agency" value={`−${fmt(f.shipping_cost)}`} color="#ef4444" />
                )}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 0' }} />
                <Line label="Platform result" value={fmt(f.platform_profit)} color={GREEN} strong />
                <Line
                  label="Seller net"
                  value={fmt(f.seller_net_amount)}
                  color="#a78bfa"
                  strong
                  sub={Number(f.seller_shipping_charge) > 0 ? `after −${fmt(f.seller_shipping_charge)} shipping` : null}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {data && !loading && !error && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Link href={`/orders?order=${data.order_id}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 0', borderRadius: 10, textDecoration: 'none',
              background: `linear-gradient(135deg, ${GREEN}, #146f33)`,
              color: '#fff', fontSize: 13, fontWeight: 800,
            }}>
              <ExternalLink size={14} /> Open full order in Orders
            </Link>
          </div>
        )}
      </aside>

      <style>{`
        .fin-drawer { animation: finDrawerIn .22s ease-out; }
        .fin-drawer-backdrop { animation: finFadeIn .18s ease-out; }
        @keyframes finDrawerIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes finFadeIn { from { opacity: 0 } to { opacity: 1 } }
        .fin-skel {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: finShimmer 1.2s linear infinite;
        }
        @keyframes finShimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
        @media (prefers-reduced-motion: reduce) {
          .fin-drawer, .fin-drawer-backdrop, .fin-skel { animation: none; }
        }
      `}</style>
    </>
  )
}
