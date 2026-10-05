'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Search, Eye, ShoppingBag, MapPin, Phone,
  Package, User, CheckCircle, X, ChevronDown,
  Store, Tag, TrendingDown, PhoneCall, MessageSquare,
  CheckCheck, XCircle, Save, FileDown, AlertTriangle,
} from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import { ordersApi } from '@/lib/api/orders'
import type { Order, OrderItem, PaginatedResponse, OrderStatus } from '@/types'
import { format } from 'date-fns'
import {
  ShippingAddressCard, PickupBlock, ExportMenu, ExportedBadge, Toast, useToast,
  EXPORT_TYPE_LABEL,
  type ShippingAddress, type SellerPickup, type SlipMoney, type ExportReadiness, type ExportHistoryEntry,
} from './_components/delivery'

import BrandLoader from '@/components/brand/BrandLoader'
function formatCurrency(v: number | string) {
  return `${Number(v).toFixed(3)} DT`
}

interface OrderDetail extends Order {
  items?: (OrderItem & {
    is_platform_item?:      boolean
    variant_options?:       Record<string, { value: string; color_hex?: string | null }>
    resolved_image_url?:    string | null
    commission_percentage?: number | null
    commission_amount?:     number | null
    seller_amount?:         number | null
    plan_used?:             string | null
    discount_amount?:       number | null   // share of the seller coupon
    net_total?:             number | null   // total − discount (commission base)
    item_status?: 'returned' | 'exchanged' | null
    is_returned?: boolean
  })[]
  subtotal?:        number        // items before coupon
  discount_amount?: number        // seller coupons, 0 when none
  coupon_codes?:    string[]
  shipping_fee?:    number
  user?: { id: number; name: string; email: string }
  has_platform_items?: boolean
  admin_note?: string | null
  confirmed_at?: string | null
  sellerOrders?: SellerSubOrder[]
  seller_orders?: SellerSubOrder[]   // Laravel serializes the relation in snake_case
  commission_summary?: CommissionSummaryData | null
  // Delivery documents (see _components/delivery.tsx)
  shipping_address?:   ShippingAddress | null
  export_readiness?:   ExportReadiness | null
  export_history?:     ExportHistoryEntry[]
  slips_exported_at?:  string | null
}

interface SellerSubOrder {
  id: number
  seller_id: number
  status: string
  payment_status: string
  subtotal: number
  coupon_code?: string | null
  discount_amount?: number
  seller?: { id: number; name: string; email: string }
  pickup?:       SellerPickup
  reference?:    string
  is_shippable?: boolean
  slip_money?:   SlipMoney | null
}

interface CommissionSummaryData {
  gross_total: number
  total_discount?: number
  net_total?: number
  total_commission: number
  total_seller: number
  // Shipping: the agency bills every order; free shipping = the seller pays it
  shipping_cost?: number | null
  shipping_paid_by?: 'customer' | 'seller' | 'platform' | null
  seller_shipping?: number
  total_seller_net?: number
}

