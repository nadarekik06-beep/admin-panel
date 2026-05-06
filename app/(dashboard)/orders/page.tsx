'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Search, Eye, Loader2, ShoppingBag, MapPin, Phone,
  Package, User, CheckCircle,
  X, ChevronDown, Store, Tag, TrendingDown, TrendingUp,
} from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import { ordersApi } from '@/lib/api/orders'
import type { Order, OrderItem, PaginatedResponse, OrderStatus } from '@/types'
import { format } from 'date-fns'

function formatCurrency(v: number | string) {
  return `${Number(v).toFixed(3)} DT`
}

interface OrderDetail extends Order {
  items?: (OrderItem & {
    is_platform_item?:       boolean
    variant_options?:        Record<string, { value: string; color_hex?: string | null }>
    resolved_image_url?:     string | null
    commission_percentage?:  number | null
    commission_amount?:      number | null
    seller_amount?:          number | null
    plan_used?:              string | null
  })[]
  user?: { id: number; name: string; email: string }
  has_platform_items?: boolean
  sellerOrders?: Array<{
    id: number
    seller_id: number
    status: string
    payment_status: string
    subtotal: number
    seller?: { id: number; name: string; email: string }
  }>
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:    '#f59e0b',
  processing: '#3b82f6',
  completed:  '#10b981',
  delivered:  '#14b8a6',
  cancelled:  '#ef4444',
  refunded:   '#a855f7',
}

const PLAN_COLORS: Record<string, string> = {
  free:  '#198f41',
  red:   '#db142e',
  black: '#f59e0b',
}

function StatusChip({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#94a3b8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      textTransform: 'capitalize',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status}
    </span>
  )
}

const PAYMENT_METHOD_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  cod:    { label: 'Cash on Delivery', icon: '🚚', color: '#198f41' },
  card:   { label: 'Bank Card',        icon: '💳', color: '#7c3aed' },
  d17:    { label: 'D17',              icon: '📱', color: '#0284c7' },
  wallet: { label: 'Wallet',           icon: '💰', color: '#6366f1' },
}

function PaymentMethodBadge({ method }: { method?: string }) {
  const cfg = PAYMENT_METHOD_CONFIG[method ?? 'cod'] ?? PAYMENT_METHOD_CONFIG['cod']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
      background: `${cfg.color}12`, color: cfg.color,
      border: `1px solid ${cfg.color}25`, whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {(method ?? 'cod').toUpperCase()}
    </span>
  )
}

function PlatformBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
      background: 'rgba(219,20,46,0.12)', color: '#db142e',
      border: '1px solid rgba(219,20,46,0.25)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      <Store size={8} /> Platform
    </span>
  )
}

// ── Order item row with commission breakdown ────────────────────────────────────

function OrderItemRow({ item }: { item: any }) {
  const options         = Object.entries(item.variant_options ?? {})
  const imageUrl        = item.resolved_image_url ?? null
  const hasCommission   = Number(item.commission_amount) > 0
  const commissionPct   = Number(item.commission_percentage ?? 0)
  const commissionAmt   = Number(item.commission_amount ?? 0)
  const sellerAmt       = Number(item.seller_amount ?? 0)
  const planUsed        = item.plan_used as string | null
  const planColor       = PLAN_COLORS[planUsed ?? 'free'] ?? '#94a3b8'

  return (
    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Image */}
      <td style={{ padding: '10px 12px', width: 52 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {imageUrl ? <img src={imageUrl} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={14} color="#4b5563" />}
        </div>
      </td>

      {/* Product + commission line */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{item.product_name}</p>
          {item.is_platform_item && <PlatformBadge />}
        </div>
        {options.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {options.map(([slug, opt]: any) => (
              <span key={slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', textTransform: 'capitalize' }}>
                {opt.color_hex && <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.color_hex, border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0 }} />}
                {slug}: {opt.value}
              </span>
            ))}
          </div>
        )}
        {item.variant_label && options.length === 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block', marginBottom: 4 }}>{item.variant_label}</span>
        )}
        {/* ── Commission line ── */}
        {hasCommission && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
              background: 'rgba(219,20,46,0.12)', color: '#db142e',
              border: '1px solid rgba(219,20,46,0.2)',
            }}>
              Fee {commissionPct}% → {commissionAmt.toFixed(3)} DT
            </span>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
              background: 'rgba(16,185,129,0.1)', color: '#10b981',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              Seller {sellerAmt.toFixed(3)} DT
            </span>
            {planUsed && planUsed !== 'free' && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                background: `${planColor}12`, color: planColor,
                border: `1px solid ${planColor}25`,
                textTransform: 'capitalize',
              }}>
                {planUsed}
              </span>
            )}
          </div>
        )}
      </td>

      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', fontSize: 12 }}>{item.quantity}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', fontSize: 12 }}>{formatCurrency(item.unit_price)}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#a78bfa', fontSize: 13 }}>{formatCurrency(item.total)}</td>
    </tr>
  )
}

