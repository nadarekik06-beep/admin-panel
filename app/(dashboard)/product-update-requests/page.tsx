'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, Loader2, X, ArrowRight } from 'lucide-react'
import { productUpdateRequestsApi, UpdateRequest } from '@/lib/api/productUpdateRequests'
import { PaginatedResponse } from '@/types'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'pending' | 'approved' | 'rejected' | ''

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
      {message}
    </div>
  )
}

// ─── Diff Row ─────────────────────────────────────────────────────────────────

function DiffRow({ label, oldValue, newValue }: { label: string; oldValue: any; newValue: any }) {
  const changed = String(oldValue) !== String(newValue)
  if (!changed) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 24px 1fr', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '3px 8px', borderRadius: 6, fontWeight: 600, textDecoration: 'line-through' }}>{oldValue ?? '—'}</span>
      <ArrowRight size={14} style={{ color: '#6b7280', justifySelf: 'center' }} />
      <span style={{ fontSize: 13, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>{newValue ?? '—'}</span>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    pending:  { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: 'rgba(245,158,11,0.25)'  },
    approved: { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', border: 'rgba(16,185,129,0.25)'  },
    rejected: { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: 'rgba(239,68,68,0.25)'   },
  }
  const style = map[status] ?? map.pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, textTransform: 'capitalize', background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
      {status}
    </span>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  request: UpdateRequest
  onClose: () => void
  onApprove: (id: number) => Promise<void>
  onReject: (id: number, comment: string) => Promise<void>
}

function DetailModal({ request, onClose, onApprove, onReject }: DetailModalProps) {
  const [rejectComment, setRejectComment] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const current  = request.current_data ?? {}
  const proposed = request.proposed_data ?? {}

  const handleApprove = async () => {
    setSaving(true)
    try { await onApprove(request.id) } finally { setSaving(false) }
  }

  const handleReject = async () => {
    setSaving(true)
    try { await onReject(request.id, rejectComment) } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#111318', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: '100%', maxWidth: 620, maxHeight: '88vh', overflowY: 'auto', border: '1px solid #1e2128' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #1e2128' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: '#fcfdfd', margin: 0 }}>Update Request #{request.id}</h3>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>
              Submitted {format(new Date(request.created_at), 'MMM d, yyyy HH:mm')} by {request.seller?.name}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={request.status} />
            <button onClick={onClose} style={{ padding: 6, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Product info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#0d0f14', borderRadius: 12, border: '1px solid #1e2128' }}>
            {request.product?.primary_image_url ? (
              <img src={request.product.primary_image_url} alt={request.product?.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1e2128', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={16} color="#4b5563" />
              </div>
            )}
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fcfdfd', margin: 0 }}>{request.product?.name ?? '—'}</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                {request.product?.category?.name ?? 'Uncategorized'} · ID #{request.product_id}
              </p>
            </div>
          </div>

          {/* Proposed changes diff */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 12 }}>Proposed Changes</p>

            {Object.keys(proposed).filter(k => k !== '_note' && k !== 'variants').length === 0 && !proposed.variants ? (
              <p style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Only variants were changed.</p>
            ) : null}

            {'price' in proposed && (
              <DiffRow label="Price" oldValue={`${Number(current.price ?? 0).toFixed(3)} TND`} newValue={`${Number(proposed.price).toFixed(3)} TND`} />
            )}
            {'stock' in proposed && (
              <DiffRow label="Stock" oldValue={current.stock} newValue={proposed.stock} />
            )}
            {'category_id' in proposed && (
              <DiffRow label="Category" oldValue={current.category_name ?? current.category_id} newValue={proposed.category_id} />
            )}
            {'subcategory_id' in proposed && (
              <DiffRow label="Subcategory" oldValue={current.subcategory_name ?? current.subcategory_id} newValue={proposed.subcategory_id} />
            )}

            {'variants' in proposed && Array.isArray(proposed.variants) && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variants ({proposed.variants.length})</p>
                {proposed.variants.map((v: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: '#c8cad0', padding: '4px 0', borderBottom: i < proposed.variants.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span style={{ fontWeight: 600 }}>Variant {v.id ? `#${v.id}` : 'New'}</span>
                    {' — '}
                    Stock: <span style={{ color: '#10b981', fontWeight: 700 }}>{v.stock}</span>
                    {v.price_override != null && <> · Price: <span style={{ color: '#10b981', fontWeight: 700 }}>{Number(v.price_override).toFixed(3)} TND</span></>}
                    {v.sku && <> · SKU: <span style={{ color: '#10b981' }}>{v.sku}</span></>}
                  </div>
                ))}
              </div>
            )}

            {proposed._note && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#0d0f14', borderRadius: 8, border: '1px solid #1e2128' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Seller's Note</p>
                <p style={{ fontSize: 13, color: '#c8cad0', margin: 0 }}>{proposed._note}</p>
              </div>
            )}
          </div>

          {/* Admin comment (if rejected) */}
          {request.admin_comment && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>Admin Comment</p>
              <p style={{ fontSize: 13, color: '#c8cad0', margin: 0 }}>{request.admin_comment}</p>
            </div>
          )}

          {/* Actions (only for pending) */}
          {request.status === 'pending' && (
            <>
              {showRejectForm ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      Rejection Reason <span style={{ color: '#ef4444' }}>*</span>
    </label>
    <textarea
      placeholder="Reason for rejection…"
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    rows={3}
                    style={{ width: '100%', background: '#0d0f14', border: '1px solid #1e2128', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#fcfdfd', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowRejectForm(false)} style={{ flex: 1, padding: '10px 0', border: '1px solid #1e2128', background: 'transparent', color: '#6b7280', fontWeight: 700, fontSize: 13, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                    <button onClick={handleReject} disabled={saving || !rejectComment.trim()}                      style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving || !rejectComment.trim() ? 0.6 : 1, fontFamily: 'inherit' }}>
                      {saving && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowRejectForm(true)}
                    style={{ flex: 1, padding: '11px 0', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 700, fontSize: 13, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
                    <XCircle size={14} /> Reject
                  </button>
                  <button onClick={handleApprove} disabled={saving}
                    style={{ flex: 1, padding: '11px 0', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 800, fontSize: 13, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)', fontFamily: 'inherit' }}>
                    {saving ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={14} />}
                    Approve & Apply
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductUpdateRequestsPage() {
  const [data,          setData]          = useState<PaginatedResponse<UpdateRequest> | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('pending')
  const [page,          setPage]          = useState(1)
  const [toast,         setToast]         = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selected,      setSelected]      = useState<UpdateRequest | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productUpdateRequestsApi.list({ status: statusFilter || undefined, search: search || undefined, page })
      setData(res)
    } catch { /* keep previous */ }
    finally { setLoading(false) }
  }, [statusFilter, search, page])

  useEffect(() => { const t = setTimeout(fetchRequests, 300); return () => clearTimeout(t) }, [fetchRequests])

  const openDetail = async (req: UpdateRequest) => {
    setDetailLoading(true)
    try {
      const full = await productUpdateRequestsApi.get(req.id)
      setSelected(full)
    } catch { setToast({ message: 'Failed to load request details.', type: 'error' }) }
    finally { setDetailLoading(false) }
  }

  const handleApprove = async (id: number) => {
    await productUpdateRequestsApi.approve(id)
    setToast({ message: 'Request approved and changes applied.', type: 'success' })
    setSelected(null)
    fetchRequests()
  }

  const handleReject = async (id: number, comment: string) => {
    await productUpdateRequestsApi.reject(id, comment)
    setToast({ message: 'Request rejected.', type: 'success' })
    setSelected(null)
    fetchRequests()
  }

  const border   = 'rgba(255,255,255,0.07)'
  const cardBg   = '#161b27'
  const textMain = '#fcfdfd'
  const textMuted = '#6b7280'
  const theadBg  = 'rgba(255,255,255,0.04)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: textMain, margin: '0 0 2px', letterSpacing: '-0.02em' }}>Product Update Requests</h1>
        <p style={{ fontSize: 11, color: textMuted, margin: 0, fontWeight: 500 }}>Review seller-requested changes to approved products</p>
      </div>

      {/* Filters */}
      <div style={{ background: cardBg, borderRadius: 16, padding: 16, border: `1px solid ${border}`, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: textMuted, pointerEvents: 'none' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by product or seller…"
            style={{ width: '100%', border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px 8px 32px', fontSize: 13, fontWeight: 500, background: '#0d1117', color: textMain, outline: 'none' }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(1) }}
          style={{ border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 500, background: '#0d1117', color: textMain, outline: 'none' }}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {data && <span style={{ fontSize: 11, fontWeight: 700, color: textMuted, marginLeft: 'auto' }}>{data.total} request{data.total !== 1 ? 's' : ''}</span>}
      </div>

      {/* Table */}
      <div style={{ background: cardBg, borderRadius: 18, border: `1px solid ${border}`, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite', color: '#db142e' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: theadBg }}>
                  {['#', 'Product', 'Seller', 'Changes', 'Submitted', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map(req => {
                  const proposed = req.proposed_data ?? {}
                  const changedKeys = Object.keys(proposed).filter(k => k !== '_note')
                  return (
                    <tr key={req.id} style={{ borderTop: `1px solid ${border}` }}>
                      <td style={{ padding: '12px 18px', color: textMuted, fontFamily: 'monospace', fontSize: 11 }}>#{req.id}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <div>
                          <p style={{ fontWeight: 800, color: textMain, margin: '0 0 2px' }}>{req.product?.name ?? '—'}</p>
                          <p style={{ fontSize: 10, color: textMuted, margin: 0 }}>ID #{req.product_id}</p>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <p style={{ fontWeight: 600, color: textMain, margin: '0 0 2px' }}>{req.seller?.name ?? '—'}</p>
                        <p style={{ fontSize: 10, color: textMuted, margin: 0 }}>{req.seller?.email}</p>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {changedKeys.map(k => (
                            <span key={k} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', textTransform: 'capitalize' }}>
                              {k === 'variants' ? 'variants' : k.replace('_', ' ')}
                            </span>
                          ))}
                          {changedKeys.length === 0 && <span style={{ color: textMuted, fontSize: 11 }}>—</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', color: textMuted, whiteSpace: 'nowrap' }}>
                        {format(new Date(req.created_at), 'MMM d, yyyy')}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <StatusBadge status={req.status} />
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button onClick={() => openDetail(req)} style={{ padding: '5px 10px', border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {detailLoading ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Eye size={11} />}
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(data?.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '56px 20px', textAlign: 'center', color: textMuted, fontSize: 13 }}>
                      No update requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.last_page > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: `1px solid ${border}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: textMuted }}>Showing {data.from}–{data.to} of {data.total}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: 6, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: textMuted, opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 11, fontWeight: 800, color: textMain, padding: '0 4px' }}>{data.current_page}/{data.last_page}</span>
              <button onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={page === data.last_page} style={{ padding: 6, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: textMuted, opacity: page === data.last_page ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <DetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}