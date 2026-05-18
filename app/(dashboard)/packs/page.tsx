'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Package2, Plus, Eye, CheckCircle, XCircle, Trash2,
  AlertCircle, RefreshCw, Search, Clock, Tag,
  TrendingDown, Store, Filter, X, ChevronDown,
  ShoppingBag, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import api from '@/lib/axios'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pack {
  id: number
  name: string
  slug: string
  description: string | null
  short_description: string | null
  image_url: string | null
  pack_price: number
  original_price: number
  savings: number
  is_active: boolean
  is_approved: boolean
  views: number
  items_count: number
  created_at: string
  updated_at: string
  seller: {
    id: number
    name: string
    email: string
    plan: string
  } | null
}

interface PackDetail extends Pack {
  items: Array<{
    id: number
    product_id: number
    allowed_variant_ids: number[] | null
    quantity: number
    unit_price_snapshot: number
    order: number
    available_variants: Array<{
      id: number
      label: string
      stock: number
      price_override: number | null
    }>
    product: {
      id: number
      name: string
      slug: string
      price: number
      is_active: boolean
      is_approved: boolean
      primary_image_url: string | null
      has_variants: boolean
    } | null
  }>
}

interface Stats {
  total: number
  approved: number
  pending: number
  active: number
  inactive: number
}

interface PaginatedPacks {
  data: Pack[]
  current_page: number
  last_page: number
  total: number
  from: number
  to: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n) + ' DT'
}

function fmtDate(iso: string) {
  return format(new Date(iso), 'MMM d, yyyy')
}

const PLAN_COLORS: Record<string, string> = {
  free:  '#198f41',
  red:   '#db142e',
  black: '#f59e0b',
}

const PLAN_LABELS: Record<string, string> = {
  free:  'Green',
  red:   'Red',
  black: 'Black',
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, icon: Icon,
}: {
  label: string; value: number; color: string; icon: any
}) {
  return (
    <div style={{
      background: '#161b27',
      border: `1px solid ${color}28`,
      borderRadius: 14, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${color}15`, border: `1px solid ${color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0', fontWeight: 600 }}>{label}</p>
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ approved, active }: { approved: boolean; active: boolean }) {
  if (!approved) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
        background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
        border: '1px solid rgba(245,158,11,0.25)',
      }}>
        <Clock size={9} /> Pending
      </span>
    )
  }
  if (!active) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
        background: 'rgba(100,116,139,0.12)', color: '#64748b',
        border: '1px solid rgba(100,116,139,0.25)',
      }}>
        <XCircle size={9} /> Inactive
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
      background: 'rgba(16,185,129,0.12)', color: '#10b981',
      border: '1px solid rgba(16,185,129,0.25)',
    }}>
      <CheckCircle size={9} /> Live
    </span>
  )
}

// ─── Pack Detail Drawer ───────────────────────────────────────────────────────