// ─── Commission Summary Card ────────────────────────────────────────────────────

function CommissionSummary({ items, grossTotal }: { items: any[]; grossTotal: number }) {
  const totalCommission = items.reduce((s, i) => s + Number(i.commission_amount ?? 0), 0)
  const totalSeller     = items.reduce((s, i) => s + Number(i.seller_amount ?? 0), 0)
  const hasData         = totalCommission > 0 || totalSeller > 0

  if (!hasData) return null

  const commissionPct = grossTotal > 0 ? ((totalCommission / grossTotal) * 100).toFixed(1) : '0'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(219,20,46,0.12)', border: '1px solid rgba(219,20,46,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingDown size={13} color="#db142e" />
        </div>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
          Revenue Split
        </p>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
          background: 'rgba(219,20,46,0.1)', color: '#db142e',
          border: '1px solid rgba(219,20,46,0.2)',
        }}>
          ADMIN EARNS {commissionPct}%
        </span>
      </div>

      {/* Three columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>

        {/* Gross */}
        <div style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
            Gross Total
          </p>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#94a3b8', margin: 0, letterSpacing: '-0.01em' }}>
            {formatCurrency(grossTotal)}
          </p>
          <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>Customer paid</p>
        </div>

        {/* Platform commission */}
        <div style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(219,20,46,0.03)' }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#db142e', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
            Platform Fee
          </p>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#db142e', margin: 0, letterSpacing: '-0.01em' }}>
            {formatCurrency(totalCommission)}
          </p>
          <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>Admin income ✓</p>
        </div>

        {/* Seller payout */}
        <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.03)' }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
            Seller Gets
          </p>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#10b981', margin: 0, letterSpacing: '-0.01em' }}>
            {formatCurrency(totalSeller)}
          </p>
          <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>Paid to sellers</p>
        </div>
      </div>
    </div>
  )
}

// ─── Order Detail Drawer ──────────────────────────────────────────────────────