const SHIPPING_PAYER_LABEL: Record<string, string> = {
  customer: 'Paid by customer',
  seller:   'Paid by seller (free shipping)',
  platform: 'Absorbed by platform',
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:          '#f59e0b',
  confirmed:        '#3b82f6',
  completed:        '#10b981',
  delivered:        '#14b8a6',
  cancelled:        '#ef4444',
  refunded:         '#a855f7',
  out_for_delivery: '#8b5cf6',
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
      {status.replace(/_/g, ' ')}
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

// ─── Contact & Confirm Modal ──────────────────────────────────────────────────

function ContactModal({
  order,
  open,
  onClose,
  onUpdated,
}: {
  order: OrderDetail | null
  open: boolean
  onClose: () => void
  onUpdated: (updatedOrder: OrderDetail) => void
}) {
  const [note,        setNote]        = useState('')
  const [confirming,  setConfirming]  = useState(false)
  const [cancelling,  setCancelling]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [feedback,    setFeedback]    = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Sync note from order when modal opens
  useEffect(() => {
    if (open && order) {
      setNote(order.admin_note ?? '')
      setFeedback(null)
    }
  }, [open, order])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !order) return null

  const isPending   = order.status === 'pending'
  const isConfirmed = order.status === 'confirmed'
  const phone       = (order as any).phone ?? null
  const items       = order.items ?? []

  const handleAction = async (action: 'confirmed' | 'cancelled') => {
    const setter = action === 'confirmed' ? setConfirming : setCancelling
    setter(true)
    setFeedback(null)
    try {
      const res = await ordersApi.confirmOrder(order.id, action, note || undefined)
      setFeedback({ type: 'success', msg: res.message ?? `Order ${action}.` })
      onUpdated({ ...order, status: action as any, admin_note: note })
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message })
    } finally {
      setter(false)
    }
  }

  const handleSaveNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    setFeedback(null)
    try {
      await ordersApi.saveNote(order.id, note)
      setFeedback({ type: 'success', msg: 'Note saved.' })
      onUpdated({ ...order, admin_note: note })
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 200,
        }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 540,
        background: '#0f1623',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        zIndex: 201,
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
        animation: 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PhoneCall size={16} color="#3b82f6" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
                Contact &amp; Confirm
              </p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontFamily: 'monospace', fontWeight: 700 }}>
                {order.order_number ?? `#${order.id}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Feedback */}
            {feedback && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: feedback.type === 'success'
                  ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${feedback.type === 'success'
                  ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: 10, padding: '10px 14px',
                color: feedback.type === 'success' ? '#10b981' : '#ef4444',
                fontSize: 13, fontWeight: 700,
              }}>
                {feedback.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {feedback.msg}
              </div>
            )}

            {/* Current status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusChip status={order.status} />
              <PaymentMethodBadge method={(order as any).payment_method} />
              <Badge variant={order.payment_status as OrderStatus}>{order.payment_status}</Badge>
            </div>

            {/* Client contact info */}
            <div style={{
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
              borderRadius: 14, padding: 16,
            }}>
              <p style={{
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.12em', color: '#3b82f6', margin: '0 0 12px',
              }}>
                📞 Client Contact Info
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { icon: User,   label: 'Name',    value: (order as OrderDetail).shipping_address?.recipient_name ?? order.user?.name ?? `User #${(order as any).user_id}` },
                  { icon: Phone,  label: 'Phone',   value: phone ?? '—' },
                  { icon: MapPin, label: 'Wilaya',  value: (order as any).wilaya ?? '—' },
                  { icon: MapPin, label: 'Address', value: (order as OrderDetail).shipping_address?.formatted || ((order as any).address ?? '—') },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10, padding: '10px 12px',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: '#475569', marginBottom: 5,
                    }}>
                      <Icon size={8} />{label}
                    </div>
                    <p style={{
                      fontWeight: 700, color: label === 'Phone' ? '#3b82f6' : '#f1f5f9',
                      fontSize: 13, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {label === 'Phone' && phone ? (
                        <a href={`tel:${phone}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                          {phone}
                        </a>
                      ) : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Order summary */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 14,
            }}>
              <p style={{
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.12em', color: '#475569', margin: '0 0 10px',
              }}>
                🛒 Order Summary
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.slice(0, 4).map((item: any) => (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: 12,
                  }}>
                    <span style={{
                      color: '#94a3b8', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260,
                    }}>
                      {item.product_name} × {item.quantity}
                    </span>
                    <span style={{ color: '#f1f5f9', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
                {items.length > 4 && (
                  <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>
                    +{items.length - 4} more items
                  </p>
                )}
              </div>
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.07)',
                marginTop: 10, paddingTop: 10,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#a78bfa' }}>
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
            </div>

            {/* Admin note */}
            <div style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 14, padding: 16,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <p style={{
                  fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: '#f59e0b', margin: 0,
                }}>
                  <MessageSquare size={10} style={{ display: 'inline', marginRight: 4 }} />
                  Admin Note
                </p>
                <button
                  onClick={handleSaveNote}
                  disabled={saving || !note.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 7,
                    background: 'rgba(245,158,11,0.15)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    color: '#f59e0b', fontSize: 11, fontWeight: 700,
                    cursor: (saving || !note.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (saving || !note.trim()) ? 0.5 : 1,
                  }}
                >
                  {saving
                    ? <BrandLoader variant="inline" size={10} />
                    : <Save size={10} />
                  }
                  Save Note
                </button>
              </div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Write a note about this client call — e.g. 'Client confirmed address. Will be home after 4pm.'"
                rows={3}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: '10px 12px', fontSize: 12, color: '#f1f5f9',
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  lineHeight: 1.6, boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Confirm / Cancel buttons — only shown for pending orders */}
            {isPending && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  onClick={() => handleAction('cancelled')}
                  disabled={cancelling || confirming}
                  style={{
                    padding: '13px 20px', borderRadius: 12,
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.1)',
                    color: '#ef4444', fontWeight: 800, fontSize: 13,
                    cursor: (cancelling || confirming) ? 'not-allowed' : 'pointer',
                    opacity: (cancelling || confirming) ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                  }}
                >
                  {cancelling
                    ? <BrandLoader variant="inline" size={14} />
                    : <XCircle size={14} />
                  }
                  Cancel Order
                </button>

                <button
                  onClick={() => handleAction('confirmed')}
                  disabled={confirming || cancelling}
                  style={{
                    padding: '13px 20px', borderRadius: 12, border: 'none',
                    background: confirming
                      ? 'rgba(16,185,129,0.4)'
                      : 'linear-gradient(135deg,#10b981,#059669)',
                    color: '#fff', fontWeight: 800, fontSize: 13,
                    cursor: (confirming || cancelling) ? 'not-allowed' : 'pointer',
                    opacity: (confirming || cancelling) ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {confirming
                    ? <BrandLoader variant="inline" size={14} />
                    : <CheckCheck size={14} />
                  }
                  Confirm Order
                </button>
              </div>
            )}

            {/* Already confirmed banner */}
            {isConfirmed && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 12, padding: '12px 16px',
              }}>
                <CheckCheck size={16} color="#3b82f6" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', margin: 0 }}>
                    Order already confirmed
                  </p>
                  {order.confirmed_at && (
                    <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>
                      {format(new Date(order.confirmed_at), 'MMM d, yyyy · HH:mm')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Existing note display if not pending/confirmed */}
            {!isPending && !isConfirmed && order.admin_note && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '12px 14px',
              }}>
                <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#475569', margin: '0 0 6px' }}>
                  Admin Note
                </p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                  {order.admin_note}
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: translate(-50%,-48%) scale(0.96) }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1) }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}

// ─── Order Item Row ───────────────────────────────────────────────────────────

function OrderItemRow({ item }: { item: any }) {
  const options       = Object.entries(item.variant_options ?? {})
  const imageUrl      = item.resolved_image_url ?? null
  const hasCommission = Number(item.commission_amount) > 0
  const commissionPct = Number(item.commission_percentage ?? 0)
  const commissionAmt = Number(item.commission_amount ?? 0)
  const sellerAmt     = Number(item.seller_amount ?? 0)
  const discountAmt   = Number(item.discount_amount ?? 0)
  const netTotal      = Number(item.net_total ?? item.total ?? 0)
  const planUsed      = item.plan_used as string | null
  const planColor     = PLAN_COLORS[planUsed ?? 'free'] ?? '#94a3b8'

  return (
    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <td style={{ padding: '10px 12px', width: 52 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 8, overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {imageUrl
            ? <img src={imageUrl} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Package size={14} color="#4b5563" />}
        </div>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <p style={{
            fontWeight: 700, fontSize: 13, margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
            color: item.item_status ? '#475569' : '#f1f5f9',
            textDecoration: item.item_status ? 'line-through' : 'none',
          }}>
            {item.product_name}
          </p>
          {item.is_platform_item && <PlatformBadge />}
          {item.item_status === 'returned' && (
            <span style={{
              flexShrink: 0, fontSize: 9, fontWeight: 800,
              padding: '2px 7px', borderRadius: 999,
              background: 'rgba(219,20,46,0.15)', color: '#db142e',
              border: '1px solid rgba(219,20,46,0.35)',
            }}>↩ Returned</span>
          )}
          {item.item_status === 'exchanged' && (
            <span style={{
              flexShrink: 0, fontSize: 9, fontWeight: 800,
              padding: '2px 7px', borderRadius: 999,
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.35)',
            }}>↔ Exchanged</span>
          )}
        </div>
        {options.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {options.map(([slug, opt]: any) => (
              <span key={slug} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.1)', textTransform: 'capitalize',
              }}>
                {opt.color_hex && <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.color_hex, border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0 }} />}
                {slug}: {opt.value}
              </span>
            ))}
          </div>
        )}
        {item.variant_label && options.length === 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
            background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
            border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block', marginBottom: 4,
          }}>{item.variant_label}</span>
        )}
        {hasCommission && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
              background: 'rgba(219,20,46,0.12)', color: '#db142e',
              border: '1px solid rgba(219,20,46,0.2)',
            }}>
              Fee {commissionPct}%{discountAmt > 0 ? ` of ${netTotal.toFixed(3)}` : ''} → {commissionAmt.toFixed(3)} DT
            </span>
            {discountAmt > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.2)',
              }}>
                Coupon −{discountAmt.toFixed(3)} DT
              </span>
            )}
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
                border: `1px solid ${planColor}25`, textTransform: 'capitalize',
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

// ─── Commission Summary ───────────────────────────────────────────────────────

function CommissionSummary({ items, grossTotal, commissionSummary }: {
  items: any[]
  grossTotal: number
  commissionSummary?: CommissionSummaryData | null
}) {
  // Split is on item prices AFTER the seller-funded coupon (shipping excluded)
  const totalDiscount   = Number(commissionSummary?.total_discount ?? 0)
  const effectiveGross  = commissionSummary?.net_total ?? commissionSummary?.gross_total ?? grossTotal
  const totalCommission = commissionSummary?.total_commission
    ?? items.filter(i => i.item_status !== 'returned').reduce((s, i) => s + Number(i.commission_amount ?? 0), 0)
  const totalSeller     = commissionSummary?.total_seller
    ?? items.filter(i => i.item_status !== 'returned').reduce((s, i) => s + Number(i.seller_amount ?? 0), 0)
  const hasData         = totalCommission > 0 || totalSeller > 0

  if (!hasData) return null

  const commissionPct = effectiveGross > 0 ? ((totalCommission / effectiveGross) * 100).toFixed(1) : '0'
  const shippingCost   = Number(commissionSummary?.shipping_cost ?? 0)
  const sellerShipping = Number(commissionSummary?.seller_shipping ?? 0)
  const sellerNet      = commissionSummary?.total_seller_net ?? totalSeller - sellerShipping
  const payer          = commissionSummary?.shipping_paid_by ?? null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(219,20,46,0.12)', border: '1px solid rgba(219,20,46,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingDown size={13} color="#db142e" />
        </div>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Revenue Split</p>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
          background: 'rgba(219,20,46,0.1)', color: '#db142e',
          border: '1px solid rgba(219,20,46,0.2)',
        }}>
          ADMIN EARNS {commissionPct}%
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${shippingCost > 0 ? 4 : 3}, 1fr)` }}>
        <div style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Item Sales</p>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#94a3b8', margin: 0 }}>{formatCurrency(effectiveGross)}</p>
          <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>
            {totalDiscount > 0
              ? `${Number(commissionSummary?.gross_total).toFixed(3)} − ${totalDiscount.toFixed(3)} coupon`
              : 'Excl. shipping'}
          </p>
        </div>
        <div style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(219,20,46,0.03)' }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#db142e', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Platform Fee</p>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#db142e', margin: 0 }}>{formatCurrency(totalCommission)}</p>
          <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>Admin income ✓</p>
        </div>
        {shippingCost > 0 && (
          <div style={{ padding: '12px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(245,158,11,0.03)' }}>
            <p style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
              {sellerShipping > 0 ? 'Shipping (paid by seller)' : 'Shipping → Agency'}
            </p>
            <p style={{ fontSize: 15, fontWeight: 900, color: '#f59e0b', margin: 0 }}>−{formatCurrency(sellerShipping > 0 ? sellerShipping : shippingCost)}</p>
            <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>{payer ? SHIPPING_PAYER_LABEL[payer] : 'Delivery agency'}</p>
          </div>
        )}
        <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.03)' }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Seller Gets</p>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#10b981', margin: 0 }}>{formatCurrency(sellerNet)}</p>
          <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>
            {sellerShipping > 0 ? `${formatCurrency(totalSeller)} − ${formatCurrency(sellerShipping)} shipping` : 'Paid to sellers'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Order Detail Drawer ──────────────────────────────────────────────────────

const PICKUP_ISSUE = 'Pickup address incomplete'

function exportableSubOrders(detail: OrderDetail, subOrders: SellerSubOrder[]) {
  const orderIssue = (detail.export_readiness?.issues ?? []).find(i => !i.startsWith(PICKUP_ISSUE))
  return subOrders.filter(so => so.is_shippable).map(so => {
    const pickupIssue = so.pickup && !so.pickup.complete ? `${PICKUP_ISSUE}: missing ${so.pickup.missing.join(', ')}` : undefined
    return {
      id:       so.id,
      shopName: so.pickup?.shop_name ?? so.seller?.name ?? `Seller #${so.seller_id}`,
      ready:    !orderIssue && !pickupIssue,
      reason:   orderIssue ?? pickupIssue,
    }
  })
}

function OrderDetailDrawer({ orderId, open, onClose, onUpdated, notify }: {
  orderId: number | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  notify: (type: 'success' | 'error', msg: string) => void
}) {
  const [detail,       setDetail]       = useState<OrderDetail | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [newStatus,    setNewStatus]    = useState('')
  const [updating,     setUpdating]     = useState(false)
  const [newPayStatus, setNewPayStatus] = useState('')
  const [payUpdating,  setPayUpdating]  = useState(false)

  // Contact modal state
  const [contactOpen, setContactOpen]   = useState(false)

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

  // Re-fetch without the full-screen spinner (after an export or a pickup fix)
  const refreshDetail = useCallback(() => {
    if (!orderId) return
    ordersApi.get(orderId).then(res => setDetail(res as OrderDetail)).catch(() => {})
  }, [orderId])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !contactOpen) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, contactOpen])

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
  const subOrders   = detail?.seller_orders ?? detail?.sellerOrders ?? []

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)', zIndex: 100,
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 680,
        background: '#0f1623', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
        animation: 'slideIn 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}>

        {/* Header */}
        <div style={{
          flexShrink: 0, padding: '18px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0f1623',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingBag size={15} color="#3b82f6" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>Order Details</p>
                {detail?.has_platform_items && <PlatformBadge />}
                {detail?.slips_exported_at && <ExportedBadge at={detail.slips_exported_at} />}
              </div>
              {detail && <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontFamily: 'monospace', fontWeight: 700 }}>{detail.order_number ?? `#${detail.id}`}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {detail && (
              <ExportMenu
                orderId={detail.id}
                readiness={detail.export_readiness}
                subOrders={exportableSubOrders(detail, subOrders)}
                onExported={() => { refreshDetail(); onUpdated() }}
                notify={notify}
              />
            )}
            {/* Phone / Contact button */}
            {detail && (
              <button
                onClick={() => setContactOpen(true)}
                title="Contact client & confirm order"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 9,
                  background: detail.status === 'pending'
                    ? 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(59,130,246,0.1))'
                    : 'rgba(255,255,255,0.06)',
                  border: detail.status === 'pending'
                    ? '1px solid rgba(59,130,246,0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: detail.status === 'pending' ? '#3b82f6' : '#94a3b8',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s',
                  animation: detail.status === 'pending' ? 'pulse 2s ease-in-out infinite' : 'none',
                }}
              >
                <PhoneCall size={13} />
                {detail.status === 'pending' ? 'Call & Confirm' : 'Contact'}
              </button>
            )}
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#94a3b8',
            }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <BrandLoader variant="section" label="Loading order…" minHeight={240} />
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

              {/* Admin note display (if set) */}
              {detail.admin_note && (
                <div style={{
                  background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 12, padding: '12px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <MessageSquare size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b', margin: '0 0 4px' }}>Admin Note</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>{detail.admin_note}</p>
                  </div>
                </div>
              )}

              {/* Status strip */}
              <div style={{
                background: `${statusColor}0d`, border: `1px solid ${statusColor}25`,
                borderRadius: 14, padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 10,
              }}>
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
                  { icon: User,        label: 'Customer account', value: detail.user?.name ?? `User #${(detail as any).user_id}`, sub: detail.user?.email },
                  { icon: ShoppingBag, label: 'Total paid', value: formatCurrency(detail.total_amount),
                    sub: detail.shipping_fee !== undefined ? `incl. ${formatCurrency(detail.shipping_fee)} shipping` : undefined },
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

              {/* Shipping address snapshot (taken at checkout) */}
              <ShippingAddressCard address={detail.shipping_address} />

              {/* Sub-orders */}
              {subOrders.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>Seller Sub-orders</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {subOrders.map(so => {
                      const isPlatform = so.seller?.name === "CHOOSE'Tounsi"
                      return (
                        <div key={so.id} style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${so.is_shippable && so.pickup && !so.pickup.complete ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: 10, padding: '10px 14px',
                        }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          flexWrap: 'wrap', gap: 8,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {isPlatform ? <PlatformBadge /> : (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
                                {so.seller?.name ?? `Seller #${so.seller_id}`}
                              </span>
                            )}
                            <StatusChip status={so.status} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {Number(so.discount_amount ?? 0) > 0 && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                                −{formatCurrency(Number(so.discount_amount))}{so.coupon_code ? ` (${so.coupon_code})` : ''}
                              </span>
                            )}
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>{formatCurrency(Number(so.subtotal) - Number(so.discount_amount ?? 0))}</span>
                          </div>
                        </div>
                        {so.slip_money && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#64748b', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{so.reference}</span>
                            <span>·</span>
                            <span>
                              COD on slip: <strong style={{ color: so.slip_money.cod > 0 ? '#f1f5f9' : '#10b981' }}>{formatCurrency(so.slip_money.cod)}</strong>
                              {so.slip_money.shipping > 0 && ` (incl. ${formatCurrency(so.slip_money.shipping)} shipping)`}
                              {so.slip_money.cod === 0 && ' — prepaid'}
                            </span>
                          </div>
                        )}
                        {so.pickup && so.is_shippable && (
                          <PickupBlock
                            sellerId={so.seller_id}
                            pickup={so.pickup}
                            onSaved={() => { notify('success', 'Pickup address saved.'); refreshDetail(); onUpdated() }}
                          />
                        )}
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
                      {detail.subtotal !== undefined && (
                        <>
                          <tr style={{ borderTop: '2px solid rgba(255,255,255,0.08)' }}>
                            <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: 12 }}>Items Subtotal</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#94a3b8', fontSize: 12 }}>{formatCurrency(detail.subtotal)}</td>
                          </tr>
                          {Number(detail.discount_amount ?? 0) > 0 && (
                            <tr>
                              <td colSpan={4} style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 700, color: '#f59e0b', fontSize: 12 }}>
                                Coupon{detail.coupon_codes?.length ? ` (${detail.coupon_codes.join(', ')})` : ''} · seller-funded
                              </td>
                              <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 800, color: '#f59e0b', fontSize: 12 }}>−{formatCurrency(Number(detail.discount_amount))}</td>
                            </tr>
                          )}
                          <tr>
                            <td colSpan={4} style={{ padding: '4px 12px 8px', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: 12 }}>Shipping</td>
                            <td style={{ padding: '4px 12px 8px', textAlign: 'right', fontWeight: 800, color: '#94a3b8', fontSize: 12 }}>
                              {Number(detail.shipping_fee ?? 0) > 0 ? formatCurrency(Number(detail.shipping_fee)) : 'Free'}
                              {Number(detail.shipping_fee ?? 0) === 0 && Number((detail as any).commission_summary?.seller_shipping ?? 0) > 0 && (
                                <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>
                                  Seller pays {formatCurrency(Number((detail as any).commission_summary.seller_shipping))} to agency
                                </p>
                              )}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                        <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#94a3b8', fontSize: 12 }}>Total Paid by Customer</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#94a3b8', fontSize: 14 }}>{formatCurrency(detail.total_amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {(detail.export_history?.length ?? 0) > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>Export history</p>
                  <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                    {detail.export_history!.slice(0, 8).map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 12px', fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ color: '#cbd5e1', fontWeight: 700 }}>
                          {EXPORT_TYPE_LABEL[e.type] ?? e.type}{e.seller_order_id ? ` · sub-order ${e.seller_order_id}` : ''}
                        </span>
                        <span style={{ color: '#64748b' }}>{e.exported_by ?? 'unknown'} · {format(new Date(e.created_at), 'MMM d, HH:mm')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <CommissionSummary
                items={items}
                grossTotal={Number(detail.subtotal ?? detail.total_amount) - Number(detail.discount_amount ?? 0)}
                commissionSummary={(detail as any).commission_summary ?? null}
              />

              {/* Update Order Status */}
              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: 18 }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#818cf8', margin: '0 0 12px' }}>Update Order Status</p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <select value={newStatus} onChange={e => { setNewStatus(e.target.value); setSuccess('') }}
                      style={{ width: '100%', appearance: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 36px 10px 14px', fontSize: 13, fontWeight: 600, color: newStatus ? '#f1f5f9' : '#64748b', cursor: 'pointer', outline: 'none' }}>
                      <option value="" style={{ background: '#0f1623', color: '#64748b' }}>— Select new status —</option>
                      {['pending', 'confirmed', 'out_for_delivery', 'completed', 'delivered', 'cancelled', 'refunded'].map(s => (
                        <option key={s} value={s} style={{ background: '#0f1623', color: '#f1f5f9' }}>
                          {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                  </div>
                  <button onClick={handleStatusUpdate} disabled={!newStatus || updating}
                    style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: (!newStatus || updating) ? 'not-allowed' : 'pointer', opacity: (!newStatus || updating) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    {updating && <BrandLoader variant="inline" size={13} />}
                    Update
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#475569', margin: '10px 0 0', fontWeight: 500 }}>
                  Current: <span style={{ color: STATUS_COLORS[detail.status] ?? '#94a3b8', fontWeight: 700 }}>{detail.status}</span>
                </p>
              </div>

              {/* Update Payment Status */}
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
                    {payUpdating && <BrandLoader variant="inline" size={13} />}
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

      {/* Contact Modal — rendered on top of the drawer */}
      <ContactModal
        order={detail}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        onUpdated={(updated) => {
          setDetail(updated)
          setContactOpen(false)
          onUpdated()
        }}
      />

      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
        @keyframes spin    { to   { transform:rotate(360deg) } }
        @keyframes pulse   {
          0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3) }
          50%     { box-shadow: 0 0 0 6px rgba(59,130,246,0) }
        }
      `}</style>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

type SellerTypeFilter = 'all' | 'platform' | 'sellers'

/** List row extras from GET /api/admin/orders */
type ListOrder = Order & {
  slips_exported_at?: string | null
  address_status?:    'complete' | 'legacy' | 'missing'
  export_issues?:     string[]
}

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
  const [needsSlips, setNeedsSlips] = useState(false)
  // Rows ticked for bulk export, kept across pages (id → row, for its export_issues)
  const [picked,     setPicked]     = useState<Map<number, ListOrder>>(new Map())
  const [bulkBusy,   setBulkBusy]   = useState(false)
  const { toast, show: notify, dismiss } = useToast()

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
        needs_slips:    needsSlips  ? 1 : undefined,
        page,
      })
      setOrders(res)
    } finally {
      setLoading(false)
    }
  }, [search, status, payMethod, sellerType, dateFrom, dateTo, needsSlips, page])

  useEffect(() => {
    const t = setTimeout(fetchOrders, 300)
    return () => clearTimeout(t)
  }, [fetchOrders])

  const openDetail = (id: number) => { setSelectedId(id); setDetailOpen(true) }

  // ── Bulk selection & export ──────────────────────────────────────────────
  const pageRows   = (orders?.data ?? []) as ListOrder[]
  const allPicked  = pageRows.length > 0 && pageRows.every(r => picked.has(r.id))
  const togglePick = (row: ListOrder) => setPicked(prev => {
    const next = new Map(prev)
    next.has(row.id) ? next.delete(row.id) : next.set(row.id, row)
    return next
  })
  const togglePage = () => setPicked(prev => {
    const next = new Map(prev)
    pageRows.forEach(r => allPicked ? next.delete(r.id) : next.set(r.id, r))
    return next
  })
  const blockedPicks = Array.from(picked.values()).filter(r => (r.export_issues?.length ?? 0) > 0)
  const bulkBlockedReason = blockedPicks.length
    ? `${blockedPicks.length} selected order(s) can't be exported: ${blockedPicks.slice(0, 3).map(r => `${r.order_number} — ${r.export_issues![0]}`).join(' | ')}`
    : undefined

  const handleBulkExport = async () => {
    if (!picked.size || bulkBlockedReason) return
    setBulkBusy(true)
    try {
      const name = await ordersApi.exportBulkSlips(Array.from(picked.keys()))
      notify('success', `Downloaded ${name} (${picked.size} order${picked.size > 1 ? 's' : ''}).`)
      setPicked(new Map())
      fetchOrders()
    } catch (e: any) {
      notify('error', e.message)
    } finally {
      setBulkBusy(false)
    }
  }

  // Deep link: /orders?order=<id> opens that order's drawer (used by Finance → Orders)
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('order'))
    if (Number.isInteger(id) && id > 0) openDetail(id)
  }, [])

  const columns: Column<Order>[] = [
    {
      key: 'select',
      header: (
        <input type="checkbox" checked={allPicked} onChange={togglePage}
          aria-label="Select all orders on this page" style={{ accentColor: '#14b8a6', cursor: 'pointer' }} />
      ),
      className: 'w-8',
      render: row => (
        <input type="checkbox" checked={picked.has(row.id)} onChange={() => togglePick(row as ListOrder)}
          aria-label={`Select order ${row.order_number}`} style={{ accentColor: '#14b8a6', cursor: 'pointer' }} />
      ),
    },
    {
      key: 'order_number', header: 'Order',
      render: row => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="font-mono text-xs font-bold text-text-primary bg-bg-hover px-2 py-0.5 rounded">
            {row.order_number}
          </span>
          {(row as any).has_platform_items && <PlatformBadge />}
          {(row as ListOrder).slips_exported_at && <ExportedBadge at={(row as ListOrder).slips_exported_at!} />}
          {(row as ListOrder).address_status === 'missing' && (
            <span title="Legacy order without a shipping address" style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b' }}>⚠ no address</span>
          )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Phone icon — glows blue if pending */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(row.id)
              // We'll open detail first then auto-open contact — simplest approach:
              // just open the drawer; user clicks "Call & Confirm" from there.
              // OR we can open contact directly when we have the full detail.
              openDetail(row.id)
            }}
            title="Contact client"
            style={{
              padding: 6, borderRadius: 7,
              background: row.status === 'pending'
                ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: row.status === 'pending'
                ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              color: row.status === 'pending' ? '#3b82f6' : '#475569',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              transition: 'all 0.15s',
            }}
          >
            <Phone size={14} />
          </button>
          <button
            onClick={() => openDetail(row.id)}
            className="p-1.5 rounded-md text-text-muted hover:text-accent-purple hover:bg-accent-purple/10 transition-colors"
            title="View details"
          >
            <Eye size={15} />
          </button>
        </div>
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
            {['pending', 'confirmed', 'out_for_delivery', 'completed', 'delivered', 'cancelled', 'refunded'].map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
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
          <button onClick={() => { setNeedsSlips(v => !v); setPage(1) }} aria-pressed={needsSlips}
            title="Confirmed orders whose delivery slips were never exported"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: needsSlips ? 'rgba(20,184,166,0.15)' : 'transparent',
              border: `1px solid ${needsSlips ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: needsSlips ? '#14b8a6' : '#94a3b8', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            <FileDown size={14} /> Needs slips
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">
            {sellerType === 'platform' ? "CHOOSE'Tounsi Orders" : sellerType === 'sellers' ? 'Seller Orders' : 'All Orders'}
            {orders && <span className="ml-2 text-xs font-normal text-text-muted">({orders.total} total)</span>}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {sellerType === 'platform' && (
              <span style={{ fontSize: 11, color: '#db142e', fontWeight: 700, background: 'rgba(219,20,46,0.08)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(219,20,46,0.2)' }}>
                🏪 Platform brand products only
              </span>
            )}
            {picked.size > 0 && (
              <>
                <button onClick={() => setPicked(new Map())} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Clear ({picked.size})
                </button>
                <button onClick={handleBulkExport} disabled={bulkBusy || !!bulkBlockedReason}
                  title={bulkBlockedReason ?? 'One PDF with every delivery slip of the selected orders'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
                    background: bulkBlockedReason ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#14b8a6,#0d9488)',
                    border: bulkBlockedReason ? '1px solid rgba(245,158,11,0.35)' : 'none',
                    color: bulkBlockedReason ? '#f59e0b' : '#fff', fontSize: 12, fontWeight: 700,
                    cursor: bulkBusy ? 'wait' : bulkBlockedReason ? 'not-allowed' : 'pointer', opacity: bulkBusy ? 0.75 : 1,
                  }}>
                  {bulkBusy ? <BrandLoader variant="inline" size={13} /> : bulkBlockedReason ? <AlertTriangle size={13} /> : <FileDown size={13} />}
                  {bulkBusy ? 'Generating…' : `Export delivery slips (${picked.size})`}
                </button>
              </>
            )}
          </div>
        </div>
        <DataTable columns={columns} data={orders?.data ?? []} loading={loading} emptyMessage="No orders found." keyField="id" />
        {orders && orders.last_page > 1 && (
          <Pagination currentPage={orders.current_page} lastPage={orders.last_page} total={orders.total} from={orders.from} to={orders.to} onPageChange={setPage} />
        )}
      </div>

      <OrderDetailDrawer
        orderId={selectedId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={fetchOrders}
        notify={notify}
      />

      <Toast toast={toast} onClose={dismiss} />
    </div>
  )
}