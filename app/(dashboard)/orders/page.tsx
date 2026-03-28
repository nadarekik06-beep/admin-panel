'use client'

/**
 * app/(dashboard)/orders/page.tsx  — Admin Panel
 *
 * UPDATED: OrderDetailModal now shows per-item:
 *   - Variant image (resolved by backend: variant image → product primary fallback)
 *   - Variant attribute badges with color swatches (Color, Size, etc.)
 *   - Variant label snapshot
 */

import { useEffect, useState, useCallback } from 'react'
import { Search, Eye, Loader2, ShoppingBag, MapPin, Phone, FileText, Package, User } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { ordersApi } from '@/lib/api/orders'
import type { Order, OrderItem, PaginatedResponse, OrderStatus } from '@/types'
import { format } from 'date-fns'

function formatCurrency(v: number | string) {
  return `${Number(v).toFixed(3)} DT`
}

// ─── Extended order types ──────────────────────────────────────────────────────

interface OrderDetail extends Order {
  items?: OrderItem[]
  user?: { id: number; name: string; email: string }
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

// ─── Order Item Row (with variant image + badges) ──────────────────────────────

function OrderItemRow({ item }: { item: OrderItem }) {
  const hasVariant  = !!item.variant_id
  const options     = Object.entries(item.variant_options ?? {})
  const imageUrl    = item.resolved_image_url ?? null

  return (
    <tr style={{ borderTop: '1px solid var(--border, #e5e7eb)' }}>
      {/* Image — variant-aware, resolved by backend */}
      <td style={{ padding: '12px 14px', width: 56 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
          background: '#f8fafc', border: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {imageUrl
            ? <img src={imageUrl} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Package size={16} color="#e2e8f0" />
          }
        </div>
      </td>

      {/* Product name + variant badges */}
      <td style={{ padding: '12px 14px' }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary, #0f172a)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
          {item.product_name}
        </p>

        {/* Variant option badges */}
        {hasVariant && options.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {options.map(([slug, opt]) => (
              <span key={slug} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                background: '#f1f5f9', color: '#374151', border: '1px solid #e5e7eb',
                textTransform: 'capitalize',
              }}>
                {opt.color_hex && (
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: opt.color_hex, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                )}
                {slug}: {opt.value}
              </span>
            ))}
          </div>
        )}

        {/* Fallback: show variant_label if no option map */}
        {hasVariant && options.length === 0 && item.variant_label && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#f1f5f9', color: '#374151', border: '1px solid #e5e7eb' }}>
            {item.variant_label}
          </span>
        )}
      </td>

      {/* Qty */}
      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted, #64748b)', fontSize: 12 }}>
        {item.quantity}
      </td>

      {/* Unit price */}
      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted, #64748b)', fontSize: 12 }}>
        {formatCurrency(item.unit_price)}
      </td>

      {/* Line total */}
      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-purple, #7c3aed)', fontSize: 13 }}>
        {formatCurrency(item.total)}
      </td>
    </tr>
  )
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────

function OrderDetailModal({
  orderId,
  open,
  onClose,
  onUpdated,
}: {
  orderId: number | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
}) {
  const [detail,    setDetail]    = useState<OrderDetail | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [updating,  setUpdating]  = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  useEffect(() => {
    if (!orderId || !open) return
    setLoading(true)
    setError('')
    setNewStatus('')
    setSuccess('')
    ordersApi.get(orderId)
      .then(res => setDetail(res as OrderDetail))
      .catch(() => setError('Failed to load order details.'))
      .finally(() => setLoading(false))
  }, [orderId, open])

  const handleStatusUpdate = async () => {
    if (!newStatus || !detail) return
    setUpdating(true)
    setError('')
    try {
      await ordersApi.updateStatus(detail.id, newStatus)
      setSuccess(`Status updated to "${newStatus}".`)
      setDetail(prev => prev ? { ...prev, status: newStatus as any } : prev)
      setNewStatus('')
      onUpdated()
    } catch {
      setError('Failed to update status.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Order Details" size="lg">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent-purple" />
        </div>
      ) : error && !detail ? (
        <p className="text-accent-red text-sm">{error}</p>
      ) : detail ? (
        <div className="space-y-5">

          {/* Feedback messages */}
          {success && (
            <div className="bg-accent-green/10 border border-accent-green/25 rounded-xl px-4 py-2.5 text-sm font-semibold text-accent-green">
              ✓ {success}
            </div>
          )}
          {error && (
            <div className="bg-accent-red/10 border border-accent-red/25 rounded-xl px-4 py-2.5 text-sm font-semibold text-accent-red">
              {error}
            </div>
          )}

          {/* ── Meta grid ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: ShoppingBag, label: 'Order Number', value: detail.order_number ?? `#${detail.id}` },
              { icon: User,        label: 'Customer',     value: detail.user?.name ?? `User #${(detail as any).user_id}`, sub: detail.user?.email },
              { icon: MapPin,      label: 'Wilaya',       value: (detail as any).wilaya ?? '—' },
              { icon: Phone,       label: 'Phone',        value: (detail as any).phone  ?? '—' },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="p-3 bg-bg-primary rounded-xl border border-border">
                <div className="flex items-center gap-1.5 text-text-muted text-[9px] font-bold uppercase tracking-widest mb-1.5">
                  <Icon size={9} />{label}
                </div>
                <p className="text-text-primary text-sm font-bold leading-snug truncate">{value}</p>
                {sub && <p className="text-text-muted text-xs mt-0.5 truncate">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Delivery address */}
          {(detail as any).address && (
            <div className="p-3 bg-bg-primary rounded-xl border border-border">
              <div className="flex items-center gap-1.5 text-text-muted text-[9px] font-bold uppercase tracking-widest mb-1.5">
                <MapPin size={9} />Full Address
              </div>
              <p className="text-text-primary text-sm">{(detail as any).address}</p>
            </div>
          )}

          {/* Notes */}
          {(detail as any).notes && (
            <div className="p-3 bg-bg-primary rounded-xl border border-border">
              <div className="flex items-center gap-1.5 text-text-muted text-[9px] font-bold uppercase tracking-widest mb-1.5">
                <FileText size={9} />Notes
              </div>
              <p className="text-text-secondary text-sm">{(detail as any).notes}</p>
            </div>
          )}

          {/* Status + payment badges */}
          <div className="flex gap-4 flex-wrap">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Status</p>
              <StatusChip status={detail.status} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Payment</p>
              <Badge variant={detail.payment_status as OrderStatus}>{detail.payment_status}</Badge>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Date</p>
              <span className="text-text-secondary text-xs font-medium">
                {format(new Date(detail.created_at), 'MMM d, yyyy · HH:mm')}
              </span>
            </div>
          </div>

          {/* ── Order items table — WITH variant images ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package size={14} className="text-accent-purple" />
              <h3 className="text-sm font-bold text-text-primary">Order Items</h3>
              <span className="text-[10px] text-text-muted font-medium">
                (images match selected variant/color)
              </span>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-bg-primary">
                    <th className="py-2 px-3 text-left text-text-muted font-bold uppercase tracking-wider text-[9px] w-14">Image</th>
                    <th className="py-2 px-3 text-left text-text-muted font-bold uppercase tracking-wider text-[9px]">Product</th>
                    <th className="py-2 px-3 text-right text-text-muted font-bold uppercase tracking-wider text-[9px]">Qty</th>
                    <th className="py-2 px-3 text-right text-text-muted font-bold uppercase tracking-wider text-[9px]">Unit</th>
                    <th className="py-2 px-3 text-right text-text-muted font-bold uppercase tracking-wider text-[9px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items ?? []).map(item => (
                    <OrderItemRow key={item.id} item={item} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-bg-primary">
                    <td colSpan={4} className="py-2.5 px-3 font-bold text-text-primary text-right">Total</td>
                    <td className="py-2.5 px-3 text-right font-black text-accent-red">{formatCurrency(detail.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Update status ── */}
          <div className="bg-bg-primary rounded-xl border border-border p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
              Update Order Status
            </p>
            <div className="flex gap-3">
              <select
                value={newStatus}
                onChange={e => { setNewStatus(e.target.value); setSuccess('') }}
                className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
              >
                <option value="">— Select new status —</option>
                {['pending', 'processing', 'completed', 'delivered', 'cancelled', 'refunded'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus || updating}
                className="px-4 py-2 bg-accent-purple hover:bg-accent-purple/90 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {updating && <Loader2 size={13} className="animate-spin" />}
                Update
              </button>
            </div>
          </div>

        </div>
      ) : null}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default function OrdersPage() {
  const [orders,     setOrders]     = useState<PaginatedResponse<Order> | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [status,     setStatus]     = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [page,       setPage]       = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ordersApi.list({
        search:    search   || undefined,
        status:    status   || undefined,
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        page,
      })
      setOrders(res)
    } finally {
      setLoading(false)
    }
  }, [search, status, dateFrom, dateTo, page])

  useEffect(() => {
    const t = setTimeout(fetchOrders, 300)
    return () => clearTimeout(t)
  }, [fetchOrders])

  const openDetail = (id: number) => {
    setSelectedId(id)
    setDetailOpen(true)
  }

  const columns: Column<Order>[] = [
    {
      key: 'order_number',
      header: 'Order',
      render: row => (
        <span className="font-mono text-xs font-bold text-text-primary bg-bg-hover px-2 py-0.5 rounded">
          {row.order_number}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'Customer',
      render: row => (
        <div>
          <p className="font-semibold text-text-primary text-sm">{(row as any).user?.name ?? `User #${(row as any).user_id}`}</p>
          <p className="text-xs text-text-muted">{(row as any).user?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'wilaya',
      header: 'Wilaya',
      render: row => (
        <span className="text-text-muted text-sm">{(row as any).wilaya ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: row => <StatusChip status={row.status} />,
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: row => (
        <Badge variant={row.payment_status as OrderStatus}>{row.payment_status}</Badge>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: row => (
        <span className="font-bold text-text-primary">{formatCurrency(row.total_amount)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: row => (
        <span className="text-text-muted text-xs">
          {format(new Date(row.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: row => (
        <button
          onClick={() => openDetail(row.id)}
          className="p-1.5 rounded-md text-text-muted hover:text-accent-purple hover:bg-accent-purple/10 transition-colors"
          title="View details"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by order number or customer..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
          >
            <option value="">All Status</option>
            {['pending', 'processing', 'completed', 'delivered', 'cancelled', 'refunded'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-muted focus:outline-none focus:border-accent-purple transition-colors" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            Orders
            {orders && (
              <span className="ml-2 text-xs font-normal text-text-muted">({orders.total} total)</span>
            )}
          </h2>
        </div>

        <DataTable
          columns={columns}
          data={orders?.data ?? []}
          loading={loading}
          emptyMessage="No orders found."
          keyField="id"
        />

        {orders && orders.last_page > 1 && (
          <Pagination
            currentPage={orders.current_page}
            lastPage={orders.last_page}
            total={orders.total}
            from={orders.from}
            to={orders.to}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Detail Modal — opens on row Eye click */}
      <OrderDetailModal
        orderId={selectedId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={fetchOrders}
      />
    </div>
  )
}