function OrderDetailDrawer({ orderId, open, onClose, onUpdated }: {
  orderId: number | null; open: boolean; onClose: () => void; onUpdated: () => void
}) {
  const [detail,       setDetail]       = useState<OrderDetail | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [newStatus,    setNewStatus]    = useState('')
  const [updating,     setUpdating]     = useState(false)
  const [newPayStatus, setNewPayStatus] = useState('')
  const [payUpdating,  setPayUpdating]  = useState(false)

  const loadDetail = useCallback(() => {
    if (!orderId || !open) return
    setLoading(true)
    setError(''); setSuccess(''); setNewStatus(''); setNewPayStatus('')
    ordersApi.get(orderId)
      .then(res => setDetail(res as OrderDetail))
      .catch(() => setError('Failed to load order details.'))
      .finally(() => setLoading(false))
  }, [orderId, open])

  useEffect(() => { loadDetail() }, [loadDetail])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleStatusUpdate = async () => {
    if (!newStatus || !detail) return
    setUpdating(true); setError('')
    try {
      await ordersApi.updateStatus(detail.id, newStatus)
      setSuccess(`Order status updated to "${newStatus}".`)
      setDetail(prev => prev ? { ...prev, status: newStatus as any } : prev)
      setNewStatus('')
      onUpdated()
    } catch { setError('Failed to update order status.') }
    finally { setUpdating(false) }
  }

  const handlePaymentStatusUpdate = async () => {
    if (!newPayStatus || !detail) return
    setPayUpdating(true); setError('')
    try {
      await ordersApi.updatePaymentStatus(detail.id, newPayStatus as any)
      setSuccess(`Payment status updated to "${newPayStatus}".`)
      setDetail(prev => prev ? { ...prev, payment_status: newPayStatus as any } : prev)
      setNewPayStatus('')
      onUpdated()
    } catch { setError('Failed to update payment status.') }
    finally { setPayUpdating(false) }
  }

  if (!open) return null

  const statusColor = STATUS_COLORS[detail?.status ?? ''] ?? '#94a3b8'
  const items       = detail?.items ?? []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 680, background: '#0f1623', borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 64px rgba(0,0,0,0.5)', animation: 'slideIn 0.25s cubic-bezier(0.32,0.72,0,1)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f1623' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={15} color="#3b82f6" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>Order Details</p>
                {detail?.has_platform_items && <PlatformBadge />}
              </div>
              {detail && <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontFamily: 'monospace', fontWeight: 700 }}>{detail.order_number ?? `#${detail.id}`}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
              <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: '#3b82f6' }} />
              <p style={{ color: '#64748b', fontSize: 13, fontWeight: 600, margin: 0 }}>Loading order…</p>
            </div>
          ) : error && !detail ? (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 16px', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</div>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Feedback */}
              {success && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px', color: '#10b981', fontSize: 13, fontWeight: 700 }}>
                  <CheckCircle size={14} /> {success}
                </div>
              )}
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</div>
              )}

              {/* Status strip */}
              <div style={{ background: `${statusColor}0d`, border: `1px solid ${statusColor}25`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusChip status={detail.status} />
                  <Badge variant={detail.payment_status as OrderStatus}>{detail.payment_status}</Badge>
                  <PaymentMethodBadge method={(detail as any).payment_method} />
                </div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  {format(new Date(detail.created_at), 'MMM d, yyyy · HH:mm')}
                </span>
              </div>

              {/* Customer info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { icon: User,        label: 'Customer', value: detail.user?.name ?? `User #${(detail as any).user_id}`, sub: detail.user?.email },
                  { icon: MapPin,      label: 'Wilaya',   value: (detail as any).wilaya ?? '—' },
                  { icon: Phone,       label: 'Phone',    value: (detail as any).phone  ?? '—' },
                  { icon: ShoppingBag, label: 'Total',    value: formatCurrency(detail.total_amount) },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 6 }}>
                      <Icon size={9} />{label}
                    </div>
                    <p style={{ fontWeight: 800, color: '#f1f5f9', fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
                    {sub && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>}
                  </div>
                ))}
              </div>

              {/* Sub-orders */}
              {(detail.sellerOrders ?? []).length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>Seller Sub-orders</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(detail.sellerOrders ?? []).map(so => {
                      const isPlatform = so.seller?.name === "CHOOSE'Tounsi"
                      return (
                        <div key={so.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isPlatform ? <PlatformBadge /> : (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
                                {so.seller?.name ?? `Seller #${so.seller_id}`}
                              </span>
                            )}
                            <StatusChip status={so.status} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>{formatCurrency(so.subtotal)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Items table */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Package size={14} color="#a78bfa" />
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Order Items</h3>
                  <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>({items.length} item{items.length !== 1 ? 's' : ''})</span>
                </div>
                <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {['Image', 'Product', 'Qty', 'Unit', 'Total'].map((h, i) => (
                          <th key={h} style={{ padding: '9px 12px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', textAlign: i > 1 ? 'right' : 'left', width: i === 0 ? 52 : undefined }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => <OrderItemRow key={item.id} item={item} />)}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                        <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#94a3b8', fontSize: 12 }}>Gross Total</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#94a3b8', fontSize: 14 }}>{formatCurrency(detail.total_amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* ── Commission Revenue Split ── */}
              <CommissionSummary items={items} grossTotal={Number(detail.total_amount)} />

              {/* ── Update Order Status ── */}
              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: 18 }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#818cf8', margin: '0 0 12px' }}>Update Order Status</p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <select value={newStatus} onChange={e => { setNewStatus(e.target.value); setSuccess('') }}
                      style={{ width: '100%', appearance: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 36px 10px 14px', fontSize: 13, fontWeight: 600, color: newStatus ? '#f1f5f9' : '#64748b', cursor: 'pointer', outline: 'none' }}>
                      <option value="" style={{ background: '#0f1623', color: '#64748b' }}>— Select new status —</option>
                      {['pending', 'processing', 'completed', 'delivered', 'cancelled', 'refunded'].map(s => (
                        <option key={s} value={s} style={{ background: '#0f1623', color: '#f1f5f9' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                  <button onClick={handleStatusUpdate} disabled={!newStatus || updating}
                    style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: (!newStatus || updating) ? 'not-allowed' : 'pointer', opacity: (!newStatus || updating) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    {updating && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                    Update
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#475569', margin: '10px 0 0', fontWeight: 500 }}>
                  Current: <span style={{ color: STATUS_COLORS[detail.status] ?? '#94a3b8', fontWeight: 700 }}>{detail.status}</span>
                </p>
              </div>

              {/* ── Update Payment Status ── */}
              <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: 18 }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#34d399', margin: '0 0 12px' }}>Update Payment Status</p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <select value={newPayStatus} onChange={e => { setNewPayStatus(e.target.value); setSuccess('') }}
                      style={{ width: '100%', appearance: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 36px 10px 14px', fontSize: 13, fontWeight: 600, color: newPayStatus ? '#f1f5f9' : '#64748b', cursor: 'pointer', outline: 'none' }}>
                      <option value="" style={{ background: '#0f1623', color: '#64748b' }}>— Select payment status —</option>
                      {['unpaid', 'paid', 'refunded'].map(s => (
                        <option key={s} value={s} style={{ background: '#0f1623', color: '#f1f5f9' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                  <button onClick={handlePaymentStatusUpdate} disabled={!newPayStatus || payUpdating}
                    style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: (!newPayStatus || payUpdating) ? 'not-allowed' : 'pointer', opacity: (!newPayStatus || payUpdating) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    {payUpdating && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                    Update
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#475569', margin: '10px 0 0', fontWeight: 500 }}>
                  Current: <span style={{ color: detail.payment_status === 'paid' ? '#10b981' : detail.payment_status === 'refunded' ? '#a855f7' : '#f59e0b', fontWeight: 700 }}>{detail.payment_status}</span>
                  <span style={{ marginLeft: 8, color: '#475569' }}>· Cascades to all seller sub-orders</span>
                </p>
              </div>

              <div style={{ height: 8 }} />
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
        @keyframes spin    { to   { transform:rotate(360deg) } }
      `}</style>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

type SellerTypeFilter = 'all' | 'platform' | 'sellers'

const SELLER_TYPE_TABS: { value: SellerTypeFilter; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'all',      label: 'All Orders',    icon: ShoppingBag, color: '#3b82f6' },
  { value: 'platform', label: "CHOOSE'Tounsi", icon: Store,       color: '#db142e' },
  { value: 'sellers',  label: 'Seller Orders', icon: Tag,         color: '#6366f1' },
]

export default function OrdersPage() {
  const [orders,     setOrders]     = useState<PaginatedResponse<Order> | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [status,     setStatus]     = useState('')
  const [payMethod,  setPayMethod]  = useState('')
  const [sellerType, setSellerType] = useState<SellerTypeFilter>('all')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [page,       setPage]       = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ordersApi.list({
        search:         search      || undefined,
        status:         status      || undefined,
        payment_method: payMethod   || undefined,
        seller_type:    sellerType !== 'all' ? sellerType : undefined,
        date_from:      dateFrom    || undefined,
        date_to:        dateTo      || undefined,
        page,
      })
      setOrders(res)
    } finally {
      setLoading(false)
    }
  }, [search, status, payMethod, sellerType, dateFrom, dateTo, page])

  useEffect(() => {
    const t = setTimeout(fetchOrders, 300)
    return () => clearTimeout(t)
  }, [fetchOrders])

  const openDetail = (id: number) => { setSelectedId(id); setDetailOpen(true) }

  const columns: Column<Order>[] = [
    {
      key: 'order_number', header: 'Order',
      render: row => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="font-mono text-xs font-bold text-text-primary bg-bg-hover px-2 py-0.5 rounded">{row.order_number}</span>
          {(row as any).has_platform_items && <PlatformBadge />}
        </div>
      ),
    },
    {
      key: 'user', header: 'Customer',
      render: row => (
        <div>
          <p className="font-semibold text-text-primary text-sm">{(row as any).user?.name ?? `User #${(row as any).user_id}`}</p>
          <p className="text-xs text-text-muted">{(row as any).user?.email ?? ''}</p>
        </div>
      ),
    },
    { key: 'wilaya',  header: 'Wilaya',  render: row => <span className="text-text-muted text-sm">{(row as any).wilaya ?? '—'}</span> },
    { key: 'status',  header: 'Status',  render: row => <StatusChip status={row.status} /> },
    { key: 'payment_status', header: 'Payment', render: row => <Badge variant={row.payment_status as OrderStatus}>{row.payment_status}</Badge> },
    { key: 'payment_method' as any, header: 'Method', render: row => <PaymentMethodBadge method={(row as any).payment_method} /> },
    { key: 'total_amount', header: 'Total', render: row => <span className="font-bold text-text-primary">{formatCurrency(row.total_amount)}</span> },
    { key: 'created_at', header: 'Date', render: row => <span className="text-text-muted text-xs">{format(new Date(row.created_at), 'MMM d, yyyy')}</span> },
    {
      key: 'actions', header: '',
      render: row => (
        <button onClick={() => openDetail(row.id)} className="p-1.5 rounded-md text-text-muted hover:text-accent-purple hover:bg-accent-purple/10 transition-colors" title="View details">
          <Eye size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">

      {/* Seller Type Tabs */}
      <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {SELLER_TYPE_TABS.map(tab => {
          const Icon = tab.icon
          const isActive = sellerType === tab.value
          return (
            <button key={tab.value} onClick={() => { setSellerType(tab.value); setPage(1) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', background: isActive ? tab.color : 'transparent', color: isActive ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: isActive ? 800 : 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
              <Icon size={13} />{tab.label}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="Search by order number or customer..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
            <option value="">All Status</option>
            {['pending', 'processing', 'completed', 'delivered', 'cancelled', 'refunded'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select value={payMethod} onChange={e => { setPayMethod(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
            <option value="">All Methods</option>
            <option value="cod">🚚 Cash on Delivery</option>
            <option value="wallet">💰 Wallet</option>
            <option value="d17">📱 D17</option>
            <option value="card">💳 Bank Card</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">
            {sellerType === 'platform' ? "CHOOSE'Tounsi Orders" : sellerType === 'sellers' ? 'Seller Orders' : 'All Orders'}
            {orders && <span className="ml-2 text-xs font-normal text-text-muted">({orders.total} total)</span>}
          </h2>
          {sellerType === 'platform' && (
            <span style={{ fontSize: 11, color: '#db142e', fontWeight: 700, background: 'rgba(219,20,46,0.08)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(219,20,46,0.2)' }}>
              🏪 Platform brand products only
            </span>
          )}
        </div>
        <DataTable columns={columns} data={orders?.data ?? []} loading={loading} emptyMessage="No orders found." keyField="id" />
        {orders && orders.last_page > 1 && (
          <Pagination currentPage={orders.current_page} lastPage={orders.last_page} total={orders.total} from={orders.from} to={orders.to} onPageChange={setPage} />
        )}
      </div>

      <OrderDetailDrawer orderId={selectedId} open={detailOpen} onClose={() => setDetailOpen(false)} onUpdated={fetchOrders} />
    </div>
  )
}