function PackDetailDrawer({
  packId, open, onClose, onUpdated,
}: {
  packId: number | null; open: boolean; onClose: () => void; onUpdated: () => void
}) {
  const [detail,    setDetail]    = useState<PackDetail | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [toggling,  setToggling]  = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const load = useCallback(() => {
    if (!packId || !open) return
    setLoading(true); setError(''); setSuccessMsg('')
    setShowRejectInput(false); setRejectReason('')
    api.get(`/admin/packs/${packId}`)
      .then(res => setDetail(res.data.data))
      .catch(() => setError('Failed to load pack details.'))
      .finally(() => setLoading(false))
  }, [packId, open])

  useEffect(() => { load() }, [load])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleApprove = async () => {
    if (!detail) return
    setApproving(true); setError(''); setSuccessMsg('')
    try {
      await api.patch(`/admin/packs/${detail.id}/approve`)
      setDetail(prev => prev ? { ...prev, is_approved: true, is_active: true } : prev)
      setSuccessMsg(`Pack "${detail.name}" is now live!`)
      onUpdated()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to approve pack.')
    } finally { setApproving(false) }
  }

  const handleReject = async () => {
    if (!detail) return
    if (!showRejectInput) { setShowRejectInput(true); return }
    setRejecting(true); setError(''); setSuccessMsg('')
    try {
      await api.patch(`/admin/packs/${detail.id}/reject`, {
        reason: rejectReason || 'Does not meet marketplace standards.',
      })
      setDetail(prev => prev ? { ...prev, is_approved: false, is_active: false } : prev)
      setSuccessMsg(`Pack "${detail.name}" has been rejected.`)
      setShowRejectInput(false)
      onUpdated()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to reject pack.')
    } finally { setRejecting(false) }
  }

  const handleToggle = async () => {
    if (!detail) return
    setToggling(true); setError('')
    try {
      await api.patch(`/admin/packs/${detail.id}/toggle`)
      setDetail(prev => prev ? { ...prev, is_active: !prev.is_active } : prev)
      onUpdated()
    } catch { setError('Failed to toggle pack.') }
    finally { setToggling(false) }
  }

  const handleDelete = async () => {
    if (!detail) return
    if (!confirm(`Permanently delete "${detail.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.delete(`/admin/packs/${detail.id}`)
      onUpdated()
      onClose()
    } catch { setError('Failed to delete pack.') }
    finally { setDeleting(false) }
  }

  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          zIndex: 100,
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 700,
        background: '#0f1623',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 101, display: 'flex', flexDirection: 'column',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
        animation: 'slideIn 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}>

        {/* Header */}
        <div style={{
          flexShrink: 0, padding: '18px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(219,20,46,0.12)', border: '1px solid rgba(219,20,46,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package2 size={15} color="#db142e" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
                Pack Details
              </p>
              {detail && (
                <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontFamily: 'monospace' }}>
                  ID #{detail.id} · {detail.slug}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#94a3b8',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
              <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite', color: '#db142e' }} />
              <span style={{ color: '#64748b', fontSize: 13 }}>Loading pack…</span>
            </div>
          ) : error && !detail ? (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12, padding: '14px 16px', color: '#ef4444', fontSize: 13,
            }}>{error}</div>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Feedback banners */}
              {successMsg && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: 12, padding: '12px 16px', color: '#10b981', fontSize: 13, fontWeight: 700,
                }}>
                  <CheckCircle size={14} /> {successMsg}
                </div>
              )}
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 12, padding: '12px 16px', color: '#ef4444', fontSize: 13,
                }}>{error}</div>
              )}

              {/* Image + Name header */}
              <div style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: 16,
              }}>
                <div style={{
                  width: 100, height: 100, borderRadius: 12, flexShrink: 0,
                  overflow: 'hidden', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {detail.image_url
                    ? <img src={detail.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Package2 size={32} color="#334155" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>
                      {detail.name}
                    </h2>
                    <StatusBadge approved={detail.is_approved} active={detail.is_active} />
                  </div>
                  {detail.short_description && (
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.5 }}>
                      {detail.short_description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(219,20,46,0.1)', color: '#db142e',
                      border: '1px solid rgba(219,20,46,0.2)',
                    }}>
                      {detail.items_count} item{detail.items_count !== 1 ? 's' : ''}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.05)', color: '#64748b',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      {detail.views} views
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.05)', color: '#64748b',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      Created {fmtDate(detail.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
              }}>
                {[
                  { label: 'Pack Price', value: fmt(detail.pack_price), color: '#db142e', note: 'Commission applied here' },
                  { label: 'Retail Value', value: fmt(detail.original_price), color: '#94a3b8', note: 'Sum of item prices' },
                  { label: 'Customer Saves', value: fmt(detail.savings), color: '#10b981', note: `vs buying separately` },
                ].map(card => (
                  <div key={card.label} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '12px 14px',
                  }}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>
                      {card.label}
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: card.color, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
                      {card.value}
                    </p>
                    <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>{card.note}</p>
                  </div>
                ))}
              </div>

              {/* Commission note */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(219,20,46,0.06)', border: '1px solid rgba(219,20,46,0.18)',
                borderRadius: 12, padding: '10px 14px', fontSize: 12,
              }}>
                <TrendingDown size={13} color="#db142e" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.5 }}>
                  <strong style={{ color: '#db142e' }}>Commission policy:</strong>{' '}
                  Platform fee is calculated on the <strong style={{ color: '#f1f5f9' }}>pack_price ({fmt(detail.pack_price)})</strong> as a single unit —
                  not on individual product prices inside the pack.
                  This ensures the seller sees one clear commission deduction.
                </p>
              </div>

              {/* Seller info */}
              {detail.seller && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${PLAN_COLORS[detail.seller.plan] ?? '#198f41'}18`,
                    border: `1px solid ${PLAN_COLORS[detail.seller.plan] ?? '#198f41'}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 900, color: PLAN_COLORS[detail.seller.plan] ?? '#198f41',
                    flexShrink: 0,
                  }}>
                    {detail.seller.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {detail.seller.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {detail.seller.email}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                    background: `${PLAN_COLORS[detail.seller.plan] ?? '#198f41'}15`,
                    color: PLAN_COLORS[detail.seller.plan] ?? '#198f41',
                    border: `1px solid ${PLAN_COLORS[detail.seller.plan] ?? '#198f41'}25`,
                    flexShrink: 0,
                  }}>
                    {PLAN_LABELS[detail.seller.plan] ?? detail.seller.plan} Pepper
                  </span>
                </div>
              )}

              {/* Pack items */}
              {detail.items?.length > 0 && (
                <div>
                  <p style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: '#475569', margin: '0 0 10px',
                  }}>
                    Pack Contents ({detail.items.length} item{detail.items.length !== 1 ? 's' : ''})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detail.items.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12, padding: '10px 14px',
                      }}>
                        {/* Thumbnail */}
                        <div style={{
                          width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                          overflow: 'hidden', background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {item.product?.primary_image_url
                            ? <img src={item.product.primary_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <ShoppingBag size={16} color="#334155" />
                          }
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 700, color: '#f1f5f9', margin: '0 0 3px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.product?.name ?? `Product #${item.product_id}`}
                          </p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: '#64748b' }}>
                              Base: <strong style={{ color: '#94a3b8' }}>{fmt(item.product?.price ?? item.unit_price_snapshot)}</strong>
                            </span>
                            {item.allowed_variant_ids !== null && (
                              <span style={{ fontSize: 10, color: '#6366f1' }}>
                                {item.available_variants.length} variant{item.available_variants.length !== 1 ? 's' : ''} allowed
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Qty */}
                        <div style={{
                          minWidth: 48, textAlign: 'center',
                          background: 'rgba(219,20,46,0.08)',
                          border: '1px solid rgba(219,20,46,0.2)',
                          borderRadius: 8, padding: '4px 10px',
                        }}>
                          <p style={{ fontSize: 9, color: '#db142e', fontWeight: 800, margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Qty</p>
                          <p style={{ fontSize: 15, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Actions ── */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 16,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <p style={{
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', margin: 0,
                }}>
                  Admin Actions
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {/* Approve */}
                  {!detail.is_approved && (
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      style={{
                        flex: 1, minWidth: 120,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        padding: '10px 18px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg,#10b981,#059669)',
                        color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                        opacity: approving ? 0.6 : 1,
                        boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                      }}
                    >
                      {approving
                        ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                        : <CheckCircle size={13} />
                      }
                      Approve & Publish
                    </button>
                  )}

                  {/* Reject */}
                  <button
                    onClick={handleReject}
                    disabled={rejecting}
                    style={{
                      flex: 1, minWidth: 100,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      padding: '10px 18px', borderRadius: 10,
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                      color: '#ef4444', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      opacity: rejecting ? 0.6 : 1,
                    }}
                  >
                    {rejecting
                      ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <XCircle size={13} />
                    }
                    {showRejectInput ? 'Confirm Reject' : 'Reject'}
                  </button>

                  {/* Toggle active */}
                  {detail.is_approved && (
                    <button
                      onClick={handleToggle}
                      disabled={toggling}
                      style={{
                        flex: 1, minWidth: 100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        padding: '10px 18px', borderRadius: 10,
                        border: '1px solid rgba(99,102,241,0.3)',
                        background: 'rgba(99,102,241,0.08)',
                        color: '#6366f1', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                        opacity: toggling ? 0.6 : 1,
                      }}
                    >
                      {toggling
                        ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                        : detail.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />
                      }
                      {detail.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      padding: '10px 16px', borderRadius: 10,
                      border: '1px solid rgba(239,68,68,0.2)',
                      background: 'rgba(239,68,68,0.06)',
                      color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      opacity: deleting ? 0.5 : 1,
                    }}
                  >
                    {deleting
                      ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <Trash2 size={12} />
                    }
                  </button>
                </div>

                {/* Reject reason input */}
                {showRejectInput && (
                  <div>
                    <label style={{
                      fontSize: 11, fontWeight: 700, color: '#ef4444',
                      display: 'block', marginBottom: 6,
                    }}>
                      Rejection reason (optional, sent to seller)
                    </label>
                    <textarea
                      rows={2}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="e.g. Pack price doesn't reflect the item values…"
                      style={{
                        width: '100%', background: 'rgba(239,68,68,0.05)',
                        border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
                        padding: '8px 12px', fontSize: 12, color: '#f1f5f9',
                        outline: 'none', resize: 'none', fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ height: 8 }} />
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
        @keyframes spin    { to   { transform:rotate(360deg) } }
      `}</style>
    </>
  )
}

// ─── Pack Row ─────────────────────────────────────────────────────────────────

function PackRow({
  pack, onView, onApprove, onDelete, approving, deleting,
}: {
  pack: Pack
  onView: () => void
  onApprove: () => void
  onDelete: () => void
  approving: boolean
  deleting: boolean
}) {
  const planColor = PLAN_COLORS[pack.seller?.plan ?? 'free'] ?? '#198f41'

  return (
    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.13s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      {/* Image + Name */}
      <td style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            overflow: 'hidden', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {pack.image_url
              ? <img src={pack.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Package2 size={18} color="#334155" />
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: '0 0 3px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180,
            }}>
              {pack.name}
            </p>
            <p style={{ fontSize: 10, color: '#475569', margin: 0, fontFamily: 'monospace' }}>
              {pack.items_count} item{pack.items_count !== 1 ? 's' : ''} · {pack.views} views
            </p>
          </div>
        </div>
      </td>

      {/* Seller */}
      <td style={{ padding: '12px 14px' }}>
        {pack.seller ? (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
              {pack.seller.name}
            </p>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
              background: `${planColor}15`, color: planColor,
              border: `1px solid ${planColor}25`,
            }}>
              {PLAN_LABELS[pack.seller.plan] ?? pack.seller.plan}
            </span>
          </div>
        ) : <span style={{ color: '#475569', fontSize: 12 }}>—</span>}
      </td>

      {/* Price */}
      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
        <p style={{ fontSize: 13, fontWeight: 900, color: '#db142e', margin: '0 0 2px' }}>
          {fmt(pack.pack_price)}
        </p>
        {pack.savings > 0 && (
          <p style={{ fontSize: 10, color: '#10b981', margin: 0, fontWeight: 700 }}>
            −{fmt(pack.savings)}
          </p>
        )}
      </td>

      {/* Status */}
      <td style={{ padding: '12px 14px' }}>
        <StatusBadge approved={pack.is_approved} active={pack.is_active} />
      </td>

      {/* Date */}
      <td style={{ padding: '12px 14px', color: '#475569', fontSize: 11 }}>
        {fmtDate(pack.created_at)}
      </td>

      {/* Actions */}
      <td style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* View */}
          <button
            onClick={onView}
            title="View details"
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#94a3b8',
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)'
              ;(e.currentTarget as HTMLElement).style.color = '#6366f1'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
              ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
            }}
          >
            <Eye size={13} />
          </button>

          {/* Quick Approve (only if pending) */}
          {!pack.is_approved && (
            <button
              onClick={onApprove}
              disabled={approving}
              title="Approve"
              style={{
                width: 30, height: 30, borderRadius: 7,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#10b981',
                opacity: approving ? 0.5 : 1,
              }}
            >
              {approving
                ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <CheckCircle size={13} />
              }
            </button>
          )}

          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={deleting}
            title="Delete"
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#ef4444',
              opacity: deleting ? 0.5 : 1,
            }}
          >
            {deleting
              ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <Trash2 size={13} />
            }
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPacksPage() {
  const [packs,      setPacks]      = useState<PaginatedPacks | null>(null)
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)

  // Filters
  const [search,     setSearch]     = useState('')
  const [status,     setStatus]     = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [page,       setPage]       = useState(1)

  // Detail drawer
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Row-level action states
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [deletingId,  setDeletingId]  = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(false)
    const params: Record<string, any> = {
      page,
      per_page: 15,
      ...(search   ? { search }   : {}),
      ...(status   ? { status }   : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo   ? { date_to:   dateTo   } : {}),
    }

    Promise.all([
      api.get('/admin/packs', { params }),
      api.get('/admin/packs/stats'),
    ])
      .then(([packsRes, statsRes]) => {
        setPacks(packsRes.data.data)
        setStats(statsRes.data.data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [search, status, dateFrom, dateTo, page])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const openDrawer = (id: number) => { setSelectedId(id); setDrawerOpen(true) }

  const handleQuickApprove = async (pack: Pack) => {
    setApprovingId(pack.id)
    try {
      await api.patch(`/admin/packs/${pack.id}/approve`)
      load()
    } catch { /* drawer shows error */ }
    finally { setApprovingId(null) }
  }

  const handleQuickDelete = async (pack: Pack) => {
    if (!confirm(`Delete "${pack.name}" permanently?`)) return
    setDeletingId(pack.id)
    try {
      await api.delete(`/admin/packs/${pack.id}`)
      load()
    } catch { /* silently fail, next reload will reflect truth */ }
    finally { setDeletingId(null) }
  }

  const th: React.CSSProperties = {
    padding: '9px 14px', fontSize: 9, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569',
    background: 'rgba(255,255,255,0.04)', textAlign: 'left',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: '0 0 4px',
            letterSpacing: '-0.02em',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Package2 size={22} color="#db142e" /> Packs
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            Review and approve seller bundles · Commission on pack_price only
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <StatCard label="Total Packs"  value={stats.total}    color="#94a3b8" icon={Package2}     />
          <StatCard label="Live"         value={stats.approved} color="#10b981" icon={CheckCircle}  />
          <StatCard label="Pending"      value={stats.pending}  color="#f59e0b" icon={Clock}        />
          <StatCard label="Active"       value={stats.active}   color="#6366f1" icon={Tag}          />
          <StatCard label="Inactive"     value={stats.inactive} color="#64748b" icon={XCircle}      />
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{
        background: '#161b27', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: 14,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by pack name or seller…"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
              padding: '8px 12px 8px 30px', fontSize: 12, color: '#f1f5f9',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status filter */}
        <div style={{ position: 'relative' }}>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            style={{
              appearance: 'none', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
              padding: '8px 32px 8px 12px', fontSize: 12, color: '#f1f5f9',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
        </div>

        {/* Date range */}
        <input
          type="date" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#64748b', outline: 'none',
          }}
        />
        <input
          type="date" value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1) }}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#64748b', outline: 'none',
          }}
        />

        {/* Clear filters */}
        {(search || status || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 12px', borderRadius: 9,
              border: '1px solid rgba(239,68,68,0.2)',
              background: 'rgba(239,68,68,0.07)',
              color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{
        background: '#161b27', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Table header bar */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
            All Packs
            {packs && (
              <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>
                ({packs.total} total)
              </span>
            )}
          </p>
          {stats && stats.pending > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
              background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.25)',
            }}>
              {stats?.pending ?? 0} pending review
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: '#64748b' }}>
            <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', color: '#db142e' }} />
            Loading packs…
          </div>
        ) : error ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <AlertCircle size={28} color="#db142e" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 14px' }}>Failed to load packs.</p>
            <button onClick={load} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: '#db142e', color: '#fff',
              fontWeight: 700, fontSize: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
            }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : !packs?.data.length ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Package2 size={40} style={{ color: '#1e2128', margin: '0 auto 14px', display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>No packs found</p>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              {search || status ? 'Try adjusting your filters.' : 'No sellers have created packs yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Pack</th>
                  <th style={th}>Seller</th>
                  <th style={{ ...th, textAlign: 'right' }}>Price</th>
                  <th style={th}>Status</th>
                  <th style={th}>Created</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packs.data.map(pack => (
                  <PackRow
                    key={pack.id}
                    pack={pack}
                    onView={() => openDrawer(pack.id)}
                    onApprove={() => handleQuickApprove(pack)}
                    onDelete={() => handleQuickDelete(pack)}
                    approving={approvingId === pack.id}
                    deleting={deletingId === pack.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {packs && packs.last_page > 1 && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, color: '#475569' }}>
              Showing {packs.from}–{packs.to} of {packs.total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: packs.last_page }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 30, height: 30, borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: p === page ? '#db142e' : 'rgba(255,255,255,0.04)',
                    color: p === page ? '#fff' : '#64748b',
                    fontSize: 12, fontWeight: p === page ? 800 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <PackDetailDrawer
        packId={selectedId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={load}
      />

